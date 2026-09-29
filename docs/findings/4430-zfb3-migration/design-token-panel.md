# Port the DesignTokenPanel bootstrap islands and the hostpanel fixture; keep zdtp as an opaque Preact bundle

Owner: [#4456](https://github.com/zudolab/zudo-doc/issues/4456). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `e2e/fixtures/hostpanel/src/chrome-bindings.fixture.tsx` | `loadTagsForLocale` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `e2e/fixtures/hostpanel/src/chrome-bindings.fixture.tsx` | `IslandWrapper` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `e2e/fixtures/hostpanel/src/chrome-bindings.fixture.tsx` | `BodyEndIslandsWithHostPanel` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `e2e/fixtures/hostpanel/src/chrome-bindings.fixture.tsx` | `chromeBindings` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `e2e/fixtures/hostpanel/src/config/settings.ts` | `settings` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `e2e/fixtures/hostpanel/src/host-panel/bootstrap-island.tsx` | `HostPanelBootstrap` | useEffect → activation/effect; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `e2e/fixtures/hostpanel/src/host-panel/design-token-panel-config.ts` | `buildDesignTokenPanelConfig` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `e2e/fixtures/hostpanel/src/host-panel/trigger.tsx` | `HOST_TOKEN_TRIGGER_ID` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `e2e/fixtures/hostpanel/src/host-panel/trigger.tsx` | `HostTokenTrigger` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `PanelConfigBuilder` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `openStateKey` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `readOpenState` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `isEmptyEnvelope` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `hasPersistedPanelState` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `readMode` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `withPackScopedStoragePrefix` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `collectDeclaredTokenNames` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `clearAppliedTokenOverrides` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `bootstrapDesignTokenPanel` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `DesignTokenPanelBootstrapOrigin` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `warnLostBootstrapRace` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `runDesignTokenPanelBootstrapOnce` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/design-token-panel-bootstrap.tsx` | `DesignTokenPanelBootstrap` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end-islands/design-token-panel-island.tsx` | `shim` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end-islands/design-token-panel-island.tsx` | `DesignTokenPanelIslandDeps` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end-islands/design-token-panel-island.tsx` | `createDesignTokenPanelIsland` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/plugins/zdtp-loader.ts` | `ZDTP_LOADER_SPECIFIER` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_design-token-panel-bootstrap.tsx` | `ConfiguredDesignTokenPanelBootstrap` | Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/zdtp-loader.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| `packages/zudo-doc/src/doc-body-end-islands/design-token-panel-island.tsx:50` | `<script dangerouslySetInnerHTML={{ __html: ZDTP_TOGGLE_SHIM_SRC }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned source set | No mapped gap in planning TSV | Confirm generated candidate or matching shipped authored selector; unknown ordinary class is not proof | pending scan confirmation |

## Tests and completion evidence

No colocated test file in the initial selected-source inventory. Use the issue acceptance tests and add a focused test only for the relevant behavior.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
