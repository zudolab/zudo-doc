// Fast, isolated unit coverage for the routes plugin's THIRD virtual module
// (#2658): `virtual:zudo-doc-design-token-panel-config`. Calls `plugin.setup()`
// directly against a minimal mock `ZfbSetupContext` (no full `zfb build`) —
// this is the fast-lane proof that:
//
//   1. Absent `settings.designTokenPanelConfigModule` → the loader re-exports
//      the PACKAGE DEFAULT builder (`@takazudo/zudo-doc/design-token-panel-config`).
//   2. A configured, EXISTING module path → the loader re-exports the host's
//      resolved absolute path.
//   3. A configured, MISSING module path → `setup()` throws, naming the
//      setting AND the resolved absolute path (never a silent fallback).
//   4. An explicitly empty string → `setup()` throws naming the setting and
//      "empty string".
//   5. A directory-valued path → `setup()` throws naming "directory, not a
//      module file".
//
// This mirrors the `chromeBindingsModule` contract exactly (#2501) — see
// `../routes.ts` for the shared design. The real end-to-end proof (marker in
// built HTML + client bundle registration + a real build failure) lives in
// the slow-tier `__tests__/route-injection-build.slow.test.ts` (Case DTP),
// per the project's fast/slow test-tier split (zudolab/zudo-doc#2530).
//
// The loader contract below is UNCHANGED by #3396 — what changed is WHO
// imports the specifier the loader serves. The second describe block is the
// fast guard for that: the routes-only wrapper must be the sole importer, or
// `@takazudo/zudo-doc/chrome` silently regains its routes-plugin coupling.

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import routesPlugin, { shouldWarnDtpFullyShadowed } from "../routes.js";

/** Minimal mock of the fields `routes.ts`'s `setup()` actually reads
 *  (`options`, `projectRoot`) plus no-op stubs for the rest of
 *  `ZfbSetupContext` (`command`, `config`, `logger`, `addAlias`,
 *  `addClientEntry`) — this plugin's `setup()` never touches those.
 *  `warnings` collects every `ctx.logger.warn(...)` call verbatim, for the
 *  DTP shadow-diagnostic coverage below (#3428). */
function makeCtx(projectRoot: string, settings: Record<string, unknown>) {
  const virtualModules = new Map<string, () => string | Promise<string>>();
  const warnings: string[] = [];
  const ctx = {
    command: "build" as const,
    projectRoot,
    config: {} as never,
    options: { settings, translations: {}, tagVocabulary: [], colorSchemes: null },
    logger: {
      info() {},
      warn(msg: string) {
        warnings.push(msg);
      },
      error() {},
    },
    addAlias() {},
    addVirtualModule(specifier: string, loader: () => string | Promise<string>) {
      virtualModules.set(specifier, loader);
    },
    injectRoute() {},
    addClientEntry() {},
  };
  return { ctx, virtualModules, warnings };
}

const tempDirs: string[] = [];
function makeProjectRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-routes-plugin-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Resolve the design-token-panel-config virtual module's emitted source for
 *  a given settings object. Throws if `setup()` throws. */
async function emittedSource(projectRoot: string, settings: Record<string, unknown>): Promise<string> {
  const { ctx, virtualModules } = makeCtx(projectRoot, settings);
  routesPlugin.setup!(ctx as never);
  const loader = virtualModules.get("virtual:zudo-doc-design-token-panel-config");
  if (!loader) {
    throw new Error("virtual:zudo-doc-design-token-panel-config was not registered");
  }
  return loader();
}

describe("routes plugin — virtual:zudo-doc-design-token-panel-config (#2658)", () => {
  it("is registered unconditionally, even when the setting is absent", async () => {
    const projectRoot = makeProjectRoot();
    const source = await emittedSource(projectRoot, { packageOwnedRoutes: true });
    expect(source).toContain("buildDesignTokenPanelConfig");
  });

  it("absent setting → re-exports the package default builder", async () => {
    const projectRoot = makeProjectRoot();
    const source = await emittedSource(projectRoot, { packageOwnedRoutes: true });
    expect(source).toBe(
      'export { buildDesignTokenPanelConfig } from "@takazudo/zudo-doc/design-token-panel-config";\n',
    );
  });

  it("configured + existing file → re-exports the host's resolved absolute path", async () => {
    const projectRoot = makeProjectRoot();
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    const hostFile = join(projectRoot, "src", "design-token-panel-config.ts");
    writeFileSync(hostFile, "export function buildDesignTokenPanelConfig() { return {}; }\n");

    const source = await emittedSource(projectRoot, {
      packageOwnedRoutes: true,
      designTokenPanelConfigModule: "./src/design-token-panel-config.ts",
    });
    const resolved = hostFile.split("\\").join("/");
    expect(source).toBe(`export { buildDesignTokenPanelConfig } from ${JSON.stringify(resolved)};\n`);
  });

  it("configured + missing file → setup() throws naming the setting and the resolved absolute path", async () => {
    const projectRoot = makeProjectRoot();
    const resolved = join(projectRoot, "src", "does-not-exist.ts").split("\\").join("/");

    let thrown: Error | undefined;
    try {
      await emittedSource(projectRoot, {
        packageOwnedRoutes: true,
        designTokenPanelConfigModule: "./src/does-not-exist.ts",
      });
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("designTokenPanelConfigModule");
    expect(thrown!.message).toContain(resolved);
  });

  it("empty string → setup() throws naming the setting and 'empty string'", async () => {
    const projectRoot = makeProjectRoot();
    let thrown: Error | undefined;
    try {
      await emittedSource(projectRoot, {
        packageOwnedRoutes: true,
        designTokenPanelConfigModule: "",
      });
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("designTokenPanelConfigModule");
    expect(thrown!.message).toContain("empty string");
  });

  it("directory path → setup() throws naming 'directory, not a module file'", async () => {
    const projectRoot = makeProjectRoot();
    let thrown: Error | undefined;
    try {
      await emittedSource(projectRoot, {
        packageOwnedRoutes: true,
        designTokenPanelConfigModule: ".",
      });
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("designTokenPanelConfigModule");
    expect(thrown!.message).toContain("directory, not a module file");
  });
});

// ---------------------------------------------------------------------------
// #3396 seam guard — the routes-only wrapper is the SOLE importer of the
// design-token-panel-config virtual specifier.
//
// This automates the acceptance-criteria grep. The regression it catches is
// invisible to every other fast test: re-adding the import to
// `design-token-panel-bootstrap.tsx` (or anywhere else in the chrome graph)
// still typechecks and still builds under zfb, and only breaks the ONE thing
// the epic is about — bundling `@takazudo/zudo-doc/chrome` outside a zfb build,
// where nothing registers the specifier.
// ---------------------------------------------------------------------------

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DTP_CONFIG_SPECIFIER = "virtual:zudo-doc-design-token-panel-config";

/** Every compiled `.ts`/`.tsx` source under `src/`, excluding tests and the
 *  ambient `.d.ts` declarations (which must keep naming the specifier). */
function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.d\.ts$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// DTP shadow diagnostic (zudolab/zudo-doc#3420, spec #3428; scoped by
// #3434/#3435) — warns at plugin setup when `designTokenPanel` is on,
// `designTokenPanelConfigModule` is set, and every READER-FACING derived
// route's URL is shadowed by a kept user `pages/` file, unless the resolved
// `chromeBindingsModule` already names the documented workaround.
// ---------------------------------------------------------------------------

/** The static/always-on route patterns `deriveRoutes()` emits when locales,
 *  versions, `docTags`, and `aiAssistant` are all absent — see `routes.ts`
 *  section "Static / always-on". Used below to build full vs. partial
 *  shadowing fixtures without reaching into the plugin's private catalog. */
const ALWAYS_ON_ROUTE_PATTERNS = ["/404", "/sitemap.xml", "/robots.txt", "/docs/[[...slug]]"];

/** The subset of `ALWAYS_ON_ROUTE_PATTERNS` tagged
 *  `includedInDtpShadowDiagnostic: true` — i.e. the diagnostic's whole
 *  denominator for a project with no locales, versions or tags. */
const ALWAYS_ON_READER_FACING_PATTERNS = ["/docs/[[...slug]]"];

/** Write a `pages/` stub file that shadows `pattern` (the plain FILE form —
 *  one of the two shapes `derivePagesCandidates` recognises). */
function shadowRouteWithStub(projectRoot: string, pattern: string) {
  const relPath = `${pattern.replace(/^\//, "")}.tsx`;
  const absPath = join(projectRoot, "pages", relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, "export default function Page() { return null; }\n");
}

/** Write a valid, existing `designTokenPanelConfigModule` file and return its
 *  project-root-relative path for the settings object. */
function writeConfigModule(projectRoot: string): string {
  mkdirSync(join(projectRoot, "src"), { recursive: true });
  writeFileSync(
    join(projectRoot, "src", "dtp-config.ts"),
    "export function buildDesignTokenPanelConfig() { return {}; }\n",
  );
  return "./src/dtp-config.ts";
}

describe("routes plugin — DTP shadow diagnostic (#3420, #3428)", () => {
  it("warns exactly once when every derived route is shadowed and no chromeBindings workaround is present", () => {
    const projectRoot = makeProjectRoot();
    for (const pattern of ALWAYS_ON_ROUTE_PATTERNS) shadowRouteWithStub(projectRoot, pattern);
    const designTokenPanelConfigModule = writeConfigModule(projectRoot);

    const { ctx, warnings } = makeCtx(projectRoot, {
      packageOwnedRoutes: true,
      designTokenPanel: true,
      designTokenPanelConfigModule,
    });
    routesPlugin.setup!(ctx as never);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("designTokenPanelConfigModule");
    expect(warnings[0]).toContain("zudolab/zudo-doc#3420");
    expect(warnings[0]).toContain("DesignTokenPanelBootstrap");
  });

  // The #3420 motivating shape, and the regression #3434 exists to fix: the
  // locked minimal scaffold keeps exactly two `pages/` stubs — `index.tsx`
  // (which shadows nothing in the catalog, since `/` is never injected) and
  // `docs/[[...slug]].tsx`. `/404`, `/sitemap.xml` and `/robots.txt` therefore
  // survive, which held the old all-routes `every()` at `false` forever — even
  // though every doc page a reader visits is stub-rendered with no panel.
  it("warns for the locked minimal scaffold, where /404, /sitemap.xml and /robots.txt survive unshadowed (#3434)", () => {
    const projectRoot = makeProjectRoot();
    // `pages/index.tsx` verbatim — NOT via `shadowRouteWithStub`, because it
    // shadows no injected route at all (that is the point of this fixture).
    mkdirSync(join(projectRoot, "pages"), { recursive: true });
    writeFileSync(
      join(projectRoot, "pages", "index.tsx"),
      "export default function Page() { return null; }\n",
    );
    shadowRouteWithStub(projectRoot, "/docs/[[...slug]]");
    const designTokenPanelConfigModule = writeConfigModule(projectRoot);

    const { ctx, warnings } = makeCtx(projectRoot, {
      packageOwnedRoutes: true,
      designTokenPanel: true,
      designTokenPanelConfigModule,
    });
    routesPlugin.setup!(ctx as never);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("zudolab/zudo-doc#3420");
  });

  it("stays silent when shadowing is only partial", () => {
    const projectRoot = makeProjectRoot();
    // `docTags` widens the reader-facing set to three patterns; shadow all but
    // one of them (plus every always-on route, to prove the surviving
    // reader-facing route is what keeps this silent).
    for (const pattern of ALWAYS_ON_ROUTE_PATTERNS) shadowRouteWithStub(projectRoot, pattern);
    shadowRouteWithStub(projectRoot, "/docs/tags");
    const designTokenPanelConfigModule = writeConfigModule(projectRoot);

    const { ctx, warnings } = makeCtx(projectRoot, {
      packageOwnedRoutes: true,
      docTags: true,
      designTokenPanel: true,
      designTokenPanelConfigModule,
    });
    routesPlugin.setup!(ctx as never);

    expect(warnings).toHaveLength(0);
  });

  it("stays silent when no route is shadowed", () => {
    const projectRoot = makeProjectRoot();
    const designTokenPanelConfigModule = writeConfigModule(projectRoot);

    const { ctx, warnings } = makeCtx(projectRoot, {
      packageOwnedRoutes: true,
      designTokenPanel: true,
      designTokenPanelConfigModule,
    });
    routesPlugin.setup!(ctx as never);

    expect(warnings).toHaveLength(0);
  });

  it("stays silent when only the non-reader-facing routes are shadowed", () => {
    const projectRoot = makeProjectRoot();
    for (const pattern of ALWAYS_ON_ROUTE_PATTERNS) {
      if (ALWAYS_ON_READER_FACING_PATTERNS.includes(pattern)) continue;
      shadowRouteWithStub(projectRoot, pattern);
    }
    const designTokenPanelConfigModule = writeConfigModule(projectRoot);

    const { ctx, warnings } = makeCtx(projectRoot, {
      packageOwnedRoutes: true,
      designTokenPanel: true,
      designTokenPanelConfigModule,
    });
    routesPlugin.setup!(ctx as never);

    expect(warnings).toHaveLength(0);
  });

  it("stays silent when designTokenPanelConfigModule is unset, even with full shadowing", () => {
    const projectRoot = makeProjectRoot();
    for (const pattern of ALWAYS_ON_ROUTE_PATTERNS) shadowRouteWithStub(projectRoot, pattern);

    const { ctx, warnings } = makeCtx(projectRoot, {
      packageOwnedRoutes: true,
      designTokenPanel: true,
    });
    routesPlugin.setup!(ctx as never);

    expect(warnings).toHaveLength(0);
  });

  // #3435 — `designTokenPanelConfigModule` resolves unconditionally and
  // `designTokenPanel` defaults to false, so a host with the feature off and a
  // leftover config-module value must not be told to wire up a panel that
  // never renders either way (settings.ts documents the setting as irrelevant
  // in that state).
  it("stays silent when designTokenPanel is off, even with a config module and full shadowing (#3435)", () => {
    const projectRoot = makeProjectRoot();
    for (const pattern of ALWAYS_ON_ROUTE_PATTERNS) shadowRouteWithStub(projectRoot, pattern);
    const designTokenPanelConfigModule = writeConfigModule(projectRoot);

    const { ctx, warnings } = makeCtx(projectRoot, {
      packageOwnedRoutes: true,
      designTokenPanelConfigModule,
    });
    routesPlugin.setup!(ctx as never);

    expect(warnings).toHaveLength(0);
  });

  it("stays silent when the resolved chromeBindingsModule file names DesignTokenPanelBootstrap", () => {
    const projectRoot = makeProjectRoot();
    for (const pattern of ALWAYS_ON_ROUTE_PATTERNS) shadowRouteWithStub(projectRoot, pattern);
    const designTokenPanelConfigModule = writeConfigModule(projectRoot);
    writeFileSync(
      join(projectRoot, "src", "chrome-bindings.tsx"),
      'import { DesignTokenPanelBootstrap } from "@takazudo/zudo-doc/design-token-panel-bootstrap";\n' +
        "export const chromeBindings = { DesignTokenPanelBootstrap };\n",
    );

    const { ctx, warnings } = makeCtx(projectRoot, {
      packageOwnedRoutes: true,
      designTokenPanel: true,
      designTokenPanelConfigModule,
      chromeBindingsModule: "./src/chrome-bindings.tsx",
    });
    routesPlugin.setup!(ctx as never);

    expect(warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DTP shadow diagnostic — re-export false-positive guard (#3451).
//
// Narrowing the denominator to reader-facing routes (#3434) made a false
// positive reachable: a `pages/docs/[[...slug]].tsx` that merely default
// re-exports the package route it shadows —
//
//   export { default, paths, frontmatter } from "@takazudo/zudo-doc/routes/docs-slug";
//
// — still reaches the configured bootstrap through `routes/_chrome.tsx`, so
// it should not warn. Every fixture below shadows ONLY `/docs/[[...slug]]`,
// which is the sole reader-facing route under default settings (no locales,
// versions, docTags, or aiAssistant) — so that one file alone determines
// warn vs. silent.
// ---------------------------------------------------------------------------

/** The `/docs/[[...slug]]` route's own package entrypoint — mirrors the
 *  "Static / always-on" entry in `deriveRoutes()`. */
const DOCS_SLUG_ENTRYPOINT = "@takazudo/zudo-doc/routes/docs-slug";

/** Write `pages/docs/[[...slug]].tsx` with arbitrary `content` — the sole
 *  reader-facing route under default settings, so it alone drives warn vs.
 *  silent for the fixtures below. */
function writeDocsSlugPage(projectRoot: string, content: string) {
  const absPath = join(projectRoot, "pages", "docs", "[[...slug]].tsx");
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content);
}

/** Run `setup()` against a `pages/docs/[[...slug]].tsx` fixture with the
 *  given `content` and return the collected warnings. */
function warningsForDocsSlugFixture(content: string): string[] {
  const projectRoot = makeProjectRoot();
  writeDocsSlugPage(projectRoot, content);
  const designTokenPanelConfigModule = writeConfigModule(projectRoot);

  const { ctx, warnings } = makeCtx(projectRoot, {
    packageOwnedRoutes: true,
    designTokenPanel: true,
    designTokenPanelConfigModule,
  });
  routesPlugin.setup!(ctx as never);
  return warnings;
}

describe("routes plugin — DTP shadow diagnostic re-export guard (#3451)", () => {
  it("case 1: exact default re-export from the shadowed route's own entrypoint → silent", () => {
    const warnings = warningsForDocsSlugFixture(
      `export { default, paths, frontmatter } from "${DOCS_SLUG_ENTRYPOINT}";\n`,
    );
    expect(warnings).toHaveLength(0);
  });

  it("case 2: specifier appears only in a comment → warns", () => {
    const warnings = warningsForDocsSlugFixture(
      `// export { default, paths, frontmatter } from "${DOCS_SLUG_ENTRYPOINT}";\n` +
        "export default function Page() { return null; }\n",
    );
    expect(warnings).toHaveLength(1);
  });

  it("case 3: unused import of the specifier → warns", () => {
    const warnings = warningsForDocsSlugFixture(
      `import "${DOCS_SLUG_ENTRYPOINT}";\n` +
        "export default function Page() { return null; }\n",
    );
    expect(warnings).toHaveLength(1);
  });

  it("case 4: imports a different package route than the one shadowed → warns", () => {
    const warnings = warningsForDocsSlugFixture(
      'export { default, paths } from "@takazudo/zudo-doc/routes/locale-index";\n',
    );
    expect(warnings).toHaveLength(1);
  });

  it("case 5: imports the package route but exports its own default → warns", () => {
    const warnings = warningsForDocsSlugFixture(
      `import DocsSlug, { paths, frontmatter } from "${DOCS_SLUG_ENTRYPOINT}";\n` +
        "export default function CustomPage(props) { return DocsSlug(props); }\n" +
        "export { paths, frontmatter };\n",
    );
    expect(warnings).toHaveLength(1);
  });

  it("case 6: genuine stub with no package-route reference at all → warns", () => {
    const warnings = warningsForDocsSlugFixture("export default function Page() { return null; }\n");
    expect(warnings).toHaveLength(1);
  });

  it("the warning text states the re-export heuristic's limits", () => {
    const warnings = warningsForDocsSlugFixture("export default function Page() { return null; }\n");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("re-exports a shadowed route's own entrypoint");
    expect(warnings[0]).toContain("best-effort text scan");
  });
});

// ---------------------------------------------------------------------------
// The extracted warn/silent predicate (#3434). `deriveRoutes` always emits a
// counted `/docs/[[...slug]]`, so the empty-denominator case is unreachable
// through `setup()` — calling the helper directly is the only way to prove the
// vacuity guard is live rather than dead code.
// ---------------------------------------------------------------------------

describe("shouldWarnDtpFullyShadowed — vacuity guard (#3434)", () => {
  const alwaysShadowed = () => true;

  it("returns false for an empty route list (never vacuously true)", () => {
    expect(shouldWarnDtpFullyShadowed([], alwaysShadowed)).toBe(false);
  });

  it("returns false when no route is tagged reader-facing, however shadowed", () => {
    expect(
      shouldWarnDtpFullyShadowed(
        [
          { pattern: "/sitemap.xml", includedInDtpShadowDiagnostic: false },
          { pattern: "/robots.txt", includedInDtpShadowDiagnostic: false },
        ],
        alwaysShadowed,
      ),
    ).toBe(false);
  });

  it("ignores unshadowed non-reader-facing routes when deciding", () => {
    const shadowed = new Set(["/docs/[[...slug]]"]);
    expect(
      shouldWarnDtpFullyShadowed(
        [
          { pattern: "/404", includedInDtpShadowDiagnostic: false },
          { pattern: "/sitemap.xml", includedInDtpShadowDiagnostic: false },
          { pattern: "/docs/[[...slug]]", includedInDtpShadowDiagnostic: true },
        ],
        (pattern) => shadowed.has(pattern),
      ),
    ).toBe(true);
  });

  it("returns false while any reader-facing route survives", () => {
    const shadowed = new Set(["/docs/[[...slug]]"]);
    expect(
      shouldWarnDtpFullyShadowed(
        [
          { pattern: "/docs/[[...slug]]", includedInDtpShadowDiagnostic: true },
          { pattern: "/docs/tags", includedInDtpShadowDiagnostic: true },
        ],
        (pattern) => shadowed.has(pattern),
      ),
    ).toBe(false);
  });
});

describe("routes plugin — design-token-panel-config specifier is routes-only (#3396)", () => {
  const importers = collectSourceFiles(SRC_ROOT)
    .filter((file) =>
      new RegExp(String.raw`\bfrom\s+(["'])${DTP_CONFIG_SPECIFIER}\1`).test(
        readFileSync(file, "utf8"),
      ),
    )
    .map((file) => relative(SRC_ROOT, file).split("\\").join("/"));

  it("exactly one source module imports the specifier", () => {
    expect(importers).toEqual(["routes/_design-token-panel-bootstrap.tsx"]);
  });

  it("the generic bootstrap module binds the package-default builder instead", () => {
    const source = readFileSync(join(SRC_ROOT, "design-token-panel-bootstrap.tsx"), "utf8");
    expect(source).toContain('from "./design-token-panel-config/index.js"');
    expect(source).not.toContain(`from "${DTP_CONFIG_SPECIFIER}"`);
  });
});
