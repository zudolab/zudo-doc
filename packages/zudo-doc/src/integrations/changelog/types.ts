export interface ChangelogConfig {
  sourceDir: string;
  outputFile: string;
  packageName?: string;
  title?: string;
}

export interface ChangelogEmitOptions {
  projectRoot: string;
  changelogs: readonly ChangelogConfig[];
  logger?: ChangelogLogger;
}

export interface ChangelogEmitResult {
  written: string[];
}

export interface ChangelogLogger {
  info(message: string): void;
  warn?(message: string): void;
}

export interface ChangelogEntry {
  version: string;
  date?: string;
  content: string;
  sourcePath: string;
}

export interface ChangelogLoadOptions {
  sourceDir: string;
}

export interface ChangelogGenerateOptions {
  title?: string;
  packageName?: string;
}
