/**
 * scripts/theme-a11y-allowlist.ts
 *
 * Allowlist for the theme-a11y rendered contrast audit
 * (`scripts/theme-a11y-audit.ts`). Each entry downgrades a specific
 * pack/mode/elementKey/state FAIL to a non-gating ALLOW, and REQUIRES a
 * `reason`.
 *
 * EMPTY BY DESIGN. The audit is meant to be burned down to a clean pass by
 * fixing the actual theme-pack CSS (epic Theme A11y, #3035) — an allowlist
 * entry is a last resort for a pair provably not user-visible, with a one-line
 * justification. "Upstream fidelity" / "looks fine to me" are NOT acceptable
 * reasons; tweak the color instead.
 *
 * Integrity: a stale entry (one that matches no real FAIL this run — its
 * target now passes, was skipped, or the key never existed) is itself a
 * FAIL-grade error (`detectStaleAllowlistEntries`), so a spurious entry can't
 * silently rot here. Reasons are structurally required
 * (`validateAllowlist`) — an entry with a blank reason fails the run.
 */

import type { AllowlistEntry } from "./theme-a11y-evaluator";

export const THEME_A11Y_ALLOWLIST: readonly AllowlistEntry[] = [
  // Intentionally empty. See file header before adding an entry.
];
