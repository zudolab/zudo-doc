# Locked zfb 3 migration conventions — #4434, round 2 #4480

Round-2 decision: 2026-10-01, #4480, superseding the 2026-09-30 #4434 lock where stated below. Implementation target: zfb **3.1.0**, npm latest rechecked with `pnpm view @takazudo/zfb version` (output `3.1.0`). Normative `v3.1.0` tag commit: `baac44eac12d300d68fd8742c585567ea24e6aa9`. Baseline: zudo-doc 5.28.2 at `337b9f110`, zfb 2.22.1. This is a decision record, not a claim that ports or visual parity have passed.

Read the [permanent matrix](../../docs/findings/4430-zfb3-migration/README.md), [spike report](spike/spike-report.md), [repros](spike/repros/README.md), and [upstream status](../../docs/findings/4430-zfb3-migration/upstream-status.md). The normative references are the pinned [react contract](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-react-v1-contract.md) and [wind specification](https://github.com/Takazudo/zudo-front-builder/blob/v3.1.0/research/3242-zudo-wind-v1-spec.md). They override the derived cheat-sheet and older handoff. The [packed 3.1.0 report](spike/round2-3.1.0.md) from #4479 is the round-2 evidence, merged at `64b6f3bf30fc37a33e9834e18274565955731403`. Its runtime probes are not integrated browser parity. Recheck before integration and release; a closed issue alone is not a released fix. Historical 3.0.0 issue text and spike records remain evidence of round 1, not the active target; substantive unchanged port instructions continue under this lock.

## Worktree setup

Install with `pnpm install --ignore-scripts`. Until #4467, the complete package need not build: use the #4438 source-resolution lane below. Do not use stale v2 `dist/` to certify a v3 port. Keep exact zfb-family pins aligned (root/dev/scaffold 3.1.0, package peer floor `^3.1.0`); #4467 owns the final recheck and re-pin. `preact` remains installed only for zdtp 0.8.5's opaque bundle and declarations; transitional old test dependencies are removed by #4467. No aliases from React/Preact to zudo-react.

### Worktree setup during the red window

The red window begins when #4436 lands and lasts until #4467 restores the integration floor. During it, `@takazudo/zudo-doc` may fail its `prepare` build because ports are still in progress. Every worktree must use `pnpm install --ignore-scripts`; a pre-existing `packages/zudo-doc/dist/` may contain v2 output and is never evidence of a v3 build. Use the #4438 source-resolution test lane and its port-check helper for owned source. Rebuild a workspace package only when a check needs its generated JS, keep that output local, and report package-build diagnostics as expected migration-window failures until #4467.

## Runtime, lifecycle and types

| v2 construct | Locked v3 form | Rationale / rejected alternative | PR review target |
| --- | --- | --- | --- |
| `useState` | `signal(initial)` per component setup; immutable replacement for objects/arrays; `batch` related writes | Component setup runs once; mutating an array in place does not notify | Two consecutive updates, not only initial state |
| `useMemo` | `computed(() => …)` for live derivations; plain calculation for immutable props | `.value` in JSX is a snapshot; pass signal/computed itself for live scalar bindings | DOM updates after dependencies change |
| `useCallback`, `memo` | Ordinary closure; remove memo wrappers | Setup already has stable closures; no React render loop | Handlers read current signal values |
| `useEffect(..., [])` or effects depending only on immutable props | Synchronous `scope.onActivate(() => { …; return cleanup; })` | DOM refs exist here; setup and SSR must not touch window/storage/location | SSR→hydrate agrees; disposal removes resources |
| Effects depending on mutable state | `scope.effect(() => { const current = state.value; …; return cleanup; })` registered during setup | Tracks signal reads, reruns after DOM commit, cleans before rerun | Repeated changes and cleanup count |
| Custom hooks | Plain setup functions taking `(scope, signals/options)`; acquire `getScope()` only in component/region setup | No hooks, detached scopes or getScope after await | Helper call is setup-only; listener lifetime follows scope |
| `useRef<T>(null)` | `const ref: Ref<T> = { current: null }` | Assigned before activation, cleared on disposal; no ref factory is exported | No pre-activation access; callback ref replaced with Ref |
| `ComponentChildren`, `ReactNode` | `Child` from `@takazudo/zfb/zudo-react` | Children include scalars/arrays; Description alone is too narrow | Public slots accept legal Child shapes |
| `VNode` | `Description` for actual inert nodes; `Child` for component return/slot | No unbranded `{ type, props }` objects or manual function-component walkers | Use `h`, `isDescription`, `flattenChildren`, SSR DOM tests |
| `FunctionComponent`, `ComponentType` | `Component<P>` from core | Plain synchronous component contract | No async components |
| `JSX.*` | `import type { JSX } from '@takazudo/zfb/zudo-react/jsx-runtime'`; `JSX.IntrinsicElements['button']` etc. | JSX namespace is not a core export; no `JSX.HTMLAttributes`/Preact DOM aliases | Intrinsic props use exact element; explicit custom props use own interface |
| Styles | CSS-spelled keys and explicit nonzero length units; CSS string when #3375 rejects an object key | No implicit px; no `as any` escape for vendor/inset keys | SSR plus a live style update, computed sizes |

`onActivate` must not be async. Start async work inside it, attach rejection handling, check `scope.abortSignal.aborted` after every await before side effects, and pass the signal to fetch. Dynamic imports cannot be cancelled; guard their resolution. For a rerunning effect also use a per-run cancellation flag/controller, because root abort alone does not cancel an obsolete run. Register cleanup during setup or return it synchronously from the activation/effect callback. Do not register scope callbacks after an await.

## Events and forms

Intrinsic listeners become native `on:click`, `on:input`, `on:change`, `on:keydown`, etc. Preserve component callback prop names (`onClose`, `onClick` on a custom component) unless explicitly listed below. Preact `onChange` was native **change**, not React's synthetic input event. No blanket conversion to input. String `onload` bootstrap attributes remain strings where needed by static markup.

Lock the **local narrowing convention** for #3391: handlers passed to `on:*` accept `Event`; narrow inside with `const keyboard = event as KeyboardEvent` or `const input = event.currentTarget as HTMLInputElement`. Read currentTarget synchronously, before awaiting. Do not assert a narrow function as `Listener<Event>` and do not introduce a shared helper API for this migration. Retain Escape/Enter `isComposing` and `defaultPrevented` guards; #4451 adds the missing IME submission guard.

| Control | Model | Event / restrictions |
| --- | --- | --- |
| text/search/email/url/tel/password input | `modelValue={Signal<string>}` | Native input, composition-aware adapter |
| textarea | `modelValue={Signal<string>}` | Native input; no children or rawHtml |
| checkbox | `modelChecked={Signal<boolean>}` | Native change |
| single select | `modelValue={Signal<string>}` | Native change; static intrinsic option/optgroup structure and unique string values |
| radio group | Shared `Signal<string \| null>` via modelValue | Native change; static value and same nonempty name/form/root; unique values |

Models must be writable signals, never computed/readonly views. Do not combine model and value/defaultValue/checked/defaultChecked (radio's static value is the exception). DOM wins during hydration; fresh mount uses model defaults. No multiple-select, number/range/date/file/contenteditable model or dynamic option children. Keep unsupported controls uncontrolled, with explicit listeners/effects if needed.

#4455 array-derived checkboxes use a **writable boolean per row**, initialized from the canonical features array, plus on:change to update that array immutably from event.currentTarget.checked, without assuming listener ordering. On activation, reconcile each DOM-winning row model into the canonical array before the first synchronization effect runs. A setup effect reconciles external canonical-array changes back to row booleans with equal-write guards; do not create an effect loop. Header-right row enabled checkboxes follow the same rule, overriding the earlier static-checked-only wording: reorder/reset must remain reactive. Text models intentionally update PresetGenerator output on input; record this behavior change. #4449 FindBar also explicitly uses input/modelValue so live search updates while typing, with a test proving change alone is insufficient and IME is respected. Other native onChange handlers remain change unless their matrix records a reason.

## Show, For and table structure

Use `<Show when={computed(() => condition.value)}>{() => …}</Show>` for branch lifetime. Its factory runs only when the boolean changes; it does not rerender when other data changes. Use computed scalar bindings within a retained branch. Use `<For each={items} by={(item) => item.id}>{(item, index) => …}</For>` for live lists; item/index are readonly signals. Retained keys preserve scope and nodes; use computed reads of item.value for fields that can change. No duplicate keys, array indexes as identity for movable rows, or plain JSX key as a remount mechanism.

For deliberate replacement, use a one-item array and a changing revision key **outside** restricted contexts:

```tsx
const snapshots = computed(() => [{ revision: revision.value, rows: rows.value }]);
return <For each={snapshots} by={(snapshot) => snapshot.revision}>
  {(snapshot) => <table><tbody>
    {snapshot.value.rows.map((row) => <tr><td>{row.text}</td></tr>)}
  </tbody></table>}
</For>;
```

The revision must change whenever rows that were read as snapshots change. This replaces table focus/selection; document that cost. `table/thead/tbody/tfoot/tr/colgroup` admit only legal intrinsic structure, including static intrinsic arrays, in **static SSR too**. No Row component, Fragment, Show, For or scalar region directly at those levels. Use explicit tbody. Regions are allowed again inside td/th/caption. #4452 keys DiffViewer by revision pair, then keys the completed table snapshot by data revision when asynchronous diff results arrive; test two results while the visible boolean stays true.

## Raw HTML policy and per-site review

`rawHtml` is exclusively for a trusted string (or readonly string signal in ordinary HTML containers). It is mutually exclusive with children, even an explicitly empty children prop. It is opaque to hydration and owns no child bindings. No SVG rawHtml; Mermaid SVG markup goes inside an HTML div. Never inject nested island wrappers or reserved `zr:1:`/`/zr:1:` protocol comments. Client rawHtml script insertion does not execute scripts.

Parser-context exclusions are binding: script/style require **static-string rawHtml**, reject closing-tag substrings and permit no children/reactive payload/regions (#3390); title is static scalar text; textarea is model-owned; select/optgroup/option have static intrinsic structure and static scalar labels; table structural levels have no regions; template, noscript, xmp, iframe, noembed, noframes and plaintext are rejected inside islands. Raw HTML may contain a parser-sensitive foreign subtree only as opaque content in a valid ordinary container, with caller cleanup. No illegal wrapper placement inside p/table/select/SVG.

Every port fills one row per site in its matrix, including sites introduced by workarounds:

1. Name the exact file, symbol, parent element and payload producer.
2. State trust/escaping: generated highlight/KaTeX, escaped text, sanitized markdown/SVG, or explicitly trusted author/config HTML. Preserve existing sanitization; `rawHtml` does not sanitize.
3. Check exclusivity, valid parser parent, forbidden protocol markers/nested islands and script/style closing-tag guards. JSON script data escapes `<` as `\u003c`.
4. Check SSR/hydration initial equality, whether updates replace a subtree, and resources/listeners that must be disposed.
5. Name the test and required browser parity case; record intentional DOM differences. A mechanical dSIH rename is not a completed review.

## Props, identity and public stability

Island transport accepts finite JSON values, dense arrays and plain records only. Reject functions, signals, descriptions, dates/classes, cycles, getters, symbols, holes, undefined array entries and dangerous keys. Omit optional object members explicitly before constructing the child description; normalize nested nav/config data once and pass that same value to SSR and serialization. Do not use JSON round-trip sanitization or patch only serializeProps. #4464 owns common boundary normalization in `chrome/derive.tsx`; #4452 fixes `doc-history-area/index.tsx`; each route/header owner fixes its own boundaries. Keep custom component prop names stable except the following exhaustive migration changes:

- Intrinsic-compatible content components and shared icons accept `class` instead of `className`; `EnlargeDialogProps.className` becomes `class`. All their call sites move together.
- `ThemePackDialogProps.open` becomes `ReadonlySignal<boolean>` for the client-to-client dialog seam; `ThemePackDialogComponent` becomes `Component<ThemePackDialogProps>`. Such a signal never crosses Island transport.
- The private HtmlPreview `VISIBLE_MOUNT_PROP` is deleted; public loading/height/preview props remain stable.
- The modal helper API below replaces useModalDialog.

ThemeToggle retains `defaultMode`, `respectPrefersColorScheme`, `labels`, `pendingUntilHydrated` and their defaults; SidebarTree renders it directly. Do not rename these to new convenience props.

Only real, named island entry components and erased type exports remain exported by `"use client"` modules. Move callable helpers, constants and child-only components into ordinary modules; import them directly without re-exporting from a client entry. Preserve existing public helper imports through an ordinary non-client facade at the existing public subpath when needed; move the actual island component into its own client entry. Internal callers import helpers directly. Do not silently delete a public helper export. Keep name/displayName identical; redundant displayName pins can be deleted. A component may intentionally have one entry module; re-exports must not create another marker identity. #3384 fails duplicate local helper markers; spike Q1 additionally found silent packed-package last-wins duplicates. Therefore the #4438 check enforces globally unique runtime export marker names across host/package/fixture source scopes, independent of the packed exemption. Test fixtures representing separate applications must be checked as separate roots, not mistaken for one app. Keep tsup name preservation and bundle:false.

## Upstream blocker strategy

Of the seven round-1 blockers, #3360 and #3364 choose **(a), native paths** on packed 3.1.0; #3362 chooses native lifecycle preservation for unchanged nested roots with integrated checks still required. #3359 and #3361 retain **(b), source workarounds**. #3375 retains issue-specific style fallbacks; #3376 retains strict prop construction and an unresolved published-contract check. No production port is certified by this decision. Every temporary shim carries `// workaround for https://github.com/Takazudo/zudo-front-builder/issues/<n>` (CSS uses the equivalent `/* … */`). Every shim is a **release blocker**: #4467/#4475 must recheck upstream, consume the fixed published zfb version, remove the shim, and rerun its proof. A test pass with a shim is interim progress, never release PASS. Strict prop construction and explicit CSS units are permanent contract practices, not removable shims. #3375/#3376 require a verified published fix or explicit published contract resolution before their release gates clear; do not remove sound validation or units to clear a survivor scan. See the [remaining-shim and contract list](../../docs/findings/4430-zfb3-migration/README.md#remaining-shims-and-contract-gates).

| Blocker | Exact owner and chosen source strategy | Rejected alternative / evidence | PR review target and removal gate |
| --- | --- | --- | --- |
| #3359 missing attrs/elements | #4458 `head/doc-head.tsx`, `head/og-tags.tsx`, `head-with-defaults/index.tsx`, `doclayout/doc-layout.tsx`, new `head/serialize-static-head.ts`: assemble the entire static head into one trusted rawHtml payload on head. The bounded serializer preserves original tag/attribute order and values, escaping all text/attributes, supporting existing head-slot pure descriptions and the explicit missing standard head attributes. Keep title escaped, script/style raw payload guarded, router meta/styles and prepaint order intact. No marker attr renaming or global HTML regex substitution. #4441/#4437 omit redundant SVG xmlns/focusable while preserving accessible semantics; #4446 sets popover imperatively; #4453 sets iframe srcdoc property imperatively; #4461 sets required video attributes through a bounded opaque media shell if native SSR rejects them. | #4479 Z01 still fails declarations/SSR for standard attrs. No OGP/preload/integrity/hreflang deletion; a data attribute is not equivalent. Q4's scratch eight-name patch does not fix TS declarations and is not an upstream patch. | Escaping/injection cases; configured metadata and custom head slot; ClientRouter head output; no-JS prepaint; packed page HTML. Remove custom serializer on published #3359 fix and return to native head children. |
| #3360 ol start | #4457 `content/content-ol.tsx`: native `<ol start={start}>` and normal children for default, resumed and nondefault lists. Remove the planned rawHtml serializer and flow wrapper. | #4479 Z02 proves declaration, MDX SSR and hydration agreement on 3.1.0. The round-1 drop-start/opaque-list instructions are void. | Starting-at-3 and resumed MDX, task/ordinary lists, class/attrs and child composition; no extra wrapper, CSS counter or list-specific rawHtml. |
| #3361 iframe islands | #4453 `html-preview-wrapper/preview-base.tsx`: opaque empty host + Ref; synchronously create iframe onActivate, set trusted srcdoc and existing sandbox/allow/title attrs, attach load/auto-height controller, append once and remove/disconnect on cleanup. | #4479 Z03 still rejects direct iframe JSX inside an island; skip-SSR is not an escape. Raw iframe string works but duplicates escaping and gives less explicit resource ownership; Q5 proves imperative ref/load/height. | Eager/visible modes, srcdoc script/CSS, viewport resize, cleanup and actual browser auto-height. Replace with native iframe once fixed; interim eager SSR has reservation instead of iframe. |
| #3362 persisted ancestors | #4442 uses native 3.1.0 nested-root identity/props reconciliation and live-handle preservation; remove unconditional render-remount. Keep the existing host preserve-props policy and safe structure handling as described below. | #4479 Z04 kept the same node and live signal through packed body swap (`1` → `2`, one activation, zero cleanups); this covers unchanged roots. #3363 still supplies no SDK persist option. | Unchanged roots retain scope state; changed props/identity use native render recreation. Abort/structural/preserve-policy tests remain, plus integrated browser navigation and nonzero scroll in #4468/#4475. Any uncovered runtime defect is filed and re-blocks release. |
| #3364 CSS export subpaths | #4440 and #4463 use public `@takazudo/zudo-doc/<name>.css` exports and `@takazudo/zdtp/styles.css`. Package-internal relative imports stay relative. Delete the planned physical `dist/*.css` imports. | #4479 Z06 built a packed consumer with a CSS exports subpath and sibling relative SVG asset; D01 confirms real zdtp CSS. The standalone `zfb css` companion-asset limitation is separate. | Packed generated consumer build must resolve public CSS and relative assets. `./wind.json` stays a public manifest export; use a manifest or a source root outside outDir, never assume #3366 enables dist scanning. |
| #3375 style | #4441 `island-types/index.ts` exports ENLARGE_DIALOG_STYLE as CSS string; #4446 menu, #4452 spinner, #4453 iframe, #4461 mask use explicit px/string styles for rejected object keys | #4479 Z17 still shows TS2353 for inset/cursor and unitless numeric margin. No casts concealing unsupported keys; explicit units remain permanent | Initial/live computed style and property removal. Remove issue-specific workarounds after published parity fix; explicit units stay. |
| #3376 undefined props | #4464 `chrome/derive.tsx`, #4452 `doc-history-area/index.tsx`, #4459 header boundary and #4465 routes explicitly omit undefined record keys before creating descriptions; recursively normalize only known plain data | #4479 Z18 still reports ZR_PROPS_UNDEFINED. Serializer-only omission gives different own keys to SSR/client; no unvalidated JSON.stringify round-trip | Own-key-sensitive SSR→hydrate, unchanged source object, nested nav nodes, null retained; invalid arrays/types still rejected. Published resolution must be verified before closing migration blocker. |

Choice (c) is allowed by spike Q4 **only after an actual upstream fix exists**, including declarations and all affected runtime paths, with the tracked patch byte-identical to that fix and package-consumer limitations recorded. It is not the current decision and cannot silently replace the source plan. #4436 installs no patch. The custom head and iframe shims remain temporary and may not become public compatibility APIs. Ordered lists, public CSS imports and unchanged-root native persistence must not acquire new shims. #3385 also uses native leading-LF handling: no manual doubling, stripping or wrapper; retain SSR/hydration and real-browser parser regression checks.

## Persisted chrome and router events

Retain these #4442 exports in `transitions/nested-island-props-refresh.ts`:

```ts
installNestedIslandPropsRefresh(options: {
  document: Document;
  reportError?: (error: unknown) => void;
}): () => void;
ensureNestedIslandPropsRefresh(options?: {
  document: Document;
  reportError?: (error: unknown) => void;
}): void;
disposeNestedIslandPropsRefresh(document: Document): void;
```

Install the idempotent document singleton from the eagerly loaded ClientRouterBootstrap client entry (#4443); lazy SidebarToggle may call ensure again. Keep SSR import harmless. The helper now adapts zudo-doc's existing host policy, not the fixed #3362 lifecycle bug. Do not set `data-zfb-island-remount` for every retained root or reimplement the native identity/props comparison. Unchanged effective identity and exact props retain the same DOM, handle and scope-local state; changed effective identity/props must recreate through native **render**, never hydrate mutated DOM.

Pair only unique persisted ancestor keys and unique descendant names; never rely on the runtime's ordinal fallback for an ambiguous host layout. Preserve the existing live `data-zd-props-preserve` opt-out on an island or ancestor only while component/root kind/transport/protocol/build identity agrees. It must not mask identity changes. The native `data-zfb-transition-persist-props` root switch is a separate contract; do not silently rename or discard the host opt-out.

**Timing correction:** packed 3.1.0 calls `unmountIslands(oldBody, incomingBody)` before the composed `event.swap`. Round 1's post-teardown metadata rewriting is therefore too late to influence native retention. During BEFORE_SWAP, read live state without mutation and prepare only the detached incoming document: preserve the exact old props for the host opt-out with matching identity, or opt the affected incoming ancestor out of persistence when its structure/unique pairing cannot safely be retained. Native teardown and swap then see the effective incoming document. Cancelled preparation must leave all live DOM/handles/props untouched. If a swap callback is still composed, delegate exactly once with original receiver/arguments/return/throw behavior; it must not force remounts or undo native metadata.

Normal header/footer/aside structure retains its ancestor DOM. Added/removed roots, ambiguous names/keys, changed chrome structure, or scheduling metadata (`data-when`/`data-media`) not safely handled by native reconciliation use the bounded incoming-ancestor replacement policy; test disposal, incoming roots, and metadata removal. This is deliberate structure refresh, not permission to reset an unchanged subtree. #4442 must exercise the packed runtime through the #4438 harness, including changed identity/props, preserve policy, normal/skip-SSR scheduling, delayed imports and abort/delegate errors. If native behavior fails a required case, record and file it under Rule 6 and keep release BLOCKED rather than silently restore the blanket shim.

#4458 applies this policy to aside#desktop-sidebar; #4459 keeps header/footer persist keys. Sidebar scroll restoration runs after native swap/recreation as appropriate. #4468/#4475 prove a mutated unchanged island retains its live state through real same-document navigation, with one activation/no cleanup, plus changed-props refresh, nonzero scroll and focus. #4479's happy-dom runtime probe does not discharge these browser gates.

#4443 removes inner-button data-zfb-transition-persist from DesktopSidebarToggle and DesktopTocToggle. The runtime owns their complete roots; localStorage plus prepaint and onActivate reconciles visible state without transplanting an owned button. Keep `ClientRouterBootstrap` and its side-effect import `@takazudo/zfb-runtime/client-router`: Q2 proves ClientRouter in a package layout alone does not activate navigation. Sidebar with nodes=[] returns null without an island wrapper.

Use `transitions/page-events.ts` constants and transition helpers for zfb:before-preparation, zfb:before-swap, zfb:after-swap and zfb:page-load. Page-load means initial plus completed navigation; after-swap alone does not initialize the first page. Register/remove listeners with activation cleanup or the explicit document singleton; no duplicate global listeners after navigation. Re-sync scripts are static rawHtml and idempotent. Q6 did not prove callback timing, so #4442/#4458/#4468 must verify ordering in a browser.

## Remaining per-island decisions

| Topic / file | Locked behavior | Rejected alternative / review target |
| --- | --- | --- |
| #4446 `theme-toggle/index.tsx`, `theme/theme-toggle.tsx`, `theme/index.ts` | In-place menu retains native manual popover top layer. A child menu component under Show owns Ref and synchronous onActivate that sets `popover="manual"`, calls showPopover, installs cleanup; positioning is computed CSS string with px. Keep focus return, outside click, scroll/resize and preference icons reactive. | No createPortal, detached DOM renderer or clipped ordinary fixed menu. Parent effect must not expect a late Show ref to be reactive. Test open-close-open and narrow viewport. |
| #4447 `sidebar-tree-island/index.tsx` and parts | SSR props seed current slug; location/storage reads move to onActivate. For keyed by slug; computed labels/classes; Show for root alternatives; ThemeToggle props unchanged. | No browser-dependent initial tree; verify expanded storage state after hydration and cross-section navigation. |
| #4448 switcher/dialog/card | Fetch abortSignal; For for packs; dialog open signal stays within one root; modal helper below; root custom properties continue panel/theme updates. | No signal through Island transport; card callbacks remain custom props. Test close during fetch and theme-pack computed values. |
| #4452 DocHistory | Selection-keyed DiffViewer plus revision-keyed complete table; fetched data and diff import guarded after await; overflow effect restores old body style. | Show(true) and JSX key cannot refresh the table. Test two successive revision changes. |
| #4453 HtmlPreview | Imperative iframe host as above; native visible skip-SSR scheduling replaces private IO gate; highlighted code uses reactive rawHtml guarded after lazy import. | No unsupported iframe JSX or duplicate visibility gate; report any composition seam to #4464. |
| #4455 PresetGenerator | Per-field signals/models; array checkbox rule above; keyed header-right lists with index computed disabled states; modal helper and timer cleanup; remove displayName pin in pages/lib/_preset-generator.tsx. | Do not model a computed boolean or freeze checked snapshots across reset/reorder. |
| #4456 bootstrap files | Both bootstrap entry components return null; onActivate triggers the existing document-wide bootstrap-once controller; async continuation is disposal guarded before mounting or mutating a document. zdtp owns its opaque Preact subtree and explicit document lifetime. | No Preact nodes returned to owned JSX. Test import resolves after disposed root, duplicate activation, and CSS-var spacing changes. |

## Wind decisions

These are classifications from the pinned normative spec (W/G/R identifiers), not guesses based on Tailwind spellings. #4439 owns the executable explain helper; every matrix token needs a generated or authored disposition.

| Decision | Locked outcome / rationale | Rejected alternative / PR review target |
| --- | --- | --- |
| Reset W19 | owned-v1 plus authored `@layer base` patch in package theme.css: hidden-important rule, fonts including emoji fallback, control background/border-radius/opacity/appearance, placeholder, backdrop/file-selector-button, hr/abbr/small/sub/sup, tap highlight | No claim of identical reset bytes; #4479 confirms the published #3382 reset-difference documentation, not site parity. #4439/#4468 compare computed values and focus on real controls/prose at mobile/desktop. |
| Tokens W16/W17 | `wind.tokens` points to existing authored `var(--…)`; `@theme` blocks become :root with property names retained; drop --color-*:initial. 46 colors, 20 named spacing, 7 sizes-of-font, 2 families, 4 weights, 5 line-heights including none, 4 tracking, radii default/lg, shadow lg, 13 z-index strings, easing in-out | No renamed panel variables or --zw self-references. Q10 proves live spacing chain; check all 51 zdtp cssVar names remain. |
| Spacing unit | Omit spacingUnit; zero/px and named tokens remain, nonzero numeric spacing must be authored or explicit bracket length | No implicit 0.25rem scale that makes previously dead classes start working. |
| Breakpoints W02 | sm=640, lg=1024, xl=1280 px; max variants use strict width < value | No md/2xl or epsilon max; #4435 deletes measured inert 2xl class. Test 639/640, 1023/1024, 1279/1280. |
| Dark W09 | dark:false; existing html data-theme and authored custom-property switching continue | No new dark utilities or theme redesign; test light/dark/system and pack updates. |
| Manifest W26 | producer `zudo-doc`, `./wind.json` export, schemaVersion/specVersion 1, only validated utilities/markers; public specifier in wind.manifests | No broad safelist of ordinary classes or dist source scanning (#3366). #4440 tests manifest and authored coverage. |
| Overrides W27 | `zudoDoc({wind})` top-level passthrough; package defaults in definePreset-owned fragment; omit absent user wind key, preserve explicit false; zfb deep-merges with user winning | No shallow merge or Settings field. Test default, one-color override preserves other tokens, and false disables wind. |
| theme-no-reset.css | Remove in 6.0.0; theme.css no longer contains the Tailwind palette reset it existed to remove | No misleading duplicate alias. #4439 deletes derivation/tests as appropriate; #4440 removes export and snapshot row; #4473 documents import replacement. Wind reset is selected in config. |
| Cascade W18 | Generated unlayered utilities follow authored CSS; retain zd-flow, place reset parity in base. Each overlap gets explicit authored component selector specificity or removal of conflicting utility; prefer component-scoped selectors, no global important escalation | Layers cannot reorder the generated prelude. Group/peer :where lowers specificity. #4435/#4439/#4440/#4468 record winner before/after and test interactive states. |

| Construct | Normative classification and required treatment |
| --- | --- |
| Unnamed group-/peer- states | W03/W04, G05/G06: supported for first,last,open,focus-within,hover,focus,focus-visible,active,disabled; hover capability guarded. Named group/peer and peer-checked unsupported, authored CSS. |
| Transition, duration, ease | Catalog 35–37 supported; transitions other than none establish 150ms/ease. ease-in-out requires configured easing; retain desired existing duration via explicit duration/custom authored tokens if baseline differs. |
| Translate / rotate / outline | Catalog 30–32,38–39 supported with family-specific value/negative rules; no blanket authored rewrite. Scale, transform-string, animation/ring remain unsupported. |
| Color /N and opacity | W10: integer 0–100 color alpha, only color families; named colors explicitly configured. opacity-N is intrinsic 0–100; opacity-[var(--…)] is allowed. No opacity token category exists. |
| Underscore brackets | W12/G12: `_` is a space, escaped underscore is literal, calc plus/minus need spaces. This does not allow underscores in an ordinary authored class (#3365). |
| Shared-root var values | Named tokens disambiguate text/color/size, border width/color, font family/weight. Do not rely on the still-present 3.1.0 border-[var()] misclassification or rejected shadow-[var()]. |
| Authored names | Use existing zd- prefix. Do not create text-/bg-/font- utility-root collisions (#3389); legacy exceptional exact classes need explicit authoredClasses plus matching CSS. Unknown ordinary class is not proof of emitted CSS (#3371). |

## Wind audit gate on 3.1.0

Use `pnpm exec zfb wind audit --project-root . --fail-on error` in #4467 and the #4470 b4push/CI gate. #4479 Z11 measured invalid config → exit 1, error diagnostics → exit 1 with this flag, clean config → exit 0. Without `--fail-on`, error diagnostics still exit 0; `--fail-on warning` also exists but is not this lock's chosen severity policy. Add negative and clean controls for the actual command, and keep required-check manifest/CI parity in sync.

Audit success does not establish emitted CSS coverage: #3366 is only partially fixed, #3367 lacks exclusions/package roots, and #3371 still misses conditional literals. Keep #4440's manifest and authored-class coverage checks, emitted-rule tests, unsupported-utility dispositions and computed-style parity. Do not parse human output as a replacement for the native error exit gate; retain diagnostics as evidence. #3370's source-location/JSON limitations remain.

## zudo-doc 6.0.0 public API change list

#4465 updates types/barrel and #4473 documents this list. #4440 owns package exports. Remove `./safelist.css` and `./theme-no-reset.css`; add `./wind.json`. Keep existing theme/content/features/page-loading/compiled CSS exports. Use the public CSS exports directly on 3.1.0; the round-1 physical dist CSS workaround is void. Keep the `./use-modal-dialog` subpath but remove `useModalDialog`; export `modalDialog` with `ModalDialogOptions` and `ModalDialogResult` from that subpath. Do not introduce a second root barrel export unless one already exists. Remove required Preact peer; zdtp-enabled consumers still install its peer. JSX source in shipped tsconfig.base.json is `@takazudo/zfb/zudo-react` and compatibility path aliases are removed.

```ts
interface ModalDialogOptions {
  isOpen: ReadonlySignal<boolean>;
  onClose: () => void;
  navigateEvent?: string;
  backdropClickClose?: boolean;
  manageFocus?: boolean;
  restoreFocusOnly?: boolean;
  returnFocusRef?: Ref<HTMLElement>;
}
interface ModalDialogResult {
  dialogRef: Ref<HTMLDialogElement>;
  handleBackdropClick: Listener<Event>;
}
function modalDialog(scope: Scope, options: ModalDialogOptions): ModalDialogResult;
```

The helper is setup-only in an ordinary module without use client. The dialog lives for the helper's scope: mount a child component inside Show and call the helper in that child if the dialog is conditional. The open-state effect uses the signal; native close/navigation listeners read its current value. Focus return, restoreFocusOnly, backdrop click and idempotent close semantics remain. All six callers migrate (#4448/#4450/#4451/#4452/#4455). Types `Child`, `Description`, `Component` and `JSX.IntrinsicElements[...]` replace Preact types in `chrome-bindings.ts`, `header/types.ts`, `header/right-items.ts`, `factory-context`, `metainfo/frontmatter-preview.tsx`, and public slots such as BreadcrumbSlotProps.rightSlot. Keep domain type names (FrontmatterCellRenderer, ThemePackDialogComponent); change their definitions, not their names. ENLARGE_DIALOG_STYLE becomes string and EnlargeDialogProps uses class. No additional prop/export renames are authorized by this lock.

## How to verify a port

Run these implemented commands from repository root, supplying your real owned paths:

```sh
node scripts/zfb3-port-check.mjs packages/zudo-doc/src/theme-toggle/index.tsx
ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/theme-toggle/__tests__/theme-toggle-interaction.test.tsx
ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config vitest.config.ts scripts/__tests__/check-client-export-names.test.ts
node scripts/check-client-export-names.mjs
```

Use existing pnpm test scripts after #4467 when package builds work; before then the explicit vitest invocation avoids ensure-workspace-build. Substitute only test paths/config for the owning workspace. No broad suite/build/e2e in a leaf topic. The port helper runs package and host TypeScript projects with exports-map-derived source paths, prints owned diagnostics, fails for them or a compiler/config failure, and reports unrelated diagnostics separately so a filtered count cannot masquerade as full compile success. Generated declaration shims absent during the red window are omitted from its temporary configs; the normal integration check restores their coverage.

Import `packages/zudo-doc/src/__tests__/helpers/zudo-react.ts` by relative path. `renderSsr(node)` uses owned server rendering. `renderIsland(Component, props, { identity, mode?: 'hydrate' | 'mount' })` returns a promise of `{ container, root, handle, diagnostics, dispose }`; identity has component/build and is identical server/client. Default hydrate: connected happy-dom host populated from islandRoot→renderToString before hydration; mount: explicit skipSsr wrapper. Install DOM globals before importing client entry. `flushAll()` drains owned flush work; callers await their own application promises separately. Dispose root and remove host after each test. Structured diagnostics are test failures unless the case deliberately asserts one. The optional `beforeActivate(root)` harness hook permits dirty-control and mismatch probes between server HTML creation and client activation. Required harness tests cover SSR→hydrate, fresh mount, dirty form hydration, interaction, disposal, and fail-closed mismatch without fallback mount.

#4438's export check scans real entry graphs (source and separate fixtures), resolves default/named exports and re-exports, rejects duplicate marker identities and callable helper exports, and preserves an explicit diagnostic for unresolvable forms. Its optional `--root <application-directory>` arguments check custom fixture applications separately; without arguments it scans the host/package source graph plus each fixture app. Include packed-package duplicate evidence from Q1 in the tests. Do not scan generated mirrors/node_modules as independent applications.

Every topic fills its permanent matrix: implementation status, spec anchor, exact test/result, rawHtml trust review and deliberate differences. #4468/#4475 own guarded browser/visual parity: route families, open menus/modals, hover/focus, breakpoints, light/dark, panel variable updates, repeated SPA navigation, mutated persisted islands and nonzero scroll. #4476 copies final route verdicts and upstream release evidence into the permanent matrix before deleting temporary resources.
