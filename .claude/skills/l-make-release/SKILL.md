---
name: l-make-release
description: >-
  Orchestrate a create-zudo-doc release: bump versions, fill changelog,
  validate, commit, push, wait for CI, tag, and create a DRAFT GitHub release.
  Use when: (1) User says 'make release', 'l-make-release', or 'release create-zudo-doc',
  (2) User wants to publish a new version of the create-zudo-doc npm package.
user-invocable: true
disable-model-invocation: false
argument-description: "Optional: version string or bump mode (e.g. 0.2.0, 1.0.0-next.1, minor, stable)"
---

# /l-make-release

Orchestrate the full create-zudo-doc release sequence, ending at a **DRAFT** GitHub
release. Publishing that draft is the human gate that triggers the CI publish workflow.

## Why a new skill — not editing `/zudo-doc-version-bump`

`/zudo-doc-version-bump` is **dual-purpose**: it is also shipped to downstream
scaffolded projects via `create-zudo-doc`. Modifying it risks breaking that
downstream contract. This skill wraps and extends the same release flow for the
`create-zudo-doc` package specifically:

- Bumps **both** root `package.json` **and** `packages/create-zudo-doc/package.json`
  in lockstep (the existing skill only bumps the root).
- Accepts prerelease versions (`1.0.0-next.1`, `1.0.0-beta.2`, `1.0.0-rc.1`) which
  `scripts/version-bump.sh` rejects due to its strict semver regex.
- Ends at a **DRAFT release** — CI handles the actual `npm publish` upon draft publish.

The existing `/zudo-doc-version-bump` skill is **not modified** by this flow.

## Version scheme

The release script auto-derives the next version from the current one, or accepts
explicit bump modes and version strings:

| Current version   | Mode / arg       | Result              |
|-------------------|------------------|---------------------|
| `X.Y.Z` (stable)  | _(no arg / auto)_ | `X.(Y+1).0-next.1` |
| `X.Y.Z-next.N`    | _(no arg / auto)_ | `X.Y.Z-next.(N+1)` |
| any               | `major`          | `(X+1).0.0-next.1` |
| any               | `minor`          | `X.(Y+1).0-next.1` |
| any               | `patch`          | `X.Y.(Z+1)-next.1` |
| `X.Y.Z` (stable)  | `next`           | `X.(Y+1).0-next.1` |
| `X.Y.Z-next.N`    | `next`           | `X.Y.Z-next.(N+1)` |
| `X.Y.Z-next.N`    | `stable`         | `X.Y.Z`            |
| already stable    | `stable`         | _(error)_           |
| any               | `<semver>`       | use exactly that    |

All keyword modes except `stable` produce a prerelease version (with `-next.1` suffix).
Stable is always an explicit promotion — never auto-derived from a stable base.

### Dry path (compute-only, no mutations)

```bash
# Test auto-derive from a specific version without touching package.json:
DRY=1 FROM=0.1.0 ./scripts/release-create-zudo-doc.sh
# → next version: 0.2.0-next.1 / pin string: ^0.2.0-next.1

DRY=1 FROM=0.2.0-next.1 ./scripts/release-create-zudo-doc.sh
# → next version: 0.2.0-next.2 / pin string: ^0.2.0-next.2

DRY=1 FROM=0.2.0-next.3 ./scripts/release-create-zudo-doc.sh stable
# → next version: 0.2.0 / pin string: ^0.2.0
```

## One-time bootstrap (first release from a fresh repo)

Before the very first release, if npm has never seen `@takazudo/zudo-doc` and the
`latest` dist-tag is not yet set, run the bootstrap helper to seed it:

```bash
node scripts/release-bootstrap-latest.mjs <version>
```

This is a one-time operation — subsequent releases use the normal release script.

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

Categorize commits by conventional-commit prefix and propose:

- Breaking changes (`feat!`, `BREAKING CHANGE`) → `major` bump
- Features (`feat:`) → `minor` bump
- Otherwise → `patch` bump

For prerelease candidates, propose the appropriate keyword (`next`, or explicit `-next.N`).
To preview the computed version without touching any files, use the dry path:

```bash
DRY=1 ./scripts/release-create-zudo-doc.sh [<version>|<mode>]
```

Present the proposal and **wait for user confirmation**.

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

## Step 7 — Tag

**Ask the user for confirmation before tagging.**

```bash
git tag v<NEW_VERSION>
git push --tags
```

## Step 8 — Create a DRAFT GitHub release

Use the changelog body from Step 3 (strip the YAML frontmatter with awk):

```bash
NOTES=$(awk 'BEGIN{f=0} /^---$/{f++; next} f>=2' \
        src/content/docs/changelog/<NEW_VERSION>.mdx)
gh release create "v<NEW_VERSION>" \
  --title "v<NEW_VERSION>" \
  --notes "$NOTES" \
  --draft
```

The `--draft` flag is critical. A draft release does NOT trigger the publish workflow.

## THE SKILL ENDS HERE — the human publishes the draft

The release is now a GitHub Draft. **Stop here and tell the user:**

```
Draft release v<NEW_VERSION> created: <gh release URL>

Before publishing the draft, verify:
  ✓ Tag v<NEW_VERSION> appears correctly on the release page
  ✓ If this is a prerelease (e.g. -next.1), the "Pre-release" checkbox is checked
    → The CI workflow will publish with --tag next (not latest)
  ✓ If this is a stable release, the "Pre-release" checkbox is UNchecked
    → The CI workflow will publish with --tag latest
  ✓ Changelog content looks correct

When you click "Publish release" on GitHub, the publish-create-zudo-doc CI
workflow fires automatically and publishes to npm. That step is irreversible.
```

Publishing the draft releases `create-zudo-doc@<NEW_VERSION>` to npm — this is
the human gate that cannot be undone after 72 hours (npm unpublish lock). Review
carefully before clicking.

## Dual-tag behavior: `latest` and `next`

Each package is published to npm with a dist-tag determined by the version string. CI
reads the tag name and selects the tag automatically — the maintainer does NOT specify
`--tag` manually. Publishing the DRAFT is the only irreversible step.

| Tag pattern         | npm dist-tag | Who resolves it                  |
|---------------------|--------------|----------------------------------|
| `v1.2.3`            | `latest`     | `pnpm install create-zudo-doc`   |
| `v1.2.3-next.1`     | `next`       | `pnpm install create-zudo-doc@next` |
| `v1.2.3-beta.2`     | `next`       | `pnpm install create-zudo-doc@next` |
| `v1.2.3-rc.3`       | `next`       | `pnpm install create-zudo-doc@next` |

Prerelease versions (any tag containing a `-`) are published under `next`. Stable
versions (no `-`) are published under `latest`. This ensures `npm install` / `pnpm dlx`
without a dist-tag always pulls the last stable release, not a prerelease.

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

When zudo-doc or doc-history-server has changed, publish them BEFORE
`create-zudo-doc`, because the generated `package.json` from
`create-zudo-doc` pins `@takazudo/zudo-doc: ^<version>`. If that
version is not yet on npm, a fresh scaffold's `pnpm install` will fail
with a 404 on the @takazudo/zudo-doc package.

Recommended sequence after `b4push` is green and the commit is pushed:

1. Tag and draft-publish `zudo-doc-history-server-<X.Y.Z>` if its
   `packages/doc-history-server/` source has changed.
2. Tag and draft-publish `zudo-doc-v<X.Y.Z>` if its `packages/zudo-doc/`
   source or pin range has changed.
3. After both above are live on npm, tag and draft-publish
   `v<X.Y.Z>` for `create-zudo-doc`.

Each draft-publish fires its own dedicated workflow (concurrency groups
are distinct, so they can run in parallel within a single wave once
their tags are pushed).
