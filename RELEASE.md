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

**`next` is removed on stable graduation.** When a clean `X.Y.Z` publish
graduates the prerelease line, each publish workflow runs an extra step that
removes the `next` dist-tag (`npm dist-tag rm <pkg> next`). This prevents
`npm install <pkg>@next` from silently resolving to a stale prerelease. The
step is idempotent and non-fatal — if `next` does not exist (e.g. the first
stable release ever), the step logs a notice and succeeds anyway.

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

If `latest` is ever stranded behind the newest version (e.g. the #1999 state
before the first clean release), the standing fix is simply to **ship a clean
version** — it routes to `latest` automatically through the normal publish path.
As a stopgap when you cannot cut a release immediately, re-point `latest` directly:

```sh
npm dist-tag add create-zudo-doc@<ver> latest
npm dist-tag add @takazudo/zudo-doc@<ver> latest
npm dist-tag add @takazudo/zudo-doc-history-server@<ver> latest
```

Replace `<ver>` with the exact version string (no leading `v`), e.g. `0.2.0`. The
helper `scripts/release-bootstrap-latest.mjs <ver>` runs all three with retries.

---

## Dry-run auth smoke

Each publish workflow supports a `workflow_dispatch` with `dry_run: true`. In this
mode the workflow verifies that `NPM_TOKEN` authenticates against the registry via
`npm whoami`, then stops without publishing anything.

**Caveat:** the dry-run must target the *candidate* tag or ref — NOT `main` and NOT
an already-published tag. The reason is ordering: the workflow runs a "version not
already published" safeguard (Safeguard 3) *before* the dry-run/auth step
(Safeguard 5). An already-published tag triggers a hard failure at Safeguard 3 and
the auth smoke is never reached. Similarly, dispatching from `main` fails at
Safeguard 1 (tag-shape check) before auth is tested.

Scaffold pin freshness (Safeguard 4) also runs before the auth step, unconditionally
— see "Scaffold pin freshness gate" below.

Correct dry-run target: a tag or branch pointing at the candidate commit whose
version has been bumped in `package.json` but not yet published to npm.

---

## Publish order

**Always publish `@takazudo/zudo-doc-history-server` and `@takazudo/zudo-doc`
before `create-zudo-doc`.**

The scaffold tool pins a specific `@takazudo/zudo-doc` version in the generated
downstream `package.json`. If `create-zudo-doc` is published first and a user runs
the scaffold before the peer packages land on npm, `pnpm install` in the new project
fails with a 404 on the pinned `@takazudo/zudo-doc` version.

All three packages are versioned and released in lockstep. Recommended sequence:

1. Tag `zudo-doc-history-server-X.Y.Z` and publish the GitHub Draft Release for
   `@takazudo/zudo-doc-history-server`. Wait for the CI publish to succeed.
2. Tag `zudo-doc-vX.Y.Z` and publish the Draft Release for `@takazudo/zudo-doc`.
   Wait for the CI publish to succeed.
3. Tag `vX.Y.Z` and publish the Draft Release for `create-zudo-doc`.

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

After authoring all six entries, run `pnpm gen:changelog` and stage all three generated
outputs. When creating GitHub releases, extract three independent note bodies and map
each one to the tag in the table. Never reuse one shared `$NOTES` value across tags.
Titles are `@takazudo/zudo-doc-history-server <version>`,
`@takazudo/zudo-doc <version>`, and `create-zudo-doc <version>`. Versions containing a
hyphen are prereleases and each `gh release create` command must include `--prerelease`.

---

## First-party peer floor (publish-lag)

`packages/zudo-doc/package.json` declares `@takazudo/zudo-doc-history-server` as a
**peerDependency** with a caret floor (e.g. `^2.0.1`). The showcase resolves this
peer from the **npm registry** (not a workspace link), and every install — local,
CI, and the publish workflows — runs `pnpm install --frozen-lockfile`. So the floor
can only ever name an **already-published** version.

**Do NOT bump this floor to the in-flight release version during a release.** The
release script (`scripts/release-create-zudo-doc.sh`) deliberately does **not**
touch it: bumping it to the version being released (not yet on npm) makes the frozen
lockfile unresolvable and deadlocks both main CI and the publish workflows.

Instead the floor **lags by design**, permanently. A lagging same-major floor is
correct: `^2.0.1` is satisfied by a `@takazudo/zudo-doc@2.1.0` install.

**Do not chase the advisory — the loop does not converge.** Raising the floor to
match the just-published version clears the note, but the *next* release moves the
version past it again and the note returns. That is structural, not drift: the
floor can only ever name an already-published version, so it trails the in-flight
one by exactly one release forever. (Learned the hard way in 5.1.1, which exists
mostly because the 5.1.0 advisory was mistaken for a chore.)

Raise the floor only when there is a real reason — a genuine minimum-version
requirement, or approaching cross-major staleness. The check errors on its own
when the floor stops including the root version; until it does, no action.

The pin-parity guard (`scripts/check-pin-parity.mjs`) enforces this with
**satisfies-semantics** for the lockstep peer: it fails only when the floor would
**exclude** the root version (a cross-major drift like `^1.x` at root `2.x`, or a
floor above root like `^2.2.0` at root `2.1.0`), and prints a non-fatal advisory
when a valid floor lags. A clean linear release therefore needs no interleaving:

> bump versions + scaffold pins → `pnpm b4push` → commit → push → main CI green →
> tag → publish all three in publish-order.

---

## Bumping the toolchain (`@takazudo/*` upstream pins)

Bump the upstream deps (`/dev-bump-zudo-deps`, or by hand), then run:

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
  see "First-party peer floor (publish-lag)" above. Its trailing-by-one advisory
  is the normal steady state, not a chore.

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

- **`.github/workflows/publish-create-zudo-doc.yml`, Safeguard 4/5** — the real
  enforcement point. `scripts/release-create-zudo-doc.sh` only *prepares* a
  release (rewrites pins, bumps versions); publication happens later, when a
  human publishes the GitHub Draft Release, and a pin can go stale in that gap.
  This step runs unconditionally, immediately before `npm publish` (including on
  a `dry_run`, so a dry run proves this safeguard too) and blocks the release if
  it fails.
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

## Tag namespaces and Draft Release model

Each package has its own tag namespace and its own publish workflow. Publishing a
GitHub Draft Release fires exactly one workflow — the one whose Safeguard 1 tag
pattern matches the tag:

| Package | Tag namespace | Example tag |
|---|---|---|
| `create-zudo-doc` | `v*` | `v0.2.0-next.1` |
| `@takazudo/zudo-doc` | `zudo-doc-v*` | `zudo-doc-v0.2.0-next.1` |
| `@takazudo/zudo-doc-history-server` | `zudo-doc-history-server-*` | `zudo-doc-history-server-0.2.0-next.1` |

The `zudo-doc-v` prefix keeps `@takazudo/zudo-doc` tags distinct from the bare `v*`
namespace so a single tag dispatch always fires exactly one workflow. The anchored
regex in each workflow's Safeguard 1 rejects tags that match a sibling namespace.

Create one GitHub Draft Release per package. The draft is the human gate: reviewing
the draft and clicking "Publish release" is the irreversible action that triggers CI
to call `npm publish`. An unpublished draft fires no workflow.

---

## `release-bootstrap-latest.mjs` — one-time remediation helper

`scripts/release-bootstrap-latest.mjs <version>` re-points the `latest` dist-tag
of all three packages to a given already-published version, with retries. It does
**not** publish anything — it only moves dist-tags.

Under Scheme B this is **not part of the normal release flow** (a clean release
moves `latest` on its own). Keep it for one-time remediation of a stranded
`latest` — most relevantly, to unstick the current `latest = 0.1.0`
(zudolab/zudo-doc#1999) if the fix is needed before the first clean `0.2.0` ships:

```sh
node scripts/release-bootstrap-latest.mjs 0.2.0-next.9
```

It is idempotent: re-running with the same version is a no-op. The **preferred**
fix, though, is simply to ship a clean version (e.g. `0.2.0`), which supersedes the
stranded tag through the normal publish path.

---

## One-time manual cleanup: remove stale `next` dist-tag (#2121)

As of the first stable `0.2.x` graduation, the `next` dist-tag on all three
packages is frozen at `0.2.0-next.9` — a stale prerelease from before Scheme B
was adopted. The publish workflows now automatically remove `next` on each future
stable graduation (see the dist-tag table note above), but the **currently-stale
tag must be cleared once by a maintainer**:

```sh
npm dist-tag rm @takazudo/zudo-doc next
npm dist-tag rm @takazudo/zudo-doc-history-server next
npm dist-tag rm create-zudo-doc next
```

Run these from any machine with an npm Automation token (`npm login` or
`NPM_TOKEN` set). Each command is idempotent — safe to re-run if the tag has
already been removed.
