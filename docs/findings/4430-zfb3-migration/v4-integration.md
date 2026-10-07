> Historical 4.0.0 round. See [4.1.0 integration results](v4.1-integration.md) for the active target and residual blocker #3992.

# zfb v4 integration and consolidated PR

Date: 2026-10-07 JST. Epic #4430; integration #4467; root PR #4477.

## Active plan

The owner's v4 request supersedes the older 3.x target. Keep `base/zfb3-migration`
and existing resource paths so historical evidence and issue links remain valid.
All four published zfb family packages now use 4.0.0; library peers use ^4.0.0.
The normative release is `v4.0.0`, commit
`defda240cd8f51a55a7cde14f761934e3d9ef171` in zudo-front-builder.
Historical reproductions keep their original versions.

1. Consolidate #4499's 3.2 integration and #4498's agent export/MCP implementation
   into #4477, preserving both histories and features.
2. Upgrade root/package/scaffold/Cloudflare MCP pins and lockfile together;
   port the incoming SSR tests and preset UI onto zudo-react.
3. Complete #4467 on v4 once upstream #3895 is resolved in a published release.
   Recheck all family pins, then rerun the site and CI-faithful parity builds,
   slow/packed consumer suites, six fixture builds, and Worker runtime proof.
4. Continue #4468/#4469 browser and production-reference parity, then
   #4470–#4474 gates/documentation and #4475 final b4push/release readiness.
   Include agent export and MCP enabled consumers in packed/Worker verification.
5. Complete #4476 cleanup only after #4475 PASS. Root PR stays draft until then;
   publication remains the owner's post-merge step.

## Implemented in this round

- Merge #4499 (`ac3c4bd8`) and #4498 (`db0ea279`) with merge commits, resolving
  config/default settings, preset generator and lockfile conflicts. MCP keeps
  its bundle handling; Wind overrides and browser-safe settings stay intact.
- Pin zfb, runtime, md-wasm and Cloudflare adapter to 4.0.0, including the
  incoming MCP scaffold adapter previously on 2.22.1.
- Remove the home-intro ruby rawHtml workaround: native v4 `rb`/`rp` rendering
  passes the existing escaping tests (upstream #3642).
- Port agent discovery tests from Preact SSR to native SSR and existing island
  identity fixtures; use `Description` in merged renderer tests.
- Recognize v4's supported `flow-root` utility while retaining unknown-utility
  rejection coverage; regenerate package CSS.
- Configure host `wind.sources.ignoreAttributes: ["html"]` for HtmlPreview's
  isolated iframe payloads. Before this, Tailwind CDN examples produced 30
  ZW006 errors across EN/JA pages. Afterward, the strict audit exits 0. No page,
  test directory or ordinary class attribute was excluded.

## Verification

Runtime: Node 22.23.3, npm 10.9.9, pnpm 10.30.3 for final checks. Workspace
package compilation also succeeded before final checks. These are integration
results, not a release-readiness claim.

| Check | Result |
| --- | --- |
| `pnpm build:workspace` | PASS; package JavaScript/declarations and CSS generated |
| `pnpm check`, `check:pages`, `check:e2e`, `check:worker` | PASS; zero type diagnostics |
| zudo-doc, create-zudo-doc and history-server typechecks | PASS |
| `pnpm test:unit` | PASS: 1,335 tests, 4 existing skips |
| zudo-doc package tests | PASS: 3,482 tests / 310 files, 40.91s |
| create-zudo-doc package tests | PASS: 806 tests / 18 files |
| history-server package tests | PASS: 74 tests / 7 files |
| `check:pin-parity` and package prepack contract | PASS |
| `zfb wind audit --project-root . --fail-on error` | PASS: exit 0 after iframe prop exclusion |
| Guarded `pnpm build` | BLOCKED: exit 1 in 6s, upstream #3895 |
| Minimal factory repro / direct-import control | Factory FAIL (exit 1); direct control PASS, 1 page in 0.24s |
| Full b4push, slow/packed builds, browser parity/E2E, Worker runtime | Not completed; resume after build blocker |

The container does not reap orphan processes. Four unchanged process-teardown
tests initially observed zombie PIDs as alive. The final complete package suite
ran unchanged under an external Linux child-subreaper wrapper; all 3,482 passed.
The history-server tests initially hit sandbox `listen EPERM`; rerunning with
local server access passed. Neither test expectations nor timeouts were weakened.

## Upstream blocker and handoff

[Takazudo/zudo-front-builder#3895](https://github.com/Takazudo/zudo-front-builder/issues/3895)
contains the reduced reproduction, exact diagnostic, direct-import control,
and requested static-factory support. The site stops at
`dist/doc-body-end-islands/design-token-panel-island.js:21:7`:

```text
owned island scanner preflight failed
unsupported island registration ... target DesignTokenPanelBootstrap has unsupported initializer
```

The package accepts component dependencies in server-side factories, aliases a
dependency locally, and renders it under `<Island>`. V4 fails closed on that
initializer even when the caller passes a statically imported named client
component. A minimal example is:

```tsx
import { Island } from "@takazudo/zfb";
import { Counter } from "../components/counter"; // named export, "use client"

function createBoundary(deps: { Counter: typeof Counter }) {
  const Target = deps.Counter;
  return function Boundary() {
    return <><Island><Target /></Island></>;
  };
}
const Boundary = createBoundary({ Counter });
export default function Page() {
  return <html><body><Boundary /></body></html>;
}
```

With the same isolated install and `wind: false`, replacing `<Target />` with
`<Counter />` passes. The earlier scanner-stall issue #3648 is closed and was not
reopened: this is a finite unsupported-pattern diagnostic, not the old hang.
Do not hardcode default components in place of injected dependencies or bypass
scanner validation; that would discard supported zudo-doc customization.
The owner will handle upstream work in another session. After consuming its
published fix, rerun the full site graph because this is only its first failure.
