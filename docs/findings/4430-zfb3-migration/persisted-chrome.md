# Port the persisted-chrome transition helpers (nested-island refresh with v3 wrapper metadata, remount handling)

Owner: [#4442](https://github.com/zudolab/zudo-doc/issues/4442). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Round-2 locked spec (3.1.0)

Decision [#4480](https://github.com/zudolab/zudo-doc/issues/4480), based on [#4479 packed evidence](../../../_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md). Planned contract only; implementation and browser evidence remain pending. This overrides the named round-1 deviations.

Void the round-1 unconditional `data-zfb-island-remount`, post-teardown metadata copier and accepted loss of unchanged local state. #4479 Z04 proves unchanged nested roots keep a live handle and signal through packed swap. Use native 3.1.0 reconciliation; unchanged effective identity/exact props keep DOM/handle/state, changed props or identity recreate with render. Keep the existing install/ensure/dispose helper signatures and eager document singleton, now limited to the existing zudo-doc host preserve-props policy and safe incoming-structure preparation. This topic remains necessary.

Packed router teardown calls `unmountIslands(oldBody, incomingBody)` before `event.swap`; a post-teardown mutation cannot decide native retention. BEFORE_SWAP may read live state and prepare only the detached incoming document. For live `data-zd-props-preserve` on a root/ancestor, retain old props only when component/root kind/transport/protocol/build agrees. Do not mask changed identity. Pair only unique ancestor keys/names; ambiguous matches, added/removed roots, changed chrome structure or unsupported scheduling-metadata refresh must opt that incoming ancestor out of persistence so the native lifecycle replaces it safely. Never replace a structurally unchanged subtree to evade the same-handle test. Cancelled navigation must leave live DOM/handles untouched; any composed swap delegates exactly once and preserves receiver/args/result/errors.

Test actual packed native lifecycle via the harness: mutated unchanged state (one activation, zero cleanup), changed identity/props, preserve policy, normal/skip-SSR roots, metadata removal, delayed imports, cancellation, duplicate names/keys and incoming structure. No fabricated root-persist API (#3363), hand-authored wrappers or patch. If native required behavior fails, file it and re-block release instead of silently restoring a remount shim. #4468/#4475 still own real-browser navigation, focus and nonzero-scroll proof.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/transitions/index.ts` | `module / template` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `installNestedIslandPropsRefresh` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `ensureNestedIslandPropsRefresh` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `disposeNestedIslandPropsRefresh` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `buildNestedIslandPropsMutationPlan` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `commitMutationPlanAndDelegate` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `collectRefreshableRoots` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `collectUniqueOwnedIslands` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `indexUniquely` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `applyPropsMutation` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `reportRefreshErrors` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `surfaceAsynchronously` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `isDocument` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/nested-island-props-refresh.ts` | `resolveBrowserOptions` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/page-events.ts` | `BEFORE_NAVIGATE_EVENT` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/page-events.ts` | `AFTER_NAVIGATE_EVENT` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/page-events.ts` | `BEFORE_SWAP_EVENT` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/page-events.ts` | `onBeforeNavigate` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/transitions/page-events.ts` | `onAfterNavigate` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned source set | No mapped gap in planning TSV | Confirm generated candidate or matching shipped authored selector; unknown ordinary class is not proof | pending scan confirmation |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/transitions/__tests__/nested-island-props-refresh.test.ts` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
