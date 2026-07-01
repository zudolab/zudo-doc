---
name: color-scheme-a11y
description: "WCAG-baseline contrast rules for zudo-doc's 52 color schemes. MUST be consulted before adding, editing, or tweaking any color scheme in src/config/color-schemes.ts or src/config/color-tweak-presets.ts, or before touching semantic/palette color values for accessibility. Covers the finalized fg/bg pair matrix + thresholds, the OKLCH hue-preserving tweak methodology, the muted dual-role decision, the raw-p5 important-admonition exception, the verification workflow, the new-scheme checklist, and documented scope exceptions. Triggered by 'color scheme', 'contrast', 'WCAG', 'a11y color', 'tweak preset', 'color-tweak-presets', 'scheme accessibility'."
---

# Color-Scheme Accessibility Rules (scheme-a11y, epic #2489)

**IMPORTANT — this is the executable spec.** A Wave-3 batch agent tweaking 13 schemes
must be able to produce correct edits from **this document + its own per-scheme failure
inventory alone**. Every rule here is concrete. When in doubt, the AA text floor wins.

zudo-doc ships **52 color schemes**: 2 project-owned defaults in
`src/config/color-schemes.ts` (already WCAG-AA-fixed by #2298) and **50 ghostty-sourced
presets** in `src/config/color-tweak-presets.ts`. Both files are user-facing: the zdtp
"Scheme…" dropdown applies them live, and `create-zudo-doc` scaffolds let downstream
users adopt any of them permanently. **These two files are the single canonical color
surface** — do NOT touch e2e fixtures (`e2e/fixtures/*/src/config/…`), which carry
unguarded hex copies by design.

## Policy inversion (the point of this epic)

The old guard (`src/config/__tests__/contrast.test.ts`) allowlisted ~90 preset failures
as "upstream palette intrinsic". **That reason is dead.** We now tweak colors to reach
baseline readability and burn the allowlist down to ~zero. Upstream fidelity is secondary
to WCAG AA. The allowlist is a last resort only for a pair provably not user-visible in
this product (see §5).

---

## 1. The finalized pair matrix + thresholds

How a color renders decides its threshold: **text ≥ 4.5:1 (AA normal text), non-text
graphics/UI ≥ 3.0:1 (WCAG 1.4.11).** Every Tier-1 pair below was verified to render as
**text** somewhere in the product — evidence cited. AA text floors are **non-negotiable**;
a pair drops to Tier 2 only with proof it never renders as text.

Resolve every pair through the package resolvers (`resolveSemanticColors` /
`schemeToCssPairs` in `@takazudo/zudo-doc/color-scheme-utils`) — the same path production
uses. Admonition backgrounds are `color-mix(in srgb, <color> 12%, var(--color-bg))`
(`packages/zudo-doc/src/content.css`).

### Tier 1 — text, AA ≥ 4.5:1

| Pair (fg / bg) | Default slots | Renders as text — evidence | Threshold |
|---|---|---|---|
| `fg` / `bg` | fg=p15→resolved, bg=p9/explicit | Body copy; `--zd-fg` on `--zd-bg`. `schemeToCssPairs` → `--zd-fg`/`--zd-bg`. | 4.5 |
| `fg` / `surface` | surface=p0 (defaults; both built-ins override →p10) | Text on elevated panels: footer `bg-surface` (`packages/zudo-doc/src/footer/footer.tsx:89`), toolbar `bg-surface` (`…/doclayout/doc-layout-with-defaults.tsx:367`), dropdown/dialog panels (`…/i18n-version/version-switcher.tsx:216`, `…/island-types/index.ts:78`). | 4.5 |
| `muted` / `bg` | muted=p8 | **Secondary body text** — blockquote body `text-muted italic` (`…/content/content-blockquote.tsx:11`), footer text (`footer.tsx:84,116,144`), TOC inactive links (`…/toc/toc.tsx:102`, `…/toc/mobile-toc.tsx:122`), doc-pager labels (`…/doc-pager/index.tsx:59`), `li::marker` (`content.css:163`), code-block title (`features.css:228`). Dual-role — see §3. | 4.5 |
| `accent` / `bg` | accent=p5 | **Links are body text** — `text-accent underline` (`…/content/content-link.tsx:38`), heading hash-link `#` (`content.css:131`), footnote/UI links (`features.css:507`). **Raised 3.0→4.5** (epic). | 4.5 |
| `accentHover` / `bg` | accentHover=p14 | Link hover text — `hover:text-accent-hover` (`content-link.tsx:38`, `features.css:512`). | 4.5 |
| `codeFg` / `codeBg` | codeFg=p11, codeBg=p10 | Inline code + code-block base text (`features.css:256-257`, `features.css:533-534`). Governs base text only — syntax tokens are out of scope (§6). | 4.5 |
| admonition **note** = `accent` / mix(accent 12%, bg) | accent=p5 | Title text (`content.css:336`) on tinted bg (`content.css:332`). Semibold `text-small` (16px) — normal-text territory, full 4.5. | 4.5 |
| admonition **tip** = `success` / mix(success 12%, bg) | success=p2 | Title (`content.css:352`) on tint (`content.css:348`). | 4.5 |
| admonition **info** = `info` / mix(info 12%, bg) | info=p4 | Title (`content.css:368`) on tint (`content.css:364`). | 4.5 |
| admonition **warning** = `warning` / mix(warning 12%, bg) | warning=p3 | Title (`content.css:384`) on tint (`content.css:378`). | 4.5 |
| admonition **danger** = `danger` / mix(danger 12%, bg) | danger=p1 | Title (`content.css:400`) on tint (`content.css:394`). Also drives `caution` (`content.css:434`, reuses `--color-danger`). | 4.5 |
| admonition **important** = **raw `p5`** / mix(p5 12%, bg) | palette slot **5** | Title reads raw `--color-p5`, NOT `semantic.accent` (`content.css:417`, tint `content.css:412`). **Fix at slot 5** — see §2. | 4.5 |
| `selectionFg` / `selectionBg` | fg / bg fallbacks | Selected text (`src/styles/global.css:326-328`, `::selection`). | 4.5 |
| `matchedKeywordFg` / `matchedKeywordBg` | fg=p15, bg=p3 | Search/find `<mark>` text (`global.css:362-363`, `.find-match`). | 4.5 |
| `chatUserText` / `chatUserBg` | text=p9, bg=p5 | Chat user bubble text (`…/ai-chat-modal/index.tsx:41`). | 4.5 |
| `chatAssistantText` / `chatAssistantBg` | text=p11, bg=p9 | Chat assistant bubble text (`…/ai-chat-modal/index.tsx:46`). | 4.5 |

### Tier 2 — graphics / UI, ≥ 3.0:1 (mermaid text keeps 4.5)

| Pair | Default slots | Why this tier | Threshold |
|---|---|---|---|
| `mermaidText` / `mermaidNodeBg` | text=p11, nodeBg=p9 | **Text inside diagram nodes** — text floor applies. | 4.5 |
| `mermaidText` / `mermaidLabelBg` | text=p11, labelBg=p10 | Text on edge labels — text floor. | 4.5 |
| `mermaidLine` / `bg` | line=p8 | Diagram edges/arrows = non-text graphics. | 3.0 |
| `imageOverlayFg` / `imageOverlayBg` | fg=p11, bg=p0 | Enlarge/close **icon** buttons over images (`features.css:631,684`; 80% mix) — icon glyphs, not text. | 3.0 |

**Excluded (vestigial, no CSS consumer):** `cursor` (`--zd-cursor` — no `caret-color` wiring)
and `shikiTheme` (highlighting is syntect's, not Shiki). Do not audit or tweak these.

**No pair was downgraded from the S1 spec.** Every Tier-1 candidate was confirmed to
render as text; `mermaidText/*` is nominally "graphics" but carries the 4.5 text floor
because it labels nodes. If a future audit finds a Tier-1 pair that provably never renders
as text in this product, downgrade it *with the file:line proof inline* — not on a hunch.

---

## 2. Tweak methodology

Adjust the failing color, not the pipeline. Work per scheme, per failing pair.

### 2.1 OKLCH hue-preserving minimal move

1. Parse the failing color to OKLCH (comment already carries the hex; `culori` `oklch()`).
2. **Keep hue (H) fixed.** Move **lightness (L)** in the direction that raises contrast —
   *lighten* against a dark bg, *darken* against a light bg — by the **smallest** step that
   clears the threshold (search in ~0.002 L increments). This preserves scheme character.
3. **Reduce chroma (C) only** if the L move gamut-clips in sRGB (culori returns
   out-of-gamut components). Never reduce C preemptively — desaturating dulls the theme.
4. Re-resolve and confirm the pair (and every *other* pair the same slot feeds — one slot
   often drives multiple pairs).

### 2.2 Semantic-override-first — WITH the raw-p5 exception

Prefer fixing via a `semantic.X` override so **raw palettes stay untouched** (zdtp swatches
and `p*` utilities keep upstream values). E.g. a failing `success` admonition → add/adjust
`semantic: { success: "oklch(…)" }`, leaving `palette[2]` alone.

**The one hard exception — accent / p5.** `.admonition-important` reads **raw `--color-p5`**
(`content.css:411-417`), so accent/p5 failures MUST be fixed at **palette slot 5 itself**.
A `semantic.accent` override alone ships a still-failing `important` admonition.

- **Two constraints ride on slot 5:** `accent`/bg (link, 4.5, when `accent` is the p5
  default) and `important`-title raw-p5 on `mix(p5 12%, bg)` (4.5). Fix slot 5 to the
  **stricter** of the two. The 12%-tint bg sits *closer* to p5 than pure bg, so the
  `important` pair is usually the tighter constraint.
- **Worked example (Nord):** `p5 = #b48ead` → accent/bg = 4.41 (fails), important-title =
  3.66 (fails, binding). Lighten L 0.692 → 0.760 (ΔL +0.068), C/H fixed → `#caa3c3`:
  accent/bg = 5.67, important = 4.55. One slot-5 move satisfies both.
- If a scheme **overrides** `semantic.accent` to a non-p5 value, that override still needs
  its own accent/bg fix **and** slot 5 must independently pass the `important` pair.

**The raw-p5 `important` admonition is the ONLY raw-palette render path in the product.**
Verified by grepping `--color-p[0-9]` / `text-p[0-9]` across `packages/zudo-doc/src`,
`src/styles`, `src/components`, `pages`: the only other raw `p*` renders are the deliberate
swatch demo in `reference/color.mdx` (documented exception, §6). If you find a new
raw-palette render path while grepping, document it here and fix at the palette slot.

### 2.3 Comment format — required on every tweaked value

```
/* upstream #xxxxxx → L+0.NN for AA (scheme-a11y #2489) */
```

Use the real upstream hex and the actual signed ΔL (e.g. `L+0.07`, `L-0.05`; add
`, C-0.0N` when you also clipped chroma). This mirrors the existing #2298 comment style in
`color-schemes.ts` (`… — darkened for WCAG AA (#2298)`). Keep the hex so the audit and
future readers can see the origin.

### 2.4 Allowlist = last resort

Only for a pair **provably not user-visible in this product**, with a one-line
justification naming *why it never renders*. **"Upstream fidelity" / "palette intrinsic"
is no longer acceptable** — those pre-existing reasons must be replaced by a real tweak or
a genuine not-rendered justification. Default to tweaking.

---

## 3. The `muted` dual-role DECISION

`muted` is **both** secondary text (4.5 floor — blockquote body, footer, TOC, pager;
citations in §1) **and** borders (`border-muted`: table borders `content.css:197,215,229`;
admonition left border `content.css:284`; blockquote `border-l-[3px]`
`content-blockquote.tsx:11`; ~20 component `border-muted` sites). Raising `muted` to the
text floor also lightens those borders.

### DECISION: raise `muted` to 4.5 — accept the marginally crisper borders. Do NOT split a border token.

**Computed impact** (WCAG math, OKLCH L-only move, H/C fixed):

| Scheme | bg | muted now | muted/bg | Fix | muted/bg after |
|---|---|---|---|---|---|
| Dracula | `#282a36` | `#86878b` | 3.97 (FAIL) | L 0.624→0.656 (+0.032) → `#909195` | 4.52 |
| Nord | `#2e3440` | `#8c929e` | 4.00 (FAIL) | L 0.659→0.691 (+0.032) → `#969ca8` | 4.53 |
| Catppuccin Mocha | `#1e1e2e` | `#787d94` | 4.03 (FAIL) | L 0.594→0.623 (+0.029) → `#81869d` | 4.55 |
| Solarized Light | `#fdf6e3` | `#002b36` (=p8, dark) | 13.92 (PASS) | none | — |

**Reasoning:**

1. **The floor is forced regardless of borders.** `muted` unambiguously renders as
   body-level secondary text (blockquote body copy, footer, TOC links). Leaving it below
   4.5 ships unreadable secondary text — so the move is not optional.
2. **The border side effect is negligible.** Failing dark schemes sit at ~3.97–4.03 and
   need only ~+0.03 L; border contrast rises ~0.5 ratio points (e.g. 3.97→4.52) on 1–4px
   lines — imperceptibly crisper, not "heavier" (weight/thickness is unchanged). Light
   schemes whose `muted` is a dark slot (Solarized Light) already pass and need no move.
3. **Splitting a border token is disproportionate churn.** A new `--zd-border` would ripple
   through the package API (`SEMANTIC_DEFAULTS`, `SEMANTIC_CSS_NAMES`,
   `resolveSemanticColors`, `schemeToCssPairs` in `color-scheme-utils.ts`), both
   `global.css` `@theme` blocks, every `border-muted` site in `content.css` / `features.css`
   / ~20 components, the `create-zudo-doc` templates, e2e fixtures, and `settings.ts` — the
   exact cross-surface change this epic is scoped to avoid, for ~0.5 ratio points of border
   crispness.

**Batch agents:** fix `muted` failures by lightening/darkening `muted` (via
`semantic.muted`, since muted is a semantic slot, unless the scheme leaves it as the p8
default in which case adjust p8 — check whether p8 also feeds anything else first) to the
4.5 floor. Do not add a border token.

---

## 4. Verification workflow

1. **Audit (primary, all 52 schemes):**
   ```sh
   pnpm contrast:audit          # per-scheme table: pair, resolved colors, ratio, PASS/FAIL
   pnpm contrast:audit --html   # self-contained visual preview (gitignored out dir)
   ```

   The audit tool (S1, #2490) derives every color via the package resolvers and mirrors the
   real `content.css` construction (12% srgb mix; `important` title = raw p5), so its ratios
   match the DOM. Open the `--html` preview to eyeball tinted admonitions, links, muted
   text, chat bubbles, selection, `<mark>`, and mermaid samples with their computed ratios.
2. **Unit guard:**
   ```sh
   pnpm test:unit   # runs src/config/__tests__/contrast.test.ts (full matrix after S3/#2492)
   ```

   Must be green with the allowlist burned down. A stale allowlist key (never consulted)
   fails the integrity test — remove keys as you fix their schemes.
3. **Live computed check (`/verify-ui`-style):** before verifying colors on the running
   doc, **clear persisted zdtp state** or it overrides scheme values and you'll verify the
   wrong colors. In devtools console:

   ```js
   Object.keys(localStorage).filter(k => k.startsWith('zudo-doc-tweak')).forEach(k => localStorage.removeItem(k)); location.reload();
   ```

   (Clears `zudo-doc-tweak-state-v3` / `-v2` / v1 — the persisted tweak envelope.) Then read
   computed `color` / `background-color` on real elements (a link, blockquote, an admonition
   title, `<mark>`). Note: worktree agents do **not** run dev servers/browsers — this step
   is for the S8 confirm sweep and manual checks, not the batch tweak edits.

---

## 5. New-scheme checklist

Before a contributed scheme merges, it must:

- [ ] Follow the palette index convention (p1=danger, p2=success, p3=warning, p4=info,
      p5=accent, p8=muted, p9=bg, p10=surface, p11=text; see `color-schemes.ts` header).
- [ ] Pass **every Tier-1 pair at ≥ 4.5** and **every Tier-2 pair at its floor** (§1) via
      `pnpm contrast:audit` — zero new allowlist entries.
- [ ] Have accent/p5 fixed **at palette slot 5** if the `important` admonition or a p5-based
      link fails (§2.2), not via a `semantic.accent` override alone.
- [ ] Carry a `/* upstream … → L±0.NN for AA (scheme-a11y #2489) */` comment on every
      value moved from its upstream origin.
- [ ] Keep OKLCH hue fixed on all tweaks; chroma reduced only where noted for gamut.
- [ ] If it's a Default scheme edit, mirror into
      `packages/create-zudo-doc/templates/base/src/config/color-schemes.ts`
      (`pnpm check:template-drift`). Presets are NOT templated — no mirror needed.
- [ ] NOT touch e2e fixtures.

---

## 6. Documented exceptions & scope

- **Syntax highlighting is out of scope.** `--shiki-*` code-token colors (base16-ocean,
  configured in `zfb.config.ts`) are scheme-independent and set by syntect, not by these
  schemes. `codeFg`/`codeBg` governs inline code and code-block **base text** only — do not
  try to reach syntax token colors from here.
- **`reference/color.mdx` raw swatches are deliberate.** The palette demo renders
  `text-p1..p4` and `bg-p0` (`src/content/docs/reference/color.mdx:241-244,316`;
  mirrored in `docs-ja/`) to *show* the raw palette. This is documentation of the palette,
  not product chrome — **an exception, not a contrast defect.** Do not tweak the page and
  do not treat these as render paths that constrain palette values.
- **Downstream persisted zdtp tweaks keep old colors.** Users who saved custom colors carry
  a persisted `zudo-doc-tweak-*` envelope that overrides scheme values; they won't see these
  fixes until they reset. Acceptable and out of scope.
- **`cursor` / `shikiTheme` are vestigial** — no CSS consumes them; excluded from the matrix.
