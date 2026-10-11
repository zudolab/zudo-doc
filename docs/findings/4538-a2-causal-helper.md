# Offline A2 causal maintenance (#4538)

Phase B began from accepted main `2da997a4f9a123aa3ee0c6e855cb6e6b89126fe9`, after
#4535's final required checks and exact-main automatic Production Deploy succeeded.
#4532/#4533 were closed with acceptance evidence. The sidebar delivery #4537 remains
intact. This issue implements the handoff's bounded fallback; it does not claim to
eliminate fingerprint churn.

## Reviewed design decision

Independent Astra High design review preceded implementation. It examined the selector,
fresh A2 fixture build and all assertions, every shared-normalizer caller, published
zfb 4.3.1 exports/identity consumers, pack metadata/bootstrap/cache-buster contracts,
workflow, TESTING and RELEASE, and recurring #4529/#4531/#4535 evidence.

#4529's package instruction edit and #4531's types/test/changelog edits changed native
identity alone. #4535 added 24 necessary pack cache-busters; its integration also had
to preserve accepted sidebar transport bytes. These are genuine maintenance costs.

The installed engine's island boundary reads internal `globalThis.__zfb.zudoReactBuild`;
the runtime compares HTML with compiler-provided identity. The inspected public SDK,
config/plugin typings and CLI expose no independent source-to-expected-build-ID API.
Checking the first HTML token, its format/consistency, or the same emitted client bundle
cannot preserve the frozen reference's protection against a coherently stale HTML/bundle
pair. Equivalent protection was not demonstrated. No private engine logic was copied or
changed, and no identity value is exempted from A2.

## Helper contract

`scripts/a2-causal-diff.py` reads authorized local captures and immutable Git objects;
it performs no network calls, builds, Git writes or reference updates. Python 3.9+,
Node and Git are required. Capture files are bounded to 2 MB each; only three known
routes are read. Captures stay outside the linked package and their files cannot
escape their directory. Output must be new, outside the repository/Git metadata,
and not overlap input.

The three explicit source arguments bind capture manifests and accepted references.
The helper resolves and reports all source trees, requires the baseline's complete
normalized fingerprint map to match `--reference-source`, and verifies the executing
normalizer bytes against all three source commits before invoking the actual module.
Baseline and reference trees can differ after a reference/evidence-only commit; this
is reported, never silently converted into source-equivalence or release approval.

Real start-tag parsing validates native component order/multiplicity (1/2/4), unique
identity attributes, protocol/transport and coherent observed tokens across pages.
Normal header/footer persistence markers are not islands. Full pack maps come from
each capture's Git metadata, including unchanged packs and default. Every existing
pack whose stylesheet changes needs a different source version; new/removed packs are
reported separately by the source maps and CSS inventory. Other metadata/schema/CSS
rules remain the responsibility of existing package gates.

Forensic copies restore only validated identity value spans and same-key pack-version
JSON value spans. They preserve key order, whitespace, quotes, surrounding code and all
other bytes. Missing/extra/wrong captured metadata is invalid. Intentional source pack
set changes remain residual differences. Full raw, normalized and forensic copies,
diffs and digests are written for review; candidate fingerprints are evidence only.

The result is deliberately conservative:

- `0`: exact normalized capture equality, without build/freshness/CI approval.
- `1`: **DIFFERENCES_REQUIRE_REVIEW**, even for fully explained identity/version churn.
- `2`: invalid evidence or unsupported contract, without a comparison report.

Identity is always **OBSERVED_ONLY_UNVERIFIED_FRESHNESS**. A uniform arbitrary token
can be described but never approved as an expected identity. Fresh builds, browser/CSS/
packed-consumer coverage, strict fingerprints, required checks and all release source
provenance requirements remain necessary. SKIP still cannot serve as A2 release evidence.

## Regression evidence

The helper was executed against both original checksum-verified hosted archives from
the #4535 handoff, with their actual immutable source commits fetched normally:

| Input | Source SHA | Original ZIP SHA-256 |
| --- | --- | --- |
| Baseline | `17418db87c5aa95cedca4f2e41d242f43ea055db` | `857f47c4016b2b4b922034f1264a9ea1946b75822f8cb726c8d9a6315f52aa9a` |
| Candidate | `83f690010ea237387fb2717bef234f52b0e87a96` | `42369a85fb38c7c4be438b737ba3cf41c6023728db1089dcfa944927bd84d2dd` |

Reference source: `694ccdd33d630c25dbc4230f11c50ecc02384122`. All three pages differ,
all three residuals are empty, the native counts are 1/2/4, and all 24 changed stylesheets
have source-backed version changes. Exit **1**, as required; the full immutable-source
summary is [recorded here](4538-a2-causal-comparison.json). Original archives and the
earlier frozen proof remain under [4535-a2-rebaseline](4535-a2-rebaseline/README.md).
These historical captures test the helper; they are not fresh CI acceptance.

Root unit coverage also replays those exact archive HTML bytes after verifying both
ZIP checksums, using a separately recorded Git metadata snapshot and synthetic commits
for portable offline testing. Its rewritten manifests describe a synthetic replay,
not original hosted provenance. Other mutations use disposable Git histories and
independently constructed captures: unrelated rendered changes alongside valid churn,
malformed/missing/duplicate/misplaced/mixed identity, wrong packs, changed CSS without
a version change, corrupt capture/source/reference/normalizer evidence, Unicode offsets,
and unsafe output paths. No assertion is relaxed to accept these controls.

Independent code review found and corrected three forensic-span hazards: unchanged
JSON version spellings must remain observable, HTMLParser offsets count LF only,
and identity spans must come from actual lexical attributes rather than token-looking
text inside quoted values. Output is also excluded from repository and external Git
metadata paths. Regression cases cover each finding. The final focused run passed
123 tests across the helper, selector and existing migration gate controls; a fresh
guarded workspace build and complete local A2 subset passed all 20 assertions.

The selector gains an `evidence-maintenance` category for this helper, its tests and
source snapshot. This expands strict A2 execution for maintenance changes without
touching the linked package or creating another workflow. Shared normalizer callers
remain unchanged: site-wide parity, A2 slow tests, migration gate controls, historical
migration comparison and frozen #4535 proof.

No npm publication, tags, manual deployment, npm versions, dependency pins or peer
floors change. #4534 stays separate; #4484/#4485 and Apple IME **NOT RUN / OWNER WAIVED**,
A3 **PARTIAL / UNVERIFIED**, A5 **NOT RUN** retain their recorded scope.
