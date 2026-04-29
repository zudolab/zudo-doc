/**
 * config.mjs — shared constants for the zfb migration-check harness.
 *
 * Every other script in scripts/migration-check/ imports from here.
 * Defaults are tuned for the zudo-doc repo layout and port availability.
 * Consuming scripts may override individual values via environment variables.
 */

// ── Git refs ─────────────────────────────────────────────────────────────────

/** Ref for the "before" build (current production baseline). */
export const fromRef = "origin/main";

/** Ref for the "after" build (branch under review). */
export const toRef = "HEAD";

// ── Dev-server ports ──────────────────────────────────────────────────────────

/** Port for the "A" (from) site preview. */
export const portA = 4400;

/** Port for the "B" (to) site preview. */
export const portB = 4401;

// ── Workspace directories ─────────────────────────────────────────────────────

/** Root of the throwaway workspace (gitignored). */
export const workspaceDir = ".l-zfb-migration-check";

/** Static snapshot captured from site A (fromRef). */
export const snapshotADir = `${workspaceDir}/snapshot-a`;

/** Static snapshot captured from site B (toRef). */
export const snapshotBDir = `${workspaceDir}/snapshot-b`;

/** Per-URL diff findings written here by the compare step. */
export const findingsDir = `${workspaceDir}/findings`;

/** Human-readable final report rendered by the report step. */
export const reportPath = `${workspaceDir}/report.md`;

// ── Batch / concurrency ───────────────────────────────────────────────────────

/** Number of URLs per comparison batch. */
export const defaultBatchSize = 30;

/** How many batches may run concurrently. */
export const maxConcurrentBatches = 6;

// ── Port lock-files ───────────────────────────────────────────────────────────

/**
 * Directory for flock-based port lock files.
 * Lives in /tmp so it survives worktree re-clones without cluttering the repo.
 */
export const lockDir = "/tmp/l-zfb-migration-check-locks/";

// ── Site prefix ───────────────────────────────────────────────────────────────

/**
 * URL path prefix used by the deployed site (e.g. Cloudflare Pages project
 * path). Configurable so the harness can be reused on other projects.
 */
export const sitePrefix = "/pj/zudo-doc/";

// ── Cosmetic-by-default markers ───────────────────────────────────────────────

/**
 * Diff categories that are always considered cosmetic (not behavioral
 * regressions). The compare step auto-labels findings that match any of
 * these markers so the report can filter them out or render them dimmed.
 *
 * Marker semantics:
 *   doc-history-timestamp  — "last updated" timestamps shift every build
 *   search-index-ordering  — search-index.json entry order is non-deterministic
 *   sitemap-route-order    — sitemap.xml route ordering varies between builds
 *   build-hash-filename    — content-hashed asset filenames change each build
 */
export const cosmeticByDefaultMarkers = [
  "doc-history-timestamp",
  "search-index-ordering",
  "sitemap-route-order",
  "build-hash-filename",
];
