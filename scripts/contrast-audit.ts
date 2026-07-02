#!/usr/bin/env tsx
/**
 * scripts/contrast-audit.ts
 *
 * WCAG contrast audit for every built-in color scheme + tweak preset
 * (`colorSchemes` + `colorTweakPresets` — 52 total). Evaluates a
 * data-driven pair matrix (Tier 1 text pairs ≥ 4.5:1, Tier 2 graphics
 * pairs ≥ 3.0:1 unless noted), prints a per-scheme PASS/FAIL table,
 * and writes a machine-readable JSON report.
 *
 * All colors are resolved via `schemeToCssPairs` — the SAME function
 * `ColorSchemeProvider` uses to emit `--zd-*` custom properties in
 * production — so this audit can never silently diverge from what the
 * site actually renders. Admonition pairs replicate the exact
 * `color-mix(in srgb, var(--color-X) 12%, var(--color-bg))` construction
 * from `packages/zudo-doc/src/content.css`.
 *
 * Usage:
 *   pnpm contrast:audit             # console table + contrast-audit-out/report.json
 *   pnpm contrast:audit --html      # also writes contrast-audit-out/preview.html
 *   pnpm contrast:audit --suggest   # also prints derived semantic/palette override
 *                                   # fixes for every scheme with a pair below
 *                                   # threshold+HEADROOM (S3 #2492, headroom S8 #2489)
 *   pnpm contrast:audit --suggest --headroom 0.1   # override the headroom target
 *
 * Output goes to a gitignored directory — not committed. See S2/S3
 * (zudolab/zudo-doc#2489) for matrix refinements: PAIR_MATRIX lives in
 * `./contrast-pair-matrix.ts` (shared with the vitest guard, no drift), and
 * the `--suggest` derivation engine lives in `./contrast-suggest.ts`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import pc from "picocolors";

import { PAIR_MATRIX, getAllPresets, evaluateScheme } from "./contrast-pair-matrix";
import type { SchemeReport, PairResult } from "./contrast-pair-matrix";
import { buildSuggestionFragment, HEADROOM } from "./contrast-suggest";

// ---------------------------------------------------------------------------
// Console report
// ---------------------------------------------------------------------------

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
}

function padCell(str: string, width: number): string {
  return str.length >= width ? str : str + " ".repeat(width - str.length);
}

function printSchemeTable(report: SchemeReport): void {
  const headerLine = `${report.name} [${report.source}] — ${report.passCount}/${report.pairs.length} pairs pass`;
  console.log(report.allPass ? pc.green(pc.bold(headerLine)) : pc.red(pc.bold(headerLine)));

  const cols = { key: 26, colors: 22, ratio: 8, threshold: 6, status: 6 };
  const headerRow = [
    padCell("pair", cols.key),
    padCell("fg → bg", cols.colors),
    padCell("ratio", cols.ratio),
    padCell("need", cols.threshold),
    padCell("status", cols.status),
  ].join(" ");
  console.log(pc.dim(headerRow));

  for (const pair of report.pairs) {
    const colorsCell = truncate(`${pair.fg} → ${pair.bg}`, cols.colors);
    const statusText = pair.pass ? "PASS" : "FAIL";
    const row = [
      padCell(pair.key, cols.key),
      padCell(colorsCell, cols.colors),
      padCell(`${pair.ratio.toFixed(2)}:1`, cols.ratio),
      padCell(`${pair.threshold}:1`, cols.threshold),
      pair.pass ? pc.green(statusText) : pc.red(statusText),
    ].join(" ");
    console.log(row);
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// HTML preview — self-contained static HTML. Every color/ratio comes
// straight from the already-computed PairResult (same numbers as the console
// table and JSON report) — the preview must never become a second source of
// truth showing ratios the real DOM doesn't.
// ---------------------------------------------------------------------------

const ADMONITION_VARIANTS: Array<{ title: string; icon: string; pairKey: string }> = [
  { title: "Note", icon: "📝", pairKey: "admonition-accent" },
  { title: "Tip", icon: "💡", pairKey: "admonition-success" },
  { title: "Warning", icon: "⚠️", pairKey: "admonition-warning" },
  { title: "Info", icon: "ℹ️", pairKey: "admonition-info" },
  { title: "Danger", icon: "🚨", pairKey: "admonition-danger" },
  { title: "Important", icon: "❗", pairKey: "admonition-important" },
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ratioBadge(pair: PairResult): string {
  const cls = pair.pass ? "badge pass" : "badge fail";
  return `<span class="${cls}">${pair.ratio.toFixed(2)}:1 (need ${pair.threshold}:1)</span>`;
}

function renderSchemeSection(report: SchemeReport): string {
  const byKey = new Map(report.pairs.map((p) => [p.key, p]));
  const get = (key: string): PairResult => {
    const pair = byKey.get(key);
    if (!pair) throw new Error(`Missing pair result for key "${key}"`);
    return pair;
  };

  const fgVsBg = get("fg-vs-bg");
  const fgVsSurface = get("fg-vs-surface");
  const muted = get("muted-vs-bg");
  const accent = get("accent-vs-bg");
  const accentHover = get("accent-hover-vs-bg");
  const code = get("code-fg-vs-code-bg");
  const selection = get("selection");
  const matchedKeyword = get("matched-keyword");
  const chatUser = get("chat-user");
  const chatAssistant = get("chat-assistant");

  const admonitionsHtml = ADMONITION_VARIANTS.map(({ title, icon, pairKey }) => {
    const pair = get(pairKey);
    return `
    <div class="admonition" style="border-left-color: ${pair.fg}; background-color: ${pair.bg};">
      <strong style="color: ${pair.fg};">${icon} ${escapeHtml(title)}</strong> ${ratioBadge(pair)}
    </div>`;
  }).join("");

  const overallCls = report.allPass ? "badge pass" : "badge fail";

  return `
<section class="scheme" style="background-color: ${fgVsBg.bg}; color: ${fgVsBg.fg};">
  <h2>${escapeHtml(report.name)} <small>(${report.source})</small>
    <span class="${overallCls}">${report.passCount}/${report.pairs.length} pairs pass</span>
  </h2>

  <p class="sample">Body text on background. ${ratioBadge(fgVsBg)}</p>
  <p class="sample" style="background-color: ${fgVsSurface.bg};">Body text on surface. ${ratioBadge(fgVsSurface)}</p>
  <p class="sample" style="color: ${muted.fg};">Muted secondary text. ${ratioBadge(muted)}</p>
  <p class="sample">
    <a style="color: ${accent.fg};" href="#">Accent link</a>
    <a style="color: ${accentHover.fg};" href="#">Hover state</a>
    ${ratioBadge(accent)} ${ratioBadge(accentHover)}
  </p>
  <p class="sample"><code style="background-color: ${code.bg}; color: ${code.fg};">const inline = "code";</code> ${ratioBadge(code)}</p>
  ${admonitionsHtml}
  <p class="sample"><span style="background-color: ${selection.bg}; color: ${selection.fg};">Selected text sample</span> ${ratioBadge(selection)}</p>
  <p class="sample"><mark style="background-color: ${matchedKeyword.bg}; color: ${matchedKeyword.fg};">matched keyword</mark> ${ratioBadge(matchedKeyword)}</p>
  <p class="sample">
    <span class="chat-bubble" style="background-color: ${chatUser.bg}; color: ${chatUser.fg};">User message</span>
    <span class="chat-bubble" style="background-color: ${chatAssistant.bg}; color: ${chatAssistant.fg};">Assistant reply</span>
    ${ratioBadge(chatUser)} ${ratioBadge(chatAssistant)}
  </p>
</section>`;
}

function renderHtmlReport(reports: SchemeReport[]): string {
  const sections = reports.map(renderSchemeSection).join("\n");
  const generatedAt = new Date().toISOString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Contrast audit preview</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #fff; color: #111; }
  h1 { margin-top: 0; }
  .meta { color: #555; margin-bottom: 2rem; }
  .scheme { border: 1px solid #ccc; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; }
  .scheme h2 { margin-top: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .scheme h2 small { font-weight: normal; opacity: 0.7; font-size: 0.8rem; }
  .sample { padding: 0.4rem 0; margin: 0.25rem 0; }
  .admonition { border-left: 4px solid; padding: 0.6rem 0.9rem; margin: 0.4rem 0; border-radius: 0 6px 6px 0; }
  code { padding: 0.1rem 0.35rem; border-radius: 4px; }
  mark { padding: 0.05rem 0.3rem; border-radius: 3px; }
  .chat-bubble { display: inline-block; padding: 0.4rem 0.8rem; border-radius: 0.9rem; margin-right: 0.35rem; }
  .badge { font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.35rem; white-space: nowrap; }
  .badge.pass { background: #1a7f37; color: #fff; }
  .badge.fail { background: #b3261e; color: #fff; }
</style>
</head>
<body>
<h1>Contrast audit preview</h1>
<p class="meta">Generated ${escapeHtml(generatedAt)} — ${reports.length} schemes, ${PAIR_MATRIX.length} pairs each. Colors derived via <code>schemeToCssPairs</code> / <code>resolveSemanticColors</code>; admonition backgrounds use <code>color-mix(in srgb, X 12%, bg)</code> matching <code>content.css</code>.</p>
${sections}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseCliArgs(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      html: { type: "boolean", default: false },
      suggest: { type: "boolean", default: false },
      "out-dir": { type: "string", default: "contrast-audit-out" },
      headroom: { type: "string", default: String(HEADROOM) },
    },
  });
  return {
    html: Boolean(values.html),
    suggest: Boolean(values.suggest),
    outDir: String(values["out-dir"] ?? "contrast-audit-out"),
    headroom: Number(values.headroom ?? HEADROOM),
  };
}

/** True when at least one pair in `report` hasn't reached `threshold + headroom`
 *  yet — a superset of `!report.allPass` (also flags passing-but-marginal pairs;
 *  see scheme-a11y skill §2.1, epic #2489 S8). */
function needsHeadroomWork(report: SchemeReport, headroom: number): boolean {
  const EPS = 1e-9;
  return report.pairs.some((p) => p.ratio < p.threshold + headroom - EPS);
}

async function main(): Promise<void> {
  const { html, suggest, outDir, headroom } = parseCliArgs(process.argv.slice(2));

  const presets = getAllPresets();
  const reports = presets.map(({ name, scheme, source }) => evaluateScheme(name, scheme, source));

  for (const report of reports) {
    printSchemeTable(report);
  }

  const schemesWithFailures = reports.filter((r) => !r.allPass);
  const totalPairs = reports.reduce((sum, r) => sum + r.pairs.length, 0);
  const totalFails = reports.reduce((sum, r) => sum + r.failCount, 0);
  console.log(pc.bold(`${reports.length} schemes evaluated, ${totalPairs} pair checks total.`));
  if (schemesWithFailures.length > 0) {
    console.log(pc.yellow(`${schemesWithFailures.length} scheme(s) have at least one failing pair (${totalFails} failing pair checks total).`));
  } else {
    console.log(pc.green("All schemes pass every pair in the matrix."));
  }

  const schemesNeedingWork = reports.filter((r) => needsHeadroomWork(r, headroom));
  const suggestionFragments: Record<string, string> = {};
  if (suggest && schemesNeedingWork.length > 0) {
    console.log(pc.bold(`\n=== Suggested fixes (--suggest, headroom +${headroom}) ===\n`));
    const presetByName = new Map(presets.map((p) => [p.name, p.scheme]));
    for (const report of schemesNeedingWork) {
      const scheme = presetByName.get(report.name);
      if (!scheme) continue;
      const fragment = buildSuggestionFragment(report.name, scheme, report, headroom);
      suggestionFragments[report.name] = fragment;
      console.log(fragment);
      console.log("");
    }
  }

  const outDirAbs = resolve(process.cwd(), outDir);
  await mkdir(outDirAbs, { recursive: true });

  const jsonReport = {
    generatedAt: new Date().toISOString(),
    pairMatrix: PAIR_MATRIX.map(({ key, label, tier, threshold }) => ({ key, label, tier, threshold })),
    schemes: reports,
    ...(suggest ? { suggestions: suggestionFragments } : {}),
  };
  const jsonPath = resolve(outDirAbs, "report.json");
  await writeFile(jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`, "utf-8");
  console.log(pc.dim(`JSON report written to ${jsonPath}`));

  if (html) {
    const htmlPath = resolve(outDirAbs, "preview.html");
    await writeFile(htmlPath, renderHtmlReport(reports), "utf-8");
    console.log(pc.dim(`HTML preview written to ${htmlPath}`));
  }

  if (schemesWithFailures.length > 0) {
    process.exitCode = 1;
  }
}

await main();
