import type { FeatureModule } from "../compose.js";

/**
 * Doc-history feature.
 *
 * W7A (#1736): post-cutover, `pages/lib/_doc-history-area.tsx` is mounted
 * unconditionally and self-gates on `settings.docHistory`. The plugin entry
 * is wired by `zfb-config-gen.ts`.
 */
export const docHistoryFeature: FeatureModule = () => ({
  name: "docHistory",
  injections: [
    {
      // Diff-viewer CSS — the DocHistory island's side-by-side diff markup
      // (.diff-row / .diff-line-*) is styled only here; without this block
      // scaffolded projects render the diff viewer unstyled (#2081). Values
      // mirror the showcase src/styles/global.css (per-line separators at
      // the 15% muted mix, #2077).
      file: "src/styles/global.css",
      anchor: "/* @slot:global-css:feature-styles */",
      content: `/* ========================================
 * Doc History Diff Viewer (side-by-side)
 * ======================================== */

.diff-row {
  border-bottom: 1px solid color-mix(in oklch, var(--color-muted) 15%, transparent);
}

.diff-line-num {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: var(--text-caption);
  line-height: 1.5;
  padding: 0 var(--spacing-hsp-xs);
  text-align: right;
  color: var(--color-muted);
  user-select: none;
  vertical-align: top;
  border-right: 1px solid color-mix(in oklch, var(--color-muted) 15%, transparent);
}

.diff-line-content {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: var(--text-caption);
  line-height: 1.5;
  padding: 0 var(--spacing-hsp-sm);
  white-space: pre-wrap;
  word-break: break-all;
  vertical-align: top;
}

/* Left column right border to separate the two sides */
.diff-row td:nth-child(2) {
  border-right: 2px solid var(--color-muted);
}

.diff-line-added {
  background-color: color-mix(in oklch, var(--color-success) 15%, transparent);
}

.diff-line-removed {
  background-color: color-mix(in oklch, var(--color-danger) 15%, transparent);
}

.diff-line-empty {
  background-color: color-mix(in oklch, var(--color-muted) 8%, transparent);
}`,
    },
  ],
});
