---
name: color-scheme-a11y
description: "WCAG-baseline contrast rules for zudo-doc's two ramp-native color schemes (Default Light, Default Dark — sharing one set of base/accent/state ramps). MUST be consulted before adding a new scheme, or editing/tweaking the shared ramps or a scheme's per-mode `map` in packages/zudo-doc/src/color-schemes-defaults/index.ts, for accessibility. Covers the finalized fg/bg pair matrix + thresholds, the OKLCH hue-preserving tweak methodology, the muted dual-role decision, the verification workflow, and the new-scheme checklist. Triggered by 'color scheme', 'contrast', 'WCAG', 'a11y color', 'ramp tweak', 'scheme accessibility'."
---

# Color-Scheme Accessibility Rules (scheme-a11y, epic #2489; re-grounded for the Color Ramp Restructure #2584/#2602)

**IMPORTANT — this is the executable spec.** An agent tweaking a ramp or a scheme's `map`
must be able to produce correct edits from **this document + `pnpm contrast:audit` output
alone**. Every rule here is concrete. When in doubt, the AA text floor wins.

zudo-doc ships **two color schemes** — `Default Light` and `Default Dark` — defined in
`packages/zudo-doc/src/color-schemes-defaults/index.ts` (package-owned since the
minimal-scaffold cutover, epic zudolab/zudo-doc#2651, Wave 6 #2661 — the former host copy,
`src/config/color-schemes.ts`, was byte-identical to this and deleted; both the showcase and
every `create-zudo-doc` project ride this package default unless they pass a `colorSchemes`
override to `zudoDoc({...})`). A `ColorScheme` is `{ ramps, map }`: both schemes **share**
one set of Tier-1 ramps (`base` — 5 stops, `accent` — 3 stops, `state` — 4 named colors:
`danger`/`success`/`warning`/`info`) and differ only in their per-mode `map` (which ramp
stop, or literal OKLCH override, each of the 4 base roles + 23 semantic roles points at).
**This file is the single canonical color surface** — do NOT touch e2e fixtures
(`e2e/fixtures/*/src/config/…`), which carry unguarded hex copies by design.

<Note>

**History.** An earlier iteration of this project (epic #2489/#2510) shipped 52 schemes —
the 2 defaults above plus **50 ghostty-sourced ANSI terminal presets** in a since-deleted
`src/config/color-tweak-presets.ts`, loaded live via a zdtp "Scheme…" dropdown. The Color
Ramp Restructure (epic #2584, minimized in #2602) **deleted the preset file and the
dropdown** — the ramps themselves are now the editable surface, via zdtp's **Palette** tab
curve editor. Most of this skill's original content concerned deriving `semantic`
overrides for those 50 ANSI-convention presets (`p8`–`p15` bright-variant mismatches); that
recipe no longer applies to anything currently in the codebase and has been removed below.
What remains is the contrast-pair matrix and OKLCH tuning methodology, re-grounded in the
2 current schemes.

</Note>

Both schemes currently **pass the full matrix with an empty allowlist** (`pnpm
contrast:audit` → 25/25 pairs PASS for each). Keep it that way: a new allowlist entry is a
last resort, not a starting point (§2.3).

---

## 1. The pair matrix + thresholds

How a color renders decides its threshold: **text ≥ 4.5:1 (AA normal text), non-text
graphics/UI ≥ 3.0:1 (WCAG 1.4.11).** Every pair below was verified to render as **text**
somewhere in the product — evidence cited. AA text floors are **non-negotiable**; a pair
drops to Tier 2 only with proof it never renders as text.

The matrix is data-driven and lives in `scripts/contrast-pair-matrix.ts`
(`PAIR_MATRIX`/`evaluateScheme`) — shared by `scripts/contrast-audit.ts` (the CLI),
`scripts/contrast-suggest.ts` (--suggest derivation), and
`src/config/__tests__/contrast.test.ts` (the vitest guard) so this skill, the audit tool,
and the test can never drift. Resolve every pair through the package resolvers
(`resolveSemanticColors` / `schemeToCssPairs` in `@takazudo/zudo-doc/color-scheme-utils`)
— the same path production uses. Admonition backgrounds are
`color-mix(in srgb, <color> 12%, var(--color-bg))` (`packages/zudo-doc/src/content.css`).

The **"Default ramp ref"** column is `SEMANTIC_RAMP_DEFAULTS` (`surface: { base: 4 }`,
`muted: { base: 1 }`, `accent: { accent: 1 }`, `codeBg: { base: 3 }`, `codeFg: { base: 0 }`,
…) — the Default Dark reference wiring. Default Light re-points several roles to a
different ramp stop, and several roles on **both** schemes carry a **per-mode literal
OKLCH override** instead of a ramp ref (an AA tune that only one mode needs) — see §1.1.

### Tier 1 — text, AA ≥ 4.5:1

| Pair (fg / bg) | Default ramp ref | Renders as text — evidence | Threshold |
|---|---|---|---|
| `fg` / `bg` | fg=`{base:0}`, bg=`{base:4}` | Body copy; `--zd-fg` on `--zd-bg`. `schemeToCssPairs` → `--zd-fg`/`--zd-bg`. | 4.5 |
| `fg` / `surface` | surface=`{base:4}` (= `bg`) | Text on elevated panels: footer `bg-surface` (`packages/zudo-doc/src/footer/footer.tsx:89`), toolbar `bg-surface` (`…/doclayout/doc-layout-with-defaults.tsx:367`), dropdown/dialog panels (`…/i18n-version/version-switcher.tsx:216`, `…/island-types/index.ts:78`). | 4.5 |
| `muted` / `bg` | muted=`{base:1}` | **Secondary body text** — blockquote body `text-muted italic` (`…/content/content-blockquote.tsx:11`), footer text (`footer.tsx:84,116,144`), TOC inactive links (`…/toc/toc.tsx:102`, `…/toc/mobile-toc.tsx:122`), doc-pager labels (`…/doc-pager/index.tsx:59`), `li::marker` (`content.css:163`), code-block title (`features.css:228`). Dual-role — see §3. **Multi-bg — see the three rows below (#2510).** | 4.5 |
| `muted` / `surface` | muted=`{base:1}`, surface=`{base:4}` | Muted text on the **elevated surface** chrome: footer link/tag columns `text-muted` on the `<footer bg-surface>` (`footer.tsx:89` + `:116,:144`), toolbar (`…/doclayout/doc-layout-with-defaults.tsx:367`), doc-history trigger (`…/doc-history/index.tsx:561`), html-preview toolbar labels (`…/html-preview-wrapper/preview-base.tsx:142,161`). Added #2510. | 4.5 |
| `muted` / `codeBg` | muted=`{base:1}`, codeBg=`{base:3}` | `.code-block-title` — `color: var(--color-muted)` on `background: var(--color-code-bg)` (`features.css:225-229`). Added #2510. | 4.5 |
| `muted` / `chatAssistantBg` | muted=`{base:1}`, chatAssistantBg=`{base:4}` | ai-chat loading bubble — `text-muted` on `bg-chat-assistant-bg` (`…/ai-chat-modal/index.tsx:210-215`, "Thinking…"). Added #2510. | 4.5 |
| `accent` / `bg` | accent=`{accent:1}` | **Links are body text** — `text-accent underline` (`…/content/content-link.tsx:41`), heading hash-link `#` (`content.css:131`), footnote/UI links (`features.css:507`). **Raised 3.0→4.5** (epic). | 4.5 |
| `accent` / `surface` | accent=`{accent:1}`, surface=`{base:4}` | Accent text on the **elevated surface** chrome: footer copyright links `[&_a]:text-accent` on `<footer bg-surface>` (`footer.tsx:84-85,89`), footer link `hover:text-accent` (`footer.tsx:116,144`), `<summary bg-surface … hover:text-accent>` (`…/details/details.tsx:28`), preset-generator button `text-accent bg-surface` (`src/components/preset-generator.tsx:792`). Added #2510. | 4.5 |
| `accentHover` / `bg` | accentHover=`{accent:0}` | Link hover text — `hover:text-accent-hover` (`content-link.tsx:41`, `features.css:512`). | 4.5 |
| `codeFg` / `codeBg` | codeFg=`{base:0}`, codeBg=`{base:3}` | Inline code + code-block base text (`features.css:256-257`, `features.css:533-534`). Governs base text only — syntax tokens are out of scope (§6). | 4.5 |
| admonition **note** = `accent` / mix(accent 12%, bg) | accent=`{accent:1}` | Title text (`content.css:336`) on tinted bg (`content.css:332`). Semibold `text-small` (16px) — normal-text territory, full 4.5. | 4.5 |
| admonition **tip** = `success` / mix(success 12%, bg) | success=`{state:"success"}` | Title (`content.css:352`) on tint (`content.css:348`). | 4.5 |
| admonition **info** = `info` / mix(info 12%, bg) | info=`{state:"info"}` | Title (`content.css:368`) on tint (`content.css:364`). | 4.5 |
| admonition **warning** = `warning` / mix(warning 12%, bg) | warning=`{state:"warning"}` | Title (`content.css:384`) on tint (`content.css:378`). | 4.5 |
| admonition **danger** = `danger` / mix(danger 12%, bg) | danger=per-mode literal (see §1.1) | Title (`content.css:400`) on tint (`content.css:394`). Also drives `caution` (`content.css:434`, reuses `--color-danger`). | 4.5 |
| admonition **important** = `accent` / mix(accent 12%, bg) | accent=`{accent:1}` | Title reads **semantic `--color-accent`** (`content.css:411-417`, tint `content.css:412`) — NOT a raw ramp stop. Unlike the pre-restructure model, there is no raw-palette render path here anymore; see §2. | 4.5 |
| `selectionFg` / `selectionBg` | fg/bg fallbacks | Selected text (`src/styles/global.css:326-328`, `::selection`). | 4.5 |
| `matchedKeywordFg` / `matchedKeywordBg` | both shared literals (see §1.1) | Search/find `<mark>` text (`global.css:362-363`, `.find-match`). | 4.5 |
| `chatUserText` / `chatUserBg` | text=`{base:4}`, bg=`{accent:1}` | Chat user bubble text (`…/ai-chat-modal/index.tsx:41`). | 4.5 |
| `chatAssistantText` / `chatAssistantBg` | text=`{base:0}`, bg=`{base:4}` (= `bg`) | Chat assistant bubble text (`…/ai-chat-modal/index.tsx:46`). | 4.5 |

### Tier 2 — graphics / UI, ≥ 3.0:1 (mermaid text keeps 4.5)

| Pair | Default ramp ref | Why this tier | Threshold |
|---|---|---|---|
| `mermaidText` / `mermaidNodeBg` | text=`{base:0}`, nodeBg=`{base:3}` | **Text inside diagram nodes** — text floor applies. | 4.5 |
| `mermaidText` / `mermaidLabelBg` | text=`{base:0}`, labelBg=`{base:3}` | Text on edge labels — text floor. | 4.5 |
| `mermaidText` / `mermaidNoteBg` | text=`{base:0}`, noteBg=`{base:2}` | **Text inside diagram note boxes.** `mermaid-init-script.ts:346-347` maps `--zd-mermaid-note-bg`→`noteBkgColor`, `--zd-mermaid-text`→`noteTextColor`. Text floor. | 4.5 |
| `mermaidLine` / `bg` | line=`{base:1}` | Diagram edges/arrows = non-text graphics. | 3.0 |
| `imageOverlayFg` / `imageOverlayBg` | fg=`{base:0}`, bg=`{base:4}` (= `bg`) | Enlarge/close **icon** buttons over images (`features.css:631,684`; 80% mix) — icon glyphs, not text. | 3.0 |

**Excluded (vestigial, no CSS consumer):** `shikiTheme` (highlighting is syntect's, not
Shiki). `cursor` is not vestigial — it was **deleted** in the ramp restructure (no
`--zd-cursor` exists at all). Neither is audited or tweaked.

**No pair was downgraded from the S1 spec.** `mermaidText/*` is nominally "graphics" but
carries the 4.5 text floor because it labels nodes. If a future audit finds a Tier-1 pair
that provably never renders as text in this product, downgrade it *with the file:line
proof inline* — not on a hunch.

### 1.1 Per-mode literal overrides (not a shared ramp ref)

A handful of roles can't be satisfied by a shared ramp stop in both modes — the accent and
state ramps are authored against a **dark** background, so several need a darker literal on
light mode to clear AA:

- **Default Dark**: `danger` = `oklch(.655 .170 25)` — a per-mode AA tune slightly lighter
  than the shared `state.danger` (`oklch(.640 .170 25)`), so the danger-admonition title
  clears AA on its dark-mode 12%-tint background.
- **Default Light**: `accentHover`, `success`, `danger`, `warning`, `info` are all per-mode
  literals (darkened versions of the shared ramp/state colors) to clear AA on the
  near-white page background.
- **Both modes**: `matchedKeywordBg` / `matchedKeywordFg` are shared literals (not ramp
  refs) — the amber search-highlight is deliberately identical in both modes.

These are documented per-value in `packages/zudo-doc/src/color-schemes-defaults/index.ts`
(search for "per-mode AA-tuned literal" / "carried from #2593"/"#2595"). When retuning one, keep it a literal
(don't try to force it back onto a shared ramp stop) unless the retune is meant to move the
*shared* ramp value for both modes at once.

---

## 2. Tweak methodology

Adjust the failing color **in the data file**, not the pipeline. Work per scheme, per
failing pair.

> **Fix everything data-side. Do NOT change `SEMANTIC_RAMP_DEFAULTS` or any code in
> `packages/zudo-doc/src/color-scheme-utils.ts`.** Both schemes rely on the current
> mapping, and a mechanism change ripples to every downstream consumer of the package.
> Every fix here is a per-scheme edit to `map.semantic` (or, for a change that should apply
> to both modes at once, a shared `ramps.base`/`ramps.accent`/`ramps.state` stop) in
> `packages/zudo-doc/src/color-schemes-defaults/index.ts`.

### 2.1 OKLCH hue-preserving minimal move

1. Parse the failing color to OKLCH (`culori` `oklch()`).
2. **Keep hue (H) fixed.** Move **lightness (L)** in the direction that raises contrast —
   *lighten* against a dark bg, *darken* against a light bg — by the **smallest** step that
   clears the threshold (search in ~0.002 L increments). This preserves scheme character.
3. **Reduce chroma (C) only** if the L move gamut-clips in sRGB (culori returns
   out-of-gamut components). Never reduce C preemptively — desaturating dulls the theme.
4. Re-resolve and confirm the pair (and every *other* pair the same ramp stop or literal
   feeds — one stop often drives multiple pairs, and moving a **shared ramp stop** affects
   both schemes at once, not just the one you're fixing).

**Never tune to the exact floor — target `threshold + 0.1` headroom.** Live-browser
verification of the original epic (#2489, S8) found colors tuned to EXACTLY the WCAG floor
(e.g. 4.51:1) rendering at 4.47-4.50:1 in the real DOM: browser `color-mix(in srgb, X 12%,
bg)` compositing and 8-bit sRGB quantization eat up to ~0.03-0.05 of ratio between the
computed math and what the page actually paints. The suggest engine
(`scripts/contrast-suggest.ts`, `HEADROOM = 0.1`) targets `threshold + 0.1` by default for
every nudge — a hand-tune should do the same (hard minimum `threshold + 0.05` if
gamut-clipping genuinely prevents the full 0.1; note it when that happens). The PASS/FAIL
floors themselves (4.5 / 3.0, in `contrast-pair-matrix.ts` and the vitest guard) stay at
the raw WCAG thresholds — headroom is a tuning target, not a new floor.

### 2.2 (retired) ANSI-palette preset recipe

The former §2.2 covered deriving `semantic` overrides for the 50 ghostty ANSI-terminal
presets, whose `p8`–`p15` "bright variant" convention broke the project's palette-index
assumptions. Those presets and the palette-index model are both gone (see the History note
above) — this recipe no longer applies to anything in the codebase and has been removed.

### 2.3 Semantic-override-first — no raw-ramp render path remains

Fix a failing pair via a `map.semantic.<role>` override (either a different `RampRef` or a
literal OKLCH string). **There is no raw-ramp render path left in the product** to work
around: the pre-restructure `important` admonition read a raw palette slot (`--color-p5`)
directly, bypassing the semantic layer — that was the ONE such path, and it's gone. The
`important` admonition now reads `var(--color-accent)` like every other role
(`packages/zudo-doc/src/content.css:409-417`). So every fix here is a normal semantic
(or shared-ramp) edit — there is no special "fix at the raw slot" case to remember.

If you ever find a NEW component that reads a raw `--palette-*` custom property directly
(bypassing the semantic `--zd-*` layer), treat that as a design smell worth flagging, not a
pattern to replicate — see [Reaching a raw ramp stop](../../reference/color.mdx#reaching-a-raw-ramp-stop-rare)
in the Color reference doc.

### 2.4 Comment format — required on every tweaked value

```
/* per-mode AA-tuned literal — <why> (scheme-a11y #2489) */
```

State *why* the value is a literal (which pair it clears, and against which background) so
a future reader doesn't try to collapse it back onto a shared ramp stop. This mirrors the
comment style already in `color-schemes-defaults/index.ts` (e.g. "carried from #2593",
"carried from #2595").

### 2.5 Allowlist = last resort

Only for a pair **provably not user-visible in this product**, with a one-line
justification naming *why it never renders*. "Upstream fidelity" / "palette intrinsic" is
**not** an acceptable reason — tweak the color instead. Both `ALLOWLIST` and
`ADMONITION_ALLOWLIST` in `src/config/__tests__/contrast.test.ts` are currently **empty**
— both schemes clear the full matrix outright. Keep it that way; default to tweaking.

---

## 3. The `muted` dual-role DECISION

`muted` is **both** secondary text (4.5 floor — blockquote body, footer, TOC, pager;
citations in §1) **and** borders (`border-muted`: table borders `content.css:197,215,229`;
admonition left border `content.css:284`; blockquote `border-l-[3px]`
`content-blockquote.tsx:11`; ~20 component `border-muted` sites). Raising `muted` to the
text floor also lightens those borders.

### DECISION: raise `muted` to 4.5 — accept the marginally crisper borders. Do NOT split a border token.

This decision was made and applied during the original epic and carries forward unchanged
through the ramp restructure — both current schemes already clear `muted`-vs-`bg` (Default
Dark 7.10:1, Default Light 5.91:1 — `pnpm contrast:audit`).

**Reasoning:**

1. **The floor is forced regardless of borders.** `muted` unambiguously renders as
   body-level secondary text (blockquote body copy, footer, TOC links). Leaving it below
   4.5 ships unreadable secondary text — so the move is not optional.
2. **The border side effect is negligible.** A `muted` tuned to just clear 4.5 raises
   border contrast by well under a ratio point on 1–4px lines — imperceptibly crisper, not
   "heavier" (weight/thickness is unchanged).
3. **Splitting a border token is disproportionate churn.** A new `--zd-border` would ripple
   through the package API (`SEMANTIC_KEYS`, `SEMANTIC_CSS_NAMES`, `resolveSemanticColors`,
   `schemeToCssPairs` in `color-scheme-utils.ts`), both `global.css` `@theme` blocks, every
   `border-muted` site in `content.css` / `features.css` / ~20 components, the
   `create-zudo-doc` templates, e2e fixtures, and `settings.ts` — for a fraction of a ratio
   point of border crispness.

**If a future scheme's `muted` fails:** fix by lightening/darkening `muted` (via
`map.semantic.muted`, or moving the shared `base` stop it points at — check whether that
stop also feeds anything else first) to the 4.5 floor. Do not add a border token.

### `muted` has MULTIPLE background constraints (#2510) — clear the WORST one

`muted` does not render on the page `bg` alone. It is also secondary text on the elevated
backgrounds **`surface`** (footer/toolbar/dropdown chrome), **`codeBg`** (`.code-block-title`),
and **`chatAssistantBg`** (ai-chat loading bubble) — see the four `muted`/`accent` rows in
§1. **One `muted` value must clear ALL of its backgrounds at threshold+0.1**, so tune it
against its *worst-contrast* background, not just page bg.

In the current ramp model, `surface` and `chatAssistantBg` are **merged onto `bg`** in both
schemes (role-merge philosophy — see the Color reference doc), so `muted`'s worst-case
background is effectively `min(bg, codeBg)`. `codeBg` sits on its own ramp stop
(`{base:3}` dark / `{base:0}` light) close to `bg`, so a `muted` tuned to clear `bg` needs
only a small extra nudge, if any, to also clear `codeBg` — `contrast-suggest.ts` computes
the `min` over these backgrounds automatically.

---

## 4. Verification workflow

1. **Audit (primary, both schemes):**
   ```sh
   pnpm contrast:audit          # per-scheme table: pair, resolved colors, ratio, PASS/FAIL
   pnpm contrast:audit --html   # self-contained visual preview (gitignored out dir)
   ```

   The audit tool derives every color via the package resolvers and mirrors the real
   `content.css` construction (12% srgb mix), so its ratios match the DOM. Open the
   `--html` preview to eyeball tinted admonitions, links, muted text, chat bubbles,
   selection, `<mark>`, and mermaid samples with their computed ratios.

   **Current state:** both `Default Light` and `Default Dark` pass all 25 pairs
   (`pnpm contrast:audit` → `25/25 pairs pass` for each, 50 checks total, zero allowlist
   entries).
2. **Unit guard:**
   ```sh
   pnpm test:unit   # runs src/config/__tests__/contrast.test.ts (full matrix)
   ```

   Must be green with empty allowlists. A stale allowlist key (never consulted) fails the
   integrity test — remove keys as you fix their schemes.
3. **Live computed check (`/verify-ui`-style):** before verifying colors on the running
   doc, **clear persisted zdtp state** or it overrides scheme values and you'll verify the
   wrong colors. In devtools console:

   ```js
   Object.keys(localStorage).filter(k => k.startsWith('zudo-doc-tweak')).forEach(k => localStorage.removeItem(k)); location.reload();
   ```

   (Clears `zudo-doc-tweak-state-v3` / `-v2` / v1 — the persisted tweak envelope.) Then read
   computed `color` / `background-color` on real elements (a link, blockquote, an admonition
   title, `<mark>`). Note: worktree agents do **not** run dev servers/browsers — this step
   is for manual/live confirm sweeps, not batch tweak edits.

---

## 5. New-scheme checklist

Before adding a new entry to `colorSchemes` in
`packages/zudo-doc/src/color-schemes-defaults/index.ts`, it must:

- [ ] Define its own `ramps` (or explicitly reuse an existing `Ramps` object, as Default
      Light/Dark do) and a `map` covering the 4 base roles + all 23 semantic roles — spread
      `SEMANTIC_RAMP_DEFAULTS` and override only what needs to differ (see the Color
      reference doc's "Adding a Custom Color Scheme" section).
- [ ] Pass **every Tier-1 pair at ≥ 4.5** and **every Tier-2 pair at its floor** (§1) via
      `pnpm contrast:audit` — zero new allowlist entries.
- [ ] Use a per-mode **literal OKLCH override** (not a ramp ref) for any role that can't
      clear AA at any of its ramp's existing stops (§1.1) — document why with the §2.4
      comment format.
- [ ] Keep OKLCH hue fixed on all tweaks; reduce chroma only where noted for gamut.
- [ ] No template-mirror step needed anymore — since the minimal-scaffold cutover (epic
      #2651), both this showcase and every `create-zudo-doc` project source `colorSchemes`
      from this SAME package file unless they pass their own `colorSchemes` override to
      `zudoDoc({...})`, so a package-side edit here reaches both automatically. If a project
      DOES carry its own `colorSchemes` override (an escape-hatch field on `ZudoDocConfig`,
      not a file), that project owns its own contrast audit independently.
- [ ] NOT touch e2e fixtures.

---

## 6. Documented exceptions & scope

- **Syntax highlighting is out of scope.** `--shiki-*` code-token colors (base16-ocean,
  configured in `zfb.config.ts`) are scheme-independent and set by syntect, not by these
  schemes. `codeFg`/`codeBg` governs inline code and code-block **base text** only — do not
  try to reach syntax token colors from here.
- **There is no raw-ramp render path to exempt.** The pre-restructure `important`
  admonition read a raw palette slot directly (`--color-p5`) and was a documented exception
  here; it now reads semantic `--color-accent` like every other role (§2.3), so this
  exception no longer applies to anything in the product.
- **Downstream persisted zdtp tweaks keep old colors.** Users who saved custom colors carry
  a persisted `zudo-doc-tweak-*` envelope that overrides scheme values; they won't see these
  fixes until they reset. Acceptable and out of scope.
- **`shikiTheme` is vestigial** — no CSS consumes it; excluded from the matrix. `cursor` is
  not vestigial-but-present — it was deleted outright in the ramp restructure (no
  `--zd-cursor` exists to audit).
