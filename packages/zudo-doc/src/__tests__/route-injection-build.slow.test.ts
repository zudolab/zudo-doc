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
import { execSync, spawn, type ExecSyncOptions, type ChildProcess } from "node:child_process";
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

/** The locked 13-file target-manifest fixture (epic zudolab/zudo-doc#2651 Wave
 *  5, #2659) — see the "Case TM" section near the end of this file. */
const TARGET_MANIFEST_FIXTURE_SRC = resolve(__dirname, "fixtures/target-manifest");

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

/** All `zfb dev` child processes spawned by the Case TM dev probes — killed in
 *  afterAll as a safety net even if a test throws mid-way (confirm-gate brief:
 *  "kill every server"). */
const devServers: ChildProcess[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Populate a packed-tarball fixture's `node_modules` with everything the build
 *  needs EXCEPT `@takazudo/zudo-doc` itself (the caller extracts that from the
 *  tarball).
 *
 *  Two source directories, in this order:
 *
 *  1. the workspace-root `node_modules` — the root package's own deps, plus
 *     whatever pnpm happened to hoist there;
 *  2. **this package's** `node_modules` — under pnpm's strict (non-hoisting)
 *     layout a dependency declared only by `packages/zudo-doc/package.json`
 *     lives HERE and is absent from the root entirely. `gray-matter` is the
 *     load-bearing case: `dist/md-utils/index.js` imports it at build time, so
 *     a root-only sweep produces `Cannot find package 'gray-matter' imported
 *     from …/dist/md-utils/index.js` and every packed-tarball group fails
 *     (zudolab/zudo-doc#3189).
 *
 *  Root wins on collision — pass 2 only fills gaps — so the resolution order a
 *  real consumer sees is preserved. `@takazudo` is skipped in both passes; the
 *  caller links that scope itself. */
function linkFixtureNodeModules(nm: string): void {
  const wsNm = join(WORKSPACE_ROOT, "node_modules");
  const pkgNm = join(PKG_ROOT, "node_modules");

  // readdirSync includes dotfiles (e.g. `.bin`) by default — unlike a bare
  // shell glob, no `dotglob` equivalent needed here.
  for (const entry of readdirSync(wsNm)) {
    if (entry === "@takazudo") continue;
    symlinkSync(join(wsNm, entry), join(nm, entry));
  }

  if (!existsSync(pkgNm)) return;
  for (const entry of readdirSync(pkgNm)) {
    if (entry === "@takazudo") continue;
    // Root already provided it — keep the root copy (see "root wins" above).
    if (existsSync(join(nm, entry))) continue;
    symlinkSync(join(pkgNm, entry), join(nm, entry));
  }
}

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

function countHtmlAttr(html: string, name: string, value: string): number {
  const pattern = htmlAttrPattern(name, value);
  return html.match(new RegExp(pattern.source, "g"))?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterAll(() => {
  for (const child of devServers) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
    }
  }
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

  it("highlight: a native fenced block emits semantic class HTML without fixed colors", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    const highlightedBlock =
      html.match(
        /<pre\b[^>]*\bclass=(?:"hi-root"|'hi-root'|hi-root)(?=[\s>])[^>]*>[\s\S]*?<\/pre>/,
      )?.[0] ?? "";
    expect(highlightedBlock).not.toBe("");
    expect(highlightedBlock).toMatch(/<pre\b[^>]*><code\b[^>]*>/);
    expectHtmlAttr(highlightedBlock, "class", "hi-kw");
    expectHtmlAttr(highlightedBlock, "class", "hi-var");
    expect(highlightedBlock).not.toContain("syntect-dual");
    expect(highlightedBlock).not.toContain("--shiki-light");
    expect(highlightedBlock).not.toMatch(/\bstyle=/);
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
  //
  // 2026-07-18 re-baseline (zudolab/zudo-doc#2911): old-vs-new normalized-HTML
  // diff confirmed every changed byte traces to already-merged, intentional
  // output changes since the prior baseline (set at 27d95e578, compat-cleanup) —
  //   - `<html data-theme-pack=default>` + the inlined FOUC-safe theme-pack
  //     bootstrap `<script>` in `<head>` (theme-packs runtime switching engine,
  //     #2822, base/theme-feature-core)
  //   - `data-footer`, `data-doc-description`, `data-doc-pager` stable data-*
  //     DOM hooks (#2873, base/theme-pack-hooks)
  //   - `data-zd-mobile-sidebar` stable DOM hook on the mobile sidebar aside
  //     (#2887, base/theme-nav-fonts chrome font seam + mobile hooks)
  //   - the stateDiagram `;`→newline mermaid-init fix + its explanatory
  //     comment (#2909, this epic's Wave-1 mermaid-semicolon-fix)
  // No other bytes changed. See sub-issue #2911 for the full diff.
  //
  // 2026-07-21 re-baseline (zudolab/zudo-doc#3039, nightly exam failure): the
  // prior baseline (b1eea45) was rebuilt in a worktree and its normalized HTML
  // diffed byte-for-byte against HEAD. That old build still reproduced the old
  // hashes exactly, so the delta below is the complete and only change —
  //   - the accent hover/focus pass over non-active header nav —
  //     `hover:text-accent` / `focus:text-accent` / `focus-visible:text-accent`
  //     (#3011, #3020, #3023) — reaching this HTML from two distinct sources:
  //       * `src/header/header.tsx`, which SSR-renders the overflow ("···")
  //         toggle unconditionally (this fixture has `headerNav: []`, so the
  //         button is present-but-hidden rather than absent) — its class
  //         string is static markup here, not script output
  //       * `src/header/nav-overflow-script.ts`, whose inlined source carries
  //         the top-level nav link classList swap and the dropdown-child
  //         `className` strings
  //   - in that script, the overflow dropdown child's resting colour moving
  //     `text-muted` → `text-fg` (and its `hover:text-fg` →
  //     `hover:text-accent`) (#3020)
  //   - `border-b border-fg pb-vsp-xs` on the doc-title `<h1>`
  //     (`src/doc-content-header/index.tsx`) — the title rule is now kept when
  //     meta is absent, which is exactly this fixture's shape
  //     (SKIP_DOC_HISTORY=1, no meta), so it newly renders here (#3025)
  // All of it traces to already-merged, intentional PRs; no unattributed bytes,
  // no lost chrome. Only /docs/getting-started/ carries the `<h1>` delta; the
  // header-nav deltas hit both pages. Note the sidebar-hover PR (#3010) is NOT
  // in this list — its markup does not reach either fixture page.
  //
  // 2026-07-22 re-baseline (zudolab/zudo-doc#3074, nightly exam failure): the
  // prior baseline (5e46831d4) was rebuilt in a worktree and its normalized
  // HTML diffed byte-for-byte against HEAD. That old build still reproduced
  // the old hashes exactly, so the delta below is the complete and only
  // change — a single line in both pages' inlined FOUC theme-pack bootstrap
  // `<script>`, the `packs` object literal built from each pack's
  // `meta.json` `{slug: version}` (`src/theme/theme-pack-provider.tsx:64`):
  //   - 10 new Theme Batch 5 packs added to the object — academia, bauhaus,
  //     blueprint, botanica, eink, riso, sakura, scandi, tidepool, timberline,
  //     each at `1.0.0` (#3072)
  //   - existing-pack version bumps (cache-busting `?v=` contract; content
  //     unchanged for these pages, only the version string moves):
  //       * `brutalist` 1.0.1 → 1.0.2 (#3038) → 1.0.3 (#3046)
  //       * `foundry`, `hearth`, `observatory`, `sumi` 1.0.1 → 1.0.2 (#3038)
  //       * `washi` 1.0.1 → 1.0.2 (#3038) → 1.0.3 (part of the same #3038
  //         merge that also bumped washi 1.0.1→1.0.2 for the h1-seal fix)
  // All of it traces to already-merged, intentional PRs; no unattributed
  // bytes. See sub-issue #3074 for the full diff.
  //
  // 2026-07-31 re-baseline (zudolab/zudo-doc#3140, nightly exam failure): the
  // prior baseline (4fd642c3b) was rebuilt in a worktree and its normalized
  // HTML diffed byte-for-byte against HEAD (512efe094). That old build still
  // reproduced the old hashes exactly, so the delta below is the complete and
  // only change — a single purely-additive 14-line insertion, byte-identical
  // on both pages, in the inlined FOUC theme-pack bootstrap `<script>`, with
  // zero removals anywhere:
  //   - a new `zfb:before-swap` listener that pre-injects a matching pack
  //     `<link>` into the incoming document's `<head>`, so zfb's href-match
  //     persistence keeps the live, already-loaded stylesheet instead of
  //     dropping it — killing the flash of the default look on SPA soft
  //     navigation (`src/theme/theme-pack-provider.tsx`,
  //     `buildThemePackBootstrap`)
  //   - the interpolated event-name literal `"zfb:before-swap"` in that
  //     listener's first line, from the new `BEFORE_SWAP_EVENT` symbol
  //     (`src/transitions/page-events.ts`)
  // Both spans come from one commit, `da3c9d9a5` (#3139, refs #3136/#3137).
  // The existing `zfb:after-swap` handler is unchanged and remains as
  // fallback/cleanup; that commit's only other edits to the provider are
  // comment blocks and an import, neither of which is emitted — which is why
  // the rendered diff shows additions and no removals.
  //
  // Notable negative: the engine moved `@takazudo/zfb` 0.1.0-next.90 → 1.0.0
  // across this range (9 published releases) and contributed ZERO bytes.
  // Every shipped JS file in `@takazudo/zfb` and `@takazudo/zfb-runtime` is
  // byte-identical across the bump — only `.d.ts` files and the Rust binary
  // moved — and `zfb:before-swap`, `event.newDocument`, and the head-swap
  // href-match persistence rule all already existed at the baseline pin, so
  // the fix above used a capability that was already there rather than one
  // that arrived with 1.0.0. `1.0.0` itself was a version-number event:
  // three docs/chore commits, no engine behaviour change.
  //
  // All of it traces to already-merged, intentional PRs; no unattributed bytes.
  //
  // 2026-08-02 re-baseline (zudolab/zudo-doc#3188, epic #3174 "Theme Pack
  // Polish"): the prior baseline (00873483a) was rebuilt in a worktree and its
  // normalized HTML diffed byte-for-byte against HEAD. Both pages are
  // byte-identical to the old build except for 14 pack version strings in the
  // `packs` object literal of the inlined FOUC theme-pack bootstrap `<script>`
  // (`src/theme/theme-pack-provider.tsx`, `{slug: version}` from each pack's
  // `meta.json`) — the cache-busting `?v=` contract. Pure digit swaps: both
  // files are the same byte length before and after, with zero additions and
  // zero removals anywhere else in either page.
  //   - `academia` 1.0.0 → 1.0.1 (#3175 — low-opacity rest-state link
  //     underline + `pre.hi-root` 0.85rem → 0.9rem)
  //   - the 13 packs carrying `background-attachment: fixed` decorative
  //     layers, each bumped one patch for the catalog-wide
  //     `@media (pointer: coarse) { … background-attachment: scroll }`
  //     fallback (#3177, refs #3070): `blueprint` 1.0.0→1.0.1,
  //     `broadsheet` 1.0.1→1.0.2, `drift` 1.0.1→1.0.2, `fjord` 1.0.1→1.0.2,
  //     `hearth` 1.0.2→1.0.3, `hollow` 1.0.1→1.0.2, `matcha` 1.0.1→1.0.2,
  //     `nocturne` 1.0.1→1.0.2, `observatory` 1.0.2→1.0.3, `onyx` 1.0.2→1.0.3,
  //     `sakura` 1.0.0→1.0.1, `sumi` 1.0.2→1.0.3, `timberline` 1.0.0→1.0.1
  // Neither pack's CSS *content* reaches these two fixture pages — only the
  // version string does — so the whole delta is the version literal itself.
  //
  // Notable negative: this epic also extended the theme-pack validator to
  // accept top-level `@media` blocks (#3176). That is build-time validation
  // only and contributes ZERO bytes to either page.
  //
  // Caveat for the next re-baseliner: `dist/` is gitignored here, so a
  // `git stash`-based "does the clean tree still fail?" check is NOT a valid
  // baseline — the stash leaves the rebuilt `dist/theme-packs/` in place and
  // the old source reads the NEW pack versions, producing a third hash that
  // matches neither baseline. Rebuild the prior pin in a separate worktree
  // (as this entry and the three above did) instead.
  //
  // All of it traces to already-merged, intentional PRs; no unattributed bytes.

  it("parity: /404.html normalized-HTML sha256 is stable (stub-defaults path)", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    expect(sha256Html(html)).toMatchInlineSnapshot(`"b79675460ca89a23ff2fe16cd052eba20fde841351a8ca4380b5c627e2afc3ac"`);
  });

  it("parity: /docs/getting-started/index.html normalized-HTML sha256 is stable (stub-defaults path)", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(sha256Html(html)).toMatchInlineSnapshot(`"62e37d7a7ce1e72fca33e8b79749c2b39b99c9d30c2796602dff05cee49a338a"`);
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
// into `createChrome(routeCtx, { ...chromeBindings, DocHistory })`. This
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
  const src = readFileSync(settingsPath, "utf-8")
    .replace(
      /packageOwnedRoutes:\s*true,/,
      'packageOwnedRoutes: true,\n  chromeBindingsModule: "./src/chrome-bindings.tsx",',
    )
    .replace(
      /headerRightItems:\s*\[\],/,
      'headerRightItems: [{ type: "component", component: "injected-route-badge" }],',
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

  it("headerRightComponents: injected route resolves the serialized name through the callable host registry", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).toMatch(
      /data-header-registry=(?:"injected:en:0"|injected:en:0)/,
    );
    expect(html).toContain("INJECTED-HEADER-REGISTRY-MARKER");
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
  // block (`DocMetainfoArea` → `DocMetainfo`, identified by its stable
  // `data-doc-metainfo` hook — see metainfo/doc-metainfo.tsx), matching the documented
  // placement in doc-content-header/index.tsx. The CB setup flips
  // `docMetainfo: true` + supplies a `docHistoryMeta` entry (via
  // chrome-bindings.tsx) so a REAL metainfo block renders here, rather than
  // relying on the slot's absence to vacuously satisfy the ordering.
  it("docContentHeaderExtras: badge renders BETWEEN </h1> and the metainfo block", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    const h1CloseIdx = html.indexOf("</h1>");
    const badgeIdx = html.indexOf("doc-content-header-extra-marker");
    const metainfoIdx = html.indexOf("data-doc-metainfo");
    expect(h1CloseIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeGreaterThan(h1CloseIdx);
    expect(metainfoIdx).toBeGreaterThan(badgeIdx);
    // Confirm the metainfo block that renders is actually the one seeded by
    // chrome-bindings.tsx's docHistoryMeta override (not some other match).
    expect(html).toContain("CB-AUTHOR-MARKER");
  });

  // Case DH (DocHistory hydration pairing) regression guard: spreading
  // The scanner-reachable `DocHistory` default AFTER `...chromeBindings` must
  // not be disturbed by other host slots in the configured object.
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
    expect(countHtmlAttr(html, "data-zfb-island", "DesignTokenPanelBootstrap")).toBe(1);
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

describe("DTP host body-end override: package derive seam retains exactly one DesignTokenPanelBootstrap", () => {
  let fixtureDir: string;
  let buildOutput: string;

  it("setup: fixture builds with designTokenPanel + chromeBindingsModule", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    enableDesignTokenPanel(fixtureDir);
    enableChromeBindingsModule(fixtureDir);
    buildOutput = runZfbBuild(fixtureDir);
  });

  it("composes the host body-end content with exactly one package-owned marker", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).toContain("HOST-BODY-END-MARKER");
    expect(countHtmlAttr(html, "data-zfb-island", "DesignTokenPanelBootstrap")).toBe(1);
    expect(html).toContain("__zdtpToggleShimInstalled");
  });

  it("keeps a matching client registry entry without the duplicate-component warning", () => {
    expect(readIslandsBundles(fixtureDir)).toContain("DesignTokenPanelBootstrap");
    expect(buildOutput).not.toMatch(/cannot hydrate both components/i);
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
// Case FIP — FindInPageInit package-default island (zudolab/zudo-doc#2689).
// Mirrors the DH (DocHistory) / DTP island-registration proof: unlike
// DesignTokenPanelBootstrap, `FindInPageInit` is a plain static top-level
// import (no `deps` injection — see the module header note in
// `../doc-body-end-islands/index.tsx`), so this only needs to gate on
// `settings.findInPage`.
//
//   1. findInPage: true → the injected doc route emits the
//      `data-zfb-island="FindInPageInit"` marker (non-skip-ssr — the
//      component renders nothing on either side, self-gating on
//      `window.__TAURI_INTERNALS__`) AND the emitted islands client bundle
//      registers the real component (marker <-> registry match =>
//      hydration — an SSR marker alone doesn't prove client hydration).
//   2. findInPage: false (the fixture default) → no island marker reaches
//      the SSR HTML.
// ---------------------------------------------------------------------------

/** Flip `findInPage` ON in a fixture's settings.ts (it ships OFF). */
function enableFindInPage(dir: string): void {
  const settingsPath = join(dir, "src/config/settings.ts");
  const src = readFileSync(settingsPath, "utf-8").replace(
    /findInPage:\s*false/,
    "findInPage: true",
  );
  writeFileSync(settingsPath, src);
}

describe("FIP find-in-page: injected doc route registers the FindInPageInit island (packageOwnedRoutes + findInPage)", () => {
  let fixtureDir: string;

  it("setup: fixture builds with findInPage enabled + empty pages/", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    enableFindInPage(fixtureDir);
    runZfbBuild(fixtureDir);
  });

  it("marker: injected /docs/getting-started/ HTML carries the FindInPageInit island marker (non-skip-ssr)", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expectHtmlAttr(html, "data-zfb-island", "FindInPageInit");
  });

  it("bundle: the emitted islands client bundle registers FindInPageInit (marker <-> registry match => hydration)", () => {
    // Marker present (above) + FindInPageInit in the client bundle = the
    // marker has a matching registry entry, which is exactly what zfb's
    // hydration requires (same structural proof as Case DH/DTP).
    expect(readIslandsBundles(fixtureDir)).toContain("FindInPageInit");
  });
});

describe("FIP off: findInPage false (fixture default) emits no island marker on the page", () => {
  let fixtureDir: string;

  it("setup: fixture builds with findInPage left at its default (false) + empty pages/", { timeout: 180_000 }, () => {
    fixtureDir = setupFixture({ emptyPages: true });
    // findInPage already ships `false` in the fixture — no mutation needed.
    runZfbBuild(fixtureDir);
  });

  it("no marker: injected /docs/getting-started/ HTML carries no FindInPageInit marker", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).not.toMatch(htmlAttrPattern("data-zfb-island", "FindInPageInit"));
  });
});

// ---------------------------------------------------------------------------
// Case HOME — `createHomePageView` adoption on the injected `/[locale]` home
// (S3 #2502, epic #2499). Uses the i18n fixture (symlink method, cheap — NOT
// `npm pack`) because the `/[locale]` home route only exists when a locale is
// configured; the plain `route-injection` fixture has `locales: {}`.
//
// Proves:
//   1. Two intentional output diffs from the pre-#2502 `locale-index.tsx`:
//      the richer GitHub link (inline SVG icon instead of plain text), and
//      (added 2026-07-22, #3074) the `logo:"auto"` default (commit
//      a2ba5188a) rendering the generated `AutoLogo` SVG instead of the
//      masked `bg-fg` div the pre-#2502 markup used. Every other element
//      (hero copy, overview link, SiteTreeNav grid) is unchanged. Reasoning:
//      `locale-index.tsx` before this extraction never rendered a trailing
//      separator after the GitHub link (unlike the default-locale
//      `routes/index.tsx`, which had a stray dangling `<span>/</span>` — an
//      inconsistency this extraction incidentally fixed on the `/` route,
//      which is never injected/tested), so the shared `HomePageView` body
//      reproduces the `/[locale]` markup exactly aside from the SVG and the
//      logo branch.
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

  it("hero <h1>/description unchanged; hero logo renders the logo:\"auto\" AutoLogo default (#3074)", () => {
    const html = readBuiltHtml(fixtureDir, "ja/index.html");
    expect(html).toContain('<h1 class="text-heading font-bold mb-vsp-2xs">Route Injection i18n Proof</h1>');
    // logo:"auto" (default, commit a2ba5188a) renders the generated AutoLogo
    // SVG branch, not the masked bg-fg div — mirrors the assertion
    // convention in home-page.test.tsx:69 (semantic data-auto-logo= marker
    // + the sizing class, since `text-fg` alone is too broad — it appears
    // elsewhere in this HTML).
    expect(html).toContain("data-auto-logo=");
    expect(html).toContain("aspect-[1200/630] text-fg");
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
  // `.bin`, `.pnpm`, preact, zod, gray-matter, … all needed at build time.
  // gray-matter comes from the PACKAGE's node_modules under pnpm, not the
  // root — see linkFixtureNodeModules (#3189).
  linkFixtureNodeModules(nm);
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

// ---------------------------------------------------------------------------
// Case TM — target-manifest confirm (epic zudolab/zudo-doc#2651 Wave 5, #2659).
//
// The locked 13-file minimal-scaffold manifest (#2653 decision wave):
//
//   zfb.config.ts  package.json  tsconfig.json  CLAUDE.md  .gitignore  .npmrc
//   pnpm-workspace.yaml
//   pages/index.tsx                       — 1-line re-export
//   pages/docs/[[...slug]].tsx            — self-contained doc stub (REQUIRED)
//   src/content/docs/getting-started/{index,introduction,installation}.mdx
//   src/styles/global.css                 — ~22 ln
//
// committed verbatim at fixtures/target-manifest/ (13 files, guarded by the
// "group 6" file-count test below). Built from the NPM-PACKED package (mirrors
// Case S1's `packPackage()`/tarball-extraction flow, not the cheap workspace
// symlink `setupFixture()` used by Cases A–DTP/HOME/B) so the confirm proof
// exercises the PUBLISHED shape a real `create-zudo-doc` consumer gets —
// including the #2656 consumer-level regression proof this section owns per
// packages/zudo-doc/CLAUDE.md ("Shipped ambient type shims" section): the
// self-referencing `import("@takazudo/zudo-doc/factory-context")` specifier in
// the generated `virtual-modules.d.ts`, resolved from inside a consumer's
// node_modules.
//
// Six assertion groups (see #2659):
//   1. `zfb build` succeeds; real HTML for /, /docs/getting-started/, /404,
//      /sitemap.xml.
//   2. Island-set diff: the self-contained doc stub vs. the SAME fixture with
//      the stub removed (injected route owns the URL) — isolates exactly one
//      variable (stub vs. no-stub) under IDENTICAL settings, unlike diffing
//      against the unrelated route-injection fixture (which ships different
//      feature flags, e.g. mermaid:false vs. zudoDoc()'s mermaid:true default).
//   3. `zfb check` (tsc) passes with the 5-line tsconfig + pages/ included.
//   4. `zfb dev` renders / and /docs/getting-started/ (200 + content marker).
//   5. Computed-token smoke on built CSS (theme.css contract).
//   6. Fixture file count == 12 (guards floor creep).
// ---------------------------------------------------------------------------

/** Set up a target-manifest fixture instance: copy the locked-manifest fixture
 *  source verbatim, extract the packed tarball into a REAL
 *  `node_modules/@takazudo/zudo-doc` (published shape — no `src/`, WITH
 *  `routes-src/`), and symlink every other workspace dep (mirrors
 *  `setupNoSrcFixture` above, but preserves the fixture's own `pages/`
 *  content instead of forcing it empty — the locked manifest's `pages/` IS
 *  the thing under test). `options.removeDocStub` strips
 *  `pages/docs/[[...slug]].tsx` — the negative-guard / apples-to-apples
 *  island-diff baseline variant, proving the stub (not just
 *  `packageOwnedRoutes`) is what's under test. Returns the temp fixture dir. */
function setupTargetManifestFixture(
  tarballPath: string,
  options: { removeDocStub?: boolean } = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-target-manifest-"));
  tempDirs.push(dir);
  cpSync(TARGET_MANIFEST_FIXTURE_SRC, dir, { recursive: true });

  const wsNm = join(WORKSPACE_ROOT, "node_modules");
  const nm = join(dir, "node_modules");
  mkdirSync(nm);
  linkFixtureNodeModules(nm);
  const scopeDir = join(nm, "@takazudo");
  mkdirSync(scopeDir);
  for (const entry of readdirSync(join(wsNm, "@takazudo"))) {
    if (entry === "zudo-doc") continue;
    symlinkSync(join(wsNm, "@takazudo", entry), join(scopeDir, entry));
  }
  // @takazudo/zudo-doc: REAL directory extracted from the tarball — the
  // published file set (no `src/`, with `routes-src/`), same as Case S1.
  const pkgDest = join(scopeDir, "zudo-doc");
  mkdirSync(pkgDest);
  execSync(`tar -xzf "${tarballPath}" -C "${pkgDest}" --strip-components=1`, {
    stdio: "pipe",
  });

  if (options.removeDocStub) {
    rmSync(join(dir, "pages/docs"), { recursive: true, force: true });
  }

  return dir;
}

/** Run `zfb check` in `dir`, throwing (with the combined output) on non-zero
 *  exit — assertion group 3's `tsc --noEmit` + content-schema gate. */
function runZfbCheck(dir: string): string {
  const opts: ExecSyncOptions = {
    cwd: dir,
    env: { ...process.env, SKIP_DOC_HISTORY: "1" },
    stdio: "pipe",
    encoding: "utf-8",
  };
  try {
    return execSync(`./node_modules/.bin/zfb check 2>&1`, opts) as string;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      `zfb check failed in ${dir}:\n${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`,
    );
  }
}

/** Boot `zfb dev` in `dir` on `port`, polling combined stdout/stderr for the
 *  "ready on" banner (or the process exiting early) before resolving. Removes
 *  any stale `dist/` first — `zfb dev` serves a stale `dist/` statically
 *  instead of live-rendering (spike #2652 finding; load-bearing for every dev
 *  probe in this section). Ports 4615–4625 per the confirm-gate brief. Returns
 *  a `{ port, kill }` controller; callers call `kill()` explicitly, with
 *  `afterAll`'s sweep as a safety net. */
async function startZfbDev(dir: string, port: number): Promise<{ port: number; kill: () => void }> {
  rmSync(join(dir, "dist"), { recursive: true, force: true });

  let output = "";
  const child = spawn("./node_modules/.bin/zfb", ["dev", "--port", String(port)], {
    cwd: dir,
    env: { ...process.env, SKIP_DOC_HISTORY: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  devServers.push(child);
  child.stdout?.on("data", (d: Buffer) => {
    output += d.toString();
  });
  child.stderr?.on("data", (d: Buffer) => {
    output += d.toString();
  });

  const deadline = Date.now() + 30_000;
  while (!/ready on/.test(output)) {
    if (child.exitCode !== null) {
      throw new Error(`zfb dev exited early (code ${child.exitCode}) in ${dir}:\n${output}`);
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`zfb dev did not report ready within 30s in ${dir}:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    port,
    kill: () => {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    },
  };
}

/** curl a dev-server path, returning the HTTP status code. Per the
 *  confirm-gate brief ("Dev probes via curl only"), not `fetch`. */
function curlStatus(port: number, path: string): number {
  const out = execSync(
    `curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${path}"`,
    { encoding: "utf-8" },
  );
  return Number(out.trim());
}

/** Poll `path` on a freshly-booted dev server until it returns `wantStatus`
 *  (or the attempt budget is exhausted, in which case it just returns
 *  whatever the last attempt saw). `zfb dev`'s lazy renderer compiles each
 *  route on its FIRST request — the server's "ready on" banner fires before
 *  that per-route compile necessarily settles, so a probe issued immediately
 *  after boot can transiently see a stale/000/wrong status under heavy system
 *  load (observed empirically: reliable in isolation, occasionally flaky when
 *  this file's ~85 other tests already saturated the machine beforehand).
 *  This is a warm-up for the dev PROCESS, not a retry-until-pass on the
 *  assertion under test — callers still assert the final returned status
 *  explicitly. */
function waitForDevStatus(port: number, path: string, wantStatus: number, attempts = 10): number {
  let status = -1;
  for (let i = 0; i < attempts; i++) {
    status = curlStatus(port, path);
    if (status === wantStatus) return status;
    execSync("sleep 0.5");
  }
  return status;
}

/** curl a dev-server path, returning the response body. */
function curlBody(port: number, path: string): string {
  return execSync(`curl -s "http://localhost:${port}${path}"`, { encoding: "utf-8" });
}

/** Extract every `data-zfb-island`/`data-zfb-island-skip-ssr` marker from HTML
 *  as a normalized, quote-insensitive `"data-zfb-island[-skip-ssr]=NAME"`
 *  string — minifyHtml strips attribute quotes in build output
 *  (`data-zfb-island=SiteTreeNav`), so a plain `toContain('="X"')` check would
 *  miss minified matches; this regex accepts quoted, single-quoted, and bare
 *  attribute values uniformly. */
function extractIslandMarkers(html: string): string[] {
  const re = /data-zfb-island(-skip-ssr)?=(?:"([^"]*)"|'([^']*)'|([^\s>]*))/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const suffix = m[1] ?? "";
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    out.push(`data-zfb-island${suffix}=${value}`);
  }
  return out;
}

/** Recursively count files under `dir` (fixture file-count guard, group 6). */
function countFilesRecursive(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFilesRecursive(full);
    } else {
      count += 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Group 6 — fixture file count == the locked 13-file manifest.
// ---------------------------------------------------------------------------

describe("TM group 6: fixture file count matches the locked 13-file manifest exactly", () => {
  it("fixtures/target-manifest/ contains exactly 13 files (guards floor creep)", () => {
    expect(countFilesRecursive(TARGET_MANIFEST_FIXTURE_SRC)).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// Groups 1, 3, 5 — build, typecheck, computed-CSS-token smoke.
// ---------------------------------------------------------------------------

describe("TM build+check+css: the locked manifest builds, typechecks, and ships the theme.css token contract", () => {
  let fixtureDir: string;

  it("setup: pack the package and build the target-manifest fixture (with the doc stub)", { timeout: 180_000 }, () => {
    const tarballPath = packPackage();
    fixtureDir = setupTargetManifestFixture(tarballPath);
    runZfbBuild(fixtureDir);
  });

  // ---- Group 1 ----

  it("group 1: / (home) renders real HTML via the 1-line re-export of routes/index", () => {
    const html = readBuiltHtml(fixtureDir, "index.html");
    expect(html).toContain("<title>Target Manifest Confirm</title>");
  });

  it("group 1: /docs/getting-started/ renders real HTML via the self-contained doc stub", () => {
    const html = readBuiltHtml(fixtureDir, "docs/getting-started/index.html");
    expect(html).toContain("Getting Started");
    expect(html).toContain("TM-INDEX-MARKER: target-manifest-render-proof");
  });

  it("group 1: the two other starter pages (introduction/installation) also render", () => {
    const introHtml = readBuiltHtml(fixtureDir, "docs/getting-started/introduction/index.html");
    expect(introHtml).toContain("TM-INTRODUCTION-MARKER: target-manifest-render-proof");
    const installHtml = readBuiltHtml(fixtureDir, "docs/getting-started/installation/index.html");
    expect(installHtml).toContain("TM-INSTALLATION-MARKER: target-manifest-render-proof");
  });

  it("group 1: /404 renders the package-default 404 (injected static route)", () => {
    const html = readBuiltHtml(fixtureDir, "404.html");
    expect(html).toContain("Page Not Found");
  });

  it("group 1: /sitemap.xml is emitted and lists the doc routes (injected static route, sitemap:true)", () => {
    const xml = readBuiltHtml(fixtureDir, "sitemap.xml");
    expect(xml).toContain("<loc>/</loc>");
    expect(xml).toContain("<loc>/docs/getting-started</loc>");
  });

  // ---- Group 3 ----

  it("group 3: zfb check passes cleanly — 5-line tsconfig extending tsconfig.base.json, pages/ included, no local shim (#2656 consumer proof)", { timeout: 60_000 }, () => {
    const output = runZfbCheck(fixtureDir);
    expect(output).toContain("no errors");
    // Incidental bug flagged on #2653's decision comment: today's OLD
    // generator output fails `zfb check` with a `changelogs` TS2322 — assert
    // zudoDoc()'s DEFAULT_SETTINGS.changelogs (typed `false`, not `boolean`)
    // does NOT resurface it now that `pages/` is actually typechecked.
    expect(output).not.toContain("TS2322");
    expect(output).not.toContain("changelogs");
  });

  // ---- Group 5 ----

  function readBuiltCss(dir: string): string {
    const assetsDir = join(dir, "dist", "assets");
    const cssFile = readdirSync(assetsDir).find((f) => f.endsWith(".css"));
    if (!cssFile) throw new Error(`No built CSS asset found in ${assetsDir}`);
    return readFileSync(join(assetsDir, cssFile), "utf-8");
  }

  it("group 5: built CSS resolves --color-bg / --text-body / --z-index-modal to theme.css's default values", () => {
    const css = readBuiltCss(fixtureDir);
    // theme.css: --color-bg: var(--zd-bg); --text-body: var(--text-scale-md);
    // --z-index-modal: 60; (packages/zudo-doc/src/theme.css).
    expect(css).toContain("--color-bg: var(--zd-bg)");
    expect(css).toContain("--text-body: var(--text-scale-md)");
    expect(css).toContain("--z-index-modal: 60");
    expect(css).toContain("--text-scale-md: 1.2rem");
  });

  it("group 5: the --color-*: initial tight-token guardrail is effective (no default Tailwind color utilities leak in)", () => {
    const css = readBuiltCss(fixtureDir);
    // Tailwind's built-in red-500 swatch must NOT survive the guardrail —
    // neither as a --color-red-500 custom property nor a .bg-red-500 utility.
    expect(css).not.toContain("--color-red-500");
    expect(css).not.toContain(".bg-red-500");
  });
});

// ---------------------------------------------------------------------------
// Group 2 — island-set diff: self-contained doc stub vs. the SAME fixture
// with the stub removed (injected route owns /docs/getting-started/). Both
// variants share IDENTICAL zfb.config.ts / settings (zudoDoc() defaults +
// designTokenPanel: true) — isolating exactly one variable (stub present vs.
// absent) for a fair diff, unlike comparing against the unrelated
// route-injection fixture (different feature-flag profile, e.g.
// mermaid:false there vs. zudoDoc()'s mermaid:true default here).
//
// *** GATE-2 FINDING — FIXED (#2658 blocking comment → gate-2 fix) ***
// The locked-spec (#2653) self-contained doc stub imports ONLY
// `virtual:zudo-doc-route-context` + `@takazudo/zudo-doc/route-context` +
// `@takazudo/zudo-doc/chrome` — it calls `createChrome(routeCtx)` with NO
// `hostBindings`. Originally, an omitted
// `hostBindings.DesignTokenPanelBootstrap` was a safe no-op in
// `chrome/derive.tsx`'s `deriveBodyEndIslands`, so `designTokenPanel: true`
// produced NO marker at all on stub-rendered pages (the silent-missing-island
// failure mode). FIXED at the package seam: `deriveBodyEndIslands` now
// defaults the slot to the statically-imported package
// `DesignTokenPanelBootstrap`, so EVERY `createChrome` consumer — the stub
// included — mounts the settings-gated island with no explicit wiring. The
// cases below are the regression guard: the stub's island-marker set must
// stay IDENTICAL to the injected-route baseline.
// ---------------------------------------------------------------------------

describe("TM group 2: island-set diff — self-contained doc stub vs. injected-route baseline (designTokenPanel: true)", () => {
  let stubDir: string;
  let baselineDir: string;

  it("setup: build BOTH variants from the same packed tarball (with-stub, no-stub baseline)", { timeout: 180_000 }, () => {
    const tarballPath = packPackage();
    stubDir = setupTargetManifestFixture(tarballPath);
    runZfbBuild(stubDir);
    baselineDir = setupTargetManifestFixture(tarballPath, { removeDocStub: true });
    runZfbBuild(baselineDir);
  });

  it("baseline sanity: no-stub /docs/getting-started/ is rendered by the injected route (not a 404 page)", () => {
    const html = readBuiltHtml(baselineDir, "docs/getting-started/index.html");
    expect(html).toContain("Getting Started");
    expect(html).toContain("TM-INDEX-MARKER: target-manifest-render-proof");
  });

  it("baseline: injected /docs/getting-started/ carries the DesignTokenPanelBootstrap marker + a matching client-bundle registry entry", () => {
    const html = readBuiltHtml(baselineDir, "docs/getting-started/index.html");
    expectHtmlAttr(html, "data-zfb-island", "DesignTokenPanelBootstrap");
    expect(readIslandsBundles(baselineDir)).toContain("DesignTokenPanelBootstrap");
  });

  it("home route (both variants): / carries the DesignTokenPanelBootstrap marker via the re-export — unaffected by the doc-stub gap", () => {
    for (const dir of [stubDir, baselineDir]) {
      const html = readBuiltHtml(dir, "index.html");
      expectHtmlAttr(html, "data-zfb-island", "DesignTokenPanelBootstrap");
    }
    expect(readIslandsBundles(stubDir)).toContain("DesignTokenPanelBootstrap");
  });

  it("island-set diff: the self-contained stub's marker set is IDENTICAL to the injected baseline (gate-2 fix: incl. DesignTokenPanelBootstrap)", () => {
    const baselineMarkers = new Set(
      extractIslandMarkers(readBuiltHtml(baselineDir, "docs/getting-started/index.html")),
    );
    const stubMarkers = new Set(
      extractIslandMarkers(readBuiltHtml(stubDir, "docs/getting-started/index.html")),
    );
    const missingFromStub = [...baselineMarkers].filter((m) => !stubMarkers.has(m)).sort();
    const extraInStub = [...stubMarkers].filter((m) => !baselineMarkers.has(m)).sort();
    // Assertion group 2's literal requirement: the stub's distinct marker set
    // equals the baseline's — any drift in EITHER direction fails loudly.
    // (Pre-fix, missingFromStub was exactly
    // ["data-zfb-island=DesignTokenPanelBootstrap"] — the #2658 gate-2 gap.)
    expect(extraInStub).toEqual([]);
    expect(missingFromStub).toEqual([]);
  });

  // Was `it.fails` while the gate-2 gap was open (see the module-header note
  // above); flipped to a plain `it` by the #2658 gate-2 fix, per the marker's
  // own instruction. The registry pairing lives in the "home route" case above
  // (shared islands bundle) — this asserts the stub page's own marker.
  it("doc route carries the DesignTokenPanelBootstrap marker, matching the baseline (#2658 gate-2 fix)", () => {
    const html = readBuiltHtml(stubDir, "docs/getting-started/index.html");
    expectHtmlAttr(html, "data-zfb-island", "DesignTokenPanelBootstrap");
  });
});

// ---------------------------------------------------------------------------
// Group 4 — `zfb dev` renders / and /docs/getting-started/ via the locked
// manifest, plus the negative guard the locked spec (#2653) mandates.
// ---------------------------------------------------------------------------

describe("TM group 4: zfb dev renders / and /docs/getting-started/ via the locked manifest", () => {
  let fixtureDir: string;
  let dev: { port: number; kill: () => void } | undefined;

  it("setup: pack + fixture with the doc stub present", { timeout: 180_000 }, () => {
    const tarballPath = packPackage();
    fixtureDir = setupTargetManifestFixture(tarballPath);
  });

  it("dev: boots and / returns 200 via the 1-line re-export stub", { timeout: 60_000 }, async () => {
    dev = await startZfbDev(fixtureDir, 4615);
    // First-hit warm-up (see waitForDevStatus) — the lazy dev renderer
    // compiles each route on its first request, so a probe issued the
    // instant "ready on" appears can transiently race it under load.
    expect(waitForDevStatus(dev.port, "/", 200)).toBe(200);
  });

  it("dev: /docs/getting-started/ returns 200 + content marker via the self-contained doc stub (the load-bearing case)", () => {
    expect(dev).toBeDefined();
    expect(waitForDevStatus(dev!.port, "/docs/getting-started/", 200)).toBe(200);
    expect(curlBody(dev!.port, "/docs/getting-started/")).toContain(
      "TM-INDEX-MARKER: target-manifest-render-proof",
    );
  });

  it("dev: an injected STATIC route (/404) also returns 200 (sanity — static injection was never in question)", () => {
    expect(dev).toBeDefined();
    expect(waitForDevStatus(dev!.port, "/404", 200)).toBe(200);
  });

  it("teardown: kill the dev server", () => {
    dev?.kill();
  });
});

describe("TM group 4: package-injected dev route works without the doc stub", () => {
  let fixtureDir: string;
  let dev: { port: number; kill: () => void } | undefined;

  it("setup: pack + fixture WITHOUT the doc stub (pages/docs/ removed)", { timeout: 180_000 }, () => {
    const tarballPath = packPackage();
    fixtureDir = setupTargetManifestFixture(tarballPath, { removeDocStub: true });
  });

  it("dev: boots and / still returns 200 (only the doc stub was removed)", { timeout: 60_000 }, async () => {
    dev = await startZfbDev(fixtureDir, 4616);
    expect(waitForDevStatus(dev.port, "/", 200)).toBe(200);
  });

  // The package-injected dynamic route is now the current runtime contract.
  // The scaffold stub remains an authoring convenience, but is not required
  // for the package route to render in dev mode.
  it("dev: /docs/getting-started/ renders through the package-injected route without the doc stub", () => {
    expect(dev).toBeDefined();
    expect(waitForDevStatus(dev!.port, "/docs/getting-started/", 200)).toBe(200);
    expect(curlBody(dev!.port, "/docs/getting-started/")).toContain(
      "TM-INDEX-MARKER: target-manifest-render-proof",
    );
  });

  it("teardown: kill the dev server", () => {
    dev?.kill();
  });
});
