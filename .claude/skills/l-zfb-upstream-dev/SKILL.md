---
name: l-zfb-upstream-dev
description: "Rules for editing the zfb upstream framework (Takazudo/zudo-front-builder) from this consumer project. ALWAYS work in a git worktree — never touch the `../zfb` root checkout directly, because concurrent Claude sessions may also be using it. Use when fixing zfb bugs, prototyping zfb features, bumping the pin to test, or any work that modifies files under `../zfb/`. Triggered by \"edit zfb\", \"fix zfb\", \"patch zfb\", \"zfb upstream\", \"zfb worktree\"."
---

# l-zfb-upstream-dev

Rules for editing the upstream zfb framework (`Takazudo/zudo-front-builder`, sibling repo at `../zfb`) from this consumer project.

## Why this exists

`package.json` has:

```json
"@takazudo/zfb": "file:../zfb/packages/zfb"
```

The dep resolves to whatever is on disk at `../zfb/packages/zfb`. That path is shared with every other Claude Code session running in any consumer of zfb on this machine (zudo-doc, e2e fixtures, other showcase projects, etc.). If two sessions both check out different branches at `../zfb`, mid-build, the one that finishes second silently overwrites the other's work and the first build picks up code it didn't ask for.

**Real incident (2026-05-06)**: While this session was bumping the zfb pin to `8e8aed2`, another session was concurrently working in `../zfb` on `base/content-plugin-fixes` → `fix/runtime-check-accepts-embedded-vendor`. The two sessions would have collided if either had run `git checkout` at the root.

## The rule

**Never run `git checkout`, `git reset`, `git pull`, `git fetch --depth`, or any state-mutating git command at `../zfb` itself.** The root checkout is shared.

For ANY work that needs to edit, branch, build, or test zfb:

1. Create a git worktree at a fresh path: `../zfb-wt/<topic>/` (or `$HOME/work/zfb-wt/<topic>/`)
2. Do the work there
3. Build the zfb npm package from inside the worktree
4. Point this project at the worktree's `packages/zfb` for the duration of your work
5. Clean up the worktree when done

## Recipe — read-only inspect (just look at zfb code)

Read-only is safe at the root. Use `Read`, `grep`, `cat`. Do not `git checkout` or modify.

For checking what's on `origin/main` without disturbing the root branch:

```bash
git -C ../zfb fetch origin main 2>/dev/null
git -C ../zfb log --oneline origin/main -n 30
git -C ../zfb show origin/main:path/to/file
```

`git fetch` of a remote is non-mutating to working state. Safe.

## Recipe — edit zfb, build, and use it from this project

```bash
# 1. Create the worktree from origin/main (or the branch you want to base off)
ZFB_REPO=$HOME/repos/myoss/zfb        # adjust to wherever ../zfb actually lives
WT_TOPIC=fix-syntect-fallback         # short kebab-case topic name
WT=$HOME/work/zfb-wt/$WT_TOPIC

git -C "$ZFB_REPO" fetch origin
git -C "$ZFB_REPO" worktree add "$WT" -b "fix/$WT_TOPIC" origin/main

# 2. Edit zfb in the worktree
cd "$WT"
# ... edit files, run cargo build, cargo test, etc.

# 3. Build the npm package the consumer imports
cd "$WT/packages/zfb"
pnpm build   # or whatever the package's build script is

# 4. Point the consumer at the worktree (TEMPORARILY)
#    Edit the consumer's package.json:
#      "@takazudo/zfb": "file:../zfb/packages/zfb"  →  "file:<absolute path to $WT>/packages/zfb"
#    Then in the consumer:
cd /path/to/consumer
pnpm install   # picks up the new file: path
pnpm build     # uses your worktree's zfb

# 5. When the upstream PR lands, point back at the regular ../zfb
#    Restore the original file: path in package.json, pnpm install, build to verify.

# 6. Remove the worktree (after PR merged)
git -C "$ZFB_REPO" worktree remove "$WT"
git -C "$ZFB_REPO" branch -D "fix/$WT_TOPIC"   # if not already merged
```

The crucial property: **`$ZFB_REPO` HEAD never moves**. Whatever branch the other session has checked out there stays put. Your branch lives only in the worktree.

## Recipe — bump our pin to a newer zfb commit (no zfb edits, just bump)

This is the case when zfb upstream already has the fix and we're just consuming it.

```bash
# 1. Inspect (read-only, safe at root)
git -C ../zfb fetch origin
git -C ../zfb log --oneline origin/main -n 20
TARGET_SHA=$(git -C ../zfb rev-parse origin/main)
echo "$TARGET_SHA"

# 2. We do NOT need a worktree for this — the consumer's CI checks out the SHA itself
#    (see .github/workflows/*.yml ZFB_PINNED_SHA). The local file: dep uses whatever
#    is on disk at ../zfb, which the OTHER session controls. For local verification
#    we need the worktree path.

# 3. Local verification: create a worktree at the target SHA, point at it temporarily
WT=$HOME/work/zfb-wt/pin-verify
git -C ../zfb worktree add "$WT" --detach "$TARGET_SHA"
# ... cd "$WT/packages/zfb" && pnpm build, then point package.json at it, pnpm install, pnpm build the consumer.

# 4. If verification passes: edit our consumer's pin metadata and push.
#    - .github/workflows/main-deploy.yml      ZFB_PINNED_SHA
#    - .github/workflows/pr-checks.yml        ZFB_PINNED_SHA
#    - .github/workflows/preview-deploy.yml   ZFB_PINNED_SHA
#    - zfb.config.ts                          comment header
#    Restore package.json's file: path back to ../zfb afterwards (or keep the worktree
#    until the other session also bumps).

# 5. Clean up
git -C ../zfb worktree remove "$WT"
```

## What NOT to do

- ❌ `git -C ../zfb checkout origin/main` — yanks the other session's branch from under them
- ❌ `git -C ../zfb pull` — same (and may merge unexpectedly)
- ❌ `git -C ../zfb reset --hard origin/main` — destroys the other session's work
- ❌ Editing files under `../zfb` directly while another session has work there
- ❌ `pnpm install` in `../zfb` (touches lockfile and node_modules state)

## What IS safe at `../zfb` root

- ✅ `git -C ../zfb status` — read-only
- ✅ `git -C ../zfb log` — read-only
- ✅ `git -C ../zfb show <ref>:<file>` — read-only
- ✅ `git -C ../zfb fetch origin` — only updates remote refs, doesn't move HEAD or working tree
- ✅ `git -C ../zfb worktree add <path> ...` — creates a new working tree elsewhere; does NOT move root HEAD
- ✅ `Read` / `grep` / `cat` at any path under `../zfb`

## Detection: how to know another session is working on zfb

Before doing ANY zfb-touching work, check:

```bash
git -C ../zfb status               # is the working tree clean? what branch?
git -C ../zfb log --oneline -n 3   # recent commits
git -C ../zfb worktree list        # are other worktrees already attached?
```

If the working tree has uncommitted changes, or the branch is something other than `main`, or there are existing worktrees with topic-named branches — assume another session owns it. Use a worktree at a fresh path; do not run any state-mutating command at the root.

## Cross-references

- Project lessons covering this kind of cross-repo coordination: `l-lessons-zfb-migration-parity`
- The pin lives in: `zfb.config.ts` (comment header), `.github/workflows/{main-deploy,pr-checks,preview-deploy}.yml` (env `ZFB_PINNED_SHA`), `package.json` (`file:../zfb/packages/zfb`)
