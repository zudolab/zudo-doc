#!/usr/bin/env node
// Build the site-independent browser stylesheet with zfb's own embedded
// Tailwind engine. The disposable project deliberately has no ambient content:
// its two explicit @source trees are the complete scanning contract.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = resolve(SCRIPT_DIR, "..");
const CSS_INPUTS = [
  "theme.css",
  "safelist.css",
  "content.css",
  "page-loading.css",
  "features.css",
];
const CANONICAL_ENTRY = `@layer zd-preflight, zd-flow;
@import "tailwindcss/preflight" layer(zd-preflight);
@import "tailwindcss/utilities";

@import "@takazudo/zudo-doc/theme.css";
@import "@takazudo/zudo-doc/safelist.css";
@import "@takazudo/zudo-doc/content.css";
@import "@takazudo/zudo-doc/page-loading.css";
@import "@takazudo/zudo-doc/features.css";

@source "./package-src/**/*.{tsx,ts,jsx,js}";
@source "./node_modules/@takazudo/zudo-doc/dist/**/*.{tsx,ts,jsx,js}";
@source not "./node_modules/@takazudo/zudo-doc/dist/catalog.js";
`;

const require = createRequire(import.meta.url);
const ZFB_PACKAGE_JSON = require.resolve("@takazudo/zfb/package.json");
const ZFB_PACKAGE_ROOT = dirname(ZFB_PACKAGE_JSON);
const ZFB_BIN = resolve(ZFB_PACKAGE_ROOT, require(ZFB_PACKAGE_JSON).bin.zfb);

function linkPackage(scratchRoot, packageName, packageRoot) {
  const target = resolve(scratchRoot, "node_modules", packageName);
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(packageRoot, target, "dir");
}

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
  for (const leakedPath of [tempRoot, packageRoot, DEFAULT_PACKAGE_ROOT]) {
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

function copySourceTree(sourceRoot, targetRoot) {
  cpSync(sourceRoot, targetRoot, {
    recursive: true,
    filter(source) {
      if (statSync(source).isDirectory()) return true;
      return /\.(?:tsx?|jsx?)$/.test(source);
    },
  });
}

function copyConsumerDist(distRoot, targetRoot) {
  cpSync(distRoot, targetRoot, {
    recursive: true,
    filter(source) {
      if (statSync(source).isDirectory()) return true;
      const rel = relative(distRoot, source).split("\\").join("/");
      return rel !== "catalog.js" && /\.js$/.test(rel);
    },
  });
}

export function generateCompiledCss(
  outputPath = resolve(DEFAULT_PACKAGE_ROOT, "dist/compiled.css"),
  { packageRoot = DEFAULT_PACKAGE_ROOT } = {},
) {
  const scratchRoot = mkdtempSync(resolve(tmpdir(), "zudo-doc-compiled-css-"));
  try {
    const packageDist = resolve(
      scratchRoot,
      "node_modules/@takazudo/zudo-doc/dist",
    );
    mkdirSync(packageDist, { recursive: true });
    for (const filename of CSS_INPUTS) {
      cpSync(
        resolve(packageRoot, "dist", filename),
        resolve(packageDist, filename),
      );
    }
    copyConsumerDist(resolve(packageRoot, "dist"), packageDist);
    copySourceTree(
      resolve(packageRoot, "src"),
      resolve(scratchRoot, "package-src"),
    );

    writeFileSync(
      resolve(scratchRoot, "node_modules/@takazudo/zudo-doc/package.json"),
      `${JSON.stringify({
        name: "@takazudo/zudo-doc",
        type: "module",
        exports: Object.fromEntries(
          CSS_INPUTS.map((filename) => [`./${filename}`, `./dist/${filename}`]),
        ),
      }, null, 2)}\n`,
    );
    // The native build still bundles a neutral page and therefore resolves its
    // framework/runtime imports. Link the package's already-installed exact
    // runtime graph; these files are build tooling, never content sources.
    const zfbRuntimeRoot = resolve(
      dirname(require.resolve("@takazudo/zfb-runtime/server")),
      "..",
    );
    linkPackage(scratchRoot, "@takazudo/zfb-runtime", zfbRuntimeRoot);
    linkPackage(scratchRoot, "@takazudo/zfb", ZFB_PACKAGE_ROOT);
    linkPackage(scratchRoot, "hono", resolve(zfbRuntimeRoot, "../../hono"));
    linkPackage(scratchRoot, "react", resolve(zfbRuntimeRoot, "../../react"));
    linkPackage(
      scratchRoot,
      "preact-render-to-string",
      dirname(require.resolve("preact-render-to-string/package.json")),
    );
    linkPackage(
      scratchRoot,
      "preact",
      dirname(require.resolve("preact/package.json")),
    );
    mkdirSync(resolve(scratchRoot, "pages"));
    mkdirSync(resolve(scratchRoot, "src/styles"), { recursive: true });
    writeFileSync(
      resolve(scratchRoot, "pages/index.tsx"),
      "export default function IndexPage() { return null; }\n",
    );
    writeFileSync(
      resolve(scratchRoot, "package.json"),
      '{"name":"zudo-doc-compiled-css-scratch","private":true,"type":"module"}\n',
    );
    writeFileSync(
      resolve(scratchRoot, "zfb.config.ts"),
      'export default { framework: "preact", tailwind: { enabled: true }, codeHighlight: { mode: "class" } };\n',
    );
    writeFileSync(resolve(scratchRoot, "src/styles/global.css"), CANONICAL_ENTRY);

    const outDir = resolve(scratchRoot, "out");
    const result = spawnSync(
      process.execPath,
      [ZFB_BIN, "build", "--outdir", outDir],
      { cwd: scratchRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`zfb build failed with status ${result.status}`);
    }

    const assetsDir = resolve(outDir, "assets");
    const matches = readdirSync(assetsDir).filter((name) =>
      /^styles-[0-9a-f]{8}\.css$/.test(name),
    );
    if (matches.length !== 1) {
      throw new Error(
        `expected exactly one assets/styles-*.css, found ${matches.length}`,
      );
    }
    const css = readFileSync(resolve(assetsDir, matches[0]), "utf8");
    const bytes = assertCompiledCss(css, {
      packageRoot,
      tempRoot: scratchRoot,
    });

    mkdirSync(dirname(outputPath), { recursive: true });
    const atomicPath = resolve(
      dirname(outputPath),
      `.${relative(dirname(outputPath), outputPath)}.${process.pid}.tmp`,
    );
    writeFileSync(atomicPath, css, "utf8");
    renameSync(atomicPath, outputPath);
    return { bytes, outputPath };
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
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
