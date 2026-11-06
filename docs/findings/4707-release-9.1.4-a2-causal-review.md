# A2 causal review — release 9.1.4

The accepted reference comes from #4697's final PR Checks run `42201041359`, attempt 1, head `2cfd3b1bc7be0b3f16c082c30f32b35e649d8d1c`, A2 job `127836113159`. Artifact `13493034415` has ZIP SHA-256 `163dd346b1f03b14f40634a611c0532c5ce9e725f3790751dab5c808d6fa09a3`; its manifest reproduces all three accepted reference hashes. Its manifest `sourceHead` is `d04a9bc6036702782c851b952c5fd0b0ced22d0e`, the synthetic merge of that candidate at the time; that ref is no longer fetchable, so its tree was not re-resolved here. The 9.1.3 review records its acceptance chain.

The initial 9.1.4 candidate is `e10f34180db3785f7cdf165a184bfbac69226068`, the lockstep version/changelog bump on top of main `7fda064217f600288b3d8c6547bf0c70630f8128` (the #4706 merge). Since 9.1.3 the only source changes are the `setup-doc-skill.sh` fixes from #4701, #4703 and #4706, which do not take part in the site build. Run `42264888677`, attempt 1, A2 job `128054109787` failed on the three strict HTML hashes. Artifact `13525743735` has ZIP SHA-256 `63f2e45f622d3897f37af801531892b9a60ceb49c01bff40c05fe1a931565b9a`. Its actual checkout `9ebc29540ffe5a63a3837a46c2ea189685f5542d` has parents `7fda064217f600288b3d8c6547bf0c70630f8128` (main) and the candidate, and tree `6fbf895f92fc7bb9f040ec1038fe7b0e9d4fec03`.

Both ZIPs were downloaded and their digests verified against the API-reported artifact digests before comparison. The normalized 404, getting-started and coverage pages respectively remain 57,095, 68,058 and 79,449 bytes; raw lengths remain 57,089, 68,052 and 79,443. There are respectively 1, 2 and 4 native `data-zfb-build` attributes. Every value changes from `b241f39a93cc7f8c` to `72fc9f5a6e2520fb`, and every differing normalized byte (14, 28 and 56) lies inside those values. Replacing only those values makes each candidate normalized page byte-identical to the accepted capture, including its SHA-256. There are no residual normalized differences. In the raw pages the only additional difference is the islands entry filename (`islands-a115a78c.js` versus `islands-66c4ffe1.js`), which embeds the build identity; substituting both makes each raw candidate page byte-identical to the baseline.

The lockstep package version/changelog update changes native build identity inputs and produces no rendered-HTML difference on these three pages beyond the identity. This comparison establishes the observed identity-only HTML difference; it does not independently prove identity freshness. Strict normalization and assertions remain unchanged, and the reference remains outside the linked package.

New hashes in page order:

- `404.html`: `e814dca7cd2f61f74f9dff715ce3d5b4bf96aa4942cf8ed1d6c39a6caf9e4016`
- `docs/getting-started/index.html`: `7532f61db50611879b3ea707c9d56759f99b8a1cb0acb9b48eb9588b3c501b8b`
- `docs/getting-started/coverage/index.html`: `20ca15f4875258b77a9745c6bacc8786ef666b41127655c0bd1eef74fe0ccadd`

This failing run explains the reference update. A fresh successful current-head PR run with A2 actually executed, tested-tree equality with accepted main, and successful exact-integration main workflows are still required before any tag or publication.
