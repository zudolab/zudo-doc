// Package route entrypoint: /robots.txt — package-owned equivalent of
// pages/robots.txt.tsx (epic Package-First Finale #2356, A1 #2361).
//
// Reads `settings` from the route-context virtual module via `_context` and
// renders through the package `renderRobots` (`@takazudo/zudo-doc/robots`).
// Dormant unless `settings.packageOwnedRoutes` is on (and even then dropped if
// the user's `pages/robots.txt.tsx` stub is present — Decision 6).

import { renderRobots } from "../robots.js";
import { settings } from "./_context.js";

export const contentType = "text/plain";
export default () => renderRobots(settings);
