---
name: l-make-release
description: >-
  Release the three lockstep packages (@takazudo/zudo-doc-history-server,
  @takazudo/zudo-doc, create-zudo-doc) by following RELEASE.md's release procedure with
  the repository helpers in scripts/release/: prepare, release PR with executed A2,
  accepted-integration binding, tags, draft releases, ordered OIDC publication and
  readback. Shared by Claude Code and Codex (local or Cloud). Autonomous by default;
  --confirm gates publication. Use when the user says 'make release', 'l-make-release',
  'release create-zudo-doc', or asks to publish a new version.
user-invocable: true
disable-model-invocation: false
argument-description: "Optional: version string or bump mode (e.g. 0.2.0, 1.0.0-next.1, minor, stable), and/or --confirm to ask before publishing to npm"
---

# /l-make-release

This file is the agent entry point for both Claude Code (`.claude/skills/l-make-release`)
and Codex (`.codex/skills/l-make-release` is a symlink to this file). **The procedure itself
lives in `RELEASE.md` → "Release procedure"** — read that section in full and follow its
numbered steps; do not work from memory or from an older copy of this skill. The
deterministic steps are `node scripts/release/release.mjs <subcommand>`.

## Before starting

- Work from a clean checkout of `main` in the repository root (not a `worktrees/` child —
  pushing from a worktree is blocked by design).
- Run `node scripts/release/release.mjs preflight` and keep its capability table in the
  report. A missing write capability means: do the read-only steps, then hand the write
  steps to the owner. Never add or ask for a personal access token on your own.
- Pick an evidence directory outside the linked package, e.g. `../release-evidence/<version>`.
- No npm credential is used anywhere. Do not run `npm login`, `npm publish`, or
  `npm dist-tag` yourself — npm writes happen only in the publish workflows via OIDC.

## Autonomy

Default: autonomous through every step in RELEASE.md, including publication (step 9).
`--confirm`: ask exactly once, immediately before step 9, showing the version, the three
packages and a one-line summary of each package's note; publish only on an affirmative
answer, otherwise stop with the drafts in place. No other prompts.

## Step map

| RELEASE.md step | Command |
|---|---|
| 1 Preflight | `node scripts/release/release.mjs preflight` |
| 2 Prepare | `./scripts/release-create-zudo-doc.sh [<version>\|<mode>]`, fill six notes, `pnpm gen:changelog`, `B4PUSH_SKIP_PIN_PUBLISHED=1 pnpm b4push` |
| 3 Release PR | branch `release/<version>`, commit, push, `gh pr create --base main` |
| 4 A2 evidence | `node scripts/release/release.mjs a2-evidence --pr N --run ID --attempt N --candidate SHA --base SHA --out DIR` |
| 5 Merge | normal merge policy |
| 6 Integration | `node scripts/release/release.mjs integration --evidence DIR/a2-evidence.json --integration SHA --out DIR` |
| 7 Tags | `node scripts/release/release.mjs tag --version V --evidence DIR` |
| 8 Draft releases | `node scripts/release/release.mjs releases --version V --evidence DIR` |
| 9 Publish | `node scripts/release/release.mjs publish --version V --evidence DIR` |
| 10 Read back | `node scripts/release/release.mjs status --version V` |

## Rules that are easy to get wrong

- A green A2 job with a skipped test step is a blocker, not a pass. Expect the first
  release run to need the build-identity rebaseline (RELEASE.md, "Rebaselining the release
  build identity").
- Bind all three tags to the accepted main integration SHA from `integration.json`, never
  `main`, `HEAD` or the release branch. Never move an existing tag.
- Never dispatch Production Deploy (or any deployment) to manufacture evidence.
- Exit code 2 from a helper means **unknown** (registry/GitHub uncertainty): wait and re-run
  the same command; never treat it as "absent" and never republish.
- An already-published version is reported as verified, not as a fresh publication.
- Leave the history-server peer floor alone except at a major bump (RELEASE.md,
  "First-party peer floor").
- Release notes: one truthful EN/JA pair per package, by user-facing package ownership
  (RELEASE.md, "Package-specific release notes").

## Report

Headings state the verdict. Include: version, release PR, A2 run/attempt/artifact, the
integration SHA, the three tags and release URLs, each package's publish run, registry
state and npm publisher identity from `publication.json`, the Production Deploy run for
the integration, and anything blocked or handed to the owner.
