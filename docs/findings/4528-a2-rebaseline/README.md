# A2 re-baseline for #4528 (2026-10-11)

PR #4529 edits `packages/zudo-doc/CLAUDE.md` (released-state guidance required by #4528). Every file in the linked package tree feeds zfb's native zudo-react build token (`data-zfb-build`), which the A2 fingerprints keep. Only that token moved; the reference now holds the hosted hashes. No normalizer change, and no build identity or structural comment is removed from the comparison.

## Hosted evidence

- [PR Checks 38133503347](https://github.com/zudolab/zudo-doc/actions/runs/38133503347) on `cc1bc7a12` executed the A2 subset (selected by `.github/workflows/pr-checks.yml` and `packages/zudo-doc/CLAUDE.md`). Result: 17 passed, 3 fingerprint failures. The earlier [run 38132620710](https://github.com/zudolab/zudo-doc/actions/runs/38132620710) on `1b112163c` has the same linked-package tree and produced identical hashes.
- Build token `3b5145496e3f6bd2` → `a54515ab068dbd0c` on every island of the three pages (1, 2 and 4 occurrences).
- Substituting the old token back into the captured HTML reproduces each previous reference hash exactly. See [a2-comparison.json](a2-comparison.json).

| Page | Previous reference | New reference |
| --- | --- | --- |
| `404.html` | `24fc470f…` | `a91a76a3…` |
| `docs/getting-started/index.html` | `b1843a4d…` | `44a0a652…` |
| `docs/getting-started/coverage/index.html` | `a5226775…` | `ed235ddb…` |

## Local causal control

The controls ran after a forced `pnpm build:workspace` each time, with `ZUDO_A2_CAPTURE_DIR` outside the package.

- Local tokens differ from hosted tokens for the same tree, and local `main` also fails the hosted references. Local runs therefore serve only as causal controls.
- Local `main` gives token `fcef159a14559664`. The branch gives `63cb41a54a534bfa` on two separate runs, with byte-identical captures.
- Restoring only `packages/zudo-doc/CLAUDE.md` to `main` brings back `fcef159a14559664`. The other branch changes are all outside the linked package and do not affect the token.
- With the token substituted, the branch's normalized HTML equals local `main` byte-for-byte. It also equals the hosted capture.

The dated causal log is recorded here rather than in `route-injection-build.slow.test.ts`. That file is inside the linked package, so editing it would move the token again (see [v4.2.1 gates](../4430-zfb3-migration/v4.2.1-gates.md)). #4527 used the same approach.
