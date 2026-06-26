// zfb config for the no-src route-injection build proof — i18n variant (S1 #2370).
// Same preset wiring as the `route-injection` fixture, but its settings declare
// a `ja` locale so the locale-prefixed injected routes are emitted. Used by the
// no-src test variant to prove the resolver picks `routes-src/*.tsx` (NOT a
// missing `src/`) for BOTH plain and `/[locale]/...` dynamic routes.

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
  });
}

const directiveVocabulary = {};

export default defineConfig({
  framework: "preact",
  port: 4351,
  tailwind: { enabled: true },
  base: settings.base,
  // No adapter — static output only (no SSR routes needed for this proof).
  ...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary }),
});
