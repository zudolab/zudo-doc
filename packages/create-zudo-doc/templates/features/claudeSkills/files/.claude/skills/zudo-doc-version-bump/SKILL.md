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

The project has **one root version**. All packages represented in a multi-package changelog move
to `{NEW_VERSION}` in lockstep; independent per-package versions are out of scope for this skill.

## Update the changelog (if enabled)

First check whether the default-language changelog exists:

```bash
test -f src/content/docs/changelog/index.mdx && echo "changelog present"
```

If `src/content/docs/changelog/index.mdx` does not exist, the changelog feature is not in use —
skip this whole section and go straight to "Archive docs as a versioned snapshot".

### Discover package and page layouts

Treat `src/content/docs/changelog/` as the primary changelog root. List every immediate child
directory that contains an `index.mdx`; each directory name is a package slug:

```bash
find src/content/docs/changelog -mindepth 2 -maxdepth 2 -type f -name index.mdx \
  -print | sed 's#/index\.mdx$##; s#.*/##' | sort
```

Then follow exactly one branch:

1. **One or more package directories:** the root `index.mdx` is a landing page and must never be
   edited. Show the package slugs to the user and ask which packages this release touches. Default
   to **all packages**; accept a comma-separated list. Reject names that are not in the discovered
   list. Apply the per-directory procedure below to each selected package directory.
2. **No package directories:** apply the per-directory procedure to the changelog root itself.

For every selected directory, detect its layout independently, before making changes:

```bash
find "<changelog-directory>" -maxdepth 1 -type f -name '*.mdx' ! -name index.mdx \
  -print -quit
```

- Any output means **per-version-file layout**. Create a new version file; never insert a version
  section into that directory's `index.mdx`.
- No output means **single-page layout**. Edit that directory's `index.mdx` using the existing
  section procedure.

This per-directory check is mandatory: packages in one project may use different layouts.

### Choose the language-specific headings

The primary content directory was seeded in the project's `defaultLang`, so do not assume it is
English. For a single-page directory, inspect its `index.mdx`. For a per-version-file directory,
inspect its existing sibling version entries. Use the heading set already used by those files.

**English heading set:**

```mdx
### Breaking Changes

- Description (commit-hash)

### Features

- Description (commit-hash)

### Bug Fixes

- Description (commit-hash)

### Other Changes

- Description (commit-hash)
```

**Japanese heading set:**

```mdx
### 破壊的変更

- Description (commit-hash)

### 機能

- Description (commit-hash)

### バグ修正

- Description (commit-hash)

### その他の変更

- Description (commit-hash)
```

In either language, include only categories that have entries. Each entry is the commit subject
with its short hash in parentheses.

### Update a single-page directory

Add this release above all existing release sections in the directory's `index.mdx` (newest
first):

```mdx
## {NEW_VERSION}

<!-- categories and entries from the matching heading set above -->
```

On the first bump, replace the starter `## Unreleased` or `## 未リリース` heading with
`## {NEW_VERSION}` instead of adding a second release heading.

### Update a per-version-file directory

Create `<changelog-directory>/<version>.mdx`, where `<version>` is `{NEW_VERSION}` without a
leading `v`. Never section-edit this directory's `index.mdx`. Determine the greatest numeric
`sidebar_position` in the existing sibling version files and use that value plus one. The new file
must have localized frontmatter and body text matching its siblings, in this shape:

```mdx
---
title: "{NEW_VERSION}"
description: Release notes for {NEW_VERSION}.
sidebar_position: {MAX_EXISTING_PLUS_ONE}
---

Released: {YYYY-MM-DD}

<!-- categories and entries from the matching heading set above -->
```

Use a concise Japanese `description` when the sibling entries are Japanese, but keep the required
`Released: {YYYY-MM-DD}` line in either language. Use today's date for `{YYYY-MM-DD}`.

### Other-locale changelog

Only applies when i18n is enabled — i.e. a second content directory exists alongside the primary
one. Which locale that is depends on the project's `defaultLang`: for an English-default project
this is the Japanese changelog at `src/content/docs-ja/changelog/index.mdx`; for a
Japanese-default project this is the English changelog under the `docs-en` directory instead. If
the other-locale changelog root doesn't exist, skip mirroring.

Mirror exactly the selected primary targets by relative path under the other-locale root, detect
each mirror directory's layout independently, and apply the matching single-page or
per-version-file procedure. Use the other language's heading set. In a multi-package layout,
never edit either locale's landing `changelog/index.mdx`. If a selected package has no matching
other-locale directory, report it and stop instead of silently creating a divergent layout.

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
git add src/content/docs*/changelog/ 2>/dev/null
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

After pushing the tag, create a GitHub release. If a root single-page changelog was updated, pull
the section you just wrote out as before:

```bash
NOTES=$(awk -v ver="## {NEW_VERSION}" '$0==ver{f=1;next} f&&/^## /{f=0} f' src/content/docs/changelog/index.mdx)
gh release create v{NEW_VERSION} --title "v{NEW_VERSION}" --notes "$NOTES"
```

For a root per-version-file layout, remove the frontmatter from the new entry and use the rest of
its body as `NOTES`:

```bash
NOTES=$(awk 'NR==1&&$0=="---"{fm=1;next} fm&&$0=="---"{fm=0;next} !fm{print}' "src/content/docs/changelog/{NEW_VERSION}.mdx")
gh release create v{NEW_VERSION} --title "v{NEW_VERSION}" --notes "$NOTES"
```

For a multi-package changelog, concatenate the primary-language notes for every selected package,
in the same order shown to the user, under a `## <slug>` heading. This concrete loop handles a mix
of single-page and per-version-file package directories:

```bash
NOTES=""
for slug in $SELECTED_PACKAGES; do
  dir="src/content/docs/changelog/$slug"
  if test -f "$dir/{NEW_VERSION}.mdx"; then
    body=$(awk 'NR==1&&$0=="---"{fm=1;next} fm&&$0=="---"{fm=0;next} !fm{print}' "$dir/{NEW_VERSION}.mdx")
  else
    body=$(awk -v ver="## {NEW_VERSION}" '$0==ver{f=1;next} f&&/^## /{f=0} f' "$dir/index.mdx")
  fi
  printf -v NOTES '%s## %s\n\n%s\n\n' "$NOTES" "$slug" "$body"
done
gh release create v{NEW_VERSION} --title "v{NEW_VERSION}" --notes "$NOTES"
```

Set `SELECTED_PACKAGES` to the validated, space-separated package slugs chosen earlier. Build
release notes from the primary-language files only; the other-locale mirror is not duplicated in
the GitHub release body.

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
- Changelog layout(s) and selected package(s) updated (EN + JA, if enabled)
- Docs snapshot created (if the versioning feature is enabled and a snapshot was taken)
- Git tag: `v{NEW_VERSION}`
- GitHub release: link to the release
- npm publish status (published / skipped for private package)
