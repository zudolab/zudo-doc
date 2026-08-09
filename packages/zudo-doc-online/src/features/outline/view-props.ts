/**
 * The mount contract for anything that renders the outline of a project.
 *
 * This file is the seam between the outline surface (this sub-issue, #3335)
 * and the kanban board view (#3337): the board is a component that takes
 * `OutlineViewProps` and is handed to `OutlinePage`'s `boardView` prop, which
 * the view switch mounts when the persisted mode is `"board"`. Implementing
 * this interface is the ONLY thing the board has to agree with — it never
 * reaches into the surface's state, its store wiring, or its layout.
 *
 * The contract is deliberately three members wide:
 *
 * - `snapshot` — the composed, server-authoritative project state. A view
 *   renders from this and never keeps its own copy of the outline: the
 *   surface replaces it after every mutation and after every live refresh,
 *   so a stale local mirror would silently diverge.
 * - `dispatch` — the ONLY write path. It funnels through the revision
 *   coordinator (epic #3327 contract 2), so a view never sees, tracks, or
 *   passes a revision number. It never rejects: a failure (including a 409)
 *   comes back as `{ ok: false }` and the surface owns the banner.
 * - `selection` — the scope shared by both views, so switching Outline↔Board
 *   keeps the user where they were.
 *
 * Page titles are NOT in this vocabulary on purpose (epic #3327 contract 1):
 * a title lives in page frontmatter, so retitling is a page write, not an
 * outline command. A view that needs it asks the surface for it rather than
 * inventing a `rename-page`.
 *
 * If the board later needs the surface's live-refresh dirty guard (so an SSE
 * refresh cannot clobber a card's open inline editor), add it here as a
 * fourth member rather than reaching around the contract.
 */

import type { ComponentType } from "preact";
import type { OutlineCommand } from "../../core/outline/index.js";
import type { ProjectSnapshot } from "../../store/contract.js";

/** A dispatch outcome. Never thrown — always returned. */
export type OutlineDispatchResult =
  | {
      ok: true;
      /** False when the command was a no-op (the server burned no revision). */
      changed: boolean;
      /** The node the command says should now be selected, when it says. */
      selectedId?: string | null;
      /** Set by `add-page` only. */
      createdPageId?: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      /** True for a 409 — the surface is showing the conflict banner. */
      conflict: boolean;
    };

export type OutlineDispatch = (
  command: OutlineCommand,
) => Promise<OutlineDispatchResult>;

export interface OutlineSelection {
  /**
   * The category scoping the surface, or null for "the whole site" (which is
   * what the derived top-page row selects).
   */
  categoryId: string | null;
  /** The last node the user acted on — a category or a page id. */
  focusedId: string | null;
  selectCategory(categoryId: string | null): void;
  focusNode(nodeId: string | null): void;
}

export interface OutlineViewProps {
  snapshot: ProjectSnapshot;
  dispatch: OutlineDispatch;
  selection: OutlineSelection;
}

export type OutlineViewComponent = ComponentType<OutlineViewProps>;
