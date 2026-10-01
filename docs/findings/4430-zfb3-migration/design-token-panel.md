# Port the DesignTokenPanel bootstrap islands and hostpanel fixture

Owner: [#4456](https://github.com/zudolab/zudo-doc/issues/4456). Status: **implemented; owned source and unit checks verified**. Browser parity remains with [#4468/#4475](README.md#required-parity-states-and-release-gates). [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

## File and symbol map

| File / symbol | v2 construct → zfb 3.1 form | Status, spec and evidence |
| --- | --- | --- |
| `design-token-panel-bootstrap.tsx` public subpath | Callable exports in a client entry → plain public facade over the ordinary controller and the one named island entry | Verified R-API/R-SCOPE. Existing `@takazudo/zudo-doc/design-token-panel-bootstrap` path and helper names remain available. The facade has no `use client` directive; `check-client-export-names.mjs` reports no DTP export error. |
| `design-token-panel-bootstrap-controller.ts`: `PanelConfigBuilder`, `DesignTokenPanelBootstrapOrigin` | Preact type dependency → zdtp declaration types only | Verified R-API. The controller imports only `PanelConfig`, `PanelInstanceHandle`, and `LifecycleAdapter` as types; Preact remains the runtime owned by zdtp. |
| `design-token-panel-bootstrap-controller.ts`: `openStateKey`, `readOpenState`, `isEmptyEnvelope`, `hasPersistedPanelState`, `readMode`, `withPackScopedStoragePrefix`, `collectDeclaredTokenNames`, `clearAppliedTokenOverrides` | Existing browser and token logic → ordinary framework-free functions | Verified R-SCOPE/R-RAW. These keep their previous storage prefixes, persistence probes, and token-clear behavior. The spacing token `--spacing-hsp-md` remains in the declared clear set. |
| `design-token-panel-bootstrap-controller.ts`: `bootstrapDesignTokenPanel` | Render-time bootstrap → scope-owned activation controller; pending listeners are removed on abort | Verified R-SCOPE. It checks the scope signal after the lazy import and before continuing. Import resolution after disposal cannot configure zdtp or mutate the document. A failed import remains retryable while its scope is active. |
| `design-token-panel-bootstrap-controller.ts`: `warnLostBootstrapRace`, `runDesignTokenPanelBootstrapOnce` | Render-body module latch → activation-time once controller | Verified R-SCOPE. Duplicate activations share the same winner. If the winning scope is disposed before configuration, its pending claim is released; after configuration, the document-lifetime zdtp controller remains active across navigation. |
| `design-token-panel-bootstrap-island.tsx`: `DesignTokenPanelBootstrap` | Client entry returning `null` → named zudo-react island returning `null`, with synchronous `scope.onActivate` | Verified R-SCOPE/R-HYDRATE. Its `displayName` and island name remain `DesignTokenPanelBootstrap`. The harness test proves SSR is inert and two entries activate the controller once. |
| `routes/_design-token-panel-bootstrap.tsx`: `ConfiguredDesignTokenPanelBootstrap` | Client wrapper calling during render → named null-returning island with synchronous `scope.onActivate` | Verified R-SCOPE/R-HYDRATE. The routes-only virtual builder remains a static import in this entry; it is passed to the same once controller with the activation signal. |
| `zdtp-loader.ts`: `configurePanelIfActive` | Bare zdtp re-export only → guarded zdtp configure boundary | Verified R-SCOPE. The loader returns `null` when the owning signal is aborted and otherwise delegates to `configurePanel`. A focused unit test proves the disposed path makes no configure call. The rest of zdtp remains opaque. |
| `plugins/zdtp-loader.ts` | Stale #3002 workaround note → removed | Verified: the issue closed 2026-09-15. The existing virtual-module stub for builds that omit zdtp remains unchanged. |
| `doc-body-end-islands/design-token-panel-island.tsx`: `createDesignTokenPanelIsland` | Preact child type and script injection → zudo-react `Description`/`JSX` types and static `rawHtml` script | Verified R-JSX/R-RAW. The `Island` still receives the named bootstrap description; no Preact node enters the zudo-react tree. Static script coverage is in `design-token-panel-bootstrap-island.test.tsx`. |
| `e2e/fixtures/hostpanel/src/host-panel/bootstrap-island.tsx`: `HostPanelBootstrap` | Preact `useEffect` and render-time call → scope `onActivate`, native delegated click listener, synchronous cleanup | Verified R-SCOPE. The listener and `data-host-panel-ready` marker share the activation lifetime; `runDesignTokenPanelBootstrapOnce` receives the scope signal. |
| `e2e/fixtures/hostpanel/src/host-panel/media-probe-island.tsx`: `MediaProbe` | Preact state/effect → zudo-react signal plus `onActivate` | Verified R-SCOPE. SSR still emits `data-media-probe="pending"`; activation changes it to `ready`. This removes the fixture's unrelated Preact runtime use. |
| `e2e/fixtures/hostpanel/src/host-panel/trigger.tsx`: `HOST_TOKEN_TRIGGER_ID`, `HostTokenTrigger` | Existing zudo-react trigger markup → retained | Verified R-JSX. Its accessible visible label, id, and class string are unchanged. |
| `e2e/fixtures/hostpanel/src/chrome-bindings.fixture.tsx` and `host-panel/design-token-panel-config.ts` | Existing static island registration and PanelConfig field bindings → retained | Verified R-JSX/R-PROPS by source review and the passing `pnpm check:chrome-bindings-fixture-drift`. CSS variable names and config fields were not renamed or dropped. |

## Raw HTML review

| Site | Payload, parent and trust | Parser, hydration and cleanup review |
| --- | --- | --- |
| `packages/zudo-doc/src/doc-body-end-islands/design-token-panel-island.tsx`, `<script rawHtml={ZDTP_TOGGLE_SHIM_SRC} />` | One source literal containing the package's pre-hydration toggle queue shim; no user, config, or author payload. It is trusted package code. | Static string in a valid `script` element; no `</script` substring, children, reactive content, nested island marker, or reserved protocol comments. SSR emits the shim once; the activation controller calls `__zdtpReadyClicks`, which removes its listener and global callback. The focused SSR test inspects the script payload. No DOM/class difference. |

## Utility and behavior differences

No utility classes, CSS rules, or CSS imports changed. Both bootstrap entry components still render `null` on SSR and client. Their side effect now begins during zudo-react activation after hydration, as required by R-SCOPE; island names and host trigger markup are unchanged. zdtp still self-mounts its own Preact root and uses its existing document-level navigation adapter and `destroy()` lifecycle.

The focused bootstrap test verifies a `--spacing-hsp-md` override changes from the default pack value to the incoming pack value after outgoing-token cleanup. Existing `e2e/theme-pack-zdtp-interplay.spec.ts` covers the real panel interaction; computed-style, open-panel navigation, and route-family parity remain assigned to #4468/#4475 and were not run here.

## Verification

Source-resolution unit tests:

```sh
ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts \
  packages/zudo-doc/src/__tests__/design-token-panel-bootstrap.test.ts \
  packages/zudo-doc/src/__tests__/design-token-panel-latch.test.ts \
  packages/zudo-doc/src/__tests__/design-token-panel-bootstrap-island.test.tsx \
  packages/zudo-doc/src/__tests__/zdtp-loader.test.ts \
  packages/zudo-doc/src/plugins/__tests__/plugins-zdtp-loader.test.ts \
  packages/zudo-doc/src/__tests__/public-api-snapshot.test.ts
```

Result on pinned zfb **3.1.0**: **6 test files passed, 120 tests passed** (2026-10-02).

The #4438 source-resolution port check covered every owned source and test path. The shared `body-end-islands.test.tsx` suite is owned by #4464 and is excluded from this leaf check; its legacy Preact renderer cannot render zfb island descriptions during the migration window, and #4464 owns the scanner identity fixture.

```sh
node scripts/zfb3-port-check.mjs \
  packages/zudo-doc/src/design-token-panel-bootstrap.tsx \
  packages/zudo-doc/src/design-token-panel-bootstrap-controller.ts \
  packages/zudo-doc/src/design-token-panel-bootstrap-island.tsx \
  packages/zudo-doc/src/routes/_design-token-panel-bootstrap.tsx \
  packages/zudo-doc/src/doc-body-end-islands/design-token-panel-island.tsx \
  packages/zudo-doc/src/zdtp-loader.ts \
  packages/zudo-doc/src/plugins/zdtp-loader.ts \
  e2e/fixtures/hostpanel/src/chrome-bindings.fixture.tsx \
  e2e/fixtures/hostpanel/src/config/settings.ts \
  e2e/fixtures/hostpanel/src/host-panel/bootstrap-island.tsx \
  e2e/fixtures/hostpanel/src/host-panel/design-token-panel-config.ts \
  e2e/fixtures/hostpanel/src/host-panel/media-probe-island.tsx \
  e2e/fixtures/hostpanel/src/host-panel/trigger.tsx \
  packages/zudo-doc/src/__tests__/design-token-panel-bootstrap.test.ts \
  packages/zudo-doc/src/__tests__/design-token-panel-bootstrap-island.test.tsx \
  packages/zudo-doc/src/__tests__/design-token-panel-latch.test.ts \
  packages/zudo-doc/src/__tests__/design-token-panel-static-graph.test.ts \
  packages/zudo-doc/src/__tests__/zdtp-loader.test.ts \
  packages/zudo-doc/src/__tests__/plugins-zdtp-loader.test.ts \
  packages/zudo-doc/src/__tests__/public-api-snapshot.test.ts
```

Result: **0 owned diagnostics; 197 unrelated diagnostics** remain for other migration topics. `pnpm check:chrome-bindings-fixture-drift` passed. `node scripts/check-client-export-names.mjs` reports only the three other-topic entries assigned to #4467; no DTP entry is reported.

`design-token-panel-static-graph.test.ts` was included in the source port check but not executed: it bundles the built package export and explicitly requires a fresh `dist/`; the locked leaf scope prohibits a package build, and the migration-window `dist/` may be stale.

No full package build, e2e/Playwright run, or b4push was run, per the locked leaf-topic scope. No CSS physical-import workaround was added; CSS migration remains with #4440/#4463. This port uses #3379's self-mounting-widget pattern; zdtp issue [#1002](https://github.com/Takazudo/zudo-design-token-panel/issues/1002) still tracks its Preact peer/CSS contract.

| Completion field | Result |
| --- | --- |
| Port-check / unit evidence | Verified above: 0 owned port diagnostics; 120 focused tests pass. |
| RawHtml trust review | Verified: one static package-authored script literal; no dynamic payload or closing-script substring. |
| Deliberate DOM/class/behavior differences | Only bootstrap timing moves from render to synchronous activation. The panel remains an opaque zdtp-owned subtree; visible shell, trigger class and island identities are preserved. |
| Upstream issue/shim and removal version | Uses the documented pattern tracked by zfb #3379 and zdtp #1002. No zfb shim was added. Stale closed #3002 comment removed. |
| Browser/visual cases handed to #4468/#4475 | Real spacing computed-style update; open panel through same-document navigation; persisted overrides across pack/mode changes; route-family and hydration console parity. |
| Final commit / reviewer / date | Local commit on `topic/zfb3-4456-dtp-bootstrap`; foreground self-review by Codex recorded at `/tmp/zudo-doc-4430-review-logs/4456.md`; 2026-10-02. |

## Remaining Preact runtime imports after this topic

The hostpanel fixture and DTP wiring files no longer import Preact runtime APIs. The package-level Preact installation remains for zdtp 0.8.5's peer and declaration types; other island ports are tracked by their respective topics.
