// Minimal zfb config for the route-injection build proof fixture (A2 #2363).
// Uses the preset with `packageOwnedRoutes: true` (set in settings). The
// `pages/` directory is intentionally minimal (or empty for the no-stub test
// case — set up by the test harness at run time). This fixture proves the A1
// seam by building and asserting rendered HTML from injected routes.

import { defineConfig } from "zfb/config";
import { zudoDocPreset, type DirectiveVocabulary } from "@takazudo/zudo-doc/preset";
import { defaultDirectiveVocabulary } from "@takazudo/zudo-doc/directive-vocabulary-defaults";
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

// A2 #3179 — the canonical seven container admonitions (note/tip/info/
// warning/danger/caution/details), plus one TEXT-shape directive (`:hl[…]`)
// that `getting-started/coverage.mdx` exercises for directive-shape
// coverage. `mark` is a plain HTML intrinsic element — it needs no
// component wiring (unlike the admonition names, which resolve through
// createMdxComponents' Note/Tip/… map).
const directiveVocabulary: DirectiveVocabulary = {
  ...defaultDirectiveVocabulary,
  hl: { component: "mark", kind: "text", titleFromLabel: false },
};

const preset = zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary });

export default defineConfig({
  framework: "preact",
  port: 4350,
  tailwind: { enabled: true },
  base: settings.base,
  // No adapter — static output only (no SSR routes needed for this proof).
  ...preset,
  markdown: {
    ...preset.markdown,
    // A2 #3179 — zfb's `gfm` default is conservative (strikethrough + table
    // only); coverage.mdx's task list and footnote need the other two GFM
    // constructs turned on explicitly.
    gfm: { taskListItem: true, footnoteDefinition: true },
  },
});
