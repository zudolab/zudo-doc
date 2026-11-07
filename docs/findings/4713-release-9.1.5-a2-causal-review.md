# A2 causal review — release 9.1.5

The accepted reference comes from #4707's final PR Checks run `42265324610`, attempt 1, head `da7d141d2e75fb1c1eeac2436afe6ea554f0599b`, A2 job `128055758716`. Artifact `13525984049` has ZIP SHA-256 `ddb7fc8f3e3f9ac9422ca5034a25cac2b10c368208ceee23b05208bf928e17cf`; its manifest reproduces all three accepted reference hashes. Its manifest `sourceHead` is `719baac48054f4c7100b7142e8d25472c24d9d84`, the synthetic merge of that candidate at the time. The 9.1.4 review records its acceptance chain.

Since 9.1.4 main gained #4711 (the routes-plugin `docHistoryMeta` default, `8df74e68`) and #4712 (zdtp 0.9.1, `5891ec5c`). #4711's PR Checks run `42386616845`, attempt 1, A2 job `128445267891`, executed the A2 subset and passed against the unchanged reference, so that source change leaves these three pages unchanged.

The initial 9.1.5 candidate is `48b0cad92221aff19658bbae0e4c2a365160b43d`, the lockstep version/changelog bump on top of main `a3989a551b81b8eda3027bdab6537fc338b08d97` (the #4712 merge). Run `42390654216`, attempt 1, A2 job `128457336556` failed on the three strict HTML hashes. Artifact `13581092545` has ZIP SHA-256 `2842930bfefa872f671fc20a3430569b820c5b71bd8b515f8eb84d62180667bf`. Its actual checkout `c771d86db5d5cd27d41fe93966cecd02292baa77` (corroborated by the job checkout log) has parents `a3989a551b81b8eda3027bdab6537fc338b08d97` (main) and the candidate, and tree `86d4349ad544d11715caf0e3d734db46010080c8`.

Both ZIPs were downloaded and their digests verified against the API-reported artifact digests before comparison. The normalized 404, getting-started and coverage pages respectively remain 57,095, 68,058 and 79,449 bytes; raw lengths remain 57,089, 68,052 and 79,443. There are respectively 1, 2 and 4 native `data-zfb-build` attributes. Every value changes from `72fc9f5a6e2520fb` to `7b593adcb637b443`, and every differing normalized byte (15, 30 and 60) lies inside those values. Replacing only those values makes each candidate normalized page byte-identical to the accepted capture, including its SHA-256. There are no residual normalized differences. In the raw pages the only additional difference is the islands entry filename (`islands-66c4ffe1.js` versus `islands-1d20c7d5.js`), which embeds the build identity; substituting both makes each raw candidate page byte-identical to the baseline.

The lockstep package version/changelog update changes native build identity inputs and produces no rendered-HTML difference on these three pages beyond the identity. This comparison establishes the observed identity-only HTML difference; it does not independently prove identity freshness. Strict normalization and assertions remain unchanged, and the reference remains outside the linked package.

New hashes in page order:

- `404.html`: `139909190940d944211c48b4f88b469329e35381905cbdbad5b76f102470c5d6`
- `docs/getting-started/index.html`: `09ec6722d3fe89aee342726988231e8aab598a18e0910f5cc652999fd4403d16`
- `docs/getting-started/coverage/index.html`: `f4d0ccb172d812724895a8d2110f3baa494c11137db42da811229c9b7ebcc2b6`

This failing run explains the reference update. A fresh successful current-head PR run with A2 actually executed, tested-tree equality with accepted main, and successful exact-integration main workflows are still required before any tag or publication.
