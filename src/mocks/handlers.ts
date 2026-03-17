import { http, HttpResponse, delay } from "msw";

// Mock responses that simulate a documentation assistant
const mockResponses = [
  "I can help you with that! This documentation site is built with Astro 6, MDX, and Tailwind CSS v4. What specific topic are you interested in?",
  "Great question! You can find that information in the Getting Started guide. The key steps are:\n\n1. Install dependencies with `pnpm install`\n2. Run `pnpm dev` to start the dev server\n3. Open http://localhost:4321 in your browser",
  "The component system uses Astro components by default for zero JS, and React islands only when client-side interactivity is needed. Would you like to know more about a specific component?",
  "Sure! The design token system has three tiers:\n- Tier 1: Palette colors (--zd-0 through --zd-15)\n- Tier 2: Semantic tokens (bg, fg, surface, muted, accent)\n- Tier 3: Component-level tokens\n\nAlways use semantic tokens in your components.",
  "I'd recommend checking the Guides section for detailed walkthroughs. Is there anything specific you'd like me to explain?",
];

let responseIndex = 0;

export const handlers = [
  http.post("*/api/ai-chat", async () => {
    // Simulate network delay (1-2 seconds)
    await delay(1000 + Math.random() * 1000);

    // Cycle through mock responses
    const response = mockResponses[responseIndex % mockResponses.length];
    responseIndex++;

    return HttpResponse.json({ response });
  }),
];
