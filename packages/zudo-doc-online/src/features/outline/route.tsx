// The #/outline route. Route-file ownership contract (epic #3327): this is
// the outline feature's own stub file — `src/app/routes.tsx` and `router.ts`
// stay the shell's.
//
// Everything this file does is wiring: build the HTTP provider, wrap it in
// the revision coordinator so every mutation is serialized against one
// always-current revision, open the SSE stream, and hand all three to
// `OutlinePage`. The props exist so a test (or a future offline mode) can
// swap in the memory provider without this file knowing.
import { lazy } from "preact/compat";
import { useMemo } from "preact/hooks";
import { DEFAULT_PROJECT_SLUG } from "../../app/project.js";
import { getClientId } from "../../store/client-id.js";
import { ProjectEventsClient } from "../../store/events.js";
import { createHttpProjectStore } from "../../store/http-provider.js";
import { createCoordinatedStore } from "../../store/revision-coordinator.js";
import { OutlinePage } from "./outline-page.js";
import type { OutlineViewComponent } from "./view-props.js";

/** Re-exported for the surfaces that already import it from here. */
export { DEFAULT_PROJECT_SLUG };

/**
 * Zero-touch mount seam for the board view (#3337): dropping a
 * `board-view.tsx` next to this file that default-exports a component taking
 * `OutlineViewProps` is enough for the view switch to offer it. The glob
 * resolves to `{}` while that file does not exist, which is why this compiles
 * and runs today — and why #3337 does not have to edit any file the outline
 * surface owns.
 */
const boardModules = import.meta.glob("./board-view.tsx");

/**
 * `0` is a deliberate placeholder: the coordinator adopts the real revision
 * from the first `loadSnapshot()` (reads adopt, per `revision-coordinator.ts`)
 * and only ever moves forward from there, so no mutation can be sent with it.
 */
const UNKNOWN_REVISION = 0;

export interface OutlineRouteProps {
  projectSlug?: string;
  /** Overrides the auto-discovered board view; used by tests. */
  boardView?: OutlineViewComponent | undefined;
}

export default function OutlineRoute({
  projectSlug = DEFAULT_PROJECT_SLUG,
  boardView,
}: OutlineRouteProps = {}) {
  const wiring = useMemo(() => {
    const clientId = getClientId();
    const provider = createHttpProjectStore({ projectSlug, clientId });
    const coordinated = createCoordinatedStore(provider, UNKNOWN_REVISION);
    const events = new ProjectEventsClient({ projectSlug, clientId });
    return { ...coordinated, events };
  }, [projectSlug]);

  const resolvedBoardView = useMemo(
    () => boardView ?? discoverBoardView(),
    [boardView],
  );

  return (
    <OutlinePage
      store={wiring.store}
      coordinator={wiring.coordinator}
      events={wiring.events}
      boardView={resolvedBoardView}
    />
  );
}

function discoverBoardView(): OutlineViewComponent | undefined {
  const load = boardModules["./board-view.tsx"];
  if (load === undefined) return undefined;
  return lazy(async () => {
    const module = (await load()) as { default: OutlineViewComponent };
    return { default: module.default };
  }) as unknown as OutlineViewComponent;
}
