# Persisted chrome transition helpers

Owner: [#4442](https://github.com/zudolab/zudo-doc/issues/4442). Status: **source port complete; browser verification pending**. Binding spec: [round-2 persisted chrome convention](../../../_temp-resource/4430-zfb3-migration/conventions.md#persisted-chrome-and-router-events), [#4480](https://github.com/zudolab/zudo-doc/issues/4480), and [#4479 packed probe](../../../_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md) Z04.

## Migration matrix

| v2 construct touched | v3 form and behavior | Status and evidence |
| --- | --- | --- |
| `zfb:before-swap` live-root `data-props` copier and unconditional `data-zfb-island-remount` | Prepare only detached `newDocument` before native 3.1 `unmountIslands(oldBody, incomingBody)`; no live metadata write or blanket remount | Done; packed unchanged-handle and changed-props lifecycle tests |
| `data-zd-props-preserve` on island/root/ancestor | Copy old exact `data-props` to incoming only with matching marker kind, component, transport, protocol and build; remove an absent attribute | Done; header, aside, identity and attribute-removal tests |
| Persisted ancestor pairing by key and nested island name | Require unique keys/names and matching authored element topology; unsafe structure or scheduling changes opt incoming ancestor out of persistence | Done; duplicate, addition/removal, structure and scheduling tests |
| `install`/`ensure`/`dispose` document listener API | Same API, SSR-safe singleton; composed swap delegates once with receiver/args/result/error | Done; cancellation, delegation, singleton tests |
| `page-events.ts` v2-era lifecycle comments | zfb 3.1 event vocabulary and pre-teardown timing | Done; source port check |
| `transitions/index.ts` ejectable barrel | Keeps `ensureNestedIslandPropsRefresh` export; describes native preparation | Done; source port check |

## Raw HTML and visual review

There are no `rawHtml` sites or class/CSS changes in the owned transitions source. The helper writes only detached DOM attributes. Deliberate behavior difference: unchanged nested roots retain their live handle and scope state; changed exact props/identity recreate via native render; unsafe incoming ancestor structure is replaced. These are the 3.1.0 native lifecycle and round-2 policy, not a visual redesign. Real-browser repeated navigation, mutated local state, nonzero scroll, focus and header/aside/footer parity are assigned to #4468/#4475.

## Verification

- `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/transitions/__tests__/nested-island-props-refresh.test.ts`: 10 tests passed, including packed unchanged-state, changed-props, marker-kind, and deferred-mount lifecycle.
- `node scripts/zfb3-port-check.mjs` over every owned source/test file: zero owned diagnostics. Unrelated migration-window diagnostics remain for #4467.
- Upstream [#3362](https://github.com/Takazudo/zudo-front-builder/issues/3362) is fixed for unchanged roots by packed 3.1.0 Z04; [#3363](https://github.com/Takazudo/zudo-front-builder/issues/3363) remains a separate public persist-option gap. No zudo-doc shim or removal version applies.
