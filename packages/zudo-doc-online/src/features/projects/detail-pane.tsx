/**
 * The dashboard's detail pane (d3's wide right column): header with the fast
 * path into the editor, theme card, stat tiles, outline-ordered pages list,
 * and the danger zone with its INLINE delete confirm.
 *
 * Deliberately absent relative to the d3 prototype (epic #3345 "reality
 * adaptations", binding): no publish card or publish states of any kind (no
 * publish pipeline exists), no fake `*.zudo.dev` URLs (the header chip shows
 * the SLUG), and the pages list is outline order with draft chips — never
 * "recent by edit time" (no per-page timestamps exist).
 */

import { formatRoute } from "../../app/router";
import type { ProjectDirectorySnapshot } from "../../store/projects-directory";
import type { KeyValueStorage } from "../editor/persistence";
import type { ColorSchemeMode } from "../../theme/color-scheme-sync";
import {
  formatTimestamp,
  outlineOrderedPages,
  pluralize,
  resolveOpenEditorPageId,
  type OrderedPage,
} from "./dashboard-logic";
import { packForPreset, PackMiniPreview, PackSwatchRow } from "./pack-swatch";

const BTN_BASE =
  "inline-flex items-center justify-center gap-hsp-xs whitespace-nowrap rounded-md px-hsp-lg py-vsp-2xs text-small font-semibold focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const BTN_PRIMARY = `${BTN_BASE} bg-accent text-accent-fg shadow-1 hover:bg-accent-hover`;
const BTN_GHOST = `${BTN_BASE} border border-border-strong bg-surface text-fg hover:bg-surface-2`;
const BTN_DANGER = `${BTN_BASE} bg-danger text-accent-fg hover:bg-(--zdo-pj-danger-hover)`;
const BTN_DANGER_GHOST = `${BTN_BASE} border border-(--zdo-pj-danger-border) text-(--zdo-pj-tone-danger) hover:bg-(--zdo-pj-wash-danger)`;
const BTN_DISABLED = `${BTN_BASE} cursor-not-allowed bg-surface-2 text-muted`;

const CARD_CLASSES = "rounded-md border border-border bg-surface";
const CARD_HEADING_CLASSES =
  "text-caption font-semibold uppercase tracking-(--zdo-pj-label-tracking) text-fg-mild";

const PAGE_ROW_CLASSES =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-hsp-md rounded-sm px-hsp-md py-vsp-xs hover:bg-(--zdo-pj-wash-hover) focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const DRAFT_CHIP_CLASSES =
  "inline-flex items-center whitespace-nowrap rounded-full bg-(--zdo-pj-wash-warning) px-hsp-sm text-caption font-semibold text-(--zdo-pj-tone-warn)";

export interface DetailPaneProps {
  snapshot: ProjectDirectorySnapshot;
  mode: ColorSchemeMode;
  /** True while a duplicate/delete request for THIS project is in flight. */
  busy: "duplicate" | "delete" | null;
  confirmingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onDuplicate: () => void;
  /** Danger-zone mutation failure, surfaced inline; `null` when none. */
  actionError: string | null;
  /** Test seam for the remembered-tab lookup; defaults to `localStorage`. */
  storage?: KeyValueStorage | null;
}

export function DetailPane({
  snapshot,
  mode,
  busy,
  confirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onDuplicate,
  actionError,
  storage,
}: DetailPaneProps) {
  const pages = outlineOrderedPages(snapshot);
  const draftCount = pages.filter((page) => page.draft === true).length;
  const editorPageId = resolveOpenEditorPageId(snapshot, storage);
  const updated = formatTimestamp(snapshot.updatedAt);
  const created = formatTimestamp(snapshot.createdAt);
  const outlineHref = formatRoute({ name: "outline", projectSlug: snapshot.slug });

  const headerMeta = [
    pluralize(pages.length, "page"),
    ...(draftCount > 0 ? [pluralize(draftCount, "draft")] : []),
    ...(updated !== null ? [`updated ${updated}`] : []),
  ].join(" · ");

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-bg" aria-label="Project detail">
      <header className="sticky top-0 border-b border-border bg-bg px-hsp-2xl pt-vsp-md pb-vsp-sm">
        <div className="flex max-w-(--zdo-pj-detail-measure) items-start justify-between gap-hsp-xl">
          <div className="min-w-0">
            <h1 className="truncate text-heading font-semibold text-fg">{snapshot.title}</h1>
            <div className="mt-vsp-2xs flex items-center gap-hsp-sm text-caption text-muted">
              <span className="inline-flex items-center rounded-full border border-border-strong bg-surface px-hsp-sm font-mono text-caption text-fg-mild">
                {snapshot.slug}
              </span>
              <span aria-hidden="true">·</span>
              <span>{headerMeta}</span>
            </div>
          </div>
          <div className="flex flex-none gap-hsp-sm pt-vsp-2xs">
            <a href={outlineHref} className={BTN_GHOST}>
              Outline
            </a>
            {editorPageId === null ? (
              <span aria-disabled="true" className={BTN_DISABLED}>
                Open editor
              </span>
            ) : (
              <a
                href={formatRoute({
                  name: "editor",
                  projectSlug: snapshot.slug,
                  pageId: editorPageId,
                })}
                className={BTN_PRIMARY}
              >
                Open editor
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="flex max-w-(--zdo-pj-detail-measure) flex-col gap-vsp-md px-hsp-2xl py-vsp-md pb-vsp-2xl">
        <ThemeCard snapshot={snapshot} mode={mode} />
        <StatTiles
          pageCount={pages.length}
          draftCount={draftCount}
          categoryCount={snapshot.outline.categories.length}
          created={created}
          updated={updated}
        />
        <PagesCard slug={snapshot.slug} outlineHref={outlineHref} pages={pages} />

        <section
          className={`${CARD_CLASSES} border-(--zdo-pj-danger-edge)`}
          aria-label="Danger zone"
        >
          <div className="border-b border-(--zdo-pj-danger-edge) px-hsp-lg py-vsp-xs">
            <h2 className={`${CARD_HEADING_CLASSES} text-(--zdo-pj-tone-danger)`}>
              Danger zone
            </h2>
          </div>

          <div className="flex items-center justify-between gap-hsp-xl px-hsp-lg py-vsp-sm">
            <div>
              <b className="block text-small font-semibold text-fg">Duplicate project</b>
              <p className="mt-vsp-2xs text-caption text-muted">
                Creates a copy with all {pluralize(pages.length, "page")} and the same
                theme.
              </p>
            </div>
            <button
              type="button"
              className={BTN_GHOST}
              disabled={busy !== null}
              onClick={onDuplicate}
            >
              {busy === "duplicate" ? "Duplicating…" : "Duplicate"}
            </button>
          </div>

          {confirmingDelete ? (
            <div className="border-t border-(--zdo-pj-danger-edge) bg-(--zdo-pj-wash-danger) px-hsp-lg py-vsp-sm">
              <p className="text-small font-semibold text-(--zdo-pj-tone-danger)">
                Delete “{snapshot.title}”?
              </p>
              <p className="mt-vsp-2xs text-caption text-fg-mild">
                Removes {pluralize(pages.length, "page")}
                {draftCount > 0 ? ` (${pluralize(draftCount, "draft")})` : ""}. This
                can’t be undone from the UI.
              </p>
              <div className="mt-vsp-sm flex gap-hsp-sm">
                <button
                  type="button"
                  className={BTN_DANGER}
                  disabled={busy !== null}
                  onClick={onConfirmDelete}
                >
                  {busy === "delete" ? "Deleting…" : "Delete project"}
                </button>
                <button
                  type="button"
                  className={BTN_GHOST}
                  disabled={busy !== null}
                  onClick={onCancelDelete}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-hsp-xl border-t border-border px-hsp-lg py-vsp-sm">
              <div>
                <b className="block text-small font-semibold text-fg">Delete project</b>
                <p className="mt-vsp-2xs text-caption text-muted">
                  Permanently removes this project and its{" "}
                  {pluralize(pages.length, "page")}.
                </p>
              </div>
              <button
                type="button"
                className={BTN_DANGER_GHOST}
                disabled={busy !== null}
                onClick={onRequestDelete}
              >
                Delete…
              </button>
            </div>
          )}

          {actionError !== null ? (
            <p
              role="alert"
              className="border-t border-(--zdo-pj-danger-edge) px-hsp-lg py-vsp-xs text-caption text-(--zdo-pj-tone-danger)"
            >
              {actionError}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function ThemeCard({
  snapshot,
  mode,
}: {
  snapshot: ProjectDirectorySnapshot;
  mode: ColorSchemeMode;
}) {
  const preset = snapshot.preset;
  const pack = packForPreset(preset);
  const hasTheme = preset?.themePack !== undefined;

  return (
    <section
      className={`${CARD_CLASSES} grid grid-cols-[auto_minmax(0,1fr)] gap-hsp-xl p-hsp-lg`}
      aria-label="Theme"
    >
      <PackMiniPreview pack={pack} mode={mode} />
      <div className="flex min-w-0 flex-col items-start">
        <div className={CARD_HEADING_CLASSES}>Theme pack</div>
        {hasTheme ? (
          <>
            <div className="mt-vsp-2xs text-title font-semibold text-fg">
              {pack?.name ?? preset?.themePack}
            </div>
            {pack !== null ? (
              <p className="mt-vsp-2xs text-caption text-muted">{pack.description}</p>
            ) : (
              <p className="mt-vsp-2xs text-caption text-muted">
                This pack is not in the installed catalog.
              </p>
            )}
            {pack !== null ? (
              <div className="mt-vsp-sm">
                <PackSwatchRow pack={pack} mode={mode} />
              </div>
            ) : null}
            {preset?.defaultMode !== undefined ? (
              <dl className="mt-vsp-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-hsp-lg gap-y-vsp-2xs text-caption">
                <dt className="text-muted">Default mode</dt>
                <dd className="text-fg-mild capitalize">{preset.defaultMode}</dd>
              </dl>
            ) : null}
          </>
        ) : (
          <>
            <div className="mt-vsp-2xs text-title font-semibold text-fg">
              No theme chosen
            </div>
            <p className="mt-vsp-2xs text-caption text-muted">
              This project renders with the stock zudo-doc look. Pick a theme pack when
              creating a project to change it.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function StatTiles({
  pageCount,
  draftCount,
  categoryCount,
  created,
  updated,
}: {
  pageCount: number;
  draftCount: number;
  categoryCount: number;
  created: string | null;
  updated: string | null;
}) {
  const tiles: Array<[string, string]> = [
    ["Pages", String(pageCount)],
    ["Drafts", String(draftCount)],
    ["Categories", String(categoryCount)],
    // Old projects have no timestamps — show nothing rather than a fake value.
    ...(created !== null ? ([["Created", created]] as Array<[string, string]>) : []),
    ...(updated !== null ? ([["Updated", updated]] as Array<[string, string]>) : []),
  ];

  return (
    <section className={`${CARD_CLASSES} flex`} aria-label="Project stats">
      {tiles.map(([label, value], index) => (
        <div
          key={label}
          className={`flex-1 px-hsp-lg py-vsp-xs ${index > 0 ? "border-l border-border" : ""}`}
        >
          <b className="block text-title font-semibold tabular-nums text-fg">{value}</b>
          <small className="mt-vsp-2xs block text-caption uppercase tracking-(--zdo-pj-label-tracking) text-muted">
            {label}
          </small>
        </div>
      ))}
    </section>
  );
}

function PagesCard({
  slug,
  outlineHref,
  pages,
}: {
  slug: string;
  outlineHref: string;
  pages: readonly OrderedPage[];
}) {
  return (
    <section className={CARD_CLASSES} aria-label="Pages">
      <div className="flex items-center justify-between gap-hsp-md border-b border-border px-hsp-lg py-vsp-xs">
        <h2 className={CARD_HEADING_CLASSES}>Pages</h2>
        <span className="text-caption text-muted">In outline order</span>
      </div>
      {pages.length === 0 ? (
        <p className="px-hsp-lg py-vsp-sm text-small text-muted">
          No pages yet. Add some from the{" "}
          <a
            href={outlineHref}
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            outline
          </a>
          .
        </p>
      ) : (
        <ul className="px-hsp-sm py-vsp-xs">
          {pages.map((page) => (
            <li key={page.id}>
              <a
                href={formatRoute({ name: "editor", projectSlug: slug, pageId: page.id })}
                className={PAGE_ROW_CLASSES}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-small font-medium text-fg">
                    {page.title}
                  </span>
                  <span className="truncate font-mono text-caption text-muted">
                    {page.categoryTitle ? `${page.categoryTitle} · ` : ""}
                    {page.slug}
                  </span>
                </span>
                {page.draft === true ? (
                  <span className={DRAFT_CHIP_CLASSES}>Draft</span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
