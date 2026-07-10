/**
 * Default directive vocabulary — the canonical seven.
 *
 * Ported from the `directiveVocabulary` object that every
 * `create-zudo-doc`-generated `zfb.config.ts` previously hardcoded inline
 * (see `packages/create-zudo-doc/src/zfb-config-gen.ts`'s `generateZfbConfig`
 * and this repo's own `zfb.config.ts`) into a package default (epic
 * zudolab/zudo-doc#2651, S4 #2654).
 *
 * Keys are directive names; values are the JSX component names the markdown
 * pipeline's `directives` feature resolves them to (registered in the host's
 * `pages/_mdx-components.ts`). `details` routes to a collapsible, NOT an
 * admonition — the other six are admonition variants.
 */

import type { DirectiveVocabulary } from "../preset.js";

export const defaultDirectiveVocabulary: DirectiveVocabulary = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  warning: "Warning",
  danger: "Danger",
  caution: "Caution",
  details: "Details",
};
