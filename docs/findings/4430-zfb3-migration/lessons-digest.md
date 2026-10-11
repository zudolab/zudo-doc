> Copied verbatim from `_temp-resource/4430-zfb3-migration/lessons-digest.md` before the #4476 deletion (2026-10-11).

# Lessons digest for the zfb 2.22.1 → 3.0.0 migration

Distilled on 2026-09-30 from `.claude/skills/l-lessons-zfb-migration-parity/SKILL.md` and
`.claude/skills/l-lessons-wt-teams-orchestration/SKILL.md` (read those for the full entries). The entry date and
title are given so a reader can find each entry in the source.

## 1. Strategy: v2 is the spec; zfb is a WIP you report to, not a black box you compensate for

- **2026-05-06 — Backside migration: replicate, do not redesign.** Agents silently rebuilt working components as
  generic look-alikes. Preserve the rendered HTML, CSS and behaviour of every component. A deviation needs a named
  technical cause (a zudo-wind or zudo-react output difference) and goes in the migration matrix (`docs/findings/4430-zfb3-migration/<topic>.md`). The
  hooks → setup-once rewrite is where "creative" output will creep in.
- **2026-05-01 — zfb is a WIP builder, not a finished framework.** Treating zfb as fixed produced ~200
  comparator/host patches, while a single zfb gap flagged 167 of 219 routes. Triage every diff cluster as
  zudo-doc, harness or zfb before writing code. If a contract is documented but the artifact is missing, that is
  a zfb implementation gap: file it.
- **2026-07-10 — Minimal Scaffold: spike first, split into waves, confirm gates.**
  - Run the observation spike on the exact release. It must produce runnable evidence for out-of-catalog classes,
    layer order, island identity, fail-closed hydration, the router bootstrap, prepaint scripts, and injected
    routes in dev AND build.
  - Then lock filename-exact specs.
  - Budget two confirm gates: a mid-epic floor and a final end-to-end run.
- **2026-05-08 — VT Strategy B port.** Choose each island's port approach by behavioural equivalence, not by the
  smallest diff.
- **2026-05-22 — Two-Mode Tauri.** Mine upstream's own migration docs and examples first, then reduce the work to
  identifying the delta.

## 2. Verification: computed styles and behaviour, not a green build

- **2026-05-05 — "nothing seems to be changed".** A grep checklist, then an "almost same" verdict, then an
  "upstream-blocked remainder" were each used as a framing to ship. Done means every route matches the working
  reference, modulo known noise. Don't prime verifiers with expected blockers. The manager never claims parity it
  did not measure.
- **2026-05-08/09 — VT chrome-persist.** The harnesses checked the shape of the output but not its behaviour:
  - 5/5 passed on a view transition that aborted on every click;
  - 29/29 passed while the whole viewport cross-faded.

  Gate on behaviour instead:

  - no full reload on click;
  - `viewTransition.finished` resolves;
  - the element is the same node after navigation (`el === elAfterNav`);
  - the expected computed `view-transition-name`.
- **2026-05-04 — asset pipeline follow-ups.** `--spacing: initial` zeroed every spacing utility while the
  structural gates were green. Audit utilities by their *computed value*.
- **2026-05-04 — claimed fix without end-to-end verification.** "`pnpm build` exit 0 + 217 pages built tells you
  nothing." The manager re-runs the claimed checks.
- **2026-05-05 — ZFB style recovery.** A measurement bug in the planning session's own grep framed a whole epic.
  Validate class greps against a class known to be present.
- **2026-06-29 — Collapse Wiring Shells.** Seal a CI-faithful v2 baseline (`scripts/parity-build.sh`) before the
  bump. Keep the base branch green for as long as possible; do v2-side prep waves first and verify them.

## 3. Triage: fix zfb upstream, bump, retry

- A non-noise diff that is a zfb capability gap gets fixed upstream, then the pin is bumped and the check retried.
  "Upstream-blocked remainder is not a release shape; it's a stop signal": the major waits and the root PR stays
  draft.
- Cluster before filing. "200 issues for one root cause is noise."
- When a common utility is missing, ask whether the fix would also be right for the *next* consumer.
- **2026-05-05 — embed-v8 pin bump.** Audit by building against the release and diffing the upstream signature
  changes. Treat 3.0.x version shifts as normal, and re-fetch the latest version at each gate.
- Children file upstream *issues*, not PRs. Confirm the published tarball contains every fix you depend on. Bump
  every zfb-family pin in one atomic commit.

## 4. Orchestration

- **2026-07-16 — Theme Core.** Merging on "tests pass + tree clean" pruned worktrees out from under reviews that
  were still running.
  - Children run their self-review in the foreground and commit before reporting.
  - Merge only on an explicit completion report.
  - The manager runs build, e2e and b4push on the merged base, and reproduces red CI with the exact CI commands.
- Give every shared file a single owner or explicit sequencing: `global.css`, `features.css`/`theme.css`/`content.css`, the exports map,
  the island registry and `zfb.config.ts`.
- Delete tests together with their targets. Template drift and `scaffold.test.ts` count toward each wave's
  definition of done.
- Specs list explicit NON-removals. Schema-check hand-written token and config blocks at spec time. Keep one
  failure domain per child.

## 5. Technical traps likely to recur

- **2026-07-01 — dead islands under package-owned routes.** An island left a marker with no registry entry, and
  the showcase's own `pages/` stubs masked it. Test the islands against host pages, injected routes, locales and
  versions. Assert marker + registry + real hydration. Keep island imports static.
- **Router bootstrap:** re-prove the side-effect bootstrap island behind a no-reload gate.
- **Persist:** persisting keeps DOM identity only. It does not keep scroll position, `<html>` attributes or
  view-transition names. Port the BEFORE/AFTER_NAVIGATE re-sync explicitly, and assert that persisted islands do
  not re-mount.
- **Prepaint:** `sidebar-prepaint`, `toc-prepaint` and colour-scheme sync must emit inline before paint and
  re-sync on SPA navigation.
- **Cascade:** measure where v3 places at-rules and layers ("Test first, hedge only when test fails").
- **Base path:** test a build with a non-root `base`; one view-transition bug appeared only under a base path.
- **Packaging:** test the unpublished major via `pnpm pack` + `file:<tgz>`, never `link:`. `link:` caused a
  dual-runtime SSR crash.
- **Static island imports** pull their dependencies (`diff`, zdtp) into every build. Audit them.
