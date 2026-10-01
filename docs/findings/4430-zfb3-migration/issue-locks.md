# Downstream decision locks

The original round-1 instructions below were appended under `## Locked spec (from the decision task)` to downstream issues by #4434. Original issue bodies, dependencies and markers are preserved. Existing SKIP lines were neither added nor removed; no whole topic became unnecessary. The binding rationale and rejected alternatives are in the conventions. Issue acceptance bodies remain responsible for the existing ownership boundaries and checks. Round-2 amendments under affected issue entries are the current instructions and are appended verbatim to GitHub under `## Locked spec (round 2, zfb 3.1.0)`. Unchanged historical pin boilerplate does not override the active shared 3.1.0 conventions.

## [#4435](https://github.com/zudolab/zudo-doc/issues/4435)

In `packages/zudo-doc/src/features.css`, `content.css`, and the exact TSX paths already listed above, preserve supported unnamed group/peer states, transition/translate/rotate/outline families, configured color /N opacity and valid underscore-space brackets. Classify from the pinned normative wind spec, not the cheat-sheet. Keep `ease-in-out` and `leading-none` for #4439's tokens. Use zd- authored names for unsupported families and arbitrary selectors; do not introduce text-/bg-/font- root collisions. Record the utility-after-authored winner and relation-selector specificity changes in `docs/findings/4430-zfb3-migration/css-prep.md`, including interactive computed-style evidence.

## [#4436](https://github.com/zudolab/zudo-doc/issues/4436)

In root `package.json`, `packages/zudo-doc/package.json`, `pnpm-lock.yaml` and scaffold pin lines, use exact published 3.0.0 pins (recheck latest before execution; report any advance) and peer floors `^<root pin>`. No pnpm patch is currently mandated: the spike patch is not an upstream fix. In `packages/zudo-doc/tsconfig.base.json`, use `jsxImportSource: "@takazudo/zfb/zudo-react"`; delete React→Preact paths from the owned tsconfigs. In `src/config.ts`, expose `wind?: WindConfig | false` as a shell passthrough, not a Settings field: package wind defaults live in a definePreset-owned fragment, and a supplied user wind lives at top level, omitted when absent. Let zfb deep-merge; test default, partial color override retaining other defaults, and false. Remove framework/tailwind. Stub `src/wind/index.ts` without pretending CSS is complete. Temporary source shims belong to their leaf owners; release requires published resolutions and shim removal.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the round-1 exact `3.0.0`/`^3.0.0` pin instructions. Pin `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` and `@takazudo/zfb-adapter-cloudflare` exactly to `3.1.0` wherever owned (root, package dev dependencies, scaffold and fixture pins); peer floors are `^3.1.0`. npm latest was rechecked as 3.1.0 on 2026-10-01. Recheck before execution; report a newer 3.x and revalidate affected contracts before aligning every pin/peer, never silently use mixed versions. Pin parity, published/freshness checks and actual binary version remain required. Keep the existing owned JSX/config wind passthrough and zdtp-only Preact work. No pnpm patch is selected. Cutover stays behind verified #4435 and this #4480 lock.

## [#4437](https://github.com/zudolab/zudo-doc/issues/4437)

In `scripts/zfb3-codemods/` and mechanically owned sources, import Child/Description/Component from core and JSX from `@takazudo/zfb/zudo-react/jsx-runtime`. Component return/slot types use Child, actual nodes use Description. Intrinsic `className`→`class`; custom props remain stable except shared icons, content intrinsic wrappers and EnlargeDialogProps explicitly listed in conventions. Intrinsic handlers accept Event with local currentTarget/KeyboardEvent narrowing. Native onChange remains on:change; only #4449/#4455 intentionally choose input models. Preserve custom callback names such as onClose/onClick. Convert script/style children only when they are static-string rawHtml; flag dynamic payloads/parser-sensitive sites for their owners, do not claim the mechanical rename completes rawHtml review. ThemeToggle's four props remain unchanged. Record starting diagnostics and remaining imports in the permanent matrices.

## [#4438](https://github.com/zudolab/zudo-doc/issues/4438)

Implement `packages/zudo-doc/src/__tests__/helpers/zudo-react.ts` with renderSsr, async renderIsland(Component, props, {identity, mode?: 'hydrate'|'mount'}) returning {container, root, handle, diagnostics, dispose}, and flushAll. Hydrate is default; mount uses skipSsr wrapper; connected host, matching identity, DOM globals before client import, explicit diagnostic collection and cleanup. Cover dirty controls, disposal and fail-closed mismatch. `ZFB3_SOURCE_RESOLVE=1` enables exports-map-derived aliases in root/package Vitest configs. Exact commands: `node scripts/zfb3-port-check.mjs <paths…>`; `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts <test-paths…>` (root tests use `--config vitest.config.ts`); `node scripts/check-client-export-names.mjs`. The port helper fails owned diagnostics and compiler/config failures, reports unrelated diagnostics separately. Client-export check resolves named/default/re-exports, rejects duplicate marker names plus callable helper exports in client entries, and checks fixture applications separately; packed-package duplicate suppression is not a safe exception (Q1). Test its negative controls; exclude generated mirrors/node_modules. Update conventions only to reconcile actual commands with this locked interface.

## [#4439](https://github.com/zudolab/zudo-doc/issues/4439)

In `packages/zudo-doc/src/wind/index.ts`, lock reset owned-v1, no spacingUnit, dark:false, sm640/lg1024/xl1280, and var(--authored-property) tokens preserving zdtp's 51 cssVar names. Map opacity via intrinsic opacity-N or bracket var; there is no opacity token map. `theme.css` converts @theme blocks to :root; add the @layer base parity patch (hidden, fonts/emoji, controls, placeholder/backdrop/file-selector-button, hr/abbr/small/sub/sup, tap highlight) and keep native focus visibility. Delete theme-no-reset derivation from `scripts/theme-css-variants.mjs`/`copy-theme-css.mjs`/`check-theme-css.mjs`; #4440 removes its export. Update owned tests and gen-z-index output to :root. The leading wind layers cannot be reordered by later authored layer declarations; use local selector specificity or remove conflicting utility, recording baseline/winner evidence. `scripts/zfb3-parity/explain-candidates.mjs` must classify supported states/transforms/outline and bracket grammar from the spec, not blanket-rewrite them.

## [#4440](https://github.com/zudolab/zudo-doc/issues/4440)

In `packages/zudo-doc/package.json` remove `./safelist.css` AND `./theme-no-reset.css`, add `./wind.json`. Generator `scripts/gen-wind-manifest.mjs` emits schemaVersion=1/specVersion=1/producer='zudo-doc', valid complete utilities/markers only; consumer manifest specifier stays `@takazudo/zudo-doc/wind.json`. Update public-api-snapshot/compatibility export expectations and relevant API.md CSS rows for both removals. `src/compiled.entry.css`, `scripts/gen-compiled-css.mjs` and `src/styles/global.css` contain no Tailwind directives; temporary authored CSS imports use `@takazudo/zudo-doc/dist/<name>.css` and `@takazudo/zdtp/dist/zdtp.css`, with #3364 workaround comments. Relative package imports stay relative. Rename all safelist gates together; do not trust audit exit 0 as validation (#3369). Validate actual emitted rules and authored-class coverage, including conditional literals and utility-root collisions. Physical CSS imports are release blockers: restore public subpaths after a published upstream resolver fix. Do not run an unguarded full package build in this leaf topic; request manager verification for committed compiled.css production if needed.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the round-1 physical CSS imports and #3364 workaround comments: use public `@takazudo/zudo-doc/<name>.css` exports and `@takazudo/zdtp/styles.css`; package-internal relative imports remain relative. #4479 Z06/D01 prove the public resolution from a packed consumer, including a sibling relative asset for the CSS producer. Cover public imports/relative assets in the integration packed build. Do not treat standalone `zfb css` companion-asset behavior as proven by `zfb build`.

Void the claim that audit cannot gate: use `pnpm exec zfb wind audit --project-root . --fail-on error`; error diagnostics and invalid config exit 1, clean config exits 0 (Z11). Keep emitted-rule/authored-class coverage and the manifest pipeline: #3371 conditional literals still vanish, #3367 source exclusions remain missing, and #3366 now diagnoses excluded `dist/**` rather than making it usable. Use the public wind manifest or sources outside outDir. Export removals/additions and the safelist-gate rename stay as locked; #4470 adds the audit required-check wiring.

## [#4441](https://github.com/zudolab/zudo-doc/issues/4441)

In `packages/zudo-doc/src/use-modal-dialog/index.ts`, remove use client and useModalDialog, export setup-only `modalDialog(scope, options)` plus ModalDialogOptions/ModalDialogResult. Options: isOpen:ReadonlySignal<boolean>, onClose, navigateEvent?, backdropClickClose?, manageFocus?, restoreFocusOnly?, returnFocusRef?:Ref<HTMLElement>; result dialogRef:Ref<HTMLDialogElement>, handleBackdropClick:Listener<Event>. Dialog must live for helper scope; a conditional dialog gets a child component owning the helper. Effect synchronizes open; activation listeners read current signal and clean up. In `island-types/index.ts`, ENLARGE_DIALOG_STYLE is a CSS string and EnlargeDialogProps uses class. Shared `icons/index.tsx` accepts class; remove redundant xmlns/focusable, preserve aria semantics and CSS SVG spellings. `hydration-pending.ts` and tree-nav helpers become ordinary scope/signal modules, never exported callable helpers from use-client modules. #3375 style-string shim is annotated; explicit px remains permanent.

## [#4442](https://github.com/zudolab/zudo-doc/issues/4442)

Implement the exact existing installNestedIslandPropsRefresh/ensureNestedIslandPropsRefresh/disposeNestedIslandPropsRefresh API in `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts`, with {document,reportError?}. Keep BEFORE_SWAP read-only planning and writable swap composition, exactly-once delegation/cancellation semantics. At commit after teardown, copy hydrate/skip-SSR marker kind, data-when/media, transport/protocol/build and exact data-props (remove absent attrs), then set remount on every paired retained descendant even when props did not change. Unique ancestor key + unique island name, never ordinal. Preserve-props only applies with identical identity; still remount. Reconcile removed/new descendants from incoming DOM; ambiguous matches or changed chrome structure replace affected ancestor at commit rather than retain stale roots. Retain ancestor DOM only on the safe matched path. No hand-authored islandRoot/persist wrapper or pnpm patch. Update page-events.ts conventions. Unit tests cover abort, unchanged mutated DOM, changed identity/props, skip-SSR, delayed imports, duplicate names, removal/addition, preserve props and delegate throws. Guarded browser validation is requested from manager/#4468. Temporary remount loses local scope state, so #3362 remains a release blocker until published fix preserves live handles.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the round-1 unconditional `data-zfb-island-remount`, post-teardown metadata copier and accepted loss of unchanged local state. #4479 Z04 proves unchanged nested roots keep a live handle and signal through packed swap. Use native 3.1.0 reconciliation; unchanged effective identity/exact props keep DOM/handle/state, changed props or identity recreate with render. Keep the existing install/ensure/dispose helper signatures and eager document singleton, now limited to the existing zudo-doc host preserve-props policy and safe incoming-structure preparation. This topic remains necessary.

Packed router teardown calls `unmountIslands(oldBody, incomingBody)` before `event.swap`; a post-teardown mutation cannot decide native retention. BEFORE_SWAP may read live state and prepare only the detached incoming document. For live `data-zd-props-preserve` on a root/ancestor, retain old props only when component/root kind/transport/protocol/build agrees. Do not mask changed identity. Pair only unique ancestor keys/names; ambiguous matches, added/removed roots, changed chrome structure or unsupported scheduling-metadata refresh must opt that incoming ancestor out of persistence so the native lifecycle replaces it safely. Never replace a structurally unchanged subtree to evade the same-handle test. Cancelled navigation must leave live DOM/handles untouched; any composed swap delegates exactly once and preserves receiver/args/result/errors.

Test actual packed native lifecycle via the harness: mutated unchanged state (one activation, zero cleanup), changed identity/props, preserve policy, normal/skip-SSR roots, metadata removal, delayed imports, cancellation, duplicate names/keys and incoming structure. No fabricated root-persist API (#3363), hand-authored wrappers or patch. If native required behavior fails, file it and re-block release instead of silently restoring a remount shim. #4468/#4475 still own real-browser navigation, focus and nonzero-scroll proof.

## [#4443](https://github.com/zudolab/zudo-doc/issues/4443)

In desktop-sidebar-toggle-island/index.tsx and desktop-toc-toggle-island/index.tsx, delete inner-button data-zfb-transition-persist; storage/prepaint/onActivate restores visibility, and Show renders chevrons. Move storage readers/constants/DOM helpers to ordinary sibling modules and update imports/tests so use-client entries export only island components/types. Preserve any existing public helper exports through an ordinary non-client index facade at the same public subpath, moving the actual island into a client entry. Keep `src/components/client-router-bootstrap.tsx` and its static side-effect import `@takazudo/zfb-runtime/client-router` (spike Q2). It installs #4442's document singleton eagerly and safely before navigation; lazy drawer ensure remains idempotent. Sidebar with nodes=[] returns null without Island. Preserve component prop names and existing load gates; no invented public root persistence API.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void use of #4442 as an unconditional remount controller. Keep ClientRouterBootstrap and `@takazudo/zfb-runtime/client-router`; its eager singleton installs the simplified round-2 incoming-document/host-policy adapter. Storage/prepaint/activation, removal of inner-button persist, ordinary helper modules and empty Sidebar behavior remain required because #3363/#3384 are not fixed. Tests distinguish native preservation of a root retained by an ancestor from fresh mount of a replaced root; no new SDK persist prop or reset of unchanged state.

## [#4444](https://github.com/zudolab/zudo-doc/issues/4444)

In `packages/zudo-doc/src/toc/toc.tsx` and `toc/use-active-heading.ts`, replace hook with a plain setup helper taking scope and signal inputs, without adding client-entry helper exports. Acquire scope synchronously, install observers/scroll listeners in onActivate and dispose them. Derived active classes use computed/readonly signals rather than .value snapshots. Keep static initial heading from SSR; browser location/scroll reconciliation happens onActivate. Follow pinned group/peer/translate support; do not undo #4435 calc fixes. Use #4438 harness for use-active-heading and TOC tests and fill toc.md.

## [#4445](https://github.com/zudolab/zudo-doc/issues/4445)

In `packages/zudo-doc/src/site-tree-nav-island/index.tsx` and its parts, seed state from serializable SSR props; storage/location work runs onActivate. Key For rows by stable slug and keep live item fields in computed bindings. Child-only components/helpers belong in ordinary modules. Keep #4435's removed inert 2xl utility and calc fixes; classify remaining utilities from W-CATALOG. Fill site-tree-nav.md with per-label rawHtml trust and navigation/cleanup tests through #4438.

## [#4446](https://github.com/zudolab/zudo-doc/issues/4446)

In `theme-toggle/index.tsx`, `theme/theme-toggle.tsx`, `theme/index.ts`, replace portal with an in-place Show-owned menu component using native manual popover. Child menu owns Ref/onActivate, sets popover='manual' imperatively (#3359 comment), opens it and cleans listeners/top-layer state; do not expect a parent effect to track Ref assignment. Position via computed CSS string with explicit px (#3375). Preserve exact ThemeToggleProps names/defaults: defaultMode, respectPrefersColorScheme, labels, pendingUntilHydrated (SidebarTree renders bare). No createPortal or detached renderer. Test repeated open/close, focus return, outside click, Escape/IME, scroll/resize and disposal. Imperative popover workaround is a release blocker until released attr support allows native declarative markup.

## [#4447](https://github.com/zudolab/zudo-doc/issues/4447)

In `sidebar-tree-island/index.tsx` and owned parts, initial currentSlug comes from SSR props; deriveActiveSlug(location) and storage open-set reads run onActivate. For by slug, computed item text/classes and Show root alternatives. Review all six smart-break rawHtml label sites individually. Keep ThemeToggle's defaultMode/respectPrefersColorScheme/labels/pendingUntilHydrated props unchanged. `sidebar-scroll-preserve.ts` must coordinate restoration after #4442 remount; request browser nonzero-scroll/cross-section proof. Remove memo and callable helper exports from use-client entries. Fill sidebar-tree.md; no snapshot loosening.

## [#4448](https://github.com/zudolab/zudo-doc/issues/4448)

In `theme-pack-switcher/index.tsx`, `theme-pack-dialog/index.tsx`, `theme-pack-dialog/theme-pack-card.tsx`, use abort-guarded fetch and keyed For; pass open as ReadonlySignal<boolean> within the same island. ThemePackDialogProps.open changes accordingly; ThemePackDialogComponent is Component<ThemePackDialogProps>. Never serialize this signal through Island. Use `modalDialog(scope, {isOpen, ...})` from unchanged use-modal-dialog subpath, with child-owned scope if dialog is under Show. Preserve custom onClick callback prop on ThemePackCard; its intrinsic button listener is on:click Event narrowed locally. Keep var-backed pack/panel token flow. Test dialog close during fetch and external pack updates; report exported type changes to #4465.

## [#4449](https://github.com/zudolab/zudo-doc/issues/4449)

In `find-in-page/find-bar.tsx` explicitly choose modelValue with writable text signal/native input for live find-as-you-type. This is a deliberate change from native Preact onChange; test typing before blur/change plus composition handling. `find-in-page/index.tsx` owns activation and Tauri listener cleanup; two Show branches must react via boolean computeds, not snapshots. Escape ignores composition/defaultPrevented. Put FindBar and helpers in ordinary modules unless a real island boundary needs their named export. Fill find-in-page.md with event behavior difference.

## [#4450](https://github.com/zudolab/zudo-doc/issues/4450)

In `image-enlarge/index.tsx` and `mermaid-enlarge/index.tsx`, call `modalDialog(getScope(), ...)` during setup with writable open signal (ReadonlySignal accepted by helper), preserving focus/restoreFocusOnly/backdrop/navigation options. Conditional dialogs own their helper in a child scope. Use ENLARGE_DIALOG_STYLE CSS string and shared icon class props. Mermaid raw SVG goes in ordinary HTML div.rawHtml, never SVG.rawHtml; review sanitizer/trust and observer cleanup. Activation observers/listeners and effect-based overflow own synchronous cleanup; async work checks abortSignal. Fill enlarge-dialogs.md and harness tests.

## [#4451](https://github.com/zudolab/zudo-doc/issues/4451)

In `ai-chat-modal/index.tsx`, use modalDialog(scope, {isOpen,...}) and lifecycle rules; immutable message arrays with keyed For and computed busy/disabled states. Guard Enter/submit during composition and defaultPrevented. Function listener props accept Event and narrow locally. Review rendered-markdown rawHtml trust/sanitization; never place owned nodes inside opaque payload. Abort stale/disposed requests and clean focus/scroll effects. Fill ai-chat.md and test two replies, disposal and IME.

## [#4452](https://github.com/zudolab/zudo-doc/issues/4452)

In `doc-history/index.tsx`, replace plain key remount with one-item For outside table keyed by older/newer revision pair; completed async diff data must drive another changing table snapshot key when needed. Map intrinsic tr/td rows inside a complete table factory with explicit tbody; no Row/For/Show/component directly in tbody/tr. Show alone does not update while true. Guard fetch and lazy diff import after every await; per-run abort/cancel for superseded work. Use modalDialog(scope, ...) and explicit px spinner/overflow cleanup. `doc-history-area/index.tsx` omits locale when undefined before creating child description; no serializer-only cleanup. Test two consecutive selections while visible, stale result/disposal, parsed table structure and default-locale transport.

## [#4453](https://github.com/zudolab/zudo-doc/issues/4453)

In `html-preview-wrapper/preview-base.tsx`, implement imperative iframe in an opaque ordinary HTML host with Ref: create onActivate, set trusted srcdoc/property and unchanged sandbox/allow/title policy, attach load/auto-height, append once, cleanup iframe/controller/listeners. No direct iframe JSX (including skip-SSR), no raw iframe string. Eager SSR renders the reservation host; record that interim DOM difference and release blocker #3361. Remove VISIBLE_MOUNT_PROP/IO visibility gate in html-preview-wrapper.tsx; native scheduling applies. HighlightedCode uses guarded async import and reactive rawHtml on ordinary HTML. Static viewport buttons have computed class/aria, explicit px heights. Keep all public props. Add smoke tests for host creation, load/height lifecycle and cleanup; #4454 owns full test migration. Replace imperative shim with native iframe when published fix passes browser proof.

## [#4454](https://github.com/zudolab/zudo-doc/issues/4454)

In `html-preview-wrapper/__tests__/` migrate all 12 test files to #4438 source-resolution/harness. Assert #4453's temporary opaque reservation host, imperative iframe startup/load/cleanup and native visible skip-SSR scheduling; delete expectations tied solely to private VISIBLE_MOUNT_PROP/IO gate. Preserve srcdoc/viewport/height behavior assertions. Test import resolves after disposal and rawHtml highlight updates. Actual iframe document/load/auto-height and visible scheduling need manager browser verification, not a happy-dom claim. Fill html-preview-tests.md and record shim removal gate.

## [#4455](https://github.com/zudolab/zudo-doc/issues/4455)

In `src/components/preset-generator.tsx`, use per-field writable models and computed output/error; text updates on input intentionally. Array-derived feature checkboxes get one writable boolean per stable row, on:change immutable canonical-array update reading currentTarget.checked (no listener-order assumption), activation reconciliation of DOM-winning models into canonical state before effects, and effect-based external reset reconciliation with equal-write guards; never model computed booleans. Header-right row checkboxes follow the same reactive rule, overriding static-checked-only wording above. For keys kind:name, computed index disables moves. PresetModal under Show owns modalDialog in its child scope; timers and clipboard continuations are disposal guarded. `pages/lib/_preset-generator.tsx` removes redundant displayName. Test programmatic reset, reorder/remove/reinsert, radio group and two successive output changes. Preserve public props.

## [#4456](https://github.com/zudolab/zudo-doc/issues/4456)

In `design-token-panel-bootstrap.tsx` and `routes/_design-token-panel-bootstrap.tsx`, both named entries return null; synchronous onActivate invokes existing bootstrap-once controller. `zdtp-loader.ts` and bootstrap async continuations check disposal before mounting/mutating DOM; document-lifetime opaque zdtp controller retains its explicit once/cleanup semantics across navigation. `doc-body-end-islands/design-token-panel-island.tsx` script is guarded static rawHtml. Hostpanel fixture uses scope activation and preserves field bindings. Callable bootstrap helpers move out of use-client entry modules. Keep preact solely as zdtp peer; CSS physical import workaround belongs to #4440/#4463. Test delayed-import-after-dispose, duplicate bootstrap and variable-backed spacing update. No Preact nodes enter zudo-react render trees.

## [#4457](https://github.com/zudolab/zudo-doc/issues/4457)

In `content/*.tsx`, accept class and owned JSX.IntrinsicElements types; content-code reads class language. In `content/content-ol.tsx`, override the earlier instruction to drop start: nondefault finite-integer start must remain in an actual ol emitted as trusted whole-list rawHtml on a display:contents flow wrapper. Owned static SSR serializes children, escape/validate attrs, reject nested islands in this opaque temporary path; normal start-at-1 stays JSX. Annotate #3360 and mark release blocked until native fixed renderer replaces it. In `mdx-components/index.ts` use h/flattenChildren, and in code-syntax/tabs.tsx use a fresh description through h with copied props/key, not mutation. home-intro/prepare.ts replaces unsupported th align with equivalent CSS text-align, never loses alignment. Audit KaTeX/smart-break rawHtml; script/style static rawHtml only. Test starting/resumed MDX lists, task lists/tables, leading LF and opaque-site trust. Fill content-mdx.md.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the earlier prohibition on forwarding `start` and the round-1 rawHtml `<ol>` serializer/display-contents wrapper. `ContentOl` uses native `<ol start={start}>` and normal children. #4479 Z02 proves declarations, actual MDX SSR and hydration at 3.1.0. Test start-at-3, resumed/default/task lists, class/attribute forwarding and child composition without extra wrappers or CSS counters.

Use native `<pre>` leading-LF protection (#4479 Z25); do not manually double/strip LF or add an opaque pre workaround. Keep precise SSR/hydrate text tests and hand real-browser parser/code-copy checks to #4468/#4475; the happy-dom probe simulated HTML-parser LF removal. Other typography/rawHtml trust reviews remain; #3359 is still unresolved for any relevant native attrs. Table restrictions remain the published contract despite corrected #3377 documentation.

## [#4458](https://github.com/zudolab/zudo-doc/issues/4458)

In `head/doc-head.tsx`, `head/og-tags.tsx`, `head-with-defaults/index.tsx`, `doclayout/doc-layout.tsx` implement temporary full-head rawHtml serialization using new owned `head/serialize-static-head.ts`. Preserve OGP meta property, preload as, integrity, hreflang and configured values/order; never omit them or use data attrs. Bounded DOM-free serializer handles existing pure head descriptions and escaped text/attrs, guarded static script/style payloads; no global string/regex replacement or generalized compatibility renderer. Keep escaped title, no-JS/prepaint ordering and ClientRouter meta/styles. Test configured/custom head slots and malicious delimiter text, parsed head validity and full-page/packed output. Annotate #3359; release blocked until published native attr support removes serializer. Apply #4442 helper to aside#desktop-sidebar with full wrapper metadata, mutation only at swap commit; retain prepaint scripts as static rawHtml and re-sync via page-event constants. No hand-written island root persistence. Record nonzero-scroll and callback-order browser proof requests.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void applying #4442's round-1 post-teardown metadata rewrite/unconditional remount to aside#desktop-sidebar. Use its round-2 native lifecycle and incoming-document policy; retain unchanged SidebarTree handle/state, refresh changed props safely, and preserve actual nonzero scroll. Test callback ordering and request the browser proof. Keep existing ancestor persistence and avoid fabricated root wrappers.

The #3359 full-head serializer remains a tracked release-blocking source workaround; 3.1.0 still rejects standard attrs in declarations/SSR. Preserve its escaping, head-slot, ClientRouter and no-JS/prepaint tests. The fixed list/CSS/persistence defects do not justify deleting this head workaround.

## [#4459](https://github.com/zudolab/zudo-doc/issues/4459)

In `header/header.tsx`, footer wrappers and header-with-defaults, retain existing ancestor persist keys and apply #4442 exact helper semantics to header/footer; no custom persisted islandRoot. Omit undefined boundary props before constructing descriptions. ThemeToggle prop names remain stable. search-widget/index.tsx uses spellcheck='false' and static SEARCH_WIDGET_SCRIPT rawHtml; review custom header item.html and script trust sites. Keep nav runtime class literals scannable and run both generated-script drift checks. `i18n-version/language-switcher.tsx` uses static options/model or native change (never For inside select). Typed event handlers accept Event then narrow; helper modules have no use-client marker. Verify nav/properties on consecutive SPA hops and fill header-footer.md.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void inherited #4442 unconditional remount/post-teardown metadata semantics. Existing header/footer persist keys use native unchanged-root preservation and the round-2 host preserve-props/incoming-structure policy. Consecutive SPA tests cover unchanged live state and changed nav props; callback ordering, focus and scroll remain browser gates. Keep strict prop construction as permanent practice and the unresolved #3376 contract check. Preserve search/nav script drift and trust checks; the still-open #3359 attr gap is not resolved by #3362.

## [#4460](https://github.com/zudolab/zudo-doc/issues/4460)

In `nav-indexing/**`, `category-nav/**`, `category-tree-nav/**`, `site-tree-nav/**`, `note-tray-index/**`, `versions-page/**`, `tag-pages/**`, replace VNode walkers with owned SSR and parsed DOM assertions. Keep static intrinsic rows with explicit tbody; no component rows even for static rendering. Child/Description/Component imports follow conventions; class spellings preserve #4435 prep. Fill server-navigation.md including every factory symbol and any trusted label rawHtml site. Dynamic widgets composed here receive normalized JSON props, not signal/callback transport.

## [#4461](https://github.com/zudolab/zudo-doc/issues/4461)

In `home-page/index.tsx`, use CSS string for vendor mask and explicit units (#3375). In `asset-page/components.tsx` and media rendering, override the earlier drop-preload suggestion: preserve video preload semantics; if #3359 rejects native attrs, use a bounded trusted opaque media shell with escaped attrs in an ordinary valid HTML host, record added wrapper and release blocker, and remove it on published fix. `scripts/site-schema-graph.mjs` and `check-asset-viewer-exports.mjs` allow only the required public zudo-react subpaths, not the rest of zfb or Preact. Preserve asset/page variants and raw content trust review in asset-home-pages.md; browser media parity is manager-owned.

## [#4462](https://github.com/zudolab/zudo-doc/issues/4462)

In `sidebar-toggle-island/index.tsx`, install/ensure #4442 singleton idempotently; eager bootstrap already installs it. Preserve body overflow cleanup, Escape defaultPrevented/isComposing and focus return; signal open and child scopes for conditional content. Nested SidebarTree receives stable props and signals only inside this root, never nested Island wrappers. Test cross-section refreshed tree and same-locale navigation with expanded DOM; record #3362 remount local-state limitation and request nonzero-scroll/browser proof. Do not hand-author persisted roots or reinstate inner-button persist.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the round-1 accepted #3362 remount/local-state reset limitation. Use #4442's simplified singleton idempotently, preserving body-overflow cleanup, Escape IME/defaultPrevented guards and focus return. Mutated unchanged nested state survives same-document navigation through native preservation; changed effective page props refresh through native recreation. Test cross-section tree refresh and same-locale expanded state, and hand nonzero-scroll/focus/browser proof to #4468/#4475. No nested Island wrappers or inner-button persistence.

## [#4463](https://github.com/zudolab/zudo-doc/issues/4463)

In `packages/create-zudo-doc/templates/base/tsconfig.json`, remove Preact aliases and inherit owned JSX source. `templates/base/src/styles/global.css` has no Tailwind/safelist/@source/@theme; use :root overrides and temporary physical package CSS imports with #3364 comments. `src/features/design-token-panel.ts` emits @takazudo/zdtp/dist/zdtp.css temporarily; `src/scaffold.ts` adds preact only for enabled designTokenPanel, removes preact-render-to-string and old rationale. Public documented CSS import remains exported subpath after fix; physical paths block release. Update src/claude-md-gen.ts, README generation, skill template and tests to zudo-react/wind. Document removed theme-no-reset/safelist imports and wind reset/config override. Run focused generator tests/drift; packed all-features proof belongs to #4475 after shims are removed.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void temporary physical package/zdtp CSS imports, #3364 comments and the claim that public imports await a future fix. Generated global.css uses public `@takazudo/zudo-doc/<name>.css` exports; the DesignTokenPanel feature emits `@takazudo/zdtp/styles.css`. #4479 Z06/D01 proves packed-consumer resolution on 3.1.0. Generated zfb family pins follow #4436's exact 3.1.0 lock and peer compatibility floor; keep zdtp's Preact peer because its packaging is still partial. Preserve owned JSX, manifest and removed safelist/theme-no-reset changes. Test template/emitter strings and request the packed generated-consumer build with relative CSS assets plus hydration/interaction from #4475.

## [#4464](https://github.com/zudolab/zudo-doc/issues/4464)

In `chrome/derive.tsx` and every owned Island factory, normalize optional known plain-record data once before creating child descriptions and use the same value for SSR and transport. Reject invalid arrays/runtime values rather than JSON-roundtrip dropping them. HtmlPreviewBound keeps public props and removes only private VISIBLE_MOUNT_PROP; iframe shim remains #4453-owned. `doc-body-end-islands/index.tsx` uses ENLARGE_DIALOG_STYLE string/class and strict props. `metainfo/frontmatter-preview.tsx` keeps FrontmatterCellRenderer name but returns Child/uses Component types. No nested islands or Preact casts. Update own fixtures, full-doc SSR test, wrapper metadata/own-key-sensitive props tests and doc-composition.md.

## [#4465](https://github.com/zudolab/zudo-doc/issues/4465)

In `chrome-bindings.ts`, `header/types.ts`, `header/right-items.ts`, `factory-context/**`, `src/index.ts`, route files and API.md type sections, follow the exhaustive 6.0 API list: Child for slots/returns, Description for actual nodes, Component<P> for callbacks, JSX from jsx-runtime; preserve domain names FrontmatterCellRenderer and ThemePackDialogComponent. The use-modal-dialog subpath keeps its path but exposes modalDialog/ModalDialogOptions/ModalDialogResult (not useModalDialog); ENLARGE_DIALOG_STYLE is string and EnlargeDialogProps.class. Remove no other prop names; ThemeToggle remains stable. CSS exports remove safelist and theme-no-reset, add wind.json (#4440 owns package map). Routes keep client bootstrap and omit undefined serialized props. Add tiny public-type consumer proof and route-family absence/fallback coverage; no fabricated locale/version routes. Fill routes-public-types.md.

## [#4466](https://github.com/zudolab/zudo-doc/issues/4466)

In `pages/**` (excluding _preset-generator), `src/chrome-bindings.tsx`, `src/config/frontmatter-preview-renderers.tsx` and `e2e/browser-embed/main.tsx`, consume Child/Component/Description and jsx-runtime JSX, owned h/Fragment/server renderToString. Keep ClientRouterBootstrap; normalize Island props before descriptions; preserve public ThemeToggle and HtmlPreview names. Browser embed must use owned server export in Vite and shipped compiled.css generated from wind, with no Preact nodes/aliases. DEPENDENCIES.md notes zdtp-only Preact. Test embed bundle plus host source-resolution and fixture drift; full browser proof goes to manager. Fill showcase-host.md and migration doc note.

## [#4467](https://github.com/zudolab/zudo-doc/issues/4467)

In the integration-owned `package.json`, `pnpm-lock.yaml` and owned dependency/gate files, recheck latest published 3.x and actual binary; keep all family pins aligned. Read every blocker row in conventions and upstream-status.md. A green integration build with temporary source shims is interim only. Do not silently retain #3359 head serializer, #3360 opaque list, #3361 iframe shim, #3362 remount shim or #3364 physical imports for release; consume published fixes then assign/remove shims in owning files and verify native paths. #3375/#3376 may resolve through published contract clarification, but verify and record it. Remove transitional Preact test dependencies once their import census is empty; preserve zdtp's peer. Update permanent README full diagnostic counts.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the old 3.0.0 target and seven-blocker removal list. Start from exact family 3.1.0 / peers ^3.1.0, recheck newest published 3.x and actual binary, and align/revalidate all pins if advanced. #4481 remains a dependency. Already native: #3360 `<ol start>`, #3364 public CSS exports and #3362 unchanged nested-root preservation. Fail regressions or obsolete opaque-list/physical-import/blanket-remount survivors; validate changed-props/structure cases too. Recheck native #3385 LF behavior.

Remaining shim families are #3359 attrs/head, #3361 iframe and #3375 issue-specific style fallbacks; #3376 is an unresolved published-contract gate. Strict prop construction/explicit units are permanent and must not be removed. Read the README remaining-shim table for owners and removal/contract proofs; passing with shims is interim, not release readiness.

Void the audit-output-only workaround. Run `pnpm exec zfb wind audit --project-root . --fail-on error`, retaining diagnostics and emitted/authored coverage. #3366 is partial, #3367/#3371 remain open. Keep the full integration/package/site/generated-doc checks and record real results; a successful flagged audit does not prove all authored candidates or visual parity.

## [#4468](https://github.com/zudolab/zudo-doc/issues/4468)

Use `docs/findings/4430-zfb3-migration/README.md` route-family table and every topic matrix as the parity inventory. Required extra states: Show stays true across two revisions, imperative iframe eager/visible/load/height, manual popover focus/position, array checkbox reset/reorder, prepaint head attrs, actual ol start, mutated nested islands before SPA hop and nonzero sidebar scroll. Compare utility-after-authored cascade winners and group/peer specificity, transition duration, reset controls and token-panel variable changes. Temporary shim differences remain blocked-release findings, never accepted final parity. Copy exact URL/state verdicts for #4476.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void parity expectations that tolerate a list wrapper, physical CSS imports or lost local state from unconditional persistence remount. Verify native start-at-N/resumed MDX lists, public CSS exports with relative assets, and a mutated unchanged nested island retaining node/handle/state across real same-document navigation (one activation/no cleanup). Also verify changed props/identity, host preserve policy, structural replacement, skip-SSR timing, focus and nonzero sidebar scroll. #4479 Z04 used happy-dom and does not satisfy this browser gate. Confirm native `<pre>` leading LF in a real HTML parser and code-copy output (Z25).

Retain head/iframe/manual-popover/live-style cases for the still-open #3359/#3361/#3375 families and own-key-sensitive #3376 contract evidence; successful shim behavior remains blocked for release. Strict props/units, table snapshot remounts, authored CSS and cascade parity remain required contract practices. A newly exposed native runtime gap must be filed and keep #4475 BLOCKED. Preserve all original route/scripted-state/Worker/dev/base-path/full-e2e gates and per-state evidence.

## [#4469](https://github.com/zudolab/zudo-doc/issues/4469)

Apply only measured parity findings in their owning files, recording each result in `docs/findings/4430-zfb3-migration/<topic>.md`. Preserve locked props and supported normative utility families. Source shims for head/list/iframe/persistence/CSS imports cannot become a final accepted difference; remove them after published fixes or keep release BLOCKED. No easing of assertions to accommodate the machine; request manager guarded verification for affected states.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the round-1 plan to wait for list/persistence/CSS-import fixes while preserving their shims. Fix measured native 3.1.0 regressions without reinstating opaque lists, physical CSS imports or blanket remounts; if native behavior requires a new workaround, file it and record a release blocker. Remaining shim work is #3359/#3361/#3375, plus #3376 published-contract verification; retain permanent strict props and explicit units. Correct native LF/list/CSS/persistence parity findings with targeted reruns and the original ownership rules. Keep intentional-fix #4482/#4483 after this parity round.

## [#4470](https://github.com/zudolab/zudo-doc/issues/4470)

In engine-bound export/CSS/compatibility gate files listed above, record removed ./safelist.css and ./theme-no-reset.css plus added ./wind.json; JSX source is owned, use-modal-dialog symbol becomes modalDialog. No success criterion based solely on zfb wind audit exit 0 (#3369). Authored class coverage must prove emitted utility or actual matching shipped authored CSS. TESTING.md documents exact #4438 source-resolution commands and helper interfaces. Rebaseline only with explained runtime/markup differences in permanent topic matrices; unresolved source shims still fail release readiness.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the conditional "add audit only if it can gate" and round-1 output-parsing-only rule. Add the required native error gate `pnpm exec zfb wind audit --project-root . --fail-on error` to b4push/CI with manifest/parity wiring in the owned files. #4479 Z11 proves invalid config/error diagnostics exit 1 and clean config exits 0; add negative and clean command controls. Unflagged audit still exits 0 for errors; warning policy remains separate. Retain authored/emitted candidate coverage for #3366/#3367/#3371 and diagnostic visibility despite #3370. Gate/reference docs target 3.1.0 and ^3.1.0; required native list, CSS exports, persistence and LF regressions remain covered. Other export/API changes and measured A2 rebaseline scope are unchanged; remaining release blockers use the round-2 README list.

## [#4471](https://github.com/zudolab/zudo-doc/issues/4471)

In the owned EN/JA reference pages, document the normative wind choices in conventions: owned-v1 + authored base patch, no spacingUnit, sm/lg/xl pixels, dark:false/custom properties, public wind.json manifest and zudoDoc({wind}) override. Remove theme-no-reset and safelist recommendations. Teach scope/signals, JSX source and strict props; distinguish unchanged-boolean Show from keyed For remount and table structural restrictions. Temporary physical CSS paths/custom serializers are release blockers, not recommended public APIs.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the round-1 implication that public CSS exports still need a future resolver fix. Current EN/JA reference examples use public exports on 3.1.0, native `<ol start>` and native leading-LF handling. Cite the normative research documents at v3.1.0. Teach the flagged audit error gate with its coverage limits; retained-parent lifecycle preserves unchanged nested state and recreates changed effective identity/props. Keep table restrictions, strict props/units, owned-v1 patch and all other wind/runtime choices. Remaining head/iframe/style adaptations are interim release blockers, never recommended consumer compatibility APIs.

## [#4472](https://github.com/zudolab/zudo-doc/issues/4472)

In owned EN/JA guide/getting-started pages, use Child/Component/Description and JSX from jsx-runtime, modelValue/modelChecked only for the five supported adapters, Event handlers with local narrowing, static-string script/style rawHtml and per-site trust review. Document custom hooks as setup helpers receiving scope/signals and async disposal guards. Browser-embedding recipe follows #4466's owned server proof. Keep chronological historical changelogs unchanged; no Preact-returned nodes in current examples.

## [#4473](https://github.com/zudolab/zudo-doc/issues/4473)

The EN/JA 5.x→6.0 guide and `packages/zudo-doc/README.md` must list: remove safelist.css/theme-no-reset.css imports, add manifest-managed wind.json (consumer import usually unnecessary), choose reset in wind, :root overrides, owned jsxImportSource and deleted compatibility aliases, zdtp-only Preact peer, Child/Description/Component/JSX type migration, class prop exceptions, ThemePackDialogProps.open signal, ENLARGE_DIALOG_STYLE string, and use-modal-dialog subpath's useModalDialog→modalDialog(scope, options) with exported option/result interfaces. Preserve other prop/domain names, especially ThemeToggle. Final guide must target published no-shim release; explain native input vs change and parser/rawHtml restrictions. Match #4465 public type proof.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the inherited 3.0.0 compatibility target and any implication that physical CSS imports are the 6.0 migration path. The no-shim consumer guide targets at least 3.1.0 with ^3.1.0 peers (or the later aligned release pin recorded by #4467/#4475) and public CSS exports, including zdtp/styles.css. Explain native ordered-list and unchanged-root persistence behavior; strict prop construction and explicit CSS units remain permanent. Preserve the complete existing 5.x→6.0 API list. Do not claim release readiness while the README remaining-shim/contract gates or browser gates are unresolved.

## [#4474](https://github.com/zudolab/zudo-doc/issues/4474)

In owned CLAUDE.md/README/API/DEPENDENCIES/TESTING/skill-source documentation, synchronize the exact conventions and 6.0 API list, including source-resolution verification, wind manifest, removed theme-no-reset/safelist, owned JSX, zdtp-only Preact and setup-scoped modalDialog. Distinguish interim source workarounds from public release APIs; do not claim temporary physical dist CSS imports are permanent. Preserve historical lesson evidence and append measured v3 limits. Check template counterparts only within owned boundaries.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void stale round-1 current-target/shim guidance in the docs being updated. Current instructions use exact 3.1.0 family / ^3.1.0 peers (or the later verified aligned pin), v3.1.0 normative references, public CSS exports, native ol/LF and unchanged nested-state preservation. Document `zfb wind audit --project-root . --fail-on error` plus authored/emitted coverage limits. Preserve historical lesson evidence and distinguish it from this current lock. Permanent strict props/units remain; interim #3359/#3361/#3375 adapters and #3376 contract verification must match the remaining release list.

## [#4475](https://github.com/zudolab/zudo-doc/issues/4475)

Release readiness is BLOCKED while any #3359/#3360/#3361/#3362/#3364 source shim remains, or #3375/#3376 published contract resolution is unverified. In final report and `docs/findings/4430-zfb3-migration/README.md`, record exact published family versions/actual binary and no-shim survivor scan, packed all-features scaffold head/list/iframe/persistence/CSS proof, Worker proof and route-state visual verdicts. A successful build/unit suite with shims cannot be reported PASS. Consume published fixes, remove shims via owning files and rerun affected native-path proof before release. Guard heavy commands; platform/environment deferrals remain explicit.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the round-1 seven-shim release list. The current remaining temporary shim families are #3359 (head/standard-attr adapters), #3361 (imperative iframe host) and #3375 (issue-specific style fallbacks); #3376 is an additional unresolved published-contract check. Use `README.md#remaining-shims-and-contract-gates` for exact owners and proof requirements. Strict optional-key construction, explicit CSS units and the locked public string-style type are permanent practices, not automatic shim survivors. #3375/#3376 clear only on verified published fix/explicit published contract resolution and affected runtime proof.

#3360 lists, #3364 public CSS imports and #3362 unchanged-root preservation are now native, not waiting on future publication. The no-shim scan must still reject obsolete list wrappers/physical imports/blanket remounts if introduced. Packed scaffold SSR/hydrate/interact and real-browser navigation must prove native list/CSS-relative-assets/LF/persisted-state behavior; #4479's runtime probe is not a browser pass. Newly required source shims re-block release regardless of issue closure. Record exact family/binary/pin freshness, native audit --fail-on error, all required checks, Worker and route-state results.

DD9 is unchanged: any shim, unresolved contract gate or red required check means BLOCKED. BLOCKED prevents root merge and #4476 resource deletion. Root #4477 merges only after this PASS, #4476 completion and green final-commit checks; owner publication remains outside the chain.

## [#4476](https://github.com/zudolab/zudo-doc/issues/4476)

Finalize every `docs/findings/4430-zfb3-migration/*.md` pending row and expand README route-family table with actual captured URLs/states and parity verdicts; record true not-configured/absent families without fabricating routes. Before removing `_temp-resource/4430-zfb3-migration/`, copy final conventions and necessary evidence summaries into permanent findings and update links. `upstream-status.md` gets verified resolution, first published fix version and no-shim proof. Upstream #3328 report names package/binary versions, package/MDX/CSS and hydration/navigation proof, gap-table URL, and remaining blockers honestly. No release-ready statement with shims.

### Locked spec (round 2, zfb 3.1.0)

Decision: #4480, based on #4479 packed-family evidence in `_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md` (merge `64b6f3bf30fc37a33e9834e18274565955731403`). The active target is exact zfb family `3.1.0`, peer floor `^3.1.0`; normative research specs are at `v3.1.0` (`baac44eac12d300d68fd8742c585567ea24e6aa9`). Read the re-locked `conventions.md` and permanent matrix. This section overrides only the round-1 instructions explicitly named below; ownership and all other acceptance checks remain binding.

Void the stale seven-blocker summary. Finalize the matrix and upstream #3328 report against the verified 3.1.0-or-later aligned family/binary, explicitly distinguishing native #3360/#3362/#3364/#3385 proofs from remaining #3359/#3361/#3375 shims and #3376 contract resolution. Include #3366 partial status, audit --fail-on error proof and all actual browser/packed-consumer results without promoting runtime-only probes to visual passes. Preserve permanent strict props/units.

The DD9 dependency gate is binding: if #4475 is BLOCKED, record/report blockers and do not delete `_temp-resource/4430-zfb3-migration/` or claim release readiness. After PASS, copy the final conventions and necessary #4479 evidence summaries into permanent findings, update local links and normative tag/hash references, then remove temporary resources. Keep package publication an owner step and report pre-publication status honestly.

## Round-2 audit of every open sub-issue

Audited 2026-10-01 against complete issue bodies, #4479 evidence and the v3.1.0 research contracts. No whole topic became unnecessary; no SKIP marker is added. Only affected issue bodies receive an appendix. Historical #4434 pin/date sentences in unchanged bodies describe that decision; the active shared conventions target 3.1.0. #4435 and its matrix implementation evidence are untouched.

| Issue | Round-2 disposition |
| --- | --- |
| [#4435](https://github.com/zudolab/zudo-doc/issues/4435) | Unchanged: v2 CSS preparation remains valid; preserve implementation evidence and manager baseline addendum |
| [#4436](https://github.com/zudolab/zudo-doc/issues/4436) | Amended; exact appendix above |
| [#4437](https://github.com/zudolab/zudo-doc/issues/4437) | Unchanged: mechanical dialect/rawHtml rules unchanged; #3390 is a documentation fix |
| [#4438](https://github.com/zudolab/zudo-doc/issues/4438) | Unchanged: harness/export checks still required; #3378/#3384 are not fixed |
| [#4439](https://github.com/zudolab/zudo-doc/issues/4439) | Unchanged: tokens/reset/cascade choices unchanged; #3382 documentation does not establish parity |
| [#4440](https://github.com/zudolab/zudo-doc/issues/4440) | Amended; exact appendix above |
| [#4441](https://github.com/zudolab/zudo-doc/issues/4441) | Unchanged: modal/types/attrs and style fallback still required |
| [#4442](https://github.com/zudolab/zudo-doc/issues/4442) | Amended; exact appendix above |
| [#4443](https://github.com/zudolab/zudo-doc/issues/4443) | Amended; exact appendix above |
| [#4444](https://github.com/zudolab/zudo-doc/issues/4444) | Unchanged: TOC scope/observer port unchanged |
| [#4445](https://github.com/zudolab/zudo-doc/issues/4445) | Unchanged: SiteTreeNav signals/keyed state unchanged |
| [#4446](https://github.com/zudolab/zudo-doc/issues/4446) | Unchanged: #3359 popover and #3375 style fallbacks still required |
| [#4447](https://github.com/zudolab/zudo-doc/issues/4447) | Unchanged: SidebarTree scope/state port unchanged; integration follows updated persistence contract |
| [#4448](https://github.com/zudolab/zudo-doc/issues/4448) | Unchanged: theme models/dialog lifecycle unchanged |
| [#4449](https://github.com/zudolab/zudo-doc/issues/4449) | Unchanged: FindBar input/IME model unchanged |
| [#4450](https://github.com/zudolab/zudo-doc/issues/4450) | Unchanged: enlarge-dialog scope/cleanup unchanged |
| [#4451](https://github.com/zudolab/zudo-doc/issues/4451) | Unchanged: AI-chat port and intentional IME fix unchanged |
| [#4452](https://github.com/zudolab/zudo-doc/issues/4452) | Unchanged: table remount and strict props still required; #3377 fixes docs, not runtime rules |
| [#4453](https://github.com/zudolab/zudo-doc/issues/4453) | Unchanged: #3361 iframe workaround still required |
| [#4454](https://github.com/zudolab/zudo-doc/issues/4454) | Unchanged: HtmlPreview harness migration still required |
| [#4455](https://github.com/zudolab/zudo-doc/issues/4455) | Unchanged: form/checkbox models and keyed rows unchanged |
| [#4456](https://github.com/zudolab/zudo-doc/issues/4456) | Unchanged: opaque zdtp/Preact lifecycle unchanged; CSS spelling owned by #4440/#4463 |
| [#4457](https://github.com/zudolab/zudo-doc/issues/4457) | Amended; exact appendix above |
| [#4458](https://github.com/zudolab/zudo-doc/issues/4458) | Amended; exact appendix above |
| [#4459](https://github.com/zudolab/zudo-doc/issues/4459) | Amended; exact appendix above |
| [#4460](https://github.com/zudolab/zudo-doc/issues/4460) | Unchanged: server navigation/description tests unchanged |
| [#4461](https://github.com/zudolab/zudo-doc/issues/4461) | Unchanged: media/attrs/style requirements remain unresolved |
| [#4462](https://github.com/zudolab/zudo-doc/issues/4462) | Amended; exact appendix above |
| [#4463](https://github.com/zudolab/zudo-doc/issues/4463) | Amended; exact appendix above |
| [#4464](https://github.com/zudolab/zudo-doc/issues/4464) | Unchanged: composition/strict props unchanged; fixed-list behavior remains #4457-owned |
| [#4465](https://github.com/zudolab/zudo-doc/issues/4465) | Unchanged: public API/route changes unchanged; no topic-owned pin/CSS-import workaround |
| [#4466](https://github.com/zudolab/zudo-doc/issues/4466) | Unchanged: host/embed owned runtime port unchanged |
| [#4467](https://github.com/zudolab/zudo-doc/issues/4467) | Amended; exact appendix above |
| [#4468](https://github.com/zudolab/zudo-doc/issues/4468) | Amended; exact appendix above |
| [#4469](https://github.com/zudolab/zudo-doc/issues/4469) | Amended; exact appendix above |
| [#4470](https://github.com/zudolab/zudo-doc/issues/4470) | Amended; exact appendix above |
| [#4471](https://github.com/zudolab/zudo-doc/issues/4471) | Amended; exact appendix above |
| [#4472](https://github.com/zudolab/zudo-doc/issues/4472) | Unchanged: guide scope/models/rawHtml remain valid; active normative tag inherited from index |
| [#4473](https://github.com/zudolab/zudo-doc/issues/4473) | Amended; exact appendix above |
| [#4474](https://github.com/zudolab/zudo-doc/issues/4474) | Amended; exact appendix above |
| [#4475](https://github.com/zudolab/zudo-doc/issues/4475) | Amended; exact appendix above |
| [#4476](https://github.com/zudolab/zudo-doc/issues/4476) | Amended; exact appendix above |
