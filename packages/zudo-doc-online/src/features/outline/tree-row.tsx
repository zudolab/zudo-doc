/**
 * The three row shapes of the outline tree: the derived top page, a category,
 * and a page.
 *
 * Each row owns exactly one piece of state — which inline affordance is open
 * (`idle | rename | slug | delete | move`) — and nothing else. Every actual
 * change leaves through a callback, so a row never knows about the store, the
 * revision, or whether its command succeeded. That keeps the 409 path in one
 * place (the surface) instead of scattered across a dozen rows.
 *
 * Row actions are hover-revealed like the accepted B-v1 prototype, but with
 * `focus-within:opacity-100` alongside `group-hover:` so a keyboard user
 * tabbing through the tree can see the button they are on.
 */

import { useState } from "preact/hooks";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretIcon,
  FolderIcon,
  HomeIcon,
  MoveToIcon,
  PageIcon,
  PencilIcon,
  TrashIcon,
} from "./icons.js";
import { InlineConfirm } from "./inline-confirm.js";
import { InlineEditField } from "./inline-edit-field.js";
import { MoveToPicker } from "./move-to-picker.js";
import type { MoveDirection } from "./outline-actions.js";
import { describeCategoryDelete, describePageDelete } from "./outline-actions.js";
import type {
  MoveTarget,
  OutlineCategoryRow,
  OutlinePageRow,
  OutlineTopPageRow,
} from "./outline-model.js";

type RowMode = "idle" | "rename" | "slug" | "delete" | "move";

const ROW_BASE =
  "group relative flex min-w-[0px] items-center gap-hsp-sm rounded-md px-hsp-sm py-vsp-2xs";

const ICON_BUTTON =
  "shrink-0 rounded-sm p-hsp-xs text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const DANGER_ICON_BUTTON =
  "shrink-0 rounded-sm p-hsp-xs text-muted hover:bg-surface-2 hover:text-danger focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const ROW_ACTIONS =
  "ml-auto flex shrink-0 items-center gap-hsp-2xs opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100";

const CHIP =
  "shrink-0 rounded-full bg-surface-2 px-hsp-sm py-vsp-2xs text-caption text-muted";

/** A left accent bar without a border (which would shift the row by its width). */
const SELECTED_BAR = { boxShadow: "inset 3px 0 0 var(--zdo-accent)" };

export interface TopPageRowProps {
  topPage: OutlineTopPageRow;
  selected: boolean;
  onSelect(): void;
}

export function TopPageRow({ topPage, selected, onSelect }: TopPageRowProps) {
  return (
    <div
      className={`${ROW_BASE} ${selected ? "bg-accent-soft" : "hover:bg-surface"}`}
      style={selected ? SELECTED_BAR : undefined}
    >
      <span className={selected ? "text-accent" : "text-muted"}>
        <HomeIcon />
      </span>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="min-w-[0px] truncate text-left text-small font-medium text-fg-mild hover:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        Top page
      </button>
      <span className="shrink-0 font-mono text-caption text-muted">
        {topPage.path}
      </span>
      <span className="shrink-0 rounded-full border border-dashed border-border-strong px-hsp-sm py-vsp-2xs text-caption font-semibold text-muted uppercase">
        derived
      </span>
      <span className="ml-auto shrink-0 text-caption text-muted">
        generated category grid — not directly authored
      </span>
    </div>
  );
}

export interface CategoryRowProps {
  category: OutlineCategoryRow;
  selected: boolean;
  expanded: boolean;
  onToggleExpanded(): void;
  onSelect(): void;
  onRename(title: string): void;
  onDelete(): void;
  onMove(direction: MoveDirection): void;
  beginEditing(): () => void;
}

export function CategoryRow({
  category,
  selected,
  expanded,
  onToggleExpanded,
  onSelect,
  onRename,
  onDelete,
  onMove,
  beginEditing,
}: CategoryRowProps) {
  const [mode, setMode] = useState<RowMode>("idle");

  if (mode === "rename") {
    return (
      <div className={ROW_BASE}>
        <span className="shrink-0 text-fg-mild">
          <FolderIcon />
        </span>
        <InlineEditField
          label={`Rename category “${category.title}”`}
          initialValue={category.title}
          beginEditing={beginEditing}
          onCommit={(value) => {
            setMode("idle");
            onRename(value);
          }}
          onCancel={() => setMode("idle")}
        />
      </div>
    );
  }

  if (mode === "delete") {
    return (
      <div className={ROW_BASE}>
        <InlineConfirm
          message={describeCategoryDelete(category)}
          confirmLabel="Delete category"
          tone="danger"
          beginEditing={beginEditing}
          onConfirm={() => {
            setMode("idle");
            onDelete();
          }}
          onCancel={() => setMode("idle")}
        />
      </div>
    );
  }

  return (
    <div
      className={`${ROW_BASE} ${selected ? "bg-accent-soft" : "hover:bg-surface"}`}
      style={selected ? SELECTED_BAR : undefined}
    >
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${category.title}`}
        className={ICON_BUTTON}
      >
        <CaretIcon open={expanded} />
      </button>
      <span className={`shrink-0 ${selected ? "text-accent" : "text-fg-mild"}`}>
        <FolderIcon />
      </span>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Select category ${category.title}`}
        className="min-w-[0px] truncate text-left text-small font-semibold text-fg hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        {category.title}
      </button>
      <span
        className={`shrink-0 rounded-sm px-hsp-sm py-vsp-2xs font-mono text-caption ${
          selected ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
        }`}
      >
        {category.slug}/
      </span>
      <span className="shrink-0 text-caption text-muted">
        {category.pageCount === 1 ? "1 page" : `${category.pageCount} pages`}
      </span>
      <span className={ROW_ACTIONS}>
        <button
          type="button"
          onClick={() => setMode("rename")}
          aria-label={`Rename category ${category.title}`}
          className={ICON_BUTTON}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          disabled={!category.canMoveUp}
          onClick={() => onMove("up")}
          aria-label={`Move category ${category.title} up`}
          className={ICON_BUTTON}
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          disabled={!category.canMoveDown}
          onClick={() => onMove("down")}
          aria-label={`Move category ${category.title} down`}
          className={ICON_BUTTON}
        >
          <ArrowDownIcon />
        </button>
        <button
          type="button"
          onClick={() => setMode("delete")}
          aria-label={`Delete category ${category.title}`}
          className={DANGER_ICON_BUTTON}
        >
          <TrashIcon />
        </button>
      </span>
    </div>
  );
}

export interface PageRowProps {
  page: OutlinePageRow;
  categoryTitle: string;
  focused: boolean;
  onFocus(): void;
  onRename(title: string): void;
  onSlugChange(slug: string): void;
  onDelete(): void;
  onMove(direction: MoveDirection): void;
  onMoveToCategory(categoryId: string): void;
  /** Read only while the picker is open, so a closed row costs nothing. */
  getMoveTargets(): MoveTarget[];
  beginEditing(): () => void;
}

export function PageRow({
  page,
  categoryTitle,
  focused,
  onFocus,
  onRename,
  onSlugChange,
  onDelete,
  onMove,
  onMoveToCategory,
  getMoveTargets,
  beginEditing,
}: PageRowProps) {
  const [mode, setMode] = useState<RowMode>("idle");

  if (mode === "rename") {
    return (
      <div className={ROW_BASE}>
        <span className="shrink-0 text-muted">
          <PageIcon />
        </span>
        <InlineEditField
          label={`Rename page “${page.title}”`}
          initialValue={page.title}
          beginEditing={beginEditing}
          onCommit={(value) => {
            setMode("idle");
            onRename(value);
          }}
          onCancel={() => setMode("idle")}
        />
      </div>
    );
  }

  if (mode === "slug") {
    return (
      <div className={ROW_BASE}>
        <span className="shrink-0 text-muted">
          <PageIcon />
        </span>
        <InlineEditField
          label={`Change the URL segment of “${page.title}”`}
          initialValue={page.slug}
          mono
          beginEditing={beginEditing}
          onCommit={(value) => {
            setMode("idle");
            onSlugChange(value);
          }}
          onCancel={() => setMode("idle")}
        />
      </div>
    );
  }

  if (mode === "delete") {
    return (
      <div className={ROW_BASE}>
        <InlineConfirm
          message={describePageDelete(page)}
          confirmLabel="Delete page"
          tone="danger"
          beginEditing={beginEditing}
          onConfirm={() => {
            setMode("idle");
            onDelete();
          }}
          onCancel={() => setMode("idle")}
        />
      </div>
    );
  }

  if (mode === "move") {
    return (
      <div className={ROW_BASE}>
        <MoveToPicker
          targets={getMoveTargets()}
          beginEditing={beginEditing}
          onPick={(categoryId) => {
            setMode("idle");
            onMoveToCategory(categoryId);
          }}
          onCancel={() => setMode("idle")}
        />
      </div>
    );
  }

  return (
    <div
      className={`${ROW_BASE} ${focused ? "bg-surface" : "hover:bg-surface"}`}
    >
      <span className="shrink-0 text-muted">
        <PageIcon />
      </span>
      <button
        type="button"
        onClick={onFocus}
        aria-label={`Select page ${page.title}`}
        className="min-w-[0px] truncate text-left text-small text-fg hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        {page.title}
      </button>
      <button
        type="button"
        onClick={() => setMode("slug")}
        aria-label={`Change the URL segment of ${page.title}`}
        className="shrink-0 font-mono text-caption text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        {page.slug}
      </button>
      {page.isIndex ? <span className={CHIP}>category page</span> : null}
      {page.draft ? (
        <span className="flex shrink-0 items-center gap-hsp-xs text-caption text-muted">
          <span
            aria-hidden="true"
            className="block shrink-0 rounded-full bg-warning size-(--icon-xs)"
          />
          draft
        </span>
      ) : null}
      <span className={ROW_ACTIONS}>
        <button
          type="button"
          onClick={() => setMode("rename")}
          aria-label={`Rename page ${page.title}`}
          className={ICON_BUTTON}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          disabled={!page.canMoveUp}
          onClick={() => onMove("up")}
          aria-label={`Move page ${page.title} up`}
          className={ICON_BUTTON}
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          disabled={!page.canMoveDown}
          onClick={() => onMove("down")}
          aria-label={`Move page ${page.title} down`}
          className={ICON_BUTTON}
        >
          <ArrowDownIcon />
        </button>
        <button
          type="button"
          onClick={() => setMode("move")}
          aria-label={`Move page ${page.title} out of ${categoryTitle}`}
          className={ICON_BUTTON}
        >
          <MoveToIcon />
        </button>
        <button
          type="button"
          onClick={() => setMode("delete")}
          aria-label={`Delete page ${page.title}`}
          className={DANGER_ICON_BUTTON}
        >
          <TrashIcon />
        </button>
      </span>
    </div>
  );
}
