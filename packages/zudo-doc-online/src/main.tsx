import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import "./styles/global.css";
import { RouteView } from "./app/routes.js";
import { Shell } from "./app/shell.js";
import { getClientId } from "./store/client-id.js";
import { ProjectEventsClient } from "./store/events.js";
import { createHttpProjectStore } from "./store/http-provider.js";
import {
  parseRoute,
  readCurrentRoute,
  routeProjectSlug,
  subscribeRouteChanged,
  type Route,
} from "./app/router.js";

function ShellApp() {
  const [route, setRoute] = useState<Route>(() => readCurrentRoute());

  useEffect(() => subscribeRouteChanged(setRoute), []);

  const projectSlug = routeProjectSlug(route);

  // Read-only, and only so the Editor nav link knows which page id to open —
  // every surface still builds its own coordinated store for mutations. The
  // shell outlives all of them, so it needs its own stream to notice the
  // outline changing under a link it already rendered. Rebuilt whenever the
  // route's project slug changes (#3347) — a leftover stream/store from a
  // PREVIOUS project would otherwise keep resolving the nav link against the
  // wrong project. `null` on `projects`/`new-project` — there is no project
  // to open a stream for.
  const nav = useMemo(() => {
    if (projectSlug === null) return { store: null, events: null };
    const store = createHttpProjectStore({ projectSlug });
    // A SECOND SSE connection, alongside whichever surface is mounted. Kept
    // deliberately: the API is loopback-bound and single-user, so the extra
    // subscriber is bounded bookkeeping, and sharing one stream would need a
    // shell↔feature seam that does not exist yet. Consolidation candidate for
    // the multi-tenant phase, where connection count starts to matter.
    const events = new ProjectEventsClient({
      projectSlug,
      clientId: getClientId(),
    });
    return { store, events };
  }, [projectSlug]);

  useEffect(() => {
    if (nav.events === null) return undefined;
    const events = nav.events;
    events.connect();
    return () => events.close();
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
    render(
      <PopoutRoute
        projectSlug={initialRoute.projectSlug}
        pageId={initialRoute.pageId}
      />,
      root,
    );
  } else {
    render(<ShellApp />, root);
  }
}
