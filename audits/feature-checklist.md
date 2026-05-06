# zudo-doc Master Feature Checklist (S2 of #1360)

> Source branch: `zfb-feature-audit/s2-checklist`
> Generated: 2026-05-04
> One row per feature. Each feature maps to one or more doc pages, one or more settings keys, and one or more sub-tasks S3-S14.

---

## Legend

- **Feature ID**: kebab-case identifier for this feature cluster
- **Doc page**: path relative to `src/content/docs/`
- **Settings key**: key(s) in `src/config/settings.ts`
- **Wired in**: zfb plugin / client island / v2 utility / page route
- **Client island?**: yes / no / partial (partial = island in a sub-component)
- **Expected behavior**: 1-3 bullets
- **Locale parity**: EN+JA mirror present? yes / no / N-A
- **Sub-task**: S3-S14 cluster

---

## Checklist

| Feature ID | Doc page | Settings key | Wired in | Client island? | Expected behavior | Locale parity | Sub-task |
|---|---|---|---|---|---|---|---|
| site-metadata | getting-started/index.mdx | `siteName`, `siteDescription`, `siteUrl`, `noindex` | `pages/lib/_head-with-defaults.tsx` (DocHead) | no | Site name + description injected into `<title>` and `<meta>`; noindex adds noindex/nofollow; siteUrl required for sitemap absolute URLs | yes | S13 |
| base-path | getting-started/installation.mdx | `base` | zfb engine + all route helpers (`withBase`, `docsUrl`) | no | All generated hrefs are prefixed with the configured base path; asset references resolve under the base | yes | S7 |
| introduction-overview | getting-started/introduction.mdx | - | static MDX page | no | Landing overview of the framework; no settings key, no island | yes | S3 |
| installation | getting-started/installation.mdx | `base`, `docsDir` | static MDX page | no | Step-by-step install guide for `create-zudo-doc` scaffold; documents `pnpm create zudo-doc` invocation | yes | S14 |
| preset-generator | getting-started/setup-preset-generator.mdx | - | `pages/lib/_preset-generator.tsx`, island `PresetGenerator` | yes | Interactive form to generate a `settings.ts` snippet; form state managed client-side; output copyable | yes | S14 |
| structuring-navigation | getting-started/structuring-navigations.mdx | `headerNav` | `_header-with-defaults.tsx`, `_sidebar-with-defaults.tsx` | partial | Filesystem-driven sidebar; `_category_.json` controls labels/position; `sidebar_position` sorts pages | yes | S6 |
| writing-docs | getting-started/writing-docs.mdx | `docsDir` | MDX content pipeline in `zfb.config.ts` | no | Documents frontmatter fields, admonitions, linking conventions, and content creation workflow | yes | S3 |
| contribution-guide | getting-started/contribution.mdx | - | static MDX page | no | Explains how to contribute to zudo-doc itself | yes | S3 |
| routing-conventions | concepts/routing-conventions.mdx | `trailingSlash`, `base`, `defaultLocale`, `locales` | zfb engine routes in `pages/` | no | File-routed pages under `pages/`; trailing-slash policy; locale-prefixed routes for non-default locales | yes | S7 |
| trailing-slash | concepts/trailing-slash-policy.mdx | `trailingSlash` | zfb engine; `stripMdExt: true` in `zfb.config.ts` | no | Trailing-slash enforcement on all page URLs; `.mdx` extension stripped from `<a href>` at build time | yes | S7 |
| admonitions | components/admonitions.mdx | - | `packages/md-plugins/` (rehype admonitions plugin) | no | `:::note[Title]` directive syntax and `<Note>/<Tip>/<Info>/<Warning>/<Danger>` JSX shortcuts rendered server-side | yes | S3 |
| basic-components | components/basic-components.mdx | - | `src/components/content/` MDX overrides | no | Server-rendered Preact overrides for h2-h4, p, a, strong, blockquote, ul, ol, table registered via `_mdx-components.ts` | yes | S3 |
| category-nav | components/category-nav.mdx | - | `pages/lib/_category-nav.tsx` | no | Displays a grid of child pages for a category; used on index pages to give a visual overview of the section | yes | S6 |
| category-tree-nav | components/category-tree-nav.mdx | - | `pages/lib/_category-tree-nav.tsx` | no | Renders a hierarchical tree of the entire sidebar section; used for section overview pages | yes | S6 |
| details | components/details.mdx | - | `pages/lib/_details.tsx`, `packages/zudo-doc-v2/src/details/` | no | MDX `<Details>` component rendered as native `<details>`/`<summary>`; no JS required | yes | S3 |
| html-preview | components/html-preview.mdx | `htmlPreview` | `pages/lib/_body-end-islands.tsx` (partial), `src/components/html-preview/` | partial | `<HtmlPreview>` wraps HTML+CSS snippets in an iframe with syntax-highlighted source; iframe bridge syncs color-scheme CSS vars | yes | S3 |
| image-enlarge | components/image-enlarge.mdx | `imageEnlarge` | `pages/lib/_body-end-islands.tsx`, island `ImageEnlarge` | yes | Click any content image to open it full-screen in a `<dialog>`; lazy-loaded on idle | yes | S9 |
| math-equations | components/math-equations.mdx | `math` | `pages/lib/_math-block.tsx`, KaTeX render pipeline | no | LaTeX math via `$...$` inline and `$$...$$` block; rendered server-side by KaTeX; no client JS | yes | S3 |
| mermaid-diagrams | components/mermaid-diagrams.mdx | `mermaid` | zfb MDX pipeline (Mermaid fenced code block handler) | no | Fenced code blocks with `mermaid` language tag are converted to SVG at build time | yes | S3 |
| site-tree-nav | components/site-tree-nav.mdx | - | `pages/lib/_site-tree-nav.tsx`, `src/components/site-tree-nav.tsx` | no | `<SiteTreeNav>` renders a full site-wide navigation tree; server-rendered | yes | S6 |
| tabs | components/tabs.mdx | - | `packages/zudo-doc-v2/src/tab-item/` | no | `<Tabs>` + `<TabItem>` MDX components; tab switching handled with CSS (no JS required) | yes | S3 |
| components-index | components/index.mdx | - | static MDX category index | no | Category overview page for the Components section | yes | S3 |
| configuration | guides/configuration.mdx | `colorScheme`, `colorMode`, `siteName`, `siteDescription`, `base`, `trailingSlash`, `docsDir`, `defaultLocale`, `locales`, `mermaid`, `noindex`, `editUrl`, `githubUrl`, `siteUrl`, `sitemap`, `docMetainfo`, `docTags`, `tagPlacement`, `tagGovernance`, `tagVocabulary`, `llmsTxt`, `math`, `cjkFriendly`, `onBrokenMarkdownLinks`, `aiAssistant`, `designTokenPanel`, `colorTweakPanel`, `sidebarResizer`, `sidebarToggle`, `imageEnlarge`, `frontmatterPreview`, `docHistory`, `bodyFootUtilArea`, `htmlPreview`, `versions`, `claudeResources`, `footer`, `headerNav`, `headerRightItems` | `src/config/settings.ts` (all keys) | no | Central reference for all settings keys; documents types, defaults, and effect of each setting | yes | S9 |
| deployment | guides/deployment.mdx | - | CI workflows (`.github/workflows/`), Cloudflare Pages adapter | no | Documents production and PR CI pipeline structure; build-site + build-history parallel jobs; Cloudflare Pages deployment | yes | S14 |
| development-workflow | guides/development-workflow.mdx | - | `pnpm dev`, `pnpm build`, `pnpm check`, `pnpm b4push` commands | no | Explains dev commands, pre-push validation, and the `b4push` script sequence | yes | S14 |
| doc-history | guides/doc-history.mdx | `docHistory`, `bodyFootUtilArea` | `plugins/doc-history-plugin.mjs`, island `DocHistory`, `packages/zudo-doc-v2/src/integrations/doc-history/` | yes | Shows git commit history per doc page; dev mode proxies to `@zudo-doc/doc-history-server` on port 4322; CI generates JSON files in parallel | yes | S12 |
| doc-skill-symlinker | guides/doc-skill-symlinker.mdx | `claudeResources` | `plugins/claude-resources-plugin.mjs`, `packages/zudo-doc-v2/src/integrations/claude-resources/` | no | Generates MDX pages from `.claude/` skills/commands/agents; pre-build step writes content into docs collection | yes | S13 |
| footer-taglist | guides/footer-taglist.mdx | `footer` | `packages/zudo-doc-v2/src/footer/` (`FooterTagColumn`) | no | Optional tag index columns in the footer; `groupBy: "group"` clusters by vocabulary group; `groupBy: "flat"` alphabetises | yes | S5 |
| footer | guides/footer.mdx | `footer` | `pages/lib/_footer-with-defaults.tsx`, `packages/zudo-doc-v2/src/footer/` | no | Footer with link columns and copyright; opt-in taglist columns; locale-aware link labels | yes | S5 |
| frontmatter | guides/frontmatter.mdx | `docTags`, `tagPlacement`, `frontmatterPreview` | `zfb.config.ts` `docsSchema`, `_doc-metainfo-area.tsx` | no | Canonical reference for all frontmatter fields (`title`, `description`, `sidebar_position`, `tags`, `draft`, `unlisted`, `generated`, `hide_sidebar`, `hide_toc`, etc.) | yes | S3 |
| header-navigation | guides/header-navigation.mdx | `headerNav` | `pages/lib/_header-with-defaults.tsx`, `packages/zudo-doc-v2/src/header/` | partial | Top-level nav with `categoryMatch` active highlighting; dropdown children; locale-aware labels via `labelKey` | yes | S4 |
| header-right-items | guides/header-right-items.mdx | `headerRightItems`, `githubUrl`, `aiAssistant`, `designTokenPanel`, `sidebarToggle` | `pages/lib/_header-with-defaults.tsx`, `SearchWidget`, islands `ThemeToggle`/`SidebarToggle` | partial | Configures right-side header slots: version-switcher, design-token panel trigger, AI chat trigger, GitHub link, theme toggle, search, language switcher | yes | S4 |
| i18n | guides/i18n.mdx | `defaultLocale`, `locales` | `pages/[locale]/docs/[...slug].tsx`, `pages/[locale]/index.tsx`, i18n helpers in `src/config/i18n.ts` | no | Locale-prefixed routes for non-default locales; bilingual content mirror; locale switcher in header right items | yes | S7 |
| llms-txt | guides/llms-txt.mdx | `llmsTxt` | `plugins/llms-txt-plugin.mjs`, `packages/zudo-doc-v2/src/integrations/llms-txt/` | no | Emits `llms.txt` and `llms-full.txt` (plus per-locale variants) at build time; dev middleware serves them live | yes | S13 |
| search | guides/search.mdx | `headerRightItems` (search component) | `plugins/search-index-plugin.mjs`, `pages/lib/_search-widget.tsx`, `packages/search-worker/`, `packages/zudo-doc-v2/src/integrations/search-index/` | partial | Full-text search index emitted at build; `SearchWidget` renders a dialog with results; Cloudflare Worker serves server-side search; keyboard shortcut `/` or Ctrl+K opens | yes | S10 |
| sidebar | guides/sidebar.mdx | `headerNav`, `sidebarToggle`, `sidebarResizer` | `pages/lib/_sidebar-with-defaults.tsx`, islands `SidebarTree`, `SidebarToggle`, `DesktopSidebarToggle` | yes | Desktop sidebar with collapsible tree; mobile hamburger slide-in; sidebar width resizer drag handle | yes | S6 |
| sidebar-filter | guides/sidebar-filter.mdx | `sidebarToggle` | island `SidebarTree` (filter input) | yes | Sidebar includes a client-side filter input that narrows visible entries; state managed in island | yes | S6 |
| tag-governance | guides/tag-governance.mdx | `tagGovernance`, `tagVocabulary` | `zfb.config.ts` `buildTagsSchema()`, `src/utils/tags.ts`, `scripts/tags-audit.*` | no | Governance modes: `off`/`warn`/`strict`; vocabulary consulted for alias rewrite, deprecation filtering, grouped footer; strict mode rejects unknown tags at Zod validation | yes | S8 |
| tags-audit | guides/tags-audit.mdx | `tagGovernance`, `tagVocabulary` | `scripts/tags-audit.ts` (`pnpm tags:audit`) | no | CLI audit reports unknown/deprecated tags; `--ci` flag fails the process for use in `pnpm b4push` | yes | S8 |
| tags-suggest | guides/tags-suggest.mdx | `tagVocabulary` | `scripts/tags-suggest.ts` (`pnpm tags:suggest`) | no | CLI suggests canonical tag ids for pages with missing or unrecognised tags | yes | S8 |
| tags | guides/tags.mdx | `docTags`, `tagPlacement`, `tagVocabulary` | `_doc-metainfo-area.tsx`, `pages/docs/tags/[tag].tsx`, `pages/docs/tags/index.tsx` | no | Tags displayed on each doc page per `tagPlacement`; tag index pages list pages per tag; vocabulary-aware alias resolution | yes | S8 |
| versioning | guides/versioning.mdx | `versions` | `pages/docs/versions.tsx`, `pages/v/[version]/docs/[...slug].tsx`, `pages/v/[version]/ja/docs/[...slug].tsx`, `VersionSwitcher` | no | Multiple doc versions under `/v/{version}/docs/`; version switcher in header right; version banner on archived versions | yes | S7 |
| body-foot-util-area | guides/body-foot-util-area.mdx | `bodyFootUtilArea`, `editUrl`, `docHistory` | `pages/lib/_body-foot-util-area.tsx` (via `_doc-history-area.tsx`), `packages/zudo-doc-v2/src/body-foot-util/` | partial | Area below doc content: doc history timeline, view-source / edit link | yes | S5 |
| ai-assistant | guides/ai-assistant.mdx | `aiAssistant` | `pages/api/ai-chat.tsx` (CF Worker route), island `AiChatModal`, `packages/ai-chat-worker/` | yes | Chat modal triggered from header right item; proxies to Cloudflare Worker backed by Anthropic API; streams responses; rate-limited | no | S11 |
| color-scheme-preview | guides/color-scheme-preview.mdx | `colorScheme`, `colorMode`, `designTokenPanel` | `src/config/color-schemes.ts`, island `DesignTokenTweakPanel` (Color tab) | yes | Browse and preview all built-in color schemes; live-edit palette and semantic tokens via the Color tab; export TypeScript `ColorScheme` snippet | yes | S9 |
| guides-index | guides/index.mdx | - | static MDX category index | no | Category overview for the Guides section | yes | S3 |
| layout-demos-index | guides/layout-demos/index.mdx | `hide_sidebar`, `hide_toc` | `zfb.config.ts` `docsSchema`, `_sidebar-with-defaults.tsx`, `_doc-layout-with-defaults.tsx` | no | Index for layout demo sub-section | yes | S6 |
| hide-sidebar | guides/layout-demos/hide-sidebar.mdx | `hide_sidebar` (frontmatter) | doc layout conditional logic | no | `hide_sidebar: true` in frontmatter omits the left sidebar from the page layout | yes | S6 |
| hide-toc | guides/layout-demos/hide-toc.mdx | `hide_toc` (frontmatter, not a settings key) | doc layout conditional logic | no | `hide_toc: true` in frontmatter omits the right TOC from the page layout | yes | S6 |
| hide-both | guides/layout-demos/hide-both.mdx | `hide_sidebar`, `hide_toc` (frontmatter) | doc layout conditional logic | no | `hide_sidebar: true` + `hide_toc: true` produces a centered full-width content layout | yes | S6 |
| ai-assistant-api | reference/ai-assistant-api.mdx | `aiAssistant` | `pages/api/ai-chat.tsx`, `packages/ai-chat-worker/` | no | API spec for `/api/ai-chat`; POST endpoint; streaming response; ANTHROPIC_API_KEY + rate-limit KV bindings | no | S11 |
| cjk-friendly | reference/cjk-friendly.mdx | `cjkFriendly` | zfb MDX pipeline (zfb #102 CJK-aware emphasis/strong tokenisation) | no | Correct CJK word-break and emphasis tokenisation in MDX; avoids half-width latin breaks mid-word in Japanese/Chinese content | yes | S7 |
| color-reference | reference/color.mdx | `colorScheme`, `colorMode` | `src/config/color-schemes.ts`, `packages/zudo-doc-v2/src/theme/`, island `DesignTokenTweakPanel` | yes | Reference for the 16-color palette system, three-tier token strategy, and all semantic token names | yes | S9 |
| component-first | reference/component-first.mdx | - | `src/components/content/`, `pages/_mdx-components.ts` | no | Documents the component-first CSS strategy; Preact overrides for MDX elements; tight token usage | yes | S9 |
| create-zudo-doc | reference/create-zudo-doc.mdx | - | `packages/create-zudo-doc/` | no | Reference for the `create-zudo-doc` CLI scaffold tool; feature flags; generated file structure | yes | S14 |
| design-system | reference/design-system.mdx | `colorScheme`, `colorMode` | `src/styles/global.css` (design tokens) | no | Design token system overview: three-tier color, three-tier font-size, two-tier size strategies | yes | S9 |
| design-token-panel | reference/design-token-panel.mdx | `designTokenPanel`, `colorTweakPanel` | island `DesignTokenTweakPanel`, `packages/zudo-doc-v2/src/theme/` | yes | Tabbed panel (spacing/font/size/color tabs) for live token tweaking; JSON export/import workflow; persists to `localStorage` | yes | S9 |
| doc-history-server-ref | reference/doc-history-server.mdx | `docHistory` | `packages/doc-history-server/`, `plugins/doc-history-plugin.mjs` | no | Reference for `@zudo-doc/doc-history-server` CLI and REST API; server vs CLI modes; `SKIP_DOC_HISTORY` env var | yes | S12 |
| frontmatter-preview | reference/frontmatter-preview.mdx | `frontmatterPreview` | `_doc-metainfo-area.tsx` (via `pages/lib/`) | no | Automatically renders custom frontmatter fields as a metadata table beneath the page title; `.passthrough()` on the schema preserves arbitrary keys | yes | S5 |
| reference-index | reference/index.mdx | - | static MDX category index | no | Category overview for the Reference section | yes | S3 |
| search-worker-ref | reference/search-worker.mdx | - | `packages/search-worker/` | no | Reference for the Cloudflare Worker search API; worker fetches `search-index.json` from the deployed site; full-text ranking | yes | S10 |
| smart-break | reference/smart-break.mdx | `cjkFriendly` | zfb MDX pipeline | no | Documents `<SmartBreak>` and CSS line-break rules for CJK-aware typography | yes | S7 |
| generator-cli-testing | develop/generator-cli-testing.mdx | - | `packages/create-zudo-doc/src/__tests__/`, `pnpm l-run-generator-cli-whole-test` | no | Explains how to test the `create-zudo-doc` generator; CI test matrix | yes | S14 |
| link-checker | develop/link-checker.mdx | `onBrokenMarkdownLinks` | `scripts/check-links.*`, `pnpm b4push` link-check step | no | Documents the link-checker script that validates internal and external links; `onBrokenMarkdownLinks: "warn" | "error" | "ignore"` | yes | S14 |
| develop-index | develop/index.mdx | - | static MDX category index | no | Category overview for the Develop section | yes | S14 |
| color-scheme | - | `colorScheme`, `colorMode` | `src/config/color-schemes.ts`, `packages/zudo-doc-v2/src/theme/color-scheme-provider.tsx` | no | Active color scheme injected as CSS custom properties on `:root` at SSR; `defaultMode` controls initial light/dark; `respectPrefersColorScheme` honors OS preference | N-A | S9 |
| sitemap | - | `sitemap`, `siteUrl` | `pages/sitemap.xml.tsx` | no | Sitemap generated as a zfb non-HTML page route; emits `sitemap.xml` with absolute URLs derived from `siteUrl + base` | N-A | S13 |
| toc | - | - | island `Toc` (`packages/zudo-doc-v2/src/toc/toc.tsx`), island `MobileToc` | yes | Desktop TOC scroll-spy highlights the active heading; mobile TOC shown above content on small viewports | N-A | S6 |
| breadcrumb | - | - | `packages/zudo-doc-v2/src/breadcrumb/` | no | Server-rendered breadcrumb trail above doc title; shows category path | N-A | S6 |
| find-in-page | - | - | island `FindBar` (`src/components/find-bar.tsx`), island `FindInPageInit` | yes | Ctrl+F / Cmd+F opens in-page search bar; highlights matches; keyboard navigation | N-A | S6 |
| sidebar-resizer | - | `sidebarResizer` | `packages/zudo-doc-v2/src/sidebar-resizer/`, `initSidebarResizer()` in doc layout | no | Drag handle on desktop sidebar right edge; persists width to `localStorage`; keyboard-accessible | N-A | S6 |
| page-loading | - | - | `packages/zudo-doc-v2/src/page-loading/` | no | Page loading indicator shown during navigation | N-A | S13 |
| view-transitions | - | - | `packages/zudo-doc-v2/src/transitions/`, zfb `<ViewTransitions />` | no | Cross-page View Transitions; `sidebarPersistName` assigns `view-transition-name` to persistent regions | N-A | S13 |
| editUrl-link | - | `editUrl` | `packages/zudo-doc-v2/src/body-foot-util/edit-link.tsx` | no | "Edit this page" link rendered in body-foot-util area when `editUrl` is set | N-A | S5 |
| github-link | - | `githubUrl` | header right item `github-link` component | no | GitHub icon link in header right items | N-A | S4 |
| doc-metainfo | - | `docMetainfo` | `pages/lib/_doc-metainfo-area.tsx` | no | Doc metainfo area renders tags and frontmatter-preview table beneath page title when enabled | N-A | S5 |
| language-switcher | - | `locales` | header right item `language-switcher` component, `buildLocaleLinks()` | no | Language switcher dropdown in header right items; links to equivalent page in each configured locale | N-A | S7 |
| version-switcher | - | `versions` | header right item `version-switcher` component, `VersionSwitcher` from `packages/zudo-doc-v2/src/i18n-version/` | no | Version dropdown in header right items; links to same page in each configured version | N-A | S7 |
| noindex | - | `noindex` | `pages/lib/_head-with-defaults.tsx` | no | Adds `<meta name="robots" content="noindex,nofollow">` to all pages when enabled | N-A | S13 |
| on-broken-markdown-links | - | `onBrokenMarkdownLinks` | `packages/md-plugins/` (ResolveLinksPlugin) | no | Controls whether unresolved markdown links warn, error, or are silently ignored at build time | N-A | S14 |

---

## Tally

Total features: 79
Total islands: 13
Total settings keys: 39

### Islands inventory

1. `AiChatModal` (`src/components/ai-chat-modal.tsx`)
2. `DesignTokenTweakPanel` (`src/components/design-token-tweak/index.tsx`)
3. `ImageEnlarge` (`src/components/image-enlarge.tsx`)
4. `ThemeToggle` (`src/components/theme-toggle.tsx`)
5. `SidebarToggle` (`src/components/sidebar-toggle.tsx`)
6. `SidebarTree` (`src/components/sidebar-tree.tsx`)
7. `DesktopSidebarToggle` (`src/components/desktop-sidebar-toggle.tsx`)
8. `Toc` (`packages/zudo-doc-v2/src/toc/toc.tsx`)
9. `MobileToc` (`packages/zudo-doc-v2/src/toc/mobile-toc.tsx` + host `src/components/mobile-toc.tsx`)
10. `DocHistory` (`src/components/doc-history.tsx`)
11. `FindBar` (`src/components/find-bar.tsx`)
12. `FindInPageInit` (`src/components/find-in-page-init.tsx`)
13. `PresetGenerator` (`src/components/preset-generator.tsx`)

### Settings keys inventory (39 keys)

`colorScheme`, `colorMode`, `siteName`, `siteDescription`, `base`, `trailingSlash`, `docsDir`, `defaultLocale`, `locales`, `mermaid`, `noindex`, `editUrl`, `githubUrl`, `siteUrl`, `sitemap`, `docMetainfo`, `docTags`, `tagPlacement`, `tagGovernance`, `tagVocabulary`, `llmsTxt`, `math`, `cjkFriendly`, `onBrokenMarkdownLinks`, `aiAssistant`, `designTokenPanel`, `colorTweakPanel`, `sidebarResizer`, `sidebarToggle`, `imageEnlarge`, `frontmatterPreview`, `docHistory`, `bodyFootUtilArea`, `htmlPreview`, `versions`, `claudeResources`, `footer`, `headerNav`, `headerRightItems`

---

## Footnotes

1. `installation` and `introduction-overview` share the doc page `getting-started/installation.mdx` and `getting-started/introduction.mdx` respectively. Each is a separate feature row because they cover distinct concerns (install steps vs. framework overview). Primary sub-task S14 / S3.
2. `color-scheme-preview` (guides/color-scheme-preview.mdx) overlaps with `design-token-panel` (reference/design-token-panel.mdx) — both describe the Color tab of the Design Token Panel. Primary cluster: S9. Secondary: S9 (not double-counted in tally).
3. `body-foot-util-area` (S5) depends on `doc-history` (S12) — the DocHistory island is mounted inside `_doc-history-area.tsx` which is composed into the body-foot-util area. Both sub-tasks (S5 and S12) are implicated; primary assignment follows the settings key (`bodyFootUtilArea` → S5, `docHistory` → S12).
4. `frontmatter-preview` (guides/frontmatter.mdx row) and the dedicated reference page (reference/frontmatter-preview.mdx) are separate rows. The guide page documents all frontmatter fields generally; the reference page documents the Frontmatter Preview feature specifically (`frontmatterPreview` settings key). Primary: S3 (guide) and S5 (reference).
5. `find-in-page` island (`FindInPageInit`) is a thin init wrapper that installs keyboard listener for Ctrl+F; `FindBar` is the visible search bar island. Both serve the same feature and are counted as one island entry in tally.
