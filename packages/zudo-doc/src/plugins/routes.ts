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
// The single `setup(ctx)` hook does BOTH (Decision 1):
//
//   1. addVirtualModule("virtual:zudo-doc-route-context", …) — emits the
//      route-context as ESM source carrying SERIALIZABLE DATA ONLY: the
//      project `settings`, the host UI-string `translations` table, and the
//      `tagVocabulary`. No host functions, no Preact components, no `@/`
//      imports ever travel through this module — everything callable is an
//      importable package subpath that each route entrypoint reconstructs.
//
//   2. injectRoute(pattern, entrypoint[, opts]) — the 16-route catalog
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
  [key: string]: unknown;
}

/** Plugin `options` block — see the preset's `buildPlugins`. */
interface RoutesPluginOptions {
  settings: RoutesSettings;
  translations: Record<string, Record<string, string>>;
  tagVocabulary: ReadonlyArray<Record<string, unknown>>;
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
  routes.push({ pattern: "/", entrypoint: "@takazudo/zudo-doc/routes/index" });
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
        })};\n`,
    );

    // (2) Inject the derived route catalog (Decision 3). Build-only render
    // today (dev falls through — upstream #1227); precedence drops collisions
    // with kept user `pages/` routes (Decision 6).
    for (const route of deriveRoutes(settings)) {
      ctx.injectRoute(route.pattern, route.entrypoint, route.opts);
    }
  },
});

export default plugin;
