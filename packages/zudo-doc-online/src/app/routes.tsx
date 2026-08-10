// Route-file ownership contract (epic #3327): THIS file maps each route to
// a lazy import of its feature stub (src/features/<x>/route.js). Feature
// sub-issues replace ONLY their own stub file — never this map.
import { Suspense, lazy } from "preact/compat";
import type { Route } from "./router.js";

const ProjectsRoute = lazy(() => import("../features/projects/route.js"));
const NewProjectRoute = lazy(() => import("../features/projects/new-route.js"));
const OutlineRoute = lazy(() => import("../features/outline/route.js"));
const EditorRoute = lazy(() => import("../features/editor/route.js"));
const PoppedOutPreviewRoute = lazy(() => import("../features/popout/route.js"));

export interface RouteViewProps {
  route: Route;
}

export function RouteView({ route }: RouteViewProps) {
  return (
    <Suspense fallback={<div className="p-hsp-xl text-muted">Loading…</div>}>
      {renderRoute(route)}
    </Suspense>
  );
}

function renderRoute(route: Route) {
  switch (route.name) {
    case "projects":
      return <ProjectsRoute />;
    case "new-project":
      return <NewProjectRoute />;
    case "outline":
      return <OutlineRoute projectSlug={route.projectSlug} />;
    case "editor":
      return <EditorRoute projectSlug={route.projectSlug} pageId={route.pageId} />;
    case "popped-out-preview":
      return (
        <PoppedOutPreviewRoute projectSlug={route.projectSlug} pageId={route.pageId} />
      );
  }
}
