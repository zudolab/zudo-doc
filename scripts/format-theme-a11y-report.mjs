#!/usr/bin/env node
// format-theme-a11y-report.mjs — Renders a theme-a11y-audit `report.json`
// (scripts/theme-a11y-audit.ts) as a markdown body section.
//
// scripts/file-exam-issue.sh's existing JSON parsing targets Playwright's
// report shape ({ suites: [ { suites: [ { specs: [ { ok, title } ] } ] } ] }),
// which is structurally unrelated to the audit's own report.json (top-level
// results/coverage/counts/stateErrors/stylesheetErrors) — passing the audit's
// report through the Playwright parser silently finds nothing, so a filed
// exam-failure issue carried only the run URL (zudolab/zudo-doc#4037).
//
// Usage: node scripts/format-theme-a11y-report.mjs <path-to-report.json>
// Prints a markdown section to stdout and exits 0 when the file is
// recognized as a theme-a11y-audit report. Exits 1 (no stdout) when the file
// parses but isn't that shape, so the caller can fall back to its own
// parsing. Exits 2 on a missing/unreadable/unparsable file.

import { readFileSync } from "node:fs";

const MAX_ROWS = 100;

function isAuditReport(report) {
  return (
    report !== null &&
    typeof report === "object" &&
    Array.isArray(report.results) &&
    report.counts !== null &&
    typeof report.counts === "object" &&
    ("FAIL" in report.counts || "PASS" in report.counts)
  );
}

/**
 * Per-result page, with a fallback for the pre-#4033 single-page report
 * shape, where `page` lives once at the top level (a string) rather than on
 * every result.
 */
function resultPage(report, result) {
  if (typeof result.page === "string") return result.page;
  if (typeof report.page === "string") return report.page;
  if (Array.isArray(report.pages)) return report.pages.join(", ");
  return "(unspecified page)";
}

function formatNumber(value, digits) {
  return typeof value === "number" ? value.toFixed(digits) : String(value);
}

function renderTruncated(lines, items, render, label) {
  const shown = items.slice(0, MAX_ROWS);
  for (const item of shown) lines.push(render(item));
  if (items.length > shown.length) {
    lines.push(`- _...and ${items.length - shown.length} more ${label} — see the run's uploaded report artifact._`);
  }
}

export function formatAuditReportBody(report) {
  const fails = report.results.filter((r) => r.verdict === "FAIL");
  const coverageErrors = (report.coverage ?? []).flatMap((c) => c.errors ?? []);
  const stateErrors = report.stateErrors ?? [];
  const stylesheetErrors = report.stylesheetErrors ?? [];

  const counts = report.counts ?? {};
  const lines = [];
  lines.push("### Theme A11y Audit report", "");
  lines.push(
    `**${counts.FAIL ?? 0} FAIL** / ${counts.PASS ?? 0} pass / ${counts.WARN ?? 0} warn` +
      (counts.ALLOW !== undefined ? ` / ${counts.ALLOW} allow` : "") +
      (counts.SKIP !== undefined ? ` / ${counts.SKIP} skip` : ""),
    "",
  );

  if (fails.length > 0) {
    lines.push(`#### Contrast FAILs (${fails.length})`, "");
    renderTruncated(
      lines,
      fails,
      (f) =>
        `- **${f.pack}/${f.mode}** \`${resultPage(report, f)}\` — \`${f.elementKey}\` (${f.state}): ` +
        `${formatNumber(f.ratio, 2)}:1 < ${formatNumber(f.threshold, 1)}:1 — \`${f.fg}\` on \`${f.bg}\`` +
        (f.text ? ` — "${f.text}"` : ""),
      "FAIL(s)",
    );
    lines.push("");
  }

  if (coverageErrors.length > 0) {
    lines.push(`#### Coverage errors (${coverageErrors.length})`, "");
    renderTruncated(lines, coverageErrors, (e) => `- ${e}`, "error(s)");
    lines.push("");
  }

  if (stateErrors.length > 0) {
    lines.push(`#### Per-state render errors (${stateErrors.length})`, "");
    renderTruncated(
      lines,
      stateErrors,
      (e) => `- **${e.pack}/${e.mode}** \`${e.page}\` — ${e.message}`,
      "error(s)",
    );
    lines.push("");
  }

  if (stylesheetErrors.length > 0) {
    lines.push(`#### Pack-stylesheet load errors (${stylesheetErrors.length})`, "");
    renderTruncated(
      lines,
      stylesheetErrors,
      (e) => `- **${e.pack}/${e.mode}** \`${e.page}\` — ${e.message}`,
      "error(s)",
    );
    lines.push("");
  }

  if (fails.length === 0 && coverageErrors.length === 0 && stateErrors.length === 0 && stylesheetErrors.length === 0) {
    lines.push("_Report parsed but no FAIL/coverage/state/stylesheet errors were found — check the run URL._", "");
  }

  return lines.join("\n");
}

function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error("Usage: node scripts/format-theme-a11y-report.mjs <report.json>");
    process.exitCode = 2;
    return;
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    console.error(`Could not read/parse ${reportPath}: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (!isAuditReport(report)) {
    // Not a theme-a11y-audit report.json (e.g. a Playwright JSON report) —
    // exit non-zero, no stdout, so the caller falls back to its own parsing.
    process.exitCode = 1;
    return;
  }

  process.stdout.write(formatAuditReportBody(report));
}

// Only run as a CLI when invoked directly — importable for tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
