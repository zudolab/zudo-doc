// Route-file ownership contract (epic #3327): THIS file maps each route to
// a lazy import of its feature stub (src/features/<x>/route.js). Feature
// sub-issues replace ONLY their own stub file — never this map.
import { Suspense, lazy } from "preact/compat";
import type { Route } from "./router.js";

const ProjectsRoute = lazy(() => import("../features/projects/route.js"));
const NewProjectRoute = lazy(() => import("../features/new-project/route.js"));
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
    // `key={route.projectSlug}` on every project-scoped surface: navigating
    // straight from one project's outline/editor to ANOTHER project's same
    // surface would otherwise reuse the component instance, so project-scoped
    // child state (outline snapshot + its revision guard, open tabs, save
    // machines) would survive into a store that now points at a different
    // project. Keying forces a remount so all of it is rebuilt from scratch.
    case "outline":
      return <OutlineRoute key={route.projectSlug} projectSlug={route.projectSlug} />;
    case "editor":
      return (
        <EditorRoute
          key={route.projectSlug}
          projectSlug={route.projectSlug}
          pageId={route.pageId}
        />
      );
    case "popped-out-preview":
      return (
        <PoppedOutPreviewRoute
          key={route.projectSlug}
          projectSlug={route.projectSlug}
          pageId={route.pageId}
        />
      );
  }
}
