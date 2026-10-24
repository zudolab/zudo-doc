# A2 causal review — release 8.0.0

The accepted reference from PR #4623 is reproduced by hosted PR Checks run `40012373033`, artifact `12526523117` (digest `sha256:40ce3e1bca52269b1b1a7162c51e185f5756b8559d4583bceb3d6db13a1fb142`), checkout `cb6949437a9b5c8be853e8e2b3359c1e774d9017`. Its manifest hashes equal the committed reference.

Release PR #4624's first run `40058352859`, attempt 1, captured the candidate in artifact `12546615820` (digest `sha256:b616a4c81c89cd69faa593c220dbea073092fdc93f75c169a6278e33b2f48a9b`), A2 job `120766231898`. Checkout `3314f5f37610869af760161053ecafd356c5443e` has parents `8689a8b833a9119a9afc03aa47b1a7b0618b92c1` (base) and `6d9caf4e0d78960631b0e0d91b8d88c673eba418` (candidate), and tree `17a4f9015edf4dda6def6ab8f27a97b038244f5b`. Only the three strict fingerprints failed.

I compared the complete normalized captures as bytes. In 404, getting-started and coverage order, their lengths are 57,031, 67,463 and 78,915 bytes, equal before and after. They contain 1, 2 and 4 `data-zfb-build` values respectively. Each changes from `bb6b09fa732f8fc8` to `eb5c6e365fc43aa8`. Substituting only those attribute values in the candidate reproduces the accepted bytes and SHA-256 hashes exactly; no residual difference remains.

The release changes the linked package versions from 7.1.0 to 8.0.0, the ZFB family from 5.0.0 to 5.0.1, and MCP SDK from 1.32.1 to 1.32.2. These change the native build identity inputs. Identity freshness is observed, not independently proven. The native identity stays in the fingerprint; normalization and all assertions are unchanged.

New strict hashes:

- `404.html`: `bd55ec9f529ce16e9449dfbbcf29572f14d4aa2b43efa27cd2c54e6800ed14fe`
- `docs/getting-started/index.html`: `3be8d1da60be7667d91d8d530a90c82cada567feeb5dcea2f44293d747e4c290`
- `docs/getting-started/coverage/index.html`: `f44877efa01d2c9d6bebcf09395bb65ef7a7897332b532fef6d5be69fe9acaf1`

Both hosted artifacts and the comparison results are preserved in the repo-scoped cclogs `release-8.0.0` directory. This comparison explains the reference change; it does not certify the release. A fresh final-head PR run must execute and pass A2, and the accepted main integration must have the same tree as its actual A2 checkout before tagging.
