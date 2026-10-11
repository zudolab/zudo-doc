# A2 causal evidence for #4536 (2026-10-11)

This is evidence for the sidebar transport change in PR #4537, not the separate
A2 maintenance redesign. The strict normalizer, selector, workflow, runtime
identity contract and release provenance requirements are unchanged.

## Source identities and reproducibility

- Accepted main: `694ccdd33d630c25dbc4230f11c50ecc02384122`.
- Reviewed candidate: `c1773bfb0848937bdf166150be2149f2b850c93b`.
- Candidate tree: `08001fe726cbb8e423da8eee9dd55754a425c6ad`.
- Actual hosted merge checkout: `daed1ad5e6a61271e085842444ce580b39988892`,
  whose tree equals the candidate tree above.
- [Hosted A2 job](https://github.com/zudolab/zudo-doc/actions/runs/38157188589/job/114522484960):
  17 passed, three fingerprint failures, 113 unrelated tests filtered.
- Recorded hosted artifact: `11708643799`, 119881 bytes, SHA256
  `0f26c9c1d1d3d3b8b7397a8c7fb9527b48897d30ad7334b804ddb3e62a895e5b`.
  **Archive bytes were not downloaded or inspected.** Supported transfer of the
  earlier fresh artifact failed. No archive integrity verification is claimed.

Instead, a separate pristine worktree of accepted main, with its own frozen
install/build, passed all 20 A2 assertions and reproduced every committed
reference hash. The candidate's independently built local normalized HTML
reproduced every authoritative received hash printed by the hosted job above.
These hash-matched local bytes support the comparison; they are not presented as
an exported or downloaded hosted archive.

Commands, under Node 22.23.3/npm 10.9.9/pnpm 10.30.3, with heavy work serialized:

```sh
pnpm install --frozen-lockfile --ignore-scripts
bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm build:workspace
ZUDO_A2_CAPTURE_DIR=<outside-repository-directory> \
  bash "$HOME/.codex/scripts/heavy-guard.sh" -- \
  pnpm --filter @takazudo/zudo-doc test:slow -t 'A2 no-stub'
```

The captures contain raw HTML, the existing normalized HTML, build log and
source-head manifest. The base and candidate use identical lockfile, normalizer
and A2 test source. SHA256:

- `pnpm-lock.yaml`: `961c296ab36c446bc0186bbdabc00d29cc9e1414784a2cd306ec3d971ffa7bbb`
- `scripts/parity-html-normalize.mjs`: `0c769b0c4c2e86ac950dcafc0a5866d9740ac68a90796f3cc7b4b3d3203a3b82`
- `packages/zudo-doc/src/__tests__/route-injection-build.slow.test.ts`:
  `8b71e574926447907f98a8c6d643f22c756a51a5931c1d39c448bfa773cc31c6`

## Complete causal comparison

See [all page results](a2-comparison.json). The existing normalizer replaces only
content-hashed island/chunk/CSS filenames. No extra normalization was used to
produce either reference or candidate fingerprints.

The offline reverse-diff proof aligns every native island and validates:

1. Accepted-main normalized bytes hash to the existing reference, and candidate
   normalized bytes hash to the exact hosted received value.
2. Both pages' parsed sidebar props differ only by the listed four descriptions
   in `nodes` and `navigation.roots`. Occurrences, parents, opaque context ID,
   labels, URLs, expansion and every other parsed prop match exactly. The
   explicit client allowlist also changes serialized property order.
3. The native `data-zfb-build` token moves from `3edf7c8e7ebc6982` to
   `3928750a22e09636`, at all 1/2/4 island occurrences respectively. The linked
   package tree changed; identity generation is untouched.
4. Restore only the exact prior sidebar `data-props` attribute and exact prior
   native build attribute in the candidate, then compare the entire normalized
   string. It equals accepted main byte-for-byte and hashes to each old reference.

`404.html` changes only native identity. Each docs page removes four descriptions
and changes sidebar property order, saving 402 normalized HTML bytes. No rendered
text, meaningful attribute, URL, style/cache-buster map, structural comment or
other byte differs. The reverse-diff substitution is an evidence operation only;
it is not an exclusion in a gate and does not relax identity coverage.

The reviewed source implementation, 48 zero-retry sidebar browser/built-output
checks, malformed-input tests and installed-consumer comparison are recorded in
[the PR checkpoint](https://github.com/zudolab/zudo-doc/pull/4537#issuecomment-6111438786).
The installed comparison preserves server prose and all remaining sidebar props;
its small-fixture saving is not a production estimate.

## Approval and delivery status

Independent causal review approved this bounded reference update after replaying
the complete reverse-diff assertions and inspecting raw property serialization.
The three references now use the hash-matched hosted candidate values listed in
the comparison. Fresh actually executed passing A2 and all required CI on the
resulting head remain required.
Merge and exact-main workflow/deployment verification remain separate gates.
Final status and continuation checkpoints are posted on PR #4537 and issue #4536.

The Phase A/B handoff ZIP remains unreadable, and PR #4535 remains unmerged.
This work neither resolves that handoff blocker nor claims A2 churn is solved.
Apple IME remains **NOT RUN / OWNER WAIVED**, A3 **PARTIAL / UNVERIFIED**,
A5 **NOT RUN**; #4534 remains open for the container lifecycle limitation.
