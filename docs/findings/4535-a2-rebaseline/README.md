# Reviewed A2 repair after sidebar integration

On 2026-10-11, #4535 was synchronized with accepted main
`1640ec683808119293fb05a2c2bb241446b9dbff`, preserving #4537. The historical
handoff hashes were not applied. Independent feature review found no remaining
source defect in #4532/#4533, including all 30 packs, exact fallback preservation,
24 matching metadata increments and matching EN/JA examples.

## Evidence and source boundary

- Integrated head: `40cd6769dbb04429ece136ce68e03323c7f5c53e`.
- Integrated tree: `5fb15f3d95368bee287e2ea1a926c3cbd75b0b83`.
- [Fresh hosted run, attempt 1](https://github.com/zudolab/zudo-doc/actions/runs/38160412666),
  [A2 job](https://github.com/zudolab/zudo-doc/actions/runs/38160412666/job/114531942295).
- Hosted artifact `11710056398`, 119877 bytes, advertised SHA-256
  `4e6276f124dd12dabc84608717e12f1fcbd4c617b015de301b284af203a50018`.
  The artifact and log downloads returned `Forbidden`; those bytes and that
  archive digest were **not independently verified**. No alternate export was added.
- The authenticated [annotations](hosted-annotations.json) contain all three full
  received hashes. Every one equals the local capture's normalized bytes exactly.
  [Run metadata](hosted-run.json) binds the candidate and base above.
- The PR merge object preserved while this run was active is
  `9538983085669282d29d9a8e232ce319f0a93b20`, with parents accepted main and
  integrated head, and the same tree. The unchanged workflow uses default PR
  checkout. This supports the tested-tree inference; the hosted manifest's
  `sourceHead` and checkout log were not directly observed. This is not release
  provenance approval under RELEASE.md.

`local-capture.zip` contains actual locally built raw and normalized HTML, manifest
and build output, not an exported hosted archive. The two `original/` archives
are the user-supplied historical originals, whose bytes were verified:

| Archive | SHA-256 |
| --- | --- |
| accepted-main-a2-diagnostics.zip | 857f47c4016b2b4b922034f1264a9ea1946b75822f8cb726c8d9a6315f52aa9a |
| pr4535-a2-diagnostics.zip | 42369a85fb38c7c4be438b737ba3cf41c6023728db1089dcfa944927bd84d2dd |

## Complete causal proof

[verify.py](verify.py) imports the actual JavaScript normalizer, checks both
original archives and their manifests, and reconstructs accepted #4537 control
bytes using its source-backed sidebar projection. All three reconstructed hashes
must exactly match the references committed on accepted main. This control is
explicitly reconstructed, not a new main build.

The integrated capture differs from that control only in native build identity
`3928750a22e09636` → `aae1d8c79c0ac792` and the exact 24 theme-pack version
increments independently read from git metadata. All 31 pack entries are checked.
Island placement/order and 1/2/4 identity occurrences are preserved. Reversing
only those two categories in forensic copies restores every accepted normalized
byte. Neither category alone suffices. Sidebar props and all other bytes agree.
See [per-page results](comparison.json).

Reproduce after extracting `local-capture.zip` into an external directory:

```sh
python3 docs/findings/4535-a2-rebaseline/verify.py \
  --repo . --archives docs/findings/4535-a2-rebaseline/original \
  --capture <external-capture-directory> \
  --source 40cd6769dbb04429ece136ce68e03323c7f5c53e \
  --output <external-report.json>
```

An independent Astra High reviewer replayed the historical and integrated proofs,
read source metadata and directly re-read hosted annotations, approving these
three values for this non-release repair. The normalizer, selection, assertions,
required contexts and package/version/dependency/peer contracts are unchanged.

Local workspace build passed under Node 22.23.3/pnpm 10.30.3. The initial A2 run
had 17 passing assertions and these three fingerprint failures; 86 focused
token/header tests passed. Final-head actually executed passing A2 and every
required context, normal merge and exact-main automatic deployment remain
delivery gates, recorded in PR #4535's final checkpoint.

#4534 remains open for the separate local process-reaping limitation. #4484/#4485
retain their scope. Apple IME **NOT RUN / OWNER WAIVED**, A3 **PARTIAL / UNVERIFIED**,
A5 **NOT RUN** remain unchanged. No publication or manual deployment is performed.
