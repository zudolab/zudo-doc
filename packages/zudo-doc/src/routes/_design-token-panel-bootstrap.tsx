"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// routes/_design-token-panel-bootstrap — the ROUTES-ONLY configured
// design-token-panel island (#3396, epic #3394).
//
// WHY THIS FILE EXISTS: `virtual:zudo-doc-design-token-panel-config` is
// registered by the routes plugin, so any module that imports it statically
// drags the plugin along as a hard requirement. Until #3396 that importer was
// `../design-token-panel-bootstrap.tsx`, which `chrome/derive.tsx` imports —
// meaning `@takazudo/zudo-doc/chrome` could not be bundled outside a zfb build
// (or by a `packageOwnedRoutes: false` host) without aliasing the specifier.
// Moving the import HERE confines it to the routes graph, which zfb always
// bundles with the plugin active.
//
// WHY A COMPONENT AND NOT A SETTER: the route/SSR module graph and the
// hydrated island bundle are SEPARATE graphs. A `setPanelConfigBuilder(...)`
// called while `_chrome.tsx` evaluates would configure only the server-side
// copy of the bootstrap module; the client bundle re-evaluates that module
// independently and would keep the package default. Passing the builder as an
// argument from a component that lives INSIDE the island bundle is the only
// shape that survives the boundary.
//
// ISLAND-SCANNER CONTRACT (#2480 lesson): `_chrome.tsx` imports this module
// STATICALLY and threads the component into `hostBindings`, so the scanner
// walks route → _chrome → here. The exported binding identifier and the
// `displayName` must stay IDENTICAL — zfb registers islands by the
// scanner-visible export name, and a marker whose name has no registry entry
// silently never hydrates. The name must also stay DISTINCT from
// `DesignTokenPanelBootstrap`: `chrome/derive.tsx` still statically imports
// that package default (it is the slot default for bare `createChrome`
// callers), so both components are in the scanned graph and a shared name
// would trip zfb's "island marker name collision" warning and drop one of them.

import type { JSX } from "preact";
import { runDesignTokenPanelBootstrapOnce } from "../design-token-panel-bootstrap.js";
// Host-callables channel, third virtual module (#2658, mirrors #2501's
// chromeBindingsModule): absent `settings.designTokenPanelConfigModule` →
// re-exports the package default (`@takazudo/zudo-doc/design-token-panel-config`);
// present → re-exports the host's module. Registered unconditionally by the
// routes plugin (`../plugins/routes.ts`) whenever `packageOwnedRoutes` is on.
// Not present on disk; the package ships ambient typings for it
// (`./_virtual.d.ts`).
import { buildDesignTokenPanelConfig } from "virtual:zudo-doc-design-token-panel-config";

/**
 * The design-token-panel island injected routes mount instead of the package
 * default: identical behavior, except the mode-scoped `PanelConfig` builder is
 * the one the routes plugin resolved — the host's
 * `settings.designTokenPanelConfigModule` when set, the package default
 * otherwise.
 *
 * Renders `null` on both SSR and client (the panel self-mounts as a side
 * effect of `bootstrapDesignTokenPanel`), matching the package default's
 * non-`ssrFallback` `Island({ when: "load" })` shape.
 */
export function ConfiguredDesignTokenPanelBootstrap(): JSX.Element | null {
  runDesignTokenPanelBootstrapOnce(buildDesignTokenPanelConfig, "configured");
  return null;
}
ConfiguredDesignTokenPanelBootstrap.displayName = "ConfiguredDesignTokenPanelBootstrap";
