---
name: zudo-doc-version-bump
description: >-
  Bump package version, update changelog and versioned docs snapshot (if those features are
  enabled), commit, tag, and create a GitHub release. Use when: (1) User says 'version bump',
  'bump version', 'release', or 'zudo-doc-version-bump', (2) User wants to create a new release
  of this project.
user-invocable: true
disable-model-invocation: true
argument-description: "Optional: major, minor, or patch to skip the proposal step"
---

# /zudo-doc-version-bump

Bump the version, update changelog content (if the changelog feature is enabled), optionally
archive the current docs as a versioned snapshot (if the versioning feature is enabled), commit,
tag, and create a GitHub release.

## Preconditions

Before doing anything else, verify ALL of the following. If any check fails, stop and tell the
user.

1. Current branch is `main` (or your project's default branch)
2. Working tree is clean (`git status --porcelain` returns empty)

Find the latest version tag, if any:

```bash
git tag -l 'v*' --sort=-v:refname | head -1
```

A freshly scaffolded project has no tags yet — that's expected on the first release. If no tag
is found, do NOT ask the user to create one first; proceed straight to analyzing the full commit
history in the next step instead.

## Analyze changes since last tag

If a previous tag was found, diff against it:

```bash
git log <last-tag>..HEAD --oneline
git diff <last-tag>..HEAD --stat
```

If no tag exists yet (first release), analyze the whole history instead:

```bash
git log --oneline
```

Categorize each commit by its conventional-commit prefix:

- **Breaking Changes**: commits with an exclamation mark suffix (e.g. `feat!:`) or BREAKING CHANGE in body
- **Features**: `feat:` prefix
- **Bug Fixes**: `fix:` prefix
- **Other Changes**: everything else (`docs:`, `chore:`, `refactor:`, `ci:`, `test:`, `style:`, `perf:`, etc.)

## Propose version bump

Based on the changes:

- If there are breaking changes → propose **major** bump
- If there are features (no breaking) → propose **minor** bump
- Otherwise → propose **patch** bump

If the user passed an argument (`major`, `minor`, or `patch`), use that directly instead of proposing.

Present the proposal to the user:

```
Proposed bump: {current} → {new} ({type})

Breaking Changes:
- description (hash)

Features:
- description (hash)

Bug Fixes:
- description (hash)

Other Changes:
- description (hash)
```

Only show sections that have entries. **Wait for user confirmation before proceeding.**

If this is a **major** version bump and the project has the versioning feature enabled (see
"Archive docs as a versioned snapshot" below), ask the user whether they want to archive the
current docs as a versioned snapshot before continuing.

## Bump the version

A `create-zudo-doc` scaffold has no bundled version-bump script — bump `package.json` directly:

```bash
npm version {NEW_VERSION} --no-git-tag-version
```

`npm version` is a plain `npm` CLI feature (Node always ships `npm`), so this works no matter
which package manager (`<pm>`) the project otherwise uses. `--no-git-tag-version` stops it from
also creating a commit/tag — this skill handles that later, once everything else is ready. A
direct edit of the `"version"` field in `package.json` works identically if preferred.

## Update the changelog (if enabled)

Check whether the project has a changelog page:

```bash
test -f src/content/docs/changelog/index.mdx && echo "changelog present"
```

If that file does not exist, the changelog feature is not in use — skip this whole section and
go straight to "Archive docs as a versioned snapshot".

Unlike a per-version file, a scaffolded changelog is a single `index.mdx` page. Add the new
release as a section **above** the existing ones (newest first), using only the categories that
have entries.

### Default-language changelog (`src/content/docs/changelog/index.mdx`)

This is the project's PRIMARY changelog page. It was seeded in whichever language the project's
`defaultLang` setting is, so use whichever heading set below already matches the page — don't
assume English.

**If the page uses English headings:**

```mdx
## {NEW_VERSION}

### Breaking Changes

- Description (commit-hash)

### Features

- Description (commit-hash)

### Bug Fixes

- Description (commit-hash)

### Other Changes

- Description (commit-hash)
```

On the very first bump, the page still has the scaffold's starter `## Unreleased` section —
replace that heading with `## {NEW_VERSION}` rather than adding a second heading.

**If the page uses Japanese headings:**

```mdx
## {NEW_VERSION}

### 破壊的変更

- Description (commit-hash)

### 機能

- Description (commit-hash)

### バグ修正

- Description (commit-hash)

### その他の変更

- Description (commit-hash)
```

On the very first bump, the page still has the scaffold's starter `## 未リリース` section —
replace that heading with `## {NEW_VERSION}` the same way.

### Other-locale changelog

Only applies when i18n is enabled — i.e. a second content directory exists alongside the primary
one. Which locale that is depends on the project's `defaultLang`: for an English-default project
this is the Japanese changelog at `src/content/docs-ja/changelog/index.mdx`; for a
Japanese-default project this is the English changelog under the `docs-en` directory instead. If
the other-locale changelog page doesn't exist, skip this file.

Use the OTHER heading set from above (the one you didn't use for the default-language page —
English primary means Japanese secondary, and vice versa), following the same "add a new
`## {NEW_VERSION}` section above the existing ones" rule, and replace that page's own starter
heading on the very first bump.

Rules:

- Only include sections that have entries
- Each entry should be the commit subject with the short hash in parentheses

## Archive docs as a versioned snapshot (if enabled, major bumps only)

Only relevant when the project has the versioning feature enabled — check for a `versions`
array in `zfb.config.ts`'s `zudoDoc({...})` call. If `versions` is absent, `false`, or the user
declined the snapshot offer above, skip this whole section.

1. Derive the old version's slug by dropping the patch component, e.g. `0.1.0` → `0.1`,
   `1.2.3` → `1.2`.
2. Copy the current docs into a versioned directory:

   ```bash
   cp -r src/content/docs src/content/docs-v{OLD_SLUG}
   ```

3. If i18n is enabled (a `docs-ja` directory exists), also copy the Japanese docs:

   ```bash
   cp -r src/content/docs-ja src/content/docs-v{OLD_SLUG}-ja
   ```

4. Add an entry to the `versions` array in `zfb.config.ts`:

   ```ts
   versions: [
     {
       slug: "{OLD_SLUG}",
       label: "{OLD_VERSION}",
       docsDir: "src/content/docs-v{OLD_SLUG}",
       locales: {
         ja: { dir: "src/content/docs-v{OLD_SLUG}-ja" },
       },
       banner: "unmaintained",
     },
     // ...existing versions
   ],
   ```

   Drop the `locales` block entirely when i18n is not enabled.

5. `src/content/docs/` (and `src/content/docs-ja/`) now represent the new, latest version —
   no further action needed there. The version switcher and versions listing page pick up the
   new entry automatically at build time; nothing else needs wiring.

## Build and test

Run the project's pre-push validation script:

```bash
<pm> run b4push
```

If anything fails, fix the issue and re-run. Do not proceed with committing until all checks
pass. (In a freshly scaffolded project this script may just be a `check`-then-`build` stub —
that's fine; expand it into a richer pipeline as the project's testing needs grow.)

## Commit changes

Stage and commit **all** version bump changes:

```bash
git add package.json
git add src/content/docs/changelog/index.mdx src/content/docs-ja/changelog/index.mdx 2>/dev/null
git add src/content/docs-v* 2>/dev/null
# Also stage any other modified files (e.g. formatting fixes from the build/test step)
git diff --name-only | xargs -r git add
git commit -m "chore: Bump version to v{NEW_VERSION}"
```

## Push and wait for CI (if configured)

Push the commits first (without the tag):

```bash
git push
```

If the project has CI configured (e.g. a GitHub Actions workflow), wait for it to pass. Use
`gh run list --branch main --limit 1 --json status,conclusion,headSha` and verify the `headSha`
matches the pushed commit. Poll every 30 seconds, with a **maximum of 10 minutes**. If CI is
still running after 10 minutes, ask the user whether to keep waiting or proceed. If the project
has no CI workflow, skip straight to tagging.

If CI fails, investigate the failure with `gh run view <run-id> --log-failed`, fix the issue,
commit, and push again.

**Do not tag or publish until CI is green (or there is no CI to wait for).**

## Tag, push tag, and create GitHub release

**Ask the user for confirmation before tagging.**

```bash
git tag v{NEW_VERSION}
git push --tags
```

After pushing the tag, create a GitHub release. If the changelog feature is enabled, pull the
section you just wrote out of the single changelog page as the release notes:

```bash
NOTES=$(awk -v ver="## {NEW_VERSION}" '$0==ver{f=1;next} f&&/^## /{f=0} f' src/content/docs/changelog/index.mdx)
gh release create v{NEW_VERSION} --title "v{NEW_VERSION}" --notes "$NOTES"
```

If the changelog feature is off, write the release notes directly from the categorized commit
analysis instead:

```bash
gh release create v{NEW_VERSION} --title "v{NEW_VERSION}" --notes "..."
```

## Publish to npm (if applicable)

If the package is **not** marked as `"private": true` in `package.json`, tell the user to publish:

```
The package is ready for npm publishing. Run:

  <pm> publish

(This requires browser-based 2FA and must be done manually.)
```

If the package is `"private": true`, skip this step and inform the user:

```
Package is marked as private — skipping npm publish.
```

## Done

Report the summary:

- Version bumped: `{OLD_VERSION}` → `{NEW_VERSION}`
- Changelog updated (EN + JA, if the changelog feature is enabled)
- Docs snapshot created (if the versioning feature is enabled and a snapshot was taken)
- Git tag: `v{NEW_VERSION}`
- GitHub release: link to the release
- npm publish status (published / skipped for private package)
