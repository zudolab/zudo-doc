import type { FeatureModule } from "../compose.js";

/**
 * llms-txt feature.
 *
 * W7A (#1736): the inject() that previously added `<link rel="alternate">`
 * tags to `<head>` is dropped per locked spec §6.3 — `_head-with-defaults.tsx`
 * does not emit those tags today (neither does host). If a follow-up decides
 * to emit them, add the gated `<link>` rendering inside `_head-with-defaults.tsx`
 * — not in a feature inject. The plugin itself is wired by `zfb-config-gen.ts`.
 */
export const llmsTxtFeature: FeatureModule = () => ({
  name: "llmsTxt",
  injections: [],
});
