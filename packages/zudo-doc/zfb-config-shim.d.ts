// Package-shipped type shim for the bare `zfb/config` specifier (#2656).
//
// `@takazudo/zfb` is consumed as a published npm package. The package
// exposes its real config types under the *scoped* subpath
// `@takazudo/zfb/config` → `dist/config.d.ts`. But `zfb.config.ts` imports
// from the *bare* specifier `zfb/config`, which zfb's build tool aliases to
// a runtime-only stub at parse time (`zfb-config-stub.mjs` — `defineConfig`
// is identity, carrying no types). No real file backs `zfb/config` in
// `node_modules`, so this ambient declaration is what supplies the
// `ZfbConfig` type to `zfb.config.ts`.
//
// Pulled into a consuming project via `tsconfig.base.json`'s
// `files: ["./zfb-config-shim.d.ts", "./virtual-modules.d.ts"]` — a project
// extending the base no longer needs its own local `zfb-shim.d.ts`.
//
// IMPORTANT — this block is the source of truth for the type `zfb check`
// (plain `tsc --noEmit`) binds against the config. An ambient `declare
// module` wins over node resolution AND over tsconfig `paths`, so it must
// be kept in sync BY HAND with the published `@takazudo/zfb/config`
// (`dist/config.d.ts`). When it lags the engine, valid config fields fail
// `pnpm check` with TS2353 (see Takazudo/zudo-front-builder#678 +
// zudolab/zudo-doc#1834 — `bundle` was missing here, blocking next.22's
// `bundle.exclude`). See `packages/zudo-doc/CLAUDE.md` ("Shipped ambient
// type shims") for the hand-sync duty this file carries.
//
// Last synced against: @takazudo/zfb 2.0.0 (`dist/config.d.ts`). The `zfb`
// 2.0.0 major removed the `githubAutolinks` markdown feature — it was never
// named here (the `markdown.features` map is modelled as an open record), so
// the removal needed no edit; the paired addition `strictContentBridge` is
// below. That same sync closed a 14-field lag this file had accumulated
// (`allowedHosts`, `prefetch`, `site`, `output`, `presets`, the watch/plugin
// knobs, `markdown.hardBreaks`, and four `CollectionDef` fields): every one
// of them was a latent TS2353 waiting for the first project to use it.

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
     * Optional schema, enforced by `zfb check`. Authored as zod and
     * converted to JSON Schema via `z.toJSONSchema()` at the boundary.
     */
    schema?: Record<string, unknown>;
    /**
     * Include globs (Astro-style, relative to `path`, `globset` dialect).
     * When set and non-empty, an entry is kept only if a pattern matches.
     */
    include?: string[];
    /** Exclude globs, evaluated AFTER `include`. */
    exclude?: string[];
    /**
     * Suffix stripped from each kept entry's slug + module specifier —
     * e.g. `".en"` so `foo.en.mdx` round-trips as slug `foo` in a
     * multi-locale single-directory layout.
     */
    idStripSuffix?: string;
    /**
     * Opt-in to a `path` that escapes the project root via `..`. Absolute
     * and Windows drive-relative paths stay rejected regardless.
     */
    allowOutsideRoot?: boolean;
  }

  /** Tailwind options; absent = defaults. */
  export interface TailwindConfig {
    enabled?: boolean;
  }

  /** Prefetch options. Mirrors `PrefetchConfig` in crates/zfb/src/config.rs. */
  export interface PrefetchConfig {
    /**
     * Disable prefetch entirely — the build emits a meta tag the runtime's
     * prefetch-core reads at init to skip all prefetch wiring. Site-wide
     * and static (decided at bundle-emit time). Default: `false`.
     */
    disabled?: boolean;
  }

  /**
   * Project output mode. `"static"` errors at build start if any route
   * exports `prerender = false`; `"hybrid"` forces V8 on; `"auto"`
   * (default) decides from the detected SSR-route set.
   */
  export type OutputMode = "static" | "hybrid" | "auto";

  /** User-supplied plugin configuration entry. */
  export interface PluginConfig {
    name: string;
    options?: Record<string, unknown>;
  }

  /** Output mode for zfb fenced-code highlighting. */
  export type CodeHighlightMode = "inline" | "class";

  /** Fixed semantic taxonomy accepted by class-mode `roleClasses`. */
  export type CodeHighlightRole =
    | "escape"
    | "operator"
    | "comment"
    | "string"
    | "number"
    | "constant"
    | "keyword"
    | "function"
    | "type"
    | "namespace"
    | "property"
    | "variable"
    | "tag"
    | "attribute"
    | "punctuation"
    | "inserted"
    | "deleted"
    | "heading";

  /** zfb inline-theme or semantic class-mode configuration. */
  export type CodeHighlightConfig = {
    theme?: string;
    themesDir?: string;
    themeLight?: string;
    themeDark?: string;
    mode?: CodeHighlightMode;
    classPrefix?: string;
    roleClasses?: Partial<Record<CodeHighlightRole, string>>;
    defaultStylesheet?: boolean;
  };

  /**
   * Bundler options. Mirrors `BundleConfig` in crates/zfb/src/config.rs
   * and the published `@takazudo/zfb/config` (`dist/config.d.ts`). Added
   * in next.22 (`bundle.exclude`, #664) and extended in next.23
   * (`mainFields` / `external`, #676).
   */
  export interface BundleConfig {
    /**
     * Project-relative, gitignore-style globs for source files the bundler
     * must NOT pull into the esbuild graph (e.g. test fixtures or
     * `*.stories.tsx`). Matched files are skipped from the shadow-tree walk
     * and dropped from any eager `import.meta.glob(...)` expansion.
     */
    exclude?: string[];
    /**
     * Explicit esbuild `main-fields` for the `--platform=neutral` page/SSR
     * pass (empty by default under `neutral`), letting CJS-`main`-only deps
     * resolve. Mirrors `BundleConfig::main_fields`.
     */
    mainFields?: string[];
    /**
     * Bare specifiers to mark external in the `--platform=neutral` pass so
     * esbuild leaves them unbundled. Mirrors `BundleConfig::external`.
     */
    external?: string[];
  }

  /** Mirrors the Rust `Config` struct one-for-one. */
  export interface ZfbConfig {
    outDir?: string;
    publicDir?: string;
    host?: string;
    port?: number;
    /**
     * Dev-server Host-header allowlist (DNS-rebinding guard, Vite parity).
     * A leading dot (`".example.com"`) also matches subdomains; IPv6 may be
     * written with or without brackets. Mirrors `Config::allowed_hosts`.
     */
    allowedHosts?: string[];
    framework?: Framework;
    collections?: CollectionDef[];
    tailwind?: TailwindConfig;
    /** Prefetch options. Mirrors `Config::prefetch`. */
    prefetch?: PrefetchConfig;
    /**
     * Fail `zfb build` on a broken link found by the `linkValidation`
     * mechanism. Build-only — `zfb dev` still warns and serves. Does NOT
     * cover `resolveMarkdownLinks.onBrokenLinks`, which has its own knob.
     * Mirrors `Config::strict_broken_links`. Default: `false`.
     */
    strictBrokenLinks?: boolean;
    /**
     * Fail `zfb build` when a collection `.md`/`.mdx` entry falls back to
     * `<pre data-zfb-content-fallback>` because its compiled JSX does not
     * parse. The CLI's `--strict-content-bridge` /
     * `--no-strict-content-bridge` tri-state overrides this field.
     * Build-only. Mirrors `Config::strict_content_bridge` (zfb 2.0.0).
     * Default: `false`.
     */
    strictContentBridge?: boolean;
    /**
     * Bundler options. `bundle.exclude` keeps project-relative globs out of
     * the esbuild graph — used e.g. to skip `e2e/fixtures/**` so the MDX link
     * resolver doesn't walk committed test-fixture trees (silences spurious
     * broken-link warnings). Mirrors `Config::bundle`.
     */
    bundle?: BundleConfig;
    plugins?: PluginConfig[];
    adapter?: string;
    /**
     * Strip `.md` / `.mdx` from in-page `<a href>` paths and append a
     * trailing `/` so author-written `[label](other.mdx)` references
     * resolve to the rendered route URL. Mirrors Config::strip_md_ext
     * in crates/zfb/src/config.rs (zudolab/zfb#131).
     */
    stripMdExt?: boolean;
    /**
     * Site base path. Prefixed onto stable HTML asset URLs (CSS / JS
     * `<link>` and `<script>` tags). Normalised to start AND end with
     * `/`; `undefined` / `""` / `"/"` all behave identically (no
     * prefix). Mirrors Config::base in crates/zfb/src/config.rs
     * (Takazudo/zudo-front-builder#154).
     */
    base?: string;
    /**
     * Configures zfb's code highlighter. Class mode is mutually exclusive
     * with every theme field and emits semantic role classes; inline mode
     * retains the single/dual theme fields for general zfb consumers.
     */
    codeHighlight?: CodeHighlightConfig;
    /**
     * Markdown link resolver (port of `remarkResolveMarkdownLinks`).
     * Mirrors `Config::resolve_markdown_links` in crates/zfb/src/config.rs
     * (Takazudo/zudo-front-builder PR #234 / zudolab/zudo-doc#1577).
     * When `enabled: true`, the build appends `ResolveLinksPlugin` to the
     * mdast pipeline so author-written `[label](./other.mdx)` links are
     * rewritten to the corresponding rendered route URL — bypassing the
     * file→directory transformation that breaks relative paths in dist
     * HTML when `foo.mdx` becomes `foo/index.html`.
     */
    resolveMarkdownLinks?: {
      enabled?: boolean;
      docsDir?: string;
      dirs?: Array<{ dir: string; routePrefix: string }>;
      onBrokenLinks?: "warn" | "error" | "ignore";
    };
    /**
     * Whether the basePath rewriter should append a trailing `/` to
     * extensionless absolute hrefs. Mirrors `Config::trailing_slash` in
     * crates/zfb/src/config.rs (Takazudo/zudo-front-builder PR #234 /
     * zudolab/zudo-doc#1579). Off by default — preserves byte-for-byte
     * parity with the pre-`trailingSlash` build for projects that
     * haven't opted in.
     */
    trailingSlash?: boolean;
    /**
     * Minify production HTML output from `zfb build`.
     * Mirrors `Config::minify_html` in crates/zfb/src/config.rs.
     */
    minifyHtml?: boolean;
    /**
     * Markdown / MDX pipeline options. Mirrors `Config::markdown` →
     * `MarkdownConfig` in crates/zfb/src/config.rs. zfb next.12 moved the
     * former-Core features under `markdown.features` and next.13 ships the
     * rest as opt-in; zudo-doc uses `markdown.features` to opt back into the
     * former-Core four plus the additional opt-in features (#1804). Each
     * `features` value is per-feature: `true` for boolean-shorthand features,
     * or an options object for object-typed features.
     */
    markdown?: {
      gfm?: boolean | Record<string, boolean>;
      toc?: Record<string, unknown>;
      externalLinks?: Record<string, unknown>;
      cjkFriendly?: boolean;
      hardBreaks?: boolean;
      features?: Record<string, boolean | Record<string, unknown>>;
    };
    /**
     * Extra paths (outside the project root) the dev watcher also watches,
     * recursively. Must exist at startup — a path created later is not
     * picked up. Opt-in only: a huge tree can exhaust the inotify
     * `max_user_watches` ceiling on Linux. Mirrors `Config::extra_watch_paths`.
     */
    extraWatchPaths?: string[];
    /**
     * Whether `zfb build` writes the post-build route manifest to
     * `<outDir>/__zfb/routes.json` — the same shape plugins receive as
     * `ctx.routes`, so a plain build script can read it without writing a
     * plugin. Mirrors `Config::emit_routes_manifest`. Default: emit.
     */
    emitRoutesManifest?: boolean;
    /**
     * Canonical absolute site URL, emitted as `globalThis.__zfb.site`.
     * Rejected at config-load time if relative, non-HTTP(S), or empty;
     * trailing-slash normalisation is the consumer's job. Mirrors
     * `Config::site`.
     */
    site?: string;
    /**
     * Seconds a single plugin lifecycle hook may run before the build fails
     * and the plugin host is killed. Absent falls through to the
     * `ZFB_PLUGIN_HOOK_TIMEOUT` env var, then a 120s default. Mirrors
     * `Config::plugin_hook_timeout_secs`.
     */
    pluginHookTimeoutSecs?: number;
    /**
     * Whether `public/` is copied under the `base` sub-path (`true`,
     * default) or flat to the `dist/` root (`false`, for deploy pipelines
     * that relocate `dist/` into the base segment themselves — note that
     * base-prefixed asset URLs then 404 under `zfb preview`). Mirrors
     * `Config::copy_public_with_base`.
     */
    copyPublicWithBase?: boolean;
    /**
     * Use `notify`'s poll-based watch backend instead of the native one —
     * for hosts where FS notifications are unreliable (network mounts, some
     * containers). Mirrors `Config::watch_poll_fallback`. Default: `false`.
     */
    watchPollFallback?: boolean;
    /**
     * Poll-backend re-scan interval in ms; only live when
     * `watchPollFallback` is `true` (set alone it is dormant + warns).
     * Validated at load time to 50–10000. Absent = 500ms. Mirrors
     * `Config::watch_poll_interval_ms`.
     */
    watchPollIntervalMs?: number;
    /** Project output mode. Mirrors `Config::output`. Default: `"auto"`. */
    output?: OutputMode;
    /**
     * Config presets merged BEFORE validation. Array fields (`plugins`,
     * `collections`, `extraWatchPaths`, `allowedHosts`) are prepended;
     * scalars fill in only where the main config left the default, so the
     * main config always wins. Nested `presets` are not expanded. Mirrors
     * `Config::presets`.
     */
    presets?: Partial<ZfbConfig>[];
  }

  /**
   * Identity helper: returns the supplied config as-is, but typed
   * against `ZfbConfig`. Use as the default export of `zfb.config.ts`.
   */
  export function defineConfig(config: ZfbConfig): ZfbConfig;
}
