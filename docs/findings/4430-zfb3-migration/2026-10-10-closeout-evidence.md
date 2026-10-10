# #4508 lasting evidence relocation (no deletion)

Copy-only relocation ahead of the gated #4476 deletion of `_temp-resource/4430-zfb3-migration/`. The temporary directory is untouched except for a "superseded" note atop its `release-readiness.md`; nothing was moved or deleted.

## Executable fixtures: byte-identical copies

`scripts/migration-4097.mjs` now reads `scripts/migration-4097/fixtures/` instead of `_temp-resource/`. The originals stay in `_temp-resource/`, so the later deletion is a no-op for executables.

- `fixtures/native-published-repro/` is the reproduction source (previously `parity/4.2.1/runtime-controls/persistence-browser/native-published-repro/`): only the inputs the script reads (`src`, `pages`, `public`, `zfb.config.ts`, `tsconfig.json`, `tsconfig.spec.json`, `native-pending.spec.ts.txt`). The old logs, report and drafts in that directory are not copied.
- `fixtures/consumer-pins/` holds `package.json` and `pnpm-lock.yaml` (previously `parity/4.3.0/native-published-repro/`).
- sha256 of each source file matched before and after copy (`sha256sum -c`: zero mismatches).
- `node scripts/migration-4097.mjs prepare <dir outside repo>` run before (old paths) and after (new paths) produced identical trees, including `inputs.json` (`diff -r` clean). `prepare` only copies and hashes files; it does not install, so the hosted `migration-hosted-parity` run on push remains the full proof.

| sha256 | file under `scripts/migration-4097/fixtures/` |
| --- | --- |
| `5e4c9d2d3c87d602c59b0cf1915ab8a8b9e001809f1dcc662d34c684b2333fff` | `consumer-pins/package.json` |
| `ec473bde4f9937a4ba6353e2a73cc3462925018dc04532a55f1ad6f47eca3d52` | `consumer-pins/pnpm-lock.yaml` |
| `88ab6fc10fd4e8a235facb67650588cffaebd98d320ba1ac4431bff890777b1f` | `native-published-repro/native-pending.spec.ts.txt` |
| `8dbec93668d17b89cf37093930b7a5cac62b1f665199787c449ae0267c4f887c` | `native-published-repro/pages/fresh-a.tsx` |
| `ce9ca1be13ac954b15f288a04d656b23444e3733166ca305bfd128efdddd2814` | `native-published-repro/pages/fresh-b.tsx` |
| `b35798e1a54a4d728bfa94d4c2d7d05e2e281424122a291db56bd7400e78c4c7` | `native-published-repro/pages/pending-a.tsx` |
| `5571a63356762486b4a4da39126b69c45bf90b7b907ea1cdce392aa922fac455` | `native-published-repro/pages/pending-b.tsx` |
| `c379e1004f958de51eb374167fcd3ad03ff309ac7b9bc5e67add1a1adb7bdbd2` | `native-published-repro/public/favicon.svg` |
| `ff0f030ae47d7d712002e8909349086d7a948659db9d6539f14437bc6199a6bd` | `native-published-repro/src/counter.tsx` |
| `85c891e5d176cf8518101cf5655c25731d8b6b0728496110a63daa82c8dceed1` | `native-published-repro/src/layout.tsx` |
| `d181da4a61f28e985abd9992801d2a8aacfa8ba1281513826366cead1e10baa9` | `native-published-repro/tsconfig.json` |
| `d36747419d2e01ee056d3111c79a7146a7364aa9c55d41ee376f926484b16420` | `native-published-repro/tsconfig.spec.json` |
| `801a2338d26e54171306f8e49147021030675d36e706a86c98422805b71e4932` | `native-published-repro/zfb.config.ts` |

## Permanent copies in this directory

- `spike/spike-report.md`, `conventions.md`, `v3-contract.md`, `upstream-issues.md`, `round2-3.1.0.md` (from `spike/round2-3.1.0.md`) and `release-readiness.md` (canonical from now on; see the note at its top).
- `parity/` holds the markdown parity verdicts of `parity/4.2` and `parity/4.2.1`. Raw JSON, logs and probe dumps are not copied.
- [2026-10-10-a2-comparison-summary.md](2026-10-10-a2-comparison-summary.md) is the A2 summary, and [2026-10-10-probe-summaries.md](2026-10-10-probe-summaries.md) covers the 4482-search and 4483-heading-ids probes.
- `4483-heading-ids/` holds the three reproduction scripts and their `project-template/`.

## Reference inventory

`git grep -n "_temp-resource/4430"` outside `_temp-resource/`:

- Before: 162 hits in 42 files (`scripts/migration-4097.mjs` and 41 findings pages; mostly `../../../_temp-resource/.../conventions.md` links).
- After: only historical mentions remain, with no link targets and no executable reference. They name raw dumps that are deliberately not preserved (`static-analysis*.json`, `runtime-controls/`, `explain.tsv`, the A2 JSON, probe logs), the README/issue-locks plan text about #4476, and this document.
- `.github/workflows/migration-hosted-parity.yml` has no direct path; it calls `scripts/migration-4097.mjs`, which resolves the new location.
