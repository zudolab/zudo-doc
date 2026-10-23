# A2 causal review: release 7.1.0

#4612 established the accepted three-page reference, and the successful A2 capture from #4612's final PR Checks run reproduced its hashes independently:

- **Run:** `39879837782` (attempt 1)
- **Artifact:** `12470226655` (digest `sha256:f08dcd49d378ad036c4c1321d775f3edf05683a5ecea99017d61cde06ffa9edf`)
- **Checkout:** `658b473d5564f1a2b58560aea08059fc980bc188`

The first run on the 7.1.0 release PR #4613 captured the same pages, and the three strict fingerprints failed:

- **Run:** `39882700603` (attempt 1)
- **Artifact:** `12470769460` (digest `sha256:74b1771d06e0086a9fba2f1fc90688e9693e0297d7d324ec8dd4529ee2d15620`)
- **Checkout:** `154b662cfa7fc8515f2e650533b90d53cac9f1e5`, a synthetic merge with parents `4590c9161e8cbc7c3a39a7e24b3f1c92c0345aa3` (main) and `57f67b579926a946ae23e82adf1a12794348f76e` (candidate)

This review comes before the reference update.

`python3 scripts/a2-causal-diff.py` compared the two artifacts with reference source `4590c9161e8cbc7c3a39a7e24b3f1c92c0345aa3`. The script reported `residualEqual: true` with an empty residual diff on all three pages, and no stylesheets changed.

- **Lengths:** in page order the pages are 57,025, 67,457 and 78,909 bytes, both before and after the release bump.
- **Build identity:** the 404, getting-started and coverage pages contain 1, 2 and 4 `data-zfb-build` values. Every one changes from `2a0f36c728557674` to `5f0492af648969f5`.
- **Residual:** replacing only the candidate's identity values with the baseline value reproduces all three accepted normalized captures exactly, SHA-256 hashes included.
- **New strict hashes,** in page order:
  - `e998c72f8e220624b8f9794424806cc03aab615cf5d40fd15eec06d0b2c1df09`
  - `8e63fca19a5469c0d4f7654e9eb960c55942223ebef5117f9bb43716b1bb52ca`
  - `c660ebfe3ee9d678c39a9946cd3912e5dfce0e0ffb9fdb3ed39bf81ef939e91c`

The identity is native ZFB source metadata. Two changes in the release alter its input: the linked-package version bump (7.0.0 → 7.1.0 across the workspace manifests) and the lockfile's Wrangler 4.152.0 update. This is observed, not independently proven, for freshness.

The reference stays outside the linked package, so this evidence and the reference change do not themselves alter the identity. The fingerprint, the normalizer and every A2 assertion still include the native identity. This forensic comparison alone is not acceptance: fresh final-head CI must execute and pass the strict A2 subset.
