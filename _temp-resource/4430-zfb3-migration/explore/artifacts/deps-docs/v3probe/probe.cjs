const { chromium } = require("$HOME/repos/myoss/zudo-doc/node_modules/.pnpm/@playwright+test@1.58.2/node_modules/@playwright/test");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); });
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  for (let i = 0; i < 30; i++) { try { await p.goto("http://localhost:48731/"); break; } catch { await new Promise(r => setTimeout(r, 500)); } }
  await p.waitForFunction(() => { const el = document.querySelector("[data-zdtp-probe]"); return el && el.textContent !== "idle"; }, null, { timeout: 15000 }).catch(() => {});
  const status = await p.evaluate(() => document.querySelector("[data-zdtp-probe]")?.textContent);
  const cfg = await p.evaluate(async () => {
    const m = window.__zdtpProbe; if (!m) return "no module";
    return Object.keys(m).filter(k => /configure|mount|toggle/i.test(k)).join(",");
  });
  console.log(JSON.stringify({ status, cfg, errs: errs.slice(0, 10) }, null, 1));
  await b.close();
})().catch(e => { console.error("probe failed", e.message); process.exit(1); });
