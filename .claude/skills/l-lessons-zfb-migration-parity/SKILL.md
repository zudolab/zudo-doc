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
