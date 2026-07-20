/**
 * Rendered-fixture proof for `scripts/theme-a11y-audit.ts`: a tiny static page
 * (all required inventory groups present) with a KNOWN-passing variant and a
 * KNOWN-failing variant, driven end-to-end through the real audit CLI to prove
 * it returns exit 0 on a clean page and exit 1 on a real contrast FAIL. This is
 * the "a finding is DATA — it must gate" contract, proven without depending on
 * the state of the real theme packs.
 *
 * BROWSER-GATED. This launches one chromium instance per variant, so it is
 * OPT-IN via the `THEME_A11Y_FIXTURE_TEST` env var and skipped by a plain
 * `pnpm test:unit` — Playwright is intentionally excluded from b4push/pr-checks
 * (TESTING.md). Run it explicitly with:
 *   pnpm theme-a11y:test:fixture
 * (which sets the gate). Uses an ephemeral port — no fixed-port contention.
 */

import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const GATED = Boolean(process.env.THEME_A11Y_FIXTURE_TEST);

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL("../theme-a11y-audit.ts", import.meta.url));

const THEME_PACKS_INDEX = JSON.stringify({ schemaVersion: 1, packs: [{ slug: "default" }] });

/** A static page holding every coverage-required group. When `failing`, one
 *  extra paragraph is near-invisible (#dddddd on white) → a real FAIL. */
function fixtureHtml(failing: boolean): string {
  const admon = (variant: string): string =>
    `<div data-admonition="${variant}" class="admonition admonition-${variant}">
       <p class="admonition-title">${variant}</p>
       <div class="admonition-body"><p>Body text for the ${variant} callout.</p></div>
     </div>`;
  const failingP = failing
    ? `<p style="color:#dddddd">This paragraph is deliberately low-contrast and must FAIL.</p>`
    : "";
  return `<!doctype html>
<html lang="en" data-theme-pack="default" data-theme="light">
<head><meta charset="utf-8"><title>fixture</title>
<style>
  body { background:#ffffff; color:#111111; font: 16px/1.5 system-ui, sans-serif; margin:0; }
  a { color:#0b5cad; }
  header, aside, nav, main, footer { padding: 8px; display:block; }
</style>
</head>
<body>
  <header data-header>
    <a data-header-logo href="/" aria-hidden="true">LOGO</a>
    <a data-nav-item href="/a">Docs</a>
    <a data-nav-item href="/b">Guides</a>
    <a data-nav-item href="/c" aria-current="page">Components</a>
    <a data-nav-item href="/d">Reference</a>
  </header>
  <nav aria-label="Breadcrumb"><a href="/">Home</a> / <li><span>Admonitions</span></li></nav>
  <aside id="desktop-sidebar">
    <a href="/x">Intro</a>
    <a href="/y">Setup</a>
    <a href="/z" aria-current="page" data-nav-active>Admonitions</a>
    <a href="/w">More</a>
  </aside>
  <nav data-zd-toc>
    <a href="#note">Note</a>
    <a href="#tip">Tip</a>
    <a href="#info">Info</a>
    <a href="#warning">Warning</a>
  </nav>
  <main>
    <h1>Admonitions</h1>
    <article class="zd-content">
      <h2 id="note">Note</h2>
      <p>Regular readable body text on a white surface.</p>
      <p>Another paragraph with a <a href="/link">content link</a> inside it.</p>
      ${failingP}
      ${["note", "tip", "info", "warning", "danger"].map(admon).join("\n")}
    </article>
  </main>
  <nav data-doc-pager>
    <a href="/prev">Previous</a>
    <a href="/next">Next</a>
  </nav>
  <footer data-footer><a href="/about">About</a></footer>
</body>
</html>`;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function startFixtureServer(root: string): Promise<{ server: Server; base: string }> {
  const server = createServer((req, res) => {
    let rel = (req.url ?? "/").split("?")[0] ?? "/";
    if (rel === "/" || rel.endsWith("/")) rel = `${rel}index.html`;
    const filePath = join(root, rel.replace(/^\/+/, ""));
    if (!existsSync(filePath)) {
      res.statusCode = 404;
      res.end("nf");
      return;
    }
    res.setHeader("Content-Type", MIME[extname(filePath)] ?? "application/octet-stream");
    createReadStream(filePath).pipe(res);
  });
  return new Promise((resolvePromise, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("no port"));
        return;
      }
      resolvePromise({ server, base: `http://127.0.0.1:${addr.port}` });
    });
  });
}

/**
 * Runs the audit as a child process. MUST be async `spawn`, not `spawnSync`:
 * the fixture server lives in THIS (vitest) process, so a synchronous spawn
 * would block the event loop and deadlock the audit's HTTP fetch against it.
 */
function runAudit(base: string, outDir: string): Promise<{ status: number | null; report: unknown }> {
  return new Promise((resolvePromise) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", SCRIPT_PATH, "--url", base, "--packs", "default", "--modes", "light", "--page", "/", "--out-dir", outDir],
      { cwd: REPO_ROOT, stdio: "ignore" },
    );
    const timer = setTimeout(() => child.kill("SIGKILL"), 40_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      const reportPath = join(outDir, "report.json");
      const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf-8")) : null;
      resolvePromise({ status: code, report });
    });
  });
}

describe.skipIf(!GATED)("theme-a11y-audit rendered fixture (browser)", () => {
  let tmpRoot: string;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), "theme-a11y-fixture-"));
    mkdirSync(join(tmpRoot, "theme-packs"), { recursive: true });
    writeFileSync(join(tmpRoot, "theme-packs", "index.json"), THEME_PACKS_INDEX);
    const started = await startFixtureServer(tmpRoot);
    server = started.server;
    base = started.base;
  });

  afterAll(() => {
    if (server) server.close();
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("exits 0 on a clean page (all pairs pass, coverage satisfied)", async () => {
    writeFileSync(join(tmpRoot, "index.html"), fixtureHtml(false));
    const outDir = join(tmpRoot, "out-pass");
    const { status, report } = await runAudit(base, outDir);
    expect(status).toBe(0);
    expect((report as { counts: { FAIL: number } }).counts.FAIL).toBe(0);
  });

  it("exits 1 when a rendered element fails contrast", async () => {
    writeFileSync(join(tmpRoot, "index.html"), fixtureHtml(true));
    const outDir = join(tmpRoot, "out-fail");
    const { status, report } = await runAudit(base, outDir);
    expect(status).toBe(1);
    expect((report as { counts: { FAIL: number } }).counts.FAIL).toBeGreaterThan(0);
  });
});
