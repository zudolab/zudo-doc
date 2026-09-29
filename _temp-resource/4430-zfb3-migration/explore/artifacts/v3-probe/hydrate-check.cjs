const { chromium } = require(process.env.HOME + "/.claude/skills/headless-browser/node_modules/playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const logs = []; p.on("console", m => logs.push(m.type() + ": " + m.text())); p.on("pageerror", e => logs.push("pageerror: " + e.message));
  const t0 = Date.now(); await p.goto("http://localhost:48721/", { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.tocProbe === "activated", null, { timeout: 10000 }).catch(e => logs.push("activation timeout"));
  const act = Date.now() - t0;
  const before = await p.evaluate(() => ({ items: document.querySelectorAll('[data-zfb-island="TocToggle"] li').length, pressed: document.querySelector('[data-zfb-island="TocToggle"] button').getAttribute("aria-pressed"), label: document.querySelector('[data-zfb-island="TocToggle"] button').getAttribute("aria-label") }));
  await p.click('[data-zfb-island="TocToggle"] button');
  await p.waitForTimeout(200);
  const after = await p.evaluate(() => ({ items: document.querySelectorAll('[data-zfb-island="TocToggle"] li').length, pressed: document.querySelector('[data-zfb-island="TocToggle"] button').getAttribute("aria-pressed"), fallback: document.querySelector('[data-zfb-island="TocToggle"] p')?.textContent, ls: localStorage.getItem("zd-toc") }));
  await p.click('[data-zfb-island="TocToggle"] button'); await p.waitForTimeout(200);
  const again = await p.evaluate(() => document.querySelectorAll('[data-zfb-island="TocToggle"] li').length);
  const themeBtn = await p.evaluate(() => !!document.querySelector('[data-zfb-island="ThemeToggle"] button'));
  console.log(JSON.stringify({ activationMs: act, before, after, againItems: again, themeBtn, logs }, null, 1));
  await b.close();
})();
