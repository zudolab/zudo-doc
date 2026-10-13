# Mermaid A2 causal review — 2026-10-13

Pending manager review and successful final-head CI. This record explains the
proposed strict reference update; it does not approve a merge or release.

The accepted baseline is `657bf97f6eda70382a715bb5940e0afc169f2205`
(tree `75a9bfeca676604d5f105dcad01658ad77edf022`). The captured candidate is
`3da471c3b3b8e7070f2157fe43edad246034e169`
(tree `317dbae2286ab8472ef86b18c4ab3eca1aa127e5`). Later branch changes before
this report only touch E2E tests, the workflow and external evidence; the linked
package tree is unchanged. The candidate contains the new dated #4573 review
prerequisite comment in the route-injection test. Neither historical review
logs nor the normalizer nor `approvedBaseline` were changed.

The dedicated audit agent rebuilt the baseline and candidate serially through
the machine guard. The baseline passed all 20 A2 assertions. The candidate
passed its 17 functional/transport assertions and failed only the three old
fingerprints. The offline helper returned exit 1,
`DIFFERENCES_REQUIRE_REVIEW`, with native identity freshness explicitly
`OBSERVED_ONLY_UNVERIFIED_FRESHNESS`. These are not successful A2 results for
the updated references; a fresh current-head A2 run is still required.

The helper's complete source trees, capture-manifest hashes, raw/normalized
hashes and island inventories are retained in [a2-comparison.json](./a2-comparison.json).
The unchanged normalizer SHA-256 is
`0c769b0c4c2e86ac950dcafc0a5866d9740ac68a90796f3cc7b4b3d3203a3b82`.
Captures and raw/normalized diffs remain at `/tmp/4573-a2-candidate` and
`/tmp/4573-a2-comparison-final` in this execution environment.

## Per-page attribution

Each of the three pages contains exactly one inline default Mermaid URL. The
source change intentionally replaces `https://esm.sh/mermaid@11.15.0` with
`https://esm.sh/mermaid@11.17.2`. Tracked package edits also change native build
identity from observed `71005b38f1dfe2c6` to observed `2cef3f3638ad16f7`.
The helper's identity-restored residual still contains the intentional URL
change, so `residualEqual: false` is expected and retained in its report.

For each page, a separate read-only forensic check restored only those observed
identity occurrences and that one URL in the candidate normalized bytes. The
result equaled the entire baseline normalized page byte-for-byte. The exact
replacement counts and restored hashes are in [a2-review-check.json](./a2-review-check.json).
This forensic explanation is not a new normalization rule.

| Page | Old strict fingerprint | Proposed strict fingerprint |
| --- | --- | --- |
| `404.html` | `6fa5c9d3ccdbccf673051922dd8a856d0d119a159ebebf88959e3bf3bfe26a73` | `be6a6e31c5710ad537d41d24a718c6f7d5e352cfd0cab64e5fb664ca9bb70c66` |
| `docs/getting-started/index.html` | `9b0ae51729b8aafcf5d03b9321f936cee153c478c900dc6037b24674523388a5` | `10a08297c55b1eee7c0cd9fbe4a612e8c32be24209ce5ce7411a783d1dee2010` |
| `docs/getting-started/coverage/index.html` | `cc986132a37ab617f9cc596fc5b3fd40ccc22088711ea176b2936607e37b091d` | `faf38e2d6e3616ad80e1112ff5d67d053c4059c451806a15f5637b2bfbd0c305` |

There are no changed stylesheets or theme-pack versions. The relevant source
versions, configuration and island inventories remain in the comparison JSON.
After the two source-backed forensic restorations, there is no remaining
markup, content, URL, protocol, props or layout delta on any page. That finding
explains these three captures; it does not independently establish native build
identity freshness, browser behavior, or release readiness.

The three proposed hashes live outside the linked package in
`scripts/__tests__/fixtures/a2-route-reference.json`, avoiding recursive native
identity churn. Integrating maintenance or other package changes requires a
new capture and causal review before accepting combined-main fingerprints.
