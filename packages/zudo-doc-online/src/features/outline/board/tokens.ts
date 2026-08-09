/**
 * The board's `--zdo-kb-*` component token bag (design-system skill: a
 * component-scoped bag gets a dedicated block in `tokens.css`, never an
 * ad-hoc inline style — see `src/styles/tokens.css`'s "Kanban board" section
 * for the canonical declarations this mirrors).
 *
 * This module exists ON TOP of that CSS block because recipe §2's rule 2 is
 * a hand-off, not a declaration: custom properties set on the board root
 * would normally cascade fine (the board root IS a descendant of `:root`),
 * but `<DragOverlay>` portals its content straight to `document.body`, and a
 * FUTURE board-scoped override (a themed board instance, say) applied only
 * to the board root would NOT reach that portal by inheritance — it is a
 * DOM sibling, not a descendant, of the board root. Materializing the same
 * bag as one JS object and spreading it onto both the board root's `style`
 * AND the overlay's `style` keeps the two in lockstep regardless of where
 * the values ultimately come from.
 *
 * Every value is itself a `var()` reference to an existing `--zdo-*` /
 * `--radius-*` / `--shadow-*` token (recipe §2 rule 1's fallback pattern),
 * never a literal color — consumption sites re-embed the SAME fallback
 * (`var(--zdo-kb-card-bg, var(--zdo-surface))`) so a spot that forgets to
 * apply this bag still renders correctly.
 */

import type { JSX } from "preact";

export const BOARD_TOKEN_STYLE = {
  "--zdo-kb-board-bg": "transparent",
  "--zdo-kb-column-bg": "var(--zdo-surface-2)",
  "--zdo-kb-column-radius": "var(--radius-md)",
  "--zdo-kb-card-bg": "var(--zdo-surface)",
  "--zdo-kb-card-border": "var(--zdo-border)",
  "--zdo-kb-card-radius": "var(--radius-sm)",
  "--zdo-kb-card-shadow": "var(--shadow-1)",
} as const satisfies Record<string, string>;

export const BOARD_COLUMN_WIDTH = "16rem";

/**
 * Casts a plain custom-property record to `style`'s expected type. Standard
 * `CSSProperties` shapes have no index signature for arbitrary `--foo` keys,
 * so a direct assignment does not typecheck; going through `unknown` is the
 * conventional escape hatch for this well-known CSS-custom-property-in-JSX
 * gap rather than widening the exported token bag's own type.
 */
export function boardStyleVars(vars: Record<string, string>): JSX.CSSProperties {
  return vars as unknown as JSX.CSSProperties;
}
