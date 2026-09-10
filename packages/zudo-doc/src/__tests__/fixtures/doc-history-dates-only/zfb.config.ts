// Minimal zfb config for the dates-only doc-history build proof (#4143).

import { defineConfig } from "zfb/config";
import {
  zudoDocPreset,
  type DirectiveVocabulary,
} from "@takazudo/zudo-doc/preset";
import { defaultDirectiveVocabulary } from "@takazudo/zudo-doc/directive-vocabulary-defaults";
import { settings } from "./src/config/settings";
import { z } from "zod";

function buildDocsSchema() {
  return z.object({
    title: z.string(),
    description: z.string().optional(),
    sidebar_position: z.number().optional(),
    doc_history: z.boolean().optional(),
  });
}

const directiveVocabulary: DirectiveVocabulary = {
  ...defaultDirectiveVocabulary,
};

const preset = zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary });

export default defineConfig({
  framework: "preact",
  port: 4351,
  tailwind: { enabled: true },
  base: settings.base,
  ...preset,
});
