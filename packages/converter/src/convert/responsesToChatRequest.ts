import type { ChatCompletionsRequest, ChatMessage, ChatTool } from "../types/chat.js";
import type { ResponsesRequest, ResponsesTool } from "../types/responses.js";
import { contentToString, responsesContentToChat } from "./content.js";

function responseInputToMessages(input: unknown): ChatMessage[] {
  if (input == null) return [];
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (!Array.isArray(input)) return [{ role: "user", content: contentToString(input) }];

  const messages: ChatMessage[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;

    if (record.type === "function_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: typeof record.call_id === "string" ? record.call_id : undefined,
        content: contentToString(record.output)
      });
      continue;
    }

    if (record.type === "function_call") {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: typeof record.call_id === "string" ? record.call_id : typeof record.id === "string" ? record.id : undefined,
            type: "function",
            function: {
              name: typeof record.name === "string" ? record.name : undefined,
              arguments: typeof record.arguments === "string" ? record.arguments : ""
            }
          }
        ]
      });
      continue;
    }

    const role = typeof record.role === "string" ? record.role : undefined;
    if (!role) continue;
    messages.push({
      role,
      content: responsesContentToChat(record.content) as ChatMessage["content"]
    });
  }
  return messages;
}

function toolsToChat(tools: ResponsesTool[] | undefined): ChatTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools
    .filter((tool) => tool.type === "function" && tool.name)
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name!,
        description: tool.description,
        parameters: tool.parameters,
        strict: tool.strict
      }
    }));
}

function responseTextToFormat(text: unknown): unknown {
  if (!text || typeof text !== "object") return undefined;
  const format = (text as { format?: unknown }).format;
  if (!format || typeof format !== "object") return undefined;
  const value = format as Record<string, unknown>;
  if (value.type === "json_schema") {
    return {
      type: "json_schema",
      json_schema: {
        name: value.name,
        description: value.description,
        schema: value.schema,
        strict: value.strict
      }
    };
  }
  return format;
}

function toolChoiceToChat(toolChoice: unknown): unknown {
  if (!toolChoice || typeof toolChoice !== "object") return toolChoice;
  const choice = toolChoice as { type?: string; name?: string };
  if (choice.type === "function" && choice.name) {
    return { type: "function", function: { name: choice.name } };
  }
  return toolChoice;
}

export function responsesToChatCompletionRequest(body: ResponsesRequest): ChatCompletionsRequest {
  const messages = responseInputToMessages(body.input);
  if (body.instructions) {
    messages.unshift({ role: "system", content: body.instructions });
  }

  return {
    model: body.model,
    messages,
    stream: Boolean(body.stream),
    max_completion_tokens: body.max_output_tokens,
    temperature: body.temperature,
    top_p: body.top_p,
    frequency_penalty: body.frequency_penalty,
    presence_penalty: body.presence_penalty,
    tools: toolsToChat(body.tools),
    tool_choice: toolChoiceToChat(body.tool_choice),
    parallel_tool_calls: body.parallel_tool_calls,
    user: body.user,
    reasoning: body.reasoning,
    response_format: responseTextToFormat(body.text),
    service_tier: body.service_tier,
    stop: body.stop,
    seed: body.seed
  };
}
