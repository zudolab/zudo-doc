// Typed hash router — no dependency. Three routes:
//   #/outline                        (default)
//   #/editor/:pageId
//   #/popped-out/preview/:pageId
//
// Route-file ownership contract (epic #3327): this file + routes.tsx are
// the shell's — later sub-issues that build out a feature surface replace
// ONLY their own `src/features/<x>/route.tsx` stub, never this router or
// the route map in routes.tsx.

export type Route =
  | { name: "outline" }
  | { name: "editor"; pageId: string }
  | { name: "popped-out-preview"; pageId: string };

const DEFAULT_ROUTE: Route = { name: "outline" };

function normalizeHash(hash: string): string {
  return hash.replace(/^#/, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

/** `decodeURIComponent` throws `URIError` on a malformed percent-encoded
 * sequence (e.g. a bare "%" or a truncated UTF-8 escape) instead of
 * returning a value — decode defensively so a malformed pageId segment
 * falls back to the default route like any other malformed hash, rather
 * than throwing out of `parseRoute` (which runs before the shell mounts —
 * an uncaught throw there would leave the page blank). */
function decodePageId(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Parse a `location.hash` string into a Route. Unknown/malformed hashes
 * (including the empty hash) fall back to the default outline route. */
export function parseRoute(hash: string): Route {
  const segments = normalizeHash(hash).split("/").filter(Boolean);
  const [first, second, third] = segments;

  if (segments.length === 1 && first === "outline") {
    return { name: "outline" };
  }

  if (segments.length === 2 && first === "editor" && second) {
    const pageId = decodePageId(second);
    if (pageId !== null) {
      return { name: "editor", pageId };
    }
  }

  if (
    segments.length === 3 &&
    first === "popped-out" &&
    second === "preview" &&
    third
  ) {
    const pageId = decodePageId(third);
    if (pageId !== null) {
      return { name: "popped-out-preview", pageId };
    }
  }

  return DEFAULT_ROUTE;
}

/** Inverse of parseRoute: build a `location.hash`-ready string (including
 * the leading `#`) for a given Route. */
export function formatRoute(route: Route): string {
  switch (route.name) {
    case "outline":
      return "#/outline";
    case "editor":
      return `#/editor/${encodeURIComponent(route.pageId)}`;
    case "popped-out-preview":
      return `#/popped-out/preview/${encodeURIComponent(route.pageId)}`;
    default: {
      const exhaustive: never = route;
      return exhaustive;
    }
  }
}

/** True when `hash` addresses the chrome-less pop-out preview route. Used
 * by main.tsx to branch BEFORE mounting the shell. */
export function isPoppedOutHash(hash: string): boolean {
  return parseRoute(hash).name === "popped-out-preview";
}

export function readCurrentRoute(): Route {
  return parseRoute(window.location.hash);
}

export function navigateTo(route: Route): void {
  window.location.hash = formatRoute(route);
}

/** Subscribe to hash-driven route changes. Returns an unsubscribe function
 * (suitable as a `useEffect` cleanup). */
export function subscribeRouteChanged(
  listener: (route: Route) => void,
): () => void {
  const handler = () => listener(readCurrentRoute());
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}
