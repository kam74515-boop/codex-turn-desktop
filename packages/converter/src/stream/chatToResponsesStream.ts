import type { ServerResponse } from "node:http";
import type { ChatCompletionsResponse, ChatToolCall, ChatUsage } from "../types/chat.js";
import type { ResponsesOutputItem, ResponsesUsage } from "../types/responses.js";
import { convertId, generateId, nowUnix } from "../utils/ids.js";
import { encodeSseEvent, readSseEvents } from "./sse.js";

interface MessageState {
  id: string;
  text: string;
  outputIndex: number;
  initialized: boolean;
}

interface ToolState {
  id: string;
  name?: string;
  arguments: string;
  outputIndex: number;
  initialized: boolean;
}

function usageToResponses(usage: ChatUsage | undefined): ResponsesUsage | undefined {
  if (!usage) return undefined;
  return {
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    input_tokens_details: usage.prompt_tokens_details
      ? { cached_tokens: usage.prompt_tokens_details.cached_tokens }
      : undefined,
    output_tokens_details: usage.completion_tokens_details
      ? { reasoning_tokens: usage.completion_tokens_details.reasoning_tokens }
      : undefined
  };
}

function messageItem(state: MessageState, status: "in_progress" | "completed"): ResponsesOutputItem {
  return {
    id: state.id,
    type: "message",
    status,
    role: "assistant",
    content: [
      {
        type: "output_text",
        text: state.text,
        annotations: []
      }
    ]
  };
}

function toolItem(state: ToolState, status: "in_progress" | "completed"): ResponsesOutputItem {
  return {
    id: state.id,
    type: "function_call",
    status,
    call_id: state.id,
    name: state.name,
    arguments: state.arguments
  };
}

export async function pipeChatToResponsesStream(upstream: Response, res: ServerResponse, fallbackModel: string): Promise<void> {
  let id = generateId("resp_");
  const created = nowUnix();
  let model = fallbackModel;
  let responseStarted = false;
  let finished = false;
  let nextOutputIndex = 0;
  let message: MessageState | undefined;
  let finalUsage: ResponsesUsage | undefined;
  const tools = new Map<number, ToolState>();

  const write = (event: string, payload: unknown) => res.write(encodeSseEvent(event, payload));
  const responsePayload = (status: "in_progress" | "completed" | "incomplete") => ({
    id,
    object: "response",
    created_at: created,
    status,
    model,
    output: [
      ...(message ? [messageItem(message, status === "in_progress" ? "in_progress" : "completed")] : []),
      ...Array.from(tools.values()).map((tool) => toolItem(tool, status === "in_progress" ? "in_progress" : "completed"))
    ],
    output_text: message?.text ?? "",
    usage: finalUsage
  });

  const ensureResponse = () => {
    if (responseStarted) return;
    write("response.created", {
      type: "response.created",
      response: responsePayload("in_progress")
    });
    responseStarted = true;
  };

  const ensureMessage = () => {
    ensureResponse();
    if (message?.initialized) return message;
    message = {
      id: generateId("msg_"),
      text: "",
      outputIndex: nextOutputIndex++,
      initialized: true
    };
    write("response.output_item.added", {
      type: "response.output_item.added",
      output_index: message.outputIndex,
      item: messageItem(message, "in_progress")
    });
    write("response.content_part.added", {
      type: "response.content_part.added",
      item_id: message.id,
      output_index: message.outputIndex,
      content_index: 0,
      part: { type: "output_text", text: "", annotations: [] }
    });
    return message;
  };

  const ensureTool = (delta: ChatToolCall): ToolState => {
    ensureResponse();
    const index = delta.index ?? 0;
    let state = tools.get(index);
    if (!state) {
      state = {
        id: delta.id || generateId("call_"),
        name: delta.function?.name,
        arguments: "",
        outputIndex: nextOutputIndex++,
        initialized: true
      };
      tools.set(index, state);
      write("response.output_item.added", {
        type: "response.output_item.added",
        output_index: state.outputIndex,
        item: toolItem(state, "in_progress")
      });
    }
    if (delta.id) state.id = delta.id;
    if (delta.function?.name) state.name = delta.function.name;
    return state;
  };

  const finish = (status: "completed" | "incomplete") => {
    if (finished) return;
    ensureResponse();
    if (message) {
      write("response.output_text.done", {
        type: "response.output_text.done",
        item_id: message.id,
        output_index: message.outputIndex,
        content_index: 0,
        text: message.text
      });
      write("response.content_part.done", {
        type: "response.content_part.done",
        item_id: message.id,
        output_index: message.outputIndex,
        content_index: 0,
        part: { type: "output_text", text: message.text, annotations: [] }
      });
      write("response.output_item.done", {
        type: "response.output_item.done",
        output_index: message.outputIndex,
        item: messageItem(message, "completed")
      });
    }
    for (const tool of tools.values()) {
      write("response.function_call_arguments.done", {
        type: "response.function_call_arguments.done",
        item_id: tool.id,
        output_index: tool.outputIndex,
        arguments: tool.arguments
      });
      write("response.output_item.done", {
        type: "response.output_item.done",
        output_index: tool.outputIndex,
        item: toolItem(tool, "completed")
      });
    }
    const event = status === "incomplete" ? "response.incomplete" : "response.completed";
    write(event, {
      type: event,
      response: responsePayload(status)
    });
    finished = true;
  };

  for await (const event of readSseEvents(upstream.body!)) {
    if (event.data === "[DONE]") break;
    let payload: ChatCompletionsResponse;
    try {
      payload = JSON.parse(event.data) as ChatCompletionsResponse;
    } catch {
      continue;
    }
    if (payload.model) model = payload.model;
    if (payload.id && !responseStarted) id = convertId(payload.id, "resp_");
    if (payload.usage) finalUsage = usageToResponses(payload.usage);

    const choice = payload.choices[0];
    const delta = choice?.delta;
    if (delta?.content) {
      const state = ensureMessage();
      state.text += delta.content;
      write("response.output_text.delta", {
        type: "response.output_text.delta",
        item_id: state.id,
        output_index: state.outputIndex,
        content_index: 0,
        delta: delta.content
      });
    }
    for (const toolCall of delta?.tool_calls ?? []) {
      const state = ensureTool(toolCall);
      const argDelta = toolCall.function?.arguments ?? "";
      if (argDelta) {
        state.arguments += argDelta;
        write("response.function_call_arguments.delta", {
          type: "response.function_call_arguments.delta",
          item_id: state.id,
          output_index: state.outputIndex,
          delta: argDelta
        });
      }
    }
    if (choice?.finish_reason) {
      finish(choice.finish_reason === "length" ? "incomplete" : "completed");
    }
  }

  if (!finished) finish("completed");
}
