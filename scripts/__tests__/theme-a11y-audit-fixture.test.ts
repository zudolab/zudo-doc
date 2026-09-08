/**
 * Rendered-fixture proof for `scripts/theme-a11y-audit.ts`: two tiny static
 * pages — one shaped like a leaf doc page, one like a root category page —
 * driven end-to-end through the real audit CLI. They prove three contracts
 * without depending on the state of the real theme packs:
 *
 *   1. a clean site exits 0 with coverage satisfied on BOTH pages;
 *   2. a real contrast FAIL gates (exit 1) — "a finding is DATA";
 *   3. a required group missing on ONE page gates as a coverage error, which is
 *      the single-page blind spot #4033 closed (auditing only the leaf page
 *      asserted nothing about `header-nav-active`, which only the root category
 *      page renders).
 *
 * The fixture is served at the REAL audited paths, not at `/`, because the
 * coverage contract is keyed per page — a fixture at `/` would assert no
 * requirements at all.
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
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PAGE_ADMONITIONS, PAGE_GETTING_STARTED } from "../theme-a11y-evaluator";

const GATED = Boolean(process.env.THEME_A11Y_FIXTURE_TEST);

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL("../theme-a11y-audit.ts", import.meta.url));

const THEME_PACKS_INDEX = JSON.stringify({ schemaVersion: 1, packs: [{ slug: "default" }] });

const HEAD = `<!doctype html>
<html lang="en" data-theme-pack="default" data-theme="light">
<head><meta charset="utf-8"><title>fixture</title>
<style>
  body { background:#ffffff; color:#111111; font: 16px/1.5 system-ui, sans-serif; margin:0; }
  a { color:#0b5cad; }
  header, aside, nav, main, footer { padding: 8px; display:block; }
  pre { background:#f4f4f4; padding:8px; }
</style>
</head>
<body>`;

/**
 * The leaf-page shape: its top-level nav item is a DROPDOWN (so the plain
 * `header-nav-active` group is legitimately empty here) and its active sidebar
 * node is a LEAF (`data-nav-active`). Holds every group the admonitions page's
 * contract requires. When `failing`, one extra paragraph is near-invisible
 * (#dddddd on white) → a real FAIL.
 */
function admonitionsHtml(failing: boolean): string {
  const admon = (variant: string): string =>
    `<div data-admonition="${variant}" class="admonition admonition-${variant}">
       <p class="admonition-title">${variant}</p>
       <div class="admonition-body"><p>Body text for the ${variant} callout.</p></div>
     </div>`;
  const failingP = failing
    ? `<p style="color:#dddddd">This paragraph is deliberately low-contrast and must FAIL.</p>`
    : "";
  return `${HEAD}
  <header data-header>
    <a data-header-logo href="/" aria-hidden="true">LOGO</a>
    <a data-nav-item href="/docs/getting-started/">Getting Started</a>
    <a data-nav-item href="/b">Guides</a>
    <a data-nav-item href="/d">Reference</a>
    <div data-nav-item data-nav-item-dropdown><a href="/docs/components/" aria-current="page">Components</a></div>
  </header>
  <nav aria-label="Breadcrumb">
    <ol><li><a href="/">Home</a></li><li><span>Admonitions</span></li></ol>
  </nav>
  <aside id="desktop-sidebar">
    <a href="/x">Intro</a>
    <a href="/y">Setup</a>
    <a href="/z" aria-current="page" data-nav-active>Admonitions</a>
    <a href="/w">More</a>
  </aside>
  <nav data-zd-toc>
    <a href="#note" aria-current="true">Note</a>
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
      <pre class="hi-root"><code>const admonition = "note";</code></pre>
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

/**
 * The root-category-page shape: a PLAIN active top-level nav item (the only
 * source of `header-nav-active`) and an active sidebar ROOT, which carries
 * `aria-current="page"` WITHOUT `data-nav-active`. It has no TOC, breadcrumb,
 * admonitions or code — exactly like the real page, which is why the contract
 * is per page. `navActive: false` drops the `aria-current` from the nav item,
 * simulating the markup drift the coverage check must catch.
 */
function gettingStartedHtml(opts: { navActive: boolean }): string {
  const current = opts.navActive ? ' aria-current="page"' : "";
  return `${HEAD}
  <header data-header>
    <a data-header-logo href="/" aria-hidden="true">LOGO</a>
    <a data-nav-item href="/docs/getting-started/"${current}>Getting Started</a>
    <a data-nav-item href="/b">Guides</a>
    <a data-nav-item href="/d">Reference</a>
  </header>
  <aside id="desktop-sidebar">
    <a href="/docs/getting-started/" aria-current="page">Getting Started</a>
    <a href="/docs/getting-started/installation/">Installation</a>
    <a href="/docs/getting-started/introduction/">Introduction</a>
    <a href="/docs/getting-started/writing-docs/">Writing Docs</a>
  </aside>
  <main>
    <h1>Getting Started</h1>
    <article class="zd-content">
      <p>A category landing page: no TOC, no breadcrumb, no admonitions.</p>
    </article>
  </main>
  <nav data-doc-pager>
    <a href="/next">Next</a>
  </nav>
  <footer data-footer><a href="/about">About</a></footer>
</body>
</html>`;
}

interface SiteOptions {
  /** Inject a real contrast FAIL into the admonitions page. */
  failingContrast?: boolean;
  /** Drop `aria-current` from the getting-started nav item (coverage gap). */
  gettingStartedNavActive?: boolean;
}

function writeSite(root: string, opts: SiteOptions = {}): void {
  const write = (pagePath: string, html: string): void => {
    const file = join(root, pagePath.replace(/^\/+/, ""), "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  };
  write(PAGE_ADMONITIONS, admonitionsHtml(opts.failingContrast === true));
  write(PAGE_GETTING_STARTED, gettingStartedHtml({ navActive: opts.gettingStartedNavActive !== false }));
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

interface AuditReport {
  counts: Record<string, number>;
  coverage: Array<{ pack: string; mode: string; page: string; errors: string[]; notes: string[] }>;
  unaudited: string[];
}

/**
 * Runs the audit as a child process. MUST be async `spawn`, not `spawnSync`:
 * the fixture server lives in THIS (vitest) process, so a synchronous spawn
 * would block the event loop and deadlock the audit's HTTP fetch against it.
 */
function runAudit(base: string, outDir: string): Promise<{ status: number | null; report: AuditReport | null }> {
  return new Promise((resolvePromise) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        SCRIPT_PATH,
        "--url",
        base,
        "--packs",
        "default",
        "--modes",
        "light",
        "--pages",
        `${PAGE_ADMONITIONS},${PAGE_GETTING_STARTED}`,
        "--out-dir",
        outDir,
      ],
      { cwd: REPO_ROOT, stdio: "ignore" },
    );
    const timer = setTimeout(() => child.kill("SIGKILL"), 45_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      const reportPath = join(outDir, "report.json");
      const report = existsSync(reportPath) ? (JSON.parse(readFileSync(reportPath, "utf-8")) as AuditReport) : null;
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

  it("exits 0 on a clean site (all pairs pass, both pages' coverage satisfied)", async () => {
    writeSite(tmpRoot);
    const { status, report } = await runAudit(base, join(tmpRoot, "out-pass"));
    expect(report?.coverage.flatMap((c) => c.errors)).toEqual([]);
    expect(report?.counts.FAIL).toBe(0);
    expect(status).toBe(0);
    // Both pages audited, each with a declared contract — no page is unaudited…
    expect(report?.coverage.map((c) => c.page).sort()).toEqual(
      [PAGE_ADMONITIONS, PAGE_GETTING_STARTED].sort(),
    );
    expect(report?.coverage.flatMap((c) => c.notes)).toEqual([]);
    // …but this run IS narrowed to light mode, and says so rather than letting
    // its green read as full coverage.
    expect(report?.unaudited).toEqual(["1 mode(s) UNAUDITED: dark"]);
  });

  it("exits 1 when a rendered element fails contrast", async () => {
    writeSite(tmpRoot, { failingContrast: true });
    const { status, report } = await runAudit(base, join(tmpRoot, "out-fail"));
    expect(status).toBe(1);
    expect(report?.counts.FAIL).toBeGreaterThan(0);
  });

  it("exits 1 when a required group matched ZERO on the second page only", async () => {
    writeSite(tmpRoot, { gettingStartedNavActive: false });
    const { status, report } = await runAudit(base, join(tmpRoot, "out-coverage"));
    expect(status).toBe(1);
    // Not a contrast finding — a coverage/config one, on getting-started alone.
    expect(report?.counts.FAIL).toBe(0);
    const byPage = new Map(report?.coverage.map((c) => [c.page, c.errors]));
    expect(byPage.get(PAGE_ADMONITIONS)).toEqual([]);
    expect(byPage.get(PAGE_GETTING_STARTED)?.some((e) => e.includes("header-nav-active"))).toBe(true);
  });
});
