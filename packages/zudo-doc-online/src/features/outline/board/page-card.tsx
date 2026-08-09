/**
 * A single board card — one page, sortable within its column and draggable
 * across columns (recipe §§1-5).
 *
 * dnd-kit `attributes` (role/aria-roledescription/tabIndex from
 * `useSortable`) go on the card ROOT; `listeners` (the actual pointer/
 * keyboard activators) go ONLY on the grip button via `setActivatorNodeRef`
 * — a `<button>` is natively focusable/keyboard-actionable on its own, so
 * this split needs no extra `tabIndex` bookkeeping, and it keeps drag
 * activation off the title link and the move/delete buttons (recipe §5:
 * `listeners`' `onKeyDown` must never land on an element containing an
 * inline input or an unrelated interactive control).
 *
 * Card actions here are deliberately narrower than the b3 prototype's mock:
 * up/down (keyboard-reachable reorder within the column) and delete. There
 * is no rename affordance — the sub-issue's command whitelist has no
 * `rename-category`/`rename-page` for the board (titles are frontmatter,
 * per epic contract 1, and a category rename already lives on the Outline
 * tree view), so this intentionally does not duplicate it.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "preact/hooks";
import { formatRoute } from "../../../app/router.js";
import { ArrowDownIcon, ArrowUpIcon, GripIcon, TrashIcon } from "../icons.js";
import { InlineConfirm } from "../inline-confirm.js";
import { describePageDelete, type MoveDirection } from "../outline-actions.js";
import type { OutlinePageRow } from "../outline-model.js";
import { CARD_DND_TYPE, type CardDndData } from "./dnd.js";

const CARD_ROOT =
  "group/card relative flex min-w-[0px] items-start gap-hsp-2xs rounded-[var(--zdo-kb-card-radius,var(--radius-sm))] border py-vsp-xs pr-hsp-xs pl-hsp-2xs transition-shadow hover:shadow-[var(--zdo-kb-card-shadow,var(--shadow-1))] focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-1";

const CARD_STYLE_BASE = {
  backgroundColor: "var(--zdo-kb-card-bg, var(--zdo-surface))",
  borderColor: "var(--zdo-kb-card-border, var(--zdo-border))",
};

const GRIP_BUTTON =
  "flex shrink-0 cursor-grab items-center justify-center self-stretch rounded-sm px-hsp-2xs text-border-strong hover:text-muted focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 active:cursor-grabbing";

const CARD_LINK =
  "min-w-[0px] flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const ROW_ACTIONS =
  "ml-auto flex shrink-0 items-start gap-hsp-2xs opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100";

const ICON_BUTTON =
  "shrink-0 rounded-sm p-hsp-2xs text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const DANGER_ICON_BUTTON =
  "shrink-0 rounded-sm p-hsp-2xs text-muted hover:bg-surface-2 hover:text-danger focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const CHIP =
  "shrink-0 rounded-full bg-surface-2 px-hsp-xs py-vsp-2xs text-caption text-muted";

export interface PageCardProps {
  page: OutlinePageRow;
  categoryId: string;
  categoryTitle: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  suppressClick(): boolean;
  /** Called just before the editor navigation is allowed to proceed — lets
   * the board keep the shared `selection` (view-props.ts) in sync so
   * switching back to Outline lands on the same page. */
  onOpen(): void;
  onMove(direction: MoveDirection): void;
  onDelete(): void;
  /**
   * Optional on purpose: `OutlineViewProps` (`view-props.ts`) has no
   * dirty-guard lease today — its own header comment anticipates adding one
   * as a fourth contract member if a view needs it. Until then, a board
   * delete-confirm is not shielded from a live SSE refresh rebasing the
   * snapshot underneath it, unlike the tree's rows.
   */
  beginEditing?: (() => () => void) | undefined;
}

export function PageCard({
  page,
  categoryId,
  categoryTitle,
  canMoveUp,
  canMoveDown,
  suppressClick,
  onOpen,
  onMove,
  onDelete,
  beginEditing,
}: PageCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    data: { type: CARD_DND_TYPE, categoryId } satisfies CardDndData,
  });

  // dnd-kit's `DraggableAttributes.role` is a plain `string`, narrower than
  // Preact's `Signalish<AriaRole>` prop type — cast the spread rather than
  // widen Preact's own JSX types (mirrors the bootstrap dnd spike).
  const dndAttributes = attributes as unknown as Record<string, unknown>;
  const dragHandleProps = listeners as unknown as Record<string, unknown> | undefined;

  const style = {
    ...CARD_STYLE_BASE,
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    // The source card stays IN PLACE at reduced opacity while its floating
    // clone follows the pointer (recipe §3) — dnd-kit's own per-item
    // `isDragging` already answers "is THIS card the active one", so no
    // externally-threaded flag is needed (and none would risk dimming every
    // card in the column at once).
    opacity: isDragging ? 0.5 : undefined,
  };

  if (confirmingDelete) {
    return (
      <li ref={setNodeRef} style={style} className={CARD_ROOT}>
        <InlineConfirm
          message={describePageDelete(page)}
          confirmLabel="Delete page"
          tone="danger"
          beginEditing={beginEditing}
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} {...dndAttributes} className={CARD_ROOT}>
      <button
        ref={setActivatorNodeRef}
        {...dragHandleProps}
        type="button"
        aria-label={`Drag ${page.title} to reorder`}
        className={GRIP_BUTTON}
      >
        <GripIcon />
      </button>
      <a
        href={formatRoute({ name: "editor", pageId: page.id })}
        className={CARD_LINK}
        onClick={(event) => {
          if (suppressClick()) {
            event.preventDefault();
            return;
          }
          onOpen();
        }}
      >
        <span className="flex items-center gap-hsp-xs text-small font-medium text-fg">
          <span className="min-w-[0px] truncate">{page.title}</span>
          {page.draft ? (
            <span
              aria-hidden="true"
              title="Draft — not published yet"
              className="block shrink-0 rounded-full bg-warning size-(--icon-xs)"
            />
          ) : null}
        </span>
        <span className="mt-vsp-2xs flex items-center gap-hsp-xs font-mono text-caption text-muted">
          {page.slug}
          {page.isIndex ? <span className={CHIP}>category page</span> : null}
        </span>
      </a>
      <span className={ROW_ACTIONS}>
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={() => onMove("up")}
          aria-label={`Move ${page.title} up in ${categoryTitle}`}
          className={ICON_BUTTON}
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={() => onMove("down")}
          aria-label={`Move ${page.title} down in ${categoryTitle}`}
          className={ICON_BUTTON}
        >
          <ArrowDownIcon />
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          aria-label={`Delete ${page.title}`}
          className={DANGER_ICON_BUTTON}
        >
          <TrashIcon />
        </button>
      </span>
    </li>
  );
}

/** The floating clone rendered inside `<DragOverlay>` — no hooks, no dnd
 * wiring, just the card's visual (recipe §3: `opacity-90 rotate-[2.5deg]`,
 * no other indicator/placeholder element). */
export function PageCardGhost({ page }: { page: OutlinePageRow }) {
  return (
    <div
      style={{ ...CARD_STYLE_BASE, transform: "rotate(2.5deg)" }}
      className="flex min-w-[0px] items-start gap-hsp-2xs rounded-[var(--zdo-kb-card-radius,var(--radius-sm))] border py-vsp-xs pr-hsp-xs pl-hsp-2xs opacity-90 shadow-[var(--shadow-2)]"
    >
      <span className="flex shrink-0 items-center justify-center px-hsp-2xs text-accent">
        <GripIcon />
      </span>
      <span className="min-w-[0px] flex-1">
        <span className="flex items-center gap-hsp-xs text-small font-medium text-fg">
          <span className="min-w-[0px] truncate">{page.title}</span>
        </span>
        <span className="mt-vsp-2xs flex items-center gap-hsp-xs font-mono text-caption text-muted">
          {page.slug}
        </span>
      </span>
    </div>
  );
}
