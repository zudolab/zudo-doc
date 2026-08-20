# @takazudo/zudo-doc

Framework primitives that sit on top of zfb's engine — the framework layer that zfb deliberately doesn't ship (per ADR-003).

Release history is shipped as `CHANGELOG.md` in the npm package. The file is
generated from the repository's changelog MDX pages; edit those source pages
instead of editing the generated markdown directly.

This package provides the missing-by-design framework concerns:

- **Sidebar tree builder** (`./sidebar-tree`) — turns collection entries + `_category_.json` into breadcrumb/navigation nodes.
- **Theme controls** (`./theme`) — color scheme provider + design-token tweak panel (Preact island that wraps an iframe).
- **Theme toggle (bare)** (`./theme-toggle`) — the un-wrapped ThemeToggle component for call sites that compose their own `<Island>` (the `./theme` barrel exports an Island-wrapped variant of the same component).
- **TOC** (`./toc`) — desktop and mobile TOC Preact islands fed by MDX `headings` export.
- **Breadcrumb** (`./breadcrumb`) — JSX breadcrumb fed by the sidebar tree.
- **DocLayout** (`./doclayout`) — composable layout shell with explicit `<Header>`, `<Sidebar>`, `<Main>`, `<Toc>`, `<Footer>` props; ships a `<DocLayoutWithDefaults>` wrapper that holds the 16 `create-zudo-doc` injection anchors.
- **View Transitions** (`./transitions`) — native View Transitions API shim (Chrome/Edge/Safari 18+); persistent regions via `view-transition-name`. No-op fallback in Firefox.
- **Head injection** (`./head`) — canonical, og:\*, twitter:\*, robots, preload hints, RSS link, sitemap link, and theme-color output.
- **SSR-skip wrappers** (`./ssr-skip`) — `<AiChatModalIsland>`, `<ImageEnlargeIsland>`, `<DesignTokenTweakPanelIsland>`, `<MockInitIsland>` — wrap zfb's `<Island ssrFallback>` with the right fallback markup so doc pages don't have to re-implement the SSR-skip pattern.
- **Site schema** (`./site-schema`) — browser-safe nav tree / breadcrumb / pager domain, with zero zfb engine or filesystem coupling. See below.

## `./site-schema` — the browser-safe site-shape domain

Everything needed to answer "what is the shape of this documentation site?" — which routes exist, how they nest, what the previous/next page is, and what breadcrumb trail leads to a slug — without any of the rendering, disk access, or zfb engine coupling the rest of the package carries. A browser bundle, a Cloudflare Worker, or any non-zfb tool can compute the same answers the SSG build computes.

**What it exports.** The route-existence builder `createDocRouteEntries`; the nav-tree builder `buildNavTree`; the blessed breadcrumb builder `buildBreadcrumbs`; the pager resolver `resolveDocPrevNext`; tree-walking helpers (`findNode`, `firstRoutedHref`, `flattenTree`, `flattenSubtree`, `collectAutoIndexNodes`, `groupSatelliteNodes`, `isNavVisible`, `rewriteNavHref`, `remapNavChildHrefs`); the `headerNav` scoping helpers `getCategoryOrder` / `getNavSectionForSlug` / `getNavSubtree`; the underlying `buildSidebarTree` primitive; the TOC helper `extractHeadings`; and the `schemaVersion` contract constant. Every props/route type is generic over the entry shape (defaulting to a structural `DocEntryLike`) so the subpath never needs to import zfb's `CollectionEntry` — see `API.md` for the full function and type reference.

**Derivation contracts** — the rules a consumer relies on, not just the function names:

- **Route emission.** An entry with `category_no_page: true` carries category metadata only and emits NO route. Every category with children but no `index.mdx` emits one synthesized auto-index route.
- **The blessed breadcrumb rule.** `buildBreadcrumbs` is THE route-time slug-split walk that produces `props.breadcrumbs` — the same contract the SSG build uses. The presentation-layer `findPath` / `buildBreadcrumbItems` pair stays a component-side detail and is deliberately NOT exported; consumers reconstruct breadcrumbs through this function, not by re-walking the tree themselves.
- **Category-scoped prev/next.** `resolveDocPrevNext` resolves prev/next against the route's OWN flattened subtree, not the whole site — so a category's last page has no `next` (and its first page has no `prev`). Frontmatter `pagination_prev` / `pagination_next` overrides resolve against that same caller-supplied tree, never a foreign one.

**The `schemaVersion` fail-closed contract.** `schemaVersion` (currently `1`) is a contract-version constant, not a feature flag — check it before trusting the shape of anything else the subpath exports, and fail closed (refuse to render, or warn loudly) rather than silently mis-reading a shape change after a package upgrade. The pattern is deliberately the same one `@takazudo/zudo-doc/catalog` already established for its `ThemePacksIndexManifest.schemaVersion`.

**Browser-safety guarantees.** Nothing reachable from `./site-schema` — through the bundled JS graph OR the transitive `.d.ts` graph — may be a `node:*` builtin, `preact`, a `.css` file, a `virtual:` module, or an `@takazudo/zfb*` package. Three guards hold that line:

1. `src/__tests__/site-schema.test.ts` bundles the barrel with esbuild `platform: "neutral"` and walks the emitted declaration graph for the same violations.
2. `scripts/check-site-schema.mjs` repeats the bundle check against the built `dist/site-schema/index.js` in the `prepack` chain, so a publish cannot ship a graph the source-level guard would have rejected.
3. The `package.json#exports` keyset snapshot in `src/__tests__/public-api-snapshot.test.ts` pins the subpath's presence and shape.

**Consumer story.** Import `@takazudo/zudo-doc/site-schema` anywhere you need zudo-doc's site semantics without a zfb build behind you — an SPA shell rendering its own nav chrome, a Worker computing breadcrumbs for an API response, or a script that needs to know what page comes next:

```ts
import {
  schemaVersion,
  buildNavTree,
  buildBreadcrumbs,
  resolveDocPrevNext,
} from "@takazudo/zudo-doc/site-schema";

if (schemaVersion !== 1) {
  throw new Error(`Unsupported @takazudo/zudo-doc/site-schema version: ${schemaVersion}`);
}

const tree = buildNavTree(docs, "en", categoryMeta, buildHref);
const breadcrumbs = buildBreadcrumbs(tree, "guides/color", homeHref);
```

## Optional peer dependency: `@takazudo/zfb-md-wasm`

`./html-preview-wrapper`'s `<HighlightedCode>` lazily imports the package root and calls `highlightCode()` for client-side semantic syntax highlighting. `@takazudo/zfb-md-wasm` is declared as an **optional peerDependency** — install the same prerelease version as the rest of your zfb packages if you use that subpath:

```sh
pnpm add @takazudo/zfb-md-wasm
```

Projects scaffolded by `create-zudo-doc` already include it. If you never render `<HtmlPreview>` / `<HighlightedCode>`, you can omit it.

## Ejected header customization

`zudo-doc eject header` copies a complete frozen-script regeneration path into
`src/components/zudo-doc/header`. After changing the ejected `nav-active.ts` or
`nav-class-tokens.ts`, regenerate the local client controller and commit the
result:

```sh
node ./src/components/zudo-doc/header/gen-nav-overflow-script.mjs
```

The command uses the two local customization inputs plus the installed
package's current-path and page-event inputs. Its `esbuild` transformer is
provided by `@takazudo/zudo-doc`; no additional project dependency is needed.
The resulting `nav-overflow-generated-script.ts` stays frozen for stable CSP
hashes across consumer bundlers.

## ⚠️ HTML preview iframe sandbox — trust assumption

`<HtmlPreview>` / `<HtmlPreviewWrapper>` render their preview inside an `<iframe srcdoc>` whose `sandbox` attribute **defaults** to:

- `allow-scripts allow-same-origin` when the preview contains scripts (a `js` prop or a `<script>` in `head`), or
- `allow-same-origin` when it does not.

**`allow-scripts` + `allow-same-origin` together effectively void the sandbox** — scripts running inside the preview share the parent page's origin and can reach the parent document. This default is intentional and safe for zudo-doc's own use case, where preview content is **author-trusted** MDX. The `allow-same-origin` token is what lets the component auto-measure the iframe body and sync its height.

If your project renders **semi-trusted or user-submitted** HTML in a preview, override the sandbox with a stricter value via the `sandbox` prop:

```tsx
// Maximally restrictive — no script execution, opaque origin
<HtmlPreviewWrapper html={untrustedHtml} sandbox="" height={400} />

// Allow scripts but keep an opaque origin (script can't reach the parent)
<HtmlPreviewWrapper html={untrustedHtml} sandbox="allow-scripts" height={400} />
```

**Caveat:** removing `allow-same-origin` gives the iframe an opaque origin, which blocks the parent from reading `iframe.contentDocument`. That **disables auto-height** — always pair a stricter `sandbox` with a fixed `height`. Passing the empty string `""` is honored verbatim (only omitting the prop falls back to the computed default).

## Styling — Tailwind setup for consumers

This package ships **no precompiled CSS** — the component utility classes are inlined in the `dist/` JavaScript, and Tailwind v4 does not scan `node_modules`. Without help, those utilities never make it into your build, so the components render unstyled.

The fix is to import the package's build-generated safelist into your Tailwind CSS entry, right next to your `@import "tailwindcss";`:

```css
@import "tailwindcss";
@import "@takazudo/zudo-doc/safelist.css";
```

`dist/safelist.css` is generated at package build time and contains an `@source inline()` set covering every utility the components use (including arbitrary-value classes like `w-[var(--zd-sidebar-w)]`). It auto-syncs whenever you upgrade the package — no drift, no manual maintenance. Available in `@takazudo/zudo-doc` **>= 0.2.0**.

> **Don't `@source` into `node_modules`.** A glob like `@source "../node_modules/@takazudo/zudo-doc/dist/**"` looks plausible but is unreliable: pnpm surfaces packages via symlinks and Tailwind v4's file scanner does not reliably traverse them, so utilities get intermittently dropped across rebuilds (see zudolab/zudo-doc#1989). Import the package safelist instead.

**Migrating from a pre-0.2.0 workaround?** If you vendored or copied the package `dist/` to get its styles, delete that workaround and replace it with the single `@import "@takazudo/zudo-doc/safelist.css";` line above.

## Dev workflow (in this repo)

This package is published to npm as `@takazudo/zudo-doc` (since `0.2.0`, `latest` tracks the current line). Inside this repo the host site consumes it as a workspace package through its compiled `dist/` — `pnpm dev` at the repo root runs two watchers in parallel, `tsup --watch` for the JS and `tsc -p tsconfig.build.json --watch` for the `.d.ts`, so edits under `src/` rebuild both halves automatically; for a one-off rebuild use `pnpm --filter @takazudo/zudo-doc build`.

zfb itself comes from npm (versions pinned in the root `package.json`). To develop against a local zfb checkout, use the temporary `pnpm.overrides` link escape hatch documented in the root `CLAUDE.md` — do not commit the override.
