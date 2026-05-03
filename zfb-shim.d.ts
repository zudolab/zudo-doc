// Local type shim for `zfb/config`.
//
// The `@takazudo/zfb` package itself now resolves through a local
// `file:` dep on `~/repos/myoss/zfb/packages/zfb` (see root
// `package.json`), so its types come from the real package and no
// ambient declaration is needed.
//
// `zfb/config` is a *virtual* module aliased internally by the zfb
// build tool at parse time — no real file backs it in `node_modules`.
// The declaration below is what lets `zfb.config.ts` (and any future
// helper importing from `zfb/config`) typecheck under `pnpm check`.
//
// The real public types live in the zfb repo and mirror these shapes
// one-for-one — keep the two in sync.

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
    /**
     * Strip `.md` / `.mdx` from in-page `<a href>` paths and append a
     * trailing `/` so author-written `[label](other.mdx)` references
     * resolve to the rendered route URL. Mirrors Config::strip_md_ext
     * in crates/zfb/src/config.rs (zudolab/zfb#131).
     */
    stripMdExt?: boolean;
  }

  /**
   * Identity helper: returns the supplied config as-is, but typed
   * against `ZfbConfig`. Use as the default export of `zfb.config.ts`.
   */
  export function defineConfig(config: ZfbConfig): ZfbConfig;
}
