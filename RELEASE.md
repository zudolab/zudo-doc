# Release Runbook

Maintainer reference for publishing packages to npm.

---

## Release channels

| Release type | Version pattern | npm dist-tag |
|---|---|---|
| Stable / `0.x` mainline | `X.Y.Z` (no suffix) | `latest` |
| Prerelease (opt-in preview) | `X.Y.Z-next.N`, `X.Y.Z-beta.N`, `X.Y.Z-rc.N` | `next` |

A clean `X.Y.Z` (no suffix) is the default install (`npm install <pkg>`).
Prerelease releases are opt-in (`npm install <pkg>@next`).

**Pre-1.0 policy (Scheme B).** While the project is `0.x`, the development
mainline ships **clean `0.MINOR.PATCH`** straight to `latest` — there is no
`-next` suffix on the mainline. `0.x` (major zero) is itself SemVer's "anything
may change" signal, so a breaking change rides a **minor** bump (`0.2` → `0.3`)
and everything else a **patch** bump. Because every mainline release is a clean,
monotonically-increasing version, npm routes it to `latest` automatically and a
tagless `npm install` always gets the newest build — no extra machinery, nothing
to get stuck. The `-next` / `next` channel stays available as an **opt-in**
escape hatch for a deliberate preview or the eventual `1.0.0-beta` run-up. Once a
real `1.0.0` ships, the normal stable-on-`latest` / preview-on-`next` split
resumes automatically.

---

## dist-tag table

| Git tag pattern | Package | npm dist-tag |
|---|---|---|
| `v1.2.3` | `create-zudo-doc` | `latest` |
| `v1.2.3-next.1` | `create-zudo-doc` | `next` |
| `zudo-doc-v1.2.3` | `@takazudo/zudo-doc` | `latest` |
| `zudo-doc-v1.2.3-next.1` | `@takazudo/zudo-doc` | `next` |
| `zudo-doc-history-server-1.2.3` | `@takazudo/zudo-doc-history-server` | `latest` |
| `zudo-doc-history-server-1.2.3-next.1` | `@takazudo/zudo-doc-history-server` | `next` |

The CI publish workflow computes the dist-tag from the version string: any
version containing `-` gets `--tag next`; a clean `X.Y.Z` gets `--tag latest`.

**Stale `next` is removed on stable graduation.** After a clean `X.Y.Z` publish, each
workflow removes `next` only when it points at an *older* prerelease (e.g. `X.Y.Z-next.3`),
never a newer preview, with race checks and a reported outcome — see "Publish workflows
(OIDC trusted publishing)". The maintenance step never fails an otherwise complete
publication.

---

## How `latest` stays current (Scheme B)

There is **no dual-tag machinery** — by design. Under Scheme B the `0.x` mainline
ships clean `X.Y.Z` versions, and the publish workflow routes a clean version to
`--tag latest` directly (see the dist-tag table above). Because each mainline
release is the highest published version, npm keeps `latest` pointed at the newest
build with no probe, no retry loop, and nothing to self-disable.

> **History.** Earlier releases used a `0.2.0-next.N` mainline plus a "dual-tag
> self-disabling probe" that tried to advance `latest` alongside `next` during the
> prerelease cycle. The probe shut off the moment `latest` held a clean `X.Y.Z`,
> which is exactly how `latest` got stranded on the old `0.1.0`
> (zudolab/zudo-doc#1999). Scheme B removes the prerelease mainline and the probe
> entirely — the probe step has been deleted from all three `publish-*.yml`
> workflows.

### Manual remediation (rare)

If `latest` is ever stranded behind the newest version, the standing fix is simply to **ship
a clean version**. To repair a channel for an already-published version, re-run that
package's publish workflow on its tag:
`gh workflow run <publish-workflow>.yml --ref <tag> -f dry_run=false`. The guard classifies
the existing version and only finalizes it. Finalization sets the expected channel through
OIDC and never moves it backward. No local npm login or token is involved; the former local
helper `scripts/release-bootstrap-latest.mjs` is retired.

---

## Release procedure

This section is the **one** release procedure. The Claude Code entry
(`.claude/skills/l-make-release/SKILL.md`) and the Codex skill (`.codex/skills/l-make-release`,
a symlink to the same file) only point here; when they disagree with this file, this file
wins. The deterministic steps are `node scripts/release/release.mjs <subcommand>`; the
publish workflows run `scripts/release/publish-step.mjs`. Both share `scripts/release/lib.mjs`.

### Fresh-checkout setup

Nothing outside the repository is needed: no personal skill, no fixed local path, no
logged-in npm shell, and no npm token anywhere.

```sh
git clone https://github.com/zudolab/zudo-doc.git && cd zudo-doc
corepack enable            # pnpm version comes from package.json "packageManager"
pnpm install --frozen-lockfile
node scripts/release/release.mjs preflight
```

Tools: Node 24 (`.nvmrc`), Corepack/pnpm, `git`, `gh`, `unzip`. `preflight` prints a
capability table and stops on a missing requirement:

| Capability | Needed for | Typical source |
|---|---|---|
| GitHub read (runs, jobs, logs, artifacts, commits) | A2 + main-workflow evidence, `status` | any authenticated `gh` |
| GitHub contents write | `tag`, `releases`, publishing a draft release | maintainer `gh auth login`, or the session's GitHub integration |
| GitHub actions write | `workflow_dispatch` (initiation fallback, resume) | same identity as contents write |
| npm registry read | registry state, provenance | public, unauthenticated |
| npm write | **never needed locally** | only the publish workflows, through OIDC |

A personal access token is not part of the default setup. If a session (for example a
Codex Cloud environment) has no write-capable GitHub identity, run the read-only steps
there and hand the write steps to the owner; adding a short-lived, repository-scoped token
for that session is an explicit owner decision, never a default.

Evidence files go in a directory **outside the linked package** (and preferably outside the
checkout), e.g. `EVIDENCE=../release-evidence/<version>`. Attach the JSON records to the
release PR or its tracking issue; the A2 diagnostics zip is preserved there too.

### Choosing the version

`scripts/release-create-zudo-doc.sh` derives or accepts the version:

| Current version | Mode / arg | Result |
|---|---|---|
| `X.Y.Z` (stable) | _(no arg / auto)_ | `X.Y.(Z+1)` |
| `X.Y.Z-next.N` | _(no arg / auto)_ | `X.Y.Z` (graduate) |
| any | `major` / `minor` / `patch` | `(X+1).0.0` / `X.(Y+1).0` / `X.Y.(Z+1)` |
| `X.Y.Z` (stable) | `next` | `X.(Y+1).0-next.1` |
| `X.Y.Z-next.N` | `next` / `stable` | `X.Y.Z-next.(N+1)` / `X.Y.Z` |
| any | `<semver>` | exactly that |

Breaking changes take a major bump (minor during `0.x`, see "Release channels"); `feat:`
takes a minor and everything else a patch. `DRY=1 ./scripts/release-create-zudo-doc.sh [arg]`
computes without writing. Classify every user-facing change by package owner as described in
"Package-specific release notes".

### Steps

1. **Preflight.** `node scripts/release/release.mjs preflight` on a clean `main`.
2. **Prepare.** `./scripts/release-create-zudo-doc.sh [<version>|<mode>]` bumps all four
   `package.json` files, rewrites the scaffold pins and scaffolds the six changelog entries.
   Fill them ("Package-specific release notes"), run `pnpm gen:changelog`, then
   `B4PUSH_SKIP_PIN_PUBLISHED=1 pnpm b4push` (the pin-published window, see "Scaffold pin
   published gate"). On a major bump, raise the history-server peer floor first ("First-party
   peer floor", rule 4).
3. **Release PR.** Commit on `release/<version>` as `chore: bump create-zudo-doc to
   v<version>`, push, and open a PR to `main`. A push to `main` runs no A2.
4. **Freeze and verify the candidate.** When PR Checks is green, record the candidate head,
   the base the run used, and the run ID/attempt, then:

   ```sh
   node scripts/release/release.mjs a2-evidence --pr <N> --run <run-id> --attempt <n> \
     --candidate <head-sha> --base <base-sha> --out "$EVIDENCE"
   ```

   It verifies everything in "Release-candidate CI: A2 must execute" (A2 RUN + executed test
   step, every required check, the diagnostics artifact ID/digest — downloaded and compared
   to its digest — the checkout SHA from the job log and `manifest.json`, the tested merge's
   parents and tree) and writes `a2-evidence.json`. Expect the first release run to fail A2
   on the build identity; see "Rebaselining the release build identity".
5. **Merge** under the normal policy. Do not push anything else to the release branch.
6. **Bind the accepted integration.**

   ```sh
   node scripts/release/release.mjs integration --evidence "$EVIDENCE/a2-evidence.json" \
     --integration <merge-commit-sha> --out "$EVIDENCE"
   ```

   It requires the PR's merge result to equal that SHA, the SHA to be on `main`, its tree to
   equal the A2-tested tree, and every applicable push-to-main workflow at that exact SHA —
   Production Deploy included — to have completed successfully (pending or missing blocks;
   re-run the command once they finish). Never dispatch a deployment to manufacture this.
7. **Tag.** `node scripts/release/release.mjs tag --version <version> --evidence "$EVIDENCE"`
   creates the three annotated tags at the integration SHA. An existing tag at the same SHA
   is kept; an existing tag elsewhere stops the release. Tags are never moved.
8. **Draft releases.** `node scripts/release/release.mjs releases --version <version> --evidence "$EVIDENCE"`
   creates one draft per tag with that package's own notes and title (prerelease flag for a
   hyphenated version). An existing release is checked, never duplicated. Inspect the three
   drafts; an unchanged package must show its no-change entry.
9. **Publish.** `node scripts/release/release.mjs publish --version <version> --evidence "$EVIDENCE"`
   handles one package at a time in publication order. For each package it:
   - reads the registry state. *Unknown* stops the run (exit 2). It is never treated as
     absent.
   - stops if an existing version has no provenance from this integration SHA, this tag and
     this package's workflow;
   - otherwise attaches to an active run, or initiates one. If the draft is unpublished it
     publishes it, which fires `release: published`. If no run appears in time, or the release
     is already published, it dispatches the package's workflow on the tag;
   - waits for that run. A failed run stops the order;
   - re-reads the registry until the exact version, the provenance and the expected channel
     (plus `next` maintenance for a stable version) are confirmed.

   A version that already existed is recorded as verified but **not** a fresh publication;
   `publication.json` records which run published what. Re-running `publish` resumes:
   finished packages are skipped, an interrupted finalization is re-dispatched, and nothing
   is republished. After a stable release it marks `v<version>` as GitHub's Latest release.
10. **Read back.** `node scripts/release/release.mjs status --version <version>` prints
    the tag, release, runs and registry state of each package. Report the three release
    URLs, `publication.json` and the npm publisher identity.

`--confirm` on the Claude/Codex entry adds one owner confirmation immediately before step 9.

### Manual equivalents

When a helper cannot run, perform the same checks by hand. Keep the same evidence, in the
same order. The draft-release step by hand:

```bash
HISTORY_NOTES=$(awk 'BEGIN{f=0} /^---$/{f++; next} f>=2' \
  src/content/docs/changelog/doc-history-server/<NEW_VERSION>.mdx)
ZUDO_DOC_NOTES=$(awk 'BEGIN{f=0} /^---$/{f++; next} f>=2' \
  src/content/docs/changelog/zudo-doc/<NEW_VERSION>.mdx)
CREATE_NOTES=$(awk 'BEGIN{f=0} /^---$/{f++; next} f>=2' \
  src/content/docs/changelog/create-zudo-doc/<NEW_VERSION>.mdx)

# --prerelease for any version containing a hyphen (next/beta/rc); empty for stable.
PRE=""; case "<NEW_VERSION>" in *-*) PRE="--prerelease";; esac

gh release create "zudo-doc-history-server-<NEW_VERSION>" \
  --title "@takazudo/zudo-doc-history-server <NEW_VERSION>" \
  --notes "$HISTORY_NOTES" --draft $PRE --verify-tag
gh release create "zudo-doc-v<NEW_VERSION>" \
  --title "@takazudo/zudo-doc <NEW_VERSION>" \
  --notes "$ZUDO_DOC_NOTES" --draft $PRE --verify-tag
gh release create "v<NEW_VERSION>" \
  --title "create-zudo-doc <NEW_VERSION>" \
  --notes "$CREATE_NOTES" --draft $PRE --verify-tag
```

Initiate each package by publishing its draft (`gh release edit <tag> --draft=false`).
Alternatively, dispatch its workflow on the tag:
`gh workflow run <publish-workflow>.yml --ref <tag> -f dry_run=false`. Do one package at a
time, in publication order, and confirm each in the registry before starting the next.

### Running in Codex Cloud

The procedure is the same in Codex Cloud. Because `preflight` reports what the
environment provides, a Cloud session never silently swaps environments or capabilities.
Each Cloud run of the release must be observed and recorded there. A local run does not
establish Cloud acceptance, and the reverse also holds. The acceptance checklist lives on
the tracking issue (zudolab/zudo-doc#4748).

---

## Publish workflows (OIDC trusted publishing)

`publish-zudo-doc-history-server.yml`, `publish-zudo-doc.yml` and `publish-create-zudo-doc.yml`
use no stored npm credential. They share one shape:

- **Triggers.** `release: published` for the package's tag namespace; the other two
  workflows skip NEUTRAL. `workflow_dispatch` on the **tag ref** is for explicit initiation
  and resumption, and with `dry_run: true` it never writes. Both triggers run the same file,
  so the OIDC workflow identity is always that file. There is no reusable-workflow
  coordinator, because npm validates the *calling* workflow's filename. An event created
  with a workflow's `GITHUB_TOKEN` never starts another workflow. So nothing here relies on
  one: the orchestrator dispatches explicitly when no run appears.
- **Permissions.** `permissions: {}` at workflow level. Only the publish job gets
  `contents: read` and `id-token: write`. Runners are GitHub-hosted; trusted publishing
  does not support self-hosted runners. Checkout does not persist credentials.
- **Toolchain.** pnpm 10 has no OIDC code. `pnpm publish` packs the package, which rewrites
  `workspace:` specifiers, then runs `npm publish <tarball>` with the npm on `PATH`. The
  toolchain step therefore installs the reviewed npm CLI pinned in
  `scripts/release/lib.mjs` (`NPM_CLI_PIN`). That npm is ≥ 11.5.1 for OIDC publish and
  ≥ 11.21.0 for OIDC `npm dist-tag`. The step checks its integrity, refuses a pnpm
  `npm-path` override, and prints the node, npm and pnpm versions. `create-zudo-doc` has
  no workspace dependencies and publishes with that npm directly.
- **Guard.** Checks run in this order:
  - anchored tag namespace and semver;
  - `package.json` version matches the tag;
  - the checked-out commit is the tag commit, and is on `origin/main`;
  - every existing sibling lockstep tag targets the same commit;
  - the registry state, which sets the mode: *absent* → `publish`. *Present with provenance
    from this commit, tag and workflow* → `resume`, which finalizes only and never
    republishes. *Present from any other source* → fail. *Unknown* after bounded retries
    → fail closed (exit 2).
- **Pack check.** A nonmutating `pack` that asserts no `workspace:` specifier survives.
- **Dry run** (`dry_run: true`). Runs the toolchain, guard, install, build, tests, the
  scaffold-pin freshness safeguard (create-zudo-doc) and the pack check, then stops. It
  says explicitly that write authorization is **not** verified: only a real publish
  exercises the trusted publisher. In a dry run, a commit that is not yet on `main` is a
  warning instead of a failure, so a pre-merge candidate tag can be exercised.
- **Publish.** Refuses to run if any static npm credential is present, or if the OIDC
  token endpoint is missing; there is no token fallback. On failure it keeps npm's
  original error and prints the expected trusted-publisher fields. A publish is never
  retried blindly: re-running the workflow lets the guard classify what happened.
- **Finalize** (publish and resume). Polls, with bounds, until the exact version is
  visible. It then requires provenance from this commit and workflow, and confirms the
  channel (`latest` for `X.Y.Z`, `next` for a prerelease). A lagging channel is set
  through OIDC `npm dist-tag add`. A channel held by a newer version is never moved
  backward. A version still not visible is *unknown* (exit 2), not absent.
- **`next` maintenance** (stable only, isolated with `continue-on-error`). It reads
  dist-tags and removes `next` only when it points at a prerelease older than the
  released version; a newer preview is kept. It re-reads immediately before removing
  (the per-package concurrency group serializes this repository's runs) and again
  afterwards. If a newer preview appeared, its pointer is left in place, or restored.
  Outcomes are `absent`, `kept-newer-preview`, `removed`, `race-left-in-place`,
  `race-restored`, `unknown`, `unverified` and `failed`. The outcome goes into the job
  summary, and a warning is raised without failing the publication. Re-dispatch the
  workflow on the tag to retry.

---

## npm trusted publishers and credential retirement (owner)

Only the owner changes npm or GitHub security settings. Configure one GitHub Actions trusted
publisher per package on npmjs.com (package → Settings → Trusted publishing). Every field is
case-sensitive and exact. The npm scope `@takazudo` does not change the GitHub owner.

| npm package | Organization or user | Repository | Workflow filename | Environment name | Allow npm dist-tag |
|---|---|---|---|---|---|
| `@takazudo/zudo-doc-history-server` | `zudolab` | `zudo-doc` | `publish-zudo-doc-history-server.yml` | _(empty)_ | enabled — channel repair and stale-`next` maintenance |
| `@takazudo/zudo-doc` | `zudolab` | `zudo-doc` | `publish-zudo-doc.yml` | _(empty)_ | enabled — channel repair and stale-`next` maintenance |
| `create-zudo-doc` | `zudolab` | `zudo-doc` | `publish-create-zudo-doc.yml` | _(empty)_ | enabled — channel repair and stale-`next` maintenance |

Direct publishing (`npm publish`) is required for all three; staged publishing is not used.
Each package's `repository.url` is `git+https://github.com/zudolab/zudo-doc.git`.
The workflows use no GitHub Environment, so the Environment field stays empty. If one is
added later, the field must match it exactly.

Order of operations:

1. **Configure the publishers right before a legitimate release.** npm expires a new
   publisher that has not completed a successful publish within 2 days. Never cut a version
   or write to the registry just to test.
2. **Observe live OIDC operation** on that release for each package: its publish run has no
   static credential, which the publish step enforces. The registry then shows the version
   with provenance from the run, and the publisher identity in `status` is no longer the
   personal account. Public reads and dry runs are not proof.
3. **Remove `NPM_TOKEN` access**: the repository secret, any environment secret, and any
   organization secret visible to the repository.
4. **Inventory other consumers** of the npm write token by non-secret identifiers (token
   name or ID, creation date, the repositories and workflows that reference it). Revoke it
   only when nothing else depends on it; otherwise record the dependency and keep it
   scoped.
5. **Restrict traditional token publishing** per package: "Require two-factor
   authentication and disallow tokens". Trusted publishers keep working.

Progress and evidence are tracked in zudolab/zudo-doc#4748.

---

## Release-candidate CI: A2 must execute, not just pass

A green `A2 No-Stub Parity Gate` job is not enough evidence on a release candidate. The
gate selects its slow test from the changed paths (`scripts/select-a2-parity.mjs`; input
contract in `TESTING.md`, "A2 No-Stub Parity Gate input selection"), and a job whose test
step was skipped still reports success.

A2 runs only in PR Checks (`pull_request` to `main`). A direct push to `main` runs no A2
job, and a local run of the subset is not a substitute: the native identity depends on the
build environment, so local fingerprints differ from the hosted reference even on an
unchanged `main`. The release commit must therefore reach `main` through a release PR, as
#4524 did, and the A2 evidence comes from that PR's run.

### Freeze the candidate and its tested source

Before merging, record the following in the release PR or a durable release evidence
record. Keep the record outside the linked package so it does not change A2's inputs.

- [ ] Release PR number, frozen candidate head SHA and tree, and the base SHA used by
      the successful PR run. The run's `head_sha` must equal that candidate head.
- [ ] Successful PR Checks run URL, ID and attempt, all required check conclusions,
      A2 job URL/ID, and the diagnostics artifact ID/digest from that same run/attempt
      and job. Download and preserve the evidence before the artifact expires.
- [ ] The A2 job summary reads `A2 decision: RUN (...)` and
      `A2 execution: EXECUTED and passed (...)`. Its "Run A2 no-stub parity slow-suite
      subset" step has a real duration and passing vitest output, not a skipped step.
      Release manifests/lockfile changes must select A2; SKIP blocks release.
- [ ] Actual A2 checkout SHA (`sourceHead` in the diagnostics `manifest.json`,
      corroborated by that job's checkout log) and its Git tree. Default PR checkout
      tests a synthetic merge, not necessarily the candidate head. A workflow run's
      `head_sha` alone is therefore insufficient. Verify the tested merge's parents
      identify the recorded base and candidate; do not infer them from today's PR refs.

Resolve trees from the recorded commit objects with `git rev-parse '<sha>^{tree}'`.
Retain/fetch the actual tested source object (including the PR merge ref while it still
matches), or use GitHub's commit/tree API for that exact SHA. Never replace an unavailable
source with the current moving merge ref. Missing evidence blocks tagging.

A fingerprint failure caused by a version bump is re-baselined only with fresh hosted
capture and per-page causal review before publication. Keep the strict identity contract
and normalization unchanged. Freeze the resulting candidate again and obtain a successful
current run; an earlier failing capture can explain a rebaseline but cannot certify it.

### Bind all tags to the accepted main integration

After the release PR is accepted under the repository's merge policy, record the exact
main integration commit SHA and tree from that PR's merge result. This frozen integration
SHA is the canonical target of **all three tags**, regardless of merge method. It must be
on main's accepted history and its tree must equal the recorded actual A2 checkout tree:

```sh
# Set these to the full SHAs in the evidence record, never main or HEAD.
A2_SOURCE_SHA="<recorded-actual-A2-checkout-sha>"
RELEASE_INTEGRATION_SHA="<accepted-main-integration-sha>"
git fetch origin main &&
  A2_SOURCE_TREE=$(git rev-parse --verify "$A2_SOURCE_SHA^{tree}") &&
  RELEASE_INTEGRATION_TREE=$(git rev-parse --verify "$RELEASE_INTEGRATION_SHA^{tree}") &&
  git merge-base --is-ancestor "$RELEASE_INTEGRATION_SHA" origin/main &&
  test "$A2_SOURCE_TREE" = "$RELEASE_INTEGRATION_TREE"
```

Require successful applicable main workflows on **that exact integration SHA** before
creating any tag. Enumerate workflows triggered by the integration (including Production
Deploy), record each run/attempt and conclusion, and inspect jobs; a newest-run lookup or
one green workflow is insufficient. Pending, missing, cancelled or failed applicable runs
block tagging. Do not dispatch a deployment merely to manufacture this evidence. Once
these gates pass, use the frozen SHA explicitly for each tag, never moving `main`, `HEAD`
or the release branch head. Main advancing later does not change the verified tag target.

### Rebaselining the release build identity

Every lockstep release so far (6.0.2 through 10.0.3) failed the three strict A2 fingerprints
on the release PR's first run: the version bump changes the native `data-zfb-build` identity
embedded in the captured pages, and the hashes depend on the hosted build environment, so they
cannot be pre-computed locally. Budget one extra CI round and rebaseline on the still-open PR:

1. Download the failing run's `a2-route-parity-diagnostics` artifact, and the artifact from the
   run that accepted the current `scripts/__tests__/fixtures/a2-route-reference.json` (its
   `manifest.json` hashes must equal the reference).
2. Byte-compare each `*.normalized.html` pair. Rebaseline only if lengths are equal, the sole
   difference is the `data-zfb-build` value(s), and substituting the old value back into the
   new capture reproduces the accepted bytes exactly. Any other residual is a real regression:
   fix it, do not rebaseline.
3. Update the three hashes in `a2-route-reference.json` and add a causal review under
   `docs/findings/` recording both runs, artifact IDs, checkouts, old/new identities and
   per-page occurrence counts (template: `docs/findings/4582-release-6.2.0-a2-causal-review.md`).
   Commit as `test: rebaseline strict A2 identities for the <version> release`, push, and
   collect the evidence from the fresh run. The failing run explains the rebaseline; only the
   fresh run certifies it.

### Candidate changes and repair

- **Before merge:** repair on the still-open release PR. If its candidate or base changes
  the tested integration, synchronize the candidate and obtain fresh current PR checks
  with A2 actually executed. Re-record the candidate/base, run/attempt, checkout and tree;
  do not reuse an old green run for a different integration.
- **After merge:** if the accepted tree differs from the tested tree, stop tagging.
  Obtain fresh A2 evidence through a corrective PR against refreshed main. Any code,
  configuration or other source repair also goes through a new corrective PR; pushing
  to the already-merged release branch neither delivers the repair nor supplies an open
  PR gate. Repeat the entire evidence chain and bind all final tags to the corrected,
  verified main integration, with the intended release contents and version retained.
- **Unchanged transient CI failure:** a rerun at the same recorded source SHA is allowed;
  record the successful attempt. A source change is never a transient rerun and requires
  fresh PR acceptance and exact-integration main workflow evidence.

Tree equality is a release gate, not a claim that A2 runs on main. The successful PR run
proves A2 execution; the equality check binds that tested content to the accepted tag
source. Publication ordering and the minimum peer-floor policy below still apply.

Why: in the 6.0.0 release PR #4524 the old per-emitter path list skipped A2's test steps
on a green job; the post-publication Nightly Exam then failed three A2 fingerprints, fixed
in #4527. See the [6.0.0 publication record](docs/findings/4430-zfb3-migration/release-6.0.0/README.md).

---

## Publish order

**Always publish `@takazudo/zudo-doc-history-server` and `@takazudo/zudo-doc`
before `create-zudo-doc`.**

The scaffold tool pins a specific `@takazudo/zudo-doc` version in the generated
downstream `package.json`. If `create-zudo-doc` is published first and a user runs
the scaffold before the peer packages land on npm, `pnpm install` in the new project
fails with a 404 on the pinned `@takazudo/zudo-doc` version.

All three packages are versioned and released in lockstep. Every tag below targets the
same frozen, tree-verified main integration SHA from the preceding section. The sequence
(`release.mjs publish` enforces it, confirming each package in the registry before the next):

1. `@takazudo/zudo-doc-history-server` — tag `zudo-doc-history-server-X.Y.Z`,
   workflow `publish-zudo-doc-history-server.yml`.
2. `@takazudo/zudo-doc` — tag `zudo-doc-vX.Y.Z`, workflow `publish-zudo-doc.yml`.
3. `create-zudo-doc` — tag `vX.Y.Z`, workflow `publish-create-zudo-doc.yml`, only after
   1 and 2 are confirmed.

Do not skip an unchanged package: its package-specific release note records that it has
no user-facing package change, while the lockstep release and publish order remain the
same.

---

## Package-specific release notes

Every lockstep release has six source entries: one English and one Japanese entry for
each published package. The English entry also provides that package's GitHub Release
body, and generates that package's committed `CHANGELOG.md`:

| Package | EN source (JA replaces `docs` with `docs-ja`) | Generated output | Git tag |
|---|---|---|---|
| `@takazudo/zudo-doc-history-server` | `src/content/docs/changelog/doc-history-server/<version>.mdx` | `packages/doc-history-server/CHANGELOG.md` | `zudo-doc-history-server-<version>` |
| `@takazudo/zudo-doc` | `src/content/docs/changelog/zudo-doc/<version>.mdx` | `packages/zudo-doc/CHANGELOG.md` | `zudo-doc-v<version>` |
| `create-zudo-doc` | `src/content/docs/changelog/create-zudo-doc/<version>.mdx` | `packages/create-zudo-doc/CHANGELOG.md` | `v<version>` |

Japanese mirrors: `src/content/docs-ja/changelog/doc-history-server/<version>.mdx`,
`src/content/docs-ja/changelog/zudo-doc/<version>.mdx` and
`src/content/docs-ja/changelog/create-zudo-doc/<version>.mdx`.

Classify notes by user-facing package ownership, not merely by commit prefix or touched
directory. Duplicate a user-facing change into every affected package note when it spans
packages. Omit repo/showcase documentation, tests, CI, and maintenance changes when they
do not affect published-package users. An unchanged lockstep package still gets an
explicit localized entry:

```md
# English
- No package-specific changes.

# Japanese
- パッケージ固有の変更はありません。
```

Entry shape (English; Japanese mirrors it with `リリース日:` and the headings `### 破壊的変更`,
`### 機能`, `### バグ修正`, `### その他の変更`; omit an empty section):

```mdx
---
title: <version>
description: Release notes for <version>.
sidebar_position: <value from the release script>
---

Released: <YYYY-MM-DD>

### Breaking Changes

- Description (commit-hash)

### Features

### Bug Fixes

### Other Changes
```

After authoring all six entries, run `pnpm gen:changelog` and stage its outputs: the
three package `CHANGELOG.md` files **and** `public/_redirects`, which the same command
regenerates (see "Per-release derived artifacts" below). When creating GitHub releases,
extract three independent note bodies and map
each one to the tag in the table. Never reuse one shared `$NOTES` value across tags.
Titles are `@takazudo/zudo-doc-history-server <version>`,
`@takazudo/zudo-doc <version>`, and `create-zudo-doc <version>`. Versions containing a
hyphen are prereleases and each `gh release create` command must include `--prerelease`.
`release.mjs releases` applies exactly this mapping; the manual commands are under
"Release procedure" → "Manual equivalents".

---

## Per-release derived artifacts

Two things used to need a hand-edit on **every** release, and both were invisible locally
until a test failed mid-release:

- **`public/_redirects`** — one 301 per zudo-doc changelog version, EN and JA. It is now
  **generated** by `scripts/generate-changelog-redirects.mjs`, which `pnpm gen:changelog`
  runs after emitting the package changelogs. Do not hand-edit it; add the changelog entry
  and re-run `pnpm gen:changelog`.
- **Release-count assertions** in `src/__tests__/pages-lib/changelog-hierarchy.test.ts` and
  `changelog-redirects.test.ts` — these were exact `toHaveLength(N)` counts that every
  release had to bump. They are now `toBeGreaterThanOrEqual` **floors** (a tripwire against
  the corpus shrinking, not a counter), and the newest-entry check is derived from
  `packages/zudo-doc/package.json`'s `version` rather than a pinned version string.

**Neither should ever need editing as part of a release.** If a release makes you edit one,
that is a signal something genuinely changed — investigate rather than bumping the number.

---

## First-party peer floor (publish-lag)

`packages/zudo-doc/package.json` declares `@takazudo/zudo-doc-history-server` as a
**peerDependency** with a caret floor (today `^7.0.0`, raised in the 7.0.0 major-bump
release commit under rule 4 below; see the
[6.0.0 publication record](docs/findings/4430-zfb3-migration/release-6.0.0/README.md)).

**This section is the single contract for that floor.** `scripts/check-pin-parity.mjs`
and `.claude/skills/l-make-release/SKILL.md` reference it rather than restating it — if
they ever disagree with what follows, this section wins and the other two are the bug.

1. The floor is a **minimum-supported-version declaration, not a lockstep mirror** of the
   root version. It states the oldest `@takazudo/zudo-doc-history-server` this package
   supports — nothing more.
2. **Routine dependency-bump rounds and releases preserve it unchanged.** Neither a
   release, nor a `/dev-bump-zudo-deps` round, nor the non-fatal pin-parity advisory is a
   reason to move it.
3. It changes **only for a documented compatibility reason**: a genuine minimum-version
   requirement (the package began relying on an API that first shipped in that version),
   or an approaching cross-major staleness that would otherwise make the check error.
4. It may name a version that is not yet published to npm in **exactly one case: the
   release commit of a major bump**, where it is raised to `^<new major>.0.0` together
   with the root version (rule 3's cross-major clause) and the approved baseline (rule
   5). That is the same in-flight-version window `scaffold.ts` already occupies on every
   release (`scripts/run-b4push.sh` step 19, `B4PUSH_SKIP_PIN_PUBLISHED`). The window
   closes when the 6a publishes (`zudo-doc-history-server`, `zudo-doc`) land on npm, and
   the publish order guarantees it closes before the only gate that compares the floor
   against the registry — the scaffold pin freshness safeguard in `publish-create-zudo-doc.yml` — runs. Outside a
   major bump the floor never names an unpublished version. The raise is a hand edit in
   the release commit; the release script never touches it.
5. The declaration is **mirrored as an approved baseline** in
   `scripts/check-pin-parity.mjs` (`FIRST_PARTY_PEER_CHECKS[].approvedBaseline`), compared
   by exact string equality. That gate is what makes rule 2 enforceable: every semantic
   comparison the script performs is one-sided, so a *raised* floor still satisfies the
   root version and would otherwise pass silently. A rule-3 change therefore edits **both**
   the `package.json` entry and the baseline **in the same commit**; editing only one fails
   `pnpm check:pin-parity`.

Rule 4's window is safe because the floor is not an install input. The showcase root has no
dependency on `@takazudo/zudo-doc-history-server` at all; `packages/zudo-doc` consumes it as a
`workspace:*` **devDependency** link and declares it an **optional**
peer, and a workspace package's `peerDependencies` appear nowhere in `pnpm-lock.yaml`'s
importers — so no install, local or CI or publish, frozen or not, is affected by the
floor's value. Measured in #4280 (`docs/findings/4268-peer-floor-major-bump.md`): with a
release fully prepped at root `6.0.0`, floor `^6.0.0`, `approvedBaseline` `^6.0.0` and no
`6.x` on npm, `pnpm install`, `pnpm check:pin-parity`, main CI and all three publish
workflows pass. The real constraint is a different gate: `check:scaffold-pin-freshness`'s
first-party peer-range rule (#4065) is red while the floor names a version the registry's
`latest` does not satisfy. It runs in the release script's pre-bump preflight — where the
floor it sees is still the old one — and in the scaffold pin freshness safeguard in `publish-create-zudo-doc.yml`,
which by the mandated publish order runs after the 6a publishes have landed. Neither ever
looks inside the window. The release script (`scripts/release-create-zudo-doc.sh`)
deliberately does not touch the floor.

### The lag is expected, unbounded, and not a defect

Because rule 2 holds, the distance between the floor and the root version **grows with
every release and may be arbitrarily large**. Historical example from the 5.x line: the floor
was `^5.17.2` against root `5.25.0` — eight minors — and that was the contract working, not
drift. A same-major caret floor keeps admitting the root version however far behind it sits:
`^5.17.2` was satisfied by a `5.25.0` install, and today's `^7.0.0` will keep admitting every
later 7.x release.

**Do not chase the advisory — the loop does not converge.** Raising the floor to match the
just-published version clears the note, but the next release moves the version past it again
and the note returns. (Learned the hard way in 5.1.1, which exists mostly because the 5.1.0
advisory was mistaken for a chore.) The check errors on its own when the floor stops
including the root version; until it does, no action.

The pin-parity guard (`scripts/check-pin-parity.mjs`) enforces this with
**satisfies-semantics** for the lockstep peer: it fails only when the floor would
**exclude** the root version (a cross-major drift like `^1.x` at root `2.x`, or a
floor above root like `^2.2.0` at root `2.1.0`), and prints a non-fatal advisory
when a valid floor lags.

At a **major** bump the check errors on the old floor (`^5.x` at root `6.x`) — that is the
rule-3 cross-major case, and the remedy is the rule-4 raise: edit the floor and the
approved baseline to `^<new major>.0.0` in the release commit, before `pnpm b4push`. The
linear release below is unchanged; the raise rides in the same commit as the version bump,
exactly as v3.0.0, v4.0.0 and v5.0.0 did.

A clean linear release therefore needs no interleaving:

> bump versions + scaffold pins → `pnpm b4push` → commit → push a release branch and open
> a PR to `main` → PR Checks green with A2 executed (see "Release-candidate CI: A2 must
> execute, not just pass") → accepted integration tree equals the tested tree → applicable
> main workflows green at that frozen integration SHA → tag that SHA → publish all three in
> publish-order.

---

## Bumping the toolchain (`@takazudo/*` upstream pins)

Bump the upstream deps by hand (or with a maintainer's optional dependency-bump tool), then run:

```sh
pnpm check:pin-parity
```

That check is the authority on where a version lives — do not maintain a
hand-written pin map alongside it, which is how the retired `/l-bump-deps` skill
went stale. Two things it knows that a generic dependency bumper does not:

- **`packages/create-zudo-doc/src/scaffold.ts` is a pin location.** It carries
  literal pin strings emitted into the *generated downstream* `package.json`, so a
  tool that only rewrites `package.json` files leaves it behind. The parity check
  fails loudly when it does — fix `scaffold.ts` to match and re-run.
- **Leave the first-party peer floor alone** unless the check actually errors —
  see "First-party peer floor (publish-lag)" above. Its lag advisory is the normal
  steady state, not a chore, however large the lag has grown.

> **A generic dependency bumper will raise this floor if you let it.** Tools that bump every
> `@takazudo/*` range (including the maintainer's optional `/dev-bump-zudo-deps` skill, which
> is not part of this repository) report `packages/zudo-doc/package.json`
> `peerDependencies["@takazudo/zudo-doc-history-server"]` as an ordinary bump and would apply
> it — silently violating rule 2 of the contract above. Scope such a tool to the **whole** zfb
> family (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`,
> `@takazudo/zfb-md-wasm`) — a partial bump leaves the workspace peer floors unsatisfiable —
> or revert that one hunk before installing.

Resolve targets from the **`latest`** dist-tag, never `next` — the two have
permanently diverged since zfb 1.0.0, and `next` is frozen on an old prerelease, so
following it silently downgrades the toolchain by a major.

The zfb family (`zfb`, `zfb-runtime`, `zfb-adapter-cloudflare`, `zfb-md-wasm`) must
move to the same version together; a partial bump leaves the workspace peer floors
unsatisfiable. `@takazudo/zudo-doc` and `@takazudo/zudo-doc-history-server` are
produced here, not consumed — their versions belong to the release flow.

A bump that changes `scaffold.ts` needs a `create-zudo-doc` release afterward so
downstream scaffolds get the new pins.

---

## Scaffold pin freshness gate

`scripts/check-scaffold-pin-freshness.mjs` (`pnpm check:scaffold-pin-freshness`)
closes the **recurrence** half of #3442: `create-zudo-doc@5.5.3` shipped on
2026-08-17 pinning `@takazudo/zfb` at `2.5.2` — three weeks after the fix it
needed had already shipped upstream. Nothing checked that a scaffold pin was
still current **at release time**, and the failure was invisible to every other
gate (build, typecheck, and link check all pass; it only shows in a browser).

This is a different question from `check:pin-parity` above. Pin parity asks "do
`scaffold.ts` and the rest of the repo agree with each other?" (internal
consistency). This gate asks "is what they agree on still current on npm?"
(freshness against the registry) — and it deliberately does **not** relax any
pin to a caret; #3455 explicitly rejected that option, since `scaffold.ts`'s
exact-pin literals are a reproducibility guarantee (see `check:pin-parity`'s own
documentation). The fix for a stale pin is always to bump the exact literal.

**Where it runs:**

- **`.github/workflows/publish-create-zudo-doc.yml`, "[Safeguard] Scaffold pin
  freshness"** — the real enforcement point. `scripts/release-create-zudo-doc.sh` only
  *prepares* a release (rewrites pins, bumps versions); publication happens later, and a
  pin can go stale in that gap. This step runs before every new publish (including a
  `dry_run`, so a dry run proves this safeguard too) and blocks the release if it fails.
  A resume of an already-published version does not re-judge the pins it shipped.
- **`scripts/release-create-zudo-doc.sh`** — the same check runs as an early
  preflight in the real (non-`DRY=1`) path, before any file is bumped. This is
  early feedback only, not the enforcement point: a release author learns about
  a stale pin while preparing instead of days later at publish time.
- **By hand:** `pnpm check:scaffold-pin-freshness`.

**Deliberately NOT a PR gate.** It does not run in `pr-checks.yml` and is not
part of the `scripts/run-b4push.sh` guard region (so the
`check:b4push-ci-parity` meta-check has nothing to reconcile it against). Two
independent reasons: an upstream publish must never block an unrelated PR, and
the check makes a live call to the npm registry — the opposite of the
deterministic, offline-friendly checks that gate routine PRs and pushes.

**What a failure means:** the scaffold would ship (or just shipped, in the
release-script case) a pin behind what the registry actually has — a fresh
`create-zudo-doc` scaffold would install an out-of-date `@takazudo/zfb` (or
whichever pinned package went stale), reproducing the #3442 shape.

**Remedy:** bump the stale pin — `/dev-bump-zudo-deps`, or by hand — then
re-run `pnpm check:pin-parity` to confirm the bump kept every pin location in
agreement (see "Bumping the toolchain" above), and re-run
`pnpm check:scaffold-pin-freshness` to confirm the gate now passes.

**First-party peer-range freshness (#4065).** This same release-time gate also
checks whether the `packages/zudo-doc/package.json` declaration still admits the
registry's current channel version. The scope is deliberately all five
first-party peers; the optional history-server peer is included even though its
floor trails the lockstep release by design (see "First-party peer floor
(publish-lag)"). Each currently has a stable range, so its channel source is
the stable `latest` dist-tag:

| First-party peer | Channel source today |
|---|---|
| `@takazudo/zdtp` | `latest` |
| `@takazudo/zfb` | `latest` |
| `@takazudo/zfb-md-wasm` | `latest` |
| `@takazudo/zfb-runtime` | `latest` |
| `@takazudo/zudo-doc-history-server` | `latest` |

If a declared range or its scaffold pin carries a prerelease, the check selects
the `next` dist-tag for that peer, reusing the pin gate's existing rule: a
missing `next` falls back to a prerelease `latest`, and otherwise reports
`skipped` when `latest` is stable. Range membership uses npm semver semantics,
including prerelease rules. A registry version outside a declared range is
reported as the distinct `peer-range-excludes-latest` finding, naming the range
and version and directing the release author to verify compatibility before
widening or updating the peer declaration. An invalid range is reported as
`invalid-range`; a network or unusable registry response remains the separate
fail-closed `lookup-error` finding.

At a major bump the history-server range is raised to the in-flight major in the release
commit (see "First-party peer floor (publish-lag)", rule 4) and is therefore
`peer-range-excludes-latest` until `@takazudo/zudo-doc-history-server@<new major>` is on
`latest`. The publish-time freshness safeguard runs after that publish by the mandated order, so it passes; if it
fails with this finding on a major, the 6a publishes have not landed yet — publish them
and re-run, do not touch the range.

**Prerelease pins read the `next` dist-tag, not `latest`.** A pin carrying a
`-prerelease` suffix (e.g. `0.2.0-next.9`) is compared against the registry's
`next` dist-tag. As the "dist-tag table" section above documents, `next` and
`latest` are two permanently-diverging channels once a package has any stable
release — `next` is not "the version after latest," it is a separate, often
much *older*, opt-in preview line. Comparing every pin against `latest`
unconditionally would misfire on a correct prerelease pin, flagging it "stale"
against a numerically higher stable `latest` it was never meant to track — the
same `next`/`latest` divergence #3442 named as the likely cause of the original
gap. If the registry has no `next` tag at all for a prerelease pin, it depends
on `latest`: when `latest` is itself a prerelease the package has no stable
line and `latest` *is* the preview channel, so it becomes the comparison
target; when `latest` is stable, the package is reported "skipped," not stale,
not a failure.

**Blind spot: same-core prerelease drift is announced, not silently passed
(#3475).** The gate compares versions on their numeric `MAJOR.MINOR.PATCH`
core only (mirroring `check:pin-parity`'s core-only convention), dropping the
prerelease identifier. Two prereleases sharing a core therefore compare
equal by that check alone — e.g. pin `0.2.0-next.9` against a registry
`next` of `0.2.0-next.20`. A core-level bump (`0.2.0-next.9` →
`0.3.0-next.1`) is still caught as `stale`; only a same-core prerelease
drift is invisible to the numeric comparison. Rather than reporting that
case `ok` (a false pass — the pin could be many prereleases behind), the
gate reports it **`skipped`**, with a warning naming the package, the pin,
and the registry target, saying freshness was **not** verified and must be
checked by hand. An exactly-identical prerelease pin (same core *and* same
full version string) still reports `ok` — nothing to warn about there, and
warning on a genuine match would just train people to ignore the gate.
`skipped` does **not** fail the gate (see the next paragraph for the
`lookup-error` contrast) — it is a known coverage limit, not a confirmed
staleness. This was a deliberate scope decision (#3469): real semver §11
prerelease-identifier comparison would close the gap fully, but it was
rejected as diverging from `check:pin-parity`'s core-only convention and
pulling that script into scope too. If `check:pin-parity` ever adopts real
prerelease comparison, this gate should move with it.

**Fails closed on a registry error.** A lookup failure (network error, timeout,
unusable response) blocks the gate the same as a confirmed-stale pin, but is
reported as a distinct finding kind ("lookup-error" vs. "stale") — a release
blocked by a flaky registry is recoverable by retrying; a stale release already
published to npm is not.

---

## Scaffold pin published gate

`scripts/check-scaffold-pin-published.mjs` (`pnpm check:scaffold-pin-published`)
answers a different release-window question from the freshness gate above:
does every internal package pin emitted by `scaffold.ts` have at least one
published npm version satisfying its caret range? A release can legitimately
create a new range before that version is published, so this check must tolerate
the short window between bumping pins and publishing the packages.

**Where it runs:**

- **Nightly Exam** — `.github/workflows/exam.yml` runs the check directly with
  Node, without installing dependencies. This is the routine enforcement point
  once the previous release should be live on npm; a failure sends the usual
  IFTTT notification.
- **`scripts/run-b4push.sh`** — the check is step 18, after the
  `b4push-ci-parity:guards:end` marker. The release sequence is
  `bump pins → b4push → publish`, so the release instructions run
  `B4PUSH_SKIP_PIN_PUBLISHED=1 pnpm b4push` during that intentional window.
- **`scripts/release-create-zudo-doc.sh`** — the check also runs in the
  preflight, before any version bump. It catches an unpublished pin left behind
  by an aborted earlier release.
- **By hand:** `pnpm check:scaffold-pin-published`.

**Deliberately NOT a PR gate.** This check makes live npm registry calls, and a
new scaffold pin is expected to be unpublished while its release is in flight.
Making it a normal PR or unconditionally blocking b4push would create the same
publish-lag deadlock described in the pin-parity section: the release could not
pass its checks until after publication, but publication requires the checked
commit first. The b4push escape is limited to the release workflow; nightly
enforcement and the release preflight still catch a pin that remains unpublished
outside that window.

**What a failure means:** at least one scaffold pin has no satisfying version on
the npm registry, or the registry lookup failed. For a release in progress, use
the documented b4push escape and publish the packages in the required order. For
an ordinary nightly or preflight failure, finish or roll back the pending release,
then re-run `pnpm check:scaffold-pin-published`.

---

## Tag namespaces and release initiation

Each package has its own tag namespace and its own publish workflow. Publishing a
GitHub Release starts all three workflows; only the one whose namespace matches runs
(the guard re-checks it with an anchored pattern) and the other two skip NEUTRAL:

| Package | Tag namespace | Example tag | Workflow |
|---|---|---|---|
| `create-zudo-doc` | `v*` | `v0.2.0-next.1` | `publish-create-zudo-doc.yml` |
| `@takazudo/zudo-doc` | `zudo-doc-v*` | `zudo-doc-v0.2.0-next.1` | `publish-zudo-doc.yml` |
| `@takazudo/zudo-doc-history-server` | `zudo-doc-history-server-*` | `zudo-doc-history-server-0.2.0-next.1` | `publish-zudo-doc-history-server.yml` |

The `zudo-doc-v` prefix keeps `@takazudo/zudo-doc` tags distinct from the bare `v*`
namespace so a single tag always runs exactly one publish job.

Create exactly one GitHub Release per tag, as a draft. Reviewing the draft and publishing
it is the human gate and the normal initiation; an unpublished draft fires no workflow.
Release events created by a workflow's `GITHUB_TOKEN` start no workflow, and a release that
is already published never fires again — in both cases initiate (or resume) explicitly with
`workflow_dispatch` on the tag. Never create a second release for a tag to re-trigger.

---

## Retired: local npm credential maintenance

Earlier runbooks re-pointed `latest` with `scripts/release-bootstrap-latest.mjs` and cleared a
stale `next` (#2121) with `npm dist-tag rm` from a shell holding an npm Automation token.
Both routes are retired with the token (#4745). Channel repair and stale-`next` removal now
happen only inside the publish workflows through OIDC; to run them for an existing version,
dispatch the package's workflow on its tag (see "How `latest` stays current" → "Manual
remediation"). Nothing in this repository needs `npm login` or an npm token.
