// Typed hash router — no dependency. Five routes:
//   #/                                        (default — projects dashboard)
//   #/new                                     (new-project stub)
//   #/p/:slug/outline
//   #/p/:slug/editor/:pageId
//   #/p/:slug/popped-out/preview/:pageId
//
// Legacy (pre-multi-project) hashes keep working — `#/outline`,
// `#/editor/:pageId`, `#/popped-out/preview/:pageId` — and parse to the
// project-scoped equivalent using `LEGACY_FALLBACK_SLUG` (app/project.ts).
//
// Route-file ownership contract (epic #3327 / #3345): this file + routes.tsx
// are the shell's — later sub-issues that build out a feature surface
// replace ONLY their own `src/features/<x>/route.tsx` stub, never this
// router or the route map in routes.tsx.

import { LEGACY_FALLBACK_SLUG } from "./project.js";

export type Route =
  | { name: "projects" }
  | { name: "new-project" }
  | { name: "outline"; projectSlug: string }
  | { name: "editor"; projectSlug: string; pageId: string }
  | { name: "popped-out-preview"; projectSlug: string; pageId: string };

const DEFAULT_ROUTE: Route = { name: "projects" };

function normalizeHash(hash: string): string {
  return hash.replace(/^#/, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

/** `decodeURIComponent` throws `URIError` on a malformed percent-encoded
 * sequence (e.g. a bare "%" or a truncated UTF-8 escape) instead of
 * returning a value — decode defensively so a malformed segment falls back
 * to the default route like any other malformed hash, rather than throwing
 * out of `parseRoute` (which runs before the shell mounts — an uncaught
 * throw there would leave the page blank). */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Parse a `location.hash` string into a Route. Unknown/malformed hashes
 * (including the empty hash) fall back to the default projects route. */
export function parseRoute(hash: string): Route {
  const segments = normalizeHash(hash).split("/").filter(Boolean);
  const [first, second, third, fourth, fifth] = segments;

  if (segments.length === 0) {
    return { name: "projects" };
  }

  if (segments.length === 1 && first === "new") {
    return { name: "new-project" };
  }

  // Legacy, un-scoped hashes — land on the seeded fallback slug.
  if (segments.length === 1 && first === "outline") {
    return { name: "outline", projectSlug: LEGACY_FALLBACK_SLUG };
  }

  if (segments.length === 2 && first === "editor" && second) {
    const pageId = decodeSegment(second);
    if (pageId !== null) {
      return { name: "editor", projectSlug: LEGACY_FALLBACK_SLUG, pageId };
    }
  }

  if (
    segments.length === 3 &&
    first === "popped-out" &&
    second === "preview" &&
    third
  ) {
    const pageId = decodeSegment(third);
    if (pageId !== null) {
      return {
        name: "popped-out-preview",
        projectSlug: LEGACY_FALLBACK_SLUG,
        pageId,
      };
    }
  }

  // Project-scoped routes: #/p/:slug/...
  if (first === "p" && second) {
    const projectSlug = decodeSegment(second);
    if (projectSlug === null) return DEFAULT_ROUTE;

    if (segments.length === 3 && third === "outline") {
      return { name: "outline", projectSlug };
    }

    if (segments.length === 4 && third === "editor" && fourth) {
      const pageId = decodeSegment(fourth);
      if (pageId !== null) return { name: "editor", projectSlug, pageId };
    }

    if (
      segments.length === 5 &&
      third === "popped-out" &&
      fourth === "preview" &&
      fifth
    ) {
      const pageId = decodeSegment(fifth);
      if (pageId !== null) {
        return { name: "popped-out-preview", projectSlug, pageId };
      }
    }
  }

  return DEFAULT_ROUTE;
}

/** Inverse of parseRoute: build a `location.hash`-ready string (including
 * the leading `#`) for a given Route. Slug and pageId segments are always
 * URI-encoded. */
export function formatRoute(route: Route): string {
  switch (route.name) {
    case "projects":
      return "#/";
    case "new-project":
      return "#/new";
    case "outline":
      return `#/p/${encodeURIComponent(route.projectSlug)}/outline`;
    case "editor":
      return `#/p/${encodeURIComponent(route.projectSlug)}/editor/${encodeURIComponent(route.pageId)}`;
    case "popped-out-preview":
      return `#/p/${encodeURIComponent(route.projectSlug)}/popped-out/preview/${encodeURIComponent(route.pageId)}`;
    default: {
      const exhaustive: never = route;
      return exhaustive;
    }
  }
}

/** The project slug a route addresses, or `null` for a route with no
 * project context (`projects`, `new-project`). */
export function routeProjectSlug(route: Route): string | null {
  return route.name === "projects" || route.name === "new-project"
    ? null
    : route.projectSlug;
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
