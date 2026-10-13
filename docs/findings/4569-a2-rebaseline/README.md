# A2 rebaseline for the zfb 4.4.0 adoption (#4569)

PR #4571 moves the zfb family from 4.3.3 to 4.4.0. The A2 build inputs changed, so the
strict fingerprints ran and failed on all three pages. This record justifies the reference
update, following [4559-a2-rebaseline](../4559-a2-rebaseline/README.md).

## Inputs

| Role | Run / artifact | Actual checkout (`sourceHead`) | Manifest SHA-256 |
| --- | --- | --- | --- |
| Baseline | PR #4570 run 38344841627, `a2-route-parity-diagnostics` | `08d2e9f820d4598d8459a297fac9eb918496322b` | `fb2536fd2ff19476e66b6f7ea57c47f936856c4e43bc49c494860298b035cbb9` |
| Candidate | PR #4571 run 38351931310 (job 115146046533), `a2-route-parity-diagnostics` | `2409ecf23d7c46f36464227bce3e6de4e47ab4ba` | `bd927a1bc2e733e6633a06c17b329a5c7196ed7c2f2879191bbaf5254a49efc3` |

Reference source: main `15d9d8d060c8343f12d5d833d4f8a3031ef3913d` (the #4570 merge). The baseline
fingerprints equal the reference being replaced, and `baselineReferenceTreeEqual` is true.

## Causal comparison

`python3 scripts/a2-causal-diff.py` exited **1** (`DIFFERENCES_REQUIRE_REVIEW`, as designed);
full output in [comparison.json](comparison.json).

- All three residual diffs are empty: restoring only the observed identity spans reproduces
  the baseline bytes exactly, so the zfb 4.4.0 engine and runtime produce no rendered-HTML
  difference on these pages.
- The only observed change is the build token `1fe855b4de510ff6` → `71005b38f1dfe2c6`,
  coherent across every native island on every page.
- No stylesheet changed, and source theme-pack version maps are identical.
- The candidate fingerprints equal the values the strict CI assertion received.

Identity remains **OBSERVED_ONLY_UNVERIFIED_FRESHNESS**. Acceptance still requires a fresh PR
run with A2 executed and passing. Normalization and assertions are unchanged.
