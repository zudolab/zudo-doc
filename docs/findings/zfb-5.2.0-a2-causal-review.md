# A2 causal review — ZFB 5.2.0

The accepted reference is main `81e0e97f6a11185202e63a647a55df3e0cffc50a`, with native build identity `ee58bdf88c555e82`, documented in `4693-release-9.1.1-a2-causal-review.md`.

On 2026-11-03, the published ZFB 5.2.0 adoption at `aaef3135efc5e623dfc404441eaa7375a9507b02` ran the complete route-injection slow file: 134 assertions passed and only the three strict HTML fingerprints failed. A focused A2 run captured the candidate's raw and normalized pages outside the repository. It reproduced the same three failures; the other 17 A2 assertions passed.

The candidate identity is `961ebdd58b2bb970`. The 404, getting-started and coverage pages contain respectively 1, 2 and 4 native `data-zfb-build` attributes. Replacing only those identity values with `ee58bdf88c555e82` reproduces each accepted normalized SHA-256 exactly:

- `404.html`: `bb0412d8f6c09c45e8fce49bed9c4f5d1fd05f8a5ed8d58b384d2519c0efc5fa`
- `docs/getting-started/index.html`: `f383184bfbd116573baa406587b9061a8d7aa351327926a3aabddd794f310843`
- `docs/getting-started/coverage/index.html`: `86cfed8e61c05bb61f027d2d4b10962992caef9d41d73d2796619f9988480cdb`

Raw page lengths remain 57,089, 68,052 and 79,443 bytes, matching the accepted receipt. This hash comparison establishes that the normalized change is confined to native build identity. A fresh old-version capture was not obtained: the historical Actions artifact download returned HTTP 403, and automatic approval review denied the independent baseline build before execution. No old-version rebuild is claimed.

The adoption changes linked-package dependency/peer metadata and the runtime router implementation. Those inputs change native build identity and bundled JavaScript; the captured route HTML otherwise preserves the accepted normalized bytes. The new strict reference retains all native metadata. Neither the normalizer nor assertions are relaxed.

Candidate hashes are `7d122650184e068fc5c6cadb71d7131dc5ce4ec042f0da89cb1214795ec49926`, `393f3f5e500ebe4a5fb1ee80c765322b5e3ca8357a514f31f5def4bebcef84d6` and `008fddcd5b1426cc46d776d2c96465e8fbcd021915a3bc6de9634b69cd7a4a03`, in page order. This review explains the reference update; final-head A2 and CI execution remain required acceptance evidence.
