# zfb 3 migration: implementer resources

This directory holds temporary handoff resources for the **Zfb 3 Migration** epic (zudolab/zudo-doc#4430). They were produced
while planning on 2026-09-30 against `main` @ `337b9f110` (zudo-doc 5.28.2, zfb 2.22.1). The zfb 3.0.0 tools
used were installed in a scratch directory and ran against copies of the sources; nothing in the repo was modified.

**Sub-issue #4476 deletes this directory before the root PR merges.** Do not reference these files from
production code or permanent docs.

## Contents

| Path | What it is | Who uses it |
| --- | --- | --- |
| `v3-contract.md` | Derived zfb v3 cheat-sheet (normative: `research/3242-zudo-wind-v1-spec.md` + `research/3242-zudo-react-v1-contract.md` in zfb at the pinned tag): wind config/tokens/grammar/catalog/cascade/diagnostics/manifests/CLI; zudo-react API, dialect, islands, router; the hooks→zudo-react table; probe results against the published 3.0.0 packages | Every topic |
| `explore/islands-nav.md`, `explore/islands-content.md` | Per-island inventories: hooks, effects, Show/For needs, form controls, raw-HTML sites, blockers, difficulty | Island ports |
| `explore/server-jsx.md` | Server-rendered layer: dialect counts, raw-HTML sites, public API exposure, MDX pipeline, renderer probe | Server ports, public types |
| `explore/css-wind.md` | Tailwind → zudo-wind: directive inventory, token namespaces, utility census, build-breaking and silently-dropped candidates, draft wind config, reset, cascade-flip risk | CSS topics |
| `explore/v3-probe.md` | The released 3.0.0 tools run against zudo-doc: `wind audit`/`explain` census, a tsc error census under zudo-react, an end-to-end scaffold + island build and hydrate | Everyone (measured facts) |
| `explore/pkg-build.md` | Config emission, exports, build scripts, pins inventory, publish contracts, release (lockstep 6.0.0) | Spine, CSS B, generator, gates |
| `explore/tests-ci.md` | Test classes (SSR-string, happy-dom, VNode walkers, hook tests), e2e coverage, CI/b4push impact, parity-tooling assessment, verification strategy | Harness, tests, confirm topics |
| `explore/deps-docs.md` | zdtp strategy (opaque Preact bundle, probe-proven), md-wasm/adapter/worker impact, docs and agent-instruction inventory | DTP topic, docs topics |
| `explore/artifacts/**` | Scanners, probe scripts and raw TSV/JSON outputs referenced by the maps (paths inside the maps point at `<planning-scratch>/explore/...`, which corresponds to `explore/artifacts/...` here) | As needed |
| `lessons-digest.md` | Project lessons distilled for this migration | Everyone |
| `upstream-issues.md` | zfb/zdtp issues filed during planning (label `zudo-doc-v3-dogfood`) | Everyone |
| `spike/` | Written by the spike topic | Decision topic |
| `conventions.md` | Written by the decision topic: **binding** porting conventions | All port topics |
| _(permanent, not here)_ `docs/findings/4430-zfb3-migration/` | The migration matrix / gap table: per-topic files with constructs, rawHtml review, engine exceptions, tests; a page-by-page section. It replaces per-topic ledgers and outlives this directory | Every topic, the migration guide, the dogfood report |
| `parity/` | Parity and behaviour reports from the confirm topics | Final confirm, dogfood report |

Numbers in the maps are measurements: each one comes with the command that produced it. Re-measure before relying
on a number when the tree has moved.
