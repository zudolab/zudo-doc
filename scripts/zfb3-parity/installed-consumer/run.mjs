// Installed-consumer browser acceptance (#4509 / #4475).
//   node run.mjs preview <consumerDir> <barebone|allfeat> <out.json> [--port N]
//     serves the consumer's dist with its own installed `zfb preview`
//   node run.mjs mount <docroot> <base> <allfeat> <out.json> [--port N]
//     non-root control: serves <docroot> (dist relocated under <base>) with
//     static-mount-server.mjs
// Run through: bash $HOME/.claude/scripts/heavy-guard.sh --wait 540 -- node run.mjs ...
// After the browser closes, the server's process group is torn down and the
// script proves no process survives and the port is free (zfb #3392).
import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const portIdx = argv.indexOf("--port");
const PORT = portIdx === -1 ? 4391 : Number(argv.splice(portIdx, 2)[1]);
const mode = argv[0];
let serverCmd, serverCwd, BASE_PATH, KIND, OUT;
if (mode === "preview") {
  const consumer = path.resolve(argv[1]);
  [KIND, OUT] = [argv[2], argv[3]];
  serverCmd = [path.join(consumer, "node_modules/.bin/zfb"), ["preview", "--port", String(PORT), "--host", "127.0.0.1"]];
  serverCwd = consumer;
  BASE_PATH = "/";
} else if (mode === "mount") {
  const docroot = path.resolve(argv[1]);
  BASE_PATH = argv[2].endsWith("/") ? argv[2] : `${argv[2]}/`;
  [KIND, OUT] = [argv[3], argv[4]];
  serverCmd = [process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "static-mount-server.mjs"), docroot, String(PORT)]];
  serverCwd = docroot;
} else {
  console.error("usage: run.mjs preview <consumer> <kind> <out> | mount <docroot> <base> <kind> <out>");
  process.exit(2);
}
const ORIGIN = `http://127.0.0.1:${PORT}`;
const url = (p) => `${ORIGIN}${BASE_PATH}${p.replace(/^\//, "")}`;
const ALL = KIND === "allfeat";
const T = 15_000;

const results = [];
const consoleErrors = [];
const failedRequests = [];
const scripts = new Set();
const check = async (name, fn) => {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail: detail ?? "", ms: Date.now() - started });
  } catch (error) {
    results.push({ name, pass: false, detail: String(error?.message ?? error).split("\n").slice(0, 3).join(" | "), ms: Date.now() - started });
  }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ── server lifecycle ────────────────────────────────────────────────────────
const portFree = () => new Promise((resolve) => {
  const srv = net.createServer().once("error", () => resolve(false)).once("listening", () => srv.close(() => resolve(true)));
  srv.listen(PORT, "127.0.0.1");
});
const groupMembers = (pgid) => execFileSync("ps", ["-eo", "pid=,pgid=,args="]).toString().split("\n")
  .map((l) => l.trim().split(/\s+/)).filter(([, g]) => Number(g) === pgid).map(([pid, , ...a]) => `${pid} ${a.join(" ")}`);
const cwdHolders = (dir) => readdirSync("/proc").filter((p) => /^\d+$/.test(p) && Number(p) !== process.pid).filter((p) => {
  try { return readlinkSync(`/proc/${p}/cwd`).startsWith(dir); } catch { return false; }
});

assert(await portFree(), `port ${PORT} busy before start`);
const [cmd, cmdArgs] = serverCmd;
const server = spawn(cmd, cmdArgs, { cwd: serverCwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
// Any uncaught failure below would otherwise orphan the detached server group.
process.once("exit", () => { try { process.kill(-server.pid, "SIGKILL"); } catch {} });
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });
const deadline = Date.now() + 60_000;
for (;;) {
  try { if ((await fetch(url(""))).status < 500) break; } catch {}
  if (Date.now() > deadline || server.exitCode !== null) {
    try { process.kill(-server.pid, "SIGKILL"); } catch {}
    throw new Error(`server did not come up:\n${serverLog}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}
const serverTree = groupMembers(server.pid);

// ── browser ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const chromiumVersion = browser.version();
const newPage = async (viewport = { width: 1280, height: 800 }, context) => {
  const ctx = context ?? await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${page.url()} :: ${m.text()}`); });
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: pageerror ${e.message}`));
  page.on("requestfailed", (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.url().startsWith(ORIGIN) && r.status() >= 400) failedRequests.push(`${r.url()} :: HTTP ${r.status()}`);
    if (r.request().resourceType() === "script" && r.url().startsWith(ORIGIN)) scripts.add(new URL(r.url()).pathname);
  });
  return { ctx, page };
};

const MARKERS = "[data-zfb-island], [data-zfb-island-skip-ssr]";
async function islandsMounted(page) {
  const markers = page.locator(MARKERS);
  await page.waitForFunction((sel) => document.querySelectorAll(sel).length > 0, MARKERS, { timeout: T });
  const count = await markers.count();
  const names = [];
  for (let i = 0; i < count; i++) {
    const m = markers.nth(i);
    const name = (await m.getAttribute("data-zfb-island")) ?? (await m.getAttribute("data-zfb-island-skip-ssr"));
    const when = await m.getAttribute("data-when");
    if (when === "visible") await m.scrollIntoViewIfNeeded();
    if (when === "media") {
      const q = (await m.getAttribute("data-media")) ?? (await m.getAttribute("data-query"));
      if (q && !(await page.evaluate((v) => matchMedia(v).matches, q))) { names.push(`${name}(media-inactive)`); continue; }
    }
    await m.waitFor({ state: "attached", timeout: T });
    await page.waitForFunction(([sel, idx]) => document.querySelectorAll(sel)[idx]?.hasAttribute("data-zfb-island-mounted"), [MARKERS, i], { timeout: T })
      .catch(() => { throw new Error(`island ${i} ${name} (${when}) not mounted`); });
    names.push(name);
  }
  return names;
}

// SPA swap if the client router is present; else a normal document navigation.
async function navigate(page, selector) {
  const swapped = await page.evaluate((sel) => {
    const a = document.querySelector(sel);
    if (!a) throw new Error(`no anchor ${sel}`);
    window.__swap = false;
    window.__marker = true;
    document.addEventListener("zfb:after-swap", () => { window.__swap = true; }, { once: true });
    a.click();
    return true;
  }, selector);
  assert(swapped, "click failed");
  const until = Date.now() + T;
  for (;;) {
    // A document navigation destroys the context mid-poll; retry on the new one.
    const done = await page.evaluate(() => window.__swap === true || window.__marker !== true).catch(() => false);
    if (done) break;
    if (Date.now() > until) throw new Error("navigation neither swapped nor loaded a new document");
    await page.waitForTimeout(100);
  }
  await page.waitForLoadState("load");
  return page.evaluate(() => (window.__marker === true ? "client swap (zfb:after-swap, same document)" : "full document navigation"));
}

const appearanceTrigger = (page) => page.locator('header [data-zd-theme-menu] > button[aria-haspopup="menu"]:visible').first();
async function pickTheme(page, label) {
  const trigger = appearanceTrigger(page);
  await trigger.waitFor({ state: "visible", timeout: T });
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('header [data-zd-theme-menu] > button[aria-haspopup="menu"]')].find((e) => e.getBoundingClientRect().width > 0);
    return b && b.getAttribute("aria-disabled") !== "true";
  }, null, { timeout: T });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Appearance", exact: true });
  await menu.waitFor({ state: "visible", timeout: T });
  await menu.getByRole("menuitemradio", { name: label, exact: true }).click();
  await page.waitForFunction((l) => [...document.querySelectorAll("header [data-zd-theme-menu] > button")].some((b) => b.getAttribute("aria-label") === `Appearance: ${l}`), label, { timeout: T });
}
const themeState = (page) => page.evaluate(() => ({
  scheme: getComputedStyle(document.documentElement).colorScheme,
  bg: getComputedStyle(document.body).backgroundColor,
  stored: localStorage.getItem("zudo-doc-theme"),
}));

const docsPage = "docs/getting-started/";
const guidesPage = "docs/guides/";

if (mode === "preview") {
  // 1. Hydration + single runtime identity on several routes, reload and navigation.
  {
    const { ctx, page } = await newPage();
    await page.goto(url(docsPage), { waitUntil: "load" });
    const startH1 = await page.locator("h1").first().textContent();
    await check("hydration: every island marker mounts (getting-started)", async () => (await islandsMounted(page)).join(", "));
    await check("runtime identity: exactly one islands entry module loaded", async () => {
      const entries = [...scripts].filter((s) => /\/islands-[0-9a-f]+\.js$/.test(s));
      assert(entries.length === 1, `islands entries: ${entries.join(", ") || "none"}`);
      return entries[0];
    });
    await check("reload: islands re-mount after a hard reload", async () => {
      await page.reload({ waitUntil: "load" });
      return `${(await islandsMounted(page)).length} islands`;
    });
    await check("navigation: sidebar link to Installation, islands re-mount", async () => {
      const how = await navigate(page, '#desktop-sidebar a[href$="/getting-started/installation/"], #desktop-sidebar a[href$="/getting-started/installation"]');
      assert(/installation\/?$/.test(page.url()), `url ${page.url()}`);
      const n = (await islandsMounted(page)).length;
      if (ALL) assert(how.startsWith("client swap"), `expected client swap with dynamicPageTransition, got ${how}`);
      return `${how}; ${n} islands`;
    });
    await check("navigation: back returns to getting-started with islands mounted", async () => {
      await page.goBack({ waitUntil: "load" });
      // With the client router, Back is a popstate swap that lands after "load".
      await page.waitForFunction((h) => /getting-started\/?$/.test(location.pathname) && document.querySelector("h1")?.textContent === h, startH1, { timeout: T });
      return `${(await islandsMounted(page)).length} islands`;
    });
    await ctx.close();
  }

  // 2. 06R Broaden / Restore and branch focus on the nested guides tree.
  {
    const { ctx, page } = await newPage();
    await page.goto(url(guidesPage), { waitUntil: "load" });
    await islandsMounted(page);
    const focusLabels = () => page.locator("#desktop-sidebar [data-sidebar-focus]:visible").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    const h1 = await page.locator("h1").first().textContent();
    const startUrl = page.url();
    await check("R6: Broaden hides the toolbar at the highest tree; refocus then Restore returns", async () => {
      const broaden = page.locator("#desktop-sidebar [data-sidebar-broaden]:visible").first();
      await broaden.waitFor({ state: "visible", timeout: T });
      const before = await focusLabels();
      const branchScope = await page.locator("#desktop-sidebar [data-sidebar-focus]:visible").nth(1).getAttribute("data-sidebar-focus-scope");
      assert(branchScope, "need a nested branch to refocus before Restore");
      await broaden.click();
      // Accepted R6 removes the whole toolbar at the highest tree (#4477).
      // Refocus a nested branch before Restore, as sidebar-broader-tree.spec.ts does.
      await page.locator("#desktop-sidebar [data-sidebar-scope-toolbar]").waitFor({ state: "hidden", timeout: T });
      const widened = await focusLabels();
      assert(widened.length > before.length, `broaden did not widen (${before.length} -> ${widened.length})`);
      await page.locator(`#desktop-sidebar [data-sidebar-focus-scope="${branchScope}"]`).click();
      await page.locator("#desktop-sidebar [data-sidebar-restore]:visible").first().click();
      await page.waitForFunction((n) => [...document.querySelectorAll("#desktop-sidebar [data-sidebar-focus]")].filter((e) => e.getBoundingClientRect().width > 0).length === n, before.length, { timeout: T });
      return `${before.length} -> ${widened.length} -> ${before.length}`;
    });
    await check("06R: branch focus narrows, Restore undoes; URL and article unchanged", async () => {
      const buttons = page.locator("#desktop-sidebar [data-sidebar-focus]:visible");
      const before = await buttons.count();
      assert(before >= 2, `need >=2 focus buttons, got ${before}`);
      const label = await buttons.nth(1).getAttribute("aria-label");
      await buttons.nth(1).click();
      await page.locator("#desktop-sidebar [data-sidebar-restore]:visible").first().waitFor({ state: "visible", timeout: T });
      const narrowed = await page.locator("#desktop-sidebar [data-sidebar-focus]:visible").count();
      assert(narrowed < before, `focus did not narrow (${before} -> ${narrowed})`);
      await page.locator("#desktop-sidebar [data-sidebar-restore]:visible").first().click();
      await page.waitForFunction((n) => [...document.querySelectorAll("#desktop-sidebar [data-sidebar-focus]")].filter((e) => e.getBoundingClientRect().width > 0).length === n, before, { timeout: T });
      assert(page.url() === startUrl, `URL changed ${startUrl} -> ${page.url()}`);
      assert((await page.locator("h1").first().textContent()) === h1, "article heading changed");
      return `"${label}": ${before} -> ${narrowed} -> ${before}`;
    });
    await ctx.close();
  }

  // 3. Search.
  {
    const { ctx, page } = await newPage();
    await page.goto(url(docsPage), { waitUntil: "load" });
    await islandsMounted(page);
    if (ALL) {
      await check("search: Ctrl+K opens, query returns results, result navigates, Escape closes", async () => {
        await page.keyboard.press("Control+k");
        await page.locator("[data-search-dialog]").waitFor({ state: "visible", timeout: T });
        await page.locator("[data-search-input]").fill("Installation");
        const first = page.locator("[data-search-results] article a").first();
        await first.waitFor({ state: "visible", timeout: T });
        const count = await page.locator("[data-search-results] article").count();
        const href = await first.getAttribute("href");
        await page.keyboard.press("Escape");
        await page.locator("[data-search-dialog]").waitFor({ state: "hidden", timeout: T });
        const res = await fetch(new URL(href, page.url()));
        assert(res.status === 200, `result ${href} -> ${res.status}`);
        return `${count} results; first ${href} -> 200`;
      });
    } else {
      await check("search: absent in barebone (feature off) — no search dialog rendered", async () => {
        assert(await page.locator("[data-search-dialog]").count() === 0, "search dialog rendered with search off");
        const res = await fetch(url("search-index.json"));
        return `dialog absent; /search-index.json -> ${res.status}`;
      });
    }
    await ctx.close();
  }

  // 4. Theme toggle and persistence.
  {
    const { ctx, page } = await newPage();
    await page.goto(url(docsPage), { waitUntil: "load" });
    await islandsMounted(page);
    await check("theme: Dark/Light toggle changes scheme and persists across reload and navigation", async () => {
      await pickTheme(page, "Dark");
      const dark = await themeState(page);
      assert(dark.stored === "dark" && dark.scheme.includes("dark"), `dark state ${JSON.stringify(dark)}`);
      await page.reload({ waitUntil: "load" });
      const afterReload = await themeState(page);
      assert(afterReload.bg === dark.bg && afterReload.stored === "dark", `not persisted on reload ${JSON.stringify(afterReload)}`);
      await navigate(page, '#desktop-sidebar a[href$="/getting-started/introduction/"], #desktop-sidebar a[href$="/getting-started/introduction"]');
      const afterNav = await themeState(page);
      assert(afterNav.bg === dark.bg, `not persisted on navigation ${JSON.stringify(afterNav)}`);
      await pickTheme(page, "Light");
      const light = await themeState(page);
      assert(light.bg !== dark.bg && light.stored === "light", `light state ${JSON.stringify(light)}`);
      return `dark ${dark.bg} (reload ok, nav ok) / light ${light.bg}`;
    });
    await ctx.close();
  }

  // 5. Design Token Panel lifecycle (all-feature only).
  if (ALL) {
    const { ctx, page } = await newPage({ width: 1280, height: 900 });
    const TRIGGER = "#design-token-trigger";
    const SHELL = ".tokenpanel-shell";
    const VAR = "--spacing-hsp-lg";
    const readVar = () => page.evaluate((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), VAR);
    const shells = () => page.locator(SHELL).count();
    const input = () => page.getByTestId("tier-item-hsp-lg").getByLabel(`${VAR} value`, { exact: true });
    const open = async () => { await page.locator(TRIGGER).click(); await page.locator(SHELL).waitFor({ state: "visible", timeout: T }); };
    const close = async () => {
      await page.getByRole("button", { name: "Close panel", exact: true }).click();
      await page.locator(SHELL).waitFor({ state: "hidden", timeout: T });
      // zdtp persists the open mirror and visibility intent separately; wait for both
      // to read closed (prefix-agnostic: pack namespaces add a suffix).
      await page.waitForFunction(() => {
        const keys = Object.keys(localStorage);
        return !keys.some((k) => k.endsWith("-open")) && keys.filter((k) => k.endsWith(":visible")).every((k) => localStorage.getItem(k) === "0");
      }, null, { timeout: T });
    };
    const waitVar = (value) => page.waitForFunction(([v, want]) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() === want, [VAR, value], { timeout: T });
    await page.goto(url(docsPage), { waitUntil: "load" });
    await islandsMounted(page);
    await pickTheme(page, "Light");
    const defaultValue = await readVar();
    const scriptsBefore = new Set(scripts);
    await check("DTP: trigger opens exactly one panel (zdtp lazy-loaded on first open)", async () => {
      assert(await shells() === 0, "panel shell present before first open");
      await open();
      assert(await shells() === 1, `shells=${await shells()}`);
      const loaded = [...scripts].filter((s) => !scriptsBefore.has(s));
      return `1 shell; chunks loaded on open: ${loaded.join(", ") || "(none new)"}`;
    });
    await check("DTP: editing a token applies it to the document", async () => {
      await page.getByRole("tab", { name: /^Spacing\b/ }).click();
      await input().fill("3");
      await waitVar("3rem");
      return `${VAR}: ${defaultValue} -> 3rem`;
    });
    await check("DTP: override persists across a hard reload with the panel closed (no click)", async () => {
      await close();
      await page.reload({ waitUntil: "load" });
      await waitVar("3rem");
      assert(await page.locator(SHELL).isHidden(), "panel auto-opened after reload");
      await open();
      await page.getByRole("tab", { name: /^Spacing\b/ }).click();
      const value = await input().inputValue();
      assert(value === "3", `row shows ${value}`);
      assert(await shells() === 1, `shells=${await shells()}`);
      return "3rem re-applied before any click; row shows 3; 1 shell";
    });
    await check("DTP: reconfiguration on color-scheme change keeps one open panel; override restored on return", async () => {
      await pickTheme(page, "Dark");
      await page.waitForTimeout(0);
      await page.locator(SHELL).waitFor({ state: "visible", timeout: T });
      await page.waitForFunction((sel) => document.querySelectorAll(sel).length === 1, SHELL, { timeout: T });
      const darkValue = await readVar();
      await pickTheme(page, "Light");
      await page.locator(SHELL).waitFor({ state: "visible", timeout: T });
      await waitVar("3rem");
      const n = await shells();
      assert(n === 1, `shells=${n}`);
      return `dark-mode ${VAR}=${darkValue}; back to light -> 3rem; shells=1`;
    });
    const packLauncher = page.getByRole("button", { name: "Theme pack switcher", exact: true });
    await check("DTP: reconfiguration on theme-pack switch hides pack A override, restores it on return", async () => {
      await close();
      assert(await packLauncher.count() === 1, "theme pack launcher missing");
      const flyout = page.getByRole("dialog", { name: "Theme pack switcher", exact: true });
      const openFlyout = async () => {
        for (let i = 0; i < 10 && !(await flyout.isVisible()); i++) { await packLauncher.click(); await page.waitForTimeout(200); }
        await flyout.waitFor({ state: "visible", timeout: T });
      };
      const packAttr = () => page.evaluate(() => document.documentElement.getAttribute("data-theme-pack"));
      const startPack = await packAttr();
      await openFlyout();
      await page.getByRole("button", { name: "Next theme pack" }).click();
      await page.waitForFunction((p) => document.documentElement.getAttribute("data-theme-pack") !== p, startPack, { timeout: T });
      const other = await packAttr();
      await page.waitForFunction(([v]) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() !== "3rem", [VAR], { timeout: T });
      const otherValue = await readVar();
      await page.getByRole("button", { name: "Previous theme pack" }).click();
      await page.waitForFunction((p) => document.documentElement.getAttribute("data-theme-pack") === p, startPack, { timeout: T });
      await waitVar("3rem");
      await page.keyboard.press("Escape");
      return `${startPack}=3rem -> ${other}=${otherValue} -> ${startPack}=3rem`;
    });
    await check("DTP: close/reopen lifecycle and client navigation never duplicate the mount", async () => {
      const counts = [];
      for (let i = 0; i < 3; i++) {
        await open();
        counts.push(await shells());
        await close();
        counts.push(await shells());
      }
      await open();
      await navigate(page, '#desktop-sidebar a[href$="/getting-started/installation/"], #desktop-sidebar a[href$="/getting-started/installation"]');
      await page.locator(SHELL).waitFor({ state: "visible", timeout: T });
      counts.push(await shells());
      await close();
      await open();
      counts.push(await shells());
      assert(counts.every((n) => n <= 1) && counts.at(-1) === 1, `shell counts ${counts.join(",")}`);
      await page.getByRole("tab", { name: /^Spacing\b/ }).click();
      await page.getByTestId("tier-item-hsp-lg").getByRole("button", { name: `Revert ${VAR}`, exact: true }).click();
      await waitVar(defaultValue);
      return `shell counts ${counts.join(",")}; reverted to ${defaultValue}`;
    });
    await ctx.close();
  }

  // 6. i18n route (all-feature only).
  if (ALL) {
    const { ctx, page } = await newPage();
    await page.goto(url("ja/docs/getting-started/"), { waitUntil: "load" });
    await check("i18n: /ja/ route hydrates with lang=ja", async () => {
      const lang = await page.evaluate(() => document.documentElement.lang);
      assert(lang === "ja", `lang=${lang}`);
      return `${(await islandsMounted(page)).length} islands`;
    });
    await ctx.close();
  }
} else {
  // Non-root control: assets, navigation and search under the mounted base.
  const { ctx, page } = await newPage();
  await page.goto(url(docsPage), { waitUntil: "load" });
  await check(`mount ${BASE_PATH}: assets resolve under the base and islands mount`, async () => {
    const names = await islandsMounted(page);
    const assets = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"], script[src]')].map((e) => e.getAttribute("href") ?? e.getAttribute("src")));
    const outside = assets.filter((a) => a.startsWith("/") && !a.startsWith(BASE_PATH));
    assert(outside.length === 0, `assets outside base: ${outside.join(", ")}`);
    return `${assets.length} stylesheet/script refs under base; ${names.length} islands`;
  });
  await check(`mount ${BASE_PATH}: sidebar navigation stays under the base`, async () => {
    const how = await navigate(page, '#desktop-sidebar a[href$="/getting-started/installation/"], #desktop-sidebar a[href$="/getting-started/installation"]');
    assert(new URL(page.url()).pathname.startsWith(`${BASE_PATH}docs/getting-started/installation`), `url ${page.url()}`);
    return `${how}; ${new URL(page.url()).pathname}; ${(await islandsMounted(page)).length} islands`;
  });
  await check(`mount ${BASE_PATH}: search index loads and result links resolve under the base`, async () => {
    await page.keyboard.press("Control+k");
    await page.locator("[data-search-dialog]").waitFor({ state: "visible", timeout: T });
    await page.locator("[data-search-input]").fill("Introduction");
    const first = page.locator("[data-search-results] article a").first();
    await first.waitFor({ state: "visible", timeout: T });
    const href = await first.getAttribute("href");
    const abs = new URL(href, page.url());
    assert(abs.pathname.startsWith(BASE_PATH), `result outside base: ${href}`);
    const res = await fetch(abs);
    assert(res.status === 200, `${abs.pathname} -> ${res.status}`);
    await first.click();
    await page.waitForURL((u) => u.pathname === abs.pathname, { timeout: T });
    return `${href} -> 200, clicked`;
  });
  await check(`mount ${BASE_PATH}: llms.txt / agent-export page links resolve under the base`, async () => {
    const res = await fetch(url("llms.txt"));
    assert(res.status === 200, `llms.txt -> ${res.status}`);
    const links = [...(await res.text()).matchAll(/\]\((\/[^)]+)\)/g)].map((m) => m[1]);
    assert(links.length > 0, "no links in llms.txt");
    const statuses = await Promise.all(links.slice(0, 5).map(async (l) => `${l} -> ${(await fetch(`${ORIGIN}${l}`)).status}`));
    const manifest = `${BASE_PATH}agent/v1/manifest.json -> ${(await fetch(url("agent/v1/manifest.json"))).status}`;
    assert(statuses.every((s) => s.endsWith(" 200")) && manifest.endsWith(" 200"), [manifest, ...statuses].join("; "));
    return `${links.length} links; ${manifest}`;
  });
  await check(`mount ${BASE_PATH}: header site-name link returns to the base home`, async () => {
    await page.goto(url(docsPage), { waitUntil: "load" });
    const home = page.locator(`header a[href="${BASE_PATH}"], header a[href="${BASE_PATH.slice(0, -1)}"]`);
    assert(await home.count() > 0, `no header link to ${BASE_PATH}`);
    const href = await home.first().getAttribute("href");
    assert(href.startsWith(BASE_PATH), `site link ${href}`);
    const res = await fetch(new URL(href, page.url()));
    assert(res.status === 200, `${href} -> ${res.status}`);
    return `${href} -> 200`;
  });
  await ctx.close();
}

await browser.close();

results.push({ name: "no console errors or page errors", pass: consoleErrors.length === 0, detail: consoleErrors.slice(0, 5).join(" || ") || "0" });
results.push({ name: "no failed same-origin requests", pass: failedRequests.length === 0, detail: failedRequests.slice(0, 5).join(" || ") || "0" });

// ── teardown proof ──────────────────────────────────────────────────────────
try { process.kill(-server.pid, "SIGTERM"); } catch {}
const killDeadline = Date.now() + 10_000;
while (groupMembers(server.pid).length && Date.now() < killDeadline) await new Promise((r) => setTimeout(r, 200));
let forced = false;
if (groupMembers(server.pid).length) { forced = true; try { process.kill(-server.pid, "SIGKILL"); } catch {} await new Promise((r) => setTimeout(r, 500)); }
const survivors = groupMembers(server.pid);
// This harness and its launchers (heavy-guard and its watcher subshells) carry
// the served dir in their argv; exclude them, everything else is a leak.
const ancestors = new Set();
for (let pid = process.pid; pid > 1;) {
  ancestors.add(pid);
  try { pid = Number(readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ")[1]); } catch { break; }
}
const holders = [...cwdHolders(serverCwd).filter((p) => !ancestors.has(Number(p))), ...execFileSync("ps", ["-eo", "pid=,args="]).toString().split("\n")
  .map((l) => l.trim()).filter((l) => l.includes(serverCwd) && !ancestors.has(Number(l.split(" ")[0])) && !l.includes(fileURLToPath(import.meta.url)))];
const free = await portFree();
let refused = false;
try { await fetch(url("")); } catch { refused = true; }
const teardown = { serverTreeWhileRunning: serverTree, signal: forced ? "SIGTERM then SIGKILL" : "SIGTERM", survivorsInProcessGroup: survivors, processesWithCwdOrArgsInServedDir: holders, portFree: free, connectionRefused: refused };
results.push({ name: "teardown: server process group gone, port free", pass: survivors.length === 0 && holders.length === 0 && free && refused, detail: JSON.stringify(teardown) });

const report = { mode, kind: KIND, base: BASE_PATH, port: PORT, chromium: chromiumVersion, scripts: [...scripts].sort(), results, consoleErrors, failedRequests, teardown };
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2));
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  -- ${r.detail}` : ""}`);
console.log(`chromium ${chromiumVersion}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
