export interface ResponsesRequest {
  model: string;
  input?: unknown;
  instructions?: string;
  stream?: boolean;
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: ResponsesTool[];
  tool_choice?: unknown;
  parallel_tool_calls?: boolean;
  user?: string;
  reasoning?: unknown;
  text?: unknown;
  truncation?: unknown;
  store?: boolean;
  metadata?: Record<string, unknown>;
  frequency_penalty?: number;
  presence_penalty?: number;
  previous_response_id?: string;
  service_tier?: string;
  top_logprobs?: number;
  stop?: unknown;
  seed?: number;
}

export interface ResponsesTool {
  type: string;
  name?: string;
  description?: string;
  parameters?: unknown;
  strict?: boolean;
  [key: string]: unknown;
}

export interface ResponsesResponse {
  id: string;
  object?: string;
  created_at?: number;
  status?: string;
  model?: string;
  output?: ResponsesOutputItem[];
  output_text?: string;
  usage?: ResponsesUsage;
  error?: unknown;
  service_tier?: string;
  incomplete_details?: { reason?: string } | unknown;
}

export interface ResponsesOutputItem {
  id?: string;
  type: string;
  status?: string;
  role?: string;
  content?: ResponsesContentPart[];
  name?: string;
  arguments?: string;
  call_id?: string;
}

export interface ResponsesContentPart {
  type: string;
  text?: string;
  annotations?: unknown;
  refusal?: string;
}

export interface ResponsesUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
}

export interface ResponsesSseEvent {
  type?: string;
  response?: ResponsesResponse;
  output_index?: number;
  content_index?: number;
  item_id?: string;
  item?: ResponsesOutputItem;
  delta?: string;
  arguments?: string;
}
