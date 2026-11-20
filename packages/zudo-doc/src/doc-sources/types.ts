// Public, data-only configuration types for the `docSources` feature.
//
// This module is part of the config/preset evaluation graph, so it must stay
// free of Node built-ins and runtime imports. All filesystem work happens in
// the package-owned `@takazudo/zudo-doc/plugins/doc-sources` plugin and the
// `zudo-doc sources watch` entry.

/** Bundled presets that expand into ordinary mappings. */
export type DocSourcePresetName = "claude-code" | "codex";

/** How a mapped file is rendered into documentation. */
export type DocSourceFormat = "markdown" | "code" | "skill";

/** What to do when a mapping root does not exist. */
export type DocSourceMissingPolicy = "error" | "skip";

/** A file selection relative to a mapping root. */
export interface DocSourceAssetSelection {
  /** Glob patterns (relative to the mapping root) of assets to publish. */
  include: string[];
  /** Glob patterns removed from `include`. */
  exclude?: string[];
}

/** One custom mapping from a source tree into a documentation subtree. */
export interface DocSourceMapping {
  /** Stable mapping identifier, unique within its source. */
  id: string;
  /**
   * Directory the mapping reads from. Relative paths resolve from the
   * documentation project root; absolute paths and an explicit `~/` prefix
   * are also accepted.
   */
  root: string;
  /** Glob patterns, relative to `root`, selecting the documents to publish. */
  include: string[];
  /** Glob patterns removed from `include`. */
  exclude?: string[];
  /**
   * Relative route subtree below the source mount (for example
   * `"handbook"` or `"guides/ops"`). Defaults to the mount itself.
   */
  to?: string;
  /** Rendering of every selected document. */
  format: DocSourceFormat;
  /** Missing-root policy. Defaults to `"error"`. */
  missing?: DocSourceMissingPolicy;
  /** Non-document files (images, attachments) to publish as managed assets. */
  assets?: DocSourceAssetSelection;
}

/** A bundled preset instance. */
export interface DocSourcePresetEntry {
  /** Stable source identifier. Also the default mount. */
  id: string;
  preset: DocSourcePresetName;
  /** The agent configuration directory, for example `.claude` or `.codex`. */
  root: string;
  /**
   * Directory scanned for instruction files (`CLAUDE.md`, `AGENTS.md`) and,
   * for Codex, `.agents/skills`. Defaults to the documentation project root.
   */
  scanRoot?: string;
  /** Top-level documentation segment. Defaults to `id`. */
  mount?: string;
}

/** A custom source built from explicit mappings. */
export interface DocSourceCustomEntry {
  /** Stable source identifier. Also the default mount. */
  id: string;
  /** Display title of the source's landing page. */
  title: string;
  /** Top-level documentation segment. Defaults to `id`. */
  mount?: string;
  mappings: DocSourceMapping[];
}

export type DocSourceEntry = DocSourcePresetEntry | DocSourceCustomEntry;
