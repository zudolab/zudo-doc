#!/usr/bin/env node
// scripts/gen-tauri-icon.mjs — rasterize the AutoLogo square icon SVG into
// src-tauri/icons/icon.png (epic #3285, sub #3287).
//
// tauri::generate_context!() panics unless src-tauri/icons/icon.png exists
// and is a fully-opaque RGBA PNG (#3264) — even with bundle.icon: [] and
// bundle.active: false. The repo has no sharp/resvg (native rasterizers are
// deliberately not added as deps — see #3287), so this uses the
// already-installed @playwright/test Chromium: load the SVG in a page,
// screenshot the SVG element at a fixed pixel size, and hard-assert the
// output is RGBA + fully opaque before writing anything to disk.
//
// Seed is hardcoded to "zudo-doc" (this repo's settings.siteName,
// src/config/settings.ts) rather than read from zfb.config.ts: a plain node
// script can't import the project's TS config, and the eject CLI's
// config-source parser returns unresolvable on this repo's spread-based
// zfb.config.ts (`zudoDoc({ ...settings, ... })`).
//
// Regenerate with: pnpm build:workspace && node scripts/gen-tauri-icon.mjs
// (build:workspace first — the ensure-build guard checks dist/ existence,
// not freshness, so a stale dist/auto-logo would bake wrong bytes in).

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Deep-import the compiled dist module directly, same pattern
// packages/zudo-doc/bin/zudo-doc.mjs uses for dist/eject-logo/index.js —
// icon.ts's import graph is shapes.js/shapes-square.js/render-shape.js only
// (no node builtins, no preact), so it loads fine under plain node.
import { renderAutoLogoIconSvg } from "../packages/zudo-doc/dist/auto-logo/icon.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_PATH = resolve(ROOT, "src-tauri/icons/icon.png");

// This repo's site name (src/config/settings.ts's siteName) — the same seed
// `zudo-doc eject logo` would default to for this project.
const SEED = "zudo-doc";

const SIZE = 1024;

function buildHtml(svgMarkup) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  svg { display: block; width: ${SIZE}px; height: ${SIZE}px; }
</style>
</head>
<body>${svgMarkup}</body>
</html>`;
}

/** Read a PNG buffer's IHDR color-type byte (offset 25). Tauri's icon
 *  decoder panics on anything but 6 (RGBA, i.e. PNG_COLOR_TYPE_RGB_ALPHA). */
function pngColorType(buffer) {
  return buffer[25];
}

async function main() {
  await mkdir(dirname(OUT_PATH), { recursive: true });

  const svgMarkup = renderAutoLogoIconSvg(SEED);
  const html = buildHtml(svgMarkup);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: SIZE, height: SIZE },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.setContent(html);

    const svgHandle = await page.$("svg");
    if (!svgHandle) {
      throw new Error("gen-tauri-icon: <svg> did not render in the page");
    }

    // Rasterize via <canvas>, not page.screenshot()/elementHandle.screenshot():
    // Chromium's screenshot PNG encoder optimizes fully-opaque content down to
    // color type 2 (RGB, no alpha channel) even though the SVG paints a solid
    // opaque plate — verified empirically, this is exactly the failure hard
    // assertion (a) below exists to catch. canvas.toDataURL("image/png")
    // always emits color type 6 (RGBA) in Chromium regardless of content
    // opacity, so serialize the live <svg> DOM node (the one page.setContent
    // just rendered at SIZE×SIZE with zero body margin) and draw it onto a
    // same-size canvas instead.
    const result = await page.evaluate(async (size) => {
      const svgEl = document.querySelector("svg");
      const svgXml = new XMLSerializer().serializeToString(svgEl);
      const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgXml)))}`;

      const img = new Image();
      const loaded = new Promise((res, rej) => {
        img.onload = () => res(undefined);
        img.onerror = () => rej(new Error("gen-tauri-icon: SVG image failed to load"));
      });
      img.src = svgDataUrl;
      await loaded;

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("gen-tauri-icon: 2d canvas context unavailable");
      // The SVG's plate paints its own opaque background across the full
      // viewBox, so the canvas's own default fill state never shows through
      // — drawing at 0,0 sized to the canvas cannot leave transparent edges.
      ctx.drawImage(img, 0, 0, size, size);

      // Hard assertion 2 (computed here, checked in Node below): full
      // opacity. RGBA color type alone doesn't prove every pixel's alpha
      // channel is actually 255 — read every pixel back off the canvas.
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonOpaquePixels = 0;
      let firstBadIndex = -1;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 255) {
          nonOpaquePixels++;
          if (firstBadIndex === -1) firstBadIndex = (i - 3) / 4;
        }
      }

      const pngBase64 = canvas.toDataURL("image/png").split(",")[1];
      return { pngBase64, width, height, nonOpaquePixels, firstBadIndex };
    }, SIZE);

    const pngBuffer = Buffer.from(result.pngBase64, "base64");

    // Hard assertion 1: PNG color type must be RGBA (6). Tauri's icon
    // decoder PANICS on RGB/grayscale/indexed.
    const colorType = pngColorType(pngBuffer);
    if (colorType !== 6) {
      throw new Error(
        `gen-tauri-icon: expected PNG color type 6 (RGBA), got ${colorType}. ` +
          `Tauri's icon decoder panics on non-RGBA PNGs — refusing to write ${OUT_PATH}.`,
      );
    }

    if (result.nonOpaquePixels > 0) {
      throw new Error(
        `gen-tauri-icon: ${result.nonOpaquePixels} of ${result.width * result.height} pixels ` +
          `are not fully opaque (first bad pixel index ${result.firstBadIndex}). ` +
          `Refusing to write ${OUT_PATH}.`,
      );
    }

    await writeFile(OUT_PATH, pngBuffer);
    console.log(
      `gen-tauri-icon: wrote ${OUT_PATH} (${result.width}x${result.height}, RGBA, fully opaque, seed "${SEED}")`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
