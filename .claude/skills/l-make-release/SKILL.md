---
name: l-make-release
description: >-
  Orchestrate a create-zudo-doc release: bump versions, fill changelog,
  validate, commit, push, wait for CI, tag all three lockstep packages, create a
  GitHub release for each, and publish them to npm. Autonomous by default — no
  confirmation prompts; pass --confirm to gate the irreversible npm publish.
  Use when: (1) User says 'make release', 'l-make-release', or 'release create-zudo-doc',
  (2) User wants to publish a new version of the create-zudo-doc npm package.
user-invocable: true
disable-model-invocation: false
argument-description: "Optional: version string or bump mode (e.g. 0.2.0, 1.0.0-next.1, minor, stable), and/or --confirm to ask before publishing to npm"
---

# /l-make-release

Orchestrate the full create-zudo-doc release sequence end-to-end: bump → changelog →
validate → commit → push → CI → tag → create three GitHub releases (one each for
`@takazudo/zudo-doc-history-server`, `@takazudo/zudo-doc`, and `create-zudo-doc`, all in
lockstep at the same version) → **publish all three to npm**. The publish step fires each
package's CI publish workflow and is irreversible.

## Autonomy — runs to a published release by default

**Default behavior is fully autonomous: this skill takes the release all the way to
published on npm without asking the user for permission at any gate** (not at the version
proposal, not at tagging, not at publish). The user invoked `/l-make-release` to get a
release — deliver one.

**`--confirm`** — when this flag is passed, insert a single confirmation gate **right
before the irreversible npm publish** (Step 9): show the version + the three packages + a
one-line changelog summary and ask "Correct — publish now?". Only publish on an
affirmative answer; otherwise stop with the drafts left in place. `--confirm` does NOT add
prompts anywhere else — the rest of the flow stays autonomous.

(Everything before Step 9 — bump, changelog, commit, push, tag, create drafts — is
reversible or local, so it always runs without asking regardless of `--confirm`.)

## Why a new skill — not editing `/zudo-doc-version-bump`

`/zudo-doc-version-bump` is **dual-purpose**: it is also shipped to downstream
scaffolded projects via `create-zudo-doc`. Modifying it risks breaking that
downstream contract. This skill wraps and extends the same release flow for the
`create-zudo-doc` package specifically:

- Bumps **both** root `package.json` **and** `packages/create-zudo-doc/package.json`
  in lockstep (the existing skill only bumps the root).
- Accepts prerelease versions (`1.0.0-next.1`, `1.0.0-beta.2`, `1.0.0-rc.1`) which
  `scripts/version-bump.sh` rejects due to its strict semver regex.
- Drives the release **all the way to published on npm** (three lockstep packages) by
  default — each GitHub release publish fires that package's CI `npm publish` workflow.
  Pass `--confirm` to gate the publish; otherwise it is autonomous.

The existing `/zudo-doc-version-bump` skill is **not modified** by this flow.

## Version scheme

The release script auto-derives the next version from the current one, or accepts
explicit bump modes and version strings:

| Current version   | Mode / arg       | Result              |
|-------------------|------------------|---------------------|
| `X.Y.Z` (stable)  | _(no arg / auto)_ | `X.Y.(Z+1)`        |
| `X.Y.Z-next.N`    | _(no arg / auto)_ | `X.Y.Z` (graduate)  |
| any               | `major`          | `(X+1).0.0`         |
| any               | `minor`          | `X.(Y+1).0`         |
| any               | `patch`          | `X.Y.(Z+1)`         |
| `X.Y.Z` (stable)  | `next`           | `X.(Y+1).0-next.1` |
| `X.Y.Z-next.N`    | `next`           | `X.Y.Z-next.(N+1)` |
| `X.Y.Z-next.N`    | `stable`         | `X.Y.Z`            |
| already stable    | `stable`         | _(error)_           |
| any               | `<semver>`       | use exactly that    |

**Scheme B (pre-1.0):** the `0.x` mainline ships **clean** `0.MINOR.PATCH` — no
`-next` suffix. `major` / `minor` / `patch` and the `auto` default all produce a
clean version (a breaking `0.x` change rides a `minor` bump). The `next` keyword is
the **opt-in** prerelease escape hatch (deliberate previews / the `1.0.0-beta`
run-up); `auto` from an in-flight prerelease **graduates** it to the clean `X.Y.Z`.

### Dry path (compute-only, no mutations)

```bash
# Test auto-derive from a specific version without touching package.json:
DRY=1 FROM=0.2.0-next.9 ./scripts/release-create-zudo-doc.sh
# → next version: 0.2.0 / pin string: ^0.2.0   (auto graduates a prerelease to clean)

DRY=1 FROM=0.2.0 ./scripts/release-create-zudo-doc.sh
# → next version: 0.2.1 / pin string: ^0.2.1   (auto from a stable = patch bump)

DRY=1 FROM=0.2.0 ./scripts/release-create-zudo-doc.sh minor
# → next version: 0.3.0 / pin string: ^0.3.0   (breaking 0.x change = minor bump)
```

## `latest` dist-tag (Scheme B — no bootstrap needed)

Under Scheme B the `0.x` mainline ships clean `X.Y.Z` versions, which the publish
workflow routes to `latest` automatically — there is no dual-tag probe to seed and
no bootstrap step in the normal flow. `scripts/release-bootstrap-latest.mjs` is
retained only as a one-time **remediation** helper for a stranded `latest` (see
RELEASE.md → "`release-bootstrap-latest.mjs`"). The standing fix for a stale
`latest` is simply to ship a clean version.

## Preconditions

Verify ALL of the following before proceeding. If any check fails, stop and tell the user.

1. Current branch is `main`
2. Working tree is clean (`git status --porcelain` returns empty)
3. At least one `v*` tag exists (`git tag -l 'v*'`). If none, ask the user to create
   the initial tag first (e.g. `git tag v0.0.1 && git push --tags`).

Find the latest version tag:

```bash
git tag -l 'v*' --sort=-v:refname | head -1
```

## Step 1 — Propose the new version

If the user passed an explicit version string (`0.2.0`, `1.0.0-next.1`), use it directly.
If the user passed a bump mode keyword (`major`, `minor`, `patch`, `next`, `stable`), pass
it to the script. Otherwise:

```bash
git log <last-tag>..HEAD --oneline
```

Categorize commits by conventional-commit prefix and propose. **During `0.x`
(Scheme B — see "Version scheme")** the major stays at `0` and a breaking change
rides a minor bump, NOT a jump to `1.0.0`:

- Breaking changes (`feat!`, `BREAKING CHANGE`) → `minor` bump (`0.2` → `0.3`)
- Everything else (`feat:`, `fix:`, …) → `patch` bump

(Post-1.0, switch to standard SemVer: breaking → `major`, `feat:` → `minor`,
otherwise → `patch`. The deliberate jump to `1.0.0` itself is always an explicit
`major` / `<semver>` arg.)

For an opt-in preview, propose the `next` keyword (or an explicit `-next.N`).
To preview the computed version without touching any files, use the dry path:

```bash
DRY=1 ./scripts/release-create-zudo-doc.sh [<version>|<mode>]
```

**Announce** the proposed version and proceed — do NOT wait for confirmation (the version
is derived deterministically and everything through Step 8 is reversible). The single
confirmation gate, if `--confirm` was passed, comes at Step 9 before the irreversible
npm publish.

## Step 2 — Run the release script

```bash
./scripts/release-create-zudo-doc.sh [<version>|<mode>]
```

This script (sibling to `version-bump.sh`, does NOT modify it):

1. Computes the next version from the arg or auto-derives it (see "Version scheme" above)
2. Validates the version format (accepts prerelease suffixes)
3. Bumps `package.json` at the root
4. Bumps `packages/create-zudo-doc/package.json`
5. Bumps `packages/zudo-doc/package.json` (W4A — #1732)
6. Bumps `packages/doc-history-server/package.json` (W4A — #1732)
7. Rewrites `@takazudo/zudo-doc` pin in `scaffold.ts` to `^<new-version>` — including
   prerelease versions (e.g. `^0.2.0-next.1`) so a fresh downstream scaffold resolves
   the version being released
8. Scaffolds `src/content/docs/changelog/<NEW_VERSION>.mdx` (EN)
9. Scaffolds `src/content/docs-ja/changelog/<NEW_VERSION>.mdx` (JA)

## Step 3 — Fill in the changelog

Replace the placeholder content in both MDX files with the actual categorized changes
from the commit analysis (Step 1).

### English (`src/content/docs/changelog/<NEW_VERSION>.mdx`)

```mdx
---
title: <NEW_VERSION>
description: Release notes for <NEW_VERSION>.
sidebar_position: <value from script>
---

Released: <YYYY-MM-DD>

### Breaking Changes       ← omit section if empty

- Description (commit-hash)

### Features               ← omit section if empty

- Description (commit-hash)

### Bug Fixes              ← omit section if empty

- Description (commit-hash)

### Other Changes          ← omit section if empty

- Description (commit-hash)
```

### Japanese (`src/content/docs-ja/changelog/<NEW_VERSION>.mdx`)

Mirror the English content in Japanese. Sections: `### 破壊的変更`, `### 機能`,
`### バグ修正`, `### その他の変更`. Use `リリース日: <YYYY-MM-DD>`.

## Step 4 — Validate

```bash
pnpm b4push
```

Fix any failures and recommit before proceeding. Do not tag until b4push is fully green.

> **Do NOT bump the `@takazudo/zudo-doc-history-server` peer floor.** The release
> script intentionally leaves `packages/zudo-doc/package.json`
> `peerDependencies["@takazudo/zudo-doc-history-server"]` alone. That floor names
> an **already-published** version (the showcase resolves the peer from the npm
> registry under `--frozen-lockfile`), so raising it to the in-flight release
> version makes the lockfile unresolvable and deadlocks CI **and** the publish
> workflows. The floor lags **permanently and by design** — it can only name an
> already-published version, so it trails the in-flight one by one release
> forever. The pin-parity guard uses satisfies-semantics for this peer, so a
> same-major lag (e.g. floor `^2.0.1` at release `2.1.0`) **passes** and only emits
> a non-fatal advisory. Do not "fix" that advisory — not here, and not after
> publishing either: raising the floor just moves the lag to the next release and
> earns a pointless patch release. See RELEASE.md → "First-party peer floor
> (publish-lag)".

## Step 5 — Commit

Stage and commit all changed files:

```bash
git add package.json \
        packages/create-zudo-doc/package.json \
        packages/zudo-doc/package.json \
        packages/doc-history-server/package.json \
        packages/create-zudo-doc/src/scaffold.ts \
        src/content/docs/changelog/<NEW_VERSION>.mdx \
        src/content/docs-ja/changelog/<NEW_VERSION>.mdx
# Add any formatting fixes from b4push:
git diff --name-only | xargs -r git add
git commit -m "chore: bump create-zudo-doc to v<NEW_VERSION>"
```

## Step 6 — Push and wait for CI

```bash
git push
```

Poll CI until green: `gh run list --branch main --limit 1 --json status,conclusion,headSha`.
Verify `headSha` matches the pushed commit. Poll every 30 s, maximum 10 minutes.
If CI fails, investigate with `gh run view <run-id> --log-failed`, fix, and push again.

**Do not tag until CI is green.**

## Step 7 — Tag all three packages (lockstep)

Tag without asking (autonomous). Tags are cheap and easily deleted; the only
irreversible step is the npm publish in Step 9.

The release script bumps all four `package.json` versions in lockstep, and
`create-zudo-doc`'s generated scaffold pins `@takazudo/zudo-doc@^<ver>` **and**
`@takazudo/zudo-doc-history-server@^<ver>`. So all three publishable packages
MUST be released at the same version every time — if you tag/publish only
`create-zudo-doc`, a fresh downstream scaffold's `pnpm install` 404s on the
unpublished `@takazudo/*` pin. **Always create all three tags** (the old
"only if its source changed" guidance is wrong for the lockstep model):

```bash
git tag zudo-doc-history-server-<NEW_VERSION>
git tag zudo-doc-v<NEW_VERSION>
git tag v<NEW_VERSION>
git push origin \
  zudo-doc-history-server-<NEW_VERSION> \
  zudo-doc-v<NEW_VERSION> \
  v<NEW_VERSION>
```

The three tag namespaces are distinct so each fires exactly one publish workflow:
`zudo-doc-history-server-*`, `zudo-doc-v*`, and the bare `v*` (create-zudo-doc).

## Step 8 — Create three DRAFT GitHub releases (one per package)

Extract the changelog body once (strip the YAML frontmatter), then create a
DRAFT release for **each of the three tags**. **Title each with the package
name + bare version** to match the existing release history — NOT the raw tag
(`create-zudo-doc 0.2.0-next.4`, not `v0.2.0-next.4`). Mark every prerelease
(`-next` / `-beta` / `-rc`) with `--prerelease`:

| Tag | `--title` (package + bare version) |
|-----|------------------------------------|
| `zudo-doc-history-server-<NEW_VERSION>` | `@takazudo/zudo-doc-history-server <NEW_VERSION>` |
| `zudo-doc-v<NEW_VERSION>` | `@takazudo/zudo-doc <NEW_VERSION>` |
| `v<NEW_VERSION>` | `create-zudo-doc <NEW_VERSION>` |

```bash
NOTES=$(awk 'BEGIN{f=0} /^---$/{f++; next} f>=2' \
        src/content/docs/changelog/<NEW_VERSION>.mdx)

# --prerelease for any version containing a hyphen (next/beta/rc); empty for stable.
PRE=""; case "<NEW_VERSION>" in *-*) PRE="--prerelease";; esac

gh release create "zudo-doc-history-server-<NEW_VERSION>" \
  --title "@takazudo/zudo-doc-history-server <NEW_VERSION>" \
  --notes "$NOTES" --draft $PRE

gh release create "zudo-doc-v<NEW_VERSION>" \
  --title "@takazudo/zudo-doc <NEW_VERSION>" \
  --notes "$NOTES" --draft $PRE

gh release create "v<NEW_VERSION>" \
  --title "create-zudo-doc <NEW_VERSION>" \
  --notes "$NOTES" --draft $PRE
```

The `--draft` flag is critical on all three. A draft release does NOT trigger
its publish workflow. (The same `$NOTES` body is used for all three — the
changelog is a single lockstep release note covering every package.)

## Step 9 — Publish the three releases to npm (autonomous by default)

This is the only irreversible step (npm's unpublish lock kicks in after 72 h).
Flipping a GitHub release from draft → published (`gh release edit <tag>
--draft=false`) fires that package's `publish-*.yml` workflow, which runs the
actual `npm publish`.

**`--confirm` gate (only when the flag was passed):** before publishing, show the
user what is about to ship and ask once. Default (no `--confirm`) skips this and
publishes immediately.

```
About to publish <NEW_VERSION> to npm — IRREVERSIBLE:
  1. @takazudo/zudo-doc-history-server
  2. @takazudo/zudo-doc
  3. create-zudo-doc
Changelog: <one-line summary>
Correct — publish now? (yes / no)
```

Proceed only on an affirmative answer; otherwise STOP and leave the three drafts
in place for the user to publish later.

**Publish in dependency order, one at a time, verifying each is live on npm before
the next.** `create-zudo-doc`'s scaffold pins the other two at `<NEW_VERSION>`, so
an out-of-order publish 404s a fresh downstream install. For each package:

1. `gh release edit <tag> --draft=false --prerelease` (drop `--prerelease` for a
   stable version — but the npm dist-tag is derived from the tag name regardless:
   hyphen → `next`, no hyphen → `latest`).
2. Watch the triggered workflow run to **success** (a background watcher on the
   newest `release`-event run of that workflow file works well). If it fails, STOP
   and report — do NOT publish the next package.
3. Confirm the version is live: poll `npm view <pkg>@<NEW_VERSION> version` until it
   returns, before moving to the next package.

```bash
# Order: history-server → zudo-doc → create-zudo-doc.
# Per package: flip draft→published, watch publish-*.yml to success, verify on npm.
# 1) @takazudo/zudo-doc-history-server
gh release edit "zudo-doc-history-server-<NEW_VERSION>" --draft=false --prerelease
#    watch publish-zudo-doc-history-server.yml run to success, then:
until npm view @takazudo/zudo-doc-history-server@<NEW_VERSION> version 2>/dev/null; do sleep 10; done

# 2) @takazudo/zudo-doc
gh release edit "zudo-doc-v<NEW_VERSION>" --draft=false --prerelease
#    watch publish-zudo-doc.yml run to success, then:
until npm view @takazudo/zudo-doc@<NEW_VERSION> version 2>/dev/null; do sleep 10; done

# 3) create-zudo-doc (LAST — its pins now resolve)
gh release edit "v<NEW_VERSION>" --draft=false --prerelease
#    watch publish-create-zudo-doc.yml run to success, then:
until npm view create-zudo-doc@<NEW_VERSION> version 2>/dev/null; do sleep 10; done
```

## Step 10 — Report

Confirm all three are live and report the final state:

```bash
for p in @takazudo/zudo-doc-history-server @takazudo/zudo-doc create-zudo-doc; do
  npm view "$p" dist-tags --json
done
```

Each should show `<NEW_VERSION>` under `latest` for a clean `0.x` release (the
normal Scheme B path), or under `next` for an opt-in prerelease (with `latest`
left untouched). Report the three release URLs and the published versions.
**The skill ends here — the release is live on npm.**

(Optional but recommended for confidence: a fresh-scaffold smoke —
`pnpm dlx create-zudo-doc@<NEW_VERSION> <dir> --yes ...` then `pnpm install` — proves
every published pin resolves from npm. See the prior release session for the pattern.)

## dist-tag behavior: `latest` and `next`

Each package is published to npm with a dist-tag determined by the version string. CI
reads the tag name and selects the tag automatically — the maintainer does NOT specify
`--tag` manually. Publishing the DRAFT is the only irreversible step.

| Tag pattern         | npm dist-tag | Who resolves it                  |
|---------------------|--------------|----------------------------------|
| `v1.2.3`            | `latest`     | `pnpm install create-zudo-doc`   |
| `v1.2.3-next.1`     | `next`       | `pnpm install create-zudo-doc@next` |
| `v1.2.3-beta.2`     | `next`       | `pnpm install create-zudo-doc@next` |
| `v1.2.3-rc.3`       | `next`       | `pnpm install create-zudo-doc@next` |

Clean versions (no `-`) publish under `latest`; prereleases (any tag containing a
`-`) publish under `next`. There is **no dual-tag probe** — see RELEASE.md. Under
**Scheme B** the `0.x` mainline ships clean `0.MINOR.PATCH`, so each release moves
`latest` to the newest build and a tagless `npm install` / `pnpm dlx` always gets
it. `-next` is reserved for opt-in previews and the `1.0.0-beta` run-up.

**`next` is removed on stable graduation.** Each publish workflow runs an extra
step after a clean `X.Y.Z` publish that removes the `next` dist-tag
(`npm dist-tag rm <pkg> next`). This prevents `@next` from silently resolving to a
stale prerelease once the line graduates. The step is idempotent and non-fatal.
See RELEASE.md — "One-time manual cleanup" — for the manual runbook that clears
the currently-stale `next` tag (frozen at `0.2.0-next.9` as of #2121).

## Files involved (pin sources)

The release script writes to ALL of these in one pass:

| File | Role |
|------|------|
| `scripts/release-create-zudo-doc.sh` | Version bump + changelog scaffold (run in Step 2) |
| `.github/workflows/publish-create-zudo-doc.yml` | CI publish workflow for `create-zudo-doc` (fires on `v*` draft publish) |
| `.github/workflows/publish-zudo-doc.yml` | CI publish workflow for `@takazudo/zudo-doc` (fires on `zudo-doc-v*` draft publish) — W4A (#1732) |
| `.github/workflows/publish-zudo-doc-history-server.yml` | CI publish workflow for `@takazudo/zudo-doc-history-server` (fires on `zudo-doc-history-server-*` draft publish) — W4A (#1732) |
| `package.json` (root) | Root version (kept in lockstep) |
| `packages/create-zudo-doc/package.json` | Generator package version (must match the `v<X.Y.Z>` git tag) |
| `packages/zudo-doc/package.json` | zudo-doc framework package version (must match the `zudo-doc-v<X.Y.Z>` git tag) — W4A (#1732) |
| `packages/doc-history-server/package.json` | doc-history-server package version (must match the `zudo-doc-history-server-<X.Y.Z>` git tag) — W4A (#1732) |
| `packages/create-zudo-doc/src/scaffold.ts` | `@takazudo/zudo-doc: ^<version>` pin in the generated downstream `package.json`; bumped in lockstep with zudo-doc by the release script — W4A (#1732) |

## Publish ORDER matters (W4A — #1732)

**Step 9 publishes the three releases in this order automatically** (the CREATE order in
Steps 7–8 doesn't matter; the PUBLISH order does). This section is the rationale and the
manual fallback. `create-zudo-doc`'s generated `package.json` pins
`@takazudo/zudo-doc: ^<version>` and `@takazudo/zudo-doc-history-server: ^<version>`, so
those two must be **live on npm** before `create-zudo-doc` is published — otherwise a fresh
scaffold's `pnpm install` 404s on the unpublished pin.

All three are released at the same version every time (lockstep — the release script
bumps all four `package.json` files together), so this is **always all three**, never a
subset. The order (Step 9 follows it; replicate it if publishing by hand), waiting for
each to appear on npm before the next:

1. Publish `@takazudo/zudo-doc-history-server <X.Y.Z>` (tag `zudo-doc-history-server-<X.Y.Z>`).
2. Publish `@takazudo/zudo-doc <X.Y.Z>` (tag `zudo-doc-v<X.Y.Z>`).
3. After #1 and #2 are live on npm, publish `create-zudo-doc <X.Y.Z>` (tag `v<X.Y.Z>`).

Each draft-publish fires its own dedicated workflow (`publish-zudo-doc-history-server.yml`,
`publish-zudo-doc.yml`, `publish-create-zudo-doc.yml`; concurrency groups are distinct).
Verify each on npm with `npm view <pkg>@<X.Y.Z> version` before publishing the next.
