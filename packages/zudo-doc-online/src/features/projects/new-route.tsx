/**
 * The `#/new` route: a placeholder stub so navigation compiles ahead of the
 * real creation wizard (#3351, wave 2 of epic #3345).
 *
 * Route-file ownership contract (epic #3327 / #3345): `src/app/routes.tsx`
 * and `router.ts` stay the shell's — this is this feature's own stub, and
 * the wizard sub-issue replaces it wholesale.
 */

import { formatRoute } from "../../app/router.js";

const PANE_PADDING = "px-hsp-2xl py-vsp-lg";

const BACK_LINK =
  "text-small text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export default function NewProjectRoute() {
  return (
    <section className={`flex h-full min-h-[0px] flex-col gap-vsp-sm ${PANE_PADDING}`}>
      <h1 className="text-title font-semibold text-fg">New project</h1>
      <p className="text-body text-muted">
        The project creation wizard is coming in a later sub-issue.
      </p>
      <a href={formatRoute({ name: "projects" })} className={BACK_LINK}>
        Back to projects
      </a>
    </section>
  );
}
