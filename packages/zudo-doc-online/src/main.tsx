import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import "./styles/global.css";
import { DEFAULT_PROJECT_SLUG } from "./app/project.js";
import { RouteView } from "./app/routes.js";
import { Shell } from "./app/shell.js";
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
  // every surface still builds its own coordinated store for mutations.
  const store = useMemo(
    () => createHttpProjectStore({ projectSlug: DEFAULT_PROJECT_SLUG }),
    [],
  );

  return (
    <Shell route={route} store={store}>
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
