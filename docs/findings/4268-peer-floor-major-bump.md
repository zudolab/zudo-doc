# Peer floor at a major bump — is rule 4 over-broad, or did the posture change?

Findings for #4280 (wave 1 of epic #4279, superseding #4268). Investigated 2026-09-19 against
`base/sweep-260919-peer-floor-major` (`3a5d3a8a9`), repo version 5.25.0, pnpm 10.30.3.

**No production code was changed by this investigation.** `RELEASE.md`,
`scripts/check-pin-parity.mjs`, and every test are untouched.

## Verdict

**Rule 4's stated rationale is false, and the posture did not change.** Neither half of
`RELEASE.md`'s justification holds: the showcase does *not* resolve
`@takazudo/zudo-doc-history-server` from the npm registry (it is a `workspace:*` link, and has
been at every major bump), and `--frozen-lockfile` predates v5.0.0 everywhere rather than
arriving after it. A peer range declared by a *workspace* package is not a lockfile input at
all, so no install — frozen or not — can be affected by its value. This was tested, not
reasoned about: three arms plus a full from-scratch re-resolution against the live registry,
all green, all producing a byte-identical lockfile.

**But rule 4 is not baseless — its real teeth are somewhere else, and they are new.**
`scripts/check-scaffold-pin-freshness.mjs` gained a first-party *peer range* rule on
**2026-09-08** (`d39e47b99`), one month ago and after every major bump in the repo's history.
That check does fail on floor `^6.0.0`. Of the gates enumerated in §5 it is the only one that does. It runs in
exactly two places, and in both of them the publish ordering has already put the target on npm.

So the accurate statement is narrower than rule 4 and narrower than the epic's framing: raising
the floor to the in-flight major **does not deadlock anything**; it makes one registry-facing
advisory red during the window between the release commit and the first publish, and that gate
does not run during that window.

## 1. `--frozen-lockfile` — dated, and it predates v5.0.0 everywhere

`git log -S "frozen-lockfile"` per file, earliest introduction:

| Install site | First used `--frozen-lockfile` | vs v5.0.0 (2026-08-04) |
|---|---|---|
| `.github/workflows/pr-checks.yml` | `298954802` 2026-03-11 | **before** |
| `.github/workflows/main-deploy.yml` | `298954802` 2026-03-11 | **before** |
| `.github/workflows/preview-deploy.yml` | `298954802` 2026-03-11 | **before** |
| `.github/workflows/publish-create-zudo-doc.yml` | `047ccccfb` 2026-05-26 | **before** |
| `.github/workflows/publish-zudo-doc.yml` | `047ccccfb` 2026-05-26 | **before** |
| `.github/workflows/publish-zudo-doc-history-server.yml` | `047ccccfb` 2026-05-26 | **before** |
| `.github/workflows/exam.yml` | `903c2309d` 2026-06-13 | **before** |

Direct confirmation at the v5.0.0 commit: `git show a93dfa6b5:.github/workflows/pr-checks.yml`
contains 11 occurrences of `frozen-lockfile`, `main-deploy.yml` 4. No local script uses
`--frozen-lockfile`; `scripts/run-b4push.sh` does not install.

**The "`--frozen-lockfile` everywhere arrived after 2026-08-04" reading in #4279 is wrong.**
It was already everywhere at v3.0.0 (2026-07-07), and everywhere but `exam.yml` at the repo's
very first CI.

## 2. The showcase peer is a workspace link, not a registry resolution — at HEAD and at every major bump

`RELEASE.md`: *"The showcase resolves this peer from the **npm registry** (not a workspace
link)."* This is contradicted by the manifest and the lockfile:

- `packages/zudo-doc/package.json:781` — `"@takazudo/zudo-doc-history-server": "workspace:*"` in
  `devDependencies`.
- `packages/zudo-doc/package.json:748` — the peer is declared **optional** via
  `peerDependenciesMeta`, so `auto-install-peers=true` in `.npmrc` does not fetch it either.
- `pnpm-lock.yaml:241-243` — the sole occurrence in the whole lockfile:
  `specifier: workspace:*` / `version: link:../doc-history-server`.

It was the same at all three major bumps (`git show <sha>:pnpm-lock.yaml`):

| tag | commit | lockfile resolution |
|---|---|---|
| v3.0.0 | `7437bb25f` | `specifier: workspace:*` → `link:../doc-history-server` |
| v4.0.0 | `53cbe5898` | `specifier: workspace:*` → `link:../doc-history-server` |
| v5.0.0 | `a93dfa6b5` | `specifier: workspace:*` → `link:../doc-history-server` |

`git log -S '"@takazudo/zudo-doc-history-server": "workspace:*"'` reaches back to `07a98c117`
(2026-07-02) and no further, because that is when the line last moved — it was already present
before that.

**Neither half of rule 4's rationale describes a change that happened after 2026-08-04.**

### The mechanism: a workspace package's peer range is not a lockfile input

`pnpm-lock.yaml` is `lockfileVersion: '9.0'`. Every `importers:` entry in it carries exactly two
keys — `dependencies:` and `devDependencies:` (verified by scanning the whole importers block).
`peerDependencies` of a workspace package appear nowhere. Editing the floor therefore cannot
make the lockfile stale, and `--frozen-lockfile` has nothing to compare against.

## 3. What actually happened at v3/v4/v5 — every publish green

`gh run list --commit <full-sha>`:

- **v4.0.0 `53cbe5898`** — `Publish zudo-doc-history-server` success, `Publish zudo-doc` success,
  `Publish create-zudo-doc` success, `Production Deploy` success. (Three skipped rows per tag are
  the other two workflows' tag-guard no-ops.)
- **v5.0.0 `a93dfa6b5`** — same three publishes success, `Production Deploy` success. One
  `Nightly Exam` failure, whose failing job is `zudo-doc Slow Tests` (run `30844502255`) —
  unrelated to pins or installs.
- **v3.0.0 `7437bb25f`** — only a `PR Checks` success on `base/color-ramp-restructure` is still
  retained; the release-time runs have aged out of the Actions retention window. Evidence for
  v3.0.0 is therefore thinner than for v4/v5.

No install failed. There was no red window.

Caveat on how much this proves: the registry-facing peer gate did not exist yet at any of these
(see §6), so v3/v4/v5 shipping green shows the *install* half is safe, not that today's full gate
set would be. That is what §4 and §5 are for.

## 4. The experiment — three arms, all green

Scratch clone of this branch at `/tmp/claude-1000/lockfile-probe-scratch` (working tree never
mutated). `npm view @takazudo/zudo-doc-history-server version` → `5.25.0`; zero `6.x` versions
published, so `^6.0.0` genuinely names an unpublished version. Each arm sets `version: "6.0.0"`
in all four manifests (root + the three packages), mirroring what `a93dfa6b5` did.

| Arm | Setup | Command | Result |
|---|---|---|---|
| **Control** | floor `^5.17.2`, lockfile regenerated | `pnpm install --no-frozen-lockfile --ignore-scripts` | **exit 0**, `Done in 4.1s`; lockfile byte-identical to original |
| **B** | floor `^6.0.0`, lockfile regenerated | `pnpm install --no-frozen-lockfile --ignore-scripts` | **exit 0**, `Lockfile is up to date, resolution step is skipped` / `Already up to date`; lockfile byte-identical |
| **C** | floor `^6.0.0`, **frozen** against the original lockfile | `pnpm install --frozen-lockfile --ignore-scripts` | **exit 0**, `Lockfile is up to date, resolution step is skipped`; no mismatch raised |

The only stderr in arms B and C was two `WARN Failed to create bin at .../doc-history-server`
`ENOENT` lines — a consequence of `--ignore-scripts` skipping the package's `prepare` build, not
of resolution.

**Arm C did not even produce the mismatch the issue predicted.** The predicted failure mode
("manifest/lockfile mismatch") requires the edited field to be a lockfile input, and §2 shows it
is not. So there is no mismatch to catch, and C is not merely weak evidence for rule 4 — it is
evidence against it.

### Arm B-hard: full re-resolution against the live registry

Because arms B and C both short-circuited on `Lockfile is up to date`, they do not by themselves
prove that *resolution* tolerates the unpublished floor. So, still at floor `^6.0.0` and root
`6.0.0`:

```
rm -f pnpm-lock.yaml
pnpm install --lockfile-only
```

→ **exit 0**, `resolved 458, reused 0, downloaded 0, added 0, done`, `Done in 5.4s`. The
regenerated lockfile is **byte-identical** to the original, and still contains no `6.x`
history-server entry. A full from-scratch resolution against the live npm registry, with the
floor naming a version that does not exist there, succeeds and changes nothing.

## 5. What actually breaks today, and where

Arm B carried to a fully release-prepped state — root `6.0.0`, floor `^6.0.0`,
`approvedBaseline` raised to `"^6.0.0"` in the same edit (rule 5), `scaffold.ts` pins and the
`target-manifest` fixture bumped to `^6.0.0` as `scripts/release-create-zudo-doc.sh` does:

| Gate | Where it runs | Result at floor `^6.0.0` |
|---|---|---|
| `pnpm install` (any mode) | local, PR Checks, Production Deploy, all 3 publish workflows | **passes** (§4) |
| `scripts/check-pin-parity.mjs` | `pr-checks.yml` job `check-pin-parity` (no install), `run-b4push.sh` step 4 | **passes** — `peerDependencies[@takazudo/zudo-doc-history-server] = ^6.0.0 (matched ^6.0.0)`, exit 0 |
| `scripts/check-scaffold-pin-freshness.mjs` | `release-create-zudo-doc.sh:210` (preflight, pre-bump), `publish-create-zudo-doc.yml:190` Safeguard 4/5 | **FAILS**, exit 1 — `PEER @takazudo/zudo-doc-history-server declared peer range "^6.0.0" EXCLUDES registry "latest" 5.25.0` |
| `scripts/check-scaffold-pin-published.mjs` | `run-b4push.sh` step 19, `exam.yml` job `scaffold-pin-published` | **FAILS**, exit 1 — but on the **scaffold** pins (`@takazudo/zudo-doc ^6.0.0`, `@takazudo/zudo-doc-history-server ^6.0.0`), not on the peer floor. Pre-existing and already accounted for (below). |
| `publish-zudo-doc.yml`, `publish-zudo-doc-history-server.yml` | on their tags | **pass** — 4 safeguards each, no freshness gate at all |

One gate was **not** run (the task forbids the test suite): `scripts/__tests__/check-pin-parity.test.ts`
contains "the live tree still matches every approved baseline", which compares
`packages/zudo-doc/package.json` against `FIRST_PARTY_PEER_CHECKS[].approvedBaseline`. A rule-5
compliant raise edits both in the same commit, so it should stay green — by inspection, not by
execution.

So the answer to "which of main CI, each publish workflow, local b4push would fail": **main CI
would not fail, local `b4push` would not fail on account of the peer floor, and no publish
workflow would fail.** The single peer-floor-specific red is `check:scaffold-pin-freshness`,
which runs in the release script's *pre-bump* preflight (where the floor is still `^5.17.2`) and
in `publish-create-zudo-doc.yml` Safeguard 4 (where, per §6, the target is already published).

### The repo already has a precedent for pointing at an unpublished in-flight version

`scripts/run-b4push.sh:318-322`, verbatim:

> *This live npm-registry check belongs outside the parity guard region: the scaffold
> intentionally points at the in-flight release version before that version is published.
> Release callers opt out during that window; nightly exam and the release preflight enforce it
> when a published pin is expected.*

The opt-out is `B4PUSH_SKIP_PIN_PUBLISHED=1`, and `scripts/release-create-zudo-doc.sh` prints it
as the mandatory step 4 of every release: `B4PUSH_SKIP_PIN_PUBLISHED=1 pnpm b4push`. Every
release already names an unpublished version in `scaffold.ts` and already suspends the
registry-facing guard for the window. Rule 4 forbids for the peer floor precisely what the
scaffold pin does on every single release.

## 6. Publish order closes the window — checked in all three workflows

`scripts/release-create-zudo-doc.sh:380-390` prints the required order:

> *Publish ORDER matters — zudo-doc and zudo-doc-history-server first, then create-zudo-doc*
> … *6b. **After 6a is live on npm**: `git tag v$NEW_VERSION` …*

- `publish-zudo-doc-history-server.yml` — 4 safeguards (tag regex, version-matches-tag,
  not-already-published, dry-run). No freshness gate. Installs at line 144. Publishes
  `@takazudo/zudo-doc-history-server@6.0.0`.
- `publish-zudo-doc.yml` — same 4 safeguards, no freshness gate, installs at line 170.
- `publish-create-zudo-doc.yml` — 5 safeguards. `Install dependencies` at line 150 runs *before*
  Safeguard 4/5 (as the issue notes), but §4 shows that install is unaffected. Safeguard 4/5
  (line 190) is the only `check:scaffold-pin-freshness` invocation in CI, and by the time it runs
  the 6a publishes have already put `6.0.0` on npm as `latest`, so the PEER rule compares
  `^6.0.0` against registry `latest` `6.0.0` and passes.

**The ordering does close the gap.** The floor names an unpublished version only between the
release commit and the 6a publish, and no gate that runs in that window inspects it.

## 7. Dating summary — what is genuinely new

| Artifact | Commit | Date | vs v5.0.0 |
|---|---|---|---|
| `--frozen-lockfile` (PR/main/preview CI) | `298954802` | 2026-03-11 | before |
| `--frozen-lockfile` (all 3 publish workflows) | `047ccccfb` | 2026-05-26 | before |
| `scripts/check-pin-parity.mjs` created | `5462247c1` | 2026-05-26 | before |
| `--frozen-lockfile` (exam) | `903c2309d` | 2026-06-13 | before |
| pin-parity peer floor switched `exact` → `satisfies` | `2bb3ca98f` | 2026-06-30 | before |
| `check-scaffold-pin-freshness.mjs` created | `2ba9b5d78` | 2026-08-18 | **after** |
| freshness gate wired into publish + prepare | `87eafbddd` | 2026-08-18 | **after** |
| `check-scaffold-pin-published.mjs` created | `4bdc37132` | 2026-08-20 | **after** |
| **freshness checks first-party PEER ranges** | **`d39e47b99`** | **2026-09-08** | **after** |
| peer floor contract rewritten into `RELEASE.md` | `2589d5d6e` | 2026-09-18 | **after** |
| `approvedBaseline` gate | `2ca40d18e` | 2026-09-18 | **after** |

The epic asks whether the posture changed. It did — but not the posture rule 4 names. The
lockfile posture is unchanged since before v3.0.0. What is new is `d39e47b99` (2026-09-08),
eleven days before this investigation, which taught the registry-facing freshness gate to
inspect first-party peer *ranges*. That is the only mechanism by which floor `^6.0.0` is red
anywhere, and it postdates all five majors.

## 8. Established vs inferred

**Established by direct evidence:**

- `--frozen-lockfile` predates v5.0.0 at every install site (§1, git).
- The showcase peer is a `workspace:*` link and an *optional* peer, at HEAD and at all three
  major commits (§2, manifest + lockfile at each SHA).
- A workspace package's `peerDependencies` are absent from `pnpm-lock.yaml` importers (§2).
- Neither a frozen nor a regenerating nor a from-scratch install fails with floor `^6.0.0` (§4,
  four runs, exit 0 each, byte-identical lockfile).
- `check-pin-parity.mjs` passes at root `6.0.0` / floor `^6.0.0` / baseline `^6.0.0` (§5, exit 0).
- `check-scaffold-pin-freshness.mjs` fails on the peer range, exit 1, with the quoted message
  (§5).
- v4.0.0 and v5.0.0 publishes and Production Deploy were all green (§3, `gh run list`).
- The peer-range freshness rule dates to 2026-09-08 (§7, `git log -S FIRST_PARTY_PEER_SCOPE`).

**Inferred, not directly run:**

- That `publish-create-zudo-doc.yml` Safeguard 4 would *pass* at a real 6.0.0 release. This
  follows from the documented publish order plus the freshness check's "registry latest"
  comparison, but it cannot be exercised without actually publishing a 6.0.0. **Thin — and it is
  the single load-bearing inference in §6.** If a release author ever runs 6b before 6a, or
  publishes history-server under a non-`latest` dist-tag, this inference fails and Safeguard 4
  goes red.
- That v3.0.0 shipped green. Its release-time runs have aged out; only a PR Checks success
  remains (§3).
- That no gate outside this repo (a downstream consumer installing `@takazudo/zudo-doc@6.0.0`
  from npm with an unpublished `^6.0.0` optional peer) is affected. Not tested. The peer is
  optional, so pnpm's `auto-install-peers` should skip it, but a consumer using npm rather than
  pnpm was not probed.

## 9. Where this contradicts the framing the epic was written under

Loudly, because it changes which remedy is correct:

1. **#4279's reading 2 ("the posture changed — `--frozen-lockfile` everywhere plus the
   registry-resolved showcase peer arrived after 2026-08-04") is false on both clauses.**
   Frozen installs predate v3.0.0; the peer was never registry-resolved.
2. **`RELEASE.md`'s sentence "Raising the floor to the in-flight release version makes the frozen
   lockfile unresolvable and deadlocks both main CI and the publish workflows" is not true of any
   of the three named systems.** The lockfile is unaffected, main CI has no gate that looks at
   the floor, and no publish workflow fails. The sentence names the wrong mechanism entirely.
3. **Rule 4 is over-broad as written, but not empty.** There is a real constraint — it is just
   "the freshness gate's PEER rule is red while the target is unpublished", it is one month old,
   it is advisory-shaped, and the release's own publish ordering already resolves it before the
   only CI invocation.
4. **The repo's own b4push comment already articulates the correct shape of the exception** (§5).
   A remedy that mirrors `B4PUSH_SKIP_PIN_PUBLISHED`'s window-scoped opt-out is consistent with
   how the scaffold pin already works; a remedy built on the lockfile claim would be built on a
   fact that is not true.

A caution for wave 2: nothing above says the floor *should* be raised at a major. It says the
stated reason it cannot be is wrong. The epic's own risk note — keep the guard's founding case,
a genuinely stale cross-major floor, still caught — is untouched by these findings.

## Reproducing

```sh
git clone --no-hardlinks <this branch> /tmp/scratch && cd /tmp/scratch
node -e 'for (const p of ["package.json","packages/zudo-doc/package.json","packages/doc-history-server/package.json","packages/create-zudo-doc/package.json"]) { const j=require("fs").readFileSync(p,"utf8"), o=JSON.parse(j); o.version="6.0.0"; if (o.peerDependencies?.["@takazudo/zudo-doc-history-server"]) o.peerDependencies["@takazudo/zudo-doc-history-server"]="^6.0.0"; require("fs").writeFileSync(p, JSON.stringify(o,null,2)+"\n"); }'
rm -f pnpm-lock.yaml && pnpm install --lockfile-only   # exit 0, lockfile unchanged
node scripts/check-scaffold-pin-freshness.mjs          # exit 1, PEER rule
```
