// Local type shim for `zfb/config`.
//
// During the Astro→zfb migration, the `zfb` npm package is not yet
// published (Phase A engine has landed in the zfb repo's main branch but
// publish is deferred — see super-epic zudolab/zudo-doc#473). The zfb
// build tool internally aliases `zfb/config` to its own stub at parse
// time, so the runtime import works once the build runs through zfb.
//
// This `.d.ts` exists purely so that `zfb.config.ts` (and any future
// helper that imports from `zfb/config`) typechecks under `pnpm check`
// today, without dragging in `zfb` as a runtime dependency. The real
// public types live in `packages/zfb/src/config.ts` of the zfb repo and
// mirror this shape one-for-one — keep the two in sync.

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
