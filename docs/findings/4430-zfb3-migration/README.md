# zudo-doc 6 / zfb 3 migration matrix

Decision owner: [#4434](https://github.com/zudolab/zudo-doc/issues/4434); epic [#4430](https://github.com/zudolab/zudo-doc/issues/4430). This permanent gap table implements upstream [#3328](https://github.com/Takazudo/zudo-front-builder/issues/3328). It survives deletion of temporary planning resources. All implementation and route verdicts start **pending**; #4476 copies measured parity verdicts and final released versions here.

Baseline: zudo-doc 5.28.2, `main@337b9f110`, zfb 2.22.1. Decision target: npm zfb 3.0.0, checked 2026-09-30 JST. Normative tag commit: `8219310917c4e697a5c9eb292bd68b4ae7a7cefc`. Prerequisite source inventory: `4026c213d0115bbf533319a2969b615e3758805c`. [Binding conventions](../../../_temp-resource/4430-zfb3-migration/conventions.md) and [upstream status census](upstream-status.md). Before #4476 deletes temporary resources, copy the final conventions and necessary proof summaries into this directory and update these links.

## Column meanings and completion rule

Each topic contains file/symbol rows, per-site rawHtml review, utility dispositions, tests and deliberate differences. `pending` means no port evidence yet; `implemented` means code exists; `verified` requires a named passing check and result; `blocked` names an upstream issue and an owner. A “no direct site” row is a scan result, not a completed trust review. Owners replace broad seeded construct labels with the exact change for that symbol, delete demonstrably irrelevant rows with a reason, and add any newly discovered symbols/sites. Test files are enumerated separately. File paths are inventories, not permission to edit another topic’s files.

A row closes only with: final v3 form, pinned spec section, code/test reference, command and result, rawHtml trust/parser/cleanup review if applicable, and any deliberate DOM/class/behavior difference. “None” must be verified, not assumed. Keep temporary shim rows blocked for release even if unit tests pass. #4475 cannot report release PASS while any zfb shim remains.

The mechanical codemod owner #4437 records its starting owned/full TypeScript diagnostic counts here: **pending**. Full integration counts: **pending #4467**. Final package versions and actual `zfb --version` binary output: **pending #4476**. Browser hydration/navigation and client-bundle size delta: **pending #4468/#4475**.

## Normative references

Read these from the zfb clone with `git show v3.0.0:research/<file>`. The older handoff and derived cheat-sheet do not override them.

| Matrix reference | Pinned normative section |
| --- | --- |
| R-API | [Public API and exports](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-react-v1-contract.md#public-api-and-exports) |
| R-JSX | [JSX descriptions and prop dialect](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-react-v1-contract.md#jsx-descriptions-and-prop-dialect) |
| R-SCOPE | [Reactivity and scopes](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-react-v1-contract.md#reactivity-and-scopes) |
| R-RAW | [Trusted raw HTML and parser contexts](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-react-v1-contract.md#trusted-raw-html-and-parser-contexts) |
| R-HYDRATE | [Hydration, mismatch, and minification](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-react-v1-contract.md#hydration-mismatch-and-minification) |
| R-FORMS | [Forms](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-react-v1-contract.md#forms) |
| R-REGIONS | [Conditional regions and keyed lists](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-react-v1-contract.md#conditional-regions-and-keyed-lists) |
| R-PROPS | [Island boundary and props transport](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-react-v1-contract.md#island-boundary-and-props-transport) |
| R-LIFETIME | [Lifecycle and isolation](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-react-v1-contract.md#lifecycle-and-isolation) |
| W-GRAMMAR | [Grammar and rejection contract](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-wind-v1-spec.md#grammar-and-rejection-contract) |
| W-VARIANTS | [Variants and canonical order](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-wind-v1-spec.md#variants-and-canonical-order) |
| W-TOKENS | [Tokens and configuration](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-wind-v1-spec.md#tokens-and-configuration) |
| W-CASCADE | [Cascade, layers, reset and output](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-wind-v1-spec.md#cascade-layers-reset-and-output) |
| W-CATALOG | [Utility catalog by family and batch](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-wind-v1-spec.md#utility-catalog-by-family-and-batch) |
| W-MANIFEST | [Sources, safelist and package manifests](https://github.com/Takazudo/zudo-front-builder/blob/v3.0.0/research/3242-zudo-wind-v1-spec.md#sources-safelist-and-package-manifests) |

[Downstream locked issue audit](issue-locks.md).

## Topic index

- [#4435: css-prep](css-prep.md)
- [#4436: cutover-spine](cutover-spine.md)
- [#4437: mechanical-codemod](mechanical-codemod.md)
- [#4438: test-harness](test-harness.md)
- [#4439: wind-tokens-reset](wind-tokens-reset.md)
- [#4440: wind-manifest-build](wind-manifest-build.md)
- [#4441: shared-primitives](shared-primitives.md)
- [#4442: persisted-chrome](persisted-chrome.md)
- [#4443: small-navigation](small-navigation.md)
- [#4444: toc](toc.md)
- [#4445: site-tree-nav](site-tree-nav.md)
- [#4446: theme-toggle](theme-toggle.md)
- [#4447: sidebar-tree](sidebar-tree.md)
- [#4448: theme-packs](theme-packs.md)
- [#4449: find-in-page](find-in-page.md)
- [#4450: enlarge-dialogs](enlarge-dialogs.md)
- [#4451: ai-chat](ai-chat.md)
- [#4452: doc-history](doc-history.md)
- [#4453: html-preview](html-preview.md)
- [#4454: html-preview-tests](html-preview-tests.md)
- [#4455: preset-generator](preset-generator.md)
- [#4456: design-token-panel](design-token-panel.md)
- [#4457: content-mdx](content-mdx.md)
- [#4458: head-document-shell](head-document-shell.md)
- [#4459: header-footer](header-footer.md)
- [#4460: server-navigation](server-navigation.md)
- [#4461: asset-home-pages](asset-home-pages.md)
- [#4462: sidebar-drawer](sidebar-drawer.md)
- [#4463: generator](generator.md)
- [#4464: doc-composition](doc-composition.md)
- [#4465: routes-public-types](routes-public-types.md)
- [#4466: showcase-host](showcase-host.md)

## Page-by-page coverage

This is a route-family inventory, based on `packages/zudo-doc/src/plugins/routes.ts:deriveRoutes` and `packages/zudo-doc/src/routes/`. #4476 expands each family with actual captured URLs/states and copies final verdicts from #4468. A feature-gated family disabled in one fixture needs an enabled fixture, or an explicit not-configured verdict. Default locale is unprefixed.

Shared **shell** means DocLayout, DocHead/HeadWithDefaults, ColorSchemeProvider/ThemePackProvider, Header/Footer, Breadcrumb, SidebarWithDefaults, doc pager/metainfo where configured (#4458/#4459/#4464). Shared **islands** means ClientRouterBootstrap, SidebarToggle/SidebarTree, DesktopSidebarToggle/DesktopTocToggle, Toc, ThemeToggle, optional ThemePackSwitcher, FindInPageInit, AiChatModal, ImageEnlarge, MermaidEnlarge and DesignTokenPanelBootstrap, depending on feature/route (#4443–#4451/#4456/#4462). The column explicitly names family-specific additions. Read concrete render paths to mark an optional island absent; do not claim every island renders on every route.

| Family and variant | Exact route entry / host stub | Components and islands to inventory | Owners | Final URL/state verdict |
| --- | --- | --- | --- | --- |
| Home `/` | `routes/index.tsx`; `pages/index.tsx` | HomePage/HomeIntro + configured shell/islands | #4461, #4457, #4465, #4466; shared owners above | pending |
| Localized home `/[locale]/` | `routes/locale-index.tsx`; `pages/[locale]/index.tsx` | Localized HomePage/HomeIntro + shell/islands, language links | #4461, #4465, #4466, #4459 | pending |
| Document `/docs/[[...slug]]` | `routes/docs-slug.tsx`; `pages/docs/[[...slug]].tsx` | DocPageRenderer/Shell, MDX content, metainfo/pager, shell/islands; DocHistory, HtmlPreview and PresetGenerator when used | #4464, #4457, #4452–#4455, #4465, #4466 | pending |
| Localized document `/[locale]/docs/[[...slug]]` | `routes/locale-docs-slug.tsx`; matching host stub | Same document graph with localized sidebar/labels/metadata | #4464, #4465, #4466; island owners | pending |
| Versioned document `/v/[version]/docs/[[...slug]]` | `routes/v-docs-slug.tsx`; `pages/v/[version]/docs/[[...slug]].tsx` | Document graph + version switcher/current path, archive content | #4464, #4465, #4466, #4459 | pending |
| Localized versioned document `/v/[version]/[locale]/docs/[[...slug]]` | `routes/v-locale-docs-slug.tsx`; matching host stub | Version + locale graph, sidebar and links | #4464, #4465, #4466, #4459 | pending |
| Tags index `/docs/tags` | `routes/docs-tags-index.tsx` | AllTagsPage/tag-pages, DocLayout, shell/islands as configured | #4460, #4465; shared owners | pending |
| Localized tags index `/[locale]/docs/tags` | `routes/locale-docs-tags-index.tsx` | Localized AllTagsPage + shell/islands | #4460, #4465 | pending |
| Tag `/docs/tags/[tag]` | `routes/docs-tags-tag.tsx` | TagPage, document cards, shell/islands | #4460, #4465 | pending |
| Localized tag `/[locale]/docs/tags/[tag]` | `routes/locale-docs-tags-tag.tsx` | Localized TagPage/cards + shell/islands | #4460, #4465 | pending |
| Versions `/docs/versions` | `routes/docs-versions.tsx` | VersionsPage + shell/islands and version links | #4460, #4465, #4459 | pending |
| Localized versions `/[locale]/docs/versions` | `routes/locale-docs-versions.tsx` | Localized VersionsPage + shell/islands | #4460, #4465 | pending |
| Asset index `/files/` (prefix configurable) | `routes/files-path.tsx`, empty path branch | AssetIndexPage/asset-components + configured reader shell/islands | #4461, #4465 | pending |
| Asset page `/files/[[...path]]` | `routes/files-path.tsx`, detail branch | AssetPage/media components, asset inline controllers + configured shell/islands | #4461, #4465 | pending |
| Localized asset index `/[locale]/files/` | `routes/locale-files-path.tsx`, empty path branch | Localized AssetIndexPage + configured shell/islands | #4461, #4465 | pending |
| Localized asset page `/[locale]/files/[[...path]]` | `routes/locale-files-path.tsx`, detail branch | Localized AssetPage/media + configured shell/islands | #4461, #4465 | pending |
| 404 `/404` (`dist/404.html`) | `routes/404.tsx` | Error shell, BodyEndIslands including configured DTP bootstrap; verify route-specific omitted nav | #4465, #4464, #4456, #4458, #4459 | pending |
| Localized 404; versioned home/tags/versions/assets/404; versioned localized equivalents | No separate entry in deriveRoutes | No new migration routes. Existing catch-all docs route may resolve authored docs with these slugs; verify absence/fallback rather than fabricate families | #4465, #4468 | pending absence/fallback checks |
| Non-page endpoints `/sitemap.xml`, `/robots.txt`, `/api/ai-chat` | `routes/sitemap.xml.tsx`, `robots.txt.tsx`, `api-ai-chat.tsx`; host API | No UI island graph; XML/text/JSON output and Worker contract | #4465, #4466, #4475 | pending |

## Required parity states and release gates

For every applicable family capture default + nondefault locale, configured versions and deployment base, mobile/desktop and breakpoint boundaries, light/dark/system/theme packs, keyboard focus, open appearance menu/drawer/modal, selected theme card, DocHistory revision changes, HtmlPreview visible/eager and auto-height, PresetGenerator model changes, client navigation and back/forward. Exercise a mutated persisted island before navigating and nonzero sidebar scroll. Record no-console-error hydration proof and final rendered head/MDX/CSS proof. Browser suite ownership is #4468/#4475; leaf owners request verification rather than run heavy suites.

The release ledger must explicitly clear source workarounds for upstream #3359, #3360, #3361, #3362, #3364, #3375 and #3376 with the published resolution and a no-shim survivor scan. Strict props and explicit units may remain as the verified published contract, but ad hoc serializers, wrapper markup, physical CSS paths and remount shims cannot silently become final APIs. The current decision snapshot certifies no final visual parity and no release readiness.
