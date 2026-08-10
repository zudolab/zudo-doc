/**
 * The `#/` route: a minimal, placeholder projects dashboard (#3347).
 *
 * Deliberately dumb — a plain `fetch` of the EXISTING `GET /api/projects`
 * listing route (no store wiring, no revision coordinator, no SSE), so this
 * sub-issue stays parallel-safe with its wave-1 sibling (#3348), which owns
 * the real `src/store/` projects-directory seam this file does NOT use. The
 * wave-2 dashboard (#3350) replaces this file wholesale — nothing here is
 * meant to survive that sub-issue.
 *
 * Route-file ownership contract (epic #3327 / #3345): `src/app/routes.tsx`
 * and `router.ts` stay the shell's — this is this feature's own stub.
 */

import { useEffect, useState } from "preact/hooks";
import { formatRoute } from "../../app/router.js";

/** The `GET /api/projects` (no `?summary=1`) shape — epic #3345's locked wire contract. */
interface ProjectListEntry {
  slug: string;
  title: string;
  revision: number;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; projects: ProjectListEntry[] };

const PANE_PADDING = "px-hsp-2xl py-vsp-lg";

const NEW_PROJECT_LINK =
  "inline-flex items-center gap-hsp-xs rounded-sm bg-accent px-hsp-md py-vsp-2xs text-small font-medium text-accent-fg hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const PROJECT_TITLE_LINK =
  "text-body font-semibold text-fg hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export interface ProjectsRouteProps {
  /** Test seam: injectable so a spec never performs a real network call. */
  fetchImpl?: typeof fetch;
}

export default function ProjectsRoute({ fetchImpl = fetch }: ProjectsRouteProps = {}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    async function load(): Promise<void> {
      try {
        const response = await fetchImpl("/api/projects");
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}.`);
        }
        const projects = (await response.json()) as ProjectListEntry[];
        if (!cancelled) setState({ status: "ready", projects });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The editing server could not be reached.",
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchImpl]);

  return (
    <section className={`flex h-full min-h-[0px] flex-col overflow-y-auto ${PANE_PADDING}`}>
      <div className="flex flex-wrap items-center gap-hsp-md pb-vsp-lg">
        <h1 className="text-title font-semibold text-fg">Projects</h1>
        <a href={formatRoute({ name: "new-project" })} className={`ml-auto ${NEW_PROJECT_LINK}`}>
          New project
        </a>
      </div>

      {state.status === "loading" ? (
        <p className="text-body text-muted">Loading projects…</p>
      ) : state.status === "error" ? (
        <p role="alert" className="text-body text-danger">
          {state.message}
        </p>
      ) : state.projects.length === 0 ? (
        <p className="text-body text-muted">
          No projects yet. Create one to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-vsp-sm">
          {state.projects.map((project) => (
            <li
              key={project.slug}
              className="flex flex-col gap-vsp-2xs rounded-md border border-border bg-surface px-hsp-lg py-vsp-md"
            >
              <a
                href={formatRoute({ name: "outline", projectSlug: project.slug })}
                className={PROJECT_TITLE_LINK}
              >
                {project.title}
              </a>
              <span className="font-mono text-caption text-muted">{project.slug}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
