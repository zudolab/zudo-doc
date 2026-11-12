---
name: l-make-release
description: >-
  Release the three lockstep packages (@takazudo/zudo-doc-history-server,
  @takazudo/zudo-doc, create-zudo-doc) by following RELEASE.md's release procedure with
  the repository helpers in scripts/release/: prepare, release PR with executed A2,
  accepted-integration binding, tags, draft releases, ordered OIDC publication and
  readback; Cloud sessions run tags/drafts/publication through the Actions release
  path (release-actions.yml). Shared by Claude Code and Codex (local or Cloud). Autonomous by default;
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

## Cloud sessions (Claude Code Cloud, Codex Cloud): coordinate, do not push tags

Do steps 1–6 in the session, then run steps 7–9 through the **Actions release path**
(RELEASE.md, "Actions release path"); never run `tag`, `releases` or `publish` from a Cloud
shell, and never push a tag from it.

1. `node scripts/release/release.mjs actions-inputs --version V --evidence DIR` prints the
   inputs for `.github/workflows/release-actions.yml` from the verified step-4/6 records.
2. Dispatch it on `main`, first with `stage=admit`, then `stage=tag` (inspect the three
   drafts), then `stage=publish`: `gh workflow run release-actions.yml --repo zudolab/zudo-doc --ref main -f …`,
   or the GitHub MCP workflow-dispatch tool if the session has one. `gh` being
   unauthenticated is not proof that dispatch is impossible — try the MCP tool before
   concluding.
3. If neither can dispatch, hand it to a person: Actions → "Release (Actions path)" → Run
   workflow on `main`, with the printed inputs. Report it as handed off, not done.
4. Watch the run (`status`, the run's job summaries and its `release-evidence-*`
   artifacts). To resume after any failure, dispatch again with the **same** inputs.
   Never change the version, integration SHA or evidence identifiers to get past a
   failure: a source change goes back to fresh A2 (step 4) and integration approval
   (step 6).
5. If the tag API or a dispatch is refused (401/403), report the job's actual error and
   the permissions/rulesets it printed, without asserting a cause. Do not retry through
   another route (local tag push, PAT, ruleset bypass, npm settings); hand it to the owner.

## Rules that are easy to get wrong

- A green A2 job with a skipped test step is a blocker, not a pass. Expect the first
  release run to need the build-identity rebaseline (RELEASE.md, "Rebaselining the release
  build identity").
- Bind all three tags to the accepted main integration SHA from `integration.json`, never
  `main`, `HEAD` or the release branch. Never move an existing tag. "main HEAD is green"
  is never a substitute for the exact A2 run/attempt, artifact digest, tested tree and
  exact-SHA main workflow evidence.
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
integration SHA, the release-actions.yml run(s) and who dispatched them (when used), the three tags and release URLs, each package's publish run, registry
state and npm publisher identity from `publication.json`, the Production Deploy run for
the integration, and anything blocked or handed to the owner.
