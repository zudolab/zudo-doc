// Ambient typing for the route-context virtual module emitted by the routes
// plugin (`addVirtualModule("virtual:zudo-doc-route-context", …)`). The module
// has no on-disk source — it is materialised at build by the zfb plugin runtime
// — so this declaration gives the package route entrypoints a typed import.
//
// The payload is SERIALIZABLE DATA ONLY (ADR Decision 1): `settings`,
// `translations`, `tagVocabulary`. `_context.ts` narrows it to the concrete
// `RouteContextPayload` at the seam.
declare module "virtual:zudo-doc-route-context" {
  export const routeContext: {
    settings: unknown;
    translations: Record<string, Record<string, string>>;
    tagVocabulary: ReadonlyArray<Record<string, unknown>>;
  };
}
