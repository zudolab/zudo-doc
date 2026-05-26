/**
 * Public types for the framework-agnostic llms-txt build emitter.
 *
 * The shapes here are deliberately decoupled from `astro:content` and
 * Astro's `AstroIntegration` API so the emitter can run on top of any
 * pipeline that exposes a `dist/` output directory and a list of
 * markdown content roots — Astro today, zfb tomorrow, plain Node tooling
 * in a unit test, etc.
 */

/**
 * Frontmatter fields the loader reads off of each MDX/MD file. Callers
 * are free to extend this; unrecognised fields are ignored.
 */
export interface LlmsTxtFrontmatter {
  title?: string;
  description?: string;
  sidebar_position?: number;
  draft?: boolean;
  unlisted?: boolean;
  /**
   * `true` when the page is excluded from search and llms.txt indexing.
   * Mirrors the `search_exclude` flag used by the existing project.
   */
  search_exclude?: boolean;
  [key: string]: unknown;
}

/**
 * One entry in the generated llms.txt / llms-full.txt files. Pure data,
 * already sorted, already stripped — generators (`generateLlmsTxt`,
 * `generateLlmsFullTxt`) consume this without further processing.
 */
export interface LlmsDocEntry {
  /** Page title (frontmatter `title`, with the slug as a fallback). */
  title: string;
  /**
   * Short description used as the bullet's right-hand side in
   * `llms.txt`. Falls back to the first non-blank prose line of the
   * stripped body when `frontmatter.description` is absent.
   */
  description: string;
  /**
   * Public URL for the page. Absolute when `siteUrl` is supplied to the
   * loader, otherwise a path-only URL beginning with `base`.
   */
  url: string;
  /**
   * Body content with imports/exports/JSX tags removed. Used verbatim
   * inside `llms-full.txt`.
   */
  content: string;
  /** `frontmatter.sidebar_position`, undefined when not declared. */
  sidebarPosition: number | undefined;
}

/**
 * Site-level metadata threaded through the generators. Matches the
 * `siteName` / `siteDescription` fields on the legacy settings object
 * one-for-one so callers can pass `settings` straight through.
 */
export interface LlmsTxtSiteMeta {
  siteName: string;
  siteDescription: string;
}

/**
 * One locale's content directory + URL prefix. The default locale is
 * represented separately on {@link LlmsTxtEmitOptions}; this type
 * describes the *additional* locales (e.g. `ja`).
 */
export interface LlmsTxtLocaleConfig {
  /** Locale code used as both the URL segment and the output subfolder. */
  code: string;
  /** Absolute or cwd-relative path to the locale's content root. */
  dir: string;
}

/**
 * Options for {@link loadDocEntries} — one content directory at a time.
 */
export interface LlmsTxtLoadOptions {
  /** Absolute or cwd-relative path to the markdown content root. */
  contentDir: string;
  /**
   * Locale segment for the generated URLs. Pass `null` to omit the
   * locale segment (the default locale).
   */
  locale: string | null;
  /**
   * URL base, with or without a trailing slash. The loader strips the
   * trailing slash before joining.
   */
  base: string;
  /**
   * Optional absolute site URL. When set, the loader produces fully
   * qualified URLs by prefixing the base+path with `siteUrl`. When
   * empty, URLs are returned path-only (matching the legacy emitter's
   * behaviour for projects that omit `siteUrl`).
   */
  siteUrl?: string;
}

/**
 * Top-level options for {@link emitLlmsTxt}. Mirrors the inputs the
 * legacy Astro emitter pulled implicitly off of the project's `settings`
 * module so that a one-line registration in `zfb.config.ts` (or a
 * `b4-build` hook in Astro) can wire the same behaviour.
 */
export interface LlmsTxtEmitOptions extends LlmsTxtSiteMeta {
  /** Absolute output directory — typically `dist/`. */
  outDir: string;
  /** URL base used when materialising per-page links. */
  base: string;
  /** Optional absolute site URL; see {@link LlmsTxtLoadOptions}. */
  siteUrl?: string;
  /**
   * Default-locale content directory. Emitted at `outDir/llms.txt` and
   * `outDir/llms-full.txt`.
   */
  defaultLocaleDir: string;
  /**
   * Additional locales. Each one emits to
   * `outDir/<code>/llms.txt` and `outDir/<code>/llms-full.txt`.
   */
  locales?: LlmsTxtLocaleConfig[];
  /**
   * Optional logger. Defaults to a no-op so unit tests stay quiet; the
   * Astro adapter can wire `astro:build:done`'s `logger` through, and
   * a future zfb plugin can pipe its own.
   */
  logger?: LlmsTxtLogger;
}

/**
 * Minimal logger interface — a structural subset of both Astro's
 * `logger` and `console`. Only `info` is used today; the wider shape is
 * provided so the option can hold either object without type acrobatics.
 */
export interface LlmsTxtLogger {
  info: (msg: string) => void;
}

/**
 * Result returned by {@link emitLlmsTxt}. Useful for tests and for
 * callers that want to log / further process the emitted set.
 */
export interface LlmsTxtEmitResult {
  /** Absolute paths of every file written, in emit order. */
  written: string[];
}
