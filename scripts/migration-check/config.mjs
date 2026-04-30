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

// ── Hidden-sidebar strip ──────────────────────────────────────────────────────

/**
 * Strip the hidden desktop-sidebar <aside> element from both A and B HTML
 * before signal extraction.
 *
 * Background (phase B-12, issue #907, option (b)):
 *   Tag-listing routes (/docs/tags/<tag> and JA mirrors) use hideSidebar=true.
 *   Site A (old Astro layout) rendered the full nav tree in the DOM and hid it
 *   via CSS; site B (zfb DocLayout) intentionally omits the tree. Stripping
 *   symmetrically from both sides removes the sidebar from the diff so that the
 *   18 affected routes are no longer classified as content-loss.
 *
 *   Default ON for round-7 rerun and beyond. Set to false to restore the old
 *   behaviour where sidebar DOM was included in the content-loss calculation.
 */
export const stripHiddenSidebarDom = true;

// ── Version-switcher strip ────────────────────────────────────────────────────

/**
 * Strip the inline version-switcher <div> element from both A and B HTML
 * before signal extraction.
 *
 * Background (phase B-14-2, issue #914):
 *   A's Astro DocLayout renders <div class="version-switcher"> inline in <main>
 *   next to the breadcrumb, containing "Version: Latest" button text and a
 *   hidden dropdown with version links. zfb's host puts the version-switcher
 *   only in the header. The inline dropdown is cosmetic chrome that is
 *   functionally redundant with the header switcher, but its text (~45 chars)
 *   was counted as content-loss on ~30 of 51 affected routes.
 *
 *   Default ON for B-14-2 rerun and beyond. Set to false to restore the old
 *   behaviour where version-switcher text was included in the content comparison.
 */
export const stripVersionSwitcherDom = true;

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

// ── og:title brand-suffix strip ───────────────────────────────────────────────

/**
 * Trailing suffix to strip from <meta property="og:title" content="…"> values.
 *
 * Background (phase B-15-1, issue #917):
 *   A's Astro DocLayout emits e.g.
 *     <meta property="og:title" content="Page Title | zudo-doc">
 *   B emits:
 *     <meta property="og:title" content="Page Title">
 *   (no brand suffix). Stripping this suffix symmetrically from both sides
 *   removes the false-positive from the metaTags signal.
 *
 *   Set to "" to disable suffix stripping entirely.
 *   Override for downstream projects that use a different brand name
 *   (e.g. " | My Docs").
 */
export const brandSuffix = " | zudo-doc";

// ── Astro view-transitions meta strip ────────────────────────────────────────

/**
 * Strip Astro view-transitions noise meta tags from both A and B HTML before
 * signal extraction.
 *
 * Background (phase B-15-1, issue #917):
 *   A's Astro DocLayout emits two meta tags that B never emits:
 *     <meta name="astro-view-transitions-enabled" content="…">
 *     <meta name="astro-view-transitions-fallback" content="…">
 *   Conceptually identical to the Astro framework-runtime-script noise stripped
 *   in B-14-1. Dropping these symmetrically removes them from the metaTags diff.
 *
 *   Default ON for B-15-1 rerun and beyond. Set to false to restore the old
 *   behaviour where these meta tags were included in the metaTags comparison.
 */
export const stripAstroViewTransitionsMeta = true;

// ── Known upstream fixes (pending binary rebuild) ─────────────────────────────
//
// These are routes that show harness diffs due to a known zfb upstream bug that
// has been fixed but requires a `cargo build -p zfb` rebuild to take effect.
// Once the fix is compiled and the binary is re-linked (`pnpm install`), the
// listed routes should return to parity without any zudo-doc changes.
//
// B-14-5 — zfb MDX named-import stripped from rendered output (issue #914)
//   Root cause: `import { X } from "pkg"` was parsed as a Paragraph because
//   markdown-rs's MdxjsEsm construct requires `mdx_esm_parse` to be Some.
//   Without it the `{ X }` binding became an MdxTextExpression evaluating to
//   `undefined`, leaving a visible double-space skeleton in the page body.
//   Fix: Takazudo/zudo-front-builder#94 — supply a permissive mdx_esm_parse.
//   Affected routes (2): /docs/getting-started/setup-preset-generator (EN + JA)
export const pendingBinaryRebuildRoutes = [
  "/docs/getting-started/setup-preset-generator",
  "/ja/docs/getting-started/setup-preset-generator",
];
