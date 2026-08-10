// Route-file ownership contract (epic #3327): THIS file maps each route to
// a lazy import of its feature stub (src/features/<x>/route.tsx). Feature
// sub-issues replace ONLY their own stub file — never this map.
import { Suspense, lazy } from "preact/compat";
import type { Route } from "./router.js";

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
    case "outline":
      return <OutlineRoute />;
    case "editor":
      return <EditorRoute pageId={route.pageId} />;
    case "popped-out-preview":
      return <PoppedOutPreviewRoute pageId={route.pageId} />;
  }
}
