---
name: l-release-create-zudo-doc
description: >-
  Orchestrate a create-zudo-doc release: bump versions, fill changelog,
  validate, commit, push, wait for CI, tag, and create a DRAFT GitHub release.
  Use when: (1) User says 'release create-zudo-doc' or 'l-release-create-zudo-doc',
  (2) User wants to publish a new version of the create-zudo-doc npm package.
user-invocable: true
disable-model-invocation: false
argument-description: "Optional: the exact version string (e.g. 0.2.0, 1.0.0-next.1)"
---

# /l-release-create-zudo-doc

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

If the user passed a version argument, use it directly. Otherwise:

```bash
git log <last-tag>..HEAD --oneline
```

Categorize commits by conventional-commit prefix and propose:

- Breaking changes (`feat!`, `BREAKING CHANGE`) → **major** bump
- Features (`feat:`) → **minor** bump
- Otherwise → **patch** bump

For prerelease candidates, use the `-next.N`, `-beta.N`, or `-rc.N` suffix as
appropriate. Present the proposal and **wait for user confirmation**.

## Step 2 — Run the release script

```bash
./scripts/release-create-zudo-doc.sh <NEW_VERSION>
```

This script (sibling to `version-bump.sh`, does NOT modify it):

1. Validates the version format (accepts prerelease suffixes)
2. Bumps `package.json` at the root
3. Bumps `packages/create-zudo-doc/package.json`
4. Scaffolds `src/content/docs/changelog/<NEW_VERSION>.mdx` (EN)
5. Scaffolds `src/content/docs-ja/changelog/<NEW_VERSION>.mdx` (JA)

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

## Dist-tag reference (CI determines this from the tag name)

| Tag pattern         | npm dist-tag |
|---------------------|--------------|
| `v1.2.3`            | `latest`     |
| `v1.2.3-next.1`     | `next`       |
| `v1.2.3-beta.2`     | `next`       |
| `v1.2.3-rc.3`       | `next`       |

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
