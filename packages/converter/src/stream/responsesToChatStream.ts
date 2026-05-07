import type { ServerResponse } from "node:http";
import type { ChatCompletionsResponse, ChatToolCall, ChatUsage } from "../types/chat.js";
import type { ResponsesSseEvent, ResponsesUsage } from "../types/responses.js";
import { generateId, nowUnix } from "../utils/ids.js";
import { encodeSseData, readSseEvents, sseDone } from "./sse.js";

interface ToolState {
  id?: string;
  name?: string;
  arguments: string;
  index: number;
  initialized: boolean;
}

function usageToChat(usage: ResponsesUsage | undefined): ChatUsage | undefined {
  if (!usage) return undefined;
  return {
    prompt_tokens: usage.input_tokens,
    completion_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    prompt_tokens_details: usage.input_tokens_details
      ? { cached_tokens: usage.input_tokens_details.cached_tokens }
      : undefined,
    completion_tokens_details: usage.output_tokens_details
      ? { reasoning_tokens: usage.output_tokens_details.reasoning_tokens }
      : undefined
  };
}

function chunk(id: string, created: number, model: string, delta: Record<string, unknown>, finishReason: string | null = null, usage?: ChatUsage): ChatCompletionsResponse {
  return {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
    usage
  };
}

export async function pipeResponsesToChatStream(upstream: Response, res: ServerResponse, fallbackModel: string): Promise<void> {
  const id = generateId("chatcmpl-");
  const created = nowUnix();
  let model = fallbackModel;
  let roleSent = false;
  let finished = false;
  const toolsByItem = new Map<string, ToolState>();
  const toolsByIndex = new Map<number, ToolState>();
  const pendingTools = new Map<string, ToolState>();

  const write = (payload: unknown) => res.write(encodeSseData(payload));
  const ensureRole = () => {
    if (!roleSent) {
      write(chunk(id, created, model, { role: "assistant" }));
      roleSent = true;
    }
  };
  const finish = (reason: string, usage?: ChatUsage) => {
    if (finished) return;
    ensureRole();
    write(chunk(id, created, model, {}, reason, usage));
    res.write(sseDone);
    finished = true;
  };

  for await (const event of readSseEvents(upstream.body!)) {
    if (event.data === "[DONE]") break;
    let payload: ResponsesSseEvent;
    try {
      payload = JSON.parse(event.data) as ResponsesSseEvent;
    } catch {
      continue;
    }
    if (payload.response?.model) model = payload.response.model;

    switch (payload.type ?? event.event) {
      case "response.created":
        ensureRole();
        break;
      case "response.output_text.delta":
        ensureRole();
        write(chunk(id, created, model, { content: payload.delta ?? "" }));
        break;
      case "response.refusal.delta":
        ensureRole();
        write(chunk(id, created, model, { refusal: payload.delta ?? "" }));
        break;
      case "response.output_item.added": {
        if (payload.item?.type !== "function_call") break;
        ensureRole();
        const index = payload.output_index ?? toolsByIndex.size;
        const state: ToolState = {
          id: payload.item.call_id || payload.item.id,
          name: payload.item.name,
          arguments: payload.item.arguments ?? "",
          index,
          initialized: true
        };
        if (payload.item.id) toolsByItem.set(payload.item.id, state);
        if (payload.item.call_id) toolsByItem.set(payload.item.call_id, state);
        toolsByIndex.set(index, state);
        if (state.id) pendingTools.set(state.id, state);
        const toolCall: ChatToolCall = {
          id: state.id,
          type: "function",
          index,
          function: { name: state.name, arguments: "" }
        };
        write(chunk(id, created, model, { tool_calls: [toolCall] }));
        break;
      }
      case "response.function_call_arguments.delta": {
        ensureRole();
        const index = payload.output_index ?? 0;
        let state = (payload.item_id && toolsByItem.get(payload.item_id)) || toolsByIndex.get(index);
        if (!state) {
          state = { index, arguments: "", initialized: false };
          toolsByIndex.set(index, state);
        }
        state.arguments += payload.delta ?? "";
        if (state.id) pendingTools.set(state.id, state);
        write(chunk(id, created, model, {
          tool_calls: [
            {
              index,
              function: { arguments: payload.delta ?? "" }
            }
          ]
        }));
        break;
      }
      case "response.function_call_arguments.done":
      case "response.output_item.done": {
        if (payload.item?.type !== "function_call") break;
        const index = payload.output_index ?? 0;
        let state = (payload.item.id && toolsByItem.get(payload.item.id)) || toolsByIndex.get(index);
        if (!state) {
          state = {
            id: payload.item.call_id || payload.item.id,
            name: payload.item.name,
            arguments: payload.item.arguments ?? payload.arguments ?? "",
            index,
            initialized: true
          };
        }
        if (payload.item.arguments !== undefined) state.arguments = payload.item.arguments;
        if (state.id) pendingTools.set(state.id, state);
        break;
      }
      case "response.completed": {
        const reason = pendingTools.size > 0 ? "tool_calls" : "stop";
        finish(reason, usageToChat(payload.response?.usage));
        break;
      }
      case "response.incomplete":
        finish("length", usageToChat(payload.response?.usage));
        break;
      case "response.failed":
        finish("stop", usageToChat(payload.response?.usage));
        break;
      default:
        break;
    }
  }

  if (!finished) finish(pendingTools.size > 0 ? "tool_calls" : "stop");
}
