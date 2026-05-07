// Top-level type shim for `@takazudo/zfb-runtime`.
//
// The v2 package intentionally does NOT list `@takazudo/zfb-runtime` as a
// runtime dependency (matches the `@takazudo/zfb` pattern in
// `_zfb-shim.d.ts` — npm publish is deferred per super-epic #473). The
// host project provides the real package; this `.d.ts` only widens types
// so the doc-layout shell can import `<ViewTransitions />` without
// pulling the workspace dep into the package's manifest.
//
// The real public types live in `packages/zfb-runtime/src/view-transitions.ts`
// of the zfb repo. We mirror only the shape this package needs (the
// `<ViewTransitions />` component); other zfb-runtime exports stay
// off the v2 package's surface intentionally.

declare module "@takazudo/zfb-runtime" {
  /**
   * Structural VNode shape returned by `<ViewTransitions />`. Mirrors the
   * shape used by zfb's `Island` wrapper so both Preact and React SSR
   * renderers accept it without pulling either framework's VNode types
   * into the v2 package.
   */
  export type ViewTransitionsElement = {
    readonly type: string;
    readonly props: Readonly<Record<string, unknown>>;
    readonly key: unknown;
  };

  /**
   * `<ViewTransitions />` — back-compat typed no-op. Returns `[]` and emits
   * no DOM; kept so existing mounts in `<head>` continue to compile unchanged.
   *
   * Cross-document soft-swap navigation now ships via the upstream
   * `<ClientRouter />` component (Takazudo/zudo-front-builder PR #224,
   * zudolab/zudo-doc#1510 W5A). Mounting `<ClientRouter />` is the supported
   * opt-in going forward. This consumer's transition integration switches
   * from Strategy A (CSS `@view-transition { navigation: auto; }` at-rule in
   * `src/styles/global.css`) to Strategy B (`<ClientRouter />` mount) in
   * W6A/W6B (next wave of zudolab/zudo-doc#1510); the at-rule remains as
   * the current wiring until that switch lands.
   */
  export function ViewTransitions(): readonly ViewTransitionsElement[];
}
