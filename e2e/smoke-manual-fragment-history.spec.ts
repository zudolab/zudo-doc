/** Real isolated packed consumer; uses the existing non-root mount contract. */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, expect } from "./fixtures";
import { registerFragmentHistoryTests } from "./fragment-history-helpers";
import { spaClick } from "./nav-helpers";
import {
  finishNativeTransition, installNativeTransitionProbe, navigateNativeTransition,
  proveActiveNativeTransition,
} from "./native-transition-helpers";

// One install per file worker; immutable enabled/disabled builds share the same
// installed public artifacts. This remains in the blocking smoke browser lane.
test.describe.configure({ mode: "default" });
let temp: string;
const servers: ChildProcess[] = [];
let origin = "";
let disabledOrigin = "";
const root = path.resolve(import.meta.dirname, "..");
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(240_000);
  temp = mkdtempSync(path.join(tmpdir(), "zudo-fragment-consumer-"));
  const consumer = path.join(temp, "consumer");
  mkdirSync(consumer);
  const tarballs: Record<string, { path: string; sha256: string }> = {};
  for (const name of ["doc-history-server", "zudo-doc"]) {
    const source = path.join(root, "packages", name);
    const snapshot = path.join(temp, name);
    mkdirSync(snapshot);
    const manifest = JSON.parse(readFileSync(path.join(source, "package.json"), "utf8"));
    // Pack immutable already-built public files, with no lifecycle capable of
    // rebuilding shared dist (npm 10 runs prepare even with --ignore-scripts).
    for (const file of manifest.files as string[]) {
      if (existsSync(path.join(source, file))) cpSync(path.join(source, file), path.join(snapshot, file), { recursive: true });
    }
    delete manifest.scripts;
    writeFileSync(path.join(snapshot, "package.json"), JSON.stringify(manifest));
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts"], { cwd: snapshot, encoding: "utf8" })) as { filename: string }[]; // dist-mutation-ok: packs only an owned throwaway snapshot whose lifecycle scripts were removed above.
    const tarball = path.join(snapshot, packed[0]!.filename);
    tarballs[manifest.name] = { path: tarball, sha256: hash(tarball) };
  }
  const rootManifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const dependencies: Record<string, string> = {};
  for (const name of ["@takazudo/zfb", "@takazudo/zfb-runtime", "@takazudo/zfb-md-wasm", "zod"]) dependencies[name] = rootManifest.dependencies[name];
  for (const [name, tarball] of Object.entries(tarballs)) dependencies[name] = `file:${tarball.path}`;
  writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "fragment-history-consumer", private: true, type: "module", dependencies, pnpm: { overrides: dependencies } }));
  cpSync(path.join(root, ".npmrc"), path.join(consumer, ".npmrc"));
  for (const locale of ["en", "ja"]) {
    const directory = locale === "en" ? "docs" : "docs-ja";
    const target = path.join(consumer, "src/content", directory);
    mkdirSync(target, { recursive: true });
    for (const page of ["a", "b"]) {
      const filename = `router-fragment-${page}.mdx`;
      const content = readFileSync(path.join(root, "e2e/fixtures/smoke/src/content", directory, filename), "utf8");
      writeFileSync(path.join(target, filename), content.replaceAll("](/", "](/manual/"));
    }
    const prefix = locale === "en" ? "/manual" : "/manual/ja";
    writeFileSync(path.join(target, "getting-started.mdx"), `---\ntitle: Getting Started\n---\n\nConsumer mount control.\n\n[Guides](${prefix}/docs/guides/)\n`);
    mkdirSync(path.join(target, "guides"));
    for (const guide of ["index", "a", "b"]) {
      const title = `${locale === "en" ? "Guide" : "ガイド"} ${guide.toUpperCase()}`;
      writeFileSync(path.join(target, "guides", `${guide}.mdx`), `---
title: ${title}
---

${title}: installed public package transition content.

[Guide A](${prefix}/docs/guides/a/) · [Guide B](${prefix}/docs/guides/b/) · [Getting Started](${prefix}/docs/getting-started/)

## ${title} details

${Array.from({ length: 12 }, (_, index) => `${title} paragraph ${index + 1}. This article changes while the native header and same-category sidebar snapshots stay stationary.`).join("\n\n")}
`);
    }
  }
  cpSync(path.join(root, "packages/create-zudo-doc/templates/base/public"), path.join(consumer, "public"), { recursive: true });
  mkdirSync(path.join(consumer, "src/styles"), { recursive: true });
  cpSync(path.join(root, "packages/create-zudo-doc/templates/base/src/styles/global.css"), path.join(consumer, "src/styles/global.css"));
  writeFileSync(path.join(consumer, "tsconfig.json"), JSON.stringify({ extends: "@takazudo/zudo-doc/tsconfig.base.json", include: ["src", "zfb.config.ts"] }));
  writeFileSync(path.join(consumer, "zfb.config.ts"), `import { defineConfig } from "@takazudo/zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
export default defineConfig(
  zudoDoc({
    siteName: "Fragment history consumer",
    locales: { ja: { label: "JA", dir: "src/content/docs-ja" } },
    dynamicPageTransition: true,
    mermaid: false,
    math: false,
    designTokenPanel: false,
    docHistory: false,
    sitemap: false,
  }),
);
`);
  const run = (command: string, args: string[]) => execFileSync(command, args, { cwd: consumer, encoding: "utf8", timeout: 120_000, env: { ...process.env, INIT_CWD: consumer, SKIP_DOC_HISTORY: "1" } });
  run("pnpm", ["install"]);
  const lock = hash(path.join(consumer, "pnpm-lock.yaml"));
  run("pnpm", ["install", "--frozen-lockfile"]);
  expect(hash(path.join(consumer, "pnpm-lock.yaml"))).toBe(lock);
  // CI otherwise defaults to frozen installation whenever a lockfile exists.
  run("pnpm", ["install", "--no-frozen-lockfile"]);
  expect(hash(path.join(consumer, "pnpm-lock.yaml"))).toBe(lock);
  const realpaths = Object.fromEntries(Object.keys(dependencies).map((name) => [name, realpathSync(path.join(consumer, "node_modules", name))]));
  for (const resolved of Object.values(realpaths)) expect(resolved.startsWith(consumer + path.sep)).toBe(true);
  const docroot = path.join(temp, "mounted");
  run(process.execPath, [path.join(root, "scripts/zfb3-parity/installed-consumer/build-mount-control.mjs"), consumer, "/manual", docroot]);
  const disabledDocroot = path.join(temp, "mounted-disabled");
  const configPath = path.join(consumer, "zfb.config.ts");
  const enabledConfig = readFileSync(configPath, "utf8");
  // Build the real public opt-out in this disposable consumer only. The first
  // mounted output is already copied and cannot be overwritten by this build.
  try {
    writeFileSync(configPath, enabledConfig.replace("dynamicPageTransition: true", "dynamicPageTransition: false"));
    run(process.execPath, [path.join(root, "scripts/zfb3-parity/installed-consumer/build-mount-control.mjs"), consumer, "/manual", disabledDocroot]);
  } finally {
    writeFileSync(configPath, enabledConfig);
  }
  await testInfo.attach("installed-consumer-provenance", { body: JSON.stringify({ sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), tarballs, lockSha256: lock, realpaths }, null, 2), contentType: "application/json" });
  async function serve(output: string): Promise<string> {
    const probe = createServer();
    const port = await new Promise<number>((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(0, "127.0.0.1", () => {
        const address = probe.address();
        if (!address || typeof address === "string") throw new Error("missing port");
        probe.close(() => resolve(address.port));
      });
    });
    const server = spawn(process.execPath, [path.join(root, "scripts/zfb3-parity/installed-consumer/static-mount-server.mjs"), output, String(port)], { stdio: ["ignore", "pipe", "pipe"] });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        if (error) reject(error); else resolve();
      };
      const timeout = setTimeout(() => finish(new Error("mount server did not become ready")), 10_000);
      server.once("error", finish);
      server.once("exit", (code) => finish(new Error(`mount server exited: ${code}`)));
      server.stdout!.once("data", () => finish());
    });
    return `http://127.0.0.1:${port}`;
  }
  origin = await serve(docroot);
  disabledOrigin = await serve(disabledDocroot);
});

test.afterAll(async () => {
  for (const server of servers) {
    if (server.pid && server.exitCode === null && server.signalCode === null) {
      const stopped = new Promise<void>((resolve) => server.once("exit", () => resolve()));
      server.kill("SIGTERM");
      await stopped;
    }
  }
  servers.length = 0;
  if (temp) rmSync(temp, { recursive: true, force: true });
});

let failedResponses: string[] = [];
let assets: string[] = [];
let documents: string[] = [];
test.beforeEach(async ({ page }) => {
  failedResponses = [];
  assets = [];
  documents = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    if (["script", "stylesheet"].includes(request.resourceType())) assets.push(request.url());
    if (request.resourceType() === "document") documents.push(request.url());
  });
});
test.afterEach(({}, testInfo) => {
  expect(failedResponses, "the mounted consumer serves every requested resource").toEqual([]);
  expect(assets.length).toBeGreaterThan(0);
  const transitionsDisabled = testInfo.annotations.some(({ type }) => type === "dynamic-page-transition-disabled");
  const expectedOrigin = transitionsDisabled ? disabledOrigin : origin;
  for (const asset of assets) expect(asset.startsWith(`${expectedOrigin}/manual/`)).toBe(true);
  expect(documents, transitionsDisabled
    ? "the public opt-out performs real document navigation"
    : "history and soft navigation retain the original document").toHaveLength(transitionsDisabled ? 2 : 1);
});

registerFragmentHistoryTests("/manual", () => origin);

const guideA = "/manual/docs/guides/a/";
const guideB = "/manual/docs/guides/b/";
const headerRegion = { name: "zfb-header", selector: "body > header" };
const sidebarRegion = { name: "zfb-sidebar", selector: "#desktop-sidebar" };
const sidebarContext = "#desktop-sidebar nav[data-sidebar-context]";

test.describe("installed public transition delivery", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("same-category snapshots remain stationary through navigation and Back/Forward", async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`${origin}${guideA}`);
    await expect(page.locator(sidebarContext)).toHaveAttribute("data-sidebar-context", /.+/);
    const context = await page.locator(sidebarContext).getAttribute("data-sidebar-context");
    const filter = page.locator('#desktop-sidebar input[placeholder^="Filter"]');
    await filter.fill("Guide");
    await filter.blur();
    await installNativeTransitionProbe(page);
    for (const [label, target, title] of [
      ["packed-same-category", guideB, "Guide B"],
      ["packed-back", { history: "back" }, "Guide A"],
      ["packed-forward", { history: "forward" }, "Guide B"],
    ] as const) {
      await navigateNativeTransition(page, target);
      await expect(page.locator("html")).toHaveAttribute("data-zd-sidebar-transition", "stationary");
      await expect(page.locator(sidebarContext)).toHaveAttribute("data-sidebar-context", context!);
      await proveActiveNativeTransition(page, testInfo, { label, regions: [headerRegion, sidebarRegion] });
      await finishNativeTransition(page);
      await expect(page.locator("main h1")).toHaveText(title);
      await expect(filter).toHaveValue("Guide");
    }
  });

  test("cross-category content animates while installed header snapshots stay stationary", async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`${origin}${guideA}`);
    await expect(page.locator(sidebarContext)).toHaveAttribute("data-sidebar-context", /.+/);
    await installNativeTransitionProbe(page);
    await navigateNativeTransition(page, "/manual/docs/getting-started/");
    await expect(page.locator("[data-zd-nav-section]")).toHaveAttribute("data-zd-nav-section", "getting-started");
    await expect(page.locator("html")).not.toHaveAttribute("data-zd-sidebar-transition", "stationary");
    const nodes = await proveActiveNativeTransition(page, testInfo, { label: "packed-cross-category", regions: [headerRegion] });
    expect(nodes.some((node) => node.name === "zfb-sidebar" &&
      /view-transition-(old|new)$/.test(node.type) && /contentFade(In|Out)/.test(node.style["animation-name"]!)),
    "Changing sidebar snapshots must still animate").toBe(true);
    await finishNativeTransition(page);
    await expect(page.locator("main h1")).toHaveText("Getting Started");
  });

  test("locale replacement keeps the header stationary and renders fresh isolated navigation", async ({ page }, testInfo) => {
    await page.goto(`${origin}${guideA}`);
    await expect(page.locator(sidebarContext)).toHaveAttribute("data-sidebar-context", /.+/);
    const oldContext = await page.locator(sidebarContext).getAttribute("data-sidebar-context");
    await page.locator('#desktop-sidebar input[placeholder^="Filter"]').fill("Guide");
    await page.locator('#desktop-sidebar input[placeholder^="Filter"]').blur();
    await page.locator("body > header").evaluate((header) => { header.setAttribute("data-consumer-old-header", "true"); });
    await installNativeTransitionProbe(page);
    await navigateNativeTransition(page, { selector: 'header a[lang="ja"]' });
    await proveActiveNativeTransition(page, testInfo, { label: "packed-locale-replacement", regions: [headerRegion] });
    await finishNativeTransition(page);
    await expect(page).toHaveURL(new RegExp(`${origin}/manual/ja/docs/guides/a/?$`));
    await expect(page.locator("main h1")).toHaveText("ガイド A");
    await expect(page.locator("body > header")).not.toHaveAttribute("data-consumer-old-header", "true");
    await expect(page.locator('header a[lang="en"]')).toHaveAttribute("href", /\/manual\/docs\/guides\/a\/?$/);
    await expect(page.locator(sidebarContext)).not.toHaveAttribute("data-sidebar-context", oldContext!);
    await expect(page.locator("#desktop-sidebar input").first()).toHaveValue("");
    await navigateNativeTransition(page, { selector: 'header a[lang="en"]' });
    await proveActiveNativeTransition(page, testInfo, { label: "packed-fresh-header-return", regions: [headerRegion] });
    await finishNativeTransition(page);
    await expect(page.locator("main h1")).toHaveText("Guide A");
    await expect(page.locator(sidebarContext)).toHaveAttribute("data-sidebar-context", oldContext!);
  });

  test("mobile installed header is stationary while destination content animates", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`${origin}${guideA}`);
    await expect(page.locator("main h1")).toHaveText("Guide A");
    await installNativeTransitionProbe(page);
    await navigateNativeTransition(page, guideB);
    await proveActiveNativeTransition(page, testInfo, { label: "packed-mobile", regions: [headerRegion] });
    await finishNativeTransition(page);
    await expect(page.locator("main h1")).toHaveText("Guide B");
    await expect(page.locator("#desktop-sidebar")).not.toBeVisible();
  });

  test("no-native fallback keeps the same document and fresh destination content", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined });
    });
    await page.goto(`${origin}${guideA}`);
    expect(await page.evaluate(() => typeof document.startViewTransition)).toBe("undefined");
    expect(await spaClick(page, guideB)).toBe(true);
    await expect(page.locator("main h1")).toHaveText("Guide B");
    await expect(page.locator('#desktop-sidebar a[aria-current="page"]')).toHaveAttribute("href", /\/guides\/b\/?$/);
    await expect(page.locator("#page-loading-overlay")).toHaveAttribute("aria-hidden", "true");
  });

  test("dynamicPageTransition false uses document navigation in a separately built installed consumer", async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: "dynamic-page-transition-disabled", description: "Public config false was built into this separate mounted output; exactly two documents are required." });
    await page.goto(`${disabledOrigin}${guideA}`);
    await page.evaluate(() => { document.documentElement.setAttribute("data-consumer-document", "initial"); });
    await page.locator(`main a[href="${guideB}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${disabledOrigin}/manual/docs/guides/b/?$`));
    await expect(page.locator("main h1")).toHaveText("Guide B");
    await expect(page.locator("html")).not.toHaveAttribute("data-consumer-document", "initial");
  });
});
