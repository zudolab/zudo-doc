# A2 causal review: release 8.1.0

The accepted reference is the one PR #4641 set for ZFB 5.1.2. It was accepted by PR Checks run [40184739989](https://github.com/zudolab/zudo-doc/actions/runs/40184739989) (attempt 1, head `7edd232ce146a29bdfa2537ca3b6d85b6839bb81`, A2 checkout `202b743d0ac3d2e08dbc8d0797826e0041d00cdb`), diagnostics artifact `12595402266` (`sha256:6ac61d352b3937594b45317752a29c0b80655bb4bf29ca8db88a2b8e6abe235a`). Its `manifest.json` hashes equal the reference, and its native build identity is `5bf32a885b3810b8`.

## Candidate capture

The candidate is PR #4642's release commit `26b7d538e0dcc1b10dd3a2ea204ad1ff71cb69f5`. PR Checks run [40188182220](https://github.com/zudolab/zudo-doc/actions/runs/40188182220) (attempt 1) checked out the synthetic merge `6123f7cdc17d342abb4df27ebb3edcb85eb44612` (tree `be867eab45531ffd613077022f8c2311a41d75b5`; parents `cf5b70de8a617558f6026e84de23a1b5a82166e5` = main, `26b7d538` = candidate). Diagnostics artifact `12596726550` (`sha256:f008ecbad841eb01eb3adb3895e429168ac3ced911cfc09b85e32f39c7e9bd26`).

Only the three strict fingerprints failed.

## Comparison

- **Lengths:** in 404, getting-started and coverage order, the raw candidate pages are 57,025, 67,457 and 78,909 bytes, and the normalized pages 57,031, 67,463 and 78,915 bytes — the same as the accepted capture.
- **Build identity:** the pages carry 1, 2 and 4 `data-zfb-build` values respectively. Every one changes from `5bf32a885b3810b8` to `a2ad1458d4c63f14`.
- **Residual:** substituting only those attribute values back to `5bf32a885b3810b8` reproduces the accepted normalized bytes exactly on all three pages. No other byte differs.

## Cause

The release bumps the root, `@takazudo/zudo-doc`, `@takazudo/zudo-doc-history-server` and `create-zudo-doc` versions from 8.0.0 to 8.1.0. The package version is an input to the native build identity; no source, dependency or lockfile change accompanies it.

## New strict hashes

- `404.html`: `da9f45c000bf508543e86c79788b3af7d6655dd679018c92b088320c44a2056f`
- `docs/getting-started/index.html`: `2cfedf2121378fe889a8c751e0de145b5c26bbe4669339a026af53645e4b023a`
- `docs/getting-started/coverage/index.html`: `2e7fc1724426d5573e583537c40aff2629bb41b43b2af0f936c1b3d9bd6cfd5e`

This comparison explains the reference change; it does not certify the PR. A fresh final-head PR run must still execute and pass A2.
