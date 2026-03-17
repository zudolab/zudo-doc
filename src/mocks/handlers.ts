import { http, HttpResponse, delay } from "msw";

const MOCK_NOTICE =
  "**This is a mock response.** The AI assistant API is not connected.\n\n" +
  "To use the real assistant, configure your `.env` file:\n\n" +
  "```\n" +
  "# Use Claude Code CLI (local development)\n" +
  "AI_CHAT_MODE=local\n\n" +
  "# Or use Anthropic API (requires API key)\n" +
  "AI_CHAT_MODE=remote\n" +
  "ANTHROPIC_API_KEY=sk-ant-...\n" +
  "```\n\n" +
  "See the [AI Assistant guide](/docs/guides/ai-assistant) for details.";

export const handlers = [
  http.post("*/api/ai-chat", async () => {
    await delay(500);
    return HttpResponse.json({ response: MOCK_NOTICE });
  }),
];
