# A2 causal review — release 9.1.2

The accepted reference comes from #4694's PR Checks run `41679433661`, attempt 1, head `d2bb8842f8775c4639721561e7060b440c6a12af`, A2 job `126068823377`. Artifact `13251308489` has ZIP SHA-256 `fb52e80831a03bf034b194594ee81697a6f01766305dceee643a691e84a41635`; its manifest reproduces all three accepted reference hashes. The actual checkout is `e569d90eb7efa9085ccefd1d0a3d450fd02e56e3`, with parents `81e0e97f6a11185202e63a647a55df3e0cffc50a` and that candidate. Its tree `c036caccd4a06ebf5d056107b1a7226abcdba8e6` equals accepted main `9b1a72f4cfb8ce9d9035a983db9e1a3d8872c8e1`.

The initial 9.1.2 candidate is `bd0ef20f73507d681c360edbe595e880f215d3ed`. Run `41687764564`, attempt 1, A2 job `126097949367` failed exactly the three strict HTML hashes; the other 17 selected assertions passed. Artifact `13257215153` has ZIP SHA-256 `acfa66840c3caad772123bf0e0367f9d3aeb4bdbd7168044f9fe224fce88e13e`. Its actual checkout `72b68644f15dd1d02ae08450ae69ed83cedcbd2b` has parents `9b1a72f4cfb8ce9d9035a983db9e1a3d8872c8e1` and the candidate, and tree `38d3c76c4d46bb11ee4968c7dd3e0d2b5b7ba211`.

Both ZIPs were downloaded and their digests verified before comparison. The normalized 404, getting-started and coverage pages respectively remain 57,095, 68,058 and 79,449 bytes; raw lengths remain 57,089, 68,052 and 79,443. There are respectively 1, 2 and 4 native `data-zfb-build` attributes. Every value changes from `961ebdd58b2bb970` to `98091441adb47289`. Replacing only those values makes each candidate normalized page byte-identical to the accepted capture, including its SHA-256. There are no residual normalized differences.

The lockstep package version/changelog update and release-tool dependencies change native build identity inputs. This comparison establishes the observed identity-only HTML difference; it does not independently prove identity freshness. Strict normalization and assertions remain unchanged, and the reference remains outside the linked package.

New hashes in page order:

- `404.html`: `47d417fd8ae04bd37e1e4c0b56f7fdbd43bb055c53b1862dc67d9ecee79336be`
- `docs/getting-started/index.html`: `0293824c43970f11b1c30c1978f83581476d36c62c81c1dc1273db31fbaf8ee6`
- `docs/getting-started/coverage/index.html`: `c054054862177ed52a6612709ed6b1be1b466863d845f0b87da62b5c386f486b`

This failing run explains the reference update. A fresh successful current-head PR run with A2 actually executed, tested-tree equality with accepted main, and successful exact-integration main workflows are still required before any tag or publication.
