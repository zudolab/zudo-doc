# A2 causal review — release 9.1.3

The accepted reference comes from #4695's final PR Checks run `41688341705`, attempt 1, head `cdd9b352135a3b6c9af3a98b62d0bc36766d9c15`, A2 job `126100449084`. Artifact `13256876448` has ZIP SHA-256 `4fd58be5ae6fbbf98f121aea9bcefde23838fb726d44a4989f537e7caa2a60e3`; its manifest reproduces all three accepted reference hashes. The actual checkout is `e3831c7a23fd4a59559119d6d3d19696a556bb38`, with parents `9b1a72f4cfb8ce9d9035a983db9e1a3d8872c8e1` and that candidate. Its tree `413970861b65ffcddb90b629a6581823431b455e` equals accepted main `4b5b54e3` (the 9.1.2 merge).

The initial 9.1.3 candidate is `b1c1cfaba0abcd6615cdcc352b55b54683db4432`. It carries the ZFB 5.2.2 / Wrangler 4.158.0 adoption (`3e7f4620`) and the lockstep version/changelog bump. Run `42199690672`, attempt 1, A2 job `127831622384` failed exactly the three strict HTML hashes; the other 17 selected assertions passed. Artifact `13492843257` has ZIP SHA-256 `aa0ec0c505b7885e68f019200c16004116ac1ff7024b5ae2f0ac4a32bd1ec97b`. Its actual checkout `f019def0d786a70839ad66296d874cf028b7bd98` has parents `af864a1ae259bbf48801dcc63fcbec09df1ff95d` (main, the #4696 merge) and the candidate, and tree `a3bef6a04be589f45311584998c00cd2789df966`.

Both ZIPs were downloaded and their digests verified before comparison. The normalized 404, getting-started and coverage pages respectively remain 57,095, 68,058 and 79,449 bytes; raw lengths remain 57,089, 68,052 and 79,443. There are respectively 1, 2 and 4 native `data-zfb-build` attributes. Every value changes from `98091441adb47289` to `b241f39a93cc7f8c`, and every differing normalized byte (14, 28 and 56) lies inside those values. Replacing only those values makes each candidate normalized page byte-identical to the accepted capture, including its SHA-256. There are no residual normalized differences. In the raw pages the only additional difference is the islands entry filename (`islands-e67dfb7e.js` versus `islands-a115a78c.js`), which embeds the build identity; substituting both makes each raw candidate page byte-identical to the baseline.

The ZFB 5.2.2 runtime update (client-router form submission and SVG/xlink URL fixes) and the lockstep package version/changelog update change native build identity inputs. The ZFB runtime change produces no rendered-HTML difference on these three pages beyond the identity. This comparison establishes the observed identity-only HTML difference; it does not independently prove identity freshness. Strict normalization and assertions remain unchanged, and the reference remains outside the linked package.

New hashes in page order:

- `404.html`: `04585c978d00785261104732cf59ea6e253bba70e6f01f84a6cabf72fd7a9efc`
- `docs/getting-started/index.html`: `a65bc28c8e5976d11ba35e86a4b68f2c71671cfcb97568d9270f4c42cfeea610`
- `docs/getting-started/coverage/index.html`: `1d27fc00f7bba78dcb4d0adbe0e65e52baa8f0425d2aadf29c02ca0877dd2b83`

This failing run explains the reference update. A fresh successful current-head PR run with A2 actually executed, tested-tree equality with accepted main, and successful exact-integration main workflows are still required before any tag or publication.
