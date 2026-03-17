export interface Env {
  ANTHROPIC_API_KEY: string;
  DOCS_SITE_URL: string;
  RATE_LIMIT: KVNamespace;
  RATE_LIMIT_PER_MINUTE: string;
  RATE_LIMIT_PER_DAY: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  response: string;
}

export interface ChatErrorResponse {
  error: string;
}

// Claude API types (raw fetch, no SDK)
export interface ClaudeTextBlock {
  type: "text";
  text: string;
}

export interface ClaudeOtherBlock {
  type: "tool_use" | "tool_result";
  [key: string]: unknown;
}

export interface ClaudeResponse {
  content: Array<ClaudeTextBlock | ClaudeOtherBlock>;
  stop_reason: string;
}
