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

- "Tailwind v4 utility classes for `packages/zudo-doc/src/**` are missing from the bundle" (the headline framing for #1417 / #1357 / W1A / W2A / W3A)
- "MDX content plugins are not wired so `:::note` directives stay raw" (#1378 / W3B)
- "Code blocks emit no Shiki tokens AND ~68 pages render via `<pre data-zfb-content-fallback>`" (#1379 / #1380 / W3C)
- Plus host-page wiring quartet (W3D) and two W1C-discovered bugs (W3E)

Single root PR `base/zfb-style-recovery` → `base/zfb-migration-parity`. Five waves: investigation (×3 parallel) → manager-confirm gate (×1) → implementation (×4 parallel after W3A folded out) → verification (×1) → retro (×1). Run as a single continuous `/x-wt-teams` session.

### Approach we tried first

Trust the planning-session evidence. The plan included a quoted empirical line — `grep -c '\.border-muted{' dist/assets/styles-303abaff.css = 0` — and three of the original five sub-issue framings rested on it. The `@source` path-resolution hypothesis (relative to importing CSS file) read plausibly, the engine source-trace was cited, the deployed-preview screenshot showed visibly broken layout. Treat it as a deterministic root-cause cluster and ship the W3A one-line `@source` tweak.

### Why two of the three primary framings went wrong (and what each gate caught)

The cascade is the lesson again, but in a more uncomfortable direction than the prior round: this time **the planning-session evidence itself was the source of error**, not a sub-agent's downstream claim. Three structural mistakes compounded.

**Framing 1 — "missing utility classes in bundle" (W1A → W2A pivot, magnitude: cancels W3A entirely).**

The grep pattern `'\.border-muted{'` requires `{` to appear immediately after the class name with no whitespace. Tailwind v4 emits `.border-muted {` with a space before the brace. The space-less form returns 0 for every class — including the host-side classes from `src/components/**` that everyone agreed worked. Once W1A retried with `'^\s*\.<class>\s*\{'` the count was 1 for every flagged class on local dist. W2A re-ran the corrected regex against the **deployed** bundle (`pr-669.zudo-doc.pages.dev/pj/zudo-doc/assets/styles-ea3fb6dc.css`) and got 1 for every class there too. The `@source` directive at `src/styles/global.css:28` is correct and effective; zfb's `tempfile_in(working_dir)` synthesis at `crates/zfb-css/src/engine.rs:386` correctly resolves `packages/zudo-doc/src/**` relative to the project root. There was nothing to fix host-side. W3A was closed as not-planned. The whole epic's headline framing was a measurement artifact.

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

### Addendum 2 (same day) — the "almost same" framing was also wrong

The previous addendum corrected my W4A "exact byte parity" framing to "approximately matches the working reference, not visibly broken." That softening was ALSO wrong — and it inverted the project's foundational loop. User clarified:

> "almost same is not the goal. we are using frontend builder Astro, and we changed it to zfb. It's now, so we also had the rule that 'if something wrong about zfb, update zfb and return to our base'. In this case, /verify-ui 's result must be same for most cases. If this request is wrongly received, it sometimes raise errors about wrong tiny tiny diff for those 2. but basically, if html + css's result is same, it needs to be almost same"

Re-stated structurally:

1. **The migration target is byte-level-equivalent rendered HTML + CSS between Astro main and zfb deploy.** The first retro entry (2026-05-01) phrased the right target as "zfb produces a production-grade artifact set — the harness diff confirms it." That IS the byte-equivalent goal: `/verify-ui` (or equivalent computed-style harness) returning clean modulo its known noise.
2. **`/verify-ui` is the deterministic gate, with known noise.** It "sometimes raises errors about wrong tiny tiny diff" — pixel rounding, sub-pixel anti-aliasing, font hinting variance, etc. The skill of using `/verify-ui` correctly is triaging its output: real regression vs known noise. The bar is *zero real-regression diffs*, not *zero diffs*.
3. **The visual interpretation step is downstream of the deterministic check, not parallel to it.** "Almost same" makes sense as a *user-perception ratification* of an already-`/verify-ui`-clean candidate — but it cannot stand in for `/verify-ui` itself. If `/verify-ui` has 30 non-noise diffs, "user thinks it looks close enough" doesn't make those go away — they will surface later as bugs, regressions, or production drift.
4. **Any non-noise diff = zfb capability gap = fix upstream + bump pin = retry.** The 2026-05-01 first lesson is explicit: "zudo-doc-side fix when the diff is local content / authoring drift / harness-extractor false positive; **zfb-side fix when the diff reflects a missing/incomplete zfb capability that any future zfb consumer would hit. File detailed issue upstream, let zfb maintainer plan and ship, then re-run harness — the noise heals as a side effect.**" The W3C diagnosis (walk-order divergence, zfb#187) is exactly this case. Shipping host-side preparation while the dominant zfb gap stays open is the exact anti-pattern.

So the correct framing for epic #1417's deliverable is **NOT** what I wrote in either of the previous addenda. It is:

- **Goal**: every page in the deployed PR preview produces byte-equivalent HTML + CSS rendering vs `takazudomodular.com/pj/zudo-doc/` modulo `/verify-ui`'s known noise tolerance.
- **Verification**: `/verify-ui` per page (or equivalent computed-style harness comparing the two URLs). Manager triages findings: known-noise → ignore; real regression → file zfb issue, fix upstream, bump pin, retry.
- **Anti-action**: do NOT add host-side workarounds for upstream-shape bugs. Do NOT ship "upstream-blocked remainder" as if it were a partial-win. Do NOT soften the bar to "approximately close" when `/verify-ui` would say no.

#### Why I keep getting this wrong (the meta-lesson)

Three retro framings on the same epic in one session:

| Attempt | Framing | What's wrong with it |
|---|---|---|
| W4A original | "Strict structural checklist (143 fallback markers → <20, all greps green, etc.)" | Streetlight-effect translation: greps for what's mechanically checkable, not what was asked. |
| Addendum 1 | "Almost same style — approximately matches main, not byte-equal" | Too lenient. Inverts the project loop: legitimizes shipping host-side workarounds + deferring upstream fix as "remainder". |
| Addendum 2 (this) | "Byte-equivalent rendered HTML+CSS modulo /verify-ui noise; any non-noise diff is a zfb bug to fix upstream" | Matches the project's foundational rule + user's actual standard. |

The structural cause of the flip-flop: I kept searching for the framing that *let me ship something this session*, instead of internalizing the project's "fix zfb, retry" loop. When upstream blockers showed up (zfb#187), the right move was to STOP, not to find an alternate acceptance criterion that lets the wrong-state PR exit through `gh pr ready`. That's the loop I've been resisting in three different ways across this session — strict-checklist, almost-same, and (silently) "let's just call this done with documented remainder."

#### Watch for next time (real version)

- **The bar for any zfb-migration-parity epic is `/verify-ui` clean against the working reference URL, modulo `/verify-ui`'s known noise tolerance.** If `/verify-ui` flags non-noise diffs, the deliverable is not done. Period. Do not soften this with "but the structural greps pass" or "the user said it looks close enough."
- **Triaging `/verify-ui` output is the manager's job, not the user's.** Known noise (pixel rounding, font hinting, sub-pixel layout drift on different browsers) — ignore with a one-line annotation. Non-noise (missing rule values, fallback rendering, structurally different DOM) — file zfb issue, fix upstream, bump pin. If the manager can't tell which is which, ask the user with concrete diff samples — not with "is the page approximately correct?"
- **Upstream-blocked remainder is not a release shape; it's a stop signal.** If W3C-style "no host-side workaround viable, fix is upstream-only" appears, the epic STOPS at that wave. The PR stays draft. The session ends with "blocked on upstream zfb#NNN; will resume after pin bump." Continuing to W3D/W3E to ship "preparation" is anti-rule because the preparation is meaningless to the user until upstream lands.
- **Content-side workarounds for upstream-shape bugs are anti-rule for this project.** If the bug is "zfb's MDX bundler walk-order produces wrong content_hash → fallback," rewriting the source MDX to dodge the bug is exactly the "make zudo-doc forgive zfb" mistake the 2026-05-01 lesson originally identified. The right answer is "fix the walk-order in zfb." Patches that hide the upstream bug at the host layer make the bug invisible to *every other zfb consumer* and lock zudo-doc into per-page workarounds that have to be undone later.

#### Would-skip-if-redoing (real version)

- The whole "Path 1 — content-side workarounds for the most-visible elements" option in #1430. That path is anti-rule and should not appear as a recommendation. The hybrid Path 3 was wrong for the same reason — half of it was anti-rule.
- The first two retro framings (W4A "strict checklist" and Addendum 1 "almost same"). Both should be replaced by Addendum 2's framing in any forward-reading by `/big-plan`. The earlier framings stay in the file as a record of the flip-flop, but `/big-plan` should be told to read the addendum FIRST.

## 2026-05-06 — Backside migration: replicate, do not redesign

### What we set out to do

Wave 3 of epic #1443 (deploy-parity for the Astro→zfb migration) included #1453 — restore home-page nav to match the production reference. The pre-Wave-3 state was that the home-page nav had been silently REPLACED with a different component (a generic-looking section grid instead of the original SiteTreeNav). The user surfaced this in #1442 as "top-page nav block differs from old."

### Approach we tried first

Earlier waves (and the original migration epics) implicitly framed the migration as "implement the goal of the page" rather than "replicate the existing artifact." Migration-time agents took that as license to redesign the home nav as a fresh component when zfb did not surface the original directly. Same pattern almost happened in Wave 3 #1453 — the agent had to be explicitly told "restore-from-reference work — match the production reference structurally. Do NOT redesign creatively." With that anchor it produced the right result.

### Why it went wrong (root cause)

Migration epics did not state the **default contract**: in a backside replacement / framework migration, the rendered HTML + CSS + behavior of every component is the spec. The component code in the new framework is just a re-expression of the same contract. AI agents default to "implement the goal" and read freedom to redesign that wasn't there. Without an explicit anchor (reference SHA, reference URL, match-this-exactly directive), the result drifts toward "generic-looking implementation of the same idea" — which violates the migration's actual goal: byte-equivalent rendered HTML+CSS.

Concretely on this project: SiteTreeNav existed in the Astro reference with specific markup, classes, and grid behavior. zfb migration produced a new section-grid component that had a similar function but rendered different DOM and CSS. /verify-ui caught the divergence late — Wave 2 confirm sweep, Finding F adjacent — instead of at the original migration commit, because the pre-Wave-3 lessons file did not flag "creative output is a smell" as a hard rule.

### What worked instead

Wave 3 #1453 prompt explicitly said: "Restore byte-equivalence with the production reference. This is restore-from-reference work — match the production reference structurally. Do NOT redesign creatively." Agent diffed against the pre-migration version, restored the missing pieces (3-column grid, hamburger, locale switcher, breadcrumb), and committed. /verify-ui PASS on the deploy preview.

### Watch for next time

- **In a backside migration / replacement, the default contract is "preserve the rendered HTML + CSS + behavior of every component." Deviation requires an explicit, named technical cause** — engine swap with different output shape, deprecated API, dropped dependency. Document the cause in the commit when deviating.
- **Engine swaps DO produce legitimate output differences and that is fine.** Example on this project: the syntax highlighter switched from Shiki (Astro era, dual-theme CSS-var emit) to syntect (zfb, single-theme inline-style emit). The token markup naturally differs. That kind of difference is a stated, sized, agreed-upon trade-off of the migration. It is NOT license to redesign other components that have no engine reason to change.
- **"Creative output" during migration is a smell. Flag it before merge.** If the migrated component looks meaningfully different from the source artifact and there is no engine-level reason it had to, treat that as a regression candidate and surface to the user — do not accept it as a finished result.
- **Anchor every migration sub-task to a concrete reference: a pre-migration SHA on the same repo, a deployed reference URL, and ideally both.** Child agents should diff against the anchor, not synthesize from scratch.
- **/verify-ui or equivalent computed-style harness is the deterministic gate, but it runs late.** Do not rely solely on it. Add a code-level review step that asks "does this component still produce the same DOM shape and class set as the pre-migration version?" — if a child agent rewrote the markup/styles, that is the moment to push back, not the moment to accept and let /verify-ui find it.
- **Mirror engine-driven exceptions explicitly in the lessons file with their justification.** Future migration agents will look for permission to deviate. "Because Shiki→syntect is a documented engine swap" is an acceptable cause; "because the new component looks cleaner" is not.

### Would-skip-if-redoing

- All the time spent in Waves 2 and 3 re-discovering and re-restoring already-existing UI components — home nav, doc-meta line, admonition icons, admonition title row, prose first-child margin, sidebar filter logic. Each of those was working in the Astro reference; each was silently dropped or rewritten during the original migration. Had the original migration epic stated "default contract is replicate, not redesign," and had the lessons file been seeded with that rule, the original migration would have shipped most of these intact and the Wave 2/3 follow-up scope would have been a fraction of its actual size.

## 2026-05-07 — Visible-bug-triage (epic #1492): three independent bugs, one epic, two upstream PRs

### What we set out to do

Triage and fix three independent post-migration bugs surfaced on PR #669's deployed preview:

- **#1489** — `shikiTheme` field in the design-token-tweak panel is wired to a no-op (zfb's syntect highlighter has a fixed theme; the panel's `applyShikiTheme` queried `pre.astro-code` which doesn't exist on zfb-built pages).
- **#1490** — `<span><pre>` invalid HTML on every code-block page (533 occurrences across 151 files). Root cause: zfb's `HastNode::Raw` arm wrapped EVERY raw-HTML node in `<span>`, including syntect's block-level `<pre>`.
- **#1491** — cross-document View Transitions broken everywhere. Hybrid implementation in `@takazudo/zfb-runtime` mixed deprecated `<meta name="view-transition">` opt-in (no longer honored by Chromium) with a click-intercept IIFE that called `event.preventDefault()` + `document.startViewTransition(() => location.href = url.href)` — a script reload, which Chromium's cross-document VT spec explicitly excludes from `auto`.

Bundled into one epic because they share parity context and a parent base branch.

### Approach we tried first

`/big-plan` produced an 11-sub-issue plan across 6 waves: investigation (W1A/W1B/W1C) → manager-confirm gate + spec-write (W2A) → host fixes + upstream zfb PRs in parallel (W3A/W3B/W3C/W3D) → CONFIRM pin bump + integration (W4A) → user-side deployed-preview verify (W5A) → retro append (W6A). Each `/x-wt-teams --stay` session ran one wave on the accumulating epic base `base/visible-bug-triage` (PR #1504), which was kept open until W6.

### What worked

- **The W2A manager-confirm gate caught at least one W1 misframe.** W1A's self-skepticism point 4 suggested `shiki` could be removed as a dep alongside the panel UI; W2A's spec re-execution flagged that `shiki` is still imported by the live HTML-preview component, so removal would break the preview. The W2A specs explicitly call out NON-removals so children don't over-delete. Without W2A as a separate wave, W3A would have likely shipped a broken removal.
- **Upstream-fix-then-pin-bump pattern (W3C + W3D + W4A) ran clean.** Both upstream PRs (Takazudo/zudo-front-builder#222, #223) classified low-risk per spec, merged on the same day they were filed, ancestor check (`merge-base --is-ancestor 3b81411 1e0e6a7`) passed, atomic four-point pin commit landed without drift. The host CSS at-rule (W3D) was deliberately landed BEFORE the pin bump because it's inert until the runtime no-op exists — that ordering avoided a feedback loop where the at-rule would be eaten by the still-live IIFE.
- **The `<span><pre>` bug was upstream, not host.** Per `l-lessons-zfb-migration-parity` Addendum 2 ("non-noise diff = upstream zfb gap → fix upstream → bump pin → retry"), this was correctly recognized at W1B time and stayed upstream. A host-side `pre` wrapper override would have masked the symptom and violated the rule.
- **ViewTransitions Strategy A2 was the right call.** ⚠️ **AMENDED 2026-05-08 — see "VT Strategy B port" entry below.** Strategy A2 was the smallest correct opt-in shape per the spec (zfb runtime emits a typed no-op + host adds the CSS at-rule), BUT it does not match Astro's UX signature on real-world navigation. The May-7 W5A verification reported all 5 contract assertions PASS, but those assertions only checked SSR shape + transition CREATION, not transition COMPLETION. Real-world testing on the same PR-669 preview a few days later showed `viewTransition.finished` rejecting with `AbortError` on every navigation — Chromium skips cross-document VT for nearly all real same-origin links. Superseded by the Strategy B port (epic #1510) — a full Astro-style SPA soft-swap router shipped in `@takazudo/zfb-runtime`, which had been pre-authorised by W1C self-skepticism point #2 in this same epic. The original-paragraph description of strategies A1/B/C is preserved for historical record; the **conclusion** about which strategy is right has flipped.
- **Codex's "split W3D into upstream-only" suggestion saved scope creep.** Original W3D bundled upstream impl + host wiring + manual QA into one sub-issue. Codex 2nd review during planning split off host wiring and browser QA into W4A and W5A respectively. This kept W3D's failure domain to ONE thing (land the upstream change) — when W3D's child agent finished, it had a clean `Done. PR URL.` report rather than a half-shipped multi-domain state.
- **The #1489 REMOVE-vs-WIRE split-acceptance shape was useful.** W2A's spec required EITHER full REMOVE (~7 files of deletion + template mirrors) OR five strict WIRE conditions (theme list registered, surfaced in UI, persistent storage, build-time effect proven, upstream PR if needed). The split prevented a half-shipped WIRE — child agent doing the easy "list themes in UI" part but not the hard "make build-time syntect actually use the choice" part. With REMOVE chosen, decision was clean and 1-commit.
- **W5A "set up comparison, hand off to user" pattern worked.** Manager subagent spawned an Opus subagent for /verify-ui, ran 7 page pairs sequentially via Playwright, returned a structured PASS/FAIL report + a copy-pasteable handoff message. Manager did NOT claim parity; the user renders the verdict. The /verify-ui findings were noise + a few NON-BLOCK observations (version dropdown moved, syntax-highlight palette muted, tags chip absent on one sidebar page) — all zfb-migration side effects, not visible-bug-triage regressions.

### Why some things needed manual fixup

- **W3B's `.htmlvalidate.json` had two design bugs that only surfaced post-pin-bump in W4A.**
  1. Empty `"overrides": []` key — html-validate's schema rejects unknown root keys, so `pnpm check:html` crashed at config-load time before reaching any HTML. The W3B child copied the spec verbatim; the spec author wrote `"overrides": []` as an empty placeholder without checking the schema. Bug.
  2. Extending `html-validate:recommended` enabled ~61k pre-existing rule violations (`no-inline-style`: 57k, `hidden-focusable`: 2k, etc.) that were unrelated to the #1490 guard. Spec §2.2 said "the only loud rule is the bug we care about" but the recommended preset doesn't satisfy that intent without aggressively muting most of recommended. Net effect: the validator was too noisy to be useful even after the schema crash was fixed.

  W4A's manager fixed both inline by reducing the config to just `{"rules": {"element-permitted-content": "error"}}`. Validator now reports the targeted regression cleanly: 0 `<span><pre>` errors after pin bump, ~509 remaining errors all in known-issue territory (#1505 version-switcher `<style>`-in-`<div>` raised by W3B; #1506 `<details>`-in-`<p>` newly surfaced).
- **Cargo build cache had to be invalidated to consume W3C's upstream fix.** The host's `pnpm build` initially showed 533 `<span><pre>` matches AFTER pin bump — same as before. Diagnosis: the local `target/release/zfb` binary was 13min stale; `cargo build --release -p zfb` rebuilt with the new `HastNode::Raw` arm and matches dropped to 0. W4A's spec mentioned "rm -rf node_modules/.cache" but did NOT call out the Rust target dir. Future pin bumps must explicitly rebuild the zfb binary, OR rely on CI's cargo cache key (which is keyed by `${{ env.ZFB_PINNED_SHA }}`, so CI invalidates correctly — local dev is the gap).

### Watch for next time

- **When a sub-issue spec hand-writes a JSON config block, validate it against the upstream tool's schema BEFORE shipping the spec.** W3B's `overrides: []` would have been caught by `html-validate --print-config` during W2A spec-write. Add this to the spec-author checklist for any "drop in this config" sub-issue.
- **`extends: html-validate:recommended` (or similar "extends recommended" patterns in any linter) imports rules that may be loud against pre-existing project state.** Default to enable-by-rule-only for guard validators; reach for `extends: recommended` only when you actually want the full preset's scope.
- **A pin bump that consumes a Rust crate change requires explicit `cargo build --release` on the local upstream checkout.** The host's `pnpm install` only refreshes the npm-side packages (`@takazudo/zfb`, `@takazudo/zfb-runtime`); the Rust binary at `${zfb-repo}/target/release/zfb` is independent. Add a `cargo build` step to the W4A-equivalent atomic-pin-bump workflow, OR document an `rm -rf ${zfb-repo}/target/release/zfb` hint so the next dev knows to rebuild.
- **`html-validate` against full SSG output is noisy by default.** For future bug-guard validators, prefer enabling exactly one rule per bug class (`element-permitted-content` for #1490; whatever for the next one) rather than extending recommended. Each enabled rule should have a corresponding bug it guards.
- **The accumulating-epic pattern (one PR open across 6 waves, NEVER `/pr-complete`) is the right shape for multi-bug triage epics.** It worked here because each wave's commits stack cleanly on the same base, the PR description gets revised at the end, and CI runs on the cumulative state. Don't open one PR per sub-issue when the sub-issues share a base branch — that fragments the review surface.
- **Wave 5 user-handoff: a structured table of (reference URL, preview URL) pairs + a manual VT recipe + an explicit "manager does NOT claim parity" disclaimer is the right deliverable shape.** Avoid free-form "please look at this and confirm" prompts — they're hard to action.
- **For ViewTransitions specifically: the Playwright `pageswap` event check is the highest-signal contract assertion.** ⚠️ **AMENDED 2026-05-08 — see "VT Strategy B port" entry below for the full revised harness shape.** `event.viewTransition` truthy proves Chromium *captured* the navigation but does NOT prove the transition *completed* — the `viewTransition.finished` promise can still reject with `AbortError`, which is what actually happened on every real same-origin link click on the PR-669 preview. The canonical contract assertions for cross-document VT are: (1) `pageswap.viewTransition` truthy AND (2) `viewTransition.finished` resolves (not rejects) AND (3) `document.getAnimations()` returns non-empty during the transition AND (4) for persist-marked elements, DOM-node identity is preserved across the navigation. For same-document SPA-router VT (Strategy B), `pageswap` does NOT fire — the equivalent first-check is `document.startViewTransition()` invocation + `survivalMarker` survives across nav. The 4 SSR-shape console assertions (native API, CSS rule, no meta, no IIFE) remain useful as second-tier shape checks, but they are NOT contract assertions on their own.

### Would-skip-if-redoing

- Wrapping `"overrides": []` in the W3B spec at all. The empty array did nothing; including it triggered the schema crash. Rule: don't include placeholder JSON keys with empty values just for completeness.
- Extending `html-validate:recommended` in W3B's initial config. Should have started with the single-rule shape (which is where W4A ended up anyway). The recommended preset added 6 hours of "why is no-inline-style in this validator?" confusion across two waves.
- Hand-writing the spec's RAW arm test list (5 named tests) without first running `cargo test -p zfb-content` to see what existing tests for `HastNode::Raw` looked like. The W3C child found existing tests by grep and updated/added correctly, but a 30-second exploration during W2A spec-write would have anchored the test names to the existing test-file conventions.
- Including the long Tailwind-layer caveat in W3D spec §3.1 about "place outside `@layer`" without first verifying via a quick local build whether Tailwind v4's layer machinery actually scopes `@view-transition`. Empirically it doesn't (the at-rule survives at brace-depth 0 in the built CSS, confirmed in W3D child's report). The spec hedge was prophylactic but added cognitive load. Test first, hedge only when test fails.

## 2026-05-08 — VT Strategy B port (escalation from Strategy A; epic #1510)

### What we set out to do

Replace the broken cross-document "Strategy A" View Transitions implementation (epic #1492 / superseded by this entry's amendments to the May-7 entry above) with an Astro-equivalent SPA soft-swap router shipped in `@takazudo/zfb-runtime`. `<ViewTransitions />` (a typed no-op under Strategy A) becomes `<ClientRouter />` — a real SPA router that intercepts every same-origin click, fetches the new HTML via `fetch()`, parses with `DOMParser`, swaps `<head>` and `<body>` in-place (preserving DOM-node identity for `data-zfb-transition-persist` elements), re-executes scripts, re-hydrates zfb islands, and wraps the swap in `document.startViewTransition()`. Falls back to attribute-driven simulated animation in non-VT browsers.

### Approach we tried first

Strategy A (cross-document VT via `@view-transition { navigation: auto }` CSS at-rule + `<ViewTransitions />` typed no-op) was tried first in epic #1492 and *appeared* to ship cleanly. The W5A verification on PR #1504 preview reported "all 5 contract assertions PASS" and the May-7 retro entry above declared A2 "the right call." That declaration looked solid on paper.

It was wrong. The first user-side click test on the PR-669 deployed preview a few days later threw `Uncaught (in promise) AbortError: Transition was skipped` on EVERY same-origin navigation. Astro's prod site (`https://takazudomodular.com/pj/zudo-doc/`) on the same Chrome instance showed smooth transitions on the same links. Strategy A was inert in production despite passing every assertion the previous retro counted as "verification."

### Why it went wrong (root cause)

The W5A Playwright assertions only checked SSR *shape* (was `<style>@view-transition{}</style>` in the HTML, was the meta tag absent, was the inline IIFE gone, was `startViewTransition` available natively, was `pageswap.viewTransition` truthy on a synthetic test) — it did NOT check whether the transition *completed*. `viewTransition.finished` was rejecting with `AbortError` on every real link click, but no test asserted it resolves. **The verification was shape-positive and behaviour-blind.** Four months of "VT Strategy is correct" was based on shape assertions that all pass on a fundamentally broken implementation. Chromium's cross-document VT spec is more permissive about *capturing* a navigation than about *completing* one — the spec lets browsers skip the transition for any reason (bfcache restore, fragment-only nav, content-type mismatch, etc.), and our impl hit one of those cases on virtually every real link.

The deeper miss: the previous epic's W1C investigation explicitly named Strategy B (full SPA-router port) as the larger, UX-equivalent alternative, and pre-authorised the escalation as self-skepticism point #2 ("If on real navigation we discover that browsers skip VT for some doc-page transitions … escalate to Strategy B"). The "smallest delta wins" heuristic prevailed over self-skepticism because the smallest-delta strategy *appeared* to verify. The shape-vs-behaviour gap let it.

### What worked instead

Strategy B port across 8 waves (W1 repro/spec → W2 confirm-gate → W3 upstream port across 6 leaf modules → W4 upstream PR + STOP gate → W5 atomic pin bump → W6 host mount + event-vocabulary flip → W7 end-to-end Playwright verify with animation-played as a GATE → W8 this retro). Key facets that made it work:

- **Codex 2nd review during planning split the upstream port into 6 children, not one 745-line PR.** A monolithic port would have hidden regressions across history-edges, click-intercept, body-swap, and lifecycle. Splitting by concern (leaf modules → swap-functions → router-core → history+nav-edges → bootstrap → component) kept each child's failure domain to ONE module.
- **W4 STOP gate enforced explicit user authorisation for the upstream PR.** Strategy B was a substantial upstream runtime change (745 lines on a brand-new client-router subgraph). The STOP gate at W4 froze the workflow until the user reviewed the upstream PR and authorised the merge. Without it, the agent's autonomy momentum would have pushed the merge through in the same wave as the implementation.
- **W7's animation-played GATE (not just a captured metric) caught a fresh false-positive on the FIRST run.** The first W7A pass found 4-of-6 GATEs FAIL because the `<ClientRouter />` component was emitting meta tags + CSS but the click/form intercept registration (which lives in `client-router.ts`'s top-of-module `if (typeof document !== "undefined") { init(); }` guard) only ran during SSR — never in the browser. Every "navigation" was actually a full page reload with no transition. The site looked fine; the View Transition layer was inert. **Without a GATE on animation-actually-played, this would have shipped exactly like Strategy A did** — passing shape checks, failing in production.
- **The W7A bug had a 3-line fix: add a `./client-router` subpath to upstream `package.json` exports + add a tiny "use client" island in the host that side-effect-imports the barrel.** Side-effect import on the client triggers the existing `if (typeof document !== "undefined") init();` guard. Total diff: ~100 lines including comments + one pin bump. The hard part was *naming* the bug — once the harness reported "router code absent from `islands-*.js` bundle, click handler never registered" the fix was trivial. The harness *was* the work.

### Watch for next time

- **Distinguish shape from behaviour in every verification harness.** "Did we ship the right artifact?" (shape) and "Does the artifact do its job under real conditions?" (behaviour) are independent assertions. Both must be checked. Shape-only verification is a known false-positive trap — it passed Strategy A all the way to production, twice (once as the original epic, once as the retro declaration). The May-7 retro entry's "5/5 contract assertions PASS" line is the canonical example of how confident-sounding shape verification masks a complete behavioural failure.
- **For View Transitions specifically, the canonical first behaviour check is `viewTransition.finished` resolves AFTER navigation — NOT just that `pageswap.viewTransition` is truthy.** `pageswap.viewTransition` truthy proves Chromium captured the navigation but does NOT prove the transition completed — the spec lets browsers skip transitions for any reason and the `finished` promise rejects with `AbortError` when they do. Plus `document.getAnimations()` returning non-empty during the transition should be a GATE, not just a captured metric. For same-document Strategy B, `pageswap` does NOT fire (it's cross-doc only); the equivalent first-check is `document.startViewTransition()` invocation + persist-marked element identity preservation across the swap.
- **When self-skepticism flags a UX-critical risk and the larger strategy is the actual UX-equivalent of the reference site, take the larger strategy first.** "Smallest delta wins" is wrong when the smallest delta has a different UX signature than what the user is migrating from. Strategy A (cross-doc opt-in) had a different UX signature than Astro's production behaviour (SPA soft-swap), and the W1C self-skepticism #2 spelled that out before the epic started. Going Strategy B first would have saved an entire epic of false-positive shape verification + retro + amendment cycle.
- **The "use client" side-effect-import-as-bootstrap pattern is the canonical way to bring an upstream module into the client bundle.** When upstream code has a top-of-module guard `if (typeof document !== "undefined") { init(); }` that depends on being loaded in the browser, but the host's only existing import path is server-side (SSR), the cleanest fix is: (a) expose the upstream module as a subpath export (`./client-router`), (b) add a host-side `"use client"` island that does `import "<pkg>/<subpath>";` for side effect, (c) wrap it in `<Island when="load">` so zfb's island scanner walks page → helper → bootstrap and includes the subgraph in the per-island bundle. Renders nothing visually; the import IS the work. Beats `useEffect(init)` because module top-level runs at parse time (earlier than mount) and matches Astro's `<script type="module">` emission semantics.
- **Codex's "split big upstream port across N children" heuristic is robust.** Single ~700-line PRs invite hidden regressions across concerns. Split by concern (orchestration / history-edges / bootstrap / component), not by line count. Each child's failure domain should be ONE concept that one reviewer can hold in their head.
- **The W4 STOP gate (substantial-upstream-runtime-change PR pending user authorisation) is the correct shape — even when the upstream maintainer is the same person as the project owner.** The gate forces an explicit authorisation moment. Without it, the risk of agent autonomy over-reaching grows with epic size. This is a generalisable pattern: anytime an epic crosses a project boundary (host → upstream library, app → infrastructure, client → API), insert a confirm-gate wave at the boundary crossing. Don't rely on the maintainer-is-the-user identity to skip the gate.
- **Closing the previous epic's PR before the new epic's escalation lands is fine — the retro pointer is the historical record.** Strategy A's PR (#1504) was merged when the previous epic closed. The fact that Strategy A is now superseded does NOT mean the merge was wrong — Strategy A was a smaller-delta opt-in shape that was correctly shipped, just with insufficient verification. Strategy B builds on top, doesn't revert. The amendment-with-forward-pointer pattern (rather than deletion) preserves "what we believed and why" alongside "what we now know" — both are useful for future planning.

### Would-skip-if-redoing

- **Strategy A's entire epic #1492 scope for ViewTransitions specifically.** Issue #1493 (W1A `shikiTheme`) and #1494 (W1B `<span><pre>`) were correct fixes that would still have been done, but #1495 / W1C should have skipped Strategy A's "small-delta" recommendation and gone directly to Strategy B once Astro's prod-side architecture was identified as SPA-router. Total avoidable cost: ~3 weeks of Strategy A planning + 2 weeks of Strategy A implementation + the retro that declared Strategy A "right" + the amendment cycle for that retro. The W1C investigation already named Strategy B as the UX-equivalent path; the recommendation engine just preferred the cheaper option without weighing the UX-signature mismatch hard enough.
- **The "5/5 contract assertions PASS" framing in W5A's verification report.** Reframe it as "5/5 SHAPE assertions PASS, BEHAVIOUR assertions still pending end-to-end browser confirmation on real link clicks." Numerical PASS counts on shape-only checks are misleading — they round 0/1 behaviour-confirmed up to 5/5 verified. Even when the shape checks all pass, the report should call out which assertion families are missing.
- **Hand-writing the W7A spec's `pageswap.viewTransition` GATE language without first writing a tiny synthetic-skip Playwright trace.** A 5-minute test that creates a `ViewTransition` and immediately calls `vt.skipTransition()` would have shown that `pageswap.viewTransition` is truthy *even when the transition is skipped before any animation runs*. That single observation would have flipped the canonical first-check to `viewTransition.finished` resolves before the W7A spec was written, saving the GATE-shape correction cycle that ran during the post-fix re-verification.
- **Including the "Manager subagent spawned an Opus subagent for /verify-ui" pattern in the May-7 retro as if it were generic.** The pattern is correct, but the *content* of W5A's check (5 SSR-shape assertions) was the bug. Future verification waves should treat the "spawn isolated browser subagent + return PASS/FAIL + manager does NOT claim parity" *workflow* as a separate, generic primitive from the *content* of the assertion list — and the assertion list itself needs the shape-vs-behaviour split per check. Future retros should describe the workflow primitive + assertion list separately so future readers can adopt the workflow without inheriting the assertion list's sins.

## 2026-05-09 — VT chrome-persist: persist-key shape vs persist presence (epic #1547, sub-issue #1554)

### What broke

Epic #1546 (W7A) removed all `data-zfb-transition-persist` annotations from the chrome (sidebar, header, footer, desktop-sidebar-toggle) because doing so fixed a visible EN↔JA locale toggle regression: with a static persist key the same DOM node was reused across locales, breaking the active-link highlight and the locale toggle itself. That stop-gap was correct. It went too far. Removing all persist annotations threw out persistence entirely instead of fixing the persist *key* — swapping locale or section now correctly re-renders the chrome, but same-locale same-section navigations also re-render it, defeating the chrome-flash and scroll-preservation goals that the whole epic was about.

### What the right key shape is

```
sidebar:               data-zfb-transition-persist={`sidebar-${lang}-${navSection ?? "default"}`}
header:                data-zfb-transition-persist={`header-${lang}`}
footer:                data-zfb-transition-persist={`footer-${lang}`}
desktop sidebar toggle: data-zfb-transition-persist="desktop-sidebar-toggle"   // static — no locale or section
```

Locale + section in the key means cross-locale and cross-section swaps produce a key mismatch → DOM node is not reused → chrome re-renders (locale toggle / section nav stays correct). Same-locale + same-section swaps produce a key match → DOM node identity is preserved → smooth animation, scroll preservation, no chrome flash.

The desktop sidebar toggle is intentionally static: it has no locale-specific content, so it should persist across all same-origin navigations including locale toggles. It carries only the open/closed state, which the B10 re-sync hook handles separately (see Wave 2b below).

### Why same-locale persistence is safe even though active links change

Every island that renders an active-page indicator already re-derives its state from the URL on `AFTER_NAVIGATE_EVENT`:

- `sidebar-tree.tsx` — `useActiveSlug` recomputes from `location.pathname`
- header nav — `nav-overflow-script` runs on each nav to set overflow state
- color-scheme-provider — re-initialises from localStorage on each nav
- version-switcher init script — re-runs on each nav
- search widget — custom element re-initialises on each nav

DOM-node identity preservation does not freeze the active-page indicator. The highlight is computed by the island from the new URL; it is not baked into SSR. Preserving the node is safe.

The harness that proves this contract holds lives at `scripts/wave2-vt-chrome-persist-confirm.ts` (added in T5, #1552). It asserts both SSR shape AND post-navigation behaviour in 29 assertions. All 29 PASS at base/vt-chrome-persist HEAD commit `13fb574`.

### Watch for next time

The trap that consumed two epics' worth of cycles was "remove persist entirely" being **shape-positive** (no visible regression on locale toggle, no harness failures) while being **behaviourally wrong** (every same-locale navigation cross-fades with the chrome, defeating the UX goal). The lesson parallels the Strategy A lesson from the May-8 VT entry: shape-positive does not imply behaviour-correct.

**Persist key shape, not persist presence, is the load-bearing decision.** When a persist key causes a cross-X regression (where X is locale or section), fix the key by encoding X in it; don't drop the key. Dropping the key silences the symptom at the cost of the feature.

Concretely: the original sidebarPersistKey PR commit `4ee3e66` introduced a static persist key that caused the EN↔JA regression. The right correction was to add `${lang}` and `${navSection}` to the key. The actual correction (commit `94da5c4`, W7A) dropped the key entirely. Going straight from `4ee3e66` to a locale-and-section-keyed key would have skipped the W7A overshoot and this whole correction cycle.

### Wave 2b sub-lesson: persist preserves DOM identity, not derived browser state or transient html attributes

The initial Wave 1 T1–T4 implementation (#1548) passed all harness shape assertions but the Wave 2 confirm gate harness (T5, #1552) caught two behaviour failures:

**B9 — sidebar scrollTop reset** (fixed in T1B, commit `ab75344`): the `<aside>` DOM node survives the body swap via `moveBefore()` (B2 PASS), but `scrollTop` is reset during the swap sequence — either by `moveBefore()` itself or by Preact's post-swap re-renders. Fix: capture `scrollTop` just before `AFTER_NAVIGATE_EVENT` fires (where it is already 0) and restore it immediately after. Lives in `src/components/sidebar-tree.tsx`.

**B10 — data-sidebar-hidden wiped** (fixed in T4B, commit `4f6b7ff`): zfb's `swapRootAttributes` wipes all `<html>` attributes that are not in `NON_OVERRIDABLE_ZFB_ATTRS` on every SPA navigation. `data-sidebar-hidden` is one of them, and the pre-paint inline script that restores it from localStorage only runs on initial page load, not on SPA nav. Fix: add `BEFORE_NAVIGATE_EVENT` / `AFTER_NAVIGATE_EVENT` listeners to the persisted `DesktopSidebarToggle` island — capture whether the attribute is present before the swap, restore it after. Lives in `src/components/desktop-sidebar-toggle.tsx`.

Both fixes are exactly the pattern the harness was designed to catch: shape assertions (B1–B8) passed in Wave 1, behaviour assertions (B9–B10) failed in Wave 2. The contract worked.

The sub-lesson: **`data-zfb-transition-persist` preserves DOM-node identity across the swap. It does NOT preserve derived browser state (scroll position, selection, focus) or transient `<html>` attributes managed by zfb's root-attribute swap. Those need their own re-sync hooks on `BEFORE_NAVIGATE_EVENT` / `AFTER_NAVIGATE_EVENT`.** Persist is not a substitute for explicit state capture and restore.

### Would-skip-if-redoing

The W7A "drop persist entirely" commit (`94da5c4`). Going straight from the original static sidebarPersistKey PR (`4ee3e66`) to a locale-and-section-keyed sidebarPersistKey would have skipped both the W7A fix-then-overshoot cycle and this big-plan correction epic.

### References

- Epic: #1547; this sub-issue: #1554
- T1 (Wave 1 sidebar persist wiring): #1548; T5 (confirm gate harness): #1552
- Wave 2b fixes: T1B B9 scrollTop (`ab75344`), T4B B10 data-sidebar-hidden (`4f6b7ff`)
- W7A over-correction commit: `94da5c4`
- Original sidebarPersistKey commit: `4ee3e66`
- Harness (source of truth for shape-AND-behaviour testing): `scripts/wave2-vt-chrome-persist-confirm.ts`

## 2026-05-09 (later) — VT chrome-persist W8: DOM-identity vs visual-extraction (epic #1556)

### What broke

Epic #1547 (W7A correction + W8 groundwork) shipped DOM-node identity preservation for the chrome (sidebar, header, footer, desktop-sidebar-toggle) with a 29/29 confirm-gate harness PASS and three permanent e2e specs. The harness covered shape (S1–S7), DOM-identity behaviour (B1–B10), cross-locale (C1–C3), cross-section (D1–D2), and hide_sidebar boundary (E1–E3) assertions. All 29 passed.

The user reported on the deployed PR preview that the entire viewport was still cross-fading on navigation — chrome flashing alongside content, exactly the visual symptom the epic was meant to eliminate. The UX goal was not achieved despite every assertion passing.

### What the harness asserted

The W7A correction harness (`scripts/wave2-vt-chrome-persist-confirm.ts`) asserted the following families:

- **S1–S7** — SSR shape: `data-zfb-transition-persist` attributes emitted on the correct elements, correct key values, no duplicate keys.
- **B1–B10** — DOM-identity behaviour: the sidebar, header, footer, and desktop-sidebar-toggle DOM nodes are the same object instances before and after navigation (`el === elAfterNav`), scroll position preserved (B9), `data-sidebar-hidden` re-synced (B10).
- **C1–C3** — Cross-locale: key mismatch on EN↔JA navigation causes expected new-node creation (locale toggle stays correct).
- **D1–D2** — Cross-section: key mismatch on section boundary navigation causes expected new-node creation.
- **E1–E3** — hide_sidebar boundary: chrome re-renders correctly on pages where the sidebar is hidden.

**No assertion sampled `viewTransitionName` on any persisted element. No assertion called `document.getAnimations()` filtered by named chrome pseudo-elements.** The harness was entirely structural — it verified that the right DOM nodes survived the swap, but said nothing about whether the View Transitions API captured those nodes as named, non-animated snapshots.

### Why the gap was invisible

"Persist" is a leaky shared word across frameworks. In Astro, `data-astro-transition-persist` implicitly does two things simultaneously:

1. DOM-node identity preservation (the runtime's `moveBefore()`-based matched-key swap).
2. Visual extraction: Astro's router automatically emits `view-transition-name` on persist-annotated elements so the VT API treats them as individually named snapshots rather than parts of the full-page crossfade.

Both halves come bundled in one attribute in Astro. In zfb, the contract is split: `data-zfb-transition-persist` handles only DOM-node identity. This is confirmed by reading `packages/zfb-runtime/src/client-router/swap-functions.ts` in the zfb checkout — it greps `[data-zfb-transition-persist]`, collects matching elements from old and new bodies, and calls `moveBefore()` to transplant them. Nothing in that file emits `view-transition-name`. The host CSS layer is the sole place where the visual extraction can happen.

Because the W7A harness was written by authors who came from Astro's bundled-contract mental model, "persist" implicitly meant "both parts are done." The harness verified the DOM-identity half (which IS what `data-zfb-transition-persist` does) and silently assumed the visual half was automatically handled — just as it is in Astro. It was not. The gap was invisible because the assumption was never examined.

### The right contract shape

Persist in zfb is a **two-part contract** that must be explicitly implemented and explicitly asserted:

**Part 1 — DOM-node identity (runtime layer):**
`data-zfb-transition-persist="<key>"` on the element + the zfb runtime's `swap-functions.ts` matched-key `moveBefore()` swap. This half was present and passing.

**Part 2 — Visual extraction (host CSS layer):**
CSS attribute selectors that map `[data-zfb-transition-persist^="<prefix>"]` to `view-transition-name: <name>` on the matching elements. Plus `animation: none` on the named pseudos — `::view-transition-old(<name>)`, `::view-transition-new(<name>)`, and `::view-transition-group(<name>)` (see below) — so the named elements are held static while the rest of the page crossfades.

> **Amendment (#2072):** "held static" holds only when the chrome element exists on BOTH pages of a navigation — when it exists on one side only, `:only-child`-scoped rules cross-fade the lone snapshot in sync with the root content fade instead of holding it static.

The W7A correction added Part 1 and missed Part 2. The W8 epic (this epic, #1556) adds Part 2 and the visual assertions V1–V8b in T3 to lock both halves in.

The full correct CSS shape for each persisted chrome region is:

```css
[data-zfb-transition-persist^="sidebar"] {
  view-transition-name: chrome-sidebar;
}
::view-transition-old(chrome-sidebar),
::view-transition-new(chrome-sidebar),
::view-transition-group(chrome-sidebar) {
  animation: none;
}
/* ... repeat for header, footer, desktop-sidebar-toggle */
```

### Why `::view-transition-group` matters

When `::view-transition-old(<name>)` and `::view-transition-new(<name>)` are both `animation: none`, there is still a third UA-generated pseudo-element: `::view-transition-group(<name>)`. This pseudo animates the bounding-box geometry of the named element between its captured position in the old snapshot and its captured position in the new snapshot. If the element's size or position changes between pages (e.g. sidebar width differs across locales, or header height changes on pages with different nav states), the UA will produce a geometry-morph animation on the group even when old/new are frozen.

For the "named chrome element never visually animates" contract to be robust, all three pseudos must be neutralised (with the #2072 amendment above: this "never animates" guarantee applies to chrome present on both sides of a navigation, not to a lone one-sided snapshot). The original W8 plan (before Codex and gcoc reviews during planning) only neutralised old/new. Codex's planning review explicitly flagged the group pseudo as a missing neutralisation — surfacing a would-be silent regression before the CSS was written. The final T2 implementation neutralises all three pseudos.

The lesson: when writing `animation: none` rules for a named VT element, enumerate `::view-transition-old(<name>)`, `::view-transition-new(<name>)`, AND `::view-transition-group(<name>)` as a unit. Missing any one of the three leaves a door open for geometry-morph animations on geometry changes.

### Watch for next time

**When porting a "persist" feature from another framework, name the two halves of the contract explicitly before writing any code.** Ask: "In this framework, does the persist annotation handle DOM-node identity only, or does it also handle visual extraction?" If only DOM identity, add the visual extraction half explicitly as a separate implementation task and write a separate harness assertion for it.

The two halves and their assertion shapes:

**DOM-identity half** — checked via marker properties:

```ts
const elBefore = document.querySelector('[data-zfb-transition-persist^="sidebar"]');
await navigate('/docs/other-page');
const elAfter = document.querySelector('[data-zfb-transition-persist^="sidebar"]');
assert(elBefore === elAfter, 'sidebar DOM node preserved');
```

**Visual-extraction half** — checked via computed style AND filtered animations:

```ts
// Check that the CSS attribute selector applied the view-transition-name
const el = document.querySelector('[data-zfb-transition-persist^="sidebar"]');
assert(getComputedStyle(el).viewTransitionName === 'chrome-sidebar', 'VTN applied');

// Check that the named element's animations are neutralised
// Use EXACT-MATCH pseudo strings — NOT substring match like .includes("zfb-")
const vtOldAnims = document.getAnimations().filter(
  a => a.effect?.target === el && a.effect?.pseudoElement === '::view-transition-old(chrome-sidebar)'
);
const vtGroupAnims = document.getAnimations().filter(
  a => a.effect?.pseudoElement === '::view-transition-group(chrome-sidebar)'
);
assert(vtOldAnims.every(a => a.playState === 'finished'), 'old pseudo: no active animation');
assert(vtGroupAnims.every(a => a.playState === 'finished'), 'group pseudo: no geometry morph');
```

Why **exact-match** on pseudo strings matters: `.includes("zfb-")` or `.includes("chrome-")` substring matching mixes old/new/group pseudos and makes a `count === 0` assertion simultaneously brittle (passes when the runtime is broken and no animation fires at all) and too broad (conflates three different animation channels into one check). Use exact pseudo strings to assert each channel independently.

**Asserting the structural (DOM-identity) half and trusting the visual half is the W7A trap — one level deeper than the W8 entry that superseded it.** The prior retro entries warn about shape-vs-behaviour gaps in VT verification; this entry names the specific axis within persist verification where that gap opened.

### Watch for next time #2: `view-transition-name` uniqueness

The CSS spec requires `view-transition-name` to be unique among all rendered elements at the moment a transition starts. If two elements share the same `view-transition-name` value, the UA skips the entire transition for those elements (and may skip the transition entirely depending on implementation). The symptom is silent — no error, no console warning, the transition just falls back to the full-page crossfade.

This is a real risk when CSS attribute selectors assign `view-transition-name`. A selector like `[data-zfb-transition-persist^="sidebar"]` matches every element whose key starts with `"sidebar"`. If both the mobile sidebar (`sidebar-en-default`) and the desktop sidebar (`sidebar-en-default`) are rendered simultaneously under different CSS media conditions, both match the selector and both get the same `view-transition-name: chrome-sidebar`. Result: UA silently skips the named transition.

Audit pattern: after writing the attribute selectors, run `pnpm build && node -e "..." dist/index.html` (or open the deployed preview in DevTools) and verify that **exactly one element matches each selector** in the rendered DOM. For mobile/desktop variants where both are present in the DOM at all times (just hidden via CSS), the selectors must be more specific or the `view-transition-name` values must be distinct per variant.

### Watch for next time #3: deployed-preview verification, not local dev

The chrome cross-fade only manifested on the deployed Cloudflare Pages preview at the asset-base path (`/pj/zudo-doc/` on `pr-<num>.zudo-doc.pages.dev`). Running `pnpm dev` locally (which runs without the asset-base prefix) did not reproduce the issue.

This is consistent with the 2026-05-04 "claimed-fix-without-end-to-end-verification" entry's lesson about asset-base-path bugs hiding in local dev. The lesson extends to VT visual bugs: the full VT execution path (CSS asset URL resolution, view-transition-name cascade, UA snapshot capture) runs with the deployed asset-base prefix. Local dev may produce a functionally identical VT outcome via a different code path that happens to work for the local case.

**Acceptance criteria for any UX-perceptible change — especially View Transitions behavior — must include explicit verification on the deployed per-PR preview URL**, not just on `localhost`. For VT specifically: open the deployed preview in Chrome, navigate between two doc pages, and confirm with eyes that the chrome elements do not flash.

### Headless Chromium limitation note (for future visual harness work)

During T3 implementation, V6 (the "root cross-fade still animating" sanity check) hit a headless Chromium limitation: `document.getAnimations()` does not consistently return view-transition pseudo-element animations when filtered by `pseudoElement` string in headless mode. Specifically, `document.getAnimations().filter(a => a.effect?.pseudoElement === '::view-transition-old(root)')` returned 0 even when the root cross-fade was visually in progress.

The T3 harness adapted by using total `document.getAnimations().length >= 1` as the V6 regression proxy — mirroring the B6 shape check — rather than asserting the specific root pseudo. The permanent e2e specs use the same adaptation.

If future visual harness work tries to assert the absence or presence of a specific named pseudo-element animation in headless Chromium and gets surprising 0-count results, this is the likely cause. The workaround is to assert total animation count (coarser, but stable in headless) and separately verify the named-element shape via `getComputedStyle(el).viewTransitionName` (which IS consistent in headless). Reserve the exact-pseudo-string filter assertions for real (non-headless) Chrome verification or for cases where the total-count proxy is insufficient.

### Would-skip-if-redoing

The W7A confirm-gate harness should have been authored with BOTH halves of the persist contract from day one. The W7A lesson on "shape-positive does not imply behaviour-correct" (from the May-8 Strategy A entry) was **exactly** the lesson needed to motivate visual assertions on day one. If the harness authors had applied that lesson one level deeper — "DOM-identity is the *shape* of persist; visual extraction is the *behaviour* of persist as the user sees it" — the V1–V8b visual assertions would have been part of the W7A harness scope, not a follow-up epic's T3 scope.

The structural cause: "behaviour" was silently scoped to DOM identity and clickability in the W7A harness, because those are the behaviours `data-zfb-transition-persist` directly controls in zfb's runtime. The visual half required reading the zfb runtime source (`swap-functions.ts`) to discover what persist does NOT do. That source-read step was not in the harness authoring workflow.

**Future harness authors: when porting a UX-perceptible feature from another framework, read the target framework's runtime source for that feature before writing the harness.** Confirm: does the runtime handle both the structural and the visual half, or only the structural half? If only structural, the visual half must be added explicitly to the implementation scope AND to the harness scope on the same wave. Do not split them across epics.

Specific rule for View Transitions + persist: the moment a persist annotation is added to a chrome element, the harness must assert BOTH `el === elAfterNav` (DOM identity) AND `getComputedStyle(el).viewTransitionName === <expected>` (visual extraction applied). Two assertions, one annotation. Every time.

### References

- This epic: #1556
- Previous epic that shipped DOM-identity half without visual half: #1547; merged as PR #1555
- zfb runtime file that defines what `data-zfb-transition-persist` actually does: `packages/zfb-runtime/src/client-router/swap-functions.ts`
- Planning review logs: `cclogs/zudo-doc2/20260509_155403-codex-2nd.md` (Codex 2nd review that flagged `::view-transition-group`) and `cclogs/zudo-doc2/20260509_155630-gcoc-2nd.md` (gcoc 2nd review)
- T3 visual assertions (V1–V8b): added in sub-issue #1559 on branch `vt-chrome-static/T3`

## 2026-05-22 — Two-Mode Tauri (epic #1673)

### What we set out to do

Issue #1672 recommended adopting zfb's new embed-as-library API (`ServerMode::Embed` + `extraWatchPaths`) to give the Tauri stub a "Tauri-with-live-content" shape. The goal that emerged after re-framing: ship a standalone offline reader (Mode 1, the existing `src-tauri/`) AND a configurable dev wrapper (Mode 2, new `src-tauri-dev/`) that spawns a project's `pnpm dev` and opens a WebView at the dev URL — plus a host-side chokidar watcher so `.claude/` edits regenerate during `pnpm dev`.

### Approach we tried first

The starting point was #1672's recommendation: adopt the embed API, which would have meant substantial upstream zfb work (watcher-in-Embed, a Rust plugin-tick callback, etc.).

### What worked

The embed adoption was **dropped**. The two-mode architecture serves both of zudo-doc's actual use cases (ship-an-offline-reader; wrap-a-live-dev-server) with **zero upstream zfb changes**. The implementation was a near-mechanical port of an existing working reference.

### Watch for next time #1: re-frame "how do we adopt this API?" as "what use cases does the deliverable serve?"

#1672 was a well-written planning issue that recommended a concrete, complex architectural adoption. It was correctly refuted during planning — not by finding a flaw in the embed API, but by **re-framing the question**. "How do we adopt `ServerMode::Embed`?" assumes the deliverable is "a thing that uses the embed API." Asking instead "what use cases does the Tauri integration actually serve?" surfaced two distinct, simpler shapes (offline reader; dev wrapper) — neither of which needs the hybrid embed shape the API was built for.

The lesson is the framing move itself: when a planning issue recommends adopting an upstream capability, **before designing the adoption, enumerate the concrete use cases the deliverable serves and check whether any of them actually needs that capability.** A recommended adoption is a proposed *means*; verify it against *ends* first. Here the means was solving a problem ("one hybrid app that is both shipped-standalone AND live-content-capable") that neither end required.

### Watch for next time #2: look at sibling projects / wisdom skills before designing — not just upstream

The project already has a "look upstream first" lesson (2026-05-01). This is the sibling/reference-implementation version. W1B's design scope and W2A's implementation scope **collapsed dramatically** once the user pointed at CCResDoc (`$HOME/.claude/doc/src-tauri/`) as a working reference and `zudo-tauri-wisdom` as the documented-gotchas skill. What looked like green-field Tauri lifecycle design (GUI PATH resolution, process-group cleanup, port reaping, ready detection, loading screen, launch-error UI) was almost entirely **already solved** in a sibling project. W1B's job shrank to "read the reference, identify the Mode 2-specific deltas, lock the spec"; W2A's to "port `main.rs` with 10 named adaptations."

Mid-planning recognition of "this is not green-field — there is a working reference" is high leverage. Before designing any subsystem, ask: has this team (or a sibling project, or a wisdom skill) already built this? If yes, the design task is *delta identification*, not design.

### Watch for next time #3: zfb's `preBuild` plugin hook does NOT re-run on dev watcher ticks

Confirmed in zfb source: `crates/zfb/src/commands/dev.rs:144-181` and `crates/zfb-build/src/plugin_runner.rs:21`. zfb's dev server runs `preBuild` plugin hooks once at startup; on a content-watcher tick it re-renders content but does **not** re-invoke the Node plugin pipeline — re-importing Node plugins per tick is too expensive.

Consequence for any zfb consumer with a build-time content generator (here: the Claude-resources MDX generator): "live regeneration during dev" cannot ride the plugin hook. It needs a **host-side watcher** — chokidar wired into `pnpm dev` via `run-p` for local dev, or a native file watcher for a Tauri-embed shape. This generalises: if a zfb consumer generates content in a `preBuild` plugin and wants that content to refresh during `pnpm dev`, the watcher is the consumer's responsibility, not zfb's.

### Would-skip-if-redoing

Two execution-level defects slipped past child agents and `/light-review`, caught only by the manager's Wave 4 end-to-end verification:

1. **A feature template directory was named in kebab-case (`templates/features/tauri-dev/`) while the scaffold composer resolves the directory from the camelCase feature name (`tauriDev`).** `compose.ts` does `path.join(featuresDir, feature.name, "files")`, and `copyFeatureFiles` **silently returns** when the directory does not exist — so scaffolding the feature copied nothing, with no error. The unit test that would have caught it was authored by the same agent and never run in its worktree (no `node_modules`); the root `vitest` Step-9 check did exercise it, but the regression was introduced after that check. Lesson: when a feature is keyed by a camelCase name, every name-derived path (template dir, etc.) must use that exact name — and `copyFeatureFiles`'s silent no-op on a missing dir is a footgun worth a louder failure.
2. **A build command (`cargo tauri build --manifest-path src-tauri-dev/Cargo.toml`) was specified in the locked spec, faithfully copied into package.json scripts, the generator, docs (EN+JA), README, and code comments — and was invalid.** `cargo tauri` has no `--manifest-path` flag; the correct form is `cd src-tauri-dev && cargo tauri build`. A wrong command in a *locked spec* propagates to every downstream artifact. Lesson: spec-level commands that no agent will execute before final verification (here, a heavy Tauri build) should be sanity-checked against the actual CLI early — ideally during spec lock (W1B) — not discovered at end-to-end verification (W4).

Both reinforce the existing "sub-agent verified is not verified" lesson: the heavy/GUI/build verification a child agent cannot run in a worktree (no `node_modules`, no port binding, resource limits) **must** be run by the manager on the merged base, and that pass is where genuinely broken-but-plausible-looking output gets caught.

### References

- This epic: #1673 (supersedes #1672)
- Reference implementation ported for Mode 2: `$HOME/.claude/doc/src-tauri/` (CCResDoc) and the `zudo-tauri-wisdom` skill
- zfb source confirming preBuild does not re-run on watcher ticks: `crates/zfb/src/commands/dev.rs:144-181`, `crates/zfb-build/src/plugin_runner.rs:21`
- Unrelated pre-existing failure raised during the epic: #1683 (migration-check serve-snapshots SIGTERM test)
