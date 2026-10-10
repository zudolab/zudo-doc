// Machine-run closeout smoke against a deployed PR preview (#4506 / #4502).
// Usage: node scripts/zfb3-parity/closeout-preview-smoke.mjs [baseUrl] [outJson]
// Run through: bash $HOME/.claude/scripts/heavy-guard.sh --wait 540 -- node <this file>
// Not an IME check: any composition line is synthetic.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "https://pr-4477-zudo-doc-preview.takazudo.workers.dev").replace(/\/$/, "");
const OUT = process.argv[3];
const results = [];
const consoleErrors = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail: detail ?? "" });
  } catch (error) {
    results.push({ name, pass: false, detail: String(error.message ?? error).split("\n")[0] });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch();
const version = browser.version();

async function newPage(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`${page.url()} :: ${msg.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${page.url()} :: pageerror ${error.message}`));
  return { context, page };
}

const T = 20_000;

// Theme toggle (desktop header)
{
  const { context, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${BASE}/docs/getting-started/`, { waitUntil: "load" });
  await check("theme toggle: dark then light changes html color scheme", async () => {
    const trigger = page.locator('header [data-zd-theme-menu] > button[aria-haspopup="menu"]:visible').first();
    await trigger.waitFor({ state: "visible", timeout: T });
    const read = () => page.evaluate(() => ({
      dataTheme: document.documentElement.dataset.theme ?? null,
      scheme: getComputedStyle(document.documentElement).colorScheme,
      bg: getComputedStyle(document.body).backgroundColor,
    }));
    const pick = async (label) => {
      await trigger.click();
      const menu = page.getByRole("menu", { name: "Appearance", exact: true });
      await menu.waitFor({ state: "visible", timeout: T });
      await menu.getByRole("menuitemradio", { name: label, exact: true }).click();
      await page.waitForFunction(
        (l) => [...document.querySelectorAll('header [data-zd-theme-menu] > button')].some((b) => b.getAttribute("aria-label") === `Appearance: ${l}`),
        label, { timeout: T });
    };
    await pick("Dark");
    const dark = await read();
    await pick("Light");
    const light = await read();
    assert(dark.bg !== light.bg, `background unchanged (${dark.bg})`);
    return `dark bg ${dark.bg} / light bg ${light.bg}`;
  });

  await check("search: Ctrl+K opens, query returns results, Escape closes", async () => {
    await page.keyboard.press("Control+k");
    const dialog = page.locator("[data-search-dialog]");
    await dialog.waitFor({ state: "visible", timeout: T });
    const input = page.locator("[data-search-input]");
    await input.fill("Getting Started");
    const first = page.locator("[data-search-results] article a").first();
    await first.waitFor({ state: "visible", timeout: T });
    const count = await page.locator("[data-search-results] article").count();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: T });
    return `${count} results`;
  });
  await context.close();
}

// Code highlighting
{
  const { context, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${BASE}/docs/markdown-features/syntax-highlighting/`, { waitUntil: "load" });
  await check("code highlighting: pre.hi-root with token spans and syntax color", async () => {
    const info = await page.evaluate(() => {
      const pre = document.querySelector("main pre.hi-root");
      if (!pre) return null;
      const colors = new Set([...pre.querySelectorAll("span")].map((s) => getComputedStyle(s).color));
      return { spans: pre.querySelectorAll("span").length, colors: colors.size };
    });
    assert(info, "no main pre.hi-root");
    assert(info.spans > 0 && info.colors > 1, `spans=${info.spans} distinct colors=${info.colors}`);
    return `${info.spans} spans, ${info.colors} distinct colors`;
  });
  await context.close();
}

// Mermaid render + enlarge
{
  const { context, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${BASE}/docs/markdown-features/mermaid/`, { waitUntil: "load" });
  await check("mermaid: renders svg", async () => {
    const svg = page.locator("[data-mermaid-rendered] svg").first();
    await svg.waitFor({ state: "attached", timeout: 40_000 });
    return "svg rendered";
  });
  await check("mermaid: enlarge opens dialog with cloned svg, Escape closes", async () => {
    const enlargeable = page.locator(".zd-mermaid-enlargeable").first();
    await enlargeable.waitFor({ state: "attached", timeout: 40_000 });
    await enlargeable.hover();
    await enlargeable.locator(".zd-enlarge-btn").click({ timeout: T });
    const dialog = page.locator("dialog.zd-mermaid-dialog");
    await dialog.waitFor({ state: "visible", timeout: T });
    assert(await dialog.locator("svg").count() > 0, "no svg in dialog");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: T });
  });
  await context.close();
}

// Image enlarge
{
  const { context, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${BASE}/docs/markdown-features/image-enlarge/`, { waitUntil: "load" });
  await check("image enlarge: button opens dialog with image, Escape closes", async () => {
    const figure = page.locator("figure.zd-enlargeable").first();
    await figure.waitFor({ state: "attached", timeout: T });
    await figure.scrollIntoViewIfNeeded();
    const btn = figure.locator(".zd-enlarge-btn");
    await btn.waitFor({ state: "attached", timeout: T });
    await figure.hover();
    await btn.click({ timeout: T });
    const dialog = page.locator("dialog.zd-enlarge-dialog");
    await dialog.waitFor({ state: "visible", timeout: T });
    assert(await dialog.locator("img").count() > 0, "no img in dialog");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: T });
  });
  await context.close();
}

// Doc history dropdown
{
  const { context, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${BASE}/docs/getting-started/`, { waitUntil: "load" });
  await check("doc history: trigger opens revision dialog with revisions", async () => {
    const trigger = page.locator('[aria-label="View document history"]');
    await trigger.waitFor({ state: "visible", timeout: T });
    await trigger.click();
    const panel = page.locator('dialog[aria-label="Document revision history"]');
    await panel.waitFor({ state: "visible", timeout: T });
    const rows = panel.locator('[aria-label^="Select revision"]');
    await rows.first().waitFor({ state: "attached", timeout: T });
    return `${await rows.count()} revision controls`;
  });
  await context.close();
}

// Mobile drawer (+ appearance menu inside it)
{
  const { context, page } = await newPage({ width: 390, height: 844 });
  await page.goto(`${BASE}/docs/getting-started/`, { waitUntil: "load" });
  await check("mobile menu: hamburger opens drawer", async () => {
    const hamburger = page.locator('button[aria-label="Open sidebar"]');
    await hamburger.waitFor({ state: "visible", timeout: T });
    let opened = false;
    for (let i = 0; i < 5 && !opened; i++) {
      await hamburger.click({ timeout: 2000 }).catch(() => {});
      opened = await page.locator('button[aria-label="Close sidebar"]').first().isVisible().catch(() => false);
      if (!opened) await page.waitForTimeout(500);
    }
    assert(opened, "drawer did not open (hamburger label never flipped)");
    const drawer = page.locator("[data-zd-mobile-sidebar]");
    await drawer.waitFor({ state: "visible", timeout: T });
    return "drawer open";
  });
  await check("mobile menu: appearance menu opens inside drawer within viewport", async () => {
    const trigger = page.locator('[data-zd-mobile-sidebar] [data-zd-theme-menu] > button[aria-haspopup="menu"]');
    await trigger.click({ timeout: T });
    const menu = page.getByRole("menu", { name: "Appearance", exact: true });
    await menu.waitFor({ state: "visible", timeout: T });
    const rect = await menu.evaluate((el) => el.getBoundingClientRect().toJSON());
    assert(rect.left >= 0 && rect.right <= 390, `menu outside viewport ${rect.left}..${rect.right}`);
    await page.keyboard.press("Escape");
  });
  await context.close();
}

// 06R scope toolbar: Broaden / Restore / branch focus (desktop)
{
  const { context, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${BASE}/docs/guides/`, { waitUntil: "load" });
  const toolbarText = async () =>
    (await page.locator("[data-sidebar-scope-toolbar]:visible").first().textContent()).replace(/\s+/g, " ").trim();
  const focusLabels = () =>
    page.locator("[data-sidebar-focus]:visible").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const url = page.url();
  const h1 = await page.locator("h1").first().textContent();
  await check("06R toolbar: Broaden reaches highest tree (Broaden disabled, Restore shown), Restore returns to configured tree", async () => {
    const broaden = page.locator("[data-sidebar-broaden]:visible").first();
    await broaden.waitFor({ state: "visible", timeout: T });
    const before = await focusLabels();
    await broaden.click();
    await page.locator("[data-sidebar-restore]:visible").first().waitFor({ state: "visible", timeout: T });
    const widened = await focusLabels();
    assert(widened.length > before.length, `broaden did not widen (${before.length} -> ${widened.length})`);
    assert(await broaden.isDisabled(), "Broaden not disabled at highest tree");
    await page.locator("[data-sidebar-restore]:visible").first().click();
    await page.waitForFunction(() => !document.querySelector("[data-sidebar-restore]") ||
      ![...document.querySelectorAll("[data-sidebar-restore]")].some((e) => e.getBoundingClientRect().width > 0), null, { timeout: T });
    assert((await focusLabels()).length === before.length, "Restore did not return to the configured tree");
    return `${before.length} -> ${widened.length} -> restored; toolbar "${await toolbarText()}"`;
  });
  await check("06R toolbar: branch focus narrows scope, shows Restore, Restore undoes; URL and article unchanged", async () => {
    const focusButtons = page.locator("[data-sidebar-focus]:visible");
    const before = await focusButtons.count();
    assert(before >= 2, `need >=2 focus buttons, got ${before}`);
    await focusButtons.nth(1).click();
    await page.locator("[data-sidebar-restore]:visible").first().waitFor({ state: "visible", timeout: T });
    const narrowed = await page.locator("[data-sidebar-focus]:visible").count();
    assert(narrowed < before, `focus did not narrow (${before} -> ${narrowed})`);
    const scoped = await toolbarText();
    await page.locator("[data-sidebar-restore]:visible").first().click();
    await page.waitForFunction((n) => [...document.querySelectorAll("[data-sidebar-focus]")].filter((e) => e.getBoundingClientRect().width > 0).length === n, before, { timeout: T });
    assert(page.url() === url, `URL changed ${url} -> ${page.url()}`);
    assert((await page.locator("h1").first().textContent()) === h1, "article heading changed");
    return `${before} -> ${narrowed} -> restored; scoped toolbar "${scoped}"`;
  });
  await context.close();
}

// Synthetic AI chat composition (labelled synthetic; NOT an IME check)
{
  const { context, page } = await newPage({ width: 1280, height: 800 });
  let submissions = 0;
  await page.route("**/api/ai-chat", async (route) => {
    submissions++;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ response: "synthetic ok" }) });
  });
  await page.goto(`${BASE}/docs/getting-started/`, { waitUntil: "load" });
  await check("SYNTHETIC AI chat: composing Enter does not submit, next Enter submits once", async () => {
    const trigger = page.locator("#ai-chat-trigger");
    if ((await trigger.count()) === 0) throw new Error("no #ai-chat-trigger on preview (AI chat not deployed here)");
    await trigger.click();
    const dialog = page.locator("dialog").filter({ hasText: "AI Assistant" });
    await dialog.waitFor({ state: "visible", timeout: T });
    const input = dialog.getByLabel("Type your message");
    await input.fill("composition");
    await input.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true }));
    });
    // Give an erroneous submit time to reach the intercepted route before asserting none happened.
    await page.waitForTimeout(500);
    assert(submissions === 0, "composing Enter submitted");
    await input.evaluate((el) => el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
    await input.press("Enter");
    await dialog.getByRole("log", { name: "Chat messages" }).locator(".ai-chat-md p").waitFor({ state: "visible", timeout: T });
    assert(submissions === 1, `submissions=${submissions}`);
  });
  await context.close();
}

await browser.close();

results.push({ name: "no console errors or page errors", pass: consoleErrors.length === 0, detail: consoleErrors.slice(0, 5).join(" || ") });

const report = { base: BASE, chromium: version, results, consoleErrors };
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2));
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  -- " + r.detail : ""}`);
console.log(`chromium ${version}; console errors: ${consoleErrors.length}`);
for (const e of consoleErrors.slice(0, 10)) console.log("  console:", e.slice(0, 200));
process.exit(results.every((r) => r.pass) ? 0 : 1);
