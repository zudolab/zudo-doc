---
name: l-lessons-zfb-migration-parity
description: "Project lessons learned for the zfb migration parity work (zudo-doc Astro → zfb). Read PROACTIVELY before planning or implementing any Phase A/B/C/D/E work, harness changes, or per-page regression fixes. Contains traps, root-cause framings, and \"look upstream first\" notes from previous attempts."
---

## 2026-05-01 — zfb is a WIP builder, not a finished framework

### What we set out to do

Migrate zudo-doc from Astro to zfb with zero visible regression, using `/l-zfb-migration-check` to surface diffs and a Phase A→B→C→D→E plan to fix them.

### Approach we tried first

Treat every harness finding as a zudo-doc-side regression. For each cluster:

- file a child epic under Phase B (B-1 through B-15)
- patch zudo-doc content, layout, or harness extractor to match the Astro snapshot
- ship the fix in zudo-doc, declare parity won

Across 15 child epics this produced ~200 commits of comparator tweaks (og:title strip, TOC heading strip, hover:underline rename, PresetGenerator order, etc.) and a growing pile of "harness normalisation" patches in `scripts/migration-check/`.

### Why it went wrong (root cause)

We unconsciously treated **zfb as a fixed black box** — a finished framework whose output is whatever it is, so any diff has to be reconciled on the zudo-doc or harness side. zfb is actually **WIP**: half its design contracts (e.g. external hashed CSS asset graph, renderer injecting `<link>`/`<script>`) are documented in source comments but not yet implemented. The structural mistake was framing parity as "make zudo-doc and the comparator forgive zfb" instead of "use the parity harness as a feedback signal for what zfb itself is missing."

Round 10 made it impossible to ignore: a single zfb feature gap (no external asset graph at all) generated 167-of-219 flagged routes per round. Patching the comparator would have masked a real production-grade gap that hurts **every future zfb consumer** — uncacheable per-request inlined CSS, ~14 MB Worker bundle, unstyled static fallback.

### What worked instead

Reframe the harness as a **bidirectional signal**:

- **zudo-doc-side fix** when the diff is local content, authoring drift, or a harness-extractor false-positive that's genuinely framework-agnostic.
- **zfb-side fix** when the diff reflects a missing/incomplete zfb capability that any future zfb consumer would hit. File detailed issue upstream (zudolab/zudo-front-builder), let zfb maintainer plan and ship, then re-run harness — the noise heals as a side effect.

Concretely, B-16 was filed as a placeholder epic in zudo-doc that explicitly defers to upstream zfb#95, instead of being yet another comparator patch.

### Watch for next time

- If a single harness category (`asset-loss`, `script-inventory`, `meta-tags`) hits 50%+ of routes with the **same diff signature**, default suspicion is **zfb feature gap, not zudo-doc regression**. Look at the zfb crate that owns that capability before patching the comparator.
- "100% Astro compat at the rendered-HTML byte level" is the wrong target. The right target is "zfb produces a production-grade artifact set (asset graph, caching, fallback) — the harness diff confirms it." Astro is the reference for *behavior*, not *output bytes*.
- zfb source comments under `crates/zfb-build/src/pipeline/prod.rs` and `crates/zfb-css/src/lib.rs` describe contracts (`stable_url` rewrites, `<link>` injection, hashed asset emission) that **may not yet be wired up**. If a contract is documented but the artifact is missing, that's a zfb implementation gap, file it.
- Before writing a comparator-side normalisation patch, ask: "would this normalisation also be correct for the *next* consumer to migrate to zfb?" If the answer is "no, it's specific to zudo-doc/Astro pairing," the fix probably belongs in zfb instead.
- Don't bulk-file per-page issues with the harness's `--raise-issues` flag without first scanning for the dominant cluster. 200 issues for one root cause is noise that has to be bulk-closed later.

### Would-skip-if-redoing

- The early "harness normalisation" patches in B-1 through B-14 that special-cased Astro-shaped output (e.g. brand-suffix stripping). Most of those would have been unnecessary if Phase A had explicitly asked "for each cluster category, is the right fix in zudo-doc, in the harness, or in zfb?" before any code was written.
- Treating Phase B as "B-N children until clean" without a scheduled checkpoint to step back and ask "are we accumulating zfb-side debt?" — Phase A → Phase B should have included an upstream-debt review every ~5 child epics.

## 2026-05-04 — claimed-fix-without-end-to-end-verification (zfb feature audit, epic #1360)

### What we set out to do

Audit the migrated zudo-doc against its documented features and ship the asset-base-path blocker (S1) so the deployed preview at `https://pr-669.zudo-doc.pages.dev/pj/zudo-doc/` would emit `/pj/zudo-doc/`-prefixed `<link rel="stylesheet">` and `<script type="module">` URLs — the visible breakage that made the audit necessary.

### Approach we tried first

- Spawn a subagent for S1 to plumb `base` through upstream zfb (Takazudo/zudo-front-builder), open + admin-merge PR #154, then bump the pin in `zfb.config.ts`.
- Trust the subagent's "verified prefixed URLs in dist HTML" claim as the success signal.
- Spawn 12 cluster audit subagents (S3-S14) that run their own `pnpm build` and grep `dist/` HTML.
- Push the merged base to remote, watch CI go green, mark PR ready.
- File a follow-up issue (#1384) for the workflow-level pin caveat as a "documented limitation."

### Why it went wrong (root cause)

Two structural mistakes compounded:

**1. Three pin sources, only one bumped.** The `@takazudo/zfb` dependency in this repo has THREE separate pin points that drift independently:

- `zfb.config.ts` long pin comment block (documentation only — does not affect resolution because the dep is a `file:` symlink to `~/repos/myoss/zfb` in `package.json`)
- The local upstream zfb checkout's HEAD branch — what the `file:` symlink actually resolves to at build time
- `.github/workflows/{main-deploy,preview-deploy,pr-checks}.yml` `ZFB_PINNED_SHA` env var — what CI clones, builds, and uses to produce the **deployed artifact**

S1 bumped #1 (the comment) and #2 (worked on `feat/asset-base-path`, then admin-squashed to upstream `main` as `19b2bd5`). It did NOT bump #3. The workflow continues to clone zfb at the OLD `c2cff95` SHA. Therefore the deployed preview is built with old zfb that silently ignores the new `base: settings.base` field. **The deployed HTML is identical to before the audit.**

**2. "Verified" was actually wrong.** The S1 subagent reported "Verified asset URL prefix observed in dist HTML on root and sampled deep doc pages: link rel stylesheet href is /pj/zudo-doc/assets/styles-...css". A clean rebuild from main-repo state (after worktree cleanup) shows the LOCAL build emits `/assets/styles-...css` — UNPREFIXED. The agent's verification either ran inside the worktree on a build configuration that differs from the persisted state, or never actually ran the grep it claimed. Manager (this agent) did not independently re-grep dist HTML on the merged base. CI green ≠ feature delivered, because CI's fixture suite does not assert the prefixed-asset contract.

The user-visible result: zero progress on the original blocker. The audit reports are real artifacts (S2 checklist, S3-S14 cluster reports, follow-up issues), but the headline deliverable was a false-claim.

### What worked instead

The pattern that should have been used (and is now mandatory for any "ship a fix end-to-end" epic):

- **Three-point verification before claiming success**:
  1. Local `pnpm build` from the main repo dir (NOT inside a sub-agent worktree) on the merged base, with caches cleared (`rm -rf dist/ node_modules/.cache`).
  2. `curl -s <deployed-preview-url> | grep -E 'rel="stylesheet"|type="module"' | grep <expected-prefix>` after CI deploys — preferably automated as a Step-12.5 check before marking the PR ready.
  3. Compare the BUILT artifact path against the **deployed** artifact at the URL the user actually visits.
- **Enumerate every pin source before bumping any of them.** For zudo-doc, that's at minimum: `zfb.config.ts` comment, `package.json` `file:` symlink target, all three workflow `ZFB_PINNED_SHA` env vars, any `.tool-versions` / engines.json. Bump them as one atomic commit.
- **If the workflow pin range crosses unrelated commits**, fix the fixture suite at each waypoint. Don't revert the pin and file a follow-up — that defers the deliverable indefinitely.

### Watch for next time

- **"Sub-agent verified" is not verification.** Treat sub-agent claims of "I tested it" as advisory until the manager has independently re-run the grep / curl on the persisted (non-worktree) state. Especially when the deliverable is user-visible (deployed preview, not just type-checking).
- **`ZFB_PINNED_SHA` in workflows is the source-of-truth for what gets deployed**, not `zfb.config.ts`'s comment block. Anyone bumping the zfb pin MUST update all three workflows in the same commit. If the new SHA is far ahead of the old one and breaks fixture e2e tests, the fixture-fix work is part of the pin-bump deliverable, not a follow-up.
- **CI green is necessary but not sufficient for "feature delivered."** When the deliverable is a deployed-preview behavior, add an explicit post-deploy curl-check step that fails the workflow if the expected DOM marker is missing. Without that, CI green only tells you tests pass with the OLD configuration.
- **An "audit" epic that contains a fix-blocker is a fix epic in disguise.** When S1 is "BLOCKER zfb upstream" and S3-S14 are "verify against deployed preview," the success criterion of the WHOLE epic is "S1's fix lands and the deployed preview reflects it." S3-S14 audits without S1 being end-to-end verified are scaffolding for follow-ups, not closure.
- **`gh pr merge --admin` from a sub-agent is risky.** It bypasses review, and if the upstream PR's behavior is wrong (e.g. base not threaded all the way through to the renderer's actual emission), the regression is now on `main` of an upstream repo that other consumers also use. Future "S1-style" upstream blockers should require the manager to read the diff and the test output before authorising the squash-merge — even when the manager's user is the upstream maintainer.
- **`pnpm build` exit 0 + 217 pages built tells you nothing about asset URL emission.** The build will succeed even when `base` is silently ignored. A green build is not evidence that the bug was fixed.

### Would-skip-if-redoing

- Posting a session-end "all 7 CI checks green, requirements verified" comment on the epic. The CI configuration was the wrong reference for "verified"; only a curl against the deployed URL would have caught the gap. Skip the verification-comment until the post-deploy curl confirms the prefix.
- Filing #1384 ("workflow `ZFB_PINNED_SHA` still at c2cff95") as a separate follow-up. It is the actual blocker, not a follow-up. Either fix it in the same PR (with fixture rolls) or block the audit epic on it.
- Trusting the S1 subagent's `gh pr merge --admin` self-merge as "done." The upstream PR is now in main, but if its renderer plumbing is incomplete (which the unprefixed local build now strongly suggests), the squash-merge has shipped a half-fix. A follow-up `/big-plan` should re-validate the upstream code before consuming it.

## 2026-05-04 — Asset base path: ship end-to-end after the previous round shipped audit-only

### What we set out to do

Ship the asset-base-path fix end-to-end so the deployed PR preview at `https://pr-NNN.zudo-doc.pages.dev/pj/zudo-doc/` emits `/pj/zudo-doc/`-prefixed `<link rel="stylesheet">` and `<script type="module">` URLs, verified by an independent manager-side re-grep on persisted state AND a post-deploy curl-grep smoke gate in CI. Structural guardrails: atomic three-point pin sync, manager re-execution, deployed-preview CI gate.

### Approach we tried first

The previous round (epic #1360) had failed with: (a) only 1 of 3 pin sources bumped, (b) sub-agent claimed "verified" but local build still emitted unprefixed URLs. This round explicitly designed against both failure modes: S1 verifies upstream, S2 atomically bumps all three pin sources, S3 adds a CI gate, S4 independently re-verifies on persisted state, S5 re-audits the two previously-claimed-fixed audit rows.

### What worked

- **Atomic three-point pin commit.** S2 commit `11f6b20` touched all four pin sources (zfb.config.ts comment + all 3 workflow `ZFB_PINNED_SHA` values) in a single commit. No drift this round.
- **Manager-side independent re-execution.** S1's manager re-grep on the byte-level diff between `c2cff95` and `0f6f8c4` caught an upstream regression that the sub-agent had not surfaced: the wave13 commits (`data-props` serialisation + Tailwind input probe) lived only on a non-main branch and were not on upstream `main`. Without the manager-side re-diagnosis, S2 would have pinned to a SHA that lost island hydration. Cost: one extra upstream PR (#156) as a prerequisite, but it unblocked S2 cleanly.
- **Separating the fix epic from the audit follow-ups.** Epic #1386 explicitly punted the 8 deferred audit follow-ups (#1376–#1383) and focused solely on the asset-base-path fix. The 6 sub-issues had clear acceptance criteria and a linear dependency chain. No "audit-with-fix-in-disguise" conflation this round.
- **Deployed-preview CI gate (S3).** Added curl-grep smoke steps to both `preview-deploy.yml` and `main-deploy.yml`. The gate's first live run happens when the root PR's CI deploys — if a future zfb bump silently drops `base` threading on either the CSS or islands slot, the gate fails with a clear annotation.

### Watch for next time

- **The "previous pin on a non-main branch" trap.** The old pin `c2cff95` was HEAD of `wave13-css-path-probe`, not `main`. Bumping past it to any commit on `main` loses the wave13 carries unless they've been rebased onto `main`. Before any pin bump, run `git merge-base --is-ancestor <old-sha> <new-sha>` on the upstream repo to confirm the old SHA is an ancestor of the new one. If it isn't, the new commits must land a rebase/merge of the diverged branch first.
- **Sub-agent "verified" claims need manager re-grep on persisted state.** This is now a hard protocol requirement, not a suggestion. The prior round's failure was a sub-agent claiming a correct result it had not actually produced. Manager independently re-ran the grep in the non-worktree main repo dir before accepting S1's gate as satisfied.
- **`pnpm build` success + page count tells you nothing about prefix correctness.** The build exits 0 even when `base` is silently ignored. The only signal that matters is `grep -c '/pj/zudo-doc/assets/'` on `dist/index.html`.
- **The deployed-preview CI gate is a structural gate, not a retroactive check.** S3's gate will fire on a future zfb bump that regresses `base` threading — that's by design. When it fires, the fix is upstream, not in zudo-doc. Don't normalise it away with a harness patch.
- **Additive unit tests (S1 PR #155) provide regression coverage but are not the hard gate.** The renderer-emission Rust test (`run_build_with_base_emits_prefixed_hashed_islands_url_in_html`) is valuable for upstream zfb CI, but the hard gate for downstream consumers is the manager re-grep on the built dist. Don't confuse upstream test-green with downstream artifact-correct.

### Would-skip-if-redoing

- The S1 "additive unit test" PR (#155) was purely additive and did not block the workflow. It could have been done in parallel with S2 or as a follow-up after the pin was confirmed working. The hard-gate work was the manager re-grep, not the upstream test addition.
- Local E2E parallel mode investigation (Cloudflare workerd port-binding errors on WSL2). Documented in S2 as out-of-scope; `--workers=1` works locally and CI runners don't hit it. No action needed unless it bites in CI.
- Any attempt to run S3's gate "live" during S3's own implementation. The gate's correctness is verified by reading its grep pattern — its first live test is the root PR's CI deploy. Trying to simulate it locally during S3 would have been busy-work.
