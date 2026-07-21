#!/usr/bin/env tsx
/**
 * scripts/theme-a11y-audit.ts
 *
 * Rendered, per-theme-pack WCAG contrast audit. Renders the BUILT showcase
 * once per (theme pack × light/dark mode) — ~42 states — reads COMPUTED styles
 * on a fixed inventory of chrome + content elements (`theme-a11y-inventory.ts`),
 * computes WCAG AA contrast on the truly-rendered colors (alpha compositing +
 * an effective-background ancestor walk), and gates on "surely problematic"
 * failures. This is the FIRST standalone Playwright-browser script in the repo;
 * the static `pnpm contrast:audit` guard is structurally blind to theme-pack
 * CSS (pure-cascade bugs like the brutalist active-nav chip are invisible to
 * it), which is exactly what this rendered check exists to catch.
 *
 * Verdicts: PASS | WARN | FAIL | ALLOW | SKIP.
 *   - WARN  — passes but within +0.3 of threshold (informational, non-gating).
 *   - ALLOW — a FAIL matched by `theme-a11y-allowlist.ts` (non-gating).
 *   - SKIP  — element exists but its true backdrop is indeterminate (gradient
 *             beneath it, positioned overlay, translucent-all-the-way) — never
 *             a guessed FAIL. "Surely problematic" ⇒ no false positives.
 * `process.exitCode = 1` on ANY unallowlisted FAIL, coverage/config error,
 * stale allowlist entry, per-state render error, or pack-stylesheet load error.
 *
 * Usage:
 *   pnpm theme-a11y:audit                              # build dist/ first, audit all packs × light/dark
 *   pnpm theme-a11y:audit --packs washi --modes light  # one pack, one mode (cheap partial run)
 *   pnpm theme-a11y:audit --packs a,b --modes dark
 *   pnpm theme-a11y:audit --page /docs/reference/color/ # override the audited page
 *   pnpm theme-a11y:audit --url https://preview.example # audit an already-running server (no local serve)
 *   pnpm theme-a11y:audit --out-dir some/dir            # override the (gitignored) output dir
 *
 * Output: `theme-a11y-audit-out/report.json` + a console summary grouped by
 * pack. The out dir is gitignored — not committed.
 *
 * Serving: without `--url`, a prebuilt `dist/` is required (fail fast with a
 * "run pnpm build" message) and served by a minimal in-script `node:http`
 * static server on an ephemeral port — no wrangler dependency. With `--url`,
 * nothing is served and packs are enumerated from the SERVED
 * `/theme-packs/index.json`.
 *
 * FUTURE WORK (out of scope for V1): focus-visible outline contrast (WCAG
 * 2.4.11/1.4.11 for keyboard focus indicators) is NOT audited here — only
 * static, active, and forced-`:hover` states. A follow-up should tab through
 * the same inventory and measure the rendered focus ring.
 */

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, posix, resolve } from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import pc from "picocolors";

import { THEME_A11Y_ALLOWLIST } from "./theme-a11y-allowlist";
import {
  COVERAGE_CONTRACT,
  THRESHOLD_LARGE,
  THRESHOLD_NORMAL,
  THRESHOLD_UI,
  WARN_BAND,
  allowlistKey,
  detectStaleAllowlistEntries,
  evaluateCoverage,
  evaluateSample,
  findAllowlistEntry,
  validateAllowlist,
  type CoverageStats,
  type RawSample,
  type Verdict,
} from "./theme-a11y-evaluator";
import { INVENTORY, collectSamplesInBrowser, type CollectPayload } from "./theme-a11y-inventory";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE = "/docs/components/admonitions/";
const DEFAULT_OUT_DIR = "theme-a11y-audit-out";
const VIEWPORT = { width: 1440, height: 900 } as const;
const THEME_PACK_STORAGE_KEY = "zudo-doc-theme-pack";
const THEME_STORAGE_KEY = "zudo-doc-theme";
const STATE_TIMEOUT_MS = 20_000;
const ALL_MODES = ["light", "dark"] as const;
type Mode = (typeof ALL_MODES)[number];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  packs: string[] | null;
  modes: Mode[];
  url: string | null;
  page: string;
  outDir: string;
}

function parseList(value: string | undefined): string[] | null {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : null;
}

function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      packs: { type: "string" },
      modes: { type: "string" },
      url: { type: "string" },
      page: { type: "string", default: DEFAULT_PAGE },
      "out-dir": { type: "string", default: DEFAULT_OUT_DIR },
    },
  });

  const modeList = parseList(values.modes);
  let modes: Mode[];
  if (modeList) {
    // Reject EVERY unsupported token — silently dropping a typo (e.g.
    // `--modes light,drak`) would audit only light and report a misleading
    // green while dark went unchecked.
    const invalid = modeList.filter((m) => m !== "light" && m !== "dark");
    if (invalid.length > 0) {
      throw new Error(`--modes: unsupported value(s): ${invalid.join(", ")}. Valid: ${ALL_MODES.join(", ")}`);
    }
    modes = modeList as Mode[];
  } else {
    modes = [...ALL_MODES];
  }

  return {
    packs: parseList(values.packs),
    modes,
    url: values.url ? values.url.replace(/\/+$/, "") : null,
    page: String(values.page ?? DEFAULT_PAGE),
    outDir: String(values["out-dir"] ?? DEFAULT_OUT_DIR),
  };
}

// ---------------------------------------------------------------------------
// Minimal static file server (node:http) over a prebuilt dist/
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function resolveStaticFile(root: string, urlPath: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  } catch {
    return null;
  }
  if (!p.startsWith("/")) p = `/${p}`;
  const norm = posix.normalize(p);
  if (norm.includes("..")) return null;
  let filePath = join(root, normalize(norm));
  const dirLike = norm.endsWith("/");
  if (dirLike) {
    filePath = join(filePath, "index.html");
  } else if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }
  return filePath;
}

function startStaticServer(root: string): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((req, res) => {
    const filePath = resolveStaticFile(root, req.url ?? "/");
    if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream");
    createReadStream(filePath).pipe(res);
  });
  return new Promise((resolvePromise, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("static server did not bind a TCP port"));
        return;
      }
      resolvePromise({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

// ---------------------------------------------------------------------------
// Pack enumeration
// ---------------------------------------------------------------------------

interface ThemePacksIndex {
  schemaVersion?: number;
  packs?: Array<{ slug?: string }>;
}

/** Slugs from an index.json payload, `default` always included, order preserved. */
function packsFromIndex(index: ThemePacksIndex): string[] {
  const slugs = (index.packs ?? []).map((p) => p.slug).filter((s): s is string => typeof s === "string");
  const ordered = ["default", ...slugs];
  return [...new Set(ordered)];
}

async function enumeratePacksFromUrl(baseUrl: string): Promise<string[]> {
  const url = `${baseUrl}/theme-packs/index.json`;
  const res = await fetch(url);
  if (!res.ok) {
    // No CSS-bearing pack enabled ⇒ no index.json ⇒ baseline-only audit.
    if (res.status === 404) return ["default"];
    throw new Error(`GET ${url} responded ${res.status}`);
  }
  return packsFromIndex((await res.json()) as ThemePacksIndex);
}

function enumeratePacksFromDist(distDir: string): string[] {
  const indexPath = join(distDir, "theme-packs", "index.json");
  if (!existsSync(indexPath)) return ["default"];
  return packsFromIndex(JSON.parse(readFileSync(indexPath, "utf-8")) as ThemePacksIndex);
}

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

interface ResultRow {
  pack: string;
  mode: Mode;
  elementKey: string;
  selector: string;
  state: string;
  fg: string | null;
  bg: string | null;
  ratio: number | null;
  threshold: number | null;
  verdict: Verdict;
  skipReason?: string;
  text?: string;
}

interface CoverageRow extends CoverageStats {
  pack: string;
  mode: Mode;
  errors: string[];
}

interface StateError {
  pack: string;
  mode: Mode;
  message: string;
}

// ---------------------------------------------------------------------------
// Per-state audit
// ---------------------------------------------------------------------------

async function seedAndGoto(context: BrowserContext, pack: string, mode: Mode, pageUrl: string): Promise<Page> {
  // tsx/esbuild wraps named functions with a `__name(...)` keepNames helper.
  // `page.evaluate(collectSamplesInBrowser, …)` ships that function's SOURCE to
  // the browser, where the helper doesn't exist → `__name is not defined`.
  // Inject a no-op shim as a RAW STRING (not a function literal, so esbuild
  // never transforms it) before any page script runs.
  await context.addInitScript({
    content: "globalThis.__name = globalThis.__name || function (t) { return t; };",
  });
  await context.addInitScript(
    (seed: { packKey: string; packVal: string; themeKey: string; themeVal: string }) => {
      try {
        localStorage.setItem(seed.packKey, seed.packVal);
        localStorage.setItem(seed.themeKey, seed.themeVal);
      } catch {
        /* storage unavailable — page bootstrap will fall back to defaults */
      }
    },
    { packKey: THEME_PACK_STORAGE_KEY, packVal: pack, themeKey: THEME_STORAGE_KEY, themeVal: mode },
  );
  const page = await context.newPage();
  await page.goto(pageUrl, { waitUntil: "load", timeout: STATE_TIMEOUT_MS });
  return page;
}

async function waitForPackApplied(page: Page, pack: string, mode: Mode): Promise<void> {
  await page.waitForFunction(
    (expected: { pack: string; mode: string }) => {
      const html = document.documentElement;
      return (
        html.getAttribute("data-theme-pack") === expected.pack &&
        html.getAttribute("data-theme") === expected.mode
      );
    },
    { pack, mode },
    { timeout: STATE_TIMEOUT_MS },
  );

  if (pack !== "default") {
    // The switch commits only after the incoming stylesheet loads (ADR
    // Decision 3): the link exists and has shed its loading marker.
    await page.waitForFunction(
      () => {
        const link = document.querySelector("link[data-zd-theme-pack-css]");
        const loading = document.querySelector("link[data-zd-theme-pack-css-loading]");
        return Boolean(link) && !loading;
      },
      undefined,
      { timeout: STATE_TIMEOUT_MS },
    );
  }
}

async function collectStaticSamples(page: Page): Promise<RawSample[]> {
  const payload: CollectPayload = { items: [...INVENTORY] };
  return page.evaluate(collectSamplesInBrowser, payload);
}

async function collectHoverSamples(page: Page): Promise<RawSample[]> {
  const samples: RawSample[] = [];
  for (const item of INVENTORY) {
    if (!item.hover) continue;
    const locator = page.locator(item.selector).first();
    try {
      if ((await locator.count()) === 0) continue;
      await locator.hover({ timeout: 5_000 });
      const payload: CollectPayload = { items: [item], stateOverride: "hover", firstOnly: true };
      const hovered = await page.evaluate(collectSamplesInBrowser, payload);
      samples.push(...hovered);
    } catch {
      // Hover is a best-effort extra measurement — an unhoverable element
      // (off-screen after scroll, covered) is not a gating failure.
    } finally {
      // Park the pointer in a neutral corner so the next element isn't
      // measured with a stale :hover leaking in.
      await page.mouse.move(VIEWPORT.width - 1, 1).catch(() => {});
    }
  }
  return samples;
}

/**
 * The active TOC entry (`toc-active`, `nav[data-zd-toc] a[aria-current="true"]`)
 * is NOT server-rendered: the scroll-spy island (`toc/use-active-heading.ts`)
 * sets `aria-current="true"` on the client, from scroll position, only after it
 * hydrates. Collecting the static pass at scroll-top therefore measures ZERO
 * `toc-active` elements, so a pack's active-TOC rule (e.g. phosphor `:449` /
 * washi — the epic's pre-identified suspects) would be silently un-adjudicated.
 *
 * Drive the state the same way `e2e/smoke-toc.spec.ts` does — scroll a heading
 * to the top and let the spy mark an entry active. Scroll position survives
 * hydration (the island's mount-time `update()` reads the current position), so
 * this is timing-robust without guessing at a hydration signal. Run LAST, after
 * the static + hover passes, so its scroll never perturbs their measurements.
 * Returns [] (no wasted wait) when there is no Toc island to hydrate — e.g. the
 * static rendered-fixture test page.
 */
async function collectTocActiveSamples(page: Page): Promise<RawSample[]> {
  const tocItem = INVENTORY.find((i) => i.key === "toc-active");
  if (!tocItem) return [];

  const primed = await page.evaluate(() => {
    if (!document.querySelector('[data-zfb-island="Toc"]')) return false;
    const anchors = Array.from(
      document.querySelectorAll('nav[data-zd-toc] a[href^="#"]'),
    ) as HTMLAnchorElement[];
    if (anchors.length === 0) return false;
    // A mid-list heading guarantees a neighbour on each side, so the spy's
    // "first heading below the fold, activate its predecessor" rule always
    // resolves to a real entry regardless of the page's intro length.
    const pick = anchors[Math.floor(anchors.length / 2)]!;
    const id = decodeURIComponent((pick.getAttribute("href") ?? "#").slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return false;
    target.scrollIntoView({ behavior: "instant", block: "start" });
    return true;
  });
  if (!primed) return [];

  try {
    await page.waitForFunction(
      () => document.querySelector('nav[data-zd-toc] a[aria-current="true"]') !== null,
      undefined,
      { timeout: 8_000 },
    );
  } catch {
    // Island never marked an entry active (no hydration, empty TOC) — the
    // static pass already recorded zero toc-active rows; nothing to add.
    return [];
  }

  const payload: CollectPayload = { items: [tocItem], firstOnly: true };
  return page.evaluate(collectSamplesInBrowser, payload);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));

  // Resolve base URL + pack universe.
  let server: Server | null = null;
  let baseUrl: string;
  let allPacks: string[];
  let servingMode: "served" | "url";

  if (opts.url) {
    servingMode = "url";
    baseUrl = opts.url;
    allPacks = await enumeratePacksFromUrl(baseUrl);
  } else {
    servingMode = "served";
    const distDir = resolve(process.cwd(), "dist");
    const pageIndex = resolveStaticFile(distDir, opts.page);
    if (!existsSync(distDir) || !pageIndex || !existsSync(pageIndex)) {
      console.error(
        pc.red(
          `theme-a11y-audit: no built page found at "${opts.page}" under dist/.\n` +
            `Run \`pnpm build\` first (or pass \`--url <base>\` to audit a running server).`,
        ),
      );
      process.exitCode = 1;
      return;
    }
    const started = await startStaticServer(distDir);
    server = started.server;
    baseUrl = started.baseUrl;
    allPacks = enumeratePacksFromDist(distDir);
  }

  // Apply --packs filter (validate against the known universe).
  let packs = allPacks;
  if (opts.packs) {
    const known = new Set(allPacks);
    const unknown = opts.packs.filter((p) => !known.has(p));
    if (unknown.length > 0) {
      console.error(
        pc.red(`theme-a11y-audit: unknown pack(s): ${unknown.join(", ")}. Known: ${allPacks.join(", ")}`),
      );
      if (server) server.close();
      process.exitCode = 1;
      return;
    }
    packs = opts.packs;
  }

  const pageUrl = `${baseUrl}${opts.page}`;
  const results: ResultRow[] = [];
  const coverage: CoverageRow[] = [];
  const stateErrors: StateError[] = [];
  const stylesheetErrors: StateError[] = [];
  const consumedKeys = new Set<string>();

  console.log(
    pc.bold(
      `theme-a11y-audit — ${packs.length} pack(s) × ${opts.modes.length} mode(s) = ${
        packs.length * opts.modes.length
      } states\n` + `page: ${opts.page}   source: ${servingMode === "url" ? baseUrl : "local dist/ (served)"}`,
    ),
  );

  try {
    // A fresh browser PER PACK, not one shared across all ~42 states. A single
    // long-lived Chromium accumulates renderer memory context-by-context and, on
    // a constrained host (WSL/CI), dies mid-run — after which every subsequent
    // `newContext()` throws "Target page, context or browser has been closed"
    // and the whole audit crashes with a partial report. Per-pack relaunch
    // bounds memory to two states and isolates a crash to at most one pack.
    for (const pack of packs) {
      const browser: Browser = await chromium.launch();
      try {
        for (const mode of opts.modes) {
          let context: BrowserContext | null = null;
          try {
            context = await browser.newContext({ viewport: { ...VIEWPORT } });
            // Watch for pack-stylesheet load failures before navigating.
            context.on("requestfailed", (req) => {
              const url = req.url();
              if (url.includes(`/theme-packs/${pack}/pack.css`)) {
                stylesheetErrors.push({ pack, mode, message: `requestfailed: ${url}` });
              }
            });
            context.on("response", (res) => {
              const url = res.url();
              if (url.includes(`/theme-packs/${pack}/pack.css`) && res.status() >= 400) {
                stylesheetErrors.push({ pack, mode, message: `HTTP ${res.status()} for ${url}` });
              }
            });

            const page = await seedAndGoto(context, pack, mode, pageUrl);
            await waitForPackApplied(page, pack, mode);
            // Freeze transitions/animations so computed styles are stable.
            await page.addStyleTag({
              content: "*,*::before,*::after{transition:none!important;animation:none!important}",
            });

            const staticSamples = await collectStaticSamples(page);
            const hoverSamples = await collectHoverSamples(page);
            const tocActiveSamples = await collectTocActiveSamples(page);
            const samples = [...staticSamples, ...hoverSamples, ...tocActiveSamples];

            // Evaluate + accumulate coverage stats for this state.
            const groupCounts: Record<string, number> = {};
            let matched = 0;
            let skipped = 0;

            for (const sample of samples) {
              const ev = evaluateSample(sample);
              let verdict: Verdict = ev.verdict;
              if (verdict === "FAIL") {
                const entry = findAllowlistEntry(THEME_A11Y_ALLOWLIST, pack, mode, sample.elementKey, sample.state);
                if (entry) {
                  verdict = "ALLOW";
                  consumedKeys.add(allowlistKey(pack, mode, sample.elementKey, sample.state));
                }
              }

              const isDecorative = sample.kind === "decorative";
              if (!isDecorative) {
                matched++;
                // Only INDETERMINATE skips (couldn't measure the backdrop) count
                // toward the coverage MAX_SKIP_RATIO ceiling. A `straddle` skip is
                // a determinate "gradient crosses the threshold" result, not a
                // checker gap, so it must not trip the "evaluator mis-measuring" guard.
                if (ev.verdict === "SKIP" && ev.skipKind !== "straddle") skipped++;
                if (sample.state !== "hover") {
                  groupCounts[sample.elementKey] = (groupCounts[sample.elementKey] ?? 0) + 1;
                }
              }

              results.push({
                pack,
                mode,
                elementKey: sample.elementKey,
                selector: sample.selector,
                state: sample.state,
                fg: ev.fg,
                bg: ev.bg,
                ratio: ev.ratio,
                threshold: ev.threshold,
                verdict,
                ...(ev.skipReason ? { skipReason: ev.skipReason } : {}),
                ...(sample.text ? { text: sample.text } : {}),
              });
            }

            const stats: CoverageStats = { groupCounts, matched, skipped };
            const covErrors = evaluateCoverage(`${pack}/${mode}`, stats);
            coverage.push({ pack, mode, ...stats, errors: covErrors });

            await page.close();
          } catch (err) {
            stateErrors.push({ pack, mode, message: err instanceof Error ? err.message : String(err) });
          } finally {
            if (context) await context.close().catch(() => {});
          }
        }
      } finally {
        await browser.close().catch(() => {});
      }
    }
  } finally {
    if (server) server.close();
  }

  // -------------------------------------------------------------------------
  // Aggregate, report, exit code
  // -------------------------------------------------------------------------

  const auditedPacks = new Set(packs);
  const auditedModes = new Set<string>(opts.modes);
  const reasonErrors = validateAllowlist(THEME_A11Y_ALLOWLIST);
  const staleScope = THEME_A11Y_ALLOWLIST.filter(
    (e) => auditedPacks.has(e.pack) && auditedModes.has(e.mode),
  );
  const staleEntries = detectStaleAllowlistEntries(staleScope, consumedKeys);

  const counts: Record<Verdict, number> = { PASS: 0, WARN: 0, FAIL: 0, ALLOW: 0, SKIP: 0 };
  for (const r of results) counts[r.verdict]++;
  const failing = results.filter((r) => r.verdict === "FAIL");
  const coverageErrors = coverage.flatMap((c) => c.errors);

  printConsoleSummary({
    packs,
    modes: opts.modes,
    results,
    coverage,
    counts,
    failing,
    stateErrors,
    stylesheetErrors,
    reasonErrors,
    staleEntries,
    coverageErrors,
  });

  const outDirAbs = resolve(process.cwd(), opts.outDir);
  await mkdir(outDirAbs, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    page: opts.page,
    baseUrl,
    servingMode,
    packs,
    modes: opts.modes,
    thresholds: { normal: THRESHOLD_NORMAL, large: THRESHOLD_LARGE, ui: THRESHOLD_UI, warnBand: WARN_BAND },
    coverageContract: COVERAGE_CONTRACT,
    counts,
    coverage,
    stateErrors,
    stylesheetErrors,
    allowlist: {
      total: THEME_A11Y_ALLOWLIST.length,
      consumed: [...consumedKeys],
      stale: staleEntries,
      reasonErrors,
    },
    results,
  };
  const jsonPath = join(outDirAbs, "report.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  console.log(pc.dim(`\nJSON report written to ${jsonPath}`));

  const gating =
    failing.length > 0 ||
    coverageErrors.length > 0 ||
    stateErrors.length > 0 ||
    stylesheetErrors.length > 0 ||
    reasonErrors.length > 0 ||
    staleEntries.length > 0;
  if (gating) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Console summary
// ---------------------------------------------------------------------------

interface SummaryInput {
  packs: string[];
  modes: Mode[];
  results: ResultRow[];
  coverage: CoverageRow[];
  counts: Record<Verdict, number>;
  failing: ResultRow[];
  stateErrors: StateError[];
  stylesheetErrors: StateError[];
  reasonErrors: string[];
  staleEntries: string[];
  coverageErrors: string[];
}

function fmtRatio(r: number | null): string {
  return r === null ? "—" : `${r.toFixed(2)}:1`;
}

function printConsoleSummary(s: SummaryInput): void {
  for (const pack of s.packs) {
    const packRows = s.results.filter((r) => r.pack === pack);
    if (packRows.length === 0 && !s.stateErrors.some((e) => e.pack === pack)) continue;
    console.log(pc.bold(`\n■ ${pack}`));

    for (const mode of s.modes) {
      const rows = packRows.filter((r) => r.mode === mode);
      const cov = s.coverage.find((c) => c.pack === pack && c.mode === mode);
      const stErr = s.stateErrors.find((e) => e.pack === pack && e.mode === mode);
      const c: Record<Verdict, number> = { PASS: 0, WARN: 0, FAIL: 0, ALLOW: 0, SKIP: 0 };
      for (const r of rows) c[r.verdict]++;

      const head = `  ${mode.padEnd(5)}  ${pc.green(`${c.PASS} pass`)}  ${
        c.WARN ? pc.yellow(`${c.WARN} warn`) : `${c.WARN} warn`
      }  ${c.FAIL ? pc.red(pc.bold(`${c.FAIL} FAIL`)) : "0 fail"}  ${c.ALLOW} allow  ${c.SKIP} skip` +
        (cov ? pc.dim(`   (matched ${cov.matched}, skipped ${cov.skipped})`) : "");
      console.log(stErr ? `${head}  ${pc.red("[render error]")}` : head);

      if (stErr) console.log(pc.red(`         render error: ${stErr.message}`));
      for (const r of rows.filter((x) => x.verdict === "FAIL")) {
        console.log(
          pc.red(
            `         FAIL ${r.elementKey}/${r.state}  ${fmtRatio(r.ratio)} < ${r.threshold}:1  ${r.fg} on ${r.bg}` +
              (r.text ? pc.dim(`  "${r.text}"`) : ""),
          ),
        );
      }
      for (const e of cov?.errors ?? []) console.log(pc.red(`         coverage: ${e}`));
    }
  }

  console.log(pc.bold("\n── Summary ─────────────────────────────"));
  console.log(
    `  ${pc.green(`${s.counts.PASS} pass`)}   ${pc.yellow(`${s.counts.WARN} warn`)}   ${
      s.counts.FAIL ? pc.red(pc.bold(`${s.counts.FAIL} FAIL`)) : "0 fail"
    }   ${s.counts.ALLOW} allow   ${s.counts.SKIP} skip`,
  );
  if (s.stylesheetErrors.length > 0) {
    console.log(pc.red(`  ${s.stylesheetErrors.length} pack-stylesheet load error(s):`));
    for (const e of s.stylesheetErrors) console.log(pc.red(`    ${e.pack}/${e.mode}: ${e.message}`));
  }
  if (s.reasonErrors.length > 0) {
    console.log(pc.red(`  ${s.reasonErrors.length} allowlist reason error(s):`));
    for (const e of s.reasonErrors) console.log(pc.red(`    ${e}`));
  }
  if (s.staleEntries.length > 0) {
    console.log(pc.red(`  ${s.staleEntries.length} stale allowlist entr(y/ies) — remove or fix:`));
    for (const e of s.staleEntries) console.log(pc.red(`    ${e}`));
  }

  const gating =
    s.counts.FAIL > 0 ||
    s.coverageErrors.length > 0 ||
    s.stateErrors.length > 0 ||
    s.stylesheetErrors.length > 0 ||
    s.reasonErrors.length > 0 ||
    s.staleEntries.length > 0;
  console.log(gating ? pc.red(pc.bold("\n✖ FAIL — see findings above (exit 1)")) : pc.green(pc.bold("\n✓ PASS — no gating findings")));
}

await main();
