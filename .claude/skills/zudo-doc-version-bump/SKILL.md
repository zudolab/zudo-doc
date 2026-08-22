---
name: zudo-doc-version-bump
description: >-
  Bump the lockstep monorepo version, author package-specific changelogs, commit,
  tag all three packages, and create distinct GitHub releases. Use when: (1) User
  says 'version bump', 'bump version', 'release', or 'zudo-doc-version-bump',
  (2) User wants to create a new release of this monorepo.
user-invocable: true
disable-model-invocation: true
argument-description: "Optional: major, minor, or patch to skip the proposal step"
---

# /zudo-doc-version-bump

Bump the monorepo's lockstep version, author one truthful localized release note per
published package, commit, tag, and create three package-specific GitHub releases.

## Preconditions

Before doing anything else, verify all of the following. If any check fails, stop and
tell the user.

1. Current branch is `main`.
2. Working tree is clean (`git status --porcelain` returns empty).
3. At least one `v*` tag exists (`git tag -l 'v*'`). If none exists, tell the user to
   create the initial tag first.

Find the latest version tag:

```bash
git tag -l 'v*' --sort=-v:refname | head -1
```

## Analyze and classify changes

```bash
git log <last-tag>..HEAD --oneline
git diff <last-tag>..HEAD --stat
```

Use conventional-commit semantics to propose the version: breaking changes (`feat!:`,
`fix!:`, or `BREAKING CHANGE`) cause a major bump, `feat:` causes a minor bump, and
everything else causes a patch bump.

Separately inspect every commit and its diff to route user-facing release notes by
published-package ownership:

| Changelog slug | Published package | Owns |
|---|---|---|
| `doc-history-server` | `@takazudo/zudo-doc-history-server` | History server API, CLI, and runtime behavior |
| `zudo-doc` | `@takazudo/zudo-doc` | Framework, integrations, plugins, and public package behavior |
| `create-zudo-doc` | `create-zudo-doc` | Generator CLI and generated-project behavior |

Apply these rules exactly:

- Duplicate a user-facing change into every affected package note when it spans two or
  three packages.
- Omit repo/showcase documentation, tests, CI, and maintenance work when it has no
  user-facing effect on a published package.
- A lockstep package with no user-facing package change still receives a localized
  “No package-specific changes” entry. Never borrow another package's narrative.
- Each GitHub release receives only its package's English note body.

## Propose version bump

If the user passed `major`, `minor`, or `patch`, use it directly. Otherwise present the
proposal and categorized commits, then wait for confirmation.

## Run the version bump

```bash
./scripts/release-create-zudo-doc.sh {NEW_VERSION}
```

The monorepo release script bumps the root plus all three publishable package versions,
aligns the generated-project package pins, and scaffolds exactly six entries:

- `src/content/docs/changelog/doc-history-server/{NEW_VERSION}.mdx`
- `src/content/docs/changelog/zudo-doc/{NEW_VERSION}.mdx`
- `src/content/docs/changelog/create-zudo-doc/{NEW_VERSION}.mdx`
- `src/content/docs-ja/changelog/doc-history-server/{NEW_VERSION}.mdx`
- `src/content/docs-ja/changelog/zudo-doc/{NEW_VERSION}.mdx`
- `src/content/docs-ja/changelog/create-zudo-doc/{NEW_VERSION}.mdx`

## Author all six package entries

Replace every placeholder with only that package's classified changes. English entries
use `Released: {YYYY-MM-DD}` and the applicable `### Breaking Changes`, `### Features`,
`### Bug Fixes`, and `### Other Changes` sections. Japanese mirrors use
`リリース日: {YYYY-MM-DD}` and `### 破壊的変更`, `### 機能`, `### バグ修正`, and
`### その他の変更`. Omit empty categories.

For an unchanged package, retain the release date and use exactly:

```md
# English
- No package-specific changes.

# Japanese
- パッケージ固有の変更はありません。
```

Do not omit any of the six files. A cross-package change must be translated into each
affected English/Japanese pair.

## Regenerate and validate

Regenerate all package Markdown changelogs from the English MDX entries:

```bash
pnpm gen:changelog
```

Inspect and stage all three generated outputs:

- `packages/doc-history-server/CHANGELOG.md`
- `packages/zudo-doc/CHANGELOG.md`
- `packages/create-zudo-doc/CHANGELOG.md`

Then run:

```bash
B4PUSH_SKIP_PIN_PUBLISHED=1 pnpm b4push
```

Fix failures and rerun. Do not commit until the gate passes, and do not tag until the
pushed commit passes CI.

## Commit changes

Stage all lockstep version and pin files printed by
`scripts/release-create-zudo-doc.sh`, plus all six MDX entries and all three generated
Markdown changelogs. At minimum, the note artifacts are:

```bash
git add \
  package.json \
  packages/doc-history-server/package.json \
  packages/zudo-doc/package.json \
  packages/create-zudo-doc/package.json \
  packages/create-zudo-doc/src/scaffold.ts \
  src/content/docs/changelog/doc-history-server/{NEW_VERSION}.mdx \
  src/content/docs/changelog/zudo-doc/{NEW_VERSION}.mdx \
  src/content/docs/changelog/create-zudo-doc/{NEW_VERSION}.mdx \
  src/content/docs-ja/changelog/doc-history-server/{NEW_VERSION}.mdx \
  src/content/docs-ja/changelog/zudo-doc/{NEW_VERSION}.mdx \
  src/content/docs-ja/changelog/create-zudo-doc/{NEW_VERSION}.mdx \
  packages/doc-history-server/CHANGELOG.md \
  packages/zudo-doc/CHANGELOG.md \
  packages/create-zudo-doc/CHANGELOG.md
git diff --name-only | xargs -r git add
git commit -m "chore: bump version to v{NEW_VERSION}"
```

## Push and wait for CI

Push the commit without tags, then poll the newest `main` run and verify its `headSha`
matches the pushed commit. Poll every 30 seconds for at most 10 minutes. Investigate and
fix a failed run. If it is still running at 10 minutes, ask whether to keep waiting.

**Do not tag or publish until CI is green.**

## Tag all three lockstep packages

Ask the user for confirmation before tagging, then create and push all three tags:

```bash
git tag zudo-doc-history-server-{NEW_VERSION}
git tag zudo-doc-v{NEW_VERSION}
git tag v{NEW_VERSION}
git push origin \
  zudo-doc-history-server-{NEW_VERSION} \
  zudo-doc-v{NEW_VERSION} \
  v{NEW_VERSION}
```

All three packages are released in lockstep even if one or more notes contain the
explicit no-change entry.

## Create three package-specific GitHub releases

Extract three independent English bodies. Never reuse one shared `$NOTES` value:

```bash
HISTORY_NOTES=$(awk 'BEGIN{f=0} /^---$/{f++; next} f>=2' \
  src/content/docs/changelog/doc-history-server/{NEW_VERSION}.mdx)
ZUDO_DOC_NOTES=$(awk 'BEGIN{f=0} /^---$/{f++; next} f>=2' \
  src/content/docs/changelog/zudo-doc/{NEW_VERSION}.mdx)
CREATE_NOTES=$(awk 'BEGIN{f=0} /^---$/{f++; next} f>=2' \
  src/content/docs/changelog/create-zudo-doc/{NEW_VERSION}.mdx)

PRE=""; case "{NEW_VERSION}" in *-*) PRE="--prerelease";; esac

gh release create "zudo-doc-history-server-{NEW_VERSION}" \
  --title "@takazudo/zudo-doc-history-server {NEW_VERSION}" \
  --notes "$HISTORY_NOTES" --draft $PRE

gh release create "zudo-doc-v{NEW_VERSION}" \
  --title "@takazudo/zudo-doc {NEW_VERSION}" \
  --notes "$ZUDO_DOC_NOTES" --draft $PRE

gh release create "v{NEW_VERSION}" \
  --title "create-zudo-doc {NEW_VERSION}" \
  --notes "$CREATE_NOTES" --draft $PRE
```

Any version containing a hyphen is a prerelease and must receive `--prerelease`; stable
versions omit it. Keep all three releases as drafts until their package/body mapping has
been reviewed. Publish in dependency order: history server, zudo-doc, then
create-zudo-doc, waiting for each npm publication before the next.

## Done

Report the version bump, six localized MDX entries, three generated `CHANGELOG.md`
outputs, three tags, three GitHub release links, and npm publication state.
