import type { ChatCompletionsResponse, ChatMessage, ChatToolCall, ChatUsage } from "../types/chat.js";
import type { ResponsesOutputItem, ResponsesResponse, ResponsesUsage } from "../types/responses.js";
import { contentToString } from "./content.js";
import { convertId, nowUnix } from "../utils/ids.js";

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

function outputText(response: ResponsesResponse): string {
  if (typeof response.output_text === "string") return response.output_text;
  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" || part.type === "text") chunks.push(part.text ?? "");
    }
  }
  return chunks.join("");
}

function refusal(response: ResponsesResponse): string | undefined {
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "refusal") return part.refusal ?? part.text;
    }
  }
  return undefined;
}

function toolCallFromOutput(item: ResponsesOutputItem): ChatToolCall | undefined {
  if (item.type !== "function_call") return undefined;
  const id = item.call_id || item.id;
  return {
    id,
    type: "function",
    function: {
      name: item.name,
      arguments: item.arguments ?? ""
    }
  };
}

function finishReason(response: ResponsesResponse, toolCalls: ChatToolCall[]): string {
  if (toolCalls.length > 0) return "tool_calls";
  if (response.status === "incomplete") return "length";
  return "stop";
}

export function responsesToChatCompletion(response: ResponsesResponse, fallbackModel = "unknown"): ChatCompletionsResponse {
  const toolCalls = (response.output ?? []).map(toolCallFromOutput).filter(Boolean) as ChatToolCall[];
  const text = outputText(response);
  const refusalText = refusal(response);
  const message: ChatMessage = {
    role: "assistant",
    content: toolCalls.length > 0 && !text ? null : text
  };
  if (toolCalls.length) message.tool_calls = toolCalls;
  if (refusalText) message.refusal = refusalText;

  return {
    id: convertId(response.id, "chatcmpl-"),
    object: "chat.completion",
    created: response.created_at ?? nowUnix(),
    model: response.model ?? fallbackModel,
    service_tier: response.service_tier,
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason(response, toolCalls)
      }
    ],
    usage: usageToChat(response.usage)
  };
}

export function chatContentToResponsesText(content: unknown): string {
  return contentToString(content);
}
