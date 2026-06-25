// A2 #2363 — Build-time proof: package-owned injected routes render correct HTML.
//
// Strategy: "dedicated, minimal build test" (preferred per the issue's
// Clarification over a full e2e fixture). The test:
//
//   1. Copies the committed fixture source to a temp directory.
//   2. Creates `node_modules` + `pages/` symlinks so `zfb build` resolves
//      the workspace packages and has the correct pages topology.
//   3. Runs `zfb build` with SKIP_DOC_HISTORY=1 (no git; fast).
//   4. Asserts rendered HTML **content**, not just HTTP-200.
//
// Two cases are covered:
//
//   (A) No-stub: `pages/` is empty — the injected routes own the URL.
//       Static: /404 → asserts "Page Not Found" from the package 404 entrypoint.
//       Dynamic: /docs/getting-started → asserts page title from the MDX doc.
//
//   (B) Precedence: `pages/404.tsx` stub collides with the injected /404 route —
//       Decision 6 (ADR): the user's pages/ wins. Asserts STUB-WINS-UNIQUE-MARKER
//       appears in dist/404.html and the package default text does NOT appear.
//
// The test timeout is intentionally generous (180s): a cold `zfb build` including
// Tailwind compilation runs in ~30s on a warm machine; 180s provides CI headroom.

import { describe, it, expect, afterAll } from "vitest";
import { execSync, type ExecSyncOptions } from "node:child_process";
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** The committed fixture source (config, content, stubs — no node_modules). */
const FIXTURE_SRC = resolve(__dirname, "fixtures/route-injection");

// Resolve to the workspace/worktree root that owns the node_modules for this
// package. From packages/zudo-doc/src/__tests__/ we go up 4 levels:
//   __tests__ → src → zudo-doc → packages → repo-root (or worktrees/X)
// Using the local node_modules (not a parent) is essential: the symlinked
// @takazudo/zudo-doc there points at THIS package's dist/, so createRequire
// inside the routes plugin resolves routes to the correct package when building.
const WORKSPACE_ROOT = resolve(__dirname, "../../../../");

/** All temp build dirs created by this test — cleaned up in afterAll. */
const tempDirs: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temporary copy of the fixture, set up node_modules + pages symlinks,
 *  and write an empty `.zfb/doc-history-meta.json` seed so zfb can resolve the
 *  `#doc-history-meta` import on the first run. Returns the temp dir path. */
function setupFixture(options: { emptyPages?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-route-proof-"));
  tempDirs.push(dir);

  // Copy committed fixture source (config, content, zfb.config.ts, tsconfig.json).
  cpSync(FIXTURE_SRC, dir, { recursive: true });

  // node_modules: symlink to the workspace root so @takazudo/zudo-doc resolves.
  symlinkSync(join(WORKSPACE_ROOT, "node_modules"), join(dir, "node_modules"));

  // pages/: set up as directed by the caller.
  if (options.emptyPages) {
    // No-stub case: empty pages/ directory → all routes come from the injected plugin.
    mkdirSync(join(dir, "pages"));
  } else {
    // Precedence case: copy pages-stubs/ as pages/ so the 404 stub collides.
    cpSync(join(FIXTURE_SRC, "pages-stubs"), join(dir, "pages"), { recursive: true });
  }

  // .zfb/doc-history-meta.json seed (required by #doc-history-meta import in the
  // bundler even when SKIP_DOC_HISTORY=1 disables all git calls).
  mkdirSync(join(dir, ".zfb"), { recursive: true });
  writeFileSync(join(dir, ".zfb/doc-history-meta.json"), "{}");

  return dir;
}

/** Run `zfb build` in the given directory, throwing on non-zero exit.
 *
 * Uses `./node_modules/.bin/zfb` (the workspace-local binary) rather than a
 * globally-installed `zfb`. The global binary (if present) may be an older
 * version that rejects `injectRoute` during builds; the local binary
 * (0.1.0-next.62+) supports build-time route injection.
 */
function runZfbBuild(dir: string, outDir = "dist"): void {
  const opts: ExecSyncOptions = {
    cwd: dir,
    env: {
      ...process.env,
      // Skip git-history calls — no git repo in the temp dir.
      SKIP_DOC_HISTORY: "1",
    },
    // Surface build errors in test output rather than hiding them.
    stdio: "pipe",
    encoding: "utf-8",
  };
  try {
    execSync(`./node_modules/.bin/zfb build --outdir ${outDir}`, opts);
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      `zfb build failed in ${dir}:\n${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`,
    );
  }
}

/** Read a built HTML file from the dist/ output and return its content. */
function readBuiltHtml(dir: string, path: string): string {
  const fullPath = join(dir, "dist", path);
  if (!existsSync(fullPath)) {
    throw new Error(`Built HTML file not found: ${fullPath}`);
  }
  return readFileSync(fullPath, "utf-8");
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterAll(() => {
  for (const dir of tempDirs) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// Case A — No-stub: injected routes own the URL (the mandatory case).
// ---------------------------------------------------------------------------

describe("A2 no-stub: injected routes render correct HTML (packageOwnedRoutes:true, empty pages/)", () => {
  let fixtureDir: string;

  it("setup: fixture builds successfully with empty pages/", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    // Should not throw — failure message includes the build output.
    runZfbBuild(fixtureDir);
  });

  it("static: /404 HTML contains package-default 'Page Not Found' (not a stub)", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    // Package's 404 entrypoint (routes/404.tsx) renders this heading.
    expect(html).toContain("Page Not Found");
    // Must NOT contain the stub marker — stub is absent in the no-stub case.
    expect(html).not.toContain("STUB-WINS-UNIQUE-MARKER");
  });

  it("static: /404 HTML contains the site name from the route-context virtual module", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    // The chrome (_chrome.tsx) builds the <title> using composeMetaTitle(settings.siteName).
    // settings.siteName = "Route Injection Proof" → appears in <title>.
    expect(html).toContain("Route Injection Proof");
  });

  it("dynamic: /docs/getting-started/ HTML contains the MDX page title", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    // The docs-slug.tsx route enumerates the 'docs' collection via paths()
    // and renders through renderDocPage → the page title appears in the output.
    expect(html).toContain("Getting Started");
  });

  it("dynamic: /docs/getting-started/ HTML contains the MDX content body", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    // The MDX source includes this phrase; renderDocPage renders it into the HTML.
    expect(html).toContain("injected-route-render-proof");
  });
});

// ---------------------------------------------------------------------------
// Case B — Precedence: stub wins when pages/404.tsx collides (Decision 6).
// ---------------------------------------------------------------------------

describe("A2 precedence: pages/ stub wins over injected route when both claim the same URL", () => {
  let fixtureDir: string;

  it("setup: fixture builds successfully with pages/404.tsx stub present", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: false });
    // Should not throw.
    runZfbBuild(fixtureDir);
  });

  it("precedence: dist/404.html contains the stub's unique marker, not the package default", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    // The stub pages/404.tsx outputs this unique marker in the <title> and <h1>.
    expect(html).toContain("STUB-WINS-UNIQUE-MARKER");
    // The package's injected 404 text must NOT appear — stub overrides it.
    expect(html).not.toContain("Page Not Found");
  });

  it("precedence: non-colliding injected route (/docs/getting-started/) still renders", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    // No pages/docs/[[...slug]].tsx stub was added → injected route still runs.
    expect(html).toContain("Getting Started");
  });
});
