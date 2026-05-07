import type { ChatCompletionsRequest, ChatMessage, ChatTool, ChatToolCall } from "../types/chat.js";
import type { ResponsesRequest, ResponsesTool } from "../types/responses.js";
import { chatContentToResponses, contentToString } from "./content.js";

function messageToResponsesInput(message: ChatMessage): unknown[] {
  if (message.role === "tool") {
    return [
      {
        type: "function_call_output",
        call_id: message.tool_call_id,
        output: contentToString(message.content)
      }
    ];
  }

  if (message.role === "assistant") {
    const items: unknown[] = [];
    const text = contentToString(message.content);
    if (text || !message.tool_calls?.length) {
      items.push({
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text,
            annotations: []
          }
        ]
      });
    }

    for (const toolCall of message.tool_calls ?? []) {
      if (toolCall.type !== "function") continue;
      items.push(toolCallToResponses(toolCall));
    }
    return items;
  }

  if (message.role === "user") {
    return [
      {
        role: "user",
        content: chatContentToResponses(message.content)
      }
    ];
  }

  return [];
}

function toolCallToResponses(toolCall: ChatToolCall): unknown {
  return {
    type: "function_call",
    id: toolCall.id,
    call_id: toolCall.id,
    name: toolCall.function?.name,
    arguments: toolCall.function?.arguments ?? "",
    status: "completed"
  };
}

function toolsToResponses(tools: ChatTool[] | undefined): ResponsesTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools
    .filter((tool) => tool.type === "function" && tool.function)
    .map((tool) =>
      compact({
        type: "function",
        name: tool.function?.name,
        description: tool.function?.description,
        parameters: tool.function?.parameters,
        strict: tool.function?.strict
      }) as ResponsesTool
    );
}

function responseFormatToText(responseFormat: unknown): unknown {
  if (!responseFormat || typeof responseFormat !== "object") return undefined;
  const rf = responseFormat as Record<string, unknown>;
  if (rf.type === "json_object") {
    return { format: { type: "json_object" } };
  }
  if (rf.type === "text") {
    return { format: { type: "text" } };
  }
  if (rf.type === "json_schema" && rf.json_schema && typeof rf.json_schema === "object") {
    const schema = rf.json_schema as Record<string, unknown>;
    return {
      format: compact({
        type: "json_schema",
        name: schema.name,
        description: schema.description,
        schema: schema.schema,
        strict: schema.strict
      })
    };
  }
  return { format: responseFormat };
}

function toolChoiceToResponses(toolChoice: unknown): unknown {
  if (!toolChoice || typeof toolChoice !== "object") return toolChoice;
  const choice = toolChoice as { type?: string; function?: { name?: string } };
  if (choice.type === "function" && choice.function?.name) {
    return { type: "function", name: choice.function.name };
  }
  return toolChoice;
}

export function chatToResponsesRequest(chatReq: ChatCompletionsRequest): ResponsesRequest {
  const instructions = (chatReq.messages ?? [])
    .filter((message) => message.role === "system" || message.role === "developer")
    .map((message) => contentToString(message.content))
    .filter(Boolean)
    .join("\n\n");

  const input = (chatReq.messages ?? []).flatMap(messageToResponsesInput);
  const request: ResponsesRequest = {
    model: chatReq.model,
    input,
    stream: Boolean(chatReq.stream)
  };

  if (instructions) request.instructions = instructions;
  request.max_output_tokens = chatReq.max_completion_tokens ?? chatReq.max_tokens;
  request.temperature = chatReq.temperature;
  request.top_p = chatReq.top_p;
  request.frequency_penalty = chatReq.frequency_penalty;
  request.presence_penalty = chatReq.presence_penalty;
  request.stop = chatReq.stop;
  request.seed = chatReq.seed;
  request.store = chatReq.store;
  request.metadata = chatReq.metadata;
  request.service_tier = chatReq.service_tier;
  request.parallel_tool_calls = chatReq.parallel_tool_calls;
  request.user = chatReq.user;
  request.tools = toolsToResponses(chatReq.tools);
  request.tool_choice = toolChoiceToResponses(chatReq.tool_choice);
  request.text = responseFormatToText(chatReq.response_format);
  request.top_logprobs = chatReq.top_logprobs ?? (chatReq.logprobs ? 1 : undefined);
  request.reasoning = chatReq.reasoning ?? (chatReq.reasoning_effort ? { effort: chatReq.reasoning_effort } : undefined);

  return compact(request as unknown as Record<string, unknown>) as unknown as ResponsesRequest;
}

function compact(object: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
