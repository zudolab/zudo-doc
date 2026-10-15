/** #4585/#4589: full native layouts, not another isolated stylesheet fixture. */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { scaffold } from "../packages/create-zudo-doc/src/scaffold.js";
import { test, expect } from "./fixtures";
import { THEME_STORAGE_KEY } from "./theme-helpers";

// Like smoke-manual-fragment-history: one immutable pack/install per worker,
// isolated from shared dist, using the existing whole-output mount contract.
test.describe.configure({ mode: "default", retries: 0 });
const root = path.resolve(import.meta.dirname, "..");
const widths = [195, 320, 390, 640, 1280];
const bases = ["/", "/manual"] as const;
const token = "ordinarycontentmustremainreadable".repeat(5);
const linkText = "placement/capture/reference/".repeat(8);
const codeText = `const example = "${"locally-scrollable-code-".repeat(12)}";`;
const origins = new Map<string, string>();
const servers: ChildProcess[] = [];
let scratch = "";
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NODE_PATH: "", INIT_CWD: cwd, SKIP_DOC_HISTORY: "1" },
  });
}

async function serve(output: string): Promise<string> {
  const probe = createServer();
  const port = await new Promise<number>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") return reject(new Error("missing server port"));
      probe.close(() => resolve(address.port));
    });
  });
  const server = spawn(process.execPath, [
    path.join(root, "scripts/zfb3-parity/installed-consumer/static-mount-server.mjs"), output, String(port),
  ], { stdio: ["ignore", "pipe", "pipe"] });
  servers.push(server);
  let stderr = "";
  server.stderr!.on("data", (chunk) => { stderr += String(chunk); });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error(`mount server readiness deadline: ${stderr}`)), 10_000);
    const onExit = (code: number | null) => finish(new Error(`mount server exited ${code}: ${stderr}`));
    const onReady = () => finish();
    function finish(error?: Error) {
      clearTimeout(timeout);
      server.off("error", finish);
      server.off("exit", onExit);
      server.stdout!.off("data", onReady);
      if (error) reject(error); else resolve();
    }
    server.once("error", finish);
    server.once("exit", onExit);
    server.stdout!.once("data", onReady);
  });
  server.stdout!.resume();
  return `http://127.0.0.1:${port}`;
}

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(240_000);
  scratch = mkdtempSync(path.join(tmpdir(), "zudo-reflow-consumer-"));
  const source = path.join(root, "packages/zudo-doc");
  const snapshot = path.join(scratch, "package");
  mkdirSync(snapshot);
  const packageManifest = JSON.parse(readFileSync(path.join(source, "package.json"), "utf8"));
  for (const file of packageManifest.files as string[]) {
    // Public files must exist; a missing built export must fail, not be omitted.
    cpSync(path.join(source, file), path.join(snapshot, file), { recursive: true });
  }
  delete packageManifest.scripts;
  writeFileSync(path.join(snapshot, "package.json"), JSON.stringify(packageManifest));
  const packed = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts"], snapshot)) as { filename: string }[]; // dist-mutation-ok: only an owned immutable snapshot with all lifecycle scripts removed.
  expect(packed).toHaveLength(1);
  const tarball = path.join(snapshot, packed[0]!.filename);
  const consumer = path.join(scratch, "consumer");
  await scaffold({
    projectName: "zudo-diagram-gen", destination: consumer, defaultLang: "en",
    colorSchemeMode: "light-dark", lightScheme: "Default Light", darkScheme: "Default Dark",
    features: ["i18n"], packageManager: "pnpm",
  });
  // Only replace the generated package dependency with the exact candidate.
  // Keep the generator's native homepage, routes, chrome and CSS untouched.
  const manifestPath = path.join(consumer, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.dependencies["@takazudo/zudo-doc"] = `file:${tarball}`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const globalCssPath = path.join(consumer, "src/styles/global.css");
  const globalCssHash = hash(globalCssPath);
  expect(readFileSync(globalCssPath, "utf8")).not.toMatch(/\.zd-content\s*\{/);
  expect(readFileSync(path.join(consumer, "pages/index.tsx"), "utf8")).toContain("@takazudo/zudo-doc/routes/index");
  for (const locale of ["en", "ja"]) {
    const directory = path.join(consumer, "src/content", locale === "en" ? "docs" : "docs-ja", "getting-started");
    // Require the real i18n scaffold to have created this directory.
    expect(existsSync(directory)).toBe(true);
    writeFileSync(path.join(directory, "reflow.mdx"), `---
title: ${locale === "en" ? "Reflow/placement/capture/reference" : "日本語の折り返しと表示確認"}
sidebar_position: 3
---

${locale === "en" ? "Ordinary English content remains readable." : "日本語の本文も省略せずに表示します。"}

<p data-reflow-prose>${token}</p>

<a data-reflow-link href="#local-code">${linkText}</a>

## Local code

\`\`\`js
${codeText}
\`\`\`
`);
  }
  run("pnpm", ["install", "--strict-peer-dependencies", "--no-frozen-lockfile"], consumer);
  const lockPath = path.join(consumer, "pnpm-lock.yaml");
  const lockSha256 = hash(lockPath);
  run("pnpm", ["install", "--strict-peer-dependencies", "--frozen-lockfile"], consumer);
  expect(hash(lockPath)).toBe(lockSha256);
  run("pnpm", ["install", "--strict-peer-dependencies", "--no-frozen-lockfile"], consumer);
  expect(hash(lockPath)).toBe(lockSha256);
  const realpaths = Object.fromEntries(Object.keys(manifest.dependencies).map((name) => [
    name, realpathSync(path.join(consumer, "node_modules", name)),
  ]));
  for (const resolved of Object.values(realpaths)) expect(resolved.startsWith(realpathSync(consumer) + path.sep)).toBe(true);
  expect(hash(path.join(realpaths["@takazudo/zudo-doc"]!, "dist/content.css")))
    .toBe(hash(path.join(snapshot, "dist/content.css")));
  const outputs: Record<string, { htmlSha256: string; origin: string }> = {};
  for (const base of bases) {
    const docroot = path.join(scratch, base === "/" ? "root-output" : "manual-output");
    run(process.execPath, [path.join(root, "scripts/zfb3-parity/installed-consumer/build-mount-control.mjs"), consumer, base, docroot], consumer);
    const origin = await serve(docroot);
    origins.set(base, origin);
    outputs[base] = { htmlSha256: hash(path.join(docroot, base, "index.html")), origin };
  }
  expect(hash(globalCssPath)).toBe(globalCssHash);
  expect(hash(lockPath)).toBe(lockSha256);
  await testInfo.attach("packed-reflow-provenance", {
    body: JSON.stringify({
      sourceHead: run("git", ["rev-parse", "HEAD"], root).trim(),
      sourceTree: run("git", ["rev-parse", "HEAD^{tree}"], root).trim(),
      node: process.version, pnpm: run("pnpm", ["--version"], consumer).trim(),
      tarballSha256: hash(tarball), packageVersion: packageManifest.version,
      workspaceLockSha256: hash(path.join(root, "pnpm-lock.yaml")),
      lockSha256, globalCssSha256: globalCssHash, realpaths, outputs,
    }, null, 2), contentType: "application/json",
  });
});

test.afterAll(async () => {
  for (const server of servers) {
    if (!server.pid || server.exitCode !== null || server.signalCode !== null) continue;
    await new Promise<void>((resolve) => {
      const deadline = setTimeout(() => server.kill("SIGKILL"), 5_000);
      server.once("exit", () => { clearTimeout(deadline); resolve(); });
      server.kill("SIGTERM");
    });
  }
  servers.length = 0;
  origins.clear();
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

for (const base of bases) {
  for (const locale of ["en", "ja"]) {
    for (const mode of ["light", "dark"] as const) {
      test(`packed native ${base} ${locale} ${mode} reflows without host overrides`, async ({ page, assertNoConsoleErrors }, testInfo) => {
        testInfo.setTimeout(90_000);
        const origin = origins.get(base)!;
        const prefix = `${base === "/" ? "" : base}${locale === "en" ? "" : "/ja"}`;
        const responses: string[] = [];
        page.on("response", (response) => {
          if (response.status() >= 400) responses.push(`${response.status()} ${response.url()}`);
        });
        await page.emulateMedia({ colorScheme: mode });
        await page.addInitScript(({ key, mode }) => localStorage.setItem(key, mode), { key: THEME_STORAGE_KEY, mode });
        const measurements: unknown[] = [];
        for (const route of ["/", "/docs/getting-started/", "/docs/getting-started/reflow/"]) {
          for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`${origin}${prefix}${route}`, { waitUntil: "load" });
            await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
            await expect(page.locator("body > header")).toBeVisible();
            await expect(page.locator("main")).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            const geometry = await page.evaluate(() => {
              const viewport = document.documentElement.clientWidth;
              const protruding: { text: string; left: number; right: number }[] = [];
              // Element boxes alone miss overflowing text; exclude only genuine
              // local scroll containers, never an overflow-hidden masking fix.
              const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
              let node: Node | null;
              while ((node = walker.nextNode())) {
                if (!node.textContent?.trim()) continue;
                const element = node.parentElement;
                if (!element || element.closest("script, style, pre, [hidden]")) continue;
                let locallyScrolled = false;
                let hidden = false;
                for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
                  const style = getComputedStyle(ancestor);
                  if (style.display === "none" || style.visibility === "hidden") hidden = true;
                  if (/^(auto|scroll)$/.test(style.overflowX) && ancestor.scrollWidth > ancestor.clientWidth) locallyScrolled = true;
                }
                if (hidden || locallyScrolled) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const box of Array.from(range.getClientRects())) {
                  if (box.width && (box.left < -1 || box.right > viewport + 1)) protruding.push({ text: node.textContent.slice(0, 100), left: box.left, right: box.right });
                }
              }
              return { viewport, documentWidth: document.documentElement.scrollWidth, protruding };
            });
            measurements.push({ base, locale, mode, route, width, ...geometry });
            expect.soft(geometry.documentWidth, `${prefix}${route} at ${width}px`).toBeLessThanOrEqual(geometry.viewport);
            expect.soft(geometry.protruding, `unclipped ordinary text at ${prefix}${route}, ${width}px`).toEqual([]);
            if (route.endsWith("/reflow/")) {
              await expect(page.locator("[data-reflow-prose]")).toHaveText(token);
              await expect(page.locator("[data-reflow-link]")).toHaveText(linkText);
              const code = page.locator(".zd-content pre code").first();
              expect.soft((await code.textContent())?.trim()).toBe(codeText);
              const scrolling = await code.evaluate((element) => {
                for (let ancestor = element.parentElement; ancestor && !ancestor.matches(".zd-content"); ancestor = ancestor.parentElement) {
                  if (/^(auto|scroll)$/.test(getComputedStyle(ancestor).overflowX) && ancestor.scrollWidth > ancestor.clientWidth) {
                    ancestor.scrollLeft = ancestor.scrollWidth;
                    const result = { moved: ancestor.scrollLeft > 0, whiteSpace: getComputedStyle(element).whiteSpace };
                    ancestor.scrollLeft = 0;
                    return result;
                  }
                }
                return null;
              });
              expect.soft(scrolling, "wide preformatted code retains a local scroll container").not.toBeNull();
              expect.soft(scrolling?.moved).toBe(true);
              expect.soft(scrolling?.whiteSpace).toBe("pre");
            }
            if ((route === "/" || route.endsWith("/reflow/")) && (width === 195 || width === 1280)) {
              await testInfo.attach(`native-${locale}-${mode}-${width}-${route === "/" ? "home" : "article"}`, {
                body: await page.screenshot({ fullPage: true }), contentType: "image/png",
              });
            }
          }
        }
        await testInfo.attach("packed-reflow-matrix", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
        expect(responses, "all real consumer document and asset requests succeed").toEqual([]);
        assertNoConsoleErrors();
      });
    }
  }
  test(`packed ${base} regression control detects the removed wrapping default`, async ({ page }) => {
    await page.setViewportSize({ width: 195, height: 900 });
    await page.goto(`${origins.get(base)}${base === "/" ? "" : base}/docs/getting-started/reflow/`);
    await expect(page.locator("[data-reflow-prose]")).toHaveText(token);
    await page.evaluate(() => document.fonts.ready);
    const documentWidth = () => page.evaluate(() => document.documentElement.scrollWidth);
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);
    expect(await documentWidth()).toBeLessThanOrEqual(viewport);
    // Test-only fault injection, never a consumer file or production override.
    const fault = await page.addStyleTag({ content: ".zd-content { overflow-wrap: normal !important; }" });
    try {
      expect(await documentWidth(), "the full installed layout must expose this regression").toBeGreaterThan(viewport);
    } finally {
      await fault.evaluate((element) => element.remove());
    }
    expect(await documentWidth()).toBeLessThanOrEqual(viewport);
  });
}
