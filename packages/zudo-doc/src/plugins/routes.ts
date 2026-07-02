// zfb plugin module: routes — package-owned route injection (epic Package-First
// Finale #2356). Authoritative seam spec: `docs/adr/route-injection-seam.md`
// (pinned by A0 #2357).
//
// This plugin lets `@takazudo/zudo-doc` OWN the doc routes so a project can
// ship an (almost) empty `pages/`. It is added by the preset's `buildPlugins()`
// ONLY when `settings.packageOwnedRoutes` is true — a bare-specifier descriptor
// (`{ name: "@takazudo/zudo-doc/plugins/routes", options }`), never an imported
// function, so the preset's node-free config eval-graph guard stays green.
//
// The single `setup(ctx)` hook does THREE things (Decision 1, + the
// host-callables channel below):
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
//   3. injectRoute(pattern, entrypoint[, opts]) — the 16-route catalog
//      (Decision 3), patterns derived from `options.settings.locales` /
//      `options.settings.versions`. Dynamic `[locale]` / `[version]` patterns
//      are injected ONCE; the entrypoint's `paths()` enumerates the concrete
//      values (same as the kept `pages/*.tsx` stubs).
//
// Build-only today: zfb `0.1.0-next.62` `injectRoute` prerenders at BUILD; the
// dev router only logs an injected match and falls through (upstream
// Takazudo/zudo-front-builder#1227). Verify package routes via `zfb build`, not
// `zfb dev`. A package route colliding with a kept user `pages/` route is
// dropped silently (user `pages/` wins — Decision 6), so with the stubs present
// flipping the flag on is a harmless no-op.
//
// Inline plugin functions are not supported by zfb's plugin runtime — see the
// sibling `doc-history.ts` for the standalone-module rationale.

import { createRequire } from "node:module";
import { existsSync, cpSync, rmSync, mkdirSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { definePlugin, type ZfbSetupContext } from "@takazudo/zfb/plugins";

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
  docTags?: boolean;
  aiAssistant?: boolean;
  /** See `settings.ts` — project-root-relative path to a host bindings module. */
  chromeBindingsModule?: string;
  [key: string]: unknown;
}

/** Plugin `options` block — see the preset's `buildPlugins`. */
interface RoutesPluginOptions {
  settings: RoutesSettings;
  translations: Record<string, Record<string, string>>;
  tagVocabulary: ReadonlyArray<Record<string, unknown>>;
  colorSchemes: Record<string, unknown> | null;
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
}

/**
 * Derive the full route catalog from the serializable settings. Mirrors the
 * kept `pages/*.tsx` filenames exactly (zfb's route grammar matches `pages/`
 * filenames). Dynamic `[locale]` / `[version]` patterns are emitted ONCE; the
 * entrypoint's `paths()` enumerates the concrete values.
 */
function deriveRoutes(settings: RoutesSettings): RouteSpec[] {
  const routes: RouteSpec[] = [];
  const localeCodes = Object.keys(settings.locales ?? {});
  const hasVersions = Array.isArray(settings.versions) && settings.versions.length > 0;
  const docTags = settings.docTags === true;
  const aiAssistant = settings.aiAssistant === true;

  // ── Static / always-on ────────────────────────────────────────────────
  // Note: pattern "/" is NOT injected here — zfb 0.1.0-next.62's injectRoute
  // rejects "/" unconditionally in the plugin-host (the type docs describe it
  // as allowed in build mode, but the current implementation does not gate on
  // ctx.command). The routes/index.tsx entrypoint exists and is exported from
  // the package for when the user drops their pages/index.tsx stub and a future
  // zfb version lifts the restriction. Tracked: Takazudo/zudo-front-builder#1227.
  routes.push({ pattern: "/404", entrypoint: "@takazudo/zudo-doc/routes/404" });
  routes.push({ pattern: "/sitemap.xml", entrypoint: "@takazudo/zudo-doc/routes/sitemap.xml" });
  routes.push({ pattern: "/robots.txt", entrypoint: "@takazudo/zudo-doc/routes/robots.txt" });
  routes.push({ pattern: "/docs/[[...slug]]", entrypoint: "@takazudo/zudo-doc/routes/docs-slug" });

  // ── Tags (gated on settings.docTags) ──────────────────────────────────
  if (docTags) {
    routes.push({ pattern: "/docs/tags", entrypoint: "@takazudo/zudo-doc/routes/docs-tags-index" });
    routes.push({ pattern: "/docs/tags/[tag]", entrypoint: "@takazudo/zudo-doc/routes/docs-tags-tag" });
  }

  // ── AI chat (SSR — prerender:false; gated on settings.aiAssistant) ─────
  if (aiAssistant) {
    routes.push({
      pattern: "/api/ai-chat",
      entrypoint: "@takazudo/zudo-doc/routes/api-ai-chat",
      opts: { prerender: false },
    });
  }

  // ── Versions (default-locale) ─────────────────────────────────────────
  if (hasVersions) {
    routes.push({ pattern: "/docs/versions", entrypoint: "@takazudo/zudo-doc/routes/docs-versions" });
    routes.push({ pattern: "/v/[version]/docs/[[...slug]]", entrypoint: "@takazudo/zudo-doc/routes/v-docs-slug" });
    routes.push({ pattern: "/v/[version]/[locale]/docs/[[...slug]]", entrypoint: "@takazudo/zudo-doc/routes/v-locale-docs-slug" });
  }

  // ── Per non-default locale (dynamic [locale] pattern, injected once) ───
  // Only emit the locale-prefixed patterns when at least one non-default
  // locale is configured — otherwise `[locale]` paths() would enumerate empty.
  if (localeCodes.length > 0) {
    routes.push({ pattern: "/[locale]", entrypoint: "@takazudo/zudo-doc/routes/locale-index" });
    routes.push({ pattern: "/[locale]/docs/[[...slug]]", entrypoint: "@takazudo/zudo-doc/routes/locale-docs-slug" });
    if (docTags) {
      routes.push({ pattern: "/[locale]/docs/tags", entrypoint: "@takazudo/zudo-doc/routes/locale-docs-tags-index" });
      routes.push({ pattern: "/[locale]/docs/tags/[tag]", entrypoint: "@takazudo/zudo-doc/routes/locale-docs-tags-tag" });
    }
    if (hasVersions) {
      routes.push({ pattern: "/[locale]/docs/versions", entrypoint: "@takazudo/zudo-doc/routes/locale-docs-versions" });
    }
  }

  return routes;
}

const plugin = definePlugin({
  name: "@takazudo/zudo-doc/plugins/routes",

  setup(ctx: ZfbSetupContext) {
    const options = ctx.options as unknown as RoutesPluginOptions;
    const settings = options.settings ?? {};
    const translations = options.translations ?? {};
    const tagVocabulary = options.tagVocabulary ?? [];
    const colorSchemes = options.colorSchemes ?? null;

    // (1) Route-context virtual module — SERIALIZABLE DATA ONLY (Decision 1).
    // `JSON.stringify` is the boundary that enforces "no functions / no
    // components": any non-serializable value would silently drop, so the
    // payload is, by construction, pure data. Every callable the entrypoints
    // need is an importable package subpath, NOT carried here.
    ctx.addVirtualModule(
      "virtual:zudo-doc-route-context",
      () =>
        `export const routeContext = ${JSON.stringify({
          settings,
          translations,
          tagVocabulary,
          colorSchemes,
        })};\n`,
    );

    // (2) Chrome-bindings virtual module — the host-callables channel (#2501).
    // `settings.chromeBindingsModule`, when set, is a project-root-relative
    // path to a host module exporting a named `chromeBindings`. Resolve it
    // against `ctx.projectRoot` and normalize to forward slashes so the
    // emitted specifier is stable across platforms. `existsSync`-guard here
    // (at plugin setup, not inside the loader) so a configured-but-missing
    // file fails LOUDLY with the resolved path — never a silent empty
    // fallback. Registered UNCONDITIONALLY: `routes/_chrome.tsx` always
    // imports this specifier, so the module must exist even when the setting
    // is absent (loader emits an empty-object export in that case).
    //
    // An explicitly empty/blank string must throw BEFORE path resolution:
    // `join(ctx.projectRoot, "")` resolves to the project root itself, and
    // `existsSync(projectRoot)` is true (it's a directory), so "" would
    // otherwise sail past the missing-file check below (#2518).
    if (
      typeof settings.chromeBindingsModule === "string" &&
      settings.chromeBindingsModule.trim() === ""
    ) {
      throw new Error(
        "zudo-doc: settings.chromeBindingsModule is set to an empty string — set it to a " +
          'project-root-relative module path (e.g. "./src/chrome-bindings.tsx") or remove the setting.',
      );
    }
    const chromeBindingsModule =
      typeof settings.chromeBindingsModule === "string"
        ? settings.chromeBindingsModule
        : undefined;
    let chromeBindingsAbsPath: string | undefined;
    if (chromeBindingsModule) {
      const resolved = join(ctx.projectRoot, chromeBindingsModule).split("\\").join("/");
      if (!existsSync(resolved)) {
        throw new Error(
          `zudo-doc: settings.chromeBindingsModule is set to "${chromeBindingsModule}", ` +
            `which resolves to "${resolved}" — that file does not exist. Create it (must ` +
            `export a named \`chromeBindings: ChromeHostBindings\`) or remove the setting.`,
        );
      }
      chromeBindingsAbsPath = resolved;
    }
    ctx.addVirtualModule("virtual:zudo-doc-chrome-bindings", () =>
      chromeBindingsAbsPath
        ? `export { chromeBindings } from ${JSON.stringify(chromeBindingsAbsPath)};\n`
        : `export const chromeBindings = {};\n`,
    );

    // (3) Inject the derived route catalog (Decision 3). Build-only render
    // today (dev falls through — upstream #1227); precedence drops collisions
    // with kept user `pages/` routes (Decision 6).
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

    for (const route of deriveRoutes(settings)) {
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
