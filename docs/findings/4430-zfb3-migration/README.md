# zudo-doc 6 / zfb 4 migration matrix

## Current status — #4477 merged and deployed; coordinated 6.0.0 unreleased (2026-10-11)

PR [#4477](https://github.com/zudolab/zudo-doc/pull/4477) merged to `main` as `b9dd43b0d` (final head `68ad9623c`, same tree), and [Production Deploy 38074440930](https://github.com/zudolab/zudo-doc/actions/runs/38074440930) succeeded. Pins: zfb family 4.3.1 (peers `^4.3.1`; adopted by #4516, evidence in [zfb 4.3.1 verification](../zfb-4.3.1/verification.md)), zdtp 0.8.6. Coordinated 6.0.0 unreleased (npm `latest` 5.28.2). The macOS Apple IME gate was owner-waived for the merge; it is NOT RUN, not PASS, and A3/A5 keep their limits. The live status, the evidence limits, the required-check name mismatch, and the ordered next-release handoff are in [post-merge status](2026-10-11-post-merge-status.md). The dated sections below are history (the column meanings, normative references and topic index stay as reference): they keep its original SHAs, results and decisions, and its instructions to merge #4477 no longer apply.

## History — closeout verdict before merge (2026-10-10, superseded 2026-10-11)

**Release verdict: PENDING — one human acceptance item (macOS IME/manual).** Every other required gate is verified on the final candidate `d4185fb9e4f8555d6edaadb419be49ff694cd3ad` (`base/zfb3-migration`, PR [#4477](https://github.com/zudolab/zudo-doc/pull/4477), still draft). `main` is unchanged at `337b9f110793dccb4759bddd5273eab38cd9d2f0`, and the base is not missing any `main` commit. Full record: [closeout final gates](2026-10-10-closeout-final-gates.md). Checklist: [release readiness](release-readiness.md).

- **Versions:** `@takazudo/zfb`, `zfb-runtime`, `zfb-md-wasm` and `zfb-adapter-cloudflare` are exactly 4.3.0, with peers `^4.3.0`. `@takazudo/zdtp` is 0.8.6, selected by the user and also the npm `latest`. Its `dist/` is byte-identical to 0.8.5, and `preact` is now zdtp's own dependency. The explicit host and generator `preact` dependencies were removed. The zudo-doc zdtp peer range and the package importer's 0.8.0 floor coverage are unchanged ([dependencies](2026-10-10-closeout-dependencies.md)).
- **PR Checks** [38044654348](https://github.com/zudolab/zudo-doc/actions/runs/38044654348): 28/28 success, with the same job identities as reference run 38030812860.
- **Migration Hosted Parity** [38044650322](https://github.com/zudolab/zudo-doc/actions/runs/38044650322): all four required jobs succeed. The two diagnostic jobs fail as designed, and both differences are accepted:
  - The A2 byte diagnostic shows the reviewed build-ID and islands-filename inequality.
  - The browser measurement shows 47 `nav`/`sidebarTree` height differences, all classified intended in [visual](2026-10-10-closeout-visual.md).
- **Visual:** the 47 differences are 27 `sidebarTree` and 20 `nav`. They break down as a 46 px toolbar ×38, a 73 px wrapped hint ×5, and the 160 px Guides toolbar plus 3 new pages ×4, with 0 px residual. The deep-nesting ◎ overlap is fixed (#4507), and the 60 parity states show Δ0.
- **Installed consumer:** the run was renewed on zdtp 0.8.6 (`e6fbe4814`). Barebone passed 12/12. All-feature passed 19/19, including the full Design Token Panel lifecycle. There is a single zdtp copy and a single preact copy, the generated `package.json` has no `preact` key, and teardown was proven. With the #4513 fix (`aaf3e307f`), the non-root mount control passes 8/8 ([installed consumer](2026-10-10-closeout-installed-consumer.md)).
- **Review and local:**
  - `/code-review` medium reported 9 findings: 7 were fixed in `61d52377b` and 2 dispositioned.
  - Guarded b4push passed 33/35. `e2e/` type checking failed only on stale gitignored fixtures; a clean checkout gives exit 0. Manual smoke was skipped because there was no TTY.
  - The A2 references were refreshed in `bfd7b2373` and `d4185fb9e`, with the normalizer and assertions unchanged.
- **Preview machine smoke** at `d4185fb9e`: 13/13 PASS with 0 console errors. The AI-chat composition line is synthetic.

### Remaining required item

- **macOS Japanese IME and manual smoke (human, PENDING):** real IME composition in search and the AI chat, the AI chat conversion-Enter rule, and the combined visual smoke. Follow the procedure in [closeout manual](2026-10-10-closeout-manual.md). Takazudo/zudo-front-builder#3330 is the upstream gate. A missing human check stays pending; it is never counted as passed.

### Resume conditions

1. A human tester runs the closeout manual on macOS and records the tester, macOS version, IME/input source, browser and version, and candidate SHA, with a PASS for A1–A3 and B1–B10 posted on PR #4477.
2. Only then does #4512's gated completion run, in this order:
   - Delete `_temp-resource/4430-zfb3-migration/` in one commit.
   - Get green PR Checks and Migration Hosted Parity on that exact final head.
   - Regular-merge PR #4477 to `main`.
   - Run the RELEASE.md coordinated 6.0.0 release in the order history-server → zudo-doc → create-zudo-doc. Set the history-server peer floor and `approvedBaseline` to `^6.0.0`, and run b4push with `B4PUSH_SKIP_PIN_PUBLISHED=1` for the unpublished lockstep-pin window.

Not gates: #4485 (real ChatGPT account) stays open and out of scope. Twelve-level fixture labels at levels 9–12 run past the sidebar edge because of pre-existing native indentation. That is a design call for the user, not a 06R regression. Cleanup, the merge and the 6.0.0 release are gated and not done.

## History — zfb 4.3.0 pre-closeout lead (2026-10-10, superseded)

The text below led this file before the closeout gates ran. It is kept as history.

All four published family packages are pinned to exactly **4.3.0** (zfb, runtime, md-wasm, Cloudflare adapter), with peers **^4.3.0**. npm `latest` and the native CLI (`zfb 4.3.0`, embedded esbuild 0.25.12) were rechecked on 2026-10-10. The resume record is [2026-10-10 zfb 4.3.0 resume](2026-10-10-zfb-4.3.0-resume.md); the exact dependency tuple (including the zdtp resolution per consumer) is in [closeout dependencies](2026-10-10-closeout-dependencies.md).

**Release verdict (then): BLOCKED (pending the closeout gates).** [Readiness checklist](release-readiness.md). Existing root PR [#4477](https://github.com/zudolab/zudo-doc/pull/4477) remains draft. Former upstream blockers are resolved: #4059, #4060 and #4109 are closed, and the strict published #4097 consumer passes 3/3 on the published 4.3.0 packages (hosted run [38030809260](https://github.com/zudolab/zudo-doc/actions/runs/38030809260), head `fd0764f`). The same head passed PR Checks [38030812860](https://github.com/zudolab/zudo-doc/actions/runs/38030812860) 28/28 (475 E2E), generator slow 24/24, package slow/packed 133/133 and built bookmarks (30 targets / 12 routes). The required A2 gate passes; the historical byte diagnostic deliberately keeps its inequality (seven native build IDs plus the islands filename), which is reviewed and not a product failure.

Remaining gates (all still unverified, tracked under #4475 / #4476 / #4501):

- Visual 06R: paired-pixel review of the 47 aggregate `nav`/`sidebarTree` height differences (measurements, not proven regressions).
- Installed three-package acceptance: packed history-server, zudo-doc and create-zudo-doc, scaffolded outside the workspace (barebone and all-feature), with real browser hydration and interaction.
- macOS Japanese IME and other manual/platform checks (Takazudo/zudo-front-builder#3330); cannot run on the Linux host.
- #4476 cleanup of `_temp-resource/4430-zfb3-migration/` (only after full acceptance PASS), including relocating lasting fixtures.
- Relocated evidence (#4508, copy-only): see [closeout evidence](2026-10-10-closeout-evidence.md), [A2 summary](2026-10-10-a2-comparison-summary.md) and [probe summaries](2026-10-10-probe-summaries.md); `release-readiness.md` here is canonical.
- Final-head gates: exact-head required checks, review and the #4501 deferred-verification rows.

zdtp stays at 0.8.5 for this closeout; any upgrade is handled elsewhere.

## History — zfb 4.2.0 lead (2026-10-08, superseded)

The text below led this file before 4.3.0 was published. It is preserved as a historical record; #4059/#4060/#4077 are no longer open blockers.

All four published family packages are pinned to **4.2.0**, peers **^4.2.0**. npm and the native binary are verified. [Current 4.2 integration findings](v4.2-integration.md) supersede the historical [4.1 round](v4.1-integration.md).

**Release verdict: BLOCKED.** [Readiness checklist](release-readiness.md). Existing root PR [#4477](https://github.com/zudolab/zudo-doc/pull/4477) remains draft. The accepted upstream #4004 composition migration is implemented and the full site builds (793 pages). Packed identity/token-resolution (#4059/#4060 upstream), standalone browser composition (#4077 upstream), A2 and browser/static parity gates still need resolution/verification; keep #4467/#4475 open and temporary resources intact.

Decision owners: round 1 [#4434](https://github.com/zudolab/zudo-doc/issues/4434), round 2 [#4480](https://github.com/zudolab/zudo-doc/issues/4480); epic [#4430](https://github.com/zudolab/zudo-doc/issues/4430). This permanent gap table implements upstream [#3328](https://github.com/Takazudo/zudo-front-builder/issues/3328). It survives deletion of temporary planning resources. All implementation and route verdicts start **pending**; #4476 copies measured parity verdicts and final released versions here.

Baseline: zudo-doc 5.28.2, `main@337b9f110`, zfb 2.22.1. Round-2 target: all four zfb family packages exactly **3.1.0**, package peer floor **`^3.1.0`**; npm latest rechecked 2026-10-01 (`pnpm view @takazudo/zfb version` → `3.1.0`). Normative `v3.1.0` tag commit: `baac44eac12d300d68fd8742c585567ea24e6aa9`. Prerequisite source inventory: `4026c213d0115bbf533319a2969b615e3758805c`. [Binding conventions](conventions.md) and [upstream status census](upstream-status.md). Before #4476 deletes temporary resources, copy the final conventions and necessary proof summaries into this directory and update these links.

## Column meanings and completion rule

Each topic contains file/symbol rows, per-site rawHtml review, utility dispositions, tests and deliberate differences. `pending` means no port evidence yet; `implemented` means code exists; `verified` requires a named passing check and result; `blocked` names an upstream issue and an owner. A “no direct site” row is a scan result, not a completed trust review. Owners replace broad seeded construct labels with the exact change for that symbol, delete demonstrably irrelevant rows with a reason, and add any newly discovered symbols/sites. Test files are enumerated separately. File paths are inventories, not permission to edit another topic’s files.

A row closes only with: final v3 form, pinned spec section, code/test reference, command and result, rawHtml trust/parser/cleanup review if applicable, and any deliberate DOM/class/behavior difference. “None” must be verified, not assumed. Keep temporary shim rows blocked for release even if unit tests pass. #4475 cannot report release PASS while any zfb shim remains.

The #4437 mechanical codemod leaves **662 TypeScript diagnostics** as the ports' starting line: 642 from `pnpm exec tsc --noEmit -p packages/zudo-doc/tsconfig.json --pretty false` plus 20 from `pnpm exec tsc --noEmit -p tsconfig.json --pretty false` (2026-10-02, zfb 3.1.0). The commands are separate package and host programs; `packages/zudo-doc/virtual-modules.d.ts` was first generated with its package script. The host program may resolve stale v2 package `dist/`, so its 20 diagnostics are a provisional host count, not a source-resolution port verdict. #4467 final-source package, host, pages, E2E and Worker typechecks report **zero diagnostics** after a fresh 3.2.0 workspace build. The four exact integration pins and actual `zfb --version` output are recorded below; final release versions remain #4476's responsibility. Browser hydration/navigation and client-bundle size delta: **pending #4468/#4475**.

## Normative references

Read these from the zfb clone with `git show v3.1.0:research/<file>`. The older handoff and derived cheat-sheet do not override them. Tag and both files were fetched with `gh api` at `ref=v3.1.0`; all linked section headings were checked. SHA-256 of the fetched research files: react `5838e038c86497ab6851a2c5c13e0b1c62634d005cac69c2e00211822f257392`; wind `25f65ee1c2d5193b77e20e50e23ea3e320ad062fee0dea9723d57cd093202fd0`.

| Matrix reference | Pinned normative section |
| --- | --- |
| R-API | [Public API and exports](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md#public-api-and-exports) |
| R-JSX | [JSX descriptions and prop dialect](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md#jsx-descriptions-and-prop-dialect) |
| R-SCOPE | [Reactivity and scopes](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md#reactivity-and-scopes) |
| R-RAW | [Trusted raw HTML and parser contexts](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md#trusted-raw-html-and-parser-contexts) |
| R-HYDRATE | [Hydration, mismatch, and minification](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md#hydration-mismatch-and-minification) |
| R-FORMS | [Forms](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md#forms) |
| R-REGIONS | [Conditional regions and keyed lists](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md#conditional-regions-and-keyed-lists) |
| R-PROPS | [Island boundary and props transport](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md#island-boundary-and-props-transport) |
| R-LIFETIME | [Lifecycle and isolation](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md#lifecycle-and-isolation) |
| W-GRAMMAR | [Grammar and rejection contract](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-wind-v1-spec.md#grammar-and-rejection-contract) |
| W-VARIANTS | [Variants and canonical order](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-wind-v1-spec.md#variants-and-canonical-order) |
| W-TOKENS | [Tokens and configuration](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-wind-v1-spec.md#tokens-and-configuration) |
| W-CASCADE | [Cascade, layers, reset and output](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-wind-v1-spec.md#cascade-layers-reset-and-output) |
| W-CATALOG | [Utility catalog by family and batch](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-wind-v1-spec.md#utility-catalog-by-family-and-batch) |
| W-MANIFEST | [Sources, safelist and package manifests](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-wind-v1-spec.md#sources-safelist-and-package-manifests) |

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
- [#4481: scratch-dir inventory (verified no-op)](round2-scratch-dir.md)

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

## Remaining shims and contract gates

The authoritative round-2 release list follows [#4479 packed evidence](round2-3.1.0.md), merged at `64b6f3bf30fc37a33e9834e18274565955731403`. #4475 starts **BLOCKED** on these unresolved families; this decision does not certify implementation or browser parity.

| Remaining family | Owner / exact surviving workaround or contract check | Release removal/resolution gate |
| --- | --- | --- |
| #3359 standard attrs/elements | #4458 static-head serializer; #4446 imperative popover attr; #4441/#4437 redundant SVG-attr omission; #4461 bounded media shell if required | Published declaration/SSR/client support, remove issue-specific adapters and prove native metadata/accessible/media behavior. Semantically redundant attr omission need not be reversed. |
| #3361 iframe in island | #4453 imperative iframe host, srcdoc/load/height and cleanup; composed by #4464 | Published native iframe support, remove host workaround and prove eager/visible SSR, hydrate, interaction and disposal. |
| #3375 style typing | #4441/#4446/#4452/#4453/#4461 issue-specific CSS-string/property fallbacks for rejected object keys | Published typing/runtime parity or explicit published contract resolution and live-style proof; remove only issue-specific adapters. Explicit CSS units and the locked public string type remain valid permanent practice. |
| #3376 props contract | #4464/#4452/#4459/#4465 strict optional-key construction; unresolved published omission/rejection contract check | Verify a published fix or explicit published contract resolution with own-key-sensitive SSR/hydration evidence. Strict prop construction is permanent, not a shim to delete or count as an automatic survivor failure. |

Actual temporary shim families are #3359, #3361 and #3375; #3376 is a separate unresolved contract gate. All four still need release evidence. Native #3360 lists, #3364 public CSS imports and #3362 unchanged-root preservation replace the obsolete round-1 list/physical-import/blanket-remount shims. Their integration regressions still gate release; if a shim reappears, it is a blocker even for a closed upstream issue. Native #3385 leading-LF behavior also needs real-browser parser confirmation. #3363's absent SDK persist prop is handled by the established ancestor persistence arrangement; no hand-authored root/persist shim is authorized. Other unresolved wind/tooling gaps retain their manifest, authored-CSS, naming and parity checks; they are not silently classified as fixed.

#4467 rechecks newest published 3.x and actual binary, aligns exact pins and peer floors, and repeats changed native-path proofs before adopting a later version. #4475 records a no-shim source/packed-output survivor scan and all contract, browser, Worker and required-check verdicts. A green build with remaining shims or unresolved gates is not PASS. Under DD9, a BLOCKED #4475 prevents both the root merge and #4476 temporary-resource deletion. #4477 merges only after #4475 PASS, #4476 completion and green checks on the final commit; owner publication remains outside this chain.

## #4467 integration update: published zfb 3.2.0

The current integration pins `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm`, and `@takazudo/zfb-adapter-cloudflare` to exact `3.2.0` where used; the package peer floor is `^3.2.0`. `pnpm exec zfb --version` reports `zfb 3.2.0` (embedded esbuild 0.25.12). The 3.1.0 decision and shim inventory above remain historical context. The results below supersede their current-state claims.

| Prior gate | 3.2.0 integration result and proof |
| --- | --- |
| #3359 standard head and media attributes | Native head descriptions render directly in `DocLayout`; the static-head serializer was removed. Native `meta property`, `link as`, `popover`, and `video controls/preload` render in the package's focused SSR and interaction tests. The configured async stylesheet media swap retains its bounded handler validation independently of the removed serializer. |
| #3361 island iframe | `PreviewBase` now SSRs and hydrates a native `<iframe srcdoc>`; the imperative host was removed. Focused preview tests cover eager and visible scheduling, srcdoc, viewport changes, height, and disposal. |
| #3375 style keys | Issue-specific CSS text fallbacks for vendor mask, inset, placement, transform, and site-tree width use native CSS-spelled object styles. Explicit nonzero units remain. Package typecheck and focused style/interaction tests cover these changes. |
| #3376 optional props | Strict own-key-sensitive optional prop construction remains the project contract; the package's existing SSR/hydration tests pass on 3.2.0. |
| Remaining standard ruby gap | Native `<rb>` still throws `ZR_TAG` on 3.2.0. The bounded, escaped, non-executable ruby serializer remains in `home-intro/index.tsx`; [upstream #3642](https://github.com/Takazudo/zudo-front-builder/issues/3642) tracks the remaining release blocker. #4475 cannot claim a no-shim PASS until a published fix and native proof remove it. |

There are no `preact` imports in owned `packages/zudo-doc/src`, root `src`, or `pages` TypeScript/TSX. Root `preact` remains installed for zdtp's opaque bundle and declarations. The package and root `preact-render-to-string` dependencies and the package's dev-only `preact` dependency were removed. Native `onload` serialization uses literal apostrophes in its double-quoted attribute; the browser receives the same handler. Native boolean `controls` renders as a bare attribute. Both intentional byte differences are covered by assertions.

The 3.2.0 Wind CSS command now reports rejected manifest candidates by `manifest zudo-doc[index]` rather than the old parenthesized candidate text. The package manifest generator maps those source indexes back to exact candidates and its negative control still rejects unsupported utilities; it generated 483 accepted candidates. `zfb css --help` exposes no structured diagnostics option for this command. The flagged project Wind audit completed with zero error-severity diagnostics; its 1,513 `auditInfo` lines remain informational source-scan findings, not emitted-CSS proof.

The browser-safe `route-context-payload` now reads `DEFAULT_SETTINGS` from `settings-defaults.ts`. `config.ts` retains the established export, while the source graph test requires zero forbidden runtime imports. This removes the prior `config -> wind -> @takazudo/zfb/config` edge from the browser entry. The package prepack graph check is rerun against fresh declarations and JS below.

Documentation handoff for #4474: the feature field census still belongs in `packages/zudo-doc/src/config.ts`, but default values now live in `packages/zudo-doc/src/settings-defaults.ts` and are re-exported by `config.ts`. Update the root and package feature-change checklists before release so new settings cannot drift between their field JSDoc and the browser-safe defaults record.

Upstream observability follow-up: [zudo-front-builder#3645](https://github.com/Takazudo/zudo-front-builder/issues/3645) tracks the uninstrumented build phase before published timing markers and timing that appears only after a phase completes. It does not claim the long-running local build is an upstream performance defect.

A separate [upstream Wind source-scaling report #3647](https://github.com/Takazudo/zudo-front-builder/issues/3647) has a reduced published-3.2.0 `zfb css` repro: 5,000 class positions in one 428.9 KB source took 8.62 s, while the same source split across five files took 3.34 s. This supports a source-local extraction cost concern. It is not proof that the still-running full-site build is in Wind extraction; no production virtual module was split as a workaround.

[Upstream build-stall report #3648](https://github.com/Takazudo/zudo-front-builder/issues/3648) reduces the integration build problem to one static page with an unused import of the valid `@takazudo/zudo-doc/chrome` entry, `wind: false`, and the released 3.2.0 binary. The CPU-active build reached plugin setup but no subsequent timing marker within a 60-second diagnostic cap. The same public entry imports in Node 24 in about 190 ms; a one-page `route-context` control reached the bundle markers in under a second. Additional static imports of the package's `home-page`, `doc-page-renderer`, and `head-with-defaults` entries behaved similarly to `chrome` under 15-second caps. The internal pre-bundle operation has not been attributed, and the diagnostic caps are not official build verdicts. The full-site parity build, root build, theme fixture, and package slow route builds remain **blocked without a passing verdict**; neither Wind nor dynamic route source text alone reproduced the stall. #4475 must remain BLOCKED both for this build gate and the native ruby gap.

### #4467 command record (published 3.2.0; worktree `topic/zfb3-4467-zfb32`)

| Command or gate | Current result | Provenance / limit |
| --- | --- | --- |
| `pnpm install --ignore-scripts`; normal guarded `pnpm install` | PASS; PASS | Initial dependency pin install; restored normal lifecycle after repairs. |
| Guarded `pnpm build:workspace` | PASS | Final source build after initial Wind diagnostic-parser failure and then two type errors were fixed. Generated 483 accepted Wind candidates and fresh package JS/declarations. |
| `pnpm check`, `pnpm check:pages`, `pnpm check:e2e`, `pnpm check:worker`, package `typecheck` | PASS | Repeated after the defaults leaf and final package rebuild. Zero TypeScript diagnostics. |
| `pnpm test` | PASS | Initial six upgrade-sensitive expectations failed; fixed and reran after all final source edits in 62 seconds (exit 0). Root 1,320 passed / 4 skipped; scaffold 772 passed; package 3,421 passed / 2 skipped; remaining packages 74 and 44 passed. |
| Guarded `pnpm test:unit:slow` | PASS | 76 tests. |
| Package `check:prepack-contract`, `check:package-wind-manifest` | PASS; PASS | Initial prepack failure exposed `route-context-payload -> config -> wind`; final emitted browser graph has 83 runtime specifiers, seven declaration specifiers, zero forbidden. All 136 source utilities covered by Wind manifest. |
| `pnpm exec zfb wind audit --project-root . --fail-on error` | PASS | 1,513 informational diagnostics, zero error severity. |
| Guarded package `test:slow` | NO VERDICT | First run expired at the guard's 1,800-second cap after several CPU-active route builds, `ENV_SUSPECT exit=124`, without an assertion. A later queued diagnostic was intentionally canceled before completion. The route build blocker is tracked upstream as #3648; the three known A2 hash mismatches belong to #4470 only if reached. |
| CI-faithful parity, root site build, six fixture builds | NO VERDICT | Full parity was intentionally canceled after about 23 minutes; timed repeat after about 31 minutes. A real one-file theme fixture was canceled after 139 seconds. The root build in guarded `b4push` step 23 was intentionally canceled after 2 minutes 6 seconds of CPU-active work with the same pre-bundle symptom; steps 1–22 passed and steps 24–34 were not reached, so the suite has no verdict. Five other fixtures were not run after the smallest theme fixture reproduced the blocker. No source exclusions, timeouts, or assertions were weakened. |

The package's public `./image-enlarge` and `./mermaid-enlarge` subpaths still export their SSR fallback helpers through non-client `public.ts` barrels. Their client `index.tsx` entries each expose one callable island target under the 3.2 scanner. `HtmlPreviewWrapper` likewise remains exported from its subpath while its non-client implementation moved to `wrapper.tsx`. The package export map and built Node named-import proof preserve those public imports; #4473 must keep these in the API census.

The command ledger below gives observed exit codes and elapsed wall time where captured. Intentional diagnostic cancellations (`143`) and guard caps (`124`) are **no verdict** for the underlying build, despite the shell's nonzero exit. An initial failure and its repaired rerun are both retained.

| Invocation / stage | Exit | Elapsed | Interpretation |
| --- | ---: | ---: | --- |
| Initial guarded `pnpm build:workspace` | 1 | 9 s | Old Wind diagnostic parser failed under 3.2.0; repaired. |
| Second guarded `pnpm build:workspace` | 2 | 12 s | Two 3.2 type errors surfaced; repaired. |
| Third guarded `pnpm build:workspace` | 0 | 11 s | Passed after type repairs. |
| Final guarded `pnpm build:workspace` | 0 | 32 s | Passed after browser-safe defaults split and package rebuild. |
| Guarded normal `pnpm install` | 0 | 14 s | Lifecycle restored after initial `--ignore-scripts` install. |
| Initial `pnpm test` | 1 | not recorded | Six upgrade-sensitive assertions failed; fixed before full rerun. |
| Final-source `pnpm test` | 0 | 62 s | Root, package and scaffold default suites passed; counts above. |
| Guarded `pnpm test:unit:slow` | 0 | 30 s | 76 root slow unit tests passed. |
| Guarded package `test:slow`, first run | 124 | 1,800 s | Guard cap, `ENV_SUSPECT`; no test verdict. |
| Guarded package `test:slow`, diagnostic retry | 143 | 35 s | Intentionally canceled to prioritize narrowed build repro; no test verdict. |
| Guarded `bash scripts/parity-build.sh` | 143 | 1,380 s | Intentionally canceled CPU-active build; no parity verdict. |
| Timed guarded parity retry | 143 | 1,885 s | Intentionally canceled after plugin setup and no next timing marker; no parity verdict. |
| Timed guarded theme fixture | 143 | 139 s | Intentionally canceled CPU-active build; no fixture verdict. |
| Guarded b4push | 143 | step 23 build: 126 s | Steps 1–22 passed; step 23 root build intentionally canceled on #3648, steps 24–34 not reached; no suite verdict. |
| Published 3.2.0 one-page `chrome` import repro | 124 | 60 s | Diagnostic cap after plugin setup, CPU-active; upstream #3648. |

## Published 4.2.1 integration checkpoint (2026-10-09)

The [4.2.1 evidence table](v4.2.1-integration.md) supersedes historical live blocker/version claims above. Integration at `2926b1da` passes complete b4push (33 automated checks; manual smoke unverified), 3,488 package units, 127/130 package slow tests (only the three explicitly deferred A2 hashes fail), all 454 hosted browser tests, 793-page generated/CI-faithful builds, strict Wind audit, Worker proof, and current scratch/factory controls. No Preact imports remain in owned package/root/pages TypeScript or TSX; the root peer remains for zdtp. #4468 onward and DD9 remain unfinished; no final parity, aggregate hosted CI, merge or release PASS is claimed.
