# @takazudo/zudo-doc — 2.0 Public API Contract

This document enumerates the **stable surface** of `@takazudo/zudo-doc`.

> **BREAKING — MAJOR version bump (B4PUSH wave #2431):** The Collapse Wiring
> Shells epic (#2420) introduced two breaking changes that require a MAJOR version
> bump:
>
> 1. Every public page-chrome factory (`createX`) now takes the unified
>    `ChromeContext` (from `./factory-context`) instead of a per-factory narrow
>    context. Sole consumer is the host's wiring shell; downstream projects that
>    only import UI components or the preset are unaffected.
> 2. Two new public subpaths (`./route-context`, `./chrome`) are added to the
>    stable surface.
>
> **Do NOT publish here** — version bumping and publishing are handled in the
> B4PUSH wave (#2431). Run `/l-make-release` there.

Decision: **freeze** the current surface — do not restructure or curate exports before publishing.
Post-merge in B4PUSH wave (#2431), run `/l-make-release` to publish the lockstep MAJOR release across the workspace.

## Drift Guards (authoritative)

Several parts of this surface are already protected by existing tooling — do NOT add duplicate guards:

- **`@theme` design tokens** — `pnpm check:token-lint` (`design-token-lint`) is the authoritative guard.
- **Z-index tokens** — `pnpm check:z-index` (`gen-z-index --check`) is the authoritative guard.
- **`doclayout` slot anchors** — parity between `packages/zudo-doc/src/doclayout/anchors.ts` and the scaffolded doc-layout is enforced by `pnpm check:template-drift`.

New snapshot guards (added in `packages/zudo-doc/src/__tests__/public-api-snapshot.test.ts` and `packages/zudo-doc/src/__tests__/ejectable-snapshot.test.ts`) cover the previously-unguarded surfaces: the `package.json#exports` keyset, the `PresetSettings`/`Settings` field set, and the ejectable-component list.

---

## 1. Subpath Exports (125 total)

The full `package.json#exports` keyset is the contract. Any addition or removal requires a deliberate, reviewed change that will fail the snapshot guard.

### Core

| Subpath | Description |
|---|---|
| `.` | Root re-exports barrel |
| `./preset` | `zudoDocPreset()` — zfb config preset factory |
| `./settings` | `Settings` / `PresetSettings` type definitions |
| `./factory-context` | `FactoryContext` / `ChromeContext` / `RouteContext` / `ChromeHostBindings` — the full shared type surface for package factories and chrome wiring (types only, node-free) |
| `./route-context` | `createRouteContext(payload, options?)` — reconstructs the full `RouteContext` callable surface from the serializable `RouteContextPayload`; also re-exports `RouteContext` / `RouteContextPayload` / `TagInfo` / `ContentBridge` types |
| `./chrome` | `createChrome(context, hostBindings?)` — assembles a `ChromeContext` from a `RouteContext` + `ChromeHostBindings` (stub defaults) and wires all page-chrome factories; returns the `Chrome` surface |
| `./eject` | `EJECTABLE` map + `eject()` function + `ZudoDocJson` type — ejectable component registry for the `zudo-doc eject` CLI |
| `./component-tokens` | `COMPONENT_TOKENS` const + `ComponentToken` / `ComponentTokenCategory` / `ComponentTokenName` types — the `--zdc-*` component-level CSS custom property registry. Consumers read this to discover every rebrand knob; redefine the listed `cssVar`s in `:root` to override defaults. **Snapshot-guarded** (`component-tokens-snapshot.test.ts`). |

### UI Components

| Subpath | Description |
|---|---|
| `./header` | Header component |
| `./footer` | Footer component |
| `./sidebar` | Sidebar component |
| `./sidebar/types` | Sidebar type definitions |
| `./sidebar-tree` | Sidebar tree component |
| `./sidebar-tree-island` | Sidebar tree client island |
| `./sidebar-toggle-island` | Sidebar toggle client island |
| `./desktop-sidebar-toggle-island` | Desktop sidebar toggle client island |
| `./sidebar-resizer` | Sidebar resizer component |
| `./sidebar-prepaint` | Sidebar prepaint (flash-of-wrong-state prevention) |
| `./sidebar-utils` | Sidebar utility helpers |
| `./sidebar-with-defaults` | Sidebar with preset defaults wired |
| `./toc` | Table of contents component |
| `./breadcrumb` | Breadcrumb component |
| `./theme` | Theme components |
| `./theme/color-scheme-provider` | Color scheme provider component |
| `./theme-toggle` | Theme toggle component |
| `./head` | `<head>` component |
| `./head-with-defaults` | `<head>` with preset defaults |
| `./header-with-defaults` | Header with preset defaults |
| `./footer-with-defaults` | Footer with preset defaults |
| `./page-loading` | Page-loading overlay component |
| `./tab-item` | Tab item component |
| `./code-syntax` | Code syntax highlighting component |
| `./code-group` | Code group (tabbed code blocks) component |
| `./content-admonition` | Admonition (note/warning/tip) component |
| `./math-block` | Math block (KaTeX) component |
| `./details` | `<details>` content override component |
| `./icons` | Icon components |
| `./i18n-version` | i18n version switcher component |
| `./body-foot-util` | Body footer utility area |
| `./transitions` | View transitions support |
| `./image-enlarge` | Image enlarge island |
| `./mermaid-enlarge` | Mermaid enlarge island |
| `./ai-chat-modal` | AI chat modal island |
| `./doc-history` | Doc history island |
| `./site-tree-nav-island` | Site tree nav client island |
| `./search-widget` | Search widget component |
| `./search-widget-script` | Search widget client script |
| `./inline-version-switcher` | Inline version switcher component |
| `./versions-page` | Versions listing page component |
| `./tag-pages` | Tag index/detail page components |
| `./category-nav` | Category navigation component |
| `./category-tree-nav` | Category tree navigation component |
| `./site-tree-nav` | Site tree navigation component |
| `./html-preview-wrapper` | HTML preview wrapper component |
| `./design-token-panel-bootstrap` | Design token panel bootstrap wiring |

### Doc Page Assembly

| Subpath | Description |
|---|---|
| `./doc-page-shell` | Full doc page shell component |
| `./doc-page-renderer` | Doc page renderer factory |
| `./doc-page-props` | Doc page props types |
| `./doc-content-header` | Doc content header (title area) |
| `./doc-body-end` | Doc body end area |
| `./doc-body-end-islands` | Package-default body-end islands factory (package-owned routes) |
| `./doc-metainfo-area` | Doc metadata area (dates, author) |
| `./doc-history-area` | Doc history dropdown area |
| `./doc-tags-area` | Doc tags area |
| `./doc-pager` | Prev/next doc pager |
| `./doclayout` | Doc layout shell + slot anchors |

### Navigation & Routing

| Subpath | Description |
|---|---|
| `./nav-indexing` | Navigation indexing utilities |
| `./nav-indexing/types` | Navigation indexing type definitions |
| `./nav-scope` | Navigation scope context |
| `./nav-data-prep` | Navigation data preparation |
| `./nav-source-cache` | Navigation source cache |
| `./nav-source-docs` | Navigation source for docs collections |
| `./doc-route-paths` | Doc route path builders |
| `./doc-route-entries` | Doc route entry generators |
| `./route-enumerators` | Route enumeration utilities |
| `./locale-merge` | Locale-aware content merging |
| `./tree-nav-shared` | Shared tree navigation primitives |

### Package-Owned Routes (A2)

| Subpath | Description |
|---|---|
| `./routes/index` | Root index route |
| `./routes/404` | 404 route |
| `./routes/sitemap.xml` | Sitemap XML route |
| `./routes/robots.txt` | Robots.txt route |
| `./routes/docs-slug` | Docs slug route |
| `./routes/docs-versions` | Docs versions route |
| `./routes/docs-tags-index` | Docs tags index route |
| `./routes/docs-tags-tag` | Docs tags tag detail route |
| `./routes/api-ai-chat` | AI chat API route |
| `./routes/locale-index` | Locale index route |
| `./routes/locale-docs-slug` | Locale docs slug route |
| `./routes/locale-docs-versions` | Locale docs versions route |
| `./routes/locale-docs-tags-index` | Locale docs tags index route |
| `./routes/locale-docs-tags-tag` | Locale docs tags tag detail route |
| `./routes/v-docs-slug` | Versioned docs slug route |
| `./routes/v-locale-docs-slug` | Versioned locale docs slug route |

### Plugins (zfb integration plugins)

| Subpath | Description |
|---|---|
| `./plugins/doc-history` | Doc history zfb plugin |
| `./plugins/llms-txt` | llms.txt generation zfb plugin |
| `./plugins/search-index` | Search index zfb plugin |
| `./plugins/claude-resources` | Claude resources generation zfb plugin |
| `./plugins/routes` | Package-owned route injection zfb plugin |

### Integrations (legacy wrappers, still shipped)

| Subpath | Description |
|---|---|
| `./integrations/doc-history` | Legacy integration re-export |
| `./integrations/llms-txt` | Legacy integration re-export |
| `./integrations/search-index` | Legacy integration re-export |
| `./integrations/claude-resources` | Legacy integration re-export |

### Utilities

| Subpath | Description |
|---|---|
| `./content` | MDX content rendering utilities |
| `./mdx-components` | MDX component map |
| `./metainfo` | Page metainfo utilities |
| `./url-normalizer` | URL normalization utilities |
| `./url-helpers` | URL building helpers |
| `./color-scheme-utils` | Color scheme utilities |
| `./render-markdown` | Safe markdown→HTML renderer |
| `./slug` | Canonical slug utilities |
| `./smart-break` | Smart line break utilities |
| `./use-modal-dialog` | Shared modal dialog hook |
| `./island-types` | Shared island prop types |
| `./robots` | Robots.txt generation utilities |
| `./tags-audit` | Tag audit utilities |
| `./tag-helpers` | Tag helper functions |
| `./github-helpers` | GitHub autolink helpers |
| `./compose-meta-title` | Meta title composition utilities |
| `./frontmatter-preview-data` | Frontmatter preview data extraction |
| `./extract-headings` | Heading extraction utilities |

### CSS Artifacts

| Subpath | Description |
|---|---|
| `./content.css` | `.zd-content` typography stylesheet (single source of truth) |
| `./safelist.css` | Generated Tailwind safelist for component classes |
| `./safelist` | Alias for `./safelist.css` |
| `./page-loading.css` | Page-loading overlay stylesheet |
| `./features.css` | Feature CSS (code blocks, dual-theme, KaTeX, etc.) |

---

## 2. `zudoDocPreset()` — Preset Options

Exported from `./preset`. Consumer projects call `zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary })` and spread the result into `defineConfig(...)`.

`PresetSettings` is the full `Settings` interface (they are the same type). The `settings` object must conform to `Settings` from `./settings`.

### `Settings` — All Public Fields

These fields are the stable contract. The snapshot guard locks this set.

| Field | Type | Description |
|---|---|---|
| `colorScheme` | `string` | Color scheme identifier (references a scheme in the project's color-schemes config) |
| `colorMode` | `ColorModeConfig \| false` | Light/dark mode config, or `false` to disable |
| `siteName` | `string` | Site name used in `<title>` and OG tags |
| `siteDescription` | `string` | Default site description |
| `base` | `string` | Base URL path prefix |
| `trailingSlash` | `boolean` | Whether to add trailing slashes to URLs |
| `docsDir` | `string` | Path to English docs content directory |
| `defaultLocale` | `string` | Default locale code (e.g. `"en"`) |
| `locales` | `Record<string, LocaleConfig>` | Locale configuration map |
| `mermaid` | `boolean` | Enable Mermaid diagram rendering |
| `noindex` | `boolean` | Set `noindex` on all pages |
| `editUrl` | `string \| false` | Base URL for "Edit this page" links |
| `githubUrl` | `string \| false` | GitHub repo URL for the GitHub link |
| `githubAutolinksRepo?` | `string` | `"owner/repo"` for `#123` / SHA autolinks |
| `siteUrl` | `string` | Canonical site URL (for sitemap, OG) |
| `metaTags` | `MetaTagsConfig` | `<meta>` tag configuration |
| `head?` | `SiteHeadConfig` | Site-wide `<head>` extras injected into every page. Supports `preconnect`, `preload`, `stylesheets`, `alternateLinks`, and `meta` descriptors. Stylesheet entries accept `async: true` for non-render-blocking loading via the `media="print" + onload` pattern with a `<noscript>` fallback. Absent (the default) emits nothing — byte-identical to the pre-2.0.1 baseline. |
| `sitemap` | `boolean` | Enable sitemap generation |
| `docMetainfo` | `boolean` | Enable doc metadata area (Created/Updated/Author) |
| `docTags` | `boolean` | Enable doc tags display |
| `tagPlacement` | `TagPlacement` | Tag display position: `"after-title"` or `"before-pager"` |
| `tagGovernance` | `TagGovernanceMode` | Tag vocabulary enforcement: `"off"`, `"warn"`, or `"strict"` |
| `tagVocabulary` | `boolean` | Enable tag vocabulary |
| `llmsTxt` | `boolean` | Enable llms.txt generation |
| `math` | `boolean` | Enable KaTeX math rendering |
| `cjkFriendly` | `boolean` | Enable CJK-friendly typography |
| `onBrokenMarkdownLinks` | `"warn" \| "error" \| "ignore"` | Broken markdown link behavior |
| `aiAssistant` | `boolean` | Enable AI chat assistant |
| `aiChatDemoMode` | `boolean` | Enable AI chat demo mode (no real API calls) |
| `aiChatAllowedOrigins` | `string[]` | Allowed origins for AI chat CORS |
| `aiChatGlobalDailyLimit` | `number \| false` | Daily request limit for AI chat |
| `designTokenPanel` | `boolean` | Enable the design token panel |
| `tocMinDepth` | `number` | Minimum heading depth for TOC |
| `tocMaxDepth` | `number` | Maximum heading depth for TOC |
| `headingIdStrategy` | `"flat" \| "hierarchical"` | Heading ID generation strategy |
| `sidebarResizer` | `boolean` | Enable sidebar resizer handle |
| `sidebarToggle` | `boolean` | Enable sidebar mobile toggle |
| `imageEnlarge` | `boolean` | Enable image enlarge on click |
| `dynamicPageTransition` | `boolean` | Enable View Transitions API |
| `frontmatterPreview` | `FrontmatterPreviewConfig \| false` | Frontmatter preview panel config |
| `docHistory` | `boolean` | Enable doc history dropdown |
| `bodyFootUtilArea` | `BodyFootUtilAreaConfig \| false` | Body footer utility area config |
| `htmlPreview` | `HtmlPreviewConfig \| undefined` | HTML preview sandbox config |
| `versions` | `VersionConfig[] \| false` | Multi-version config |
| `claudeResources` | `{ claudeDir: string; projectRoot?: string } \| false` | Claude resources generation config |
| `defaultLocaleOnlyPrefixes` | `string[]` | URL prefixes that only render for the default locale |
| `footer` | `FooterConfig \| false` | Footer config |
| `headerNav` | `HeaderNavItem[]` | Header navigation items |
| `headerRightItems` | `HeaderRightItem[]` | Header right side items |
| `packageOwnedRoutes?` | `boolean` | **Internal/unstable** — dormant flag for package-owned route injection. Default `false`. NOT part of the stable 1.0 user contract; this field is excluded from the snapshot guard. See ADR `docs/adr/route-injection-seam.md`. |

---

## 3. `@theme` Design Tokens

Defined in `src/styles/global.css`. Consumers must define these tokens in their own `@theme` block.

**Authoritative drift guard:** `pnpm check:token-lint` (`design-token-lint`).

### Color Tokens

| Token group | Description |
|---|---|
| `--color-bg`, `--color-fg` | Base background and foreground |
| `--color-sel-bg`, `--color-sel-fg` | Selection colors |
| `--color-p0`–`--color-p15` | Raw 16-slot palette |
| `--color-surface`, `--color-muted` | UI surface colors |
| `--color-accent`, `--color-accent-hover` | Accent / interactive |
| `--color-code-bg`, `--color-code-fg` | Code block colors |
| `--color-success`, `--color-danger`, `--color-warning`, `--color-info` | Semantic status colors |
| `--color-overlay` | Overlay/backdrop (theme-independent, always dark) |
| `--color-page-loading-overlay` | Page-loading overlay scrim (decoupled from lightbox) |
| `--color-image-overlay-bg`, `--color-image-overlay-fg` | Image enlarge overlay |
| `--color-chat-user-bg`, `--color-chat-user-text` | AI chat user message |
| `--color-chat-assistant-bg`, `--color-chat-assistant-text` | AI chat assistant message |
| `--color-matched-keyword-bg`, `--color-matched-keyword-fg` | Search keyword highlight |

### Spacing Tokens

| Token group | Description |
|---|---|
| `--spacing-hsp-2xs`–`--spacing-hsp-2xl` | Horizontal spacing scale (2px–32px) |
| `--spacing-vsp-3xs`–`--spacing-vsp-2xl` | Vertical spacing scale (4px–56px) |
| `--spacing-icon-xs`–`--spacing-icon-lg` | Icon size scale (12px–24px) |
| `--spacing-image-overlay-inset` | Overlay button corner inset |

### Text (Typography) Tokens

| Token | Maps to | Description |
|---|---|---|
| `--text-micro` | 12px | Compact panel labels |
| `--text-caption` | 14px | Labels, timestamps |
| `--text-small` | 16px | Secondary text, nav items |
| `--text-body` | 19.2px | Paragraphs, default |
| `--text-title` | 22.4px | Card titles, section labels |
| `--text-heading` | 48px | Page headings |
| `--text-display` | 60px | Hero text |

### Font Tokens

| Token | Value | Description |
|---|---|---|
| `--font-sans` | `system-ui, sans-serif` | Sans-serif stack |
| `--font-mono` | `ui-monospace, monospace` | Monospace stack |
| `--font-weight-normal` | 400 | Normal weight |
| `--font-weight-medium` | 500 | Medium weight |
| `--font-weight-semibold` | 600 | Semibold weight |
| `--font-weight-bold` | 700 | Bold weight |

### Leading (Line Height) Tokens

| Token | Value |
|---|---|
| `--leading-tight` | 1.25 |
| `--leading-snug` | 1.375 |
| `--leading-normal` | 1.5 |
| `--leading-relaxed` | 1.625 |

### Radius Tokens

| Token | Value | Description |
|---|---|---|
| `--radius-DEFAULT` | 0.25rem (4px) | Default border radius |
| `--radius-lg` | 0.5rem (8px) | Large border radius |
| `--radius-full` | 9999px | Full (pill/circle) |

---

## 4. `doclayout` Slot Anchors (16)

Defined in `packages/zudo-doc/src/doclayout/anchors.ts` and exported via `./doclayout`. The scaffold tool (`create-zudo-doc`) injects these anchors into the generated doc-layout file.

**Authoritative drift guard:** `pnpm check:template-drift` verifies parity between `DOC_LAYOUT_ANCHORS` and the scaffolded doc-layout.

| Anchor ID | Kind | Comment format |
|---|---|---|
| `imports` | frontmatter | `// @slot:doc-layout:imports` |
| `frontmatter` | frontmatter | `// @slot:doc-layout:frontmatter` |
| `head-scripts` | body | `<!-- @slot:doc-layout:head-scripts -->` |
| `head-links` | body | `<!-- @slot:doc-layout:head-links -->` |
| `header-call:start` | body | `<!-- @slot:doc-layout:header-call:start -->` |
| `header-call:end` | body | `<!-- @slot:doc-layout:header-call:end -->` |
| `after-sidebar` | body | `<!-- @slot:doc-layout:after-sidebar -->` |
| `content-wrapper:start` | body | `<!-- @slot:doc-layout:content-wrapper:start -->` |
| `content-wrapper:end` | body | `<!-- @slot:doc-layout:content-wrapper:end -->` |
| `breadcrumb:start` | body | `<!-- @slot:doc-layout:breadcrumb:start -->` |
| `breadcrumb:end` | body | `<!-- @slot:doc-layout:breadcrumb:end -->` |
| `after-breadcrumb` | body | `<!-- @slot:doc-layout:after-breadcrumb -->` |
| `after-content` | body | `<!-- @slot:doc-layout:after-content -->` |
| `footer` | body | `<!-- @slot:doc-layout:footer -->` |
| `body-end-components` | body | `<!-- @slot:doc-layout:body-end-components -->` |
| `body-end-scripts` | body | `<!-- @slot:doc-layout:body-end-scripts -->` |

---

## 5. Ejectable Component List (18)

The eject surface exposed by `zudo-doc eject <component>`. Defined in `packages/zudo-doc/src/eject/index.ts` (exported as `@takazudo/zudo-doc/eject`; `EJECTABLE` map). Source files are shipped in the package's `eject/` directory.

**Snapshot guard:** `packages/zudo-doc/src/__tests__/ejectable-snapshot.test.ts` locks the list.

| CLI name | Package subpath | Default local destination |
|---|---|---|
| `header` | `@takazudo/zudo-doc/header` | `src/components/zudo-doc/header` |
| `footer` | `@takazudo/zudo-doc/footer` | `src/components/zudo-doc/footer` |
| `breadcrumb` | `@takazudo/zudo-doc/breadcrumb` | `src/components/zudo-doc/breadcrumb` |
| `toc` | `@takazudo/zudo-doc/toc` | `src/components/zudo-doc/toc` |
| `sidebar` | `@takazudo/zudo-doc/sidebar` | `src/components/zudo-doc/sidebar` |
| `theme-toggle` | `@takazudo/zudo-doc/theme-toggle` | `src/components/zudo-doc/theme-toggle` |
| `page-loading` | `@takazudo/zudo-doc/page-loading` | `src/components/zudo-doc/page-loading` |
| `tab-item` | `@takazudo/zudo-doc/tab-item` | `src/components/zudo-doc/tab-item` |
| `doc-pager` | `@takazudo/zudo-doc/doc-pager` | `src/components/zudo-doc/doc-pager` |
| `content-admonition` | `@takazudo/zudo-doc/content-admonition` | `src/components/zudo-doc/content-admonition` |
| `code-group` | `@takazudo/zudo-doc/code-group` | `src/components/zudo-doc/code-group` |
| `details` | `@takazudo/zudo-doc/details` | `src/components/zudo-doc/details` |
| `sidebar-tree-island` | `@takazudo/zudo-doc/sidebar-tree-island` | `src/components/zudo-doc/sidebar-tree-island` |
| `sidebar-toggle-island` | `@takazudo/zudo-doc/sidebar-toggle-island` | `src/components/zudo-doc/sidebar-toggle-island` |
| `desktop-sidebar-toggle-island` | `@takazudo/zudo-doc/desktop-sidebar-toggle-island` | `src/components/zudo-doc/desktop-sidebar-toggle-island` |
| `image-enlarge` | `@takazudo/zudo-doc/image-enlarge` | `src/components/zudo-doc/image-enlarge` |
| `doc-history` | `@takazudo/zudo-doc/doc-history` | `src/components/zudo-doc/doc-history` |
| `site-tree-nav-island` | `@takazudo/zudo-doc/site-tree-nav-island` | `src/components/zudo-doc/site-tree-nav-island` |

---

## Internal / Unstable

The following field is documented here for completeness but is **explicitly excluded from the stable contract**:

- `settings.packageOwnedRoutes` — internal/advanced, dormant by default (`false`). Package-owned route injection seam (epic #2356, ADR `docs/adr/route-injection-seam.md`). With the flag off the capability is fully inert. NOT a stable user-facing feature.

---

## Migration Notes

### 2.0 — page-chrome factories take a single `ChromeContext`

Every public page-chrome factory now takes the unified `ChromeContext` (from `./factory-context`)
instead of the pre-2.0 per-factory narrow context or deps-bag. This covers both the
component-level chrome factories (`createFooterWithDefaults`, `createHeaderWithDefaults`,
`createSidebarWithDefaults`, `createHeadWithDefaults`, `createDocTagsArea`,
`createDocHistoryArea`, `createDocContentHeader`, `createDocMetainfoArea`,
`createDocBodyEnd`) and the page-level composition factories (`createRenderDocPage`,
`createDocPageShell`, `createTagPages`, `createVersionsPageView`, `createDocPager`).
The `ChromeContext` includes a required `hostBindings` field. Passing a pre-2.0 deps-bag
compiles under tsc but throws at runtime — the factories now surface a clear actionable
error (`hostBindings` missing or null) instead of an opaque TypeError.

**Upgrade path:** use `createChrome(routeContext, hostBindings?)` (from `./chrome`)
to assemble a `ChromeContext` before calling the factories, or import the unified
type from `./factory-context` and construct it directly.

---

## MAJOR Version Intent

The Collapse Wiring Shells epic (#2420) introduced a breaking API change: every
public page-chrome factory (`createX`) now takes the unified `ChromeContext`
(from `./factory-context`) instead of a narrow per-factory context. The new
public subpaths `./route-context`, `./chrome`, and `./eject` are also part of
the updated stable surface.

**Version bump and publish are handled by the B4PUSH wave (#2431).** Do NOT run
`/l-make-release` here — that step belongs to the B4PUSH merge.
