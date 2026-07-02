// Ambient typing for the route-context virtual module emitted by the routes
// plugin (`addVirtualModule("virtual:zudo-doc-route-context", …)`). The module
// has no on-disk source — it is materialised at build by the zfb plugin runtime
// — so this declaration gives the package route entrypoints a typed import.
//
// The payload is SERIALIZABLE DATA ONLY (ADR Decision 1): `settings`,
// `translations`, `tagVocabulary`, `colorSchemes`. `_context.ts` narrows it
// to the concrete `RouteContextPayload` at the seam.
declare module "virtual:zudo-doc-route-context" {
  export const routeContext: {
    settings: unknown;
    translations: Record<string, Record<string, string>>;
    tagVocabulary: ReadonlyArray<Record<string, unknown>>;
    /** Host color-scheme palette map. `null` when the caller did not pass
     *  `colorSchemes` to `zudoDocPreset` — `_chrome.tsx` falls back to
     *  `DEFAULT_SCHEME` in that case. */
    colorSchemes: Record<string, unknown> | null;
  };
}

// Ambient typing for the chrome-bindings virtual module emitted by the routes
// plugin (`addVirtualModule("virtual:zudo-doc-chrome-bindings", …)`, #2501).
// No on-disk source — materialised at build, either as a re-export of the
// host's `settings.chromeBindingsModule` file or as an empty-object fallback
// when the setting is absent. See `plugins/routes.ts` and
// `docs/adr/route-injection-seam.md` ("Host-callables channel —
// chromeBindingsModule").
//
// Typed via an INLINE `import(...)` type (not a top-level import, which would
// break this file's ambient module declarations) — see
// `../factory-context/index.js` for the `ChromeHostBindings` shape.
declare module "virtual:zudo-doc-chrome-bindings" {
  export const chromeBindings: import("../factory-context/index.js").ChromeHostBindings;
}
