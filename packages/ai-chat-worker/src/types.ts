export interface Env {
  ANTHROPIC_API_KEY: string;
  DOCS_SITE_URL: string;
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
export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  content: Array<{ type: "text"; text: string } | { type: string }>;
  stop_reason: string;
}
