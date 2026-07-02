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

  // --- Batch A ---
  // Dracula — 7 failing pairs
  "Dracula:muted-vs-bg": "3.97:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Dracula:code-fg-vs-code-bg": "1.23:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Dracula:matched-keyword": "1.12:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Dracula:chat-user": "1.14:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Dracula:chat-assistant": "2.61:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Dracula:mermaid-text-vs-node-bg": "2.61:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Dracula:mermaid-text-vs-label-bg": "1.23:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Catppuccin Mocha — 8 failing pairs
  "Catppuccin Mocha:muted-vs-bg": "4.03:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Mocha:code-fg-vs-code-bg": "1.16:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Mocha:matched-keyword": "1.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Mocha:chat-user": "1.74:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Mocha:chat-assistant": "1.80:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Mocha:mermaid-text-vs-node-bg": "1.80:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Mocha:mermaid-text-vs-label-bg": "1.16:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Mocha:mermaid-line-vs-bg": "2.46:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Catppuccin Frappe — 10 failing pairs
  "Catppuccin Frappe:muted-vs-bg": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:code-fg-vs-code-bg": "1.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:selection": "3.61:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:matched-keyword": "1.13:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:chat-user": "1.84:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:chat-assistant": "1.61:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:mermaid-text-vs-node-bg": "1.61:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:mermaid-text-vs-label-bg": "1.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:mermaid-text-vs-note-bg": "3.82:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:mermaid-line-vs-bg": "2.23:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Catppuccin Macchiato — 9 failing pairs
  "Catppuccin Macchiato:muted-vs-bg": "3.98:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Macchiato:code-fg-vs-code-bg": "1.11:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Macchiato:selection": "4.17:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Macchiato:matched-keyword": "1.25:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Macchiato:chat-user": "1.80:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Macchiato:chat-assistant": "1.70:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Macchiato:mermaid-text-vs-node-bg": "1.70:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Macchiato:mermaid-text-vs-label-bg": "1.11:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Macchiato:mermaid-line-vs-bg": "2.38:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Nord — 9 failing pairs
  "Nord:muted-vs-bg": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:accent-vs-bg": "4.42:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:code-fg-vs-code-bg": "1.31:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:matched-keyword": "1.35:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:chat-user": "1.45:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:chat-assistant": "2.62:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:mermaid-text-vs-node-bg": "2.62:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:mermaid-text-vs-label-bg": "1.31:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:mermaid-line-vs-bg": "2.07:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // TokyoNight — 8 failing pairs
  "TokyoNight:muted-vs-bg": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "TokyoNight:code-fg-vs-code-bg": "1.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "TokyoNight:matched-keyword": "1.24:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "TokyoNight:chat-user": "1.14:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "TokyoNight:chat-assistant": "1.32:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "TokyoNight:mermaid-text-vs-node-bg": "1.32:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "TokyoNight:mermaid-text-vs-label-bg": "1.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "TokyoNight:mermaid-line-vs-bg": "1.91:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Atom One Dark — 7 failing pairs
  "Atom One Dark:muted-vs-bg": "3.99:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Atom One Dark:code-fg-vs-code-bg": "1.17:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Atom One Dark:matched-keyword": "1.23:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Atom One Dark:chat-user": "1.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Atom One Dark:chat-assistant": "1.85:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Atom One Dark:mermaid-text-vs-node-bg": "1.85:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Atom One Dark:mermaid-text-vs-label-bg": "1.17:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Gruvbox Dark — 8 failing pairs
  "Gruvbox Dark:muted-vs-bg": "4.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:accent-vs-bg": "3.48:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:code-fg-vs-code-bg": "1.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:matched-keyword": "1.81:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:chat-user": "1.23:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:chat-assistant": "2.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:mermaid-text-vs-node-bg": "2.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:mermaid-text-vs-label-bg": "1.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Gruvbox Dark Hard — 8 failing pairs
  "Gruvbox Dark Hard:muted-vs-bg": "4.46:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:accent-vs-bg": "3.87:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:code-fg-vs-code-bg": "1.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:matched-keyword": "1.81:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:chat-user": "1.23:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:chat-assistant": "2.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:mermaid-text-vs-node-bg": "2.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:mermaid-text-vs-label-bg": "1.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Gruvbox Material Dark — 7 failing pairs
  "Gruvbox Material Dark:muted-vs-bg": "3.97:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Material Dark:code-fg-vs-code-bg": "1.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Material Dark:matched-keyword": "1.34:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Material Dark:chat-user": "1.14:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Material Dark:chat-assistant": "1.42:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Material Dark:mermaid-text-vs-node-bg": "1.42:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Material Dark:mermaid-text-vs-label-bg": "1.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Snazzy — 8 failing pairs
  "Snazzy:muted-vs-bg": "4.03:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Snazzy:code-fg-vs-code-bg": "1.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Snazzy:matched-keyword": "1.05:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Snazzy:chat-user": "1.13:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Snazzy:chat-assistant": "3.13:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Snazzy:mermaid-text-vs-node-bg": "3.13:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Snazzy:mermaid-text-vs-label-bg": "1.22:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Snazzy:mermaid-line-vs-bg": "2.20:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Embark — 8 failing pairs
  "Embark:muted-vs-bg": "3.96:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Embark:code-fg-vs-code-bg": "1.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Embark:matched-keyword": "1.76:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Embark:chat-user": "1.64:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Embark:chat-assistant": "2.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Embark:mermaid-text-vs-node-bg": "2.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Embark:mermaid-text-vs-label-bg": "1.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Embark:mermaid-line-vs-bg": "2.27:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Challenger Deep — 8 failing pairs
  "Challenger Deep:muted-vs-bg": "3.98:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Challenger Deep:code-fg-vs-code-bg": "1.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Challenger Deep:matched-keyword": "1.31:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Challenger Deep:chat-user": "1.50:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Challenger Deep:chat-assistant": "2.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Challenger Deep:mermaid-text-vs-node-bg": "2.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Challenger Deep:mermaid-text-vs-label-bg": "1.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Challenger Deep:mermaid-line-vs-bg": "2.32:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch A

  // --- Batch B ---
  // Monokai Pro — 8 failing pairs
  "Monokai Pro:muted-vs-bg": "4.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Pro:code-fg-vs-code-bg": "1.16:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Pro:matched-keyword": "1.34:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Pro:chat-user": "1.21:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Pro:chat-assistant": "2.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Pro:mermaid-text-vs-node-bg": "2.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Pro:mermaid-text-vs-label-bg": "1.16:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Pro:mermaid-line-vs-bg": "2.89:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Monokai Remastered — 7 failing pairs
  "Monokai Remastered:muted-vs-bg": "4.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Remastered:code-fg-vs-code-bg": "1.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Remastered:matched-keyword": "2.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Remastered:chat-user": "1.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Remastered:chat-assistant": "2.76:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Remastered:mermaid-text-vs-node-bg": "2.76:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Remastered:mermaid-text-vs-label-bg": "1.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Monokai Vivid — 6 failing pairs
  "Monokai Vivid:code-fg-vs-code-bg": "1.32:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Vivid:matched-keyword": "1.16:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Vivid:chat-user": "1.15:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Vivid:chat-assistant": "2.48:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Vivid:mermaid-text-vs-node-bg": "2.48:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Vivid:mermaid-text-vs-label-bg": "1.32:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Monokai Soda — 9 failing pairs
  "Monokai Soda:muted-vs-bg": "3.97:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:accent-vs-bg": "4.15:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:code-fg-vs-code-bg": "1.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:matched-keyword": "2.31:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:chat-user": "1.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:chat-assistant": "2.76:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:mermaid-text-vs-node-bg": "2.76:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:mermaid-text-vs-label-bg": "1.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:mermaid-line-vs-bg": "2.67:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Material Ocean — 8 failing pairs
  "Material Ocean:muted-vs-bg": "4.04:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Ocean:code-fg-vs-code-bg": "1.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Ocean:matched-keyword": "1.50:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Ocean:chat-user": "1.30:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Ocean:chat-assistant": "2.08:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Ocean:mermaid-text-vs-node-bg": "2.08:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Ocean:mermaid-text-vs-label-bg": "1.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Ocean:mermaid-text-vs-note-bg": "3.60:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Material Darker — 8 failing pairs
  "Material Darker:muted-vs-bg": "4.05:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Darker:code-fg-vs-code-bg": "1.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Darker:matched-keyword": "1.50:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Darker:chat-user": "1.30:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Darker:chat-assistant": "2.08:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Darker:mermaid-text-vs-node-bg": "2.08:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Darker:mermaid-text-vs-label-bg": "1.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Darker:mermaid-line-vs-bg": "2.13:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Material Dark — 8 failing pairs
  "Material Dark:muted-vs-bg": "4.03:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:code-fg-vs-code-bg": "1.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:matched-keyword": "1.58:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:chat-user": "2.17:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:chat-assistant": "3.33:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:mermaid-text-vs-node-bg": "3.33:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:mermaid-text-vs-label-bg": "1.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:mermaid-line-vs-bg": "1.92:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Solarized Dark — 12 failing pairs
  "Solarized Dark:fg-vs-surface": "4.12:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:muted-vs-bg": "4.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:accent-vs-bg": "3.30:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:code-fg-vs-code-bg": "1.21:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:matched-keyword": "2.98:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:chat-user": "1.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:chat-assistant": "1.03:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:mermaid-text-vs-node-bg": "1.03:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:mermaid-text-vs-label-bg": "1.21:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:mermaid-text-vs-note-bg": "2.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:mermaid-line-vs-bg": "2.10:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:image-overlay": "2.92:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Solarized Dark Higher Contrast — 11 failing pairs
  "Solarized Dark Higher Contrast:muted-vs-bg": "3.98:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:accent-vs-bg": "3.12:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:code-fg-vs-code-bg": "2.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:selection": "3.74:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:matched-keyword": "3.64:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:chat-user": "1.34:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:chat-assistant": "1.17:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:mermaid-text-vs-node-bg": "1.17:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:mermaid-text-vs-label-bg": "2.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:mermaid-text-vs-note-bg": "4.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:mermaid-line-vs-bg": "2.62:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // VS Code Dark+ — 9 failing pairs
  "VS Code Dark+:muted-vs-bg": "4.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:accent-vs-bg": "3.63:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:code-fg-vs-code-bg": "1.71:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:matched-keyword": "1.07:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:chat-user": "1.28:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:chat-assistant": "3.07:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:mermaid-text-vs-node-bg": "3.07:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:mermaid-text-vs-label-bg": "1.71:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:mermaid-line-vs-bg": "2.90:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Doom One — 8 failing pairs
  "Doom One:muted-vs-bg": "4.03:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Doom One:code-fg-vs-code-bg": "1.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Doom One:matched-keyword": "1.07:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Doom One:chat-user": "1.02:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Doom One:chat-assistant": "1.68:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Doom One:mermaid-text-vs-node-bg": "1.68:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Doom One:mermaid-text-vs-label-bg": "1.27:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Doom One:mermaid-line-vs-bg": "2.00:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Vesper — 7 failing pairs
  "Vesper:code-fg-vs-code-bg": "1.28:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Vesper:selection": "2.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Vesper:matched-keyword": "1.78:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Vesper:chat-user": "1.15:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Vesper:chat-assistant": "1.61:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Vesper:mermaid-text-vs-node-bg": "1.61:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Vesper:mermaid-text-vs-label-bg": "1.28:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Night Owl — 9 failing pairs
  "Night Owl:muted-vs-bg": "3.99:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Night Owl:code-fg-vs-code-bg": "1.55:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Night Owl:selection": "3.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Night Owl:matched-keyword": "1.60:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Night Owl:chat-user": "1.45:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Night Owl:chat-assistant": "2.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Night Owl:mermaid-text-vs-node-bg": "2.92:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Night Owl:mermaid-text-vs-label-bg": "1.55:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Night Owl:mermaid-line-vs-bg": "2.50:1 (need 3:1)", // TODO(scheme-a11y #2489) — remove in Batch B

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

  // --- Batch A ---
  // Dracula — 1 failing pair
  "Dracula:admonition-danger": "3.93:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Catppuccin Frappe — 2 failing pairs
  "Catppuccin Frappe:admonition-info": "4.31:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Catppuccin Frappe:admonition-danger": "3.89:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Nord — 4 failing pairs
  "Nord:admonition-accent": "3.66:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:admonition-info": "3.84:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:admonition-danger": "2.73:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Nord:admonition-important": "3.66:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Atom One Dark — 3 failing pairs
  "Atom One Dark:admonition-accent": "4.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Atom One Dark:admonition-danger": "4.09:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Atom One Dark:admonition-important": "4.37:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Gruvbox Dark — 5 failing pairs
  "Gruvbox Dark:admonition-accent": "3.05:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:admonition-success": "4.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:admonition-info": "3.05:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:admonition-danger": "2.52:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark:admonition-important": "3.05:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Gruvbox Dark Hard — 5 failing pairs
  "Gruvbox Dark Hard:admonition-accent": "3.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:admonition-success": "4.46:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:admonition-info": "3.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:admonition-danger": "2.79:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Dark Hard:admonition-important": "3.39:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Gruvbox Material Dark — 3 failing pairs
  "Gruvbox Material Dark:admonition-accent": "4.43:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Material Dark:admonition-danger": "4.00:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Gruvbox Material Dark:admonition-important": "4.43:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Snazzy — 1 failing pair
  "Snazzy:admonition-danger": "4.16:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  // Challenger Deep — 2 failing pairs
  "Challenger Deep:admonition-accent": "3.89:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A
  "Challenger Deep:admonition-important": "3.89:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch A

  // --- Batch B ---
  // Monokai Pro — 1 failing pair
  "Monokai Pro:admonition-danger": "4.16:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Monokai Remastered — 3 failing pairs
  "Monokai Remastered:admonition-accent": "4.38:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Remastered:admonition-danger": "4.38:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Remastered:admonition-important": "4.38:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Monokai Vivid — 2 failing pairs
  "Monokai Vivid:admonition-info": "2.73:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Vivid:admonition-danger": "4.40:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Monokai Soda — 4 failing pairs
  "Monokai Soda:admonition-accent": "3.88:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:admonition-info": "4.12:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:admonition-danger": "3.88:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Monokai Soda:admonition-important": "3.88:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Material Darker — 1 failing pair
  "Material Darker:admonition-danger": "4.43:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Material Dark — 4 failing pairs
  "Material Dark:admonition-success": "2.74:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:admonition-info": "1.95:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:admonition-danger": "2.25:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Material Dark:admonition-important": "1.71:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Solarized Dark — 6 failing pairs
  "Solarized Dark:admonition-accent": "3.13:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:admonition-success": "4.01:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:admonition-warning": "4.07:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:admonition-info": "3.50:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:admonition-danger": "3.12:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark:admonition-important": "3.13:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Solarized Dark Higher Contrast — 5 failing pairs
  "Solarized Dark Higher Contrast:admonition-accent": "2.99:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:admonition-warning": "3.83:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:admonition-info": "3.24:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:admonition-danger": "3.10:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Solarized Dark Higher Contrast:admonition-important": "2.99:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // VS Code Dark+ — 4 failing pairs
  "VS Code Dark+:admonition-accent": "3.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:admonition-info": "3.06:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:admonition-danger": "2.98:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "VS Code Dark+:admonition-important": "3.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  // Doom One — 3 failing pairs
  "Doom One:admonition-accent": "3.99:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Doom One:admonition-danger": "4.26:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B
  "Doom One:admonition-important": "3.99:1 (need 4.5:1)", // TODO(scheme-a11y #2489) — remove in Batch B

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
