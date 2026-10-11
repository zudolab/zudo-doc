# A2 re-baseline for #4530 (2026-10-11)

PR #4531 changes `packages/zudo-doc/src/chrome-bindings.ts` (the `mdxExtras` input type, which is types-only), its type test, and the generated `packages/zudo-doc/CHANGELOG.md` entry. It is stacked on #4529, whose reference it updates. Every file in the linked package tree feeds zfb's native `data-zfb-build` token, which the A2 fingerprints keep. Only that token moved. No normalizer changed, and no identity or structural comment was removed.

## Hosted evidence

- [PR Checks 38135609826](https://github.com/zudolab/zudo-doc/actions/runs/38135609826) on `0ab755684`, the final linked-package tree, ran the A2 subset. Result: 3 fingerprint failures. The earlier run 38135118877 on `bd0904915` was taken before the CHANGELOG regeneration. Its token `80c49c110b1e25a0` was likewise the only difference, but it is superseded and was not used.
- Build token `a54515ab068dbd0c` (the #4529 reference, [evidence](../4528-a2-rebaseline/README.md)) → `3edf7c8e7ebc6982`, on every island of the three pages.
- Substituting the previous token into the captured HTML reproduces each #4529 reference hash exactly. See [a2-comparison.json](a2-comparison.json).

| Page | Previous reference | New reference |
| --- | --- | --- |
| `404.html` | `a91a76a3…` | `92770740…` |
| `docs/getting-started/index.html` | `44a0a652…` | `40f8dac2…` |
| `docs/getting-started/coverage/index.html` | `ed235ddb…` | `2f84d1ee…` |

The change is types-only: `ChromeBindingsInput.mdxExtras`, compile-only assertions, and changelog text. It adds no runtime code, so no rendered markup could change, and none did.

If #4529 changes its linked-package tree before merging, this branch must be rebased and re-baselined again from a fresh hosted artifact.
