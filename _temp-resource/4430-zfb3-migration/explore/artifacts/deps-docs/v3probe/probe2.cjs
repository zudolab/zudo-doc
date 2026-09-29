const { chromium } = require("$HOME/repos/myoss/zudo-doc/node_modules/.pnpm/@playwright+test@1.58.2/node_modules/@playwright/test");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  for (let i = 0; i < 30; i++) { try { await p.goto("http://localhost:48732/"); break; } catch { await new Promise(r => setTimeout(r, 500)); } }
  await p.waitForFunction(() => !!window.__zdtpProbe, null, { timeout: 15000 });
  const r = await p.evaluate(async () => {
    const m = window.__zdtpProbe;
    m.configurePanel({ storagePrefix: "probe", consoleNamespace: "probe", modalClassPrefix: "probe-modal", schemaId: "probe/v1", exportFilenameBase: "probe",
      tabs: [{ id: "palette", label: "Palette", tiers: [{ id: "base", label: "Base", items: [{ id: "b0", cssVar: "--probe-b0", label: "B0", default: "oklch(98% .003 264)", type: { kind: "color", format: "oklch" } }] }] }] });
    (m.showDesignTokenPanel || m.toggleDesignPanel)();
    await new Promise(r => setTimeout(r, 1500));
    return { shell: document.querySelectorAll(".tokenpanel-shell").length, probeText: document.querySelector("[data-zdtp-probe]")?.textContent, zfbIslands: document.querySelectorAll("[data-zfb-island]").length };
  });
  console.log(JSON.stringify({ r, errs: errs.slice(0, 8) }, null, 1)); await b.close();
})().catch(e => { console.error("probe failed", e.message); process.exit(1); });
