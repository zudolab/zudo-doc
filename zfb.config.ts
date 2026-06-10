/**
 * zfb pin (canonical, shared with E2/E4):
 *   commit: c93a7ec (main — Merge #288 islands env defines):
 *             - c93a7ec Merge #288 islands env defines
 *             - d438061 fix(zfb-islands): define
 *               `import.meta.env.{PROD,DEV}` in esbuild args
 *           Closes the latent hydration-crash path where an island
 *           dynamically imports a module that references
 *           `import.meta.env.DEV`. Before this fix the islands esbuild
 *           pipeline shipped that read verbatim into
 *           `assets/islands.js`, where `import.meta.env` is undefined
 *           at runtime and the first access would throw
 *           `TypeError: Cannot read properties of undefined`. The fix
 *           mirrors the `bundler.rs` PROD/DEV defines into
 *           `crates/zfb-islands/src/esbuild.rs`, so both pipelines
 *           fold the value at bundle time. Ancestor check confirmed
 *           195be73 is on origin/main, no carries lost.
 *           Previous pin 5e679d3 (post-#226 merge) — added `= {}` default
 *           to the destructured props parameter on
 *           packages/zfb-runtime/src/client-router.ts so calling
 *           ClientRouter() with no arguments no longer destructures
 *           undefined. The runtime impl now matches the documented
 *           optional-props contract (props?: ClientRouterProps) declared
 *           in this consumer's _zfb-runtime-shim.d.ts. Surfaced by W6A
 *           (zudolab/zudo-doc#1522) — the host-side mount in
 *           packages/zudo-doc/src/doclayout/doc-layout.tsx calls
 *           <ClientRouter /> with no args; without this fix it threw
 *           `TypeError: Cannot read properties of undefined (reading
 *           'fallback')` at SSR render time inside the embedded V8 host.
 *           W6A landed an in-host workaround `ClientRouter({})`; this pin
 *           bump enables that workaround to revert to the cleaner no-arg
 *           call (done atomically in the same commit as this pin bump).
 *           Bumped 2026-05-08 in W5A.5 mini follow-up (zudolab/zudo-doc#1522
 *           extended) under host epic zudolab/zudo-doc#1510.
 *           Previous pin 7e11ebd (W5A re-bump, post-#225 merge) — added
 *           globalThis stubs for browser Event/CustomEvent/EventTarget to
 *           the embedded V8 host's bootstrap_host_shim. Unblocked the
 *           just-shipped <ClientRouter /> surface whose events.ts declares
 *           three top-level `class X extends Event`. Also absorbed PR #224
 *           client-router/component (W4A) — Astro-style SPA soft-swap
 *           router ported into @takazudo/zfb-runtime. This consumer's
 *           integration switches from Strategy A (CSS @view-transition
 *           at-rule) to Strategy B (<ClientRouter /> mount) in W6A/W6B
 *           (zudolab/zudo-doc#1510).
 *   includes fixes (representative load-bearing entries retained; the full
 *   superseded migration-era PR list was trimmed in zudolab/zudo-doc#1867):
 *     - Takazudo/zudo-front-builder#151 / PR #152 (zfb-islands esbuild step now passes
 *                               --jsx=automatic --jsx-import-source=preact; fixes
 *                               ReferenceError: React is not defined at island mount when
 *                               host components use preact/compat for hooks; unblocks Sig G
 *                               hydration in zudolab/zudo-doc#1355)
 *     - Takazudo/zudo-front-builder wave13-css-path-probe (build_default_css_payload now probes
 *                               BOTH `<root>/styles/global.css` AND `<root>/src/styles/global.css`
 *                               for the Tailwind v4 input CSS, first match wins. Pre-fix the
 *                               probe hardcoded the legacy `<root>/styles/global.css` location and
 *                               missed the conventional Vite/Astro/Next-style `src/styles/` layout
 *                               this consumer uses, so the host's `:root` block defining
 *                               `--zd-sidebar-w` and the entire `@theme` semantic-token mapping
 *                               (`--color-bg → --zd-bg` and friends) never reached Tailwind's
 *                               entry CSS. Result: the dist CSS shipped only Tailwind v4 stock
 *                               palette plus generated arbitrary-value classes, and host-defined
 *                               custom properties resolved to defaults at runtime — directly
 *                               causing the wave 12 desktop-sidebar fallback width regression
 *                               that Wave 12 Topic A patched with an inline <style> in
 *                               doc-layout.tsx. With this pin the host's authored @theme block
 *                               flows through Tailwind as designed and the inline workaround
 *                               can be dropped — closes wave 13 topic 5 of zudolab/zudo-doc#1355)
 *     - Takazudo/zudo-front-builder bdbfbfb (fix(embedded-v8): add
 *                               node:async_hooks stub to v1 node:* list;
 *                               consumer bundles that import
 *                               @takazudo/zfb-adapter-cloudflare do a
 *                               top-level import of AsyncLocalStorage from
 *                               node:async_hooks — without this stub the
 *                               embedded V8 host fails at bundle-load time
 *                               with "no in-memory source for node:async_hooks")
 *   pinned by: epic zudolab/zudo-doc#1353 (super-epic #1333)
 *              → re-bumped at W4 retry: pin 9239267 picks up upstream PR #202
 *                (Takazudo/zudo-front-builder#202) — snapshot/bundler pipeline
 *                alignment fix discovered when W4A's bilingual fallback audit
 *                showed f68a9ba alone left 66 EN + 38 JA pages emitting
 *                <pre data-zfb-content-fallback> on content-heavy MDX. Three
 *                snapshot-side divergences (no reset_per_entry between files,
 *                hardcoded Pipeline::with_defaults ignoring code_highlight_theme
 *                / strip_md_ext / resolve_markdown_links, build.rs not threading
 *                config through to build_snapshot) caused the snapshot's
 *                content_hash to disagree with the bundler's bridge-map key
 *                so globalThis.__zfb.content.get(specifier) silently missed.
 *                After re-bump: 0 fallback markers on both EN and JA corpora.)
 *              → bumped to v0.1.0-next.19 (zudolab/zudo-doc#1824):
 *                The next.18 markdown-overrides epic hard-removed the
 *                built-in `imageEnlarge` markdown feature
 *                (`markdown.features.imageEnlarge: true` is now an unknown
 *                key that fails the Rust config loader). The feature is
 *                re-implemented in userland via an MDX paragraph (`p`)
 *                component override in `pages/_mdx-components.ts` which
 *                emits `<figure class="zd-enlargeable">` + enlarge button
 *                for block-level images. The `imageEnlarge: true` line is
 *                deleted from this file in the same commit. The pin is
 *                next.19 (not next.18): next.19 carries next.18's removal
 *                PLUS the islands esbuild `react/jsx-runtime`→preact alias
 *                fix (Takazudo/zudo-front-builder#633) that next.18 lacked —
 *                without it the islands bundle fails with
 *                "Could not resolve react/jsx-runtime".
 *              → bumped to v0.1.0-next.23 (zudolab/zudo-doc#1834): this bump
 *                ALSO adopts `bundle.exclude` (added engine-side in next.22)
 *                to drop the md-plugins `__fixtures__` from the bundler walk,
 *                silencing ~15 pre-existing `broken markdown link` warnings.
 *                Adoption was blocked at next.22 by a stale consumer-side
 *                `zfb/config` ambient type missing the `bundle` field — NOT a
 *                zfb-check bug (Takazudo/zudo-front-builder#678; root-caused by
 *                the maintainer to the consumer's own ambient shim). Fixed by
 *                adding `BundleConfig` + `bundle?` to `zfb-shim.d.ts` in this
 *                same change. next.23 also ships `bundle.mainFields` /
 *                `bundle.external` (#676), declared in the shim for parity but
 *                unused here. See the `bundle:` field below.
 */

/**
 * zdtp dependency (npm).
 *
 * The Design Token Panel ships as the published npm package `@takazudo/zdtp`
 * (renamed from `@takazudo/zudo-design-token-panel`; same API). It is no longer
 * consumed from a sibling `file:../zdtp` checkout, so there is no SHA to pin and
 * no per-CI `ZDTP_PINNED_SHA` to keep in lockstep — the version field in
 * package.json is the single source of truth. Bump it there to upgrade.
 *
 * To develop against a local zdtp checkout, add a temporary
 * `pnpm.overrides` entry in package.json (e.g.
 * `"@takazudo/zdtp": "link:../zdtp/packages/zdtp"`), `pnpm install`, then
 * remove the override when done.
 */

// zfb.config.ts — entry-point config consumed by the zfb engine.
//
// This file replaces the Astro-flavoured `src/content.config.ts` while the
// migration is in progress. Both files coexist until every content site,
// integration, and page in this repo has been ported over to zfb. Once the
// switch-over is complete, `src/content.config.ts` is removed in a later
// topic.
//
// Authoring conventions inherited from `src/content.config.ts`:
//
// - Schemas live as vanilla zod definitions so we keep the type-inference
//   ergonomics editors expect. The schemas are converted to JSON Schema via
//   `z.toJSONSchema()` at the boundary because zfb's `CollectionDef.schema`
//   takes a JSON-Schema-shaped object (mirrored one-for-one in the Rust
//   `Config` struct — see `crates/zfb/src/config.rs` in the zfb repo).
// - Collection paths derive from `src/config/settings.ts` so per-locale and
//   per-version directories stay a single source of truth.
// - The `plugins` array starts empty here. Sibling integration topics
//   (doc-history, search, llms-txt, sitemap, claude-resources, …) each add
//   one entry under their own import line so this file stays additive on
//   merge.
//
// Typed schema reflection: zfb's content engine emits `.zfb/types.d.ts`
// from the per-collection schemas (see `emit_types_dts_with_schemas` in
// `crates/zfb-content/src/collection.rs`). Once zfb is wired in, that file
// is the source of truth for `getCollection("docs")[0].data.sidebar_position`
// being typed `number | undefined` rather than `unknown`.

import { z } from "zod";
import { defineConfig } from "zfb/config";
import { settings } from "./src/config/settings";
import { buildDocsSchema } from "./src/config/docs-schema";

// ---------------------------------------------------------------------------
// Schema definitions (single source of truth: src/config/docs-schema.ts).
// ---------------------------------------------------------------------------

/**
 * Single zod schema reused for every docs collection (default + per-locale
 * + per-version + per-version-per-locale). Defined in `src/config/docs-schema.ts`
 * so that `pages/_data.ts` and `src/types/docs-entry.ts` can import the
 * inferred `DocsData` type instead of maintaining hand-mirrored field lists.
 */
const docsSchema = buildDocsSchema();

// `z.toJSONSchema` is a runtime call but the result is a stable JSON
// document. We compute it once and reuse the same object across every
// collection definition.
const docsSchemaJson = z.toJSONSchema(docsSchema) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Collection list — derived from settings.
// ---------------------------------------------------------------------------

interface CollectionEntryShape {
  name: string;
  path: string;
  schema: Record<string, unknown>;
}

const collections: CollectionEntryShape[] = [];

// Default English collection.
collections.push({ name: "docs", path: settings.docsDir, schema: docsSchemaJson });

// Per-locale collections (e.g. `docs-ja`).
for (const [code, config] of Object.entries(settings.locales)) {
  collections.push({ name: `docs-${code}`, path: config.dir, schema: docsSchemaJson });
}

// Per-version collections (and their locale variants), if configured.
if (settings.versions) {
  for (const version of settings.versions) {
    collections.push({
      name: `docs-v-${version.slug}`,
      path: version.docsDir,
      schema: docsSchemaJson,
    });
    if (version.locales) {
      for (const [code, config] of Object.entries(version.locales)) {
        collections.push({
          name: `docs-v-${version.slug}-${code}`,
          path: config.dir,
          schema: docsSchemaJson,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Default export — the zfb config object.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MDX content pipeline — driven by zfb's Rust port, NOT JS plugins.
// ---------------------------------------------------------------------------
//
// Background: this project's `packages/md-plugins/src/` ships a JS-side
// `remarkAdmonitions` + `remarkResolveMarkdownLinks` + `rehypeStripMdExtension`
// (legacy Astro-era pipeline). The current zfb pin (`9239267`, post-#202
// fix) has Rust ports of all three plus four more (`HeadingLinks`,
// `CodeTitle`, `ImageEnlarge`, `Mermaid`, `Syntect`, `CjkFriendlyPlugin`)
// in `crates/zfb-content/src/plugins/`, all wired automatically via
// `Pipeline::with_defaults()` at every MDX pre-compile call site
// (`crates/zfb-build/src/bundler.rs:785, 1015`,
// `crates/zfb-content/src/content_bridge.rs:183`). PR zfb#118
// (mdast phase) + zfb#121 (hast phase) + zfb#126/#128/#131 (bundler
// threading) closed the wiring chain.
//
// What this means for `zfb.config.ts`:
//
//   - There is NO slot for user-supplied remark/rehype plugin entries
//     in `defineConfig({...})`. The `plugins` array below targets the
//     plugin LIFECYCLE (preBuild/postBuild/devMiddleware), not the MDX
//     content pipeline. The Rust pipeline is opinionated and runs the
//     full default chain on every `.mdx` file the bundler walks.
//   - `stripMdExt: true` (set below) is the one MDX-pipeline knob the
//     zfb config exposes. It opt-in adds `StripMdExtensionPlugin` to
//     the hoisted `Pipeline::with_defaults()` (zfb#131). Done.
//
// Partial status of Takazudo/zudo-front-builder#185 at f68a9ba:
//
//   - `ResolveLinksPlugin` is now wired via a22eb71 (resolveMarkdownLinks
//     config field) — Gap 1 of zfb#185 is closed. Host-side adoption is
//     deferred — the current corpus uses `stripMdExt: true` alone and all
//     corpus links resolve correctly.
//   - The Rust `AdmonitionsPlugin`'s directive parser still requires
//     CommonMark blank-line paragraphs around `:::name` / `:::` (empirically
//     confirmed at f68a9ba — W1B category 3 FAIL). Commit c644eb7 adds a
//     build-time diagnostic for the no-blank-line form but did NOT relax the
//     parser. The 6 corpus files reformatted by W3B retain blank-line shape
//     permanently.
//
// Broken-link warnings are produced today by `pnpm check:links`
// (`scripts/check-links.js`) running against built `dist/` HTML — a
// post-build scanner that does not depend on the MDX-pipeline plugin
// contract. zfb#185 is partially resolved at f68a9ba: Gap 1
// (ResolveLinksPlugin config exposure) closed by a22eb71; Gap 2
// (blank-line parser requirement) has a diagnostic added by c644eb7
// but is not relaxed.

// ---------------------------------------------------------------------------
// Plugins — wired through zfb's plugin lifecycle (issue #101).
// ---------------------------------------------------------------------------
//
// zfb's plugin runtime loads each entry's `name` as a module specifier
// (npm bare or `./`-relative path) and dispatches lifecycle hooks
// (`preBuild`, `postBuild`, `devMiddleware`) on the module's default
// export. Inline function hooks on this config are NOT supported — the
// config goes through a JSON round-trip to the Rust side and any
// function value would be silently dropped (see `@takazudo/zfb/plugins`
// source comment for the rationale). Each entry below therefore
// references a small wrapper module under `./plugins/` whose default
// export is a `ZfbPlugin`.
//
// All three lifecycle hooks are now wired via the wrapper modules:
//
//   preBuild    — claude-resources writes its pre-step output;
//                 doc-history writes `.zfb/doc-history-meta.json`.
//   postBuild   — doc-history / search-index / llms-txt emit their
//                 dist-time artifacts.
//   devMiddleware — doc-history / search-index / llms-txt register
//                 Connect-style middleware via the shared
//                 `plugins/connect-adapter.mjs` so the dev sidecar
//                 (`scripts/dev-sidecar.mjs`) can be retired.
//
// The legacy npm-script glue (`scripts/zfb-{pre,post}build.mjs`,
// `scripts/dev-sidecar.mjs`) stays in place during the merge window;
// T6 retires it once all lifecycle epics land.
//
// Sitemap is NOT in this list — it is served as a `pages/sitemap.xml.tsx`
// zfb route (per ADR-005's "non-HTML page" pattern) introduced in epic E8.

const localeArray = Object.entries(settings.locales).map(([code, locale]) => ({
  code,
  dir: locale.dir,
}));
const localeRecord = Object.fromEntries(
  Object.entries(settings.locales).map(([code, locale]) => [code, { dir: locale.dir }]),
);

const integrationPlugins = [
  ...(settings.claudeResources
    ? [
        {
          name: "./plugins/claude-resources-plugin.mjs",
          options: {
            claudeDir: settings.claudeResources.claudeDir,
            projectRoot: settings.claudeResources.projectRoot,
            docsDir: settings.docsDir,
          },
        },
      ]
    : []),
  ...(settings.docHistory
    ? [
        {
          name: "./plugins/doc-history-plugin.mjs",
          options: {
            docsDir: settings.docsDir,
            locales: localeRecord,
            base: settings.base,
          },
        },
      ]
    : []),
  {
    name: "./plugins/search-index-plugin.mjs",
    options: {
      docsDir: settings.docsDir,
      locales: localeRecord,
      base: settings.base,
    },
  },
  ...(settings.llmsTxt
    ? [
        {
          name: "./plugins/llms-txt-plugin.mjs",
          options: {
            siteName: settings.siteName,
            siteDescription: settings.siteDescription,
            base: settings.base,
            siteUrl: settings.siteUrl,
            defaultLocaleDir: settings.docsDir,
            locales: localeArray,
          },
        },
      ]
    : []),
  // Upstream zfb #192 (a6abbc3, f68a9ba) ships native copy_public_dir — but its output goes
  // to dist/<base-segment>/ (e.g. dist/my-docs/img/logo.svg) when base is non-root. Under the
  // Workers static assets deploy (base="/") dist/ is served at root directly, but the host
  // plugin is still needed because copy_public_dir is not yet exercised for root-base configs.
  // Keep the host plugin until the native copy_public_dir is validated for base="/".
  // CI gate: main-deploy.yml asserts HTTP 200 for $DEPLOY_URL/img/logo.svg.
  {
    name: "./plugins/copy-public-plugin.mjs",
    options: {
      publicDir: "public",
    },
  },
];

// Upstream gaps #187 (walk-order) and #188 (syntect theme) resolved in f68a9ba (635a8e3, 339e30f).

export default defineConfig({
  framework: "preact",
  tailwind: { enabled: true },
  collections,
  // Keep the md-plugins test fixtures out of the bundler's shadow-tree
  // walk. Those `__fixtures__/*.mdx` files are exact-match snapshot inputs
  // (paired with `expected-html/`), not site content — but the bundler
  // would otherwise run the Rust MDX link resolver over them and emit ~15
  // `broken markdown link` warnings on every build/CI run. `bundle.exclude`
  // (zfb next.22, #664) is the intended escape hatch. Adopting it was
  // blocked until next.23 by a stale consumer-side `zfb/config` ambient
  // type that lacked `bundle` (zudolab/zudo-doc#1834 /
  // Takazudo/zudo-front-builder#678 — now fixed in zfb-shim.d.ts).
  bundle: { exclude: ["packages/md-plugins/__fixtures__/**"] },
  // Strip `.md` / `.mdx` from in-page `<a href>` and append a trailing
  // slash so author-written `[label](./other.mdx)` references resolve
  // to the rendered route URL. Mirrors `rehypeStripMdExtension` from
  // packages/md-plugins. Without this, dist HTML carries unrouted
  // `href="./other.mdx"` links — the deep-review #1338 finding 12
  // verification surfaced this on roughly two dozen pages.
  stripMdExt: true,
  // Resolve relative `[label](./other.mdx)` links to absolute resolved
  // route URLs at the mdast phase (e.g. `/docs/.../other/`)
  // before the file→directory transformation makes the relative path
  // ambiguous. The legacy `stripMdExt: true` alone produced relative
  // hrefs that broke when `foo.mdx` became `foo/index.html` — every
  // sibling link gained one nesting level of drift. Multi-dir shape
  // (sub #234 in the pinned zfb branch) maps each source dir to its
  // own route prefix so JA mirrors resolve under `/ja/docs/` instead
  // of `/docs/`. Closes zudolab/zudo-doc#1577 (109 broken links).
  resolveMarkdownLinks: {
    enabled: true,
    dirs: [
      { dir: settings.docsDir, routePrefix: "/docs/" },
      ...Object.entries(settings.locales).map(([code, locale]) => ({
        dir: locale.dir,
        routePrefix: `/${code}/docs/`,
      })),
      // Versioned collections: each version's EN dir + per-locale dirs.
      ...(settings.versions
        ? settings.versions.flatMap((version) => [
            { dir: version.docsDir, routePrefix: `/v/${version.slug}/docs/` },
            ...Object.entries(version.locales ?? {}).map(([code, locale]) => ({
              dir: locale.dir,
              routePrefix: `/v/${version.slug}/${code}/docs/`,
            })),
          ])
        : []),
    ],
    onBrokenLinks: "warn",
  },
  // Public URL prefix for `<link rel="stylesheet">` and `<script
  // type="module">` tags emitted into dist HTML. Currently "/" (root)
  // for the Workers static assets deploy at zudo-doc.takazudomodular.com.
  // Historically "/pj/zudo-doc/" under Cloudflare Pages advanced mode
  // (closed BLOCKER #1361 of feature-audit epic #1360). The same value
  // drives the search-index / llms-txt plugins below.
  base: settings.base,
  // Mirror `settings.trailingSlash` so the basePath rewriter appends
  // `/` to extensionless absolute hrefs (`/docs/getting-started`
  // becomes `/docs/getting-started/`). Without this, dist HTML ships
  // the non-canonical shape and Cloudflare 301-redirects every click —
  // a hop on every navigation and address-bar flicker.
  // Closes zudolab/zudo-doc#1579 (54 missing-trailing-slash entries).
  trailingSlash: settings.trailingSlash,
  // zfb next.13 moved three pipeline features from always-on (Core) to
  // opt-in (directives, mermaid, headingMarkerToc) and ships the
  // rest as opt-in. This block re-enables the former-Core three so the
  // existing corpus still renders, plus the remaining opt-in features
  // (#1804) so the showcase exercises the full zfb markdown pipeline.
  //
  // imageEnlarge was a fourth former-Core feature re-enabled at next.13,
  // but next.18 hard-removed it from the Rust config schema. It is now
  // re-implemented in userland via an MDX p-override in
  // pages/_mdx-components.ts (#1824).
  //
  // ruby and tocExport were disabled at next.13 (they 500'd / broke the build).
  // Both are fixed in zfb 0.1.0-next.14 and re-enabled below (#1817 closes
  // #1815 ruby + #1814 tocExport). transclude remains disabled (no renderer yet).
  //
  // Value-shape note (verified empirically against the next.13 Rust loader):
  // the object-typed features (githubAutolinks, codeEnrichment, tocExport,
  // imageDimensions, transclude, linkValidation) REJECT the `true` shorthand
  // and must be given an options object (`{}` or fields). The misleading
  // "expected struct PluginConfig" error is what surfaces when one is `true`.
  // The boolean-shorthand features (githubAlerts, readingTime, ruby,
  // mermaid, headingMarkerToc) accept `true`. `directives` is a recipe map
  // (next.25+): keys are directive names, values are the JSX component names
  // they resolve to (registered in pages/_mdx-components.ts).
  markdown: {
    features: {
      // Former-Core (restored in #1803). next.25 replaced `admonitionsPreset`
      // with the generic `directives` map (#1840) — hard-errors if the old key
      // is still present.
      directives: {
        note: "Note",
        tip: "Tip",
        info: "Info",
        warning: "Warning",
        danger: "Danger",
        caution: "Caution",
        details: "Details", // routes to DetailsWrapper — a collapsible, NOT an admonition
      },
      mermaid: true,
      // imageEnlarge removed from zfb at next.18 — re-implemented in userland
      // via MDX p-override in pages/_mdx-components.ts (#1824).
      headingMarkerToc: true,
      // Remaining opt-in features (#1804).
      githubAlerts: true,
      readingTime: true,
      // owner/repo used to build `owner/repo#123`, `#123`, and SHA autolinks.
      githubAutolinks: { repo: "zudolab/zudo-doc" },
      codeEnrichment: {},
      // codeTabs (#1805, Option A): zfb's directive groups consecutive fenced
      // code blocks and emits a `<CodeGroup tabs={[...]}>` JSX element the
      // framework does NOT ship — S5 (#1807) registers <CodeGroup> in
      // pages/_mdx-components.ts (reusing the Tabs/TabItem UI). FeatureToggle
      // accepts the `true` shorthand (boolean-OR-object per the S2 contract).
      codeTabs: true,
      // ruby (#1815): the `{base}^{ruby}` caret syntax 500'd the SSR render at
      // zfb next.13 (the error was inside zfb's Rust ruby pass, NOT a missing
      // component — a registered stub could not fix it). Fixed in zfb
      // 0.1.0-next.14 (upstream Takazudo/zudo-front-builder#600); re-enabled
      // here (#1817). Renders native `<ruby><rb>…</rb><rt>…</rt></ruby>` markup.
      ruby: true,
      // tocExport (#1814): at next.13 this injected an indented
      // `export const toc = [{"depth":2,…}]` line that MDX parsed as content,
      // breaking the build with ~153 esbuild "Expected }" errors across both
      // locales. Fixed in next.14 (upstream #599 — the export is now hoisted to
      // column 0); re-enabled here (#1817). Object-typed feature — pass `{}`
      // (the `true` shorthand is rejected by the Rust loader, per the note above).
      tocExport: {},
      imageDimensions: {},
      // transclude disabled (#1805) — directive form `:::include{file="..."}`
      // 500s SSR (no registered <include> component) and the `![[...]]`
      // wikilink form is a no-op at zfb next.13; re-enable when a transclude
      // renderer is wired. See the S2 emitted-DOM contract (#1802).
      // warn-only: failOnBroken=false never fails the build. On this corpus
      // it emits no output beyond the existing resolveMarkdownLinks "warn"
      // (broken file links surface there; intra-page anchors are unchecked).
      linkValidation: { failOnBroken: false },
      // Hierarchical (ancestor-prefixed) heading IDs (upstream zfb#871;
      // original finding #1938). `## Foo` / `### Moo` / `#### Mew` render as
      // `id="foo"` / `id="foo-moo"` / `id="foo-moo-mew"` instead of the flat
      // `foo`/`moo`/`mew`. The host TOC builder (`pages/lib/_extract-headings.ts`)
      // mirrors this scheme so TOC anchors match the rendered IDs. The strategy
      // is a single source of truth in `settings.headingIdStrategy` (read by
      // both this config and the TOC builder). Anchor-breaking for existing
      // deep links to nested headings — accepted (no backward-compat) per #1939.
      headingIds: { strategy: settings.headingIdStrategy },
    },
  },
  // ----------------------------------------------------------------------
  // Cloudflare adapter — wraps the SSR bundle into `dist/_worker.js`
  // (the explicit main entry for Workers static assets) plus a sidecar
  // `dist/_zfb_inner.mjs`. The adapter is a hard requirement for any
  // route exporting `prerender = false` (currently `pages/api/ai-chat.tsx`);
  // without it `zfb build` rejects those routes at build time. Bindings
  // (ANTHROPIC_API_KEY, DOCS_SITE_URL, RATE_LIMIT KV,
  // RATE_LIMIT_PER_MINUTE, RATE_LIMIT_PER_DAY) are wired via wrangler.toml
  // and reach user code via `getCloudflareContext()` from the same package.
  // ----------------------------------------------------------------------
  adapter: "@takazudo/zfb-adapter-cloudflare",
  plugins: integrationPlugins,
});
