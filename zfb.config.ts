// The single config entry file (epic zudolab/zudo-doc#2651 Minimal Scaffold,
// Wave 6 #2661) — the showcase dogfoods the same `zudoDoc()` single-entry API
// (`@takazudo/zudo-doc/config`, #2657) generated projects use, instead of the
// old `zudoDocPreset()` + manual `ZfbConfig` assembly. `settings` (project
// data, `src/config/settings.ts`) is spread straight into `zudoDoc()`; large
// genuinely-showcase-specific data blocks (tag vocabulary, custom translation
// additions) stay as separate modules imported in below — same escape hatch
// generated projects get via `ZudoDocConfig`. `buildDocsSchema`/`directives`/
// `colorSchemes` are intentionally OMITTED — the showcase's former overrides
// for all three were byte-identical to the package defaults, so this project
// now rides the package default for each (zudolab/zudo-doc#2661).
import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { settings } from "./src/config/settings";
import { tagVocabulary } from "./src/config/tag-vocabulary";
import { translations } from "./src/config/i18n";

export default defineConfig(
  zudoDoc({
    // ── Project settings (src/config/settings.ts) ──────────────────────────
    ...settings,

    // ── Escape hatches: genuinely showcase-specific data blocks ────────────
    tagVocabularyEntries: tagVocabulary,
    translations,

    // ── Host-callables channel (ADR "Host-callables channel", #2501) ───────
    // The showcase's real host-bound chrome slots (SearchWidget, frontmatter
    // renderers, PresetGenerator, DocHistory, …) — see src/chrome-bindings.tsx.
    // Consumed by the self-contained doc-route stubs (pages/docs/[[...slug]].tsx
    // and its [locale]/v/** variants) via `virtual:zudo-doc-chrome-bindings`.
    chromeBindingsModule: "./src/chrome-bindings.tsx",

    // ── Shell passthrough fields (not part of `Settings`) ───────────────────
    // Pin the dev/preview port — zfb defaults to 3000, but CLAUDE.md, the
    // EADDRINUSE guidance, and the Tauri Mode-1 devUrl all assume 4321 (#2043).
    port: 4321,
    // Cloudflare adapter — required for routes with `prerender = false`
    // (currently pages/api/ai-chat.tsx). Bindings via wrangler.toml.
    adapter: "@takazudo/zfb-adapter-cloudflare",
    // Keep the md-plugins test fixtures and e2e fixtures out of the bundler's
    // shadow-tree walk. bundle.exclude (zfb next.22) is the intended escape
    // hatch; adopted with next.23 after the stale ambient-type fix (#1834).
    bundle: {
      exclude: ["packages/md-plugins/__fixtures__/**", "e2e/fixtures/**", "_temp-resource/**"],
    },
  }),
);
