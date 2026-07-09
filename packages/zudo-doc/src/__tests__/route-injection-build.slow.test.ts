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
//
// ## Tier
//
// This file runs ~11 real `zfb build`s end-to-end (~220s total) plus an
// `npm pack` round trip — too slow for the default `pnpm test` / pr-checks
// package-tests lane, so it lives in the slow tier (`*.slow.test.ts`,
// excluded by packages/zudo-doc/vitest.config.ts, run via
// `pnpm --filter @takazudo/zudo-doc test:slow`, wired into
// .github/workflows/exam.yml). Mirrors the create-zudo-doc slow-tier split
// (packages/create-zudo-doc/vitest.slow.config.ts). See zudolab/zudo-doc#2530.

import { describe, it, expect, afterAll } from "vitest";
import { execSync, type ExecSyncOptions } from "node:child_process";
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Parity helpers — imported from the shared, side-effect-free module also
// used by scripts/parity-diff.mjs, so both call sites hash HTML identically
// (zudolab/zudo-doc#2530; previously hand-copied here). Loaded via dynamic
// import (not compiled by tsup, not typechecked as part of this package's
// strict `src/` program) — mirrors the gen-component-tokens.test.ts pattern
// for reaching a plain-.mjs helper from outside `src/`. `__dirname` here is
// the ambient CJS-interop global Vite/esbuild injects (used bare elsewhere
// in this file, e.g. FIXTURE_SRC below) — not a Node ESM built-in.
// ---------------------------------------------------------------------------

const { sha256Html } = await import(
  resolve(__dirname, "../../../../scripts/parity-html-normalize.mjs")
);

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
 *  `#doc-history-meta` import on the first run. Returns the temp dir path.
 *  `fixtureSrc` defaults to the single-locale `FIXTURE_SRC`; the HOME describe
 *  block below passes `FIXTURE_I18N_SRC` (symlink method, NOT `npm pack` — this
 *  stays cheap unlike the Case C `setupNoSrcFixture` helper) to exercise the
 *  `/[locale]` home route, which only exists when a locale is configured. */
function setupFixture(
  options: { emptyPages?: boolean; fixtureSrc?: string } = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-route-proof-"));
  tempDirs.push(dir);
  const fixtureSrc = options.fixtureSrc ?? FIXTURE_SRC;

  // Copy committed fixture source (config, content, zfb.config.ts, tsconfig.json).
  cpSync(fixtureSrc, dir, { recursive: true });

  // node_modules: symlink to the workspace root so @takazudo/zudo-doc resolves.
  symlinkSync(join(WORKSPACE_ROOT, "node_modules"), join(dir, "node_modules"));

  // pages/: set up as directed by the caller.
  if (options.emptyPages) {
    // No-stub case: empty pages/ directory → all routes come from the injected plugin.
    mkdirSync(join(dir, "pages"));
  } else {
    // Precedence case: copy pages-stubs/ as pages/ so the 404 stub collides.
    cpSync(join(fixtureSrc, "pages-stubs"), join(dir, "pages"), { recursive: true });
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
function runZfbBuild(dir: string, outDir = "dist"): string {
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
    // Merge stderr into stdout (2>&1) so the returned string carries BOTH streams.
    // zfb emits the island-registry warning on a SUCCESSFUL build, so callers that
    // assert on build diagnostics (the docHistory registration case) need stderr
    // too — plain execSync would drop it on success. Existing callers ignore the
    // return value, so widening void→string is backward-compatible.
    return execSync(`./node_modules/.bin/zfb build --outdir ${outDir} 2>&1`, opts) as string;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function htmlAttrPattern(name: string, value: string): RegExp {
  const attr = escapeRegExp(name);
  const escapedValue = escapeRegExp(value);
  return new RegExp(
    `\\b${attr}=(?:"${escapedValue}"|'${escapedValue}'|${escapedValue})(?=[\\s>/])`,
  );
}

function expectHtmlAttr(html: string, name: string, value: string): void {
  expect(html).toMatch(htmlAttrPattern(name, value));
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

  // CB #2501 baseline: `settings.chromeBindingsModule` is unset in this
  // fixture, so `buildFrontmatterPreviewEntries` stays at its package-default
  // `() => []` stub and the FrontmatterPreview table stays absent — the
  // un-stranding only happens when the setting is explicitly configured (see
  // the "CB chrome-bindings" describe block below).
  it("bindings (baseline): /docs/getting-started/ HTML has NO FrontmatterPreview table when chromeBindingsModule is unset", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).not.toMatch(htmlAttrPattern("data-testid", "frontmatter-preview"));
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
    expect(sha256Html(html)).toMatchInlineSnapshot(`"747a02deee65b2ce66003ba70f694091da85c8ea62718a4997ae8046cb2d9cb1"`);
  });

  it("parity: /docs/getting-started/index.html normalized-HTML sha256 is stable (stub-defaults path)", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(sha256Html(html)).toMatchInlineSnapshot(`"de951109913d398101a3f40401f3fa5d537df657e7019eebac8d5b3ea4b4efbb"`);
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
    expectHtmlAttr(html, "data-zfb-island-skip-ssr", "ImageEnlarge");
    expect(html).toContain("zd-enlarge-dialog");
  });

  it("islands: /404 HTML carries the MermaidEnlarge skip-ssr marker + dialog shell", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    expectHtmlAttr(html, "data-zfb-island-skip-ssr", "MermaidEnlarge");
    expect(html).toContain("zd-mermaid-dialog");
  });
});

// ---------------------------------------------------------------------------
// Case DH — doc-history island registration under package-owned routes
//           (zudolab/zudo-doc#2480). With `docHistory: true`, the injected doc
//           route emits a `data-zfb-island-skip-ssr="DocHistory"` marker, but the
//           real DocHistory client island (`@takazudo/zudo-doc/doc-history`,
//           `"use client"`) must be reachable from the injected route's scan
//           graph so zfb REGISTERS a matching client binding — otherwise the
//           marker has "no matching registry entry" and the History button never
//           hydrates. `routes/_chrome.tsx` statically imports DocHistory and
//           threads it via `createChrome(routeCtx, { DocHistory })` to close that
//           gap. The showcase never caught this because it keeps a
//           `pages/docs/[[...slug]].tsx` stub (wins per Decision 6) whose host
//           chrome already imports DocHistory — so only the INJECTED path (empty
//           `pages/`) exercises the bug, which is exactly what this case builds.
// ---------------------------------------------------------------------------

/** Flip `docHistory` ON in a fixture's settings.ts (it ships OFF) so the
 *  route-context virtual module carries it true and the injected doc route
 *  renders the DocHistoryArea (emitting the island marker). */
function enableDocHistory(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /docHistory:\s*false/,
    "docHistory: true",
  );
  writeFileSync(settingsPath, src);
}

/** Concatenate every emitted islands JS bundle (main + chunks) so a client
 *  binding registration can be asserted regardless of chunk splitting. */
function readIslandsBundles(dir: string): string {
  const assetsDir = join(dir, "dist", "assets");
  return readdirSync(assetsDir)
    .filter((f) => /^islands.*\.js$/.test(f))
    .map((f) => readFileSync(join(assetsDir, f), "utf-8"))
    .join("\n");
}

describe("DH doc-history: injected doc route registers the DocHistory island (packageOwnedRoutes + docHistory)", () => {
  let fixtureDir: string;
  let buildOutput: string;

  it("setup: fixture builds with docHistory enabled + empty pages/", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    enableDocHistory(fixtureDir);
    // Captures stdout+stderr — the registry-miss warning (asserted below) is
    // emitted on a SUCCESSFUL build.
    buildOutput = runZfbBuild(fixtureDir);
  });

  it("marker: injected /docs/getting-started/ HTML carries the DocHistory skip-ssr marker", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expectHtmlAttr(html, "data-zfb-island-skip-ssr", "DocHistory");
  });

  it("registry: build emits NO 'DocHistory … has no matching registry entry' warning", () => {
    // The #2480 symptom: the marker is emitted but the real client island is
    // never in the injected route's scan graph, so zfb warns and the button is
    // dead. Assert NARROWLY on the co-occurrence (DocHistory + the registry-miss
    // phrase), not on any warning, so unrelated warnings don't make this brittle.
    const hasDocHistoryRegistryMiss =
      buildOutput.includes("has no matching registry entry") &&
      buildOutput.includes("DocHistory");
    expect(hasDocHistoryRegistryMiss).toBe(false);
  });

  it("bundle: the emitted islands client bundle registers DocHistory (marker ↔ registry match ⇒ hydration)", () => {
    // Marker present (above) + DocHistory in the client bundle = the marker has a
    // matching registry entry, which is exactly what zfb's hydration requires.
    expect(readIslandsBundles(fixtureDir)).toContain("DocHistory");
  });
});

// ---------------------------------------------------------------------------
// Case CB — chromeBindingsModule host-callables channel (zudolab/zudo-doc#2501).
//
// `settings.chromeBindingsModule` points at a host module exporting a named
// `chromeBindings: ChromeHostBindings`. The routes plugin re-exports it
// through `virtual:zudo-doc-chrome-bindings`; `routes/_chrome.tsx` spreads it
// into `createChrome(routeCtx, { DocHistory, ...chromeBindings })`. This
// proves the un-stranding: `buildFrontmatterPreviewEntries` — a
// `ChromeHostBindings` slot that stays at its package-default `() => []` stub
// on every other injected-route fixture in this file (see the baseline
// assertion in Case A above) — reaches `DocContentHeader` and renders the
// FrontmatterPreview table once the host binding is wired in.
// ---------------------------------------------------------------------------

/** Point `chromeBindingsModule` at the fixture's committed
 *  `src/chrome-bindings.tsx` — flips ON the CB #2501 host-callables channel. */
function enableChromeBindingsModule(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /packageOwnedRoutes:\s*true,/,
    'packageOwnedRoutes: true,\n  chromeBindingsModule: "./src/chrome-bindings.tsx",',
  );
  writeFileSync(settingsPath, src);
}

/** Flip `docMetainfo` ON in a fixture's settings.ts (it ships false) so
 *  `DocMetainfoArea` has a chance to render — paired with the
 *  `chrome-bindings.tsx` `docHistoryMeta` override (CONFIRM #2505), this gives
 *  the injected doc route a REAL metainfo block to assert
 *  `docContentHeaderExtras` renders before. */
function enableDocMetainfoForCB(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /docMetainfo:\s*false/,
    "docMetainfo: true",
  );
  writeFileSync(settingsPath, src);
}

/** Point `chromeBindingsModule` at a path with no file on disk — used by the
 *  missing-file error case. */
function enableMissingChromeBindingsModule(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /packageOwnedRoutes:\s*true,/,
    'packageOwnedRoutes: true,\n  chromeBindingsModule: "./src/does-not-exist.tsx",',
  );
  writeFileSync(settingsPath, src);
}

/** Set `chromeBindingsModule` to an empty string — used by the empty-string
 *  error case (#2518). */
function enableEmptyChromeBindingsModule(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /packageOwnedRoutes:\s*true,/,
    'packageOwnedRoutes: true,\n  chromeBindingsModule: "",',
  );
  writeFileSync(settingsPath, src);
}

/** Point `chromeBindingsModule` at a directory (the project root) — used by
 *  the directory-path error case (#2520). */
function enableDirectoryChromeBindingsModule(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /packageOwnedRoutes:\s*true,/,
    'packageOwnedRoutes: true,\n  chromeBindingsModule: ".",',
  );
  writeFileSync(settingsPath, src);
}

describe("CB chrome-bindings: chromeBindingsModule wires host bindings into createChrome on injected routes", () => {
  let fixtureDir: string;

  it("setup: fixture builds with chromeBindingsModule set", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    enableChromeBindingsModule(fixtureDir);
    enableDocMetainfoForCB(fixtureDir);
    // Should not throw — the resolved file (src/chrome-bindings.tsx) exists.
    runZfbBuild(fixtureDir);
  });

  it("bindings: injected /docs/getting-started/ HTML renders the FrontmatterPreview table from the host binding", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    // The table only renders when `entries` is non-empty (FrontmatterPreview
    // v2 short-circuits to `null` on an empty array) — its presence proves
    // buildFrontmatterPreviewEntries reached createChrome via the host
    // bindings spread, not the package-default `() => []` stub.
    expectHtmlAttr(html, "data-testid", "frontmatter-preview");
    expect(html).toContain("cb-demo-key");
    expect(html).toContain("CB-DEMO-VALUE-MARKER");
  });

  // CONFIRM #2505 — end-to-end proof that `ctx.hostBindings.docContentHeaderExtras`
  // reaches `DocContentHeader` on an injected doc route: renders a
  // frontmatter-keyed badge sourced from `entry.data.tier` (the fixture's MDX
  // sets `tier: gold`).
  it("docContentHeaderExtras: injected /docs/getting-started/ HTML renders the frontmatter-keyed badge", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).toContain("doc-content-header-extra-marker");
    expect(html).toContain("DOC-HEADER-EXTRA-MARKER: gold");
  });

  // Positional proof: the badge renders AFTER </h1> and BEFORE the metainfo
  // block (`DocMetainfoArea` → `DocMetainfo`, identified by its distinctive
  // wrapper class — see metainfo/doc-metainfo.tsx), matching the documented
  // placement in doc-content-header/index.tsx. The CB setup flips
  // `docMetainfo: true` + supplies a `docHistoryMeta` entry (via
  // chrome-bindings.tsx) so a REAL metainfo block renders here, rather than
  // relying on the slot's absence to vacuously satisfy the ordering.
  it("docContentHeaderExtras: badge renders BETWEEN </h1> and the metainfo block", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    const h1CloseIdx = html.indexOf("</h1>");
    const badgeIdx = html.indexOf("doc-content-header-extra-marker");
    const metainfoIdx = html.indexOf("border-t border-fg pt-vsp-xs");
    expect(h1CloseIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeGreaterThan(h1CloseIdx);
    expect(metainfoIdx).toBeGreaterThan(badgeIdx);
    // Confirm the metainfo block that renders is actually the one seeded by
    // chrome-bindings.tsx's docHistoryMeta override (not some other match).
    expect(html).toContain("CB-AUTHOR-MARKER");
  });

  // Case DH (DocHistory hydration pairing) regression guard: spreading
  // `...chromeBindings` AFTER the `DocHistory` default must not disturb the
  // #2480 island-scanner wiring when the host binding doesn't touch that slot.
  it("regression: DocHistory island registration (#2480) still works with chromeBindingsModule set", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    // docHistory defaults to false in this fixture, so DocHistoryArea renders
    // nothing and emits no skip-ssr marker — assert that absence stays intact
    // (i.e. the chrome-bindings channel didn't accidentally flip it on).
    expect(html).not.toMatch(htmlAttrPattern("data-zfb-island-skip-ssr", "DocHistory"));
  });
});

describe("CB chrome-bindings missing: build fails loudly when chromeBindingsModule points at a nonexistent file", () => {
  it("setup: build throws an error naming the resolved absolute path (not a silent empty fallback)", { timeout: 180_000 }, () => {
    const fixtureDir = setupFixture({ emptyPages: true });
    enableMissingChromeBindingsModule(fixtureDir);
    const resolvedPath = join(fixtureDir, "src/does-not-exist.tsx").split("\\").join("/");

    let thrown: Error | undefined;
    try {
      runZfbBuild(fixtureDir);
    } catch (err) {
      thrown = err as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("chromeBindingsModule");
    expect(thrown!.message).toContain(resolvedPath);
  });
});

describe("CB chrome-bindings empty: build fails loudly when chromeBindingsModule is an empty string", () => {
  it("setup: build throws an error naming chromeBindingsModule and the empty-string condition", { timeout: 180_000 }, () => {
    const fixtureDir = setupFixture({ emptyPages: true });
    enableEmptyChromeBindingsModule(fixtureDir);

    let thrown: Error | undefined;
    try {
      runZfbBuild(fixtureDir);
    } catch (err) {
      thrown = err as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("chromeBindingsModule");
    expect(thrown!.message).toContain("empty string");
  });
});

describe("CB chrome-bindings directory: build fails loudly when chromeBindingsModule points at a directory", () => {
  it("setup: build throws an error naming chromeBindingsModule and the directory condition", { timeout: 180_000 }, () => {
    const fixtureDir = setupFixture({ emptyPages: true });
    enableDirectoryChromeBindingsModule(fixtureDir);

    let thrown: Error | undefined;
    try {
      runZfbBuild(fixtureDir);
    } catch (err) {
      thrown = err as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("chromeBindingsModule");
    expect(thrown!.message).toContain("directory, not a module file");
  });
});

// ---------------------------------------------------------------------------
// Case DTP — DesignTokenPanelBootstrap package-default island (#2658, epic
// Minimal Scaffold #2651). Mirrors the DH (DocHistory) island-registration
// proof + the CB missing-file-throws pattern, applied to the THIRD virtual
// module (`virtual:zudo-doc-design-token-panel-config`, mirrors
// `chromeBindingsModule` exactly).
//
//   1. designTokenPanel: true, NO designTokenPanelConfigModule → the injected
//      doc route emits the `data-zfb-island="DesignTokenPanelBootstrap"`
//      marker AND the emitted islands client bundle registers the real
//      component (marker <-> registry match => hydration, the same
//      structural proof DH established for DocHistory) AND carries the
//      PACKAGE-DEFAULT builder's `storagePrefix: "zudo-doc-tweak"` (HARD GATE
//      #4: unchanged) all the way into the built bundle.
//   2. designTokenPanel: true + designTokenPanelConfigModule set → the host's
//      builder (not the package default) reaches the bundle: asserts a
//      host-only token label appears (HARD GATE #2).
//   3. designTokenPanel: true + designTokenPanelConfigModule pointing at a
//      missing file → the build throws, naming the resolved absolute path
//      (mirrors CB's missing-chromeBindingsModule case exactly, HARD GATE #2).
//   4. designTokenPanel: false → no island marker reaches the SSR HTML (HARD
//      GATE #3). NOTE: like the pre-existing aiAssistant/imageEnlarge gating
//      (see `doc-body-end-islands/index.tsx`'s "KNOWN CAVEAT" comment), the
//      island's CODE may still be present in the emitted JS bundle even when
//      its marker/render is gated off — zfb's scanner walks the STATIC
//      "use client" import chain (`_chrome.tsx` always imports
//      `DesignTokenPanelBootstrap` so it can thread it into `createChrome`),
//      and bundle-stripping a statically-imported-but-conditionally-rendered
//      island is explicitly out of scope for that established pattern. This
//      case therefore asserts the SSR-HTML-page-level guarantee only (no
//      marker, no toggle-shim script), matching the existing OFF-case
//      assertions in `doc-body-end-islands/__tests__/body-end-islands.test.tsx`.
// ---------------------------------------------------------------------------

/** Flip `designTokenPanel` ON in a fixture's settings.ts (it ships OFF). */
function enableDesignTokenPanel(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /designTokenPanel:\s*false/,
    "designTokenPanel: true",
  );
  writeFileSync(settingsPath, src);
}

/** Point `designTokenPanelConfigModule` at the fixture's committed
 *  `src/design-token-panel-config.ts` — flips ON the #2658 host-callables
 *  channel (mirrors `enableChromeBindingsModule`). */
function enableDesignTokenPanelConfigModule(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /packageOwnedRoutes:\s*true,/,
    'packageOwnedRoutes: true,\n  designTokenPanelConfigModule: "./src/design-token-panel-config.ts",',
  );
  writeFileSync(settingsPath, src);
}

/** Point `designTokenPanelConfigModule` at a path with no file on disk —
 *  used by the missing-file error case (mirrors
 *  `enableMissingChromeBindingsModule`). */
function enableMissingDesignTokenPanelConfigModule(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /packageOwnedRoutes:\s*true,/,
    'packageOwnedRoutes: true,\n  designTokenPanelConfigModule: "./src/does-not-exist-dtp.ts",',
  );
  writeFileSync(settingsPath, src);
}

describe("DTP design-token-panel: injected doc route registers the DesignTokenPanelBootstrap island (packageOwnedRoutes + designTokenPanel)", () => {
  let fixtureDir: string;

  it("setup: fixture builds with designTokenPanel enabled + empty pages/", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    enableDesignTokenPanel(fixtureDir);
    runZfbBuild(fixtureDir);
  });

  it("marker: injected /docs/getting-started/ HTML carries the DesignTokenPanelBootstrap island marker (non-skip-ssr)", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expectHtmlAttr(html, "data-zfb-island", "DesignTokenPanelBootstrap");
  });

  it("shim: injected /docs/getting-started/ HTML carries the pre-hydration toggle-shim script", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).toContain("__zdtpToggleShimInstalled");
    expect(html).toContain("toggle-design-token-panel");
  });

  it("bundle: the emitted islands client bundle registers DesignTokenPanelBootstrap (marker <-> registry match => hydration)", () => {
    // Marker present (above) + DesignTokenPanelBootstrap in the client bundle
    // = the marker has a matching registry entry, which is exactly what
    // zfb's hydration requires (same structural proof as Case DH).
    expect(readIslandsBundles(fixtureDir)).toContain("DesignTokenPanelBootstrap");
  });

  it("package-default builder: the bundle carries the unchanged storagePrefix 'zudo-doc-tweak' (HARD GATE #4)", () => {
    expect(readIslandsBundles(fixtureDir)).toContain("zudo-doc-tweak");
  });
});

describe("DTP host override: designTokenPanelConfigModule wires the host's builder into the bundle", () => {
  let fixtureDir: string;

  it("setup: fixture builds with designTokenPanel + designTokenPanelConfigModule set", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    enableDesignTokenPanel(fixtureDir);
    enableDesignTokenPanelConfigModule(fixtureDir);
    // Should not throw — the resolved file (src/design-token-panel-config.ts) exists.
    runZfbBuild(fixtureDir);
  });

  it("bindings: the emitted islands client bundle carries the host-only token label (not the package default)", () => {
    const bundle = readIslandsBundles(fixtureDir);
    expect(bundle).toContain("DTP-HOST-CONFIG-MODULE-MARKER");
  });

  it("marker: injected /docs/getting-started/ HTML still carries the DesignTokenPanelBootstrap island marker", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expectHtmlAttr(html, "data-zfb-island", "DesignTokenPanelBootstrap");
  });
});

describe("DTP host override missing: build fails loudly when designTokenPanelConfigModule points at a nonexistent file", () => {
  it("setup: build throws an error naming the resolved absolute path (not a silent fallback to the package default)", { timeout: 180_000 }, () => {
    const fixtureDir = setupFixture({ emptyPages: true });
    enableDesignTokenPanel(fixtureDir);
    enableMissingDesignTokenPanelConfigModule(fixtureDir);
    const resolvedPath = join(fixtureDir, "src/does-not-exist-dtp.ts").split("\\").join("/");

    let thrown: Error | undefined;
    try {
      runZfbBuild(fixtureDir);
    } catch (err) {
      thrown = err as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("designTokenPanelConfigModule");
    expect(thrown!.message).toContain(resolvedPath);
  });
});

describe("DTP off: designTokenPanel false emits no island marker on the page (HARD GATE #3)", () => {
  let fixtureDir: string;

  it("setup: fixture builds with designTokenPanel left at its default (false) + empty pages/", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    // designTokenPanel already ships `false` in the fixture — no mutation needed.
    runZfbBuild(fixtureDir);
  });

  it("no marker: injected /docs/getting-started/ HTML carries no DesignTokenPanelBootstrap marker", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).not.toMatch(htmlAttrPattern("data-zfb-island", "DesignTokenPanelBootstrap"));
  });

  it("no shim: injected /docs/getting-started/ HTML carries no toggle-shim script", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).not.toContain("__zdtpToggleShimInstalled");
    expect(html).not.toContain("toggle-design-token-panel");
  });
});

// ---------------------------------------------------------------------------
// Case HOME — `createHomePageView` adoption on the injected `/[locale]` home
// (S3 #2502, epic #2499). Uses the i18n fixture (symlink method, cheap — NOT
// `npm pack`) because the `/[locale]` home route only exists when a locale is
// configured; the plain `route-injection` fixture has `locales: {}`.
//
// Proves:
//   1. The ONLY intentional output diff from the pre-#2502 `locale-index.tsx`
//      is the richer GitHub link (inline SVG icon instead of plain text) —
//      every other element (hero copy, overview link, SiteTreeNav grid) is
//      unchanged. Reasoning: `locale-index.tsx` before this extraction never
//      rendered a trailing separator after the GitHub link (unlike the
//      default-locale `routes/index.tsx`, which had a stray dangling
//      `<span>/</span>` — an inconsistency this extraction incidentally fixed
//      on the `/` route, which is never injected/tested), so the shared
//      `HomePageView` body reproduces the `/[locale]` markup exactly aside
//      from the SVG.
//   2. `ctx.hostBindings.homeExtras` (wired via `chromeBindingsModule`, same
//      channel as CB #2501) renders inside the hero text column, after the
//      links row.
//   3. The `SiteTreeNav` island wrapper is untouched — `data-zfb-island=
//      "SiteTreeNav"` still appears in the injected locale-home HTML.
// ---------------------------------------------------------------------------

/** Flip `githubUrl` from `false` to a real URL in the i18n fixture's
 *  settings.ts (it ships `false`) so the home hero renders the GitHub link. */
function enableGithubUrl(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    "githubUrl: false,",
    'githubUrl: "https://github.com/example/example",',
  );
  writeFileSync(settingsPath, src);
}

/** Point `chromeBindingsModule` at the i18n fixture's committed
 *  `src/chrome-bindings.tsx` (extended for S3 #2502 with a `homeExtras`
 *  binding) — flips ON the CB #2501 host-callables channel. */
function enableI18nChromeBindingsModule(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /packageOwnedRoutes:\s*true,/,
    'packageOwnedRoutes: true,\n  chromeBindingsModule: "./src/chrome-bindings.tsx",',
  );
  writeFileSync(settingsPath, src);
}

describe("HOME home-page: createHomePageView adoption on the injected /[locale] home (S3 #2502)", () => {
  let fixtureDir: string;

  it("setup: i18n fixture builds with githubUrl + chromeBindingsModule (homeExtras) enabled", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true, fixtureSrc: FIXTURE_I18N_SRC });
    enableGithubUrl(fixtureDir);
    enableI18nChromeBindingsModule(fixtureDir);
    runZfbBuild(fixtureDir);
  });

  it("diff-only-SVG: injected /ja/ home renders the GitHub link with the inline SVG icon", () => {
    const html = readBuiltHtml(fixtureDir, "ja/index.html");
    expectHtmlAttr(html, "href", "https://github.com/example/example");
    // The exact showcase path data (pages/index.tsx) — the reviewed,
    // intentional diff this extraction introduces on the package routes.
    expect(html).toContain("M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59");
    expect(html).toContain(">GitHub</a>");
  });

  it("unchanged: hero <h1>/description and hero structure still render for the locale home", () => {
    const html = readBuiltHtml(fixtureDir, "ja/index.html");
    expect(html).toContain('<h1 class="text-heading font-bold mb-vsp-2xs">Route Injection i18n Proof</h1>');
    expect(html).toContain("aspect-[1200/630] bg-fg");
  });

  it("island: SiteTreeNav still hydrates via the real Island(when: idle) wrapper", () => {
    const html = readBuiltHtml(fixtureDir, "ja/index.html");
    expectHtmlAttr(html, "data-zfb-island", "SiteTreeNav");
  });

  it("homeExtras: hostBindings.homeExtras renders inside the hero, after the links row", () => {
    const html = readBuiltHtml(fixtureDir, "ja/index.html");
    expect(html).toContain("home-extra-marker");
    expect(html).toContain("HOME-EXTRA-MARKER: ja");
    const linksIdx = html.indexOf(">GitHub</a>");
    const extraIdx = html.indexOf("HOME-EXTRA-MARKER: ja");
    expect(linksIdx).toBeGreaterThan(-1);
    expect(extraIdx).toBeGreaterThan(linksIdx);
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

  // #2480 published-shape guard: the injected chrome must statically import the
  // real DocHistory island so zfb registers it under packageOwnedRoutes. In the
  // PUBLISHED tree the parent-relative `../doc-history/index.js` is rewritten to
  // the bare package subpath by copy-routes-src.mjs — prove the rewrite landed in
  // the packed output, not only in the in-repo `src/` shape.
  it("registration: published routes-src/_chrome.tsx imports the real DocHistory island (rewritten specifier)", () => {
    const chromeSrc = readFileSync(join(pkgDest, "routes-src/_chrome.tsx"), "utf-8");
    expect(chromeSrc).toContain('from "@takazudo/zudo-doc/doc-history"');
    // …and threads it into the chrome builder (not left as a dead import).
    expect(chromeSrc).toMatch(/createChrome\(routeCtx,\s*\{/);
    // No residual parent-relative form survived the rewrite.
    expect(chromeSrc).not.toContain('from "../doc-history');
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
    expectHtmlAttr(html, "data-zfb-island", "HtmlPreviewWrapperInner");
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
