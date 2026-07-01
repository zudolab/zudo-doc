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
 *
 * Output goes to a gitignored directory — not committed. See S2/S3
 * (zudolab/zudo-doc#2489) for matrix refinements: PAIR_MATRIX below is the
 * single place pairs/thresholds live.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import pc from "picocolors";

import { colorSchemes } from "../src/config/color-schemes";
import { colorTweakPresets } from "../src/config/color-tweak-presets";
import { schemeToCssPairs } from "../src/config/color-scheme-utils";
import type { ColorScheme } from "../src/config/color-schemes";
import { contrastRatio, colorMixSrgb, ADMONITION_TINT_PCT } from "../src/config/contrast-utils";

// ---------------------------------------------------------------------------
// Pair matrix — data-driven so S2/S3 can adjust pairs/thresholds without
// touching the evaluation or report logic below.
//
// `fgVar`/`bgVar` are `--zd-*` custom-property names exactly as emitted by
// `schemeToCssPairs` (production's own CSS injection). `tintBg: true` means
// "replace the raw bgVar value with color-mix(fgVar TINT_PCT%, bgVar)" —
// the admonition-title-on-tinted-background construction.
// ---------------------------------------------------------------------------

interface PairSpec {
  key: string;
  label: string;
  tier: 1 | 2;
  threshold: number;
  fgVar: string;
  bgVar: string;
  tintBg?: true;
}

export const PAIR_MATRIX: PairSpec[] = [
  // ── Tier 1 — text, AA ≥ 4.5:1 ──
  { key: "fg-vs-bg", label: "fg / bg", tier: 1, threshold: 4.5, fgVar: "--zd-fg", bgVar: "--zd-bg" },
  { key: "fg-vs-surface", label: "fg / surface", tier: 1, threshold: 4.5, fgVar: "--zd-fg", bgVar: "--zd-surface" },
  { key: "muted-vs-bg", label: "muted / bg", tier: 1, threshold: 4.5, fgVar: "--zd-muted", bgVar: "--zd-bg" },
  { key: "accent-vs-bg", label: "accent / bg", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-bg" },
  { key: "accent-hover-vs-bg", label: "accentHover / bg", tier: 1, threshold: 4.5, fgVar: "--zd-accent-hover", bgVar: "--zd-bg" },
  { key: "code-fg-vs-code-bg", label: "codeFg / codeBg", tier: 1, threshold: 4.5, fgVar: "--zd-code-fg", bgVar: "--zd-code-bg" },
  { key: "admonition-accent", label: "admonition title (note/accent, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-success", label: "admonition title (tip/success, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-success", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-warning", label: "admonition title (warning, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-warning", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-info", label: "admonition title (info, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-info", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-danger", label: "admonition title (danger, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-danger", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-important", label: "admonition title (important, raw p5, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-5", bgVar: "--zd-bg", tintBg: true },
  { key: "selection", label: "selectionFg / selectionBg", tier: 1, threshold: 4.5, fgVar: "--zd-sel-fg", bgVar: "--zd-sel-bg" },
  { key: "matched-keyword", label: "matchedKeywordFg / matchedKeywordBg", tier: 1, threshold: 4.5, fgVar: "--zd-matched-keyword-fg", bgVar: "--zd-matched-keyword-bg" },
  { key: "chat-user", label: "chatUserText / chatUserBg", tier: 1, threshold: 4.5, fgVar: "--zd-chat-user-text", bgVar: "--zd-chat-user-bg" },
  { key: "chat-assistant", label: "chatAssistantText / chatAssistantBg", tier: 1, threshold: 4.5, fgVar: "--zd-chat-assistant-text", bgVar: "--zd-chat-assistant-bg" },

  // ── Tier 2 — graphics/icons, ≥ 3.0:1 unless noted ──
  { key: "mermaid-text-vs-node-bg", label: "mermaidText / mermaidNodeBg", tier: 2, threshold: 4.5, fgVar: "--zd-mermaid-text", bgVar: "--zd-mermaid-node-bg" },
  { key: "mermaid-text-vs-label-bg", label: "mermaidText / mermaidLabelBg", tier: 2, threshold: 4.5, fgVar: "--zd-mermaid-text", bgVar: "--zd-mermaid-label-bg" },
  { key: "mermaid-line-vs-bg", label: "mermaidLine / bg", tier: 2, threshold: 3.0, fgVar: "--zd-mermaid-line", bgVar: "--zd-bg" },
  { key: "image-overlay", label: "imageOverlayFg / imageOverlayBg", tier: 2, threshold: 3.0, fgVar: "--zd-image-overlay-fg", bgVar: "--zd-image-overlay-bg" },
];

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

type PresetSource = "colorSchemes" | "colorTweakPresets";

interface PairResult {
  key: string;
  label: string;
  tier: 1 | 2;
  threshold: number;
  fg: string;
  bg: string;
  ratio: number;
  pass: boolean;
}

interface SchemeReport {
  name: string;
  source: PresetSource;
  pairs: PairResult[];
  passCount: number;
  failCount: number;
  allPass: boolean;
}

function getAllPresets(): Array<{ name: string; scheme: ColorScheme; source: PresetSource }> {
  return [
    ...Object.entries(colorSchemes).map(([name, scheme]) => ({ name, scheme, source: "colorSchemes" as const })),
    ...Object.entries(colorTweakPresets).map(([name, scheme]) => ({ name, scheme, source: "colorTweakPresets" as const })),
  ];
}

function evaluateScheme(name: string, scheme: ColorScheme, source: PresetSource): SchemeReport {
  const varMap = new Map(schemeToCssPairs(scheme));

  const pairs: PairResult[] = PAIR_MATRIX.map((spec) => {
    const fg = varMap.get(spec.fgVar);
    const rawBg = varMap.get(spec.bgVar);
    if (fg === undefined || rawBg === undefined) {
      throw new Error(
        `Scheme "${name}": pair "${spec.key}" references an unknown CSS var (fgVar=${spec.fgVar}, bgVar=${spec.bgVar})`,
      );
    }
    const bg = spec.tintBg ? colorMixSrgb(fg, rawBg, ADMONITION_TINT_PCT) : rawBg;
    const ratio = contrastRatio(fg, bg);
    return {
      key: spec.key,
      label: spec.label,
      tier: spec.tier,
      threshold: spec.threshold,
      fg,
      bg,
      ratio,
      pass: ratio >= spec.threshold,
    };
  });

  const passCount = pairs.filter((p) => p.pass).length;
  return {
    name,
    source,
    pairs,
    passCount,
    failCount: pairs.length - passCount,
    allPass: passCount === pairs.length,
  };
}

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
      "out-dir": { type: "string", default: "contrast-audit-out" },
    },
  });
  return {
    html: Boolean(values.html),
    outDir: String(values["out-dir"] ?? "contrast-audit-out"),
  };
}

async function main(): Promise<void> {
  const { html, outDir } = parseCliArgs(process.argv.slice(2));

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

  const outDirAbs = resolve(process.cwd(), outDir);
  await mkdir(outDirAbs, { recursive: true });

  const jsonReport = {
    generatedAt: new Date().toISOString(),
    pairMatrix: PAIR_MATRIX.map(({ key, label, tier, threshold }) => ({ key, label, tier, threshold })),
    schemes: reports,
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
