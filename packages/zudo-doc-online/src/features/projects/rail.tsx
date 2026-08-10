/**
 * The dashboard's master rail (d3's left column): live-filtering search,
 * compact project rows, and the pinned "New project" row into the wizard.
 *
 * Selection is the parent's state — rows are buttons that report a slug, not
 * links, because picking a project changes the detail pane in place rather
 * than navigating (#3350: the fast path from rail to editor is the point of
 * the surface; the route stays `#/`).
 */

import { formatRoute } from "../../app/router";
import type { ProjectListEntry } from "../../store/projects-directory";
import type { ColorSchemeMode } from "../../theme/color-scheme-sync";
import { formatTimestamp, pluralize } from "./dashboard-logic";
import { findCatalogPack, PackChip } from "./pack-swatch";

const ROW_CLASSES =
  "grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-hsp-md rounded-md px-hsp-md py-vsp-xs text-left hover:bg-(--zdo-pj-wash-hover) focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 aria-[current=true]:bg-(--zdo-pj-wash-active) aria-[current=true]:shadow-(--zdo-pj-selected-bar)";

const CLEAR_SEARCH_CLASSES =
  "text-caption font-semibold text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const NEW_PROJECT_CLASSES =
  "flex w-full items-center gap-hsp-sm rounded-md border border-dashed border-border-strong px-hsp-md py-vsp-xs text-small font-medium text-fg-mild hover:border-solid hover:border-accent hover:bg-(--zdo-pj-wash-active) hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export interface ProjectsRailProps {
  projects: readonly ProjectListEntry[];
  /** Already filtered by the parent — the rail renders what it is given. */
  visible: readonly ProjectListEntry[];
  query: string;
  onQueryChange: (query: string) => void;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  mode: ColorSchemeMode;
}

export function ProjectsRail({
  projects,
  visible,
  query,
  onQueryChange,
  selectedSlug,
  onSelect,
  mode,
}: ProjectsRailProps) {
  const trimmed = query.trim();
  return (
    <nav
      className="flex min-h-0 w-(--zdo-pj-rail) flex-none flex-col border-r border-border bg-surface"
      aria-label="Projects"
    >
      <div className="flex flex-col gap-vsp-xs px-hsp-md pt-vsp-sm pb-vsp-xs">
        <div className="flex items-baseline gap-hsp-sm px-hsp-xs text-caption font-semibold uppercase tracking-(--zdo-pj-label-tracking) text-fg-mild">
          Projects
          <span className="rounded-full bg-(--zdo-pj-wash-neutral) px-hsp-sm font-mono text-caption font-normal normal-case text-muted">
            {trimmed.length > 0 ? `${visible.length}/${projects.length}` : projects.length}
          </span>
        </div>
        <div className="relative flex items-center">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            aria-hidden="true"
            className="pointer-events-none absolute left-(--spacing-hsp-sm) text-muted"
            style={{ width: "var(--icon-xs)", height: "var(--icon-xs)" }}
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" stroke-linecap="round" />
          </svg>
          <input
            type="search"
            autocomplete="off"
            spellcheck={false}
            placeholder="Search projects"
            aria-label="Search projects"
            value={query}
            onInput={(event) => onQueryChange(event.currentTarget.value)}
            className="w-full rounded-md border border-border-strong bg-bg py-vsp-2xs pr-hsp-md pl-hsp-2xl text-small text-fg placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-hsp-sm pb-vsp-sm">
        {visible.map((project) => (
          <li key={project.slug} className="mt-vsp-2xs">
            <button
              type="button"
              className={ROW_CLASSES}
              aria-current={project.slug === selectedSlug ? "true" : undefined}
              onClick={() => onSelect(project.slug)}
            >
              <PackChip pack={findCatalogPack(project.preset?.themePack)} mode={mode} />
              <span className="flex min-w-0 flex-col">
                <span
                  className={`truncate text-small ${
                    project.slug === selectedSlug
                      ? "font-semibold text-accent"
                      : "font-medium text-fg"
                  }`}
                >
                  {project.title}
                </span>
                <span className="truncate text-caption text-muted">
                  {railMeta(project)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {visible.length === 0 && trimmed.length > 0 ? (
        <div className="flex flex-col gap-vsp-xs px-hsp-lg pb-vsp-lg text-center text-caption text-muted">
          <p>
            No projects match “
            <span className="font-semibold text-fg-mild">{trimmed}</span>”.
          </p>
          <button
            type="button"
            className={CLEAR_SEARCH_CLASSES}
            onClick={() => onQueryChange("")}
          >
            Clear search
          </button>
        </div>
      ) : null}

      <div className="border-t border-border p-hsp-sm">
        <a href={formatRoute({ name: "new-project" })} className={NEW_PROJECT_CLASSES}>
          <span
            aria-hidden="true"
            className="grid flex-none place-items-center rounded-sm bg-(--zdo-pj-wash-neutral) px-hsp-xs text-caption"
          >
            ＋
          </span>
          New project
        </a>
      </div>
    </nav>
  );
}

function railMeta(project: ProjectListEntry): string {
  const parts: string[] = [];
  if (project.pageCount !== undefined) parts.push(pluralize(project.pageCount, "page"));
  const updated = formatTimestamp(project.updatedAt);
  if (updated !== null) parts.push(updated);
  return parts.join(" · ");
}
