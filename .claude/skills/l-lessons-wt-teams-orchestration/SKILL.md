---
name: l-lessons-wt-teams-orchestration
description: Project lessons learned for running /x-wt-teams multi-agent epics in this repo. Read PROACTIVELY before planning or implementing any multi-wave epic (e.g. the Theme Batch / Theme Finalize epics, or any /big-plan epic destined for /x-wt-teams). Contains traps about merge timing, child-agent self-review, and which checks only the manager can run.
---

## 2026-07-16 — Theme Core (#2812) multi-wave /x-wt-teams run

### What we set out to do

Implement a 10-sub-issue epic across 5 dependency-ordered waves via `/x-wt-teams -a -m`, each sub-issue built by a worktree child agent, merged into a base branch, then merged to `main`.

### Approach we tried first

- **Merged each child's branch as soon as its worktree looked done** — commits present, working tree clean, package-scoped unit tests green — without waiting for the child's own completion report.
- **Told children to run `/light-review` (or `/codex-review`) as their self-review step** and report back when done.

### Why it went wrong (root cause)

1. **"Tests pass + tree clean" is not "the agent is done."** The child's mandated self-review had not finished. Merging on that signal pruned the worktree out from under a still-running review. Three sub-issues (#2822 engine, #2823 generator, #2825 dialog) were merged this way, and **every one's review then surfaced a real bug** — including a **P1 last-write-wins race hole in the runtime switch engine that was a defect in the ADR's own algorithm**. Each agent recovered only because it happened to open a follow-up branch; that was luck, not design.
2. **Worktree child agents park on background reviews.** `/light-review` / `/codex-review` launch codex as a *background* task and then wait for a completion notification. Inside a subagent that notification is delivered to the **manager**, not the child, so the child stalls — **6 of 7 children this run** ended their turn parked ("waiting for the Monitor / codex review"), with work often **left uncommitted**. The manager only discovered this by inspecting each worktree directly, which is what pushed it toward the premature-merge workaround above. The two traps are one causal chain: parking → manager works around it by merging-on-inspection → premature merge.

### What worked instead

- **Merge only on the child's explicit completion report** (review applied + committed). When a child parks, resume it (`SendMessage`) with: "you will NOT receive a background-review notification — run the review in the FOREGROUND, apply findings, COMMIT, then report." After that instruction, children came back with reviews actually applied (e.g. #2821), not abandoned.
- **The manager runs the heavy checks on the merged base**, because children structurally cannot: full `pnpm build`, e2e, `pnpm b4push`, and anything that holds a port (dev servers) freeze the machine or blow token budgets. Every integration / zdtp / CI bug this run was **invisible to package-scoped unit tests** and surfaced only in the manager's full-build + e2e + deep-review passes on the merged base (missing barrel export → shipped `routes-src` broke; a required payload field → SSR `registry is not iterable`; `configurePanel` not pushing zdtp overrides to `:root`; a flaky `npm pack --json` parse; a cold-CI timeout; `_temp-resource` tripping the compatibility contract).

### Watch for next time

- If a child agent's last message is "waiting for the review / Monitor / codex to finish," it has **parked** — its self-review will never complete on its own. Resume it and force foreground review + commit-before-report. Better: bake "run self-review in the foreground; do NOT start a background review and await a notification — you won't get one" into the child prompt from the start.
- If you're about to `git merge` a child branch and remove its worktree, first confirm the child sent a **completion report**, not just that tests are green and the tree is clean. A clean tree with green package tests is the state a parked-mid-review agent is also in.
- Package-scoped unit tests passing tells you **nothing** about cross-package integration, SSR, or CI-job behavior. Before merging a wave to the parent, the manager must run the **full site build** and the **e2e / drift / b4push gates** on the merged base — children are barred from these (ports / freeze).
- A required field added to a shared payload type (`RouteContextPayload` etc.) mid-epic is a breaking change for hosts that construct the payload themselves — normalize `?? null` and keep the field optional, or the upgrade path throws at SSR.
- CI runs the *full* job command set, not the single-package suite you ran locally. Reproduce a red check by running the exact CI step commands (`pnpm test:packages`, the lint-gate commands), not `pnpm --filter <one-package> test`.
- `_temp-resource/` planning scratch is committed but "tooling ignores it" — it will trip content lint gates (compatibility contract, etc.) on every epic that carries it until Finalize deletes it. Exclude the prefix from the offending check rather than deleting the scratch.

### Would-skip-if-redoing

- Skip merging-on-green-tests. It saved no real time — every premature merge cost a follow-up branch + re-merge + re-verify, strictly more work than waiting for the report would have been.
- Skip re-arming shell monitors with `status=` as a loop variable in zsh — `status` is read-only there and silently kills the monitor. Use a non-reserved name.
