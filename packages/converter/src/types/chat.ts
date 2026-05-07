export interface ChatCompletionsRequest {
  model: string;
  messages?: ChatMessage[];
  stream?: boolean;
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: ChatTool[];
  tool_choice?: unknown;
  parallel_tool_calls?: boolean;
  stop?: unknown;
  seed?: number;
  stream_options?: { include_usage?: boolean };
  user?: string;
  response_format?: unknown;
  logprobs?: boolean;
  top_logprobs?: number;
  reasoning_effort?: string;
  reasoning?: unknown;
  service_tier?: string;
  store?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "developer" | "user" | "assistant" | "tool" | string;
  content?: string | null | ChatContentPart[];
  name?: string;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
  refusal?: string | null;
}

export interface ChatContentPart {
  type: string;
  text?: string;
  image_url?: string | { url?: string; detail?: string };
  [key: string]: unknown;
}

export interface ChatTool {
  type: "function" | string;
  function?: {
    name: string;
    description?: string;
    parameters?: unknown;
    strict?: boolean;
  };
}

export interface ChatToolCall {
  id?: string;
  type: "function" | string;
  index?: number;
  function: {
    name?: string;
    arguments?: string;
  };
}

export interface ChatCompletionsResponse {
  id: string;
  object: "chat.completion" | "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatChoice[];
  usage?: ChatUsage;
  service_tier?: string;
  system_fingerprint?: string;
}

export interface ChatChoice {
  index: number;
  message?: ChatMessage;
  delta?: ChatDelta;
  finish_reason: string | null;
  logprobs?: unknown;
}

export interface ChatDelta {
  role?: string;
  content?: string | null;
  tool_calls?: ChatToolCall[];
  refusal?: string | null;
}

export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}
