// Minimal zfb config for the route-injection build proof fixture (A2 #2363).
// Uses the preset with `packageOwnedRoutes: true` (set in settings). The
// `pages/` directory is intentionally minimal (or empty for the no-stub test
// case — set up by the test harness at run time). This fixture proves the A1
// seam by building and asserting rendered HTML from injected routes.

import { defineConfig } from "zfb/config";
import { zudoDocPreset } from "@takazudo/zudo-doc/preset";
import { settings } from "./src/config/settings";
import { z } from "zod";

function buildDocsSchema() {
  return z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    category_no_page: z.boolean().optional(),
    slug: z.string().optional(),
    tags: z.array(z.string()).optional(),
    noindex: z.boolean().optional(),
    // CB #2505: frontmatter-keyed field read by chrome-bindings.tsx's
    // docContentHeaderExtras binding (end-to-end proof of the seam).
    tier: z.string().optional(),
  });
}

const directiveVocabulary = {};

export default defineConfig({
  framework: "preact",
  port: 4350,
  tailwind: { enabled: true },
  base: settings.base,
  // No adapter — static output only (no SSR routes needed for this proof).
  ...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary }),
});
