/**
 * The project's page tree, rendered identically in both rail states — the
 * expanded 240px panel (a1's visual reference) and the collapsed rail's
 * flyout (a3's). One component, because "the flyout shows the same tree" is
 * the whole point of the two-state rail: a user who collapses the rail must
 * not lose a way to reach a page, only the space the panel took.
 *
 * Titles come from the composed snapshot (epic #3327 contract 1 — the outline
 * itself stores no titles), and the dirty dot from the open page's save
 * machine, so a page being edited in a background tab still reads as unsaved
 * here.
 */

import type { EditorTreeCategory } from "./page-index";
import { FileIcon } from "./icons";

export interface PageTreeProps {
  tree: readonly EditorTreeCategory[];
  activePageId: string | null;
  /** Page ids whose open tab holds unsaved work. */
  dirtyPageIds: ReadonlySet<string>;
  onOpenPage: (pageId: string) => void;
  /** Announced by the scroll region; differs between the rail and the flyout. */
  label: string;
}

export function PageTree({
  tree,
  activePageId,
  dirtyPageIds,
  onOpenPage,
  label,
}: PageTreeProps) {
  return (
    <div
      className="min-h-[0px] flex-1 overflow-y-auto px-hsp-sm pb-vsp-sm"
      aria-label={label}
      role="group"
    >
      {tree.map((category) => (
        <div key={category.id}>
          <div className="flex items-baseline gap-hsp-sm px-hsp-sm pt-vsp-sm pb-vsp-2xs">
            <span className="text-caption font-semibold uppercase tracking-(--zdo-label-tracking) text-muted">
              {category.title}
            </span>
            <span className="truncate font-mono text-caption text-muted">
              {category.slug}/
            </span>
          </div>

          {category.pages.map((page) => {
            const current = page.id === activePageId;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => onOpenPage(page.id)}
                {...(current ? { "aria-current": "page" as const } : {})}
                className={[
                  "flex w-full items-center gap-hsp-sm rounded-sm py-vsp-2xs pl-hsp-md pr-hsp-sm text-left text-small",
                  "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
                  current
                    ? "bg-(--zdo-wash-active) font-medium text-accent"
                    : "text-fg-mild hover:bg-(--zdo-wash-hover)",
                ].join(" ")}
              >
                <span className="flex-none text-muted">
                  <FileIcon />
                </span>
                <span className="truncate">{page.title}</span>
                <span className="flex-1" />
                {page.draft ? (
                  <span className="flex-none rounded-full bg-(--zdo-wash-warning) px-hsp-xs text-caption font-semibold text-warning">
                    draft
                  </span>
                ) : null}
                {dirtyPageIds.has(page.id) ? (
                  <span
                    className="size-(--zdo-dot) flex-none rounded-full bg-accent"
                    title="Unsaved edits"
                    role="img"
                    aria-label="Unsaved edits"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
