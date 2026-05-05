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

## 2026-05-04 (later) — Asset pipeline followups: ship two host-side workarounds with a structural-and-browser gate stack

### What we set out to do

After epic #1386 merged the asset-base-path fix, two follow-up issues remained from the audit:

- #1394 — `public/` not copied to `dist/` by `zfb build`. Logo SVG returning 404 on the deployed preview.
- #1395 — Default Tailwind theme leaking into the bundle on the deployed preview. Symptom was reported as "partial Tailwind CSS not applied"; root cause was found to be the full default palette polluting `@theme` rather than missing utilities.

The plan: ship host-side workarounds in this round (so the deployed preview goes green immediately), file upstream issues for the gaps, save pin bumps for a later round if/when upstream lands fixes. Six waves, six sub-issues. Run as sequential `--stay` sessions on `base/asset-pipeline-followups`.

### Approach we tried first

- Wave 1 — single subagent diagnoses #1395 root cause (one of five candidates: scanner gap, layer ordering, wave13 probe regression, deploy divergence, island injection). Writes report to `__inbox/diagnosis-1395.md`.
- Wave 2 — manager-confirm gate. Manager re-executes key probes on persisted state, validates or pushes back, writes the implementation spec for Wave 3.
- Wave 3 — two parallel subagents implement #1394 (postBuild plugin) and #1395 (`@theme` reset) per the spec. Each files an upstream issue (NOT PR) on `Takazudo/zudo-front-builder`.
- Wave 4 — single subagent adds the deployed-preview CI smoke gates: HTTP 200 on the logo + structural invariants on the CSS bundle (`MIN_CSS_BYTES`, `MIN_MEDIA`, `MAX_DEFAULT_THEME_COLOR_TOKENS`).
- Wave 5 — manager-side independent end-to-end verification (curl + computed-style + browser screenshots).
- Wave 6 — append this retro.

### Why two of the three big "knowledge transfers" went wrong (and how the next gate caught each)

The cascade is the lesson. Three hand-offs in this round transferred a partial-but-confidently-stated claim from one sub-task to the next; the NEXT structural gate caught two of them (the third was caught by the browser subagent in Wave 5). All three were "sub-agent verified" cases of the kind the prior retro warned about — but each had a different shape.

**Hand-off 1 (Sub-1 → Sub-2): "There is no host-side mitigation that preserves the tight-token strategy."**

Sub-1's diagnosis section 7 concluded the primary fix was upstream-only because no host-side change could prevent zfb from prepending `@import "tailwindcss";`. That was true at the import level but missed Tailwind v4's `@theme { --color-*: initial; }` wildcard pattern, which removes the leaked default tokens at the OUTPUT level rather than at the import level. The Wave 2 manager-confirm gate (Sub-2) caught this by empirically testing the wildcard reset on persisted state — the reset dropped CSS from 87.6 KB to 77.7 KB and removed all 36 leaked default color tokens while preserving project tokens. Sub-2 corrected the diagnosis in an appended "Manager re-execution notes" section (without re-routing to Sub-1, since the central diagnosis was correct) and wrote the spec around the host-side workaround.

**Hand-off 2 (Sub-3 → Wave 4 deploy): "Sub-3's `pnpm build && ls dist/pj/zudo-doc/img/logo.svg` verification proves the plugin works."**

Sub-3's plugin put the logo at `dist/pj/zudo-doc/img/logo.svg` (base-prefixed on disk), based on the spec's reasoning that "Cloudflare Pages serves `dist/X` at `<deploy-root>/X`." That was wrong: the deploy pipeline's prepare step (`mkdir -p deploy/<base> && cp -r dist/. deploy/<base>/`) wraps the entire `dist/` under `deploy/<base>/`, applying the base prefix uniformly. The plugin's own base-prefixing was double-prefixing. Sub-3's `ls` verification passed because the file did land at that path on disk — but the deployed URL was `<root>/<base>/<base>/img/logo.svg`, not `<root>/<base>/img/logo.svg`. The Wave 4 Public-asset smoke gate caught this with HTTP 404 on the first push, on commit `1b21af6`. Manager-side fix in commit `d3d7069`: dropped the base-prefix logic from the plugin so it matches zfb's flat-dist convention.

**Hand-off 3 (Sub-2 spec → Sub-4 implementation): "`--color-*: initial; --spacing: initial;` is a clean two-line workaround."**

Sub-2's spec proposed both wildcards based on the empirical test that the test bundle dropped from 87.6 KB to 77.7 KB and project tokens were preserved. The structural CSS shape was correct after the reset — but `--spacing: initial` quietly broke every Tailwind base spacing utility (`gap-*`, `px-*`, `ml-*`, `m-*`, `p-*`) because they compute as `calc(var(--spacing) * N)`; with `--spacing` initial, the calc evaluates to invalid and the utility resolves to zero. The Sub-6 structural smoke gate did NOT catch this — it is a value-of-rule regression, not a presence-of-rule regression. The Wave 5 browser-side verification subagent caught it: header nav with no gap, sidebar overlapping content, page edges flush to viewport. Manager-side fix in commit `ada45ff`: dropped the `--spacing: initial` line; the `--color-*: initial` reset stayed. The leaked default `--spacing: 0.25rem` is harmless because the project's tight-token rule is about COLORS specifically, not spacing.

### What worked

- **Manager-confirm gate (Sub-2) caught the upstream-only-claim.** Instead of accepting the diagnosis as final, the gate spent 20 minutes empirically testing the workaround and surfaced that a host-side fix DID exist. Without this gate, Wave 3 would have shipped an upstream-issue-only path and the deployed preview would have stayed broken. The gate paid for itself within a single iteration.
- **Structural smoke gates fired on first regression.** The Wave 4 Public-asset gate caught the Sub-3 double-prefix bug on commit `1b21af6` — the gate's first live exercise was a real regression, exactly the design intent. Without the gate, the bug would have shipped quietly because Sub-3's local `ls` passed.
- **Three-tier verification cascade (structural → curl → browser).** Each tier caught a different class of regression: structural gates caught the absent-rule case (404, wrong byte count), curl caught the bytes-correct-but-deployed-wrong case, browser subagents caught the rules-correct-but-values-wrong case. None of the three alone would have caught all three regressions. Worth the budget.
- **Per-topic execution mode + model annotations from `/big-plan`.** Wave 3's two sub-tasks (`subagents`, `sonnet`) ran in parallel without team overhead. Wave 5 went `subagents` `sonnet` for setup and dispatched a one-shot Opus subagent for browser verification. The router did the right thing in each case.
- **Folding #1394's diagnosis into Sub-3** (per the planning-session GCO review). Saved one wave: Sub-3 implemented and verified in one step instead of diagnose-then-implement-then-verify. Did NOT have to re-derive the on-disk layout (it was wrong, but that's a separate problem — the FOLD itself was correct).
- **Per-topic upstream issue filing, not PR filing.** Both Wave 3 sub-tasks filed upstream issues only ([#158](https://github.com/Takazudo/zudo-front-builder/issues/158), [#159](https://github.com/Takazudo/zudo-front-builder/issues/159)). Manager decides PR escalation. Avoided the prior round's `gh pr merge --admin` risk.
- **Conditional sub-task `as not planned` close.** Sub-5 (#1401) was a conditional pin bump that only triggers if upstream PRs land mid-round. They didn't, so the manager closed it as not-planned with a clear comment explaining the trigger condition was not met. Cleaner than leaving an open sub-issue dangling.

### Watch for next time

- **Structural smoke gates are necessary but not sufficient when the deliverable depends on rule VALUES, not just rule PRESENCE.** A bundle can have all the right utility-class names with valid CSS shape, but if their computed values evaluate to zero (e.g., `calc(var(--undefined) * N)`), the user sees broken layout. The structural gate threshold (bytes / @media count / leaked-default count) catches scanner regressions and theme leaks, but cannot catch "this rule is present but useless." The browser-side subagent dispatch is the gate that catches this case — keep it in the cascade for any "deployed-preview behavior" deliverable, not just for "first-time release" pushes.
- **`--token-*: initial` wildcard resets in Tailwind v4 must be scoped to the namespace they actually intend to clear.** `--color-*: initial` is safe because the project's color tokens are explicitly named (`--color-bg`, `--color-p0`, etc.) and re-add immediately. `--spacing: initial` (the bare base name, not the wildcard) is NOT safe because every `gap-*`/`px-*`/etc. utility internally references `var(--spacing)` for its calc — wiping it collapses the entire spacing scale. Before adding any `--X: initial` reset, ask: "what utilities depend on this token via `calc(var(--X) * N)`?" If any do, the reset is unsafe.
- **Spec author's "this works empirically" needs the empirical scope to match the deployment scope.** Sub-2 tested the workaround locally and confirmed metrics (bundle size, leaked tokens, critical utilities present). What was NOT tested was visual rendering at typical viewport with all standard utilities. The metric set was structurally complete but missed the value-of-rule axis. Future spec verification: run `/headless-browser` on the candidate output (or document the visual axis as untested) before promoting the spec to a sub-issue.
- **CDN cache + Playwright screenshot bytes equality is not proof of "no change."** During Wave 5, the post-fix browser subagent's screenshots were byte-identical to the pre-fix subagent's screenshots, which initially looked like the fix didn't deploy. Investigation showed the deployed CSS hash had changed and the new file content was correct — so either Cloudflare's edge cache was serving the previous deploy briefly, or the project's intentional density makes the visual delta of a `--spacing` micro-difference too small to register at typical viewport scale. When screenshot bytes equal across two known-different deploys, fall back to computed-style measurements (`element.computedStyleMap()`) before declaring the fix dead.
- **The "tight-token strategy" is a colour rule, not a universal rule.** `src/CLAUDE.md` explicitly says "NEVER use Tailwind default colors" — that's the rule the @theme reset is enforcing. There is no equivalent rule for spacing, typography, breakpoints, or other namespaces. Future "tight-token" reset patches should reset ONLY the namespace the project's documented rule covers, and explicitly leave the rest alone (with a comment explaining why).
- **Folding diagnosis into implementation (Sub-3 case) is safe when the root cause is pre-confirmed**, but the on-disk-layout decision is a separate axis from the root cause. Sub-3's fold worked (no diagnosis re-derivation), but the on-disk layout the spec dictated was wrong because the spec author hadn't traced the deploy pipeline's prepare step. Future planning: when folding diagnosis into implementation, separately validate any "on-disk layout decision" or "deploy-pipeline interaction" claim — those tend to be where the fold leaks.

### Would-skip-if-redoing

- Sub-2's spec spent three paragraphs explaining why `--color-*: initial` is safe and listing categories of leaked tokens that the wildcard would and would not clear. That analysis was correct for colors but missed the `--spacing` axis entirely (the analysis treated all categories as if they had the same shape). Skip the per-category enumeration in favour of a "what utilities reference this token via `calc()`?" check on each candidate reset before locking the spec.
- The pre-flight check at the top of Sub-6's body that refuses to start until Sub-2 updates the threshold values was useful as a workflow guard but produced a lot of body-content churn. Next round, consider a lighter-weight signalling mechanism (e.g., a single sentinel string `THRESHOLDS_PENDING` that Sub-6's first step greps for, rather than a multi-paragraph pre-flight section). Same protective effect, less editing surface.
- Trying to fix the Wave 5 browser regression in one push. Manager pushed the `--spacing` removal as commit `ada45ff` then re-dispatched a browser subagent immediately, but the post-fix screenshots were byte-identical to pre-fix screenshots and the subagent's verdict was still FAIL. Took longer than expected to disambiguate "fix didn't deploy" vs "Cloudflare cache" vs "subagent's visual interpretation matches the intentional tight design." Next round, when a structural-correct fix is paired with a browser-FAIL verdict, immediately ask the subagent for `element.computedStyleMap()` measurements on the disputed elements (gap, margin-left, padding-left actual computed values) instead of leaning on screenshot interpretation.
- Posting the Wave 5 verification PR comment immediately after the second browser subagent's run. Should have waited 10-15 minutes for any CDN cache to fully roll over, then re-curled the deployed CSS one more time, then posted the comment. The structural verification was correct in real time, but a delayed re-curl would have either confirmed the fix landed cleanly OR surfaced a real cache-staleness issue more decisively.

## 2026-05-05 — zfb pin bump to embed-v8 (epic #1407)

### What we set out to do

Bump the zfb pin from `88cec07` to upstream main HEAD (`e550167` at planning time), bringing in upstream PR #168's deferred miniflare → embedded `deno_core` (V8 in-process) architecture, plus 27 other commits. The plan budgeted 5 sequential waves: parallel Wave 1 (survey + smoke + cache + flake-fix), then sequential confirm/spec/bump/verify/retro waves. Single root PR `base/zfb-pin-bump-embed-v8` → `base/zfb-migration-parity`. Run as a single continuous `/x-wt-teams` session.

### Approach we tried first

Treat upstream's deferred post-merge smokes as "probably fine, run them to confirm." Plan the consumer-side audit (W1A) as a keyword grep — `Backend::`, `miniflare`, `workerd` — assuming the upstream changes were architecturally encapsulated and consumer code would not be affected.

### What worked

- **Autonomous upstream fix authority (epic-scoped)** saved two waves' worth of HOLD pain. W1B found 2 dev-server bugs in upstream PR #168 (cold-start rebuild empty dirty set + PageCache miss returning 500), filed and merged upstream PR #170 in one shot. W3 found an `AsyncLocalStorage` import in `@takazudo/zfb-adapter-cloudflare` blowing up under the embed-v8 host stub list, fixed it upstream and bumped to the new HEAD `bdbfbfb`. Both were the kind of "small Rust patch, root cause obvious within 30 min" the user authorisation envelope was designed for; both would otherwise have HOLDed at W2 for human triage.
- **`/big-plan`-driven wave structure with manager-confirm gate (W2).** W2 was the only non-mechanical sequential wave and it caught the SHA shift from `e550167` → `0549132` after W1B's fix. Without that gate, W3 would have applied the spec against the stale planning SHA and the bump would have been wrong.
- **Per-topic execution mode markers** (`Execution mode: subagents`) on every sub-issue → fully subagent-mode session, no TeamCreate ceremony, no SendMessage, no shutdown pingpong. One Agent call per topic with sonnet, return summaries went straight to manager. Massively cleaner than the old teams path for fan-out-and-merge work.
- **Deployed-preview curl smoke (W4)** caught and confirmed the prefixed-asset regression guard (epic #1386) holds with the new pin. Doing this on the actual Cloudflare Pages preview, not just the local `dist/`, caught a class of pipeline issues that local build alone cannot.

### Watch for next time

- **Upstream PRs that ship with deferred post-merge smokes UNCHECKED are a soft red flag. Always run them before consuming.** PR #168's body had three unchecked checkboxes for `cargo run -p zfb -- build`, `dev hot-reload`, and islands hydration. Two of the three were in fact broken on the merged main. Future pin bumps: scan the upstream changelog/PR bodies for unchecked post-merge action items and run them before scheduling the bump, not after consuming.
- **Consumer-side audit by KEYWORD grep is incomplete for runtime-shape changes.** W1A grepped for `Backend::SpawnMiniflare`, `miniflare`, `workerd`, etc. — caught zero hits, declared "no consumer changes required." W3 then found at runtime that upstream PR #157's renderer/router rework changed the page-handler call shape from `{ params, props }` (nested) to `{ params, ...match.props }` (spread top-level). All 6 consumer page modules were broken at runtime, not at compile time. Future audits: also grep for upstream PR-listed signature changes (page handler shape, plugin contract shape, adapter API shape) and try a `pnpm build` of the consumer against the upstream HEAD before declaring "no changes."
- **SHA target shifts are normal during a pin bump epic, not exceptional.** This bump shifted twice (`e550167` → `0549132` → `bdbfbfb`). Both shifts came from W1B/W3 exercising the autonomous fix authority. Plans should explicitly model "SHA may shift up to N times during execution" rather than treating the planning-time SHA as immutable. Concretely: W2's manager-confirm gate worked exactly because it re-fetched the current upstream main HEAD instead of trusting the spec.
- **Subagents committing to the wrong worktree happens.** W1B's smoke report ended up on the W1D branch instead of the W1B branch (probably because the agent ran cargo dev in upstream zfb, then later wrote the report from a directory under the W1D worktree). Manager fix was a cherry-pick + reset. Future: when a single subagent does work spanning multiple repos (upstream zfb + main worktree), have the agent confirm `git -C <expected> log --oneline -1` before completing, and have the manager verify the same before merging.
- **`pnpm exec playwright` from a worktree hits zfb-side compile cost.** W1D's smoke fixture build fails inside the worktree because `zfb build` triggers the embed-v8 cold compile if not pre-cached. The agent worked around it by building fixtures in the main repo dir and copying them in. Future smoke-fixture-running children: pre-warm the worktree from the main repo's cached binary, or accept the 15-30 min compile cost.
- **`-gcoc` review is fast and surface-level.** Both Wave 1 and Wave 3 reviews returned in seconds with mostly correct, occasionally vague findings. The Wave 3 review missed that one consumer-page edit was unrelated to the router-shape fix (W3 agent caught it himself via /light-review and fixed in commit `81416e9`). Treat `-gcoc` as a linter pass, not a substitute for self-review.

### Would-skip-if-redoing

- The W1C cache-strategy decision wave. The pre-existing `Swatinem/rust-cache@v2.9.1` SHA-keyed config was already strictly better than upstream's `prefix-key` config (every pin bump auto-invalidates cache). The wave's only useful output was the optional `timeout-minutes: 20 → 45` bump suggestion, and the subagent flagged it as non-blocking. Could have been a 5-line note in W1A's survey instead of its own wave + sub-issue + sub-PR + merge cycle.
- Closing W1B's blocker via "manager checks the report and decides" gate (the W2 hard-abort path). Useful as a backstop, but in this run W1B's autonomous fix authority obviated the need — the smokes were green by the time W2 saw them. Future epics where the user grants autonomous fix authority can collapse the W2 manager-confirm-gate concept into a thinner "re-fetch current upstream HEAD" step.
- The W4 "manager-side independent re-grep" step done after the deployed-preview curl smoke. The curl smoke is strictly more covering (it verifies the same prefixed-asset URLs survive end-to-end through the deploy pipeline). Future: make curl-smoke the primary W4 gate, demote the local `pnpm build` re-grep to a fallback for sessions where the deploy is unavailable.

## 2026-05-05 (later) — ZFB style recovery (epic #1417)

### What we set out to do

Restore visual parity on the deployed PR #669 preview at `https://pr-669.zudo-doc.pages.dev/pj/zudo-doc/`. Three concrete framings going in:

- "Tailwind v4 utility classes for `packages/zudo-doc-v2/src/**` are missing from the bundle" (the headline framing for #1417 / #1357 / W1A / W2A / W3A)
- "MDX content plugins are not wired so `:::note` directives stay raw" (#1378 / W3B)
- "Code blocks emit no Shiki tokens AND ~68 pages render via `<pre data-zfb-content-fallback>`" (#1379 / #1380 / W3C)
- Plus host-page wiring quartet (W3D) and two W1C-discovered bugs (W3E)

Single root PR `base/zfb-style-recovery` → `base/zfb-migration-parity`. Five waves: investigation (×3 parallel) → manager-confirm gate (×1) → implementation (×4 parallel after W3A folded out) → verification (×1) → retro (×1). Run as a single continuous `/x-wt-teams` session.

### Approach we tried first

Trust the planning-session evidence. The plan included a quoted empirical line — `grep -c '\.border-muted{' dist/assets/styles-303abaff.css = 0` — and three of the original five sub-issue framings rested on it. The `@source` path-resolution hypothesis (relative to importing CSS file) read plausibly, the engine source-trace was cited, the deployed-preview screenshot showed visibly broken layout. Treat it as a deterministic root-cause cluster and ship the W3A one-line `@source` tweak.

### Why two of the three primary framings went wrong (and what each gate caught)

The cascade is the lesson again, but in a more uncomfortable direction than the prior round: this time **the planning-session evidence itself was the source of error**, not a sub-agent's downstream claim. Three structural mistakes compounded.

**Framing 1 — "missing utility classes in bundle" (W1A → W2A pivot, magnitude: cancels W3A entirely).**

The grep pattern `'\.border-muted{'` requires `{` to appear immediately after the class name with no whitespace. Tailwind v4 emits `.border-muted {` with a space before the brace. The space-less form returns 0 for every class — including the host-side classes from `src/components/**` that everyone agreed worked. Once W1A retried with `'^\s*\.<class>\s*\{'` the count was 1 for every flagged class on local dist. W2A re-ran the corrected regex against the **deployed** bundle (`pr-669.zudo-doc.pages.dev/pj/zudo-doc/assets/styles-ea3fb6dc.css`) and got 1 for every class there too. The `@source` directive at `src/styles/global.css:28` is correct and effective; zfb's `tempfile_in(working_dir)` synthesis at `crates/zfb-css/src/engine.rs:386` correctly resolves `packages/zudo-doc-v2/src/**` relative to the project root. There was nothing to fix host-side. W3A was closed as not-planned. The whole epic's headline framing was a measurement artifact.

**Framing 2 — "MDX plugins not wired" (W3B pivot, magnitude: shifts fix from config to content).**

The host-side `zfb.config.ts` does not register custom remark/rehype plugins, but zfb's bundler runs `Pipeline::with_defaults()` at `crates/zfb-build/src/bundler.rs:785,1015` and `crates/zfb-content/src/content_bridge.rs:183` — which already wires Admonitions, CjkFriendly, HeadingLinks, CodeTitle, ImageEnlarge, Mermaid, and Syntect. The actual `:::note` rendering bug was that zfb's Rust AdmonitionsPlugin requires CommonMark blank-line paragraphs around the directive markers, while the original JS remark-directive (and the corpus's authoring style) accepted both shapes. The fix was reformatting 6 docs files (3 EN + 3 JA) to add blank lines, not wiring anything in `zfb.config.ts`. Filed upstream `Takazudo/zudo-front-builder#185` for the genuine host-side gap (no slot for user-supplied remark/rehype plugins, ResolveLinksPlugin implemented but unreachable from config) — but that gap doesn't block the visible rendering bug, which is purely content-shape.

**Framing 3 — "Shiki + content-fallback are two separate gaps" (W3C consolidation, magnitude: blocks fix entirely on upstream zfb).**

Both #1379 (no Shiki tokens) and #1380 (`data-zfb-content-fallback` widespread) traced to ONE upstream zfb bug: `WalkDir` (unsorted) in `zfb-build` vs `walk_collection` (sorted) in `zfb-content` produce different file-iteration orders → HeadingLinksPlugin's accumulating seen-map produces different slug suffixes → different JSX → different `content_hash` → different `mdx://...#hash` specifiers → bridge map and snapshot disagree byte-for-byte → bridge.get() misses → page silently renders the whole-page fallback, which also strips out SyntectPlugin's highlighted output. No host-side workaround viable (verified by direct `compile_mdx_to_jsx_module_cached` calls on `details`, `mermaid-diagrams`, `html-preview`, `installation` — all four produce valid JSX with proper syntect spans and esbuild parses cleanly). Filed upstream as `zfb#187` (walk-order divergence) and `zfb#188` (Syntect theme not exposed via host config). W3C's deliverable became a 29-line `zfb.config.ts` comment block citing both upstream issues so the next reader hits the pointers immediately. Will resolve on the next pin bump that includes #187.

The unifying observation: **all three framings shared a structural shape — confidently-stated empirical evidence + plausible-sounding hypothesis + visible breakage that "matched"** — and all three were wrong in different ways. Framing 1 was a measurement bug. Framing 2 was a misattribution of a content-shape bug to a config-wiring gap. Framing 3 was a correct symptom set rolled up to two issues when the root cause was one.

### What worked

- **W2A manager-confirm gate paid off again, this time against the planning evidence itself.** Without the gate's mandatory re-grep on persisted state (and against the deployed bundle), W3A would have applied a one-line `@source` change that does nothing, and the epic's headline framing would have stayed wrong. The "Sub-agent verified is not verification" lesson generalises to "planning evidence is not verification" — the gate fires usefully against any pre-stated empirical claim, not just sub-agent output. Cost: ~30 min of W2A's time. Saved: a wasted W3A wave + the cognitive cost of debugging "why didn't the fix change anything."
- **W1A's self-skepticism paragraph.** The W1A report ended with a "Self-skepticism note (per Sub-agent verified is not verification)" listing two failure modes the diagnosis did NOT eliminate (local-vs-deployed parity, selector-shape variance). W2A's scope was driven directly by that paragraph. Encoding the self-skepticism in the report shape — not just the prose — turned it into actionable scope for the next gate.
- **Subagents-mode for read-only investigation.** All three Wave 1 sub-issues were marked `subagents` mode (per `/big-plan` annotations). They ran as one-shot Agent calls with no TeamCreate, no SendMessage, no shutdown ceremony. Each wrote its report to `__inbox/` (gitignored, per-checkout) so the manager could read them post-return. Massively cleaner than the team path for fan-out-and-return investigative work. Same pattern repeated for Wave 3 implementation.
- **Per-topic model assignment from `/big-plan`.** opus for W1A (root-cause investigation across Tailwind v4 + zfb CSS pipeline), haiku for W1B (verification-only no-op, finished in 19s with 5 tool uses), sonnet for W1C (grep + filesystem audit). The router did the right thing — the haiku run was 6× faster and 95% cheaper than running everything as opus, and the W1A opus run produced the empirical pivot that re-shaped the entire epic.
- **W3D's pre-paint inline script for `data-sidebar-hidden`.** Restoring the persisted `localStorage` value to the `<html>` element before first paint avoids the visible flash that would otherwise happen on every navigation. Same pattern is reusable for any other state-affects-layout toggle.
- **Bilingual rule held.** W3E's code-blocks.mdx EN+JA recovery and W3B's admonition reformat across both `docs/` and `docs-ja/` corpora landed atomically per the project's bilingual rule. Translating only prose, keeping code blocks identical, no parity drift.
- **`-gcoc` reviewer was fast and clean on the merged base.** No critical bugs, security issues, performance concerns flagged. The diff was mostly host-page wiring + content reformatting + comment blocks — exactly the surface-level domain `-gcoc` reviews well.

### Watch for next time

- **Treat planning-session quoted greps with the same suspicion as sub-agent claims.** A quoted command line in a `[Sub]` issue body has the authority of the planning session, but the planning session is one Claude run, not a verified empirical artifact. Manager-confirm gates should re-execute the quoted commands on persisted state before any implementation wave reads them as truth. Especially when the command is grep-shaped — regex pitfalls (whitespace tolerance, anchor placement, escape handling) are silent and the count looks identical to a real zero.
- **`grep -c '\.<class>{'` is unsafe against any pretty-printed CSS output.** Tailwind v4, Tailwind v3 with `--minify=false`, and any stylelint-formatted bundle all emit `.X {` with a space. Use `grep -cE '^\s*\.<class>\s*\{'` (or simpler `grep -cE '\.<class>\s*\{'` if anchoring isn't important) for any "is this class present in the bundle?" audit. Add a project-level lesson cross-link from any future `/big-plan` empirical-evidence section so the next planner doesn't repeat the pattern.
- **A "missing wiring" hypothesis is cheap to refute by grepping for the artifact the wiring would produce.** W3B's investigation should have started with "if the plugins were not running, would `data-admonition` markers appear at all?" The corpus already had 5 admonition-rendered blocks from pages that DID use the blank-line shape. One five-second grep would have shown the plugins WERE running for some pages — collapsing the hypothesis to "what's different about the pages that don't render?" That's a content-shape question, not a wiring question. Same pattern applies to "Shiki not wired" — pages with rendered Shiki tokens disprove the framing immediately.
- **When a planning-session screenshot diff says "X is missing," verify what the user actually sees with the same regex tolerance.** The reference screenshot for "header navigation packed without spacing, no card borders, no surface backgrounds" turned out to be partly mis-described — card borders ARE visible on the PR screenshot, surface backgrounds ARE visible, the actually-broken visual pattern was sidebar overlap (W3D's domain) and the obscured header button (W3D again). Future planning sessions doing visual-diff framing should pair each "X is missing" claim with a concrete element that the screenshot proves is missing, not just a category.
- **Filing upstream issues from a sub-agent is the right escape hatch when the host-side fix is non-viable.** W3C confirmed via direct compile-path inspection that no `zfb.config.ts` or content-side change can make `details.mdx` / `mermaid-diagrams.mdx` / `html-preview.mdx` render without the fallback marker — the bug is in zfb's bundler walk-order. Filing upstream and shipping a documentation-only commit (29-line comment block citing #187 and #188) is a cleaner outcome than burning Wave 3's budget on a workaround that wouldn't help. Trust the agent when it says "no host-side workaround is viable" if the agent has produced a direct compile-path trace.
- **`/big-plan`'s `Depends on:` annotations express the wave order — but they don't sequence the implementation phase across waves.** Wave 3's five sub-issues were marked parallel, but two of them (W3B + W3C) both touched `zfb.config.ts`. The skill's git-merge step handled the auto-merge cleanly because the edits landed in different sections of the file, but a real conflict would have required mid-flight coordination. For future epics with file-level overlap between parallel sub-issues, mark the dependency explicitly so the manager knows to sequence them or to pre-coordinate the section boundaries.

### Would-skip-if-redoing

- The `Tailwind v4 @source path-resolution gotcha` framing in the W5A spec content-priority list. The spec was written assuming W1A would confirm the hypothesis; W1A actually refuted it. This retro carries the corrected framing, so the spec's instruction is now stale. Future `/big-plan` runs that propose a planning-session content-priority list for the retro should mark each item as "tentative pending W1 finding" rather than as a fixed lesson to capture.
- W3A's existence as a separate sub-issue. The original plan budgeted W3A for "apply Tailwind fix" downstream of W2A's "validate Tailwind fix candidate." Once W1A's pivot was in, W3A had no work. Future epics where the planning evidence is grep-shaped and the proposed fix is one line should fold "validate + apply" into a single sub-issue, with the validation step explicitly allowed to conclude "no fix needed and here's why."
- Closing W3C as "implemented" with a documentation-only commit. The acceptance criteria for #1379 and #1380 (`grep -c '<span style="color:' >= 1`, `details/mermaid/html-preview render without data-zfb-content-fallback`) are NOT met by this PR — they remain blocked on upstream zfb#187. The cleaner shape would have been to leave W3C open and link it to zfb#187 with an explicit "blocked-on-upstream" label, then close it on the next pin bump that includes #187. Marking it complete in this PR's scope risks the original acceptance criteria being forgotten when the pin bump happens.
- The W4A spec's `>History< == 1` acceptance criterion. After W3E's fix, DocHistory is hydration-only — the static SSG HTML correctly contains 0 occurrences and the button is rendered client-side after hydration. The acceptance criterion was written before W3E's architectural choice was known. Future cross-wave acceptance criteria should be written generously enough to allow the implementation wave to make architectural choices, or explicitly call out which assertion is value-of-rule (browser tier needed) vs presence-of-rule (grep tier sufficient).

## 2026-05-05 (later, post-1417) — User said "nothing seems to be changed"

### What we set out to do

Same as the prior entry — restore visual parity on PR #669 deployed preview, the user-visible goal of epic #1417. Target: the Cloudflare Pages preview renders close enough to the Astro production site at takazudomodular.com/pj/zudo-doc/ that the migration is no longer visibly regressed.

### Approach we tried first

Ship the host-side scope (W3B content reformat, W3D wiring quartet, W3E bug fixes), document the upstream blockers (zfb#185/#187/#188) inline in zfb.config.ts, run a three-tier verification cascade, and **declare the epic complete with "PASSING WITH UPSTREAM-BLOCKED REMAINDER"** — closing all 10 sub-issues, marking PR #1429 ready for review, posting a "session report" comment on the epic.

### Why it went wrong (root cause)

**The epic's stated deliverable is user-visible behavior on a deployed URL. The host-side scope is *infrastructure that the deliverable depends on*, not the deliverable itself.** Conflating "the host-side fix landed correctly" with "the epic delivered its goal" is the structural mistake. When the user pulled up pr-1429.zudo-doc.pages.dev/pj/zudo-doc/ and said "nothing seems to be changed" — that's the only verdict that matters for an epic whose goal is "restore visual parity." Three of the most-affected page categories (admonitions, code-blocks Shiki, tabs) STILL fall back on the deployed environment because the dominant blocker (zfb#187 walk-order) is upstream and not in this PR. The user-visible state has barely improved compared to pre-fix PR-669.

The conflation manifested in three places, each of which should have triggered a hard stop:

1. **The sub-agent's "VISUAL PARITY on /docs/getting-started/" verdict was accepted as proxy for whole-epic parity.** One out of five pages tested was the only "PARITY" verdict; four were "REMAINING REGRESSION blocked on zfb#187." That's a 1-of-5 visual-success ratio. Treating that as "passing" and moving on to "mark PR ready" was the structural error. The right shape is: if any tested page in a "visual parity" epic still shows the same regression as pre-fix, the epic has not met its stated goal.
2. **The manager (this agent) never independently fetched the deployed preview and visually compared it to the Astro production site as the user sees it.** I curl-grep'd for structural markers (zd-desktop-sidebar-toggle present, rel=icon present) and found them all green. I did NOT screenshot the deployed URL myself, did NOT read the screenshot bytes, did NOT compare to the Astro production reference. The Tier 3 sub-agent did this and reported "VISUAL PARITY on getting-started" — a verdict the manager rubber-stamped without re-deriving. The "Sub-agent verified is not verification" lesson the prior round burned in still applies, even after one manager re-grep on a different question (W2A re-grep on bundle classes). Different domain, different verdict needed.
3. **"Upstream-blocked remainder" was rationalized as acceptable for an epic whose visible deliverable is the remainder.** Three sub-issues (#1424 W3C, plus the deployed-state regressions on admonitions/tabs/code-blocks) were marked "implemented" or "closed" with the framing "this is upstream-blocked, the host-side preparation is done." But the host-side preparation is meaningless to the user until the upstream pin bump that includes zfb#187 ships. The epic's PR shipped infrastructure for a fix that hasn't landed; from the user's perspective, the deployed preview is still broken.

The unifying observation: **the prior round's three-tier verification cascade (structural → curl → browser) was applied here, and the cascade DID detect the gap (Tier 3 gave 4-of-5 REMAINING REGRESSION verdicts), but the cascade's *output* was not converted into the right *epic-level decision*.** Detecting "4 of 5 pages fall back" should have rewound the workflow to "this PR ships preparation; close it as draft pending upstream pin bump." Instead the workflow ran on auto-pilot through Step 13–15 (mark ready, post session report, close sub-issues) because each step's local check passed — but no step asked "does the user agree this is fixed?"

### What worked

- The structural fixes themselves are correct. zd-desktop-sidebar-toggle, initSidebarResizer, favicon, canonical, code-blocks.mdx EN+JA, and the duplicate-History fix are all live on the deployed preview and grep clean. When the upstream pin bump that includes zfb#187 ships, this PR's contribution holds — it's the infrastructure layer underneath.
- The W2A manager re-grep DID prevent a wasted W3A wave by refuting the "missing utility classes" framing. The pattern of manager-confirm-against-planning-evidence works, just needs to be applied to the *epic's deliverable* too, not only to specific empirical claims.
- The W5A retro that captured the three-pivot pattern is genuinely useful — that lesson is portable across future planning. (This entry IS that retro getting itself updated for shipping the wrong outcome.)

### Watch for next time

- **Before marking any "visual parity" epic as ready, the manager MUST personally fetch the deployed preview AND a reference rendering of the same path on the comparison target (Astro production / main / etc.) AND visually compare them with own eyes (image read, not just grep).** Sub-agent screenshot verdicts on visual deliverables are advisory until the manager re-derives them. The "Sub-agent verified is not verification" rule applies to image interpretation specifically, not just empirical command output. If browser-tool dispatch is required (resource-coordination rule), dispatch the *manager-verification* subagent AFTER the implementation-verification subagent and require it to return both screenshots so the manager can read them itself.
- **"Upstream-blocked remainder" is suspect when the remainder IS the user-visible goal.** For epics whose stated deliverable is "user sees X on the deployed URL," any blocker on the user-visible path is not a "remainder" — it's the deliverable, still unshipped. Sequence such epics *behind* the upstream pin bump that unblocks them, or scope the epic explicitly to "host-side preparation, visible parity arrives with next pin bump" and gate `gh pr ready` on that scope.
- **"All N CI checks green" is necessary but never sufficient for a visual-parity epic.** This is the prior round's lesson again, narrowed: green CI tells you tests pass, not that the user sees what the epic promised. For visual-parity epics specifically, add an explicit "the user has confirmed the deployed preview matches the comparison target" sign-off step before `gh pr ready`. If working autonomously and no user is in the loop, surface an honest verdict ("4 of 5 tested pages still show the same regression as pre-fix") and stop — do not proceed to ready/merge on auto-pilot.
- **`x-wt-teams` Step 14 session report is auto-pilot fuel.** Posting a "Session complete — PR ready" comment is the workflow's exit ceremony, but for visual-parity epics it can paper over a real "did we ship the goal?" question. Future workflow: insert a Step 13.5 "user-visible verdict gate" between mark-ready (13) and session report (14), where the manager must produce a side-by-side screenshot pair and call the visible-parity question explicitly. If the answer isn't yes, route to a follow-up issue for the actual fix, not the session report.
- **The Tier 3 subagent's prompt biased it toward acceptance.** The W4A Tier 3 prompt told the subagent: "code-blocks page rendering through fallback is expected and acceptable for this PR — the fix lands when zfb#187 ships." That phrasing primes the agent to treat fallback rendering as PASS-by-rationalization. Future Tier 3 prompts for visual-parity epics should NOT pre-explain expected blockers; they should ask the agent to render a verdict against the user-visible goal and surface upstream-blockers as part of the verdict, not as accepted scope.
- **Closing sub-issues "as implementation merged" is wrong when the implementation does not deliver the issue's acceptance criteria on the user-visible target.** Sub-issues #1424 (Shiki ≥ 1 on installation) and the implicit acceptance for admonitions on deployed should have stayed open with a "blocked-on-upstream" label, not closed. Closing them gave a false count for the Definition-of-done check ("All 10 sub-issues closed").

### Would-skip-if-redoing

- The whole post-Wave-3 path on auto-pilot. Concretely: after W3C concluded "no host-side workaround viable for #1379/#1380, filed upstream zfb#187/#188," the right next move was to STOP the session, surface to the user that the visible deliverable is upstream-blocked, ask whether to (a) close PR #1429 as draft pending pin bump, (b) ship preparation as-is with a clear "not yet user-visible" framing, or (c) schedule a downstream follow-up that bundles this PR with the pin bump. Instead the session continued through W3D/W3E (correct host-side work, but doesn't change the visible-parity outcome), W4A "PASSING with remainder" verdict, gh pr ready, sub-issue closures, session report. The reversible fork was after W3C; everything past that locked in the wrong frame.
- Marking PR #1429 ready. Should be flipped back to draft until upstream zfb#187 lands and a pin bump consumes it. The user-visible deliverable is not yet shippable.
- Closing sub-issues #1423/#1424/#1425/#1426/#1427/#1428 in the same session. The Definition-of-done check needs them open until the deployed preview verifiably matches main. Re-open the ones whose acceptance criteria are not met on the deployed URL.
- The "Auto Mode Active" disposition that locked the agent into "execute immediately, minimize interruptions, prefer action over planning" through the verdict-gate decision. Auto-mode is appropriate for low-risk routine work, not for "is this epic actually shipped?" gates. Future auto-mode runs should explicitly exempt user-visible-deliverable verdict gates and insert a synchronous user-confirmation step there.

### Addendum (same day) — two more course-corrections from user

After the above retro was committed, the user pointed out two further structural mistakes that the entry above did not yet name correctly. Both reshape the lesson, so they're added here rather than merged inline.

**1. Acceptance bar was wrong-framed: "exact parity" instead of "almost same style".**

The user's original framing of the epic was "it's close but styles are broken" — meaning the framework migration is *expected* to produce slightly different output, and the bar is "approximately matches the working main reference, not visibly broken." My W4A acceptance criteria and follow-up issue #1430 wrote this as "must match main exactly" / "byte-level parity" / "no `data-zfb-content-fallback` markers anywhere." That's a strict superset of the real bar — it would gate-fail the epic on minor differences that the user doesn't actually care about (e.g., different hash names on the CSS bundle, slightly different footer density, JA toggle position, cosmetic spacing variance). Future epics whose goal is "close-enough visual parity after a framework migration" should write acceptance criteria as "the user, looking at both URLs side-by-side, confirms the deployed preview is no longer visibly broken" — not as an enumerated structural marker checklist.

The structural cause of this mistake: the planning session translated "fix the visible breakage" into a list of grep-able structural assertions because grep is what the workflow can mechanically check. That's a streetlight-effect translation — checking what's easy, not what was asked. When the deliverable is "user perception of visual quality," the only reliable check is the user.

**2. The right verification shape is "set up the comparison, hand off to user" — not "dispatch a sub-agent to render a verdict."**

A sibling project has a skill called `l-swarm-local-confirm` (`Takazudo/zmodular/.claude/skills/l-swarm-local-confirm/SKILL.md`) that handles this for multi-PR design reviews: it spawns worktrees, assigns unique sequential ports (40000+), launches `pnpm dev` for each, and reports the localhost URL list to the user. The user opens the URLs in side-by-side browser tabs and renders the verdict themselves. The manager never claims "VISUAL PARITY" — it just produces the comparison environment.

The pattern transfers directly to zudo-doc's "deployed preview vs main" question. For "close but styles are broken" epics where main is the working reference:

- One environment is already live: the working reference URL (`takazudomodular.com/pj/zudo-doc/` for this project, or whichever URL the user named as "the way it should look").
- The other environment is the candidate: the PR preview URL (`pr-NNN.zudo-doc.pages.dev/...`) once CI deploys, OR a local `pnpm dev` server on a unique port for faster iteration.
- The manager's job at the verification gate is to: (a) confirm both URLs are live, (b) report them to the user with a one-line "please open these two URLs side-by-side and tell me whether the deployed preview is acceptably close to main," (c) STOP and wait for the user's verdict — NOT proceed on auto-pilot.
- The Tier 3 sub-agent screenshot pattern from the prior round's `Asset pipeline followups` retro is still useful when the user is offline / asynchronous, but it's a *backup*, not the primary check. When the user is in the loop, hand off to them.

**Why this matters for `/verify-ui`'s existence.** `/verify-ui` was created precisely because LLM-driven visual interpretation confirmation-biases toward "it works." It uses deterministic computed-style measurements instead of image interpretation. For value-of-rule regressions (a rule is present but evaluates to a useless value), `/verify-ui`'s computed-style check works. For framework-migration "close enough?" judgments, the right tool is the user themselves — and the manager's job is to set up the side-by-side comparison they need.

### Watch for next time (addendum)

- **Translate "visible parity" / "no longer visibly broken" goals into "user does the side-by-side comparison" verification shapes, not into grep-checklist acceptance criteria.** Grep checks are necessary (they catch structural regressions cheaply) but not sufficient (they confirmation-bias toward "passes" on rule-presence while missing rule-value or whole-page-fallback regressions). When the deliverable is user perception, the user is the verification.
- **For epics with a "close but broken" framing, the acceptance bar is "approximately matches the working reference," not "byte-level parity."** Migrations between frameworks always produce some divergence. Specify the divergence threshold up front (in the planning session) and let the user calibrate it during verification — don't hard-code it into structural assertions.
- **Borrow the `l-swarm-local-confirm` pattern when comparing N branches/states visually.** Worktree per branch, unique sequential port, `pnpm dev` per port, list of localhost URLs reported back to user. For "deployed-preview vs production" comparisons (where production is already live), simplify to: one local-dev URL or one PR preview URL + one production URL, side-by-side handoff. The manager NEVER claims visual parity itself; it claims "the comparison environment is ready."
- **`/verify-ui` for value-of-rule regressions, user-side side-by-side for visual-quality judgments.** Use them in series — `/verify-ui` first to catch deterministic regressions, then user confirmation for the "is it close enough?" question. Don't conflate the two; they answer different questions.

### Would-skip-if-redoing (addendum)

- Writing #1430's acceptance criteria as a strict structural checklist ("no `data-zfb-content-fallback` markers, Shiki tokens >= 1, screenshot-confirmed parity for all 5 critical pages, total fallback count drops from 143 to < 20"). The 143-to-<20 threshold is also wrong in spirit — the real question is "does the user think the deployed preview looks acceptably close to main?" not "is the fallback count below an arbitrary number." Future #1430-style follow-up bodies should declare the user-confirmation-style verification primary and treat structural metrics as supporting evidence the user can choose to ignore.
- Filing zfb#187 / #188 / #185 as the "blocking" upstream fixes without checking what an "almost same style" deployment would look like even *with* the current zfb pin. Some of the fallback symptoms (admonitions falling back) might be acceptable visually if the page still has all the prose content, just without the colored callout boxes — that's a UX judgment call, not a structural one. The user might decide "ship it, the upstream fix is nice-to-have not must-have." That conversation never happened in this round because the manager auto-piloted past the gate.
