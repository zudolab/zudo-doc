#!/usr/bin/env node
// Build the package's browser stylesheet with zfb's standalone CSS command.
// Keep the source set explicit: package CSS must not inherit a host project's
// pages/content tree or zfb's default auto-source roots.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = resolve(SCRIPT_DIR, "..");
const REPOSITORY_ROOT = resolve(DEFAULT_PACKAGE_ROOT, "../..");
const ENTRY_RELATIVE_PATH = "src/compiled.entry.css";

const require = createRequire(import.meta.url);
const ZFB_PACKAGE_JSON = require.resolve("@takazudo/zfb/package.json");
const ZFB_PACKAGE_ROOT = dirname(ZFB_PACKAGE_JSON);
const ZFB_BIN = resolve(ZFB_PACKAGE_ROOT, require(ZFB_PACKAGE_JSON).bin.zfb);

function assertRule(css, selector, declarations) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectorNormalizedCss = css.replace(/\s*([>+])\s*/g, "$1");
  const rule = selectorNormalizedCss.match(
    new RegExp(`${escaped}\\s*\\{([^}]*)\\}`),
  );
  if (!rule) throw new Error(`compiled CSS is missing selector: ${selector}`);
  for (const declaration of declarations) {
    if (!declaration.test(rule[1])) {
      throw new Error(
        `compiled CSS rule ${selector} is missing declaration ${declaration}`,
      );
    }
  }
}

export function assertCompiledCss(css, { packageRoot, tempRoot } = {}) {
  const bytes = Buffer.byteLength(css);
  if (bytes < 75_000) {
    throw new Error(`compiled CSS is unexpectedly small: ${bytes} bytes`);
  }
  for (const directive of ["@tailwind", "@apply", "@source", "@import"]) {
    if (css.includes(directive)) {
      throw new Error(`compiled CSS contains unresolved ${directive}`);
    }
  }
  if (!css.includes("tailwindcss v4.2.0")) {
    throw new Error("compiled CSS does not carry the Tailwind CSS v4.2.0 banner");
  }
  if (/sourceMappingURL/i.test(css)) {
    throw new Error("compiled CSS contains a source map comment");
  }
  if (/\r\n?/.test(css)) throw new Error("compiled CSS contains CRLF bytes");
  if (/\b(?:19|20)\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(css)) {
    throw new Error("compiled CSS contains a timestamp");
  }
  for (const leakedPath of [
    tempRoot,
    packageRoot,
    DEFAULT_PACKAGE_ROOT,
    REPOSITORY_ROOT,
  ]) {
    if (leakedPath && css.includes(leakedPath)) {
      throw new Error(`compiled CSS contains an absolute path: ${leakedPath}`);
    }
  }

  assertRule(css, ".flex", [/display:\s*flex/]);
  assertRule(css, ".bg-surface", [
    /background-color:\s*var\(--color-surface\)/,
  ]);
  assertRule(css, ".text-fg", [/color:\s*var\(--color-fg\)/]);
  assertRule(css, "header[data-header]", [
    /background-color:\s*var\(--color-surface\s*,\s*var\(--color-bg\)\)/,
    /z-index:\s*var\(--z-index-toolbar\s*,\s*20\)/,
  ]);
  assertRule(css, ".page-loading-overlay", [/position:\s*fixed/, /inset:\s*0/]);
  assertRule(css, ".admonition-body>:where(*+*)", [
    /margin-top:\s*var\(--spacing-vsp-sm\)/,
  ]);
  assertRule(css, ".admonition-body>:first-child", [/margin-top:\s*0/]);
  assertRule(css, "[data-admonition]", [
    /border-left:\s*4px solid var\(--color-muted\)/,
    /background(?:-color)?:\s*color-mix\(/,
  ]);
  assertRule(css, ".admonition-title::before", [
    /margin-right:\s*var\(--spacing-hsp-2xs\)/,
  ]);
  if (!/--zfb-hi-[\w-]+\s*:/.test(css)) {
    throw new Error("compiled CSS is missing zfb highlight custom properties");
  }
  assertRule(css, ".hi-root", [
    /color:\s*var\(--zfb-hi-fg\)/,
    /background(?:-color)?:\s*var\(--zfb-hi-bg\)/,
  ]);
  return bytes;
}

export function generateCompiledCss(
  outputPath = resolve(DEFAULT_PACKAGE_ROOT, "dist/compiled.css"),
  { packageRoot = DEFAULT_PACKAGE_ROOT } = {},
) {
  const resolvedPackageRoot = resolve(packageRoot);
  const resolvedOutputPath = resolve(outputPath);
  const inputPath = resolve(resolvedPackageRoot, ENTRY_RELATIVE_PATH);
  const packageRootArg = relative(REPOSITORY_ROOT, resolvedPackageRoot);
  const inputArg = relative(REPOSITORY_ROOT, inputPath);
  const outputArg = relative(REPOSITORY_ROOT, resolvedOutputPath);

  // This package intentionally has no zfb site config. The CLI override keeps
  // the package's class-mode semantic highlighting contract while allowing a
  // supplied packageRoot's config to provide any other highlight settings.
  const result = spawnSync(
    process.execPath,
    [
      ZFB_BIN,
      "css",
      "--input",
      inputArg,
      "--output",
      outputArg,
      "--project-root",
      packageRootArg,
      "--source",
      "src/**/*.{tsx,ts,jsx,js}",
      "--source",
      "dist/**/*.{tsx,ts,jsx,js}",
      "--no-auto-source",
      "--code-highlight-mode",
      "class",
    ],
    {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`zfb css failed with status ${result.status}`);
  }

  const css = readFileSync(resolvedOutputPath, "utf8");
  const bytes = assertCompiledCss(css, { packageRoot: resolvedPackageRoot });
  return { bytes, outputPath: resolvedOutputPath };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const result = generateCompiledCss(
    process.argv[2] ? resolve(process.argv[2]) : undefined,
  );
  process.stdout.write(
    `[gen-compiled-css] wrote ${result.bytes} bytes → ${result.outputPath}\n`,
  );
}
