// Local type shims for `zfb/config` and `@takazudo/zfb`.
//
// During the Astro→zfb migration, the `zfb` npm package is not yet
// published (Phase A engine has landed in the zfb repo's main branch but
// publish is deferred — see super-epic zudolab/zudo-doc#473). The zfb
// build tool internally aliases `zfb/config` to its own stub at parse
// time, so the runtime import works once the build runs through zfb.
//
// These `.d.ts` declarations exist purely so that:
//   - `zfb.config.ts` (and any future helper importing from `zfb/config`)
//     typechecks under `pnpm check` today.
//   - `.astro` and `.mdx` files that import `{ Island } from "@takazudo/zfb"`
//     (Phase A migration scaffold, islands-wrap topic) typecheck correctly.
//
// The real public types live in the zfb repo and mirror these shapes
// one-for-one — keep the two in sync.
//
// Runtime resolution: a Vite alias in `astro.config.ts` maps
// `"@takazudo/zfb"` → `"./src/components/island.tsx"` so the build
// resolves to the local Phase-A stub.

// ─── @takazudo/zfb ───────────────────────────────────────────────────────────
// Minimal ambient declaration for the `Island` hydration-boundary primitive.
// The concrete implementation is the local stub in
// `src/components/island.tsx`; this declaration lets TypeScript typecheck
// imports of `{ Island } from "@takazudo/zfb"` without requiring the real
// (unpublished) package in `node_modules`.

declare module "@takazudo/zfb" {
  /** Hydration scheduling strategy. */
  export type IslandWhen = "load" | "idle" | "visible" | "media";

  export interface IslandProps {
    /** When to hydrate on the client. */
    when?: IslandWhen;
    /** Fallback rendered server-side (SSR-skip mode). */
    ssrFallback?: unknown;
    children?: unknown;
  }

  /**
   * Island hydration-boundary wrapper. Replaces Astro `client:*` directives.
   * Usage: `<Island when="load"><MyComponent /></Island>`
   */
  export function Island(props: IslandProps): unknown;
}

// ─── zfb/config ──────────────────────────────────────────────────────────────

declare module "zfb/config" {
  /** JSX framework runtime. */
  export type Framework = "preact" | "react";

  /** A content collection registered with the zfb engine. */
  export interface CollectionDef {
    /** Identifier used at the call site (e.g. `"docs"`). */
    name: string;
    /** Directory (relative to the project root) holding the entries. */
    path: string;
    /**
     * Optional schema. Reserved for v1.1 — accepted but not enforced
     * today. Authored as zod and converted to JSON Schema via
     * `z.toJSONSchema()` at the boundary.
     */
    schema?: Record<string, unknown>;
  }

  /** Tailwind options; absent = defaults. */
  export interface TailwindConfig {
    enabled?: boolean;
  }

  /** User-supplied plugin configuration entry. */
  export interface PluginConfig {
    name: string;
    options?: Record<string, unknown>;
  }

  /** Mirrors the Rust `Config` struct one-for-one. */
  export interface ZfbConfig {
    outDir?: string;
    publicDir?: string;
    host?: string;
    port?: number;
    framework?: Framework;
    collections?: CollectionDef[];
    tailwind?: TailwindConfig;
    plugins?: PluginConfig[];
    adapter?: string;
  }

  /**
   * Identity helper: returns the supplied config as-is, but typed
   * against `ZfbConfig`. Use as the default export of `zfb.config.ts`.
   */
  export function defineConfig(config: ZfbConfig): ZfbConfig;
}
