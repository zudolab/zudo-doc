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
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Parity helpers — mirrors parity-diff.mjs normalization so hash values are
// stable across refactors that MUST NOT change rendered output. Matches the
// normalizeHtml + sha256 from scripts/parity-diff.mjs exactly.
// ---------------------------------------------------------------------------

/** Normalize content-hashed filenames to stable placeholders, matching
 *  the same substitutions used by scripts/parity-diff.mjs. */
function normalizeHtml(html: string): string {
  return html
    // Main islands bundle: /assets/islands-<hex8>.js
    .replace(/\/assets\/islands-[a-f0-9]+\.js/g, "/assets/islands-CONTENTHASH.js")
    // Chunk files: /assets/islands-chunk-<UPPERCASE8+>.js
    .replace(/\/assets\/islands-chunk-[A-Z0-9]+\.js/g, "/assets/islands-chunk-CHUNKHASH.js")
    // Styles: /assets/styles-<hex8>.css
    .replace(/\/assets\/styles-[a-f0-9]+\.css/g, "/assets/styles-CONTENTHASH.css");
}

/** SHA-256 of normalized HTML — the frozen byte-parity fingerprint. */
function sha256Html(html: string): string {
  return createHash("sha256").update(normalizeHtml(html), "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** The committed fixture source (config, content, stubs — no node_modules). */
const FIXTURE_SRC = resolve(__dirname, "fixtures/route-injection");

/** i18n variant fixture (one non-default locale `ja`) — used by the no-src test
 *  to exercise the locale-prefixed injected route (`/[locale]/docs/[[...slug]]`). */
const FIXTURE_I18N_SRC = resolve(__dirname, "fixtures/route-injection-i18n");

/** The `@takazudo/zudo-doc` package root (…/packages/zudo-doc). */
const PKG_ROOT = resolve(__dirname, "../..");

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

  // #2406 / #2401(c): the package-default BodyEndIslands replaces the old no-op
  // BodyEndIslandsStub. The route-injection fixture ships aiAssistant /
  // imageEnlarge / mermaid OFF, so NO island marker (and no AI-assistant
  // landmark) must reach the SSG output — the feature-off gating end-to-end.
  it("body-end islands: /404 HTML has NO island markers when the flags are off", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    expect(html).not.toContain("data-zfb-island-skip-ssr");
    expect(html).not.toContain('data-zfb-island-skip-ssr="AiChatModal"');
    expect(html).not.toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    expect(html).not.toContain('data-zfb-island-skip-ssr="MermaidEnlarge"');
    expect(html).not.toContain("AI Assistant");
  });

  // ---------------------------------------------------------------------------
  // PKGWIRE #2425 — byte-parity: stub-defaults path renders byte-identically.
  // ---------------------------------------------------------------------------
  // Locks normalized-HTML SHA-256 fingerprints for the package-owned route path
  // where `createChrome(context)` is called with stub-default `hostBindings`
  // (i.e. no host overrides). These hashes guard against accidental regressions
  // in FACTORIES #2424 or later refactors: any change to rendered output must
  // produce a visible hash diff and be deliberately reviewed before updating.
  //
  // normalization: content-hashed asset filenames are replaced with stable
  // placeholders (matching scripts/parity-diff.mjs) so the fingerprint survives
  // refactors that only change build hashes.
  //
  // To update: run `vitest run --update-snapshots`, inspect the diff, and
  // confirm the output delta is intentional before committing.

  it("parity: /404.html normalized-HTML sha256 is stable (stub-defaults path)", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    expect(sha256Html(html)).toMatchInlineSnapshot(`"93883eceb7749d14c01dcc441eee88fa7ada69dc242cdb6e2a9f1273bb91321c"`);
  });

  it("parity: /docs/getting-started/index.html normalized-HTML sha256 is stable (stub-defaults path)", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(sha256Html(html)).toMatchInlineSnapshot(`"ded6dfa7280a9ac4e91a3871e1334dde0175bb131d71a7a868ce47cb4e0f5e57"`);
  });
});

// ---------------------------------------------------------------------------
// Case A2 — Package-island markers ON: flipping the serializable settings flags
//           emits the package-default BodyEndIslands island markers in the SSG
//           HTML of a package-owned route (#2406 / #2401(c)). imageEnlarge +
//           mermaid are enabled (NOT aiAssistant — that would inject the
//           /api/ai-chat route, irrelevant here); the focused unit test
//           (src/doc-body-end-islands/__tests__) covers the aiAssistant marker.
// ---------------------------------------------------------------------------

/** Flip the package-island flags ON in a fixture's settings.ts (it ships them
 *  OFF) so the route-context virtual module carries them true. */
function enablePackageIslands(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8")
    .replace(/imageEnlarge:\s*false/, "imageEnlarge: true")
    .replace(/mermaid:\s*false/, "mermaid: true");
  writeFileSync(settingsPath, src);
}

describe("A2 islands-on: package route HTML carries island markers when flags ON", () => {
  let fixtureDir: string;

  it("setup: fixture builds with imageEnlarge + mermaid enabled", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    enablePackageIslands(fixtureDir);
    runZfbBuild(fixtureDir);
  });

  it("islands: /404 HTML carries the ImageEnlarge skip-ssr marker + dialog shell", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    expect(html).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    expect(html).toContain("zd-enlarge-dialog");
  });

  it("islands: /404 HTML carries the MermaidEnlarge skip-ssr marker + dialog shell", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    expect(html).toContain('data-zfb-island-skip-ssr="MermaidEnlarge"');
    expect(html).toContain("zd-mermaid-dialog");
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

// ---------------------------------------------------------------------------
// Case C — NO-`src/` (published-package shape): the resolver picks `routes-src/`
//          (S1 #2370). This is the gap that let #2368 ship — Case A/B above use
//          a SYMLINK to the in-repo package (whose realpath has `src/` AND lands
//          OUTSIDE node_modules), so they could never prove the published shape.
//
// This case builds the package via `npm pack`, extracts the tarball into the
// fixture's `node_modules/@takazudo/zudo-doc` as a REAL directory (the exact
// published file set: includes `routes-src/`, EXCLUDES `src/`), and symlinks
// every OTHER workspace dep (incl. `@takazudo/zfb*`) so the build resolves.
// It asserts BOTH a plain dynamic route AND a `/[locale]/...` dynamic route
// render — the latter exercises the `locale-docs-slug` routes-src path and the
// staging fix for the node_modules virtual-module gap (see plugins/routes.ts).
// ---------------------------------------------------------------------------

/** `npm pack` the package → return the absolute tarball path (in a fresh temp
 *  dir tracked for cleanup). `npm pack` runs the package `prepack` guards, so a
 *  build that skipped `copy-routes-src.mjs` fails here loudly. */
function packPackage(): string {
  const packDir = mkdtempSync(join(tmpdir(), "zudo-doc-pack-"));
  tempDirs.push(packDir);
  // Do NOT parse `--json` stdout — the prepack guards print to stdout and
  // pollute it. Pack to a known dir and find the produced .tgz instead.
  execSync(`npm pack --pack-destination "${packDir}"`, {
    cwd: PKG_ROOT,
    stdio: "pipe",
    encoding: "utf-8",
  });
  const tgz = readdirSync(packDir).find((f) => f.endsWith(".tgz"));
  if (!tgz) throw new Error(`npm pack produced no .tgz in ${packDir}`);
  return join(packDir, tgz);
}

/** Set up a no-`src/` fixture from `fixtureSrc`: extract the packed tarball into
 *  a REAL `node_modules/@takazudo/zudo-doc` dir, symlink every other workspace
 *  dep, empty `pages/`, seed `.zfb/`. Returns the temp fixture dir. */
function setupNoSrcFixture(fixtureSrc: string, tarballPath: string): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-nosrc-"));
  tempDirs.push(dir);
  cpSync(fixtureSrc, dir, { recursive: true });

  const wsNm = join(WORKSPACE_ROOT, "node_modules");
  const nm = join(dir, "node_modules");
  mkdirSync(nm);
  // Symlink every top-level workspace node_modules entry EXCEPT @takazudo
  // (`.bin`, `.pnpm`, preact, zod, gray-matter, … all needed at build time).
  for (const entry of readdirSync(wsNm)) {
    if (entry === "@takazudo") continue;
    symlinkSync(join(wsNm, entry), join(nm, entry));
  }
  // @takazudo: real dir; symlink every @takazudo/* EXCEPT zudo-doc.
  const scopeDir = join(nm, "@takazudo");
  mkdirSync(scopeDir);
  for (const entry of readdirSync(join(wsNm, "@takazudo"))) {
    if (entry === "zudo-doc") continue;
    symlinkSync(join(wsNm, "@takazudo", entry), join(scopeDir, entry));
  }
  // @takazudo/zudo-doc: REAL directory extracted from the tarball (npm tars
  // carry a `package/` root → --strip-components=1). This is the published file
  // set: NO `src/`, WITH `routes-src/`.
  const pkgDest = join(scopeDir, "zudo-doc");
  mkdirSync(pkgDest);
  execSync(`tar -xzf "${tarballPath}" -C "${pkgDest}" --strip-components=1`, {
    stdio: "pipe",
  });

  // Empty pages/ → injected routes own the URLs.
  mkdirSync(join(dir, "pages"));
  // .zfb seed for the #doc-history-meta import.
  mkdirSync(join(dir, ".zfb"), { recursive: true });
  writeFileSync(join(dir, ".zfb/doc-history-meta.json"), "{}");

  return dir;
}

describe("S1 no-src: published package (routes-src/, no src/) renders injected routes", () => {
  let tarballPath: string;
  let pkgDest: string;
  let fixtureDir: string;

  it("setup: pack the package and confirm the published shape (routes-src/ present, src/ absent)", { timeout: 180_000 }, () => {
    tarballPath = packPackage();
    fixtureDir = setupNoSrcFixture(FIXTURE_I18N_SRC, tarballPath);
    pkgDest = join(fixtureDir, "node_modules/@takazudo/zudo-doc");
    // The published tree must EXCLUDE src/ and INCLUDE routes-src/ — this is
    // the exact divergence that #2368 missed.
    expect(existsSync(join(pkgDest, "src"))).toBe(false);
    expect(existsSync(join(pkgDest, "routes-src"))).toBe(true);
    expect(existsSync(join(pkgDest, "routes-src/docs-slug.tsx"))).toBe(true);
    expect(existsSync(join(pkgDest, "routes-src/locale-docs-slug.tsx"))).toBe(true);
  });

  it("setup: build succeeds from the published package (no src/)", { timeout: 180_000 }, () => {
    runZfbBuild(fixtureDir);
  });

  it("dynamic: plain /docs/getting-started/ renders from routes-src/docs-slug.tsx", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).toContain("Getting Started");
    expect(html).toContain("injected-route-render-proof");
  });

  // #2390 (supersedes #2377) — the package chrome's createMdxComponentsBound
  // must wire the host-only MDX components (Details / HtmlPreview / Island) so
  // an INJECTED docs route renders them without the
  // "MDX requires '<X>' to be passed via the 'components' prop" error. This is
  // exercised through the PUBLISHED (no-`src/`, npm-packed) package, so it
  // proves a real consumer gets the refreshed routes-src wiring.
  it("mdx-components: <Details> renders a real <details>/<summary> via the injected route", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    // The summary label and collapsed body both come from the package Details.
    expect(html).toContain("DETAILS-SUMMARY-MARKER");
    expect(html).toContain("DETAILS-BODY-MARKER: details-render-proof");
  });

  it("mdx-components: <Island> SSR pass-through renders its children", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    // The package Island binding is an SSR pass-through, so the child text is
    // present in the rendered HTML.
    expect(html).toContain("ISLAND-PASSTHROUGH-MARKER: island-render-proof");
  });

  it("mdx-components: <HtmlPreview> SSR-renders (title bar + island marker)", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    // Title bar text from PreviewBase.
    expect(html).toContain("HTMLPREVIEW-TITLE-MARKER");
    // HtmlPreviewWrapper wraps the bare preview in <Island when="visible">, so
    // the SSR output carries the island marker for the inner hydration target.
    expect(html).toContain('data-zfb-island="HtmlPreviewWrapperInner"');
  });

  it("dynamic: locale /ja/docs/getting-started/ renders from routes-src/locale-docs-slug.tsx", () => {
    // The /[locale]/docs/[[...slug]] injected route — only emitted because the
    // i18n fixture configures a `ja` locale. Proves the locale-index routes-src
    // path AND the staging fix for the node_modules virtual-module gap.
    const html = readBuiltHtml(fixtureDir, "ja/docs/getting-started/index.html");
    expect(html).toContain("はじめに");
    expect(html).toContain("locale-injected-route-render-proof");
  });
});
