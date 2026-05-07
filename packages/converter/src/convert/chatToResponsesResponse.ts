import type { ChatCompletionsResponse, ChatMessage, ChatToolCall, ChatUsage } from "../types/chat.js";
import type { ResponsesOutputItem, ResponsesResponse, ResponsesUsage } from "../types/responses.js";
import { contentToString } from "./content.js";
import { convertId, nowUnix } from "../utils/ids.js";

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

function toolCallToOutput(toolCall: ChatToolCall): ResponsesOutputItem {
  const callId = toolCall.id || convertId(undefined, "call_");
  return {
    id: callId,
    type: "function_call",
    status: "completed",
    call_id: callId,
    name: toolCall.function?.name,
    arguments: toolCall.function?.arguments ?? ""
  };
}

function messageToOutput(message: ChatMessage | undefined): ResponsesOutputItem[] {
  if (!message) return [];
  const output: ResponsesOutputItem[] = [];
  const text = contentToString(message.content);
  if (text || !message.tool_calls?.length) {
    output.push({
      id: convertId(undefined, "msg_"),
      type: "message",
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text,
          annotations: []
        }
      ]
    });
  }
  output.push(...(message.tool_calls ?? []).map(toolCallToOutput));
  return output;
}

function responseStatus(finishReason: string | null | undefined): "completed" | "incomplete" {
  return finishReason === "length" ? "incomplete" : "completed";
}

function outputText(output: ResponsesOutputItem[]): string {
  return output
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" || part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export function chatCompletionToResponses(response: ChatCompletionsResponse, fallbackModel = "unknown"): ResponsesResponse {
  const choice = response.choices[0];
  const output = messageToOutput(choice?.message);
  const status = responseStatus(choice?.finish_reason);
  return {
    id: convertId(response.id, "resp_"),
    object: "response",
    created_at: response.created ?? nowUnix(),
    status,
    model: response.model ?? fallbackModel,
    output,
    output_text: outputText(output),
    usage: usageToResponses(response.usage),
    service_tier: response.service_tier,
    incomplete_details: status === "incomplete" ? { reason: "max_output_tokens" } : undefined
  };
}
