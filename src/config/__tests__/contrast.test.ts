/**
 * WCAG 2.x contrast guard for color schemes/presets — full pair matrix.
 *
 * Enforces the finalized pair matrix from
 * `.claude/skills/color-scheme-a11y/SKILL.md` §1 across all 52 schemes
 * (2 built-ins in `color-schemes.ts` + 50 presets in
 * `color-tweak-presets.ts`). The matrix itself (pairs, thresholds, which
 * `--zd-*` vars feed each pair) lives in `../../../scripts/contrast-pair-matrix.ts`
 * — shared with `scripts/contrast-audit.ts` (the `pnpm contrast:audit` CLI) so
 * this guard and the audit tool can never diverge (S3, zudolab/zudo-doc#2489).
 *
 * Admonition backgrounds are CSS color-mix(in srgb, semanticColor 12%, --color-bg).
 * Tier-1 pairs (text) require ≥ 4.5:1; Tier-2 pairs (graphics/icons) require
 * ≥ 3.0:1 unless noted otherwise in the matrix (mermaid text pairs keep 4.5).
 *
 * Built-in schemes (Default Light / Default Dark) are NOT special-cased here —
 * per the epic's Wave-3 batch plan, Default Light/Default Dark are Batch C
 * like every other scheme (see `ALLOWLIST`/`ADMONITION_ALLOWLIST` below); the
 * long-term goal (skill §4) is for both to pass clean.
 *
 * ALLOWLIST is a TEMPORARY, batch-tagged registry (epic #2489) of every pair
 * currently failing the full matrix. Every entry is tagged
 * `// TODO(scheme-a11y #2489) — remove in Batch {A|B|C|D}` and grouped into
 * four contiguous, clearly-marked batch regions so the four parallel Wave-3
 * batch PRs (#2493–#2496) touch disjoint line ranges. The reason string is
 * the currently-failing ratio/threshold — see the corresponding Wave-3 batch
 * issue for the full per-scheme inventory (colors, sources, `--suggest`
 * fragments). "Upstream fidelity" is NOT an acceptable long-term reason
 * (skill §2.5) — every entry here is scheduled for a real OKLCH tweak in its
 * batch, not permanent allowlisting.
 *
 * Allowlist entries are expected to fire — a spurious entry (key that never
 * matches a real test) is caught by the stale-key audit at the bottom of this
 * file.
 */

import { describe, it, expect } from "vitest";
import { getAllPresets, evaluateScheme } from "../../../scripts/contrast-pair-matrix";
import { relativeLuminance, contrastRatio, colorMixSrgb } from "../contrast-utils";

// ---------------------------------------------------------------------------
// ALLOWLIST — non-admonition pair failures (see file header)
// ---------------------------------------------------------------------------

/** Tracks which allowlist keys were actually consulted during the test run. */
const _allowlistHits = new Set<string>();

const ALLOWLIST: Record<string, string> = {


  // --- Batch C ---
  // Solarized Light — 13 failing pairs
  "Solarized Light:fg-vs-bg": "4.14:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:fg-vs-surface": "3.87:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:accent-vs-bg": "4.23:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:accent-hover-vs-bg": "4.07:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:code-fg-vs-code-bg": "1.21:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:selection": "2.63:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:matched-keyword": "2.98:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:chat-user": "1.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:chat-assistant": "1.03:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:mermaid-text-vs-node-bg": "1.03:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:mermaid-text-vs-label-bg": "1.21:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:mermaid-text-vs-note-bg": "2.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:image-overlay": "2.92:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // GitHub Light — 9 failing pairs
  "GitHub Light:accent-hover-vs-bg": "3.61:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:code-fg-vs-code-bg": "1.89:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:matched-keyword": "4.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:chat-user": "1.56:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:chat-assistant": "1.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:mermaid-text-vs-node-bg": "1.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:mermaid-text-vs-label-bg": "1.89:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:mermaid-text-vs-note-bg": "1.52:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:image-overlay": "1.52:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Atom One Light — 7 failing pairs
  "Atom One Light:accent-hover-vs-bg": "3.57:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Atom One Light:code-fg-vs-code-bg": "1.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Atom One Light:matched-keyword": "1.96:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Atom One Light:chat-user": "1.79:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Atom One Light:chat-assistant": "2.21:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Atom One Light:mermaid-text-vs-node-bg": "2.21:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Atom One Light:mermaid-text-vs-label-bg": "1.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Material — 7 failing pairs
  "Material:accent-hover-vs-bg": "3.89:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Material:code-fg-vs-code-bg": "1.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Material:matched-keyword": "1.58:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Material:chat-user": "2.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Material:chat-assistant": "1.75:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Material:mermaid-text-vs-node-bg": "1.75:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Material:mermaid-text-vs-label-bg": "1.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Ayu Light — 8 failing pairs
  "Ayu Light:accent-vs-bg": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:accent-hover-vs-bg": "2.77:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:code-fg-vs-code-bg": "1.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:matched-keyword": "1.33:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:chat-user": "1.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:chat-assistant": "1.50:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:mermaid-text-vs-node-bg": "1.50:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:mermaid-text-vs-label-bg": "1.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Catppuccin Latte — 12 failing pairs
  "Catppuccin Latte:muted-vs-bg": "4.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:accent-vs-bg": "4.34:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:accent-hover-vs-bg": "2.80:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:code-fg-vs-code-bg": "1.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:selection": "3.69:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:matched-keyword": "1.44:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:chat-user": "1.78:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:chat-assistant": "2.16:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:mermaid-text-vs-node-bg": "2.16:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:mermaid-text-vs-label-bg": "1.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:mermaid-text-vs-note-bg": "2.89:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:image-overlay": "2.89:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Everforest Light — 13 failing pairs
  "Everforest Light:fg-vs-surface": "4.33:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:muted-vs-bg": "3.97:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:accent-vs-bg": "3.97:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:accent-hover-vs-bg": "2.52:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:code-fg-vs-code-bg": "1.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:matched-keyword": "2.35:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:chat-user": "1.42:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:chat-assistant": "1.43:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:mermaid-text-vs-node-bg": "1.43:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:mermaid-text-vs-label-bg": "1.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:mermaid-text-vs-note-bg": "1.70:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:mermaid-line-vs-bg": "1.87:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:image-overlay": "1.70:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Gruvbox Light — 9 failing pairs
  "Gruvbox Light:muted-vs-bg": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:accent-vs-bg": "3.73:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:accent-hover-vs-bg": "4.40:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:code-fg-vs-code-bg": "1.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:chat-user": "2.04:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:chat-assistant": "2.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:mermaid-text-vs-node-bg": "2.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:mermaid-text-vs-label-bg": "1.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:mermaid-text-vs-note-bg": "3.33:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Rose Pine Dawn — 11 failing pairs
  "Rose Pine Dawn:muted-vs-bg": "3.97:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:accent-hover-vs-bg": "2.60:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:code-fg-vs-code-bg": "2.72:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:matched-keyword": "3.24:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:chat-user": "1.11:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:chat-assistant": "1.87:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:mermaid-text-vs-node-bg": "1.87:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:mermaid-text-vs-label-bg": "2.72:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:mermaid-text-vs-note-bg": "1.87:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:mermaid-line-vs-bg": "2.73:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:image-overlay": "1.87:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Dawnfox — 8 failing pairs
  "Dawnfox:accent-hover-vs-bg": "2.52:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:code-fg-vs-code-bg": "1.52:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:matched-keyword": "1.88:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:chat-user": "1.05:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:chat-assistant": "1.77:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:mermaid-text-vs-node-bg": "1.77:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:mermaid-text-vs-label-bg": "1.52:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:mermaid-text-vs-note-bg": "3.58:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Dayfox — 8 failing pairs
  "Dayfox:accent-hover-vs-bg": "3.42:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dayfox:code-fg-vs-code-bg": "1.15:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dayfox:matched-keyword": "4.47:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dayfox:chat-user": "1.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dayfox:chat-assistant": "1.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dayfox:mermaid-text-vs-node-bg": "1.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dayfox:mermaid-text-vs-label-bg": "1.15:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dayfox:mermaid-text-vs-note-bg": "3.45:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Default Light / Default Dark — 0 failing pairs (fixed directly by S3, not
  // allowlisted: built-ins must pass clean per #2495 — see color-schemes.ts)

  // --- Batch D ---
  // GitHub Dark — 9 failing pairs
  "GitHub Dark:muted-vs-bg": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark:accent-hover-vs-bg": "3.54:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark:code-fg-vs-code-bg": "1.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark:matched-keyword": "1.95:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark:chat-user": "1.33:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark:chat-assistant": "1.30:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark:mermaid-text-vs-node-bg": "1.30:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark:mermaid-text-vs-label-bg": "1.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark:mermaid-line-vs-bg": "2.21:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // GitHub Dark Dimmed — 9 failing pairs
  "GitHub Dark Dimmed:muted-vs-bg": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:code-fg-vs-code-bg": "1.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:matched-keyword": "1.97:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:chat-user": "1.33:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:chat-assistant": "1.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:mermaid-text-vs-node-bg": "1.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:mermaid-text-vs-label-bg": "1.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:mermaid-text-vs-note-bg": "3.11:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:mermaid-line-vs-bg": "2.90:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Everforest Dark — 8 failing pairs
  "Everforest Dark:code-fg-vs-code-bg": "1.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Everforest Dark:matched-keyword": "1.76:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Everforest Dark:chat-user": "1.42:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Everforest Dark:chat-assistant": "1.43:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Everforest Dark:mermaid-text-vs-node-bg": "1.43:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Everforest Dark:mermaid-text-vs-label-bg": "1.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Everforest Dark:mermaid-text-vs-note-bg": "1.70:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Everforest Dark:image-overlay": "1.70:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Kanagawa Wave — 7 failing pairs
  "Kanagawa Wave:muted-vs-bg": "4.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Wave:code-fg-vs-code-bg": "1.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Wave:matched-keyword": "1.66:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Wave:chat-user": "1.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Wave:chat-assistant": "2.65:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Wave:mermaid-text-vs-node-bg": "2.65:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Wave:mermaid-text-vs-label-bg": "1.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Kanagawa Dragon — 6 failing pairs
  "Kanagawa Dragon:code-fg-vs-code-bg": "1.55:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Dragon:matched-keyword": "1.24:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Dragon:chat-user": "1.10:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Dragon:chat-assistant": "1.91:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Dragon:mermaid-text-vs-node-bg": "1.91:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Dragon:mermaid-text-vs-label-bg": "1.55:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Rose Pine — 7 failing pairs
  "Rose Pine:muted-vs-bg": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine:code-fg-vs-code-bg": "3.18:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine:matched-keyword": "1.24:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine:chat-user": "1.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine:chat-assistant": "1.77:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine:mermaid-text-vs-node-bg": "1.77:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine:mermaid-text-vs-label-bg": "3.18:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Rose Pine Moon — 7 failing pairs
  "Rose Pine Moon:muted-vs-bg": "4.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine Moon:code-fg-vs-code-bg": "2.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine Moon:matched-keyword": "1.24:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine Moon:chat-user": "1.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine Moon:chat-assistant": "1.77:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine Moon:mermaid-text-vs-node-bg": "1.77:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Rose Pine Moon:mermaid-text-vs-label-bg": "2.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Nightfox — 8 failing pairs
  "Nightfox:muted-vs-bg": "3.99:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Nightfox:code-fg-vs-code-bg": "1.33:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Nightfox:matched-keyword": "1.40:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Nightfox:chat-user": "1.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Nightfox:chat-assistant": "2.13:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Nightfox:mermaid-text-vs-node-bg": "2.13:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Nightfox:mermaid-text-vs-label-bg": "1.33:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Nightfox:mermaid-line-vs-bg": "2.24:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Carbonfox — 8 failing pairs
  "Carbonfox:muted-vs-bg": "4.04:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Carbonfox:code-fg-vs-code-bg": "1.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Carbonfox:matched-keyword": "1.84:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Carbonfox:chat-user": "1.19:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Carbonfox:chat-assistant": "1.35:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Carbonfox:mermaid-text-vs-node-bg": "1.35:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Carbonfox:mermaid-text-vs-label-bg": "1.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Carbonfox:mermaid-line-vs-bg": "1.98:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Duskfox — 8 failing pairs
  "Duskfox:muted-vs-bg": "4.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Duskfox:code-fg-vs-code-bg": "1.12:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Duskfox:matched-keyword": "1.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Duskfox:chat-user": "1.18:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Duskfox:chat-assistant": "1.64:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Duskfox:mermaid-text-vs-node-bg": "1.64:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Duskfox:mermaid-text-vs-label-bg": "1.12:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Duskfox:mermaid-line-vs-bg": "2.09:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Ayu Dark — 7 failing pairs
  "Ayu Dark:muted-vs-bg": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Dark:code-fg-vs-code-bg": "1.07:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Dark:matched-keyword": "1.86:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Dark:chat-user": "1.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Dark:chat-assistant": "1.62:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Dark:mermaid-text-vs-node-bg": "1.62:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Dark:mermaid-text-vs-label-bg": "1.07:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Ayu Mirage — 8 failing pairs
  "Ayu Mirage:muted-vs-bg": "3.98:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Mirage:code-fg-vs-code-bg": "1.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Mirage:matched-keyword": "1.51:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Mirage:chat-user": "1.45:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Mirage:chat-assistant": "1.71:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Mirage:mermaid-text-vs-node-bg": "1.71:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Mirage:mermaid-text-vs-label-bg": "1.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Ayu Mirage:mermaid-line-vs-bg": "2.78:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Poimandres — 7 failing pairs
  "Poimandres:code-fg-vs-code-bg": "1.47:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Poimandres:selection": "2.23:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Poimandres:matched-keyword": "1.07:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Poimandres:chat-user": "2.34:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Poimandres:chat-assistant": "3.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Poimandres:mermaid-text-vs-node-bg": "3.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Poimandres:mermaid-text-vs-label-bg": "1.47:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
};

// ---------------------------------------------------------------------------
// ADMONITION_ALLOWLIST — admonition-title pair failures (see file header)
// ---------------------------------------------------------------------------

const ADMONITION_ALLOWLIST: Record<string, string> = {


  // --- Batch C ---
  // Solarized Light — 6 failing pairs
  "Solarized Light:admonition-accent": "3.58:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:admonition-success": "2.66:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:admonition-warning": "2.65:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:admonition-info": "2.98:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:admonition-danger": "3.63:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Solarized Light:admonition-important": "3.58:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // GitHub Light — 4 failing pairs
  "GitHub Light:admonition-accent": "4.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:admonition-info": "4.38:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:admonition-danger": "4.43:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "GitHub Light:admonition-important": "4.29:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Atom One Light — 4 failing pairs
  "Atom One Light:admonition-success": "3.13:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Atom One Light:admonition-warning": "1.74:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Atom One Light:admonition-info": "4.36:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Atom One Light:admonition-danger": "3.50:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Material — 2 failing pairs
  "Material:admonition-success": "3.69:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Material:admonition-warning": "1.71:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Ayu Light — 6 failing pairs
  "Ayu Light:admonition-accent": "3.50:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:admonition-success": "1.99:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:admonition-warning": "1.80:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:admonition-info": "2.62:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:admonition-danger": "2.57:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Ayu Light:admonition-important": "3.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Catppuccin Latte — 6 failing pairs
  "Catppuccin Latte:admonition-accent": "3.70:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:admonition-success": "2.62:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:admonition-warning": "2.10:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:admonition-info": "3.70:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:admonition-danger": "3.95:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Catppuccin Latte:admonition-important": "2.11:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Everforest Light — 6 failing pairs
  "Everforest Light:admonition-accent": "3.48:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:admonition-success": "1.79:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:admonition-warning": "1.87:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:admonition-info": "1.69:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:admonition-danger": "2.08:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Everforest Light:admonition-important": "1.79:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Gruvbox Light — 6 failing pairs
  "Gruvbox Light:admonition-accent": "3.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:admonition-success": "2.46:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:admonition-warning": "2.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:admonition-info": "3.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:admonition-danger": "4.04:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Gruvbox Light:admonition-important": "3.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Rose Pine Dawn — 4 failing pairs
  "Rose Pine Dawn:admonition-warning": "1.90:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:admonition-info": "2.79:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:admonition-danger": "3.36:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Rose Pine Dawn:admonition-important": "3.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Dawnfox — 4 failing pairs
  "Dawnfox:admonition-success": "3.24:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:admonition-warning": "1.90:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:admonition-danger": "3.36:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  "Dawnfox:admonition-important": "3.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C
  // Dayfox — 1 failing pair
  "Dayfox:admonition-warning": "3.99:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch C

  // --- Batch D ---
  // GitHub Dark Dimmed — 6 failing pairs
  "GitHub Dark Dimmed:admonition-accent": "4.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:admonition-success": "4.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:admonition-warning": "4.40:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:admonition-info": "4.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:admonition-danger": "4.44:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "GitHub Dark Dimmed:admonition-important": "4.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Kanagawa Wave — 4 failing pairs
  "Kanagawa Wave:admonition-accent": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Wave:admonition-success": "4.11:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Wave:admonition-danger": "2.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Kanagawa Wave:admonition-important": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Kanagawa Dragon — 1 failing pair
  "Kanagawa Dragon:admonition-danger": "4.50:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Rose Pine — 1 failing pair
  "Rose Pine:admonition-success": "3.05:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Rose Pine Moon — 1 failing pair
  "Rose Pine Moon:admonition-success": "3.70:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Nightfox — 3 failing pairs
  "Nightfox:admonition-accent": "3.95:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Nightfox:admonition-danger": "3.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  "Nightfox:admonition-important": "3.95:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Duskfox — 1 failing pair
  "Duskfox:admonition-info": "4.41:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
  // Poimandres — 1 failing pair
  "Poimandres:admonition-danger": "4.17:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch D
};

// ---------------------------------------------------------------------------
// Unit assertions: luminance / contrast math handles oklch strings
// ---------------------------------------------------------------------------

describe("luminance math — CSS color parsing", () => {
  it("oklch(0 0 0) parses as black (luminance ≈ 0)", () => {
    expect(relativeLuminance("oklch(0 0 0)")).toBeCloseTo(0, 5);
  });

  it("oklch(1 0 0) parses as white (luminance ≈ 1)", () => {
    expect(relativeLuminance("oklch(1 0 0)")).toBeCloseTo(1, 5);
  });

  it("black vs white contrast ≈ 21:1", () => {
    expect(contrastRatio("oklch(0 0 0)", "oklch(1 0 0)")).toBeCloseTo(21, 0);
  });

  it("mid-tone oklch(0.5 0.05 250) parses to a valid luminance in (0, 1)", () => {
    const lum = relativeLuminance("oklch(0.5 0.05 250)");
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });

  it("hex colors still parse correctly (#ffffff luminance ≈ 1)", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("hex colors still parse correctly (#000000 luminance ≈ 0)", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("colorMixSrgb returns a parseable color string", () => {
    const mixed = colorMixSrgb("oklch(1 0 0)", "oklch(0 0 0)", 50);
    // 50% mix of white and black in sRGB → near-mid-grey; luminance ≈ 0.212
    expect(relativeLuminance(mixed)).toBeCloseTo(0.212, 2);
  });
});

// ---------------------------------------------------------------------------
// Test suites — full pair matrix (S3 #2492): one `it` per (scheme, pair),
// covering every entry in PAIR_MATRIX (imported transitively via
// evaluateScheme) across all 52 schemes/presets.
// ---------------------------------------------------------------------------

describe("WCAG 2.x contrast guard — full pair matrix", () => {
  for (const { name, scheme, source } of getAllPresets()) {
    const report = evaluateScheme(name, scheme, source);

    for (const pair of report.pairs) {
      it(`"${name}" ${pair.key}`, () => {
        const isAdmonition = pair.key.startsWith("admonition-");
        const map = isAdmonition ? ADMONITION_ALLOWLIST : ALLOWLIST;
        const key = `${name}:${pair.key}`;
        if (map[key]) {
          _allowlistHits.add(key);
          return;
        }

        expect(
          pair.ratio,
          `"${name}" ${pair.label}: ${pair.fg} vs ${pair.bg}: ${pair.ratio.toFixed(2)}:1 (need ≥ ${pair.threshold}:1)`,
        ).toBeGreaterThanOrEqual(pair.threshold);
      });
    }
  }

  describe("allowlist integrity — no stale entries", () => {
    it("every ALLOWLIST key matches at least one test", () => {
      for (const key of Object.keys(ALLOWLIST)) {
        expect(
          _allowlistHits.has(key),
          `ALLOWLIST key "${key}" was never consulted — remove it (stale allowlist entry)`,
        ).toBe(true);
      }
    });

    it("every ADMONITION_ALLOWLIST key matches at least one test", () => {
      for (const key of Object.keys(ADMONITION_ALLOWLIST)) {
        expect(
          _allowlistHits.has(key),
          `ADMONITION_ALLOWLIST key "${key}" was never consulted — remove it (stale allowlist entry)`,
        ).toBe(true);
      }
    });
  });
});
