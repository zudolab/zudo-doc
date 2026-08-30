// zfb plugin module: routes — package-owned route injection (epic Package-First
// Finale #2356). Authoritative seam spec: `docs/adr/route-injection-seam.md`
// (pinned by A0 #2357).
//
// This plugin lets `@takazudo/zudo-doc` OWN the doc routes so a project can
// ship an (almost) empty `pages/`. It is added by the preset's `buildPlugins()`
// when package-owned docs or the asset viewer needs route injection — a bare-specifier descriptor
// (`{ name: "@takazudo/zudo-doc/plugins/routes", options }`), never an imported
// function, so the preset's node-free config eval-graph guard stays green.
//
// The single `setup(ctx)` hook does FOUR things (Decision 1, + the
// host-callables channels below):
//
//   1. addVirtualModule("virtual:zudo-doc-route-context", …) — emits the
//      route-context as ESM source carrying SERIALIZABLE DATA ONLY: the
//      project `settings`, the host UI-string `translations` table, and the
//      `tagVocabulary`. No host functions, no Preact components, no `@/`
//      imports ever travel through this module — everything callable is an
//      importable package subpath that each route entrypoint reconstructs.
//
//   2. addVirtualModule("virtual:zudo-doc-chrome-bindings", …) — the
//      HOST-CALLABLES CHANNEL (#2501, ADR "Host-callables channel —
//      chromeBindingsModule"). `ChromeHostBindings` slots
//      (`frontmatterRenderers`, `buildFrontmatterPreviewEntries`,
//      `SearchWidget`, …) are genuinely host-bound — they cannot be
//      serialized like `settings` — so instead of carrying the callables
//      themselves, `settings.chromeBindingsModule` carries a
//      project-root-relative PATH to a host module exporting a named
//      `chromeBindings: ChromeHostBindings`. A string path IS serializable
//      data, so the "virtual module = serializable data only" rule (Decision
//      1) still holds; only the loader source differs — it RE-EXPORTS the
//      host module instead of inlining JSON, and the bundler resolves the
//      actual callables through that re-export. `routes/_chrome.tsx` imports
//      this virtual module and spreads its export into `createChrome(...)`.
//      Registered UNCONDITIONALLY (the shim always imports the specifier):
//      absent setting → `export const chromeBindings = {};` (byte-identical
//      to today); present-but-missing file → a loud Error at plugin setup
//      naming the resolved absolute path (never a silent empty fallback).
//
//   3. addVirtualModule("virtual:zudo-doc-design-token-panel-config", …) — a
//      SECOND host-callables channel, identical mechanics to #2 above (#2658).
//      `settings.designTokenPanelConfigModule` carries a project-root-relative
//      PATH to a host module exporting a named `buildDesignTokenPanelConfig`.
//      `routes/_design-token-panel-bootstrap.tsx`'s configured island wrapper
//      is the SOLE importer of this virtual module (#3396 moved it out of
//      `design-token-panel-bootstrap.tsx` so the generic chrome graph carries
//      no `virtual:` specifier). Registered UNCONDITIONALLY: absent setting
//      → re-exports the PACKAGE DEFAULT (`@takazudo/zudo-doc/design-token-panel-config`,
//      not an empty fallback — there is no meaningful "empty" builder);
//      present-but-missing file → a loud Error at plugin setup naming the
//      resolved absolute path (never a silent fallback to the package default).
//
//      Between #3 and #4, a build-time-only DIAGNOSTIC (no behavior change,
//      zudolab/zudo-doc#3420, spec #3428; scoped by #3434/#3435) warns when
//      `settings.designTokenPanel` is on, `designTokenPanelConfigModule` is
//      set, and every READER-FACING derived route below is shadowed by a kept
//      user `pages/` file — meaning the configured builder can never reach an
//      injected route a reader browses. Suppressed when the resolved
//      `chromeBindingsModule` file already names `DesignTokenPanelBootstrap`
//      (the documented workaround), or when a shadowing `pages/` file is an
//      exact default re-export of the shadowed route's own entrypoint (#3451
//      — such a file still reaches the bootstrap through `routes/_chrome.tsx`).
//      See the guard case inline, next to #3 above.
//
//   4. injectRoute(pattern, entrypoint[, opts]) — the 16-route catalog
//      (Decision 3), patterns derived from `options.settings.locales` /
//      `options.settings.versions`. Dynamic `[locale]` / `[version]` patterns
//      are injected ONCE; the entrypoint's `paths()` enumerates the concrete
//      values (same as the kept `pages/*.tsx` stubs).
//
// zfb 2.13.1 renders injected static and dynamic routes in both build and dev.
// A package route colliding with a kept user `pages/` route is
// dropped silently (user `pages/` wins — Decision 6), so with the stubs present
// flipping the flag on is a harmless no-op.
//
// Inline plugin functions are not supported by zfb's plugin runtime — see the
// sibling `doc-history.ts` for the standalone-module rationale.

import { createRequire } from "node:module";
import { existsSync, statSync, readFileSync, cpSync, rmSync, mkdirSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { definePlugin, type ZfbSetupContext } from "@takazudo/zfb/plugins";
import { loadThemePackRegistry } from "../theme-packs-registry/load-registry.js";
import { resolveEnabledPacks } from "../theme-packs-registry/index.js";
import type { ThemePackRegistry } from "../theme-packs-registry/index.js";
import { derivePagesCandidates } from "./route-pages-candidates.js";
import { scanAssets } from "./internal/asset-viewer/scan.js";
import { buildAssetSnapshot } from "./internal/asset-viewer/build.js";
import type { AssetLinkContentRoot } from "./internal/asset-viewer/link-graph.js";

// ---------------------------------------------------------------------------
// Options shape (filled by the preset from settings — fully serializable).
// ---------------------------------------------------------------------------

/** A single locale's config as seen from `options.settings.locales[code]`. */
interface RoutesLocaleConfig {
  dir?: string;
  label?: string;
}

/** A single docs version as seen from `options.settings.versions[n]`. */
interface RoutesVersionConfig {
  slug: string;
  docsDir?: string;
  locales?: Record<string, { dir?: string }>;
}

/**
 * The serializable settings subset the route derivation + virtual module read.
 * The full host `settings` object is passed through verbatim; only these fields
 * are inspected here.
 */
interface RoutesSettings {
  locales?: Record<string, RoutesLocaleConfig>;
  versions?: RoutesVersionConfig[] | false;
  base?: string;
  trailingSlash?: boolean;
  docTags?: boolean;
  aiAssistant?: boolean;
  /** See `settings.ts` — whether the interactive Design Token Panel is enabled
   *  at all. Read ONLY by the shadow diagnostic below (#3435): with the feature
   *  off, `designTokenPanelConfigModule` is documented as irrelevant, so the
   *  diagnostic must not tell such a host to wire up a panel that never
   *  renders either way. Nothing else in this plugin gates on it. */
  designTokenPanel?: boolean;
  /** See `settings.ts` — project-root-relative path to a host bindings module. */
  chromeBindingsModule?: string;
  /** See `settings.ts` — project-root-relative path to a host design-token
   *  panel config module (#2658). */
  designTokenPanelConfigModule?: string;
  /** See `settings.ts` / ADR `docs/adr/theme-packs.md` — active theme-pack slug. */
  themePack?: string;
  /** See `settings.ts` / ADR `docs/adr/theme-packs.md` — enabled pack slugs, in order. */
  themePacks?: string[];
  [key: string]: unknown;
}

/** Plugin `options` block — see the preset's `buildPlugins`. */
interface RoutesPluginOptions {
  settings: RoutesSettings;
  translations: Record<string, Record<string, string>>;
  tagVocabulary: ReadonlyArray<Record<string, unknown>>;
  colorSchemes: Record<string, unknown> | null;
  packageOwnedRoutes?: boolean;
  assetViewer?: boolean;
  assetViewerDir?: string;
  assetViewerRoutePrefix?: string;
  assetViewerExclude?: string[];
  docsDir?: string;
  locales?: Record<string, { dir?: string }>;
  versions?: RoutesVersionConfig[] | false;
}

// ---------------------------------------------------------------------------
// Route catalog (Decision 3) — pattern → package-owned entrypoint specifier.
// ---------------------------------------------------------------------------

/** One injected route: a zfb route pattern + the package entrypoint specifier
 *  that renders it, with optional zfb `injectRoute` opts. */
interface RouteSpec {
  pattern: string;
  entrypoint: string;
  opts?: { prerender?: boolean };
  /**
   * Whether this route counts toward the DTP shadow diagnostic's denominator
   * (#3434). REQUIRED, deliberately — a newly added route must state its
   * membership, so forgetting one is a type error instead of the silent
   * miss #3434 *is*.
   *
   * The name is scoped to the DIAGNOSTIC, not to the route's own nature,
   * because that is all the flag actually asserts. In particular it is NOT
   * `rendersPanel`: `/404` genuinely DOES render the configured DTP bootstrap
   * (`routes/404.tsx` passes `bodyEndComponents={<BodyEndIslands …/>}`, and
   * `routes/_chrome.tsx` feeds that chrome the configured wrapper), so a
   * `rendersPanel: false` tag on it would be a false claim in the source. It
   * is likewise not `kind: "doc-content"` — the counted set includes the
   * locale home, the tag pages and the version pages.
   *
   * `false` for the four routes a reader never browses as documentation:
   * `/sitemap.xml` and `/robots.txt` cannot render an HTML panel at all (they
   * would hold the check at "not fully shadowed" forever), `/api/ai-chat` is a
   * JSON endpoint, and `/404` is an error page — losing the panel there says
   * nothing about whether the site's docs still have one. The never-injected
   * `/` (see the note in `deriveRoutes`) is absent from the catalog entirely
   * and so cannot be counted either.
   */
  includedInDtpShadowDiagnostic: boolean;
}

/**
 * The DTP shadow diagnostic's warn/silent decision, extracted from `setup()`
 * so the vacuity guard below is directly unit-testable (#3434).
 *
 * Returns `true` only when there is at least one reader-facing route AND every
 * one of them is shadowed. The emptiness check is the whole reason this is a
 * named function: `[].every(…)` is vacuously `true`, so an empty denominator
 * would otherwise fire the warning for every host. That state is unreachable
 * through `deriveRoutes` today (`/docs/[[...slug]]` is always emitted and
 * always counted), which is exactly why it needs a test that calls this
 * directly — a build-driven test cannot construct it.
 */
export function shouldWarnDtpFullyShadowed(
  routes: ReadonlyArray<Pick<RouteSpec, "pattern" | "includedInDtpShadowDiagnostic">>,
  isShadowed: (pattern: string) => boolean,
): boolean {
  const counted = routes.filter((route) => route.includedInDtpShadowDiagnostic);
  if (counted.length === 0) return false;
  return counted.every((route) => isShadowed(route.pattern));
}

/**
 * Best-effort check for the one shape that makes a `pages/` file shadowing a
 * package route harmless to the DTP shadow diagnostic (#3451): an exact
 * default RE-EXPORT of that route's OWN package entrypoint —
 *
 *   export { default, paths, frontmatter } from "@takazudo/zudo-doc/routes/docs-slug";
 *
 * Such a file still reaches the configured chrome bootstrap through
 * `routes/_chrome.tsx` (it forwards to the very entrypoint the package would
 * have injected), so `existsSync` finding it should not count as a real
 * shadow — narrowing the diagnostic's denominator to reader-facing routes
 * (#3434) made this false positive reachable, where before it was hidden by
 * the always-surviving `/404` / `/sitemap.xml` entries.
 *
 * Deliberately NARROW, and best-effort in the same sense as the
 * `workaroundLikelyApplied` check in `setup()` below: a cheap text scan over
 * the file's source, not module evaluation or an AST parse. It intentionally
 * does NOT suppress on any of these shapes, because none of them prove the
 * route still reaches the bootstrap:
 *
 *  - the specifier appearing only inside a comment (stripped before matching)
 *  - an unused import of the specifier (no `export { default … } from` at all)
 *  - a re-export of a DIFFERENT package route (the specifier must match
 *    `entrypoint` exactly)
 *  - a file that imports the package route but exports its own default
 *
 * Conversely, a host that reaches the same entrypoint some OTHER way this
 * scan cannot see (e.g. a local wrapper module) still counts as shadowed and
 * may trigger the diagnostic even though it is actually safe — that false
 * positive is the accepted cost of a text-only heuristic (the warning
 * message states this limit too).
 */
function isExactDefaultReExport(source: string, entrypoint: string): boolean {
  // Strip comments first so a commented-out re-export line is never mistaken
  // for a live one. This itself is best-effort: it does not understand
  // string literals, so a `//`/`/* */` sequence inside a string would also
  // get stripped — an acceptable limit for the simple import/export-only
  // `pages/` stub files this heuristic targets.
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const specifier = entrypoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reExportPattern = new RegExp(
    `export\\s*\\{[^}]*\\bdefault\\b(?!\\s+as\\s)[^}]*\\}\\s*from\\s*(["'])${specifier}\\1`,
  );
  return reExportPattern.test(withoutComments);
}

/**
 * Derive the full route catalog from the serializable settings. Mirrors the
 * kept `pages/*.tsx` filenames exactly (zfb's route grammar matches `pages/`
 * filenames). Dynamic `[locale]` / `[version]` patterns are emitted ONCE; the
 * entrypoint's `paths()` enumerates the concrete values.
 */
function deriveRoutes(
  settings: RoutesSettings,
  options: Pick<RoutesPluginOptions, "packageOwnedRoutes" | "assetViewer" | "assetViewerRoutePrefix">,
): RouteSpec[] {
  const routes: RouteSpec[] = [];
  const localeCodes = Object.keys(settings.locales ?? {});
  const hasVersions = Array.isArray(settings.versions) && settings.versions.length > 0;
  const docTags = settings.docTags === true;
  const aiAssistant = settings.aiAssistant === true;

  if (options.packageOwnedRoutes === false) {
    if (options.assetViewer === true) {
      routes.push({
        pattern: `/${options.assetViewerRoutePrefix ?? "files"}/[[...path]]`,
        entrypoint: "@takazudo/zudo-doc/routes/files-path",
        includedInDtpShadowDiagnostic: true,
      });
    }
    return routes;
  }

  // ── Static / always-on ────────────────────────────────────────────────
  // Note: pattern "/" is NOT injected here — zfb 0.1.0-next.62's injectRoute
  // rejects "/" unconditionally in the plugin-host (the type docs describe it
  // as allowed in build mode, but the current implementation does not gate on
  // ctx.command). The routes/index.tsx entrypoint exists and is exported from
  // the package for when the user drops their pages/index.tsx stub and a future
  // zfb version lifts the restriction. Tracked: Takazudo/zudo-front-builder#1227.
  routes.push({ pattern: "/404", entrypoint: "@takazudo/zudo-doc/routes/404", includedInDtpShadowDiagnostic: false });
  routes.push({ pattern: "/sitemap.xml", entrypoint: "@takazudo/zudo-doc/routes/sitemap.xml", includedInDtpShadowDiagnostic: false });
  routes.push({ pattern: "/robots.txt", entrypoint: "@takazudo/zudo-doc/routes/robots.txt", includedInDtpShadowDiagnostic: false });
  routes.push({ pattern: "/docs/[[...slug]]", entrypoint: "@takazudo/zudo-doc/routes/docs-slug", includedInDtpShadowDiagnostic: true });

  // ── Tags (gated on settings.docTags) ──────────────────────────────────
  if (docTags) {
    routes.push({ pattern: "/docs/tags", entrypoint: "@takazudo/zudo-doc/routes/docs-tags-index", includedInDtpShadowDiagnostic: true });
    routes.push({ pattern: "/docs/tags/[tag]", entrypoint: "@takazudo/zudo-doc/routes/docs-tags-tag", includedInDtpShadowDiagnostic: true });
  }

  // ── AI chat (SSR — prerender:false; gated on settings.aiAssistant) ─────
  if (aiAssistant) {
    routes.push({
      pattern: "/api/ai-chat",
      entrypoint: "@takazudo/zudo-doc/routes/api-ai-chat",
      opts: { prerender: false },
      includedInDtpShadowDiagnostic: false,
    });
  }

  // ── Versions (default-locale) ─────────────────────────────────────────
  if (hasVersions) {
    routes.push({ pattern: "/docs/versions", entrypoint: "@takazudo/zudo-doc/routes/docs-versions", includedInDtpShadowDiagnostic: true });
    routes.push({ pattern: "/v/[version]/docs/[[...slug]]", entrypoint: "@takazudo/zudo-doc/routes/v-docs-slug", includedInDtpShadowDiagnostic: true });
    routes.push({ pattern: "/v/[version]/[locale]/docs/[[...slug]]", entrypoint: "@takazudo/zudo-doc/routes/v-locale-docs-slug", includedInDtpShadowDiagnostic: true });
  }

  // ── Per non-default locale (dynamic [locale] pattern, injected once) ───
  // Only emit the locale-prefixed patterns when at least one non-default
  // locale is configured — otherwise `[locale]` paths() would enumerate empty.
  if (localeCodes.length > 0) {
    routes.push({ pattern: "/[locale]", entrypoint: "@takazudo/zudo-doc/routes/locale-index", includedInDtpShadowDiagnostic: true });
    routes.push({ pattern: "/[locale]/docs/[[...slug]]", entrypoint: "@takazudo/zudo-doc/routes/locale-docs-slug", includedInDtpShadowDiagnostic: true });
    if (docTags) {
      routes.push({ pattern: "/[locale]/docs/tags", entrypoint: "@takazudo/zudo-doc/routes/locale-docs-tags-index", includedInDtpShadowDiagnostic: true });
      routes.push({ pattern: "/[locale]/docs/tags/[tag]", entrypoint: "@takazudo/zudo-doc/routes/locale-docs-tags-tag", includedInDtpShadowDiagnostic: true });
    }
    if (hasVersions) {
      routes.push({ pattern: "/[locale]/docs/versions", entrypoint: "@takazudo/zudo-doc/routes/locale-docs-versions", includedInDtpShadowDiagnostic: true });
    }
  }

  if (options.assetViewer === true) {
    routes.push({
      pattern: `/${options.assetViewerRoutePrefix ?? "files"}/[[...path]]`,
      entrypoint: "@takazudo/zudo-doc/routes/files-path",
      includedInDtpShadowDiagnostic: true,
    });
  }

  return routes;
}

function applyTrailingSlash(path: string, trailingSlash: boolean): string {
  return trailingSlash && !path.endsWith("/") ? `${path}/` : path;
}

function withBase(base: string, path: string): string {
  const prefix = base === "/" ? "" : base.replace(/\/+$/, "");
  return `${prefix}${path.startsWith("/") ? path : `/${path}`}`;
}

function assetContentRoots(
  projectRoot: string,
  options: RoutesPluginOptions,
  settings: RoutesSettings,
): AssetLinkContentRoot[] {
  const base = typeof settings.base === "string" ? settings.base : "/";
  const trailingSlash = settings.trailingSlash !== false;
  const roots: AssetLinkContentRoot[] = [];
  const add = (
    dir: string | undefined,
    prefix: string,
    metadata: Pick<AssetLinkContentRoot, "locale" | "version"> = {},
  ) => {
    if (!dir) return;
    roots.push({
      dir: join(projectRoot, dir),
      ...metadata,
      urlFor: (slug) => applyTrailingSlash(withBase(base, `${prefix}/${slug}`), trailingSlash),
    });
  };

  add(options.docsDir, "/docs");
  for (const [locale, config] of Object.entries(options.locales ?? {})) {
    add(config.dir, `/${locale}/docs`, { locale });
  }
  for (const version of Array.isArray(options.versions) ? options.versions : []) {
    add(version.docsDir, `/v/${version.slug}/docs`, { version: version.slug });
    for (const [locale, config] of Object.entries(version.locales ?? {})) {
      add(config.dir, `/v/${version.slug}/${locale}/docs`, {
        locale,
        version: version.slug,
      });
    }
  }
  return roots;
}

// ---------------------------------------------------------------------------
// Host-callables channel helper — shared guard/resolve logic for the
// module-path settings (`chromeBindingsModule` #2501,
// `designTokenPanelConfigModule` #2658, and any future channel).
// ---------------------------------------------------------------------------

/**
 * Resolve an optional host-module-override setting (a project-root-relative
 * module path) to its absolute, forward-slash-normalized path — or
 * `undefined` when the setting is absent. Fails LOUDLY at plugin setup (never
 * a silent fallback) on the three misconfiguration shapes:
 *
 *  - An explicitly empty/blank string throws BEFORE path resolution:
 *    `join(projectRoot, "")` resolves to the project root itself, and
 *    `existsSync(projectRoot)` is true (it's a directory), so "" would
 *    otherwise sail past the missing-file check (#2518).
 *  - A path whose resolved file does not exist throws, naming the resolved
 *    absolute path.
 *  - A directory-valued path (e.g. "." or "./src") passes `existsSync`
 *    (directories exist too) and would otherwise sail through to the bundler,
 *    which fails later with a confusing non-loud error — so it throws here
 *    naming the resolved path (#2520).
 */
function resolveHostModuleOverride(
  projectRoot: string,
  settingName: string,
  settingValue: unknown,
  hints: { examplePath: string; mustExport: string },
): string | undefined {
  if (typeof settingValue === "string" && settingValue.trim() === "") {
    throw new Error(
      `zudo-doc: settings.${settingName} is set to an empty string — set it to a ` +
        `project-root-relative module path (e.g. "${hints.examplePath}") or remove the setting.`,
    );
  }
  const modulePath = typeof settingValue === "string" ? settingValue : undefined;
  if (!modulePath) return undefined;

  const resolved = join(projectRoot, modulePath).split("\\").join("/");
  if (!existsSync(resolved)) {
    throw new Error(
      `zudo-doc: settings.${settingName} is set to "${modulePath}", ` +
        `which resolves to "${resolved}" — that file does not exist. Create it (must ` +
        `export a named \`${hints.mustExport}\`) or remove the setting.`,
    );
  }
  if (!statSync(resolved).isFile()) {
    throw new Error(
      `zudo-doc: settings.${settingName} is set to "${modulePath}", ` +
        `which resolves to "${resolved}" — that path is a directory, not a module file. ` +
        `Point it at a module file (e.g. "${hints.examplePath}") or remove the setting.`,
    );
  }
  return resolved;
}

const plugin = definePlugin({
  name: "@takazudo/zudo-doc/plugins/routes",

  async setup(ctx: ZfbSetupContext) {
    const options = ctx.options as unknown as RoutesPluginOptions;
    const settings = options.settings ?? {};
    const translations = options.translations ?? {};
    const tagVocabulary = options.tagVocabulary ?? [];
    const colorSchemes = options.colorSchemes ?? null;
    // Computed once, shared by the shadow diagnostic below (3.5) and the
    // injection loop (4) — both need the same derived catalog.
    const derivedRoutes = deriveRoutes(settings, options);

    // (0) Theme-pack registry (ADR docs/adr/theme-packs.md, Decision 2
    // "Registry threading to SSR/islands", #2819). Resolves the shipped
    // `theme-packs/` directory relative to THIS module — works from
    // `dist/plugins/routes.js` in the published/workspace-built package and
    // from `src/plugins/routes.ts` here under vitest (which runs the source
    // directly) — scans + validates every bundled pack
    // (`loadThemePackRegistry`), then resolves the enabled/ordered subset
    // against `settings.themePack`/`settings.themePacks`
    // (`resolveEnabledPacks`, PURE). An unknown/duplicate slug THROWS here,
    // naming the bad slug and the available ones — the `chromeBindingsModule`
    // fail-loudly precedent, never a silent fallback. The asset-serving
    // (postBuild/devMiddleware) side of this directory is #2820's
    // `plugins/theme-packs.ts`, not this plugin.
    const themePacksDir = new URL("../theme-packs/", import.meta.url);
    const themePackRegistry: ThemePackRegistry = resolveEnabledPacks(
      loadThemePackRegistry(themePacksDir),
      { themePack: settings.themePack, themePacks: settings.themePacks },
    );

    const assetViewer = options.assetViewer === true;
    const assetViewerDir = options.assetViewerDir ?? "assets";
    const assetViewerRoutePrefix = options.assetViewerRoutePrefix ?? "files";
    const assetViewerExclude = options.assetViewerExclude ?? [];
    // `watchFiles` is a fixed registration-time option in zfb, so existing
    // files require this one lightweight pre-enumeration. The expensive scan
    // → probe → git → link → highlight snapshot remains loader-lazy below;
    // preview skips even this enumeration because its loaders are inert.
    const assetWatchFiles =
      assetViewer && ctx.command !== "preview"
        ? (await scanAssets(ctx.projectRoot, assetViewerDir, assetViewerExclude)).map(
            (path) => join(ctx.projectRoot, "public", assetViewerDir, path),
          )
        : [];
    const contentRoots = assetContentRoots(ctx.projectRoot, options, settings);
    let snapshotPromise: ReturnType<typeof buildAssetSnapshot> | undefined;
    type HighlightCode = import("./internal/asset-viewer/highlight.js").HighlightCode;
    let resolveHighlightCode: ((value: HighlightCode) => void) | undefined;
    let rejectHighlightCode: ((reason: unknown) => void) | undefined;
    let highlightCodeReady = false;
    let highlighterLoadPromise: Promise<void> | undefined;
    const highlightCodePromise = new Promise<HighlightCode>((resolve, reject) => {
      resolveHighlightCode = resolve;
      rejectHighlightCode = reject;
    });
    if (assetViewer && assetWatchFiles.length === 0) {
      highlightCodeReady = true;
      resolveHighlightCode?.(async () => {
        throw new Error("[asset-viewer] highlighting requested without an asset file");
      });
    }
    const invokedLoaders = new Set<"context" | "bodies">();

    const getSnapshot = () => {
      snapshotPromise ??= highlightCodePromise
        .then((highlightCode) =>
          buildAssetSnapshot({
            projectRoot: ctx.projectRoot,
            dir: assetViewerDir,
            routePrefix: assetViewerRoutePrefix,
            exclude: assetViewerExclude,
            contentRoots,
            base: typeof settings.base === "string" ? settings.base : "/",
            trailingSlash: settings.trailingSlash !== false,
            logger: ctx.logger,
            highlightCode,
          }),
        )
        .catch((error) => {
          snapshotPromise = undefined;
          throw error;
        });
      return snapshotPromise;
    };

    const beginLoader = (name: "context" | "bodies") => {
      if (invokedLoaders.has(name)) {
        snapshotPromise = undefined;
        invokedLoaders.clear();
      }
      invokedLoaders.add(name);
    };

    const assetBodiesLoader = async (trackInvocation = true): Promise<string> => {
      if (trackInvocation) beginLoader("bodies");
      if (!assetViewer) return "export default {};\n";
      if (!highlightCodeReady) {
        highlighterLoadPromise ??= (async () => {
          try {
            const { highlightCode } = await import("@takazudo/zfb-md-wasm/highlight");
            highlightCodeReady = true;
            resolveHighlightCode?.(highlightCode);
          } catch (error) {
            rejectHighlightCode?.(error);
            throw error;
          }
        })();
        await highlighterLoadPromise;
      }
      const snapshot = await getSnapshot();
      return `export default ${JSON.stringify(snapshot.records)};\n`;
    };

    // Register bodies first for a stable module catalog. Some zfb build graphs
    // request route context before this route-only module; the context loader
    // invokes this same callback without marking a reload so the optional
    // import still has exactly one feature-gated owner.
    ctx.addVirtualModule(
      "virtual:zudo-doc-asset-bodies",
      assetBodiesLoader,
      { watchFiles: assetWatchFiles },
    );

    // (1) Route-context virtual module — SERIALIZABLE DATA ONLY (Decision 1).
    // `JSON.stringify` is the boundary that enforces "no functions / no
    // components": any non-serializable value would silently drop, so the
    // payload is, by construction, pure data. Every callable the entrypoints
    // need is an importable package subpath, NOT carried here.
    ctx.addVirtualModule(
      "virtual:zudo-doc-route-context",
      async () => {
        beginLoader("context");
        if (assetViewer && !highlightCodeReady) await assetBodiesLoader(false);
        const assetManifest = assetViewer ? (await getSnapshot()).manifest : null;
        return (
          `export const routeContext = ${JSON.stringify({
            settings,
            translations,
            tagVocabulary,
            colorSchemes,
            themePackRegistry,
            assetManifest,
          })};\n`
        );
      },
      { watchFiles: assetWatchFiles },
    );

    // (2) Chrome-bindings virtual module — the host-callables channel (#2501).
    // `settings.chromeBindingsModule`, when set, is a project-root-relative
    // path to a host module exporting a named `chromeBindings`. Resolved +
    // guarded by `resolveHostModuleOverride` (at plugin setup, not inside the
    // loader) so a misconfigured path fails LOUDLY naming the resolved path —
    // never a silent empty fallback. Registered UNCONDITIONALLY:
    // `routes/_chrome.tsx` always imports this specifier, so the module must
    // exist even when the setting is absent (loader emits an empty-object
    // export in that case).
    const chromeBindingsAbsPath = resolveHostModuleOverride(
      ctx.projectRoot,
      "chromeBindingsModule",
      settings.chromeBindingsModule,
      {
        examplePath: "./src/chrome-bindings.tsx",
        mustExport: "chromeBindings: ChromeHostBindings",
      },
    );
    ctx.addVirtualModule("virtual:zudo-doc-chrome-bindings", () =>
      chromeBindingsAbsPath
        ? `export { chromeBindings } from ${JSON.stringify(chromeBindingsAbsPath)};\n`
        : `export const chromeBindings = {};\n`,
    );

    // (3) Design-token-panel-config virtual module — the THIRD virtual module
    // (#2658, mirrors the chromeBindingsModule contract above exactly, via the
    // same `resolveHostModuleOverride` guards). Registered UNCONDITIONALLY:
    // `routes/_design-token-panel-bootstrap.tsx`'s configured island wrapper
    // always imports this specifier, so the module must exist even when the
    // setting is absent — in that case the loader re-exports the PACKAGE
    // DEFAULT builder (`@takazudo/zudo-doc/design-token-panel-config`) instead
    // of an empty fallback (there is no meaningful "empty" PanelConfigBuilder).
    const designTokenPanelConfigAbsPath = resolveHostModuleOverride(
      ctx.projectRoot,
      "designTokenPanelConfigModule",
      settings.designTokenPanelConfigModule,
      {
        examplePath: "./src/design-token-panel-config.ts",
        mustExport: 'buildDesignTokenPanelConfig(mode: "light" | "dark")',
      },
    );
    ctx.addVirtualModule("virtual:zudo-doc-design-token-panel-config", () =>
      designTokenPanelConfigAbsPath
        ? `export { buildDesignTokenPanelConfig } from ${JSON.stringify(designTokenPanelConfigAbsPath)};\n`
        : `export { buildDesignTokenPanelConfig } from "@takazudo/zudo-doc/design-token-panel-config";\n`,
    );

    // (3.5) DTP shadow diagnostic (zudolab/zudo-doc#3420, spec #3428; scoped
    // by #3434/#3435; re-export false-positive guarded by #3451).
    // Decision 6 above drops an injected route SILENTLY when a kept user
    // `pages/` file claims the same URL — so a locked-manifest host that
    // sets `designTokenPanelConfigModule` while its `pages/` stubs shadow
    // every injected route a READER BROWSES gets no configured DTP island on
    // any page of its documentation: the panel vanishes with no build error.
    // Warn loudly at setup instead. "All reader-facing derived routes
    // shadowed" is the sufficient condition (`includedInDtpShadowDiagnostic`
    // on `RouteSpec` — the original `every(derivedRoutes)` never fired for
    // the very host shape that motivated the diagnostic, because
    // `/sitemap.xml` and `/robots.txt` are always injected and are never
    // shadowed by the two-stub minimal scaffold, #3434). Partial shadowing
    // stays silent (the config still applies on the surviving reader routes).
    //
    // Two gates, both needed:
    //  - `settings.designTokenPanel` — with the feature off, `settings.ts`
    //    documents `designTokenPanelConfigModule` as irrelevant, so warning
    //    about a panel that never renders either way contradicts the
    //    documented contract (#3435).
    //  - the RESOLVED path, not the raw setting — `resolveHostModuleOverride`
    //    above already turned an invalid setting into a thrown Error, so
    //    reaching here means the module genuinely resolved.
    //
    // Diagnostic only: does not change which routes get injected below.
    if (settings.designTokenPanel === true && designTokenPanelConfigAbsPath) {
      const pagesDir = join(ctx.projectRoot, "pages");
      // Looked up per-pattern below so the re-export guard (#3451) can
      // compare a shadowing file's specifier against THIS route's own
      // `entrypoint` — a re-export of a different package route must still
      // count as a real shadow.
      const routesByPattern = new Map(derivedRoutes.map((route) => [route.pattern, route]));
      const readerRoutesAllShadowed = shouldWarnDtpFullyShadowed(derivedRoutes, (pattern) => {
        const route = routesByPattern.get(pattern);
        return derivePagesCandidates(pattern).some((rel) => {
          const abs = join(pagesDir, rel);
          if (!existsSync(abs)) return false;
          // A kept `pages/` file that exactly default-re-exports the
          // shadowed route's own entrypoint still reaches the configured
          // bootstrap through routes/_chrome.tsx — don't count it as a real
          // shadow (#3451). Read failures (unreadable file, a path that is
          // actually a directory) fall back to "counts as a shadow": this is a
          // build-time DIAGNOSTIC and must never be the thing that fails a
          // build.
          let source: string | undefined;
          try {
            source = readFileSync(abs, "utf8");
          } catch {
            return true;
          }
          if (route && isExactDefaultReExport(source, route.entrypoint)) {
            return false;
          }
          return true;
        });
      });
      if (readerRoutesAllShadowed) {
        // Best-effort heuristic: a cheap text scan for the literal export
        // name, not an evaluation of the resolved module — the module
        // cannot be executed here, at plugin setup. A host that composes
        // `chromeBindings.DesignTokenPanelBootstrap` indirectly (re-exported
        // through another module, built from a variable, etc.) without the
        // literal token ever appearing in the resolved file keeps warning —
        // the message below tells such hosts the warning is safe to ignore
        // once the workaround is genuinely wired up.
        // Read guarded for the same reason as the candidate scan above: this
        // whole block only ever prints a warning, so an unreadable file (EACCES,
        // EIO) must degrade to "assume not applied" rather than throw out of
        // setup() and fail the build. `resolveHostModuleOverride` already proved
        // this path exists and is a file, so EISDIR is not reachable here — but
        // leaving the two reads asymmetrically guarded would read as deliberate.
        let chromeBindingsSource: string | undefined;
        if (chromeBindingsAbsPath !== undefined) {
          try {
            chromeBindingsSource = readFileSync(chromeBindingsAbsPath, "utf8");
          } catch {
            chromeBindingsSource = undefined;
          }
        }
        const workaroundLikelyApplied =
          chromeBindingsSource !== undefined &&
          chromeBindingsSource.includes("DesignTokenPanelBootstrap");
        if (!workaroundLikelyApplied) {
          ctx.logger.warn(
            "zudo-doc: settings.designTokenPanelConfigModule is set, but every " +
              "reader-facing injected route's URL is shadowed by a kept user " +
              "pages/ file — the configured Design Token Panel builder can never " +
              "apply on any documentation page a reader browses on this site " +
              "(zudolab/zudo-doc#3420). Thread your builder through " +
              "chromeBindings.DesignTokenPanelBootstrap instead — that binding wins " +
              "everywhere, including stub-rendered pages (see the " +
              "designTokenPanelConfigModule docblock in settings.ts). If you already " +
              "did this via a chromeBindingsModule that composes the bootstrap " +
              'indirectly (never spelling "DesignTokenPanelBootstrap" literally in ' +
              "the resolved file), this warning is safe to ignore. A pages/ file " +
              "that cleanly re-exports a shadowed route's own entrypoint " +
              '(`export { default, paths, frontmatter } from "@takazudo/zudo-doc/' +
              'routes/…"`) does not count as a real shadow either — but that check ' +
              "is also a best-effort text scan, not module evaluation, so a file " +
              "that reaches the same entrypoint some other way may still trigger " +
              "this warning even though it is safe.",
          );
        }
      }
    }

    // (4) Inject the derived route catalog (Decision 3). zfb 2.13.1 renders
    // injected dynamic routes in dev and build; precedence still drops
    // collisions with kept user `pages/` routes (Decision 6).
    //
    // zfb 0.1.0-next.62 resolves the `entrypoint` argument as a filesystem
    // path from the project root — it does NOT resolve bare npm package
    // specifiers (e.g. `@takazudo/zudo-doc/routes/foo`) through node_modules.
    // Use `createRequire` to resolve each entry specifier to its absolute
    // filesystem path so zfb can find the compiled entrypoint in dist/.
    // (The `createRequire` call is valid here: the routes plugin is loaded by
    // the zfb plugin-host under Node.js, NOT by the preset's node-free config
    // eval — so `node:module` is safe to use in this file's top-level import.)
    //
    // zfb (0.1.0-next.65) extracts `paths()` via static AST analysis on the
    // `.tsx` SOURCE file — it CANNOT extract `paths()` from a compiled `.js`
    // (SPIKE-verified in S1 #2370: pointing injectRoute at dist/routes/*.js
    // fails the build with "no top-level `paths` export found"). So every route
    // — static AND dynamic — must inject a `.tsx` SOURCE entrypoint. We resolve
    // the source for each route from one of two locations, probed in order:
    //
    //   1. PUBLISHED consumers — the package ships the route sources (with
    //      parent-relative imports rewritten to bare `@takazudo/zudo-doc/*`
    //      specifiers) under `routes-src/`. The published tree has NO `src/`,
    //      so this is the ONLY source available there. Derive it from the
    //      compiled path: `…/dist/routes/X.js` → `…/routes-src/X.tsx`.
    //   2. IN-REPO (workspace) — the package is consumed via `workspace:*`,
    //      so the original `src/routes/X.tsx` is on disk next to `dist/`.
    //      Derive it: `…/dist/routes/X.js` → `…/src/routes/X.tsx`.
    //
    // STAGING (the node_modules virtual-module gap — S1 #2370):
    //   zfb's esbuild bundler does NOT run the `addVirtualModule` resolver on
    //   imports of files whose REALPATH is inside `node_modules` — so a route
    //   `.tsx` resolved at `node_modules/@takazudo/zudo-doc/routes-src/X.tsx`
    //   fails with `Could not resolve "virtual:zudo-doc-route-context"` (its
    //   transitive `./_context` import pulls in the virtual module). Verified
    //   empirically: the SAME tree builds when its realpath is OUTSIDE
    //   node_modules. The workspace case never hit this because the symlinked
    //   package's realpath is `packages/zudo-doc/…` (outside node_modules).
    //   FIX: when the resolved source lives under node_modules, copy the entire
    //   `routes-src/` tree ONCE into a project-local cache dir
    //   (`<projectRoot>/.zudo-doc/routes-src/`, outside node_modules) and point
    //   every injected route at the staged copy. The same-dir helpers
    //   (`_context`, `_chrome`, `_docs-helpers`, `_virtual.d.ts`) are co-located
    //   in that tree; the bare `@takazudo/zudo-doc/*` imports still resolve via
    //   node from the staged location. The in-repo (workspace) path needs no
    //   staging — its realpath is already outside node_modules.
    const require = createRequire(import.meta.url);

    /** Lazily-prepared stage dir (set on first node_modules-resolved route). */
    let stagedRoutesDir: string | undefined;
    /** Stage `routesSrcDir` → `<projectRoot>/.zudo-doc/routes-src/` once. */
    const ensureStaged = (routesSrcDir: string): string => {
      if (stagedRoutesDir) return stagedRoutesDir;
      const dest = join(ctx.projectRoot, ".zudo-doc", "routes-src");
      rmSync(dest, { recursive: true, force: true });
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(routesSrcDir, dest, { recursive: true });
      stagedRoutesDir = dest;
      return dest;
    };

    for (const route of derivedRoutes) {
      let resolvedEntrypoint: string;
      try {
        const compiledPath = require.resolve(route.entrypoint);
        const tsxName = basename(compiledPath).replace(/\.js$/, ".tsx");
        // (1) Published `routes-src/X.tsx` — probed FIRST.
        const routesSrcDir = dirname(compiledPath).replace(
          /dist[\\/]routes$/,
          "routes-src",
        );
        const routesSrcPath = join(routesSrcDir, tsxName);
        // (2) In-repo `src/routes/X.tsx` — fallback for workspace consumers.
        const srcPath = compiledPath
          .replace(/[\\/]dist[\\/]/, "/src/")
          .replace(/\.js$/, ".tsx");

        if (existsSync(routesSrcPath)) {
          // Published-package source. If it lives under node_modules, stage the
          // tree outside node_modules so the virtual module resolves.
          const underNodeModules = /[\\/]node_modules[\\/]/.test(routesSrcPath);
          resolvedEntrypoint = underNodeModules
            ? join(ensureStaged(routesSrcDir), tsxName)
            : routesSrcPath;
        } else if (existsSync(srcPath)) {
          // Workspace source (realpath already outside node_modules).
          resolvedEntrypoint = srcPath;
        } else {
          // No source on disk — fall back to the compiled `.js` so zfb surfaces
          // the loud missing-`paths()` / virtual-module error.
          resolvedEntrypoint = compiledPath;
        }
      } catch {
        // If the package isn't installed (e.g. in tests without node_modules),
        // fall back to the bare specifier so the error surfaces from zfb.
        resolvedEntrypoint = route.entrypoint;
      }
      ctx.injectRoute(route.pattern, resolvedEntrypoint, route.opts);
    }
  },
});

export default plugin;
