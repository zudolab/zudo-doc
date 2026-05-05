# W1B — Host-side Workaround Audit (post-pin-bump f68a9ba)

**Branch:** `zfb-pin-bump-migration-fixes/w1b-workarounds`
**Upstream pin range audited:** `bdbfbfb..f68a9ba`
**Date:** 2026-05-05

---

## Category 1 — `plugins/copy-public-plugin.mjs`

**Verdict: KEEP (semantics mismatch — do NOT remove)**

**Upstream commit:** `a6abbc3` "feat(build): copy public/ into out_dir during zfb build (#192)"

**Analysis:**

The upstream `copy_public_dir` helper (in `crates/zfb/src/commands/build.rs`) recursively copies `<project_root>/<cfg.public_dir>` into `<out_dir>/<base-segment>/`. When `cfg.base` is set (e.g., `"/pj/zudo-doc/"`), files land at `dist/pj/zudo-doc/img/logo.svg`.

The host plugin (`plugins/copy-public-plugin.mjs`) instead copies files flat under `dist/` — `public/img/logo.svg` → `dist/img/logo.svg`.

These semantics differ. The deploy pipeline (`.github/workflows/main-deploy.yml`) does:

```
cp -r dist/. deploy/pj/zudo-doc/
```

This means:

- Host plugin output: `dist/img/logo.svg` → after deploy prep: `deploy/pj/zudo-doc/img/logo.svg` → served at `/pj/zudo-doc/img/logo.svg` ✓
- Upstream output: `dist/pj/zudo-doc/img/logo.svg` → after deploy prep: `deploy/pj/zudo-doc/pj/zudo-doc/img/logo.svg` → served at `/pj/zudo-doc/pj/zudo-doc/img/logo.svg` ✗ (double-prefixed)

The upstream implementation is designed for projects that serve the dist directly (without the deploy-wrap step). zudo-doc's deploy pipeline pre-wraps `dist/` under the base path, making the upstream base-aware copy semantics incompatible.

The host plugin comment at `plugins/copy-public-plugin.mjs` lines 1–27 already documents this incompatibility correctly (mentions the deploy pipeline's double-prefix concern explicitly). The CI smoke test at `.github/workflows/main-deploy.yml:335-337` asserts that `$DEPLOY_URL/img/logo.svg` returns HTTP 200.

**Action required:** No change to the plugin or zfb.config.ts registration. The "remove once upstream ships" comment in `zfb.config.ts` (line 504) should be updated to note that upstream #192 has shipped but the host plugin must be retained due to deploy-pipeline base-wrap semantics.

**Files / line ranges to modify:**

- `zfb.config.ts` lines 503–504: update the "remove once upstream ships and pin is bumped" comment to clarify that upstream #192 has landed but the host plugin is kept due to deploy-pipeline double-prefix incompatibility.

---

## Category 2 — `@theme { --color-*: initial; }` reset in `src/styles/global.css`

**Verdict: KEEP (project rule, not a workaround — but comment text must be updated)**

**Upstream commit:** `6a950e1` (merged in `9e37551`) "fix(zfb-css): extend user_has_import to match split-import tailwindcss/* patterns"

**Analysis:**

The upstream fix (zfb#159, `9e37551`) now recognises the split-import pattern (`@import "tailwindcss/preflight"` + `@import "tailwindcss/utilities"`) and no longer prepends the full default Tailwind bundle. This means the mechanical cause of the leak — the full default palette tokens reaching `@theme` — is now eliminated at source by the upstream fix.

However, per the issue spec and epic #1397 retro, the `--color-*: initial` reset is a **project colour rule** (tight-token policy: "NEVER use Tailwind default colors") and must be kept regardless of upstream fix status. The project's authored `@theme` re-adds only the project's own named color tokens after the wildcard wipe. This is intentional design, not a defensive kludge.

The reset line (`--color-*: initial`) at `src/styles/global.css:83` is CORRECT to keep.

**What needs updating:** The comment block at `global.css` lines 51–82 is now partially stale:

- Lines 52–66 describe the leak mechanism as if it still occurs. With the upstream fix applied, the full default palette no longer leaks.
- Lines 79–81 say "Once upstream lands the split-import recognition and the pin is bumped, this reset becomes a no-op; remove at that time." This is now WRONG — the reset is kept as policy, not as a workaround.
- The comment in `src/CLAUDE.md:99` says "Remove when upstream fix lands and pin is bumped (Sub-5)." — also stale and wrong.

**Files / line ranges to modify:**

- `src/styles/global.css` lines 51–82: update the comment header from "zfb upstream blind spot workaround" to "project tight-token rule"; drop the leak-mechanism description; drop or invert the "remove once upstream ships" sentence. The updated comment should clarify that while the upstream fix (zfb#159, `9e37551`) is now applied (no longer needed to block the leak), the reset is retained as an intentional project design rule per the tight-token policy (documented in `src/CLAUDE.md` "Color Rules" and `src/styles/global.css` itself under "Colors — Three-tier token system").
- `src/CLAUDE.md` line 99: update the stale "Remove when upstream fix lands" language. The fix has landed and the pin has been bumped, yet the reset is retained by policy.

---

## Category 3 — W3B admonition reformat (6 docs files)

**Verdict: KEEP — empirical test FAIL**

**Upstream commit:** `c644eb7` "feat(admonitions): flip title_from_label default to true and add blank-line diagnostic"

**Empirical test procedure:**

1. Reverted `src/content/docs/components/admonitions.mdx` to its original no-blank-line shape for all 10 live directive blocks (removing the blank lines added by commit `6b22fbf`). Code-fence examples left unchanged.
2. Ran `SKIP_DOC_HISTORY=1 pnpm build` at pin `f68a9ba` (the target pin — already active via `file:../zfb/packages/zfb`).
3. Inspected `dist/docs/components/admonitions/index.html`.

**Result: FAIL (0 data-admonition markers; 20 occurrences of raw `:::note/tip/info/warning/danger` text in rendered HTML)**

```
grep -oE 'data-admonition="(note|tip|info|warning|danger)"' \
  dist/docs/components/admonitions/index.html | sort | uniq -c
# → (empty — 0 results)

grep -c ":::note\|:::tip\|:::info\|:::warning\|:::danger" \
  dist/docs/components/admonitions/index.html
# → 20 (raw directive markers leaked into <p> bodies)
```

**Interpretation:** The upstream `c644eb7` commit explicitly states "Does not loosen the parser (avoids breaking fenced code blocks)." The parser at `f68a9ba` still requires separate blank-line paragraphs around `:::name` and `:::` to recognise directives. Without blank lines, the opener, body, and closer collapse into a single `<p>` and the container-matching logic in `DirectiveRegistry` does not fire.

The upstream change adds only a **build-time diagnostic** (a `DirectiveDiagnostic` warning when merged content is detected), not a parser relaxation.

**Recommendation: KEEP the W3B reformatted blank-line shape in all 6 files.**

**Files reformatted by W3B (do not revert):**

- `src/content/docs/components/admonitions.mdx`
- `src/content/docs-ja/components/admonitions.mdx`
- `src/content/docs/components/image-enlarge.mdx`
- `src/content/docs-ja/components/image-enlarge.mdx`
- `src/content/docs/concepts/trailing-slash-policy.mdx`
- `src/content/docs-ja/concepts/trailing-slash-policy.mdx`

**Note on upstream diagnostic:** The diagnostic will now emit build warnings for any future content that reverts to no-blank-line shape. This is a positive signal — it confirms upstream intends the blank-line shape to be the canonical form.

---

## Category 4 — `zfb.config.ts` comment blocks citing zfb#185, #187, #188

**Verdict: MODIFY — comments are now stale; update to reflect resolved state**

### zfb#187 and #188 block (lines 512–539)

**Upstream commits:**

- `635a8e3` "fix(bundler): sort walk order and reset HeadingLinksPlugin between entries (zfb#187)" (merged in `aaf711f`)
- `339e30f` "feat(syntect): expose code highlight theme via zfb.config.ts" (merged in `1e42ee5`) for #188

Both gaps are resolved by `f68a9ba`:

- #187 (walk-order divergence → `data-zfb-content-fallback` on 65% of pages): fixed by `635a8e3` via `.sort_by_file_name()` + `HeadingLinksPlugin::reset()`.
- #188 (syntect theme hardcoded to `base16-ocean.dark`, unreachable from config): fixed by `339e30f` which adds `code_highlight: Option<CodeHighlightConfig>` to `ZfbConfig`.

The comment block at `zfb.config.ts` lines 512–539 describes both gaps as if they are still open. With the pin at `f68a9ba`, both are resolved. The entire block should be removed or replaced with a note that they were resolved.

**File / line range to modify:**

- `zfb.config.ts` lines 512–539: remove the "Open upstream gaps" comment block entirely (both points are resolved). Optionally replace with a single-line tombstone noting the resolution (e.g., "gaps #187 + #188 resolved in f68a9ba").

### zfb#185 block (lines 363–414)

**Upstream commit:** `a22eb71` "feat(resolve-links): wire ResolveLinksPlugin via config + broken-link diagnostics" (merged in `756dfb6`)

This is a **partial resolution**:

- Gap 1 (`ResolveLinksPlugin` not wired via config): RESOLVED by `a22eb71`. The `resolveMarkdownLinks` config field is now available in `ZfbConfig`. Host has not yet added it to `zfb.config.ts` (uses `stripMdExt: true` alone), but the upstream gap is closed.
- Gap 2 (blank-line parser requirement): UNCHANGED — as confirmed by the category 3 empirical test, the parser still requires blank lines. The diagnostic (`c644eb7`) was added but the parser was not relaxed.

The comment at lines 390–414 says both gaps are "NOT yet reachable" and tracked under zfb#185. After the pin bump:

- Lines 393–401 (ResolveLinksPlugin not reachable) become stale: the plugin IS now wired via `a22eb71`. The host may optionally adopt `resolveMarkdownLinks` in a follow-up; the gap is no longer upstream-only.
- Lines 402–409 (blank-line parser requirement) remain accurate — the parser still requires blank lines (empirically confirmed).
- Line 369 references the pin as `bdbfbfb` — stale after the bump.

**File / line ranges to modify:**

- `zfb.config.ts` line 369: update the pin reference from `bdbfbfb` to `f68a9ba`.
- `zfb.config.ts` lines 390–401: update to reflect that `ResolveLinksPlugin` IS now wired upstream via `a22eb71`; note that adding `resolveMarkdownLinks` to this config is now possible (host-side adoption is a follow-up, out of scope for this audit — a separate sub-issue should be opened to adopt it in `zfb.config.ts`).
- `zfb.config.ts` lines 402–409: update to note that zfb#185 Gap 2 (blank-line requirement) is partially addressed — a build-time diagnostic was added (`c644eb7`) but the parser was not relaxed; the blank-line shape remains required.
- `zfb.config.ts` line 414: remove the "does not block on zfb#185" sentence or update it to note that zfb#185 is partially resolved.

---

## Category 5 — Other host-side defensive code

**Verdict: Two stale comments found (MODIFY)**

### 5a — `src/styles/global.css` "remove once upstream ships" language

Already covered in Category 2 above. The comment at lines 79–81 says the reset "becomes a no-op; remove at that time." With the upstream fix (9e37551) now applied and the pin bumped, but the reset intentionally kept by project policy, this sentence is actively misleading.

### 5b — `src/CLAUDE.md` line 99

The sentence "Remove when upstream fix lands and pin is bumped (Sub-5)." is stale. The upstream fix (zfb#159 / `9e37551`) has now landed and the pin is being bumped. The `--color-*: initial` reset is retained by project rule per epic #1397. The instruction to "remove" must be corrected so future editors do not act on it.

**File / line range to modify:**

- `src/CLAUDE.md` line 99: rewrite the sentence to reflect that zfb#159 is resolved and that the reset is kept as a project rule (tight-token policy), not as a workaround.

### 5c — `src/content/docs/claude-md/src.mdx` line 109

A content-mirror of `src/CLAUDE.md:99` — the showcase doc page for the src/CLAUDE.md file. Same stale claim: "Remove when upstream fix lands and pin is bumped (Sub-5)."

**File / line range to modify:**

- `src/content/docs/claude-md/src.mdx` line 109: same update as 5b.

---

## Summary Table

| # | Location | Verdict | Upstream commit | Action |
|---|---|---|---|---|
| 1 | `plugins/copy-public-plugin.mjs` | KEEP | `a6abbc3` | Update `zfb.config.ts` comment (line 504) to explain semantics mismatch |
| 2 | `src/styles/global.css` `--color-*: initial` | KEEP | `9e37551` | Update comment (lines 51–82) and `src/CLAUDE.md:99` to reflect policy-keep rationale |
| 3 | W3B admonition reformat (6 files) | KEEP | `c644eb7` | No file changes — empirical test FAIL; parser still requires blank lines |
| 4a | `zfb.config.ts` #187/#188 block (lines 512–539) | MODIFY | `635a8e3`, `339e30f` | Remove the "Open upstream gaps" comment block (both resolved) |
| 4b | `zfb.config.ts` #185 block (lines 363–414) | MODIFY | `a22eb71`, `c644eb7` | Update pin ref (line 369), update Gap 1 (now resolved), update Gap 2 (diagnostic added, parser unchanged) |
| 5a | `src/styles/global.css` lines 79–81 | MODIFY | `9e37551` | Drop "becomes a no-op; remove at that time" sentence |
| 5b | `src/CLAUDE.md` line 99 | MODIFY | `9e37551` | Rewrite stale "Remove when upstream fix lands" instruction |
| 5c | `src/content/docs/claude-md/src.mdx` line 109 | MODIFY | `9e37551` | Same as 5b (content mirror of CLAUDE.md) |

---

## Empirical Test Detail (Category 3)

- **Test conducted at:** `f68a9ba` (target pin, already resolved in worktree via `file:../zfb/packages/zfb` symlink)
- **File under test:** `src/content/docs/components/admonitions.mdx` — reverted to original no-blank-line shape (all 10 live directives; code fences unchanged)
- **Build command:** `SKIP_DOC_HISTORY=1 pnpm build`
- **Checked file:** `dist/docs/components/admonitions/index.html`
- **data-admonition markers found:** 0
- **Raw `:::` markers in HTML:** 20 (all 10 directives × 2 occurrences: opener and closer both leaked as plain text)
- **Verdict: FAIL** — parser does not accept original no-blank-line shape at f68a9ba
- **Local edit reverted before commit:** Yes (restored from `/tmp/admonitions-backup.mdx`)
