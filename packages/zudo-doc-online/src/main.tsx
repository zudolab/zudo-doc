import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import "./styles/global.css";
import { DEFAULT_PROJECT_SLUG } from "./app/project.js";
import { RouteView } from "./app/routes.js";
import { Shell } from "./app/shell.js";
import { getClientId } from "./store/client-id.js";
import { ProjectEventsClient } from "./store/events.js";
import { createHttpProjectStore } from "./store/http-provider.js";
import {
  parseRoute,
  readCurrentRoute,
  subscribeRouteChanged,
  type Route,
} from "./app/router.js";

function ShellApp() {
  const [route, setRoute] = useState<Route>(() => readCurrentRoute());

  useEffect(() => subscribeRouteChanged(setRoute), []);

  // Read-only, and only so the Editor nav link knows which page id to open —
  // every surface still builds its own coordinated store for mutations. The
  // shell outlives all of them, so it needs its own stream to notice the
  // outline changing under a link it already rendered.
  const nav = useMemo(() => {
    const store = createHttpProjectStore({ projectSlug: DEFAULT_PROJECT_SLUG });
    // A SECOND SSE connection, alongside whichever surface is mounted. Kept
    // deliberately: the API is loopback-bound and single-user, so the extra
    // subscriber is bounded bookkeeping, and sharing one stream would need a
    // shell↔feature seam that does not exist yet. Consolidation candidate for
    // the multi-tenant phase, where connection count starts to matter.
    const events = new ProjectEventsClient({
      projectSlug: DEFAULT_PROJECT_SLUG,
      clientId: getClientId(),
    });
    return { store, events };
  }, []);

  useEffect(() => {
    nav.events.connect();
    return () => nav.events.close();
  }, [nav]);

  return (
    <Shell route={route} store={nav.store} events={nav.events}>
      <RouteView route={route} />
    </Shell>
  );
}

const root = document.getElementById("root");

if (root) {
  // The pop-out preview window is a second, chrome-less mount of this same
  // app (opened as its own browser window by the pop-out feature, #3339) —
  // branch BEFORE mounting the shell so popout mode never renders the top
  // bar / nav chrome (route-file ownership contract, epic #3327). Loaded
  // dynamically (not statically imported) so the common shell path's
  // bundle never pays for a pane it won't render.
  const initialRoute = parseRoute(window.location.hash);
  if (initialRoute.name === "popped-out-preview") {
    const { default: PopoutRoute } = await import("./features/popout/route.js");
    render(<PopoutRoute pageId={initialRoute.pageId} />, root);
  } else {
    render(<ShellApp />, root);
  }
}
