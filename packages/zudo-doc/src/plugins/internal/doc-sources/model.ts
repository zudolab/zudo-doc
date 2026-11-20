// Normalized, build-local model of the doc-sources pipeline. Absolute paths
// live here and in the build-local manifest only; nothing in this model is
// handed to route context, browser bundles or export metadata.

/** Renderers. Public mappings use the first three; presets may use the rest. */
export type DocSourceRenderer =
  | "markdown"
  | "code"
  | "skill"
  | "codex-config"
  | "codex-agent"
  | "codex-hooks"
  | "codex-rules";

/** A translatable label: a translation key with a literal fallback. */
export interface LabelRef {
  key?: string;
  fallback: string;
}

export interface NormalizedMapping {
  sourceId: string;
  id: string;
  /** Absolute, lexically resolved mapping root. */
  root: string;
  include: string[];
  exclude: string[];
  /** POSIX route subtree below the mount ("" for the mount itself). */
  to: string;
  renderer: DocSourceRenderer;
  missing: "error" | "skip";
  assets?: { include: string[]; exclude: string[] };
  /** Lower-cased basenames that become their directory's landing page. */
  landingNames: string[];
  /** Lower-cased extensions removed from a document's route segment. */
  stripExtensions: string[];
  /** Use the source-relative path as the page title. */
  titleFromPath: boolean;
  /** Label of the synthesized section index at `to` (when `to` is set). */
  sectionLabel?: LabelRef;
  sectionDescription?: LabelRef;
}

export interface NormalizedSource {
  id: string;
  mount: string;
  title: LabelRef;
  description?: LabelRef;
  preset?: string;
  /** Directories that must exist (a preset's configuration root). */
  requiredRoots: string[];
  mappings: NormalizedMapping[];
}

/** Everything the pipeline needs, already resolved to absolute paths. */
export interface DocSourcesRunOptions {
  projectRoot: string;
  sources: NormalizedSource[];
  /** Default-locale content directory (absolute). */
  docsDir: string;
  /** Non-default locale content directories (absolute), keyed by locale. */
  locales: Record<string, string>;
  defaultLocale: string;
  defaultLocaleOnlyPrefixes: string[];
  translations: Record<string, Record<string, string>>;
  /** Public directory (absolute); managed assets go below `<publicDir>/doc-sources/`. */
  publicDir: string;
  /** Additional directories excluded from every scan (version roots, outDir, …). */
  excludedRoots: string[];
  /** Build-local state directory holding the ownership manifest. */
  stateDir: string;
}

export interface DocSourcesDiagnostic {
  level: "warn" | "info";
  message: string;
}
