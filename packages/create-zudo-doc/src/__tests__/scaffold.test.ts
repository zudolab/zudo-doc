import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";
import { validateProjectName } from "../utils.js";
import { createZudoDoc } from "../api.js";

const TEMP_PREFIX = "create-zudo-doc-test-";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.remove(tempDir);
});

/** Helper: check that a path exists inside the scaffolded project */
function projectPath(...segments: string[]): string {
  return path.join(tempDir, segments[0]!, ...segments.slice(1));
}

/**
 * Absolute path to a `@takazudo/zudo-doc` package factory source, relative to
 * this test file. Several behaviors that used to live in the generated
 * `pages/lib/*` stubs were relocated into package factories in epic #2344 (S5);
 * the regression tests for those behaviors now assert the package source so the
 * behavior stays guarded where it actually lives. Resolution: src/__tests__ →
 * repo root → packages/zudo-doc/src/...
 */
function packageSrcPath(...segments: string[]): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../packages/zudo-doc/src",
    ...segments,
  );
}

describe("scaffold — minimal (no i18n, search only, single dark scheme)", () => {
  const choices: UserChoices = {
    projectName: "test-minimal",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "sidebarFilter"],
    packageManager: "pnpm",
  };

  // Every test below reads the same scaffold output and none mutate the
  // tree, so `choices` is scaffolded once in beforeAll instead of once per
  // `it` (#2531 — dedupe scaffold() calls). This shadows the module-level
  // `projectPath` for this describe only.
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(choices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("creates package.json with correct name", async () => {
    const pkgPath = projectPath("test-minimal", "package.json");
    expect(await fs.pathExists(pkgPath)).toBe(true);
    const pkg = await fs.readJson(pkgPath);
    expect(pkg.name).toBe("test-minimal");
  });

  // migration guard: scaffold output must produce zfb.config.ts and never produce astro.config.ts (post-cutover invariant)
  it("creates zfb.config.ts (not astro.config.ts)", async () => {
    expect(
      await fs.pathExists(projectPath("test-minimal", "zfb.config.ts")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-minimal", "astro.config.ts")),
    ).toBe(false);
  });

  it("creates src/config/settings.ts", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-minimal", "src/config/settings.ts"),
      ),
    ).toBe(true);
  });

  it("seeds .zudo-doc.json with packageVersion and empty ejected map", async () => {
    const provenancePath = projectPath("test-minimal", ".zudo-doc.json");
    expect(await fs.pathExists(provenancePath)).toBe(true);
    const provenance = await fs.readJson(provenancePath);
    expect(typeof provenance.packageVersion).toBe("string");
    // Version must be a bare semver (no caret), e.g. "0.2.22"
    expect(provenance.packageVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(provenance.ejected).toEqual({});
  });

  it("creates starter content", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-minimal",
          "src/content/docs/getting-started/index.mdx",
        ),
      ),
    ).toBe(true);
  });

  it("getting-started/index.mdx is a category-top with <CategoryNav", async () => {
    const content = await fs.readFile(
      projectPath(
        "test-minimal",
        "src/content/docs/getting-started/index.mdx",
      ),
      "utf-8",
    );
    expect(content).toContain("<CategoryNav");
  });

  it("getting-started/index.mdx does NOT contain an h1 heading (no '# ' line)", async () => {
    const content = await fs.readFile(
      projectPath(
        "test-minimal",
        "src/content/docs/getting-started/index.mdx",
      ),
      "utf-8",
    );
    const lines = content.split("\n");
    const h1Lines = lines.filter((line) => /^# /.test(line));
    expect(h1Lines).toHaveLength(0);
  });

  it("creates getting-started child docs (introduction.mdx and installation.mdx)", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-minimal",
          "src/content/docs/getting-started/introduction.mdx",
        ),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath(
          "test-minimal",
          "src/content/docs/getting-started/installation.mdx",
        ),
      ),
    ).toBe(true);
  });

  it("child docs contain sidebar_position frontmatter", async () => {
    for (const child of ["introduction.mdx", "installation.mdx"]) {
      const content = await fs.readFile(
        projectPath(
          "test-minimal",
          `src/content/docs/getting-started/${child}`,
        ),
        "utf-8",
      );
      expect(content).toContain("sidebar_position:");
    }
  });

  it("does NOT create [locale] pages directory (i18n off)", async () => {
    expect(
      await fs.pathExists(projectPath("test-minimal", "src/pages/[locale]")),
    ).toBe(false);
  });

  it("does NOT create docs-ja content directory (i18n off)", async () => {
    expect(
      await fs.pathExists(projectPath("test-minimal", "src/content/docs-ja")),
    ).toBe(false);
  });

  it("does NOT include mock-init component (aiAssistant off by default)", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-minimal", "src/components/mock-init.tsx"),
      ),
    ).toBe(false);
  });

  // W6A (#1734): ai-chat-modal stays always-on with a no-op stub in base so
  // the mirrored pages/lib/_body-end-islands import closure resolves in every
  // scaffold variant. The stub returns null; a future feature flag can swap
  // it out. Spec-lock §1.5.
  it("ships ai-chat-modal as a no-op stub (W6A — base template)", async () => {
    const stubPath = projectPath(
      "test-minimal",
      "src/components/ai-chat-modal.tsx",
    );
    expect(await fs.pathExists(stubPath)).toBe(true);
    const content = await fs.readFile(stubPath, "utf-8");
    expect(content).toContain("W6A stub");
    expect(content).toContain("return null");
    expect(content).toContain("export default");
  });

  // W6A (#1734): doc-history component stays always-on with a no-op stub in
  // base. The docHistory feature template overwrites the stub with the real
  // island when enabled. Spec-lock Decision 5.
  it("ships doc-history as a no-op stub when docHistory feature is off (W6A)", async () => {
    const stubPath = projectPath(
      "test-minimal",
      "src/components/doc-history.tsx",
    );
    expect(await fs.pathExists(stubPath)).toBe(true);
    const content = await fs.readFile(stubPath, "utf-8");
    expect(content).toContain("W6A stub");
    expect(content).toContain("return null");
    expect(content).toContain("export default");
    expect(content).toContain("DocHistory");
  });

  // W6A (#1734): desktop-sidebar-toggle stays always-on with a no-op stub in
  // base. The sidebarToggle feature template overwrites the stub with the real
  // island when enabled. Spec-lock Decision 5.
  it("ships desktop-sidebar-toggle as a no-op stub when sidebarToggle feature is off (W6A)", async () => {
    const stubPath = projectPath(
      "test-minimal",
      "src/components/desktop-sidebar-toggle.tsx",
    );
    expect(await fs.pathExists(stubPath)).toBe(true);
    const content = await fs.readFile(stubPath, "utf-8");
    expect(content).toContain("W6A stub");
    expect(content).toContain("return null");
    expect(content).toContain("export default");
  });

  // #2057 → zfb#1001: the scanner-visible Toc/MobileToc/ThemeToggle shims were
  // removed once generated projects' pinned zfb (>= 0.1.0-next.39) began
  // scanning npm-dist "use client" modules — the package islands register
  // directly. Shipping the shims again would recreate island marker-name
  // collisions (zfb keeps one and warns).
  it("does not ship scanner-visible Toc/MobileToc/ThemeToggle shims (zfb#1001)", async () => {
    for (const shim of [
      "src/components/toc.tsx",
      "src/components/mobile-toc.tsx",
      "src/components/theme-toggle.tsx",
    ]) {
      expect(await fs.pathExists(projectPath("test-minimal", shim))).toBe(
        false,
      );
    }
  });

  // #2057/#2067: the doc-page shell mounts the package Toc/MobileToc via the
  // override props and derives the TOC title from getTocTitle.
  //
  // Post-collapse (epic #2420, GENSYNC #2429): `_doc-page-shell.tsx` and
  // `_toc-title.ts` were removed from the scaffold template — the host collapsed
  // all per-component chrome shells into `_chrome.ts`. The generated project no
  // longer emits those files; the behavior lives entirely in the package factory.
  // The version-pin guard (0.2.3+) remains: `getTocTitle` still ships from the
  // `@takazudo/zudo-doc/toc` entrypoint the package re-exports.
  it("wires tocOverride/mobileTocOverride in _doc-page-shell with the _toc-title helper (#2057)", async () => {
    // Scaffold no longer emits these files (collapsed into _chrome.ts, #2420).
    expect(
      await fs.pathExists(projectPath("test-minimal", "pages/lib/_doc-page-shell.tsx")),
    ).toBe(false);
    expect(
      await fs.pathExists(projectPath("test-minimal", "pages/lib/_toc-title.ts")),
    ).toBe(false);

    // The Toc/MobileToc mount + override wiring lives in the package factory.
    const shellFactory = await fs.readFile(
      packageSrcPath("doc-page-shell/index.tsx"),
      "utf-8",
    );
    expect(shellFactory).toContain(
      'import { Toc, MobileToc, getTocTitle } from "../toc/index.js";',
    );
    expect(shellFactory).toContain("tocOverride={tocOverride}");
    expect(shellFactory).toContain("mobileTocOverride={mobileTocOverride}");
    // The factory derives the title from the injected getTocTitle dependency.
    expect(shellFactory).toContain("getTocTitle(locale)");

    // The re-export only resolves because the scaffolded @takazudo/zudo-doc
    // exports ./toc (getTocTitle), which landed in 0.2.3. Guard the pinned
    // version so dropping below 0.2.3 fails loudly instead of silently
    // reintroducing the duplicate map (#2067).
    const pkg = await fs.readJson(projectPath("test-minimal", "package.json"));
    const zudoDocDep = pkg.dependencies["@takazudo/zudo-doc"] as string;
    const versionMatch = zudoDocDep.match(/^\^?(\d+)\.(\d+)\.(\d+)/);
    expect(versionMatch).not.toBeNull();
    const major = Number(versionMatch![1]);
    const minor = Number(versionMatch![2]);
    const patch = Number(versionMatch![3]);
    expect(major > 0 || minor > 2 || (minor === 2 && patch >= 3)).toBe(true);
  });

  it(".gitignore includes standard Node + macOS + Cloudflare entries", async () => {
    const gitignore = await fs.readFile(
      projectPath("test-minimal", ".gitignore"),
      "utf-8",
    );
    // Build output (existing entries preserved)
    expect(gitignore).toContain("node_modules");
    expect(gitignore).toContain("dist");
    expect(gitignore).toContain(".zfb");
    // macOS
    expect(gitignore).toContain(".DS_Store");
    // Environment
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".env.local");
    expect(gitignore).toContain(".env.*.local");
    // Logs
    expect(gitignore).toContain("*.log");
    expect(gitignore).toContain("npm-debug.log*");
    expect(gitignore).toContain("yarn-debug.log*");
    expect(gitignore).toContain("pnpm-debug.log*");
    // Cloudflare Wrangler
    expect(gitignore).toContain(".wrangler/");
    // zudo-doc build artifact (routes-src/ staged here for packageOwnedRoutes)
    expect(gitignore).toContain(".zudo-doc/");
  });

  it(".gitignore does NOT include Tauri entries when tauri is disabled", async () => {
    const gitignore = await fs.readFile(
      projectPath("test-minimal", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).not.toContain("src-tauri/target");
    expect(gitignore).not.toContain("src-tauri/gen");
  });

  it(".npmrc exempts undici-types from pnpm's trust-downgrade policy", async () => {
    // Regression guard for zudolab/zudo-doc#2150: without this exclusion a
    // consumer (or the preset-swap slow test) running `pnpm install` under
    // trust-policy=no-downgrade aborts with ERR_PNPM_TRUST_DOWNGRADE on
    // undici-types@6.21.0 (transitive dep of @types/node@^22).
    const npmrc = await fs.readFile(
      projectPath("test-minimal", ".npmrc"),
      "utf-8",
    );
    expect(npmrc).toContain("trust-policy-exclude[]=undici-types@6.21.0");
  });
});

describe("scaffold — sidebarToggle feature", () => {
  // Both tests below scaffold the identical `search` + `sidebarToggle`
  // config (only projectName differed) — scaffold once in beforeAll instead
  // of once per `it` (#2531 — dedupe scaffold() calls). This shadows the
  // module-level `projectPath` for this describe only; the canonical
  // projectName is "test-sidebar-toggle-on" (from the first test).
  const choices: UserChoices = {
    projectName: "test-sidebar-toggle-on",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "sidebarToggle"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(choices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  // #2200: the desktop-sidebar-toggle no longer carries a host-side SPA-nav
  // flash guard. zfb-runtime >= 0.1.0-next.52 preserves runtime <html>
  // attributes across swaps via <ClientRouter preserveHtmlAttrs={[…]} /> (mounted
  // in @takazudo/zudo-doc's doc-layout), so `data-sidebar-hidden` survives the
  // swap before paint. The component just persists the toggle state — it does
  // NOT import the navigation lifecycle events or set the
  // `data-sidebar-no-transition` marker (the retired #2198 workaround).
  //
  // S2 (#2347 / package-first-migration Wave 3 epic #2344): DesktopSidebarToggle
  // island relocated into @takazudo/zudo-doc/desktop-sidebar-toggle-island.
  // The generated file is now a thin re-export shim; the sidebar-state logic
  // (`data-sidebar-hidden`, `SIDEBAR_STORAGE_KEY`) lives in the package.
  it("desktop-sidebar-toggle.tsx persists sidebar state without a host-side SPA-nav flash guard (#2200)", async () => {
    const content = await fs.readFile(
      projectPath(
        "test-sidebar-toggle-on",
        "src/components/desktop-sidebar-toggle.tsx",
      ),
      "utf-8",
    );
    // S2: the file is a thin re-export shim — the implementation moved into
    // @takazudo/zudo-doc/desktop-sidebar-toggle-island. Verify the shim:
    // (a) forwards DesktopSidebarToggle and SIDEBAR_STORAGE_KEY from the package,
    // (b) does not inline the retired #2198 SPA-nav workaround, and
    // (c) does not duplicate the island implementation.
    expect(content).toContain("DesktopSidebarToggle");
    expect(content).toContain("SIDEBAR_STORAGE_KEY");
    expect(content).toMatch(
      /from\s+['"]@takazudo\/zudo-doc\/desktop-sidebar-toggle-island['"]/,
    );
    // The retired #2198 workaround must be gone: no lifecycle-event import,
    // no per-swap capture/restore guard, no transition-suppression marker.
    expect(content).not.toMatch(
      /from\s+['"]@takazudo\/zudo-doc\/transitions['"]/,
    );
    expect(content).not.toContain("BEFORE_NAVIGATE_EVENT");
    expect(content).not.toContain("AFTER_NAVIGATE_EVENT");
    expect(content).not.toContain("data-sidebar-no-transition");
    // Not a full island implementation — no useState, no useEffect.
    expect(content).not.toContain("useState");
    expect(content).not.toContain("data-sidebar-hidden");
  });

  it("generated package.json pins @takazudo/zudo-doc (W4A — runtime dep)", async () => {
    const pkg = await fs.readJson(
      projectPath("test-sidebar-toggle-on", "package.json"),
    );
    expect(pkg.dependencies["@takazudo/zudo-doc"]).toBeDefined();
    expect(pkg.dependencies["@takazudo/zudo-doc"]).toMatch(/^\^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });
});

describe("scaffold — full features (i18n, light-dark, all features)", () => {
  const choices: UserChoices = {
    projectName: "test-full",
    defaultLang: "en",
    colorSchemeMode: "light-dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
    defaultMode: "dark",
    features: [
      "i18n",
      "search",
      "sidebarFilter",
      "claudeResources",
      "designTokenPanel",
    ],
    packageManager: "pnpm",
  };

  // Every test below reads the same scaffold output and none mutate the
  // tree, so `choices` is scaffolded once in beforeAll instead of once per
  // `it` (#2531 — dedupe scaffold() calls). This shadows the module-level
  // `projectPath` for this describe only.
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(choices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("creates docs-ja starter content", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-full",
          "src/content/docs-ja/getting-started/index.mdx",
        ),
      ),
    ).toBe(true);
  });

  it("docs-ja/getting-started/index.mdx is a category-top with <CategoryNav", async () => {
    const content = await fs.readFile(
      projectPath(
        "test-full",
        "src/content/docs-ja/getting-started/index.mdx",
      ),
      "utf-8",
    );
    expect(content).toContain("<CategoryNav");
  });

  it("creates docs-ja getting-started child docs (introduction.mdx and installation.mdx)", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-full",
          "src/content/docs-ja/getting-started/introduction.mdx",
        ),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath(
          "test-full",
          "src/content/docs-ja/getting-started/installation.mdx",
        ),
      ),
    ).toBe(true);
  });

  it("docs-ja child docs contain sidebar_position frontmatter", async () => {
    for (const child of ["introduction.mdx", "installation.mdx"]) {
      const content = await fs.readFile(
        projectPath(
          "test-full",
          `src/content/docs-ja/getting-started/${child}`,
        ),
        "utf-8",
      );
      expect(content).toContain("sidebar_position:");
    }
  });

  it("includes Claude Resources integration", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/integrations/claude-resources"),
      ),
    ).toBe(true);
  });

  it("includes zdtp bootstrap and config when designTokenPanel is enabled", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/lib/design-token-panel-bootstrap.ts"),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/config/design-token-panel-config.ts"),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/config/design-tokens-manifest.ts"),
      ),
    ).toBe(true);
    // W3B (#1730): design-token-types.ts moved into @takazudo/zudo-doc/theme,
    // no longer scaffolded into the generated project. Verify the legacy
    // path is absent so a regression that resurrects the duplicate trips.
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/utils/design-token-types.ts"),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/utils/design-token-serde.ts"),
      ),
    ).toBe(false);
  });

  it("does NOT include legacy design-token-tweak panel component", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/components/design-token-tweak"),
      ),
    ).toBe(false);
  });
});

describe("scaffold — generated package.json dependencies", () => {
  const choices: UserChoices = {
    projectName: "test-deps",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "sidebarFilter"],
    packageManager: "pnpm",
  };

  // Every test below reads the same scaffold output and none mutate the
  // tree, so `choices` is scaffolded once in beforeAll instead of once per
  // `it` (#2531 — dedupe scaffold() calls). This shadows the module-level
  // `projectPath` for this describe only.
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(choices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("includes remark-directive in dependencies", async () => {
    const pkg = await fs.readJson(
      projectPath("test-deps", "package.json"),
    );
    expect(pkg.dependencies["remark-directive"]).toBeDefined();
  });

  it("includes pagefind in devDependencies when search is enabled", async () => {
    const pkg = await fs.readJson(
      projectPath("test-deps", "package.json"),
    );
    expect(pkg.devDependencies["pagefind"]).toBeDefined();
  });

  it("does NOT include @takazudo/zdtp when designTokenPanel is disabled", async () => {
    const pkg = await fs.readJson(
      projectPath("test-deps", "package.json"),
    );
    expect(pkg.dependencies["@takazudo/zdtp"]).toBeUndefined();
  });
});

describe("scaffold — designTokenPanel package.json wiring", () => {
  it("includes @takazudo/zdtp dep at the pinned npm version when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-zdtp-deps",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(
      projectPath("test-zdtp-deps", "package.json"),
    );
    expect(pkg.dependencies["@takazudo/zdtp"]).toBe("0.4.5");
  });
});

describe("scaffold — generated settings.ts content", () => {
  // 5 of the tests below (cjkFriendly default, packageOwnedRoutes,
  // tagPlacement, toc depth defaults, headingIdStrategy default) all
  // scaffold the identical bare `search`-only config (only projectName
  // differed) — scaffold that config once in beforeAll instead of 5 times
  // (#2531 — dedupe scaffold() calls). The other tests in this describe
  // each need a genuinely distinct config and keep their own per-test
  // scaffold via the module-level `projectPath`/ambient tempDir, so this
  // helper is named `sharedProjectPath` (not `projectPath`) to avoid
  // shadowing those tests' lookups. Canonical projectName is
  // "test-cjk-default" (the first test in the duplicate group).
  const sharedChoices: UserChoices = {
    projectName: "test-cjk-default",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function sharedProjectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(sharedChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("single scheme: settings reflect chosen scheme", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-single",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-single", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('"Default Dark"');
    expect(content).toContain("colorMode: false");
    expect(content).toContain('"Test Settings Single"');
  });

  it("light-dark scheme: settings reflect both schemes and mode config", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-ld",
      defaultLang: "en",
      colorSchemeMode: "light-dark",
      lightScheme: "Default Light",
      darkScheme: "Default Dark",
      respectPrefersColorScheme: true,
      defaultMode: "dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-ld", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('"Default Light"');
    expect(content).toContain('"Default Dark"');
    expect(content).toContain('defaultMode: "dark"');
    expect(content).toContain("respectPrefersColorScheme: true");
  });

  it("i18n enabled: settings include locales config", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-i18n",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["i18n", "search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-i18n", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("locales:");
    expect(content).toContain("ja:");
    expect(content).toContain("docs-ja");
  });

  it("cjkFriendly: defaults to false when not specified", async () => {
    const content = await fs.readFile(
      sharedProjectPath("test-cjk-default", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("cjkFriendly: false");
  });

  it("cjkFriendly: true flows through from preset into generated settings.ts", async () => {
    const choices: UserChoices = {
      projectName: "test-cjk-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      cjkFriendly: true,
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-cjk-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("cjkFriendly: true");
    expect(content).not.toContain("cjkFriendly: false");
  });

  it("cjkFriendly: false from preset emits false in generated settings.ts", async () => {
    const choices: UserChoices = {
      projectName: "test-cjk-off-explicit",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      cjkFriendly: false,
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-cjk-off-explicit", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("cjkFriendly: false");
  });

  it("packageOwnedRoutes: generated settings always contain packageOwnedRoutes: true", async () => {
    const content = await fs.readFile(
      sharedProjectPath("test-cjk-default", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("packageOwnedRoutes: true");
  });

  it("tagPlacement: generated settings default to after-title", async () => {
    const content = await fs.readFile(
      sharedProjectPath("test-cjk-default", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('tagPlacement: "after-title"');
  });

  it("designTokenPanel: settings reflect panel enabled and keep the deprecated alias", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-tweak",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-tweak", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("designTokenPanel: true");
  });

  it("tocMinDepth and tocMaxDepth default to 2 and 4 in generated settings", async () => {
    const content = await fs.readFile(
      sharedProjectPath("test-cjk-default", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("tocMinDepth: 2");
    expect(content).toContain("tocMaxDepth: 4");
  });

  it("headingIdStrategy defaults to hierarchical in generated settings", async () => {
    const content = await fs.readFile(
      sharedProjectPath("test-cjk-default", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain(
      'headingIdStrategy: "hierarchical" as "flat" | "hierarchical"',
    );
  });
});

describe("scaffold — docHistory feature", () => {
  // The 9 tests below collapse to 4 distinct configs (only projectName
  // differed within each group): "search"+"docHistory" (4 tests, canonical
  // "test-dh-on"), bare "search" (3 tests, canonical "test-dh-no-diff-css"),
  // plus 2 genuinely unique configs (header-footer-tweak, body-foot-util-auto).
  // Scaffold each distinct config once in beforeAll instead of once per `it`
  // (#2531 — dedupe scaffold() calls). This shadows the module-level
  // `projectPath` for this describe only.
  const dhOnChoices: UserChoices = {
    projectName: "test-dh-on",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "docHistory"],
    packageManager: "pnpm",
  };
  const dhOffChoices: UserChoices = {
    projectName: "test-dh-no-diff-css",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };
  const headerFooterTweakChoices: UserChoices = {
    projectName: "test-header-footer-tweak",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "docHistory", "designTokenPanel", "bodyFootUtil"],
    githubUrl: "https://github.com/example/demo",
    packageManager: "pnpm",
  };
  const bodyFootUtilAutoChoices: UserChoices = {
    projectName: "test-body-foot-util-auto",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "bodyFootUtil"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(dhOnChoices);
    await scaffold(dhOffChoices);
    await scaffold(headerFooterTweakChoices);
    await scaffold(bodyFootUtilAutoChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("settings have docHistory: true when enabled", async () => {
    const content = await fs.readFile(
      projectPath("test-dh-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("docHistory: true");
  });

  it("injects the diff-viewer CSS into global.css when docHistory is enabled (#2081)", async () => {
    const css = await fs.readFile(
      projectPath("test-dh-on", "src/styles/global.css"),
      "utf-8",
    );
    expect(css).toContain(".diff-row {");
    expect(css).toContain(".diff-line-num {");
    // Per-line separators ship at the demoted 15% muted mix (#2077)
    expect(css).toContain("color-mix(in oklch, var(--color-muted) 15%, transparent)");
  });

  it("does NOT inject the diff-viewer CSS when docHistory is disabled", async () => {
    const css = await fs.readFile(
      projectPath("test-dh-no-diff-css", "src/styles/global.css"),
      "utf-8",
    );
    expect(css).not.toContain(".diff-row {");
  });

  it("includes @takazudo/zudo-doc-history-server dep when docHistory is enabled (W8A — #1739)", async () => {
    const pkg = await fs.readJson(
      projectPath("test-dh-on", "package.json"),
    );
    // @takazudo/zudo-doc's pre-build integration eagerly imports
    // @takazudo/zudo-doc-history-server/git-history at plugin init; without
    // this dep the plugin host fails at ERR_MODULE_NOT_FOUND before any
    // page builds.
    expect(pkg.dependencies["@takazudo/zudo-doc-history-server"]).toBeDefined();
    expect(pkg.dependencies["@takazudo/zudo-doc-history-server"]).toMatch(/^\^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it("does NOT include @takazudo/zudo-doc-history-server dep when docHistory is disabled", async () => {
    const pkg = await fs.readJson(
      projectPath("test-dh-no-diff-css", "package.json"),
    );
    expect(pkg.dependencies["@takazudo/zudo-doc-history-server"]).toBeUndefined();
  });

  it("settings have docHistory: false when disabled", async () => {
    const content = await fs.readFile(
      projectPath("test-dh-no-diff-css", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("docHistory: false");
  });

  it("emits bodyFootUtilArea defaults and headerRightItems", async () => {
    const content = await fs.readFile(
      projectPath("test-header-footer-tweak", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain(
      'githubUrl: "https://github.com/example/demo"',
    );
    expect(content).toContain("bodyFootUtilArea: {");
    expect(content).toContain("viewSourceLink: true");
    expect(content).toContain('trigger: "design-token-panel"');
    expect(content).toContain('component: "github-link"');
  });

  it("omits bodyFootUtilArea when bodyFootUtil feature is not selected", async () => {
    const content = await fs.readFile(
      projectPath("test-dh-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("bodyFootUtilArea: false");
    expect(content).toContain("githubUrl: false");
  });

  it("auto-enables docHistory when bodyFootUtil is selected without it", async () => {
    const content = await fs.readFile(
      projectPath("test-body-foot-util-auto", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("docHistory: true");
    expect(content).toContain("bodyFootUtilArea: {");
  });
});

describe("scaffold — headerRightItems preset override (sub #440)", () => {
  it("emits user-supplied headerRightItems verbatim and in chosen order", async () => {
    const choices: UserChoices = {
      projectName: "test-hri-override",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      // designTokenPanel must be in features so the "design-token-panel" trigger
      // is not stripped by the defensive filter in settings-gen (#2162).
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
      headerRightItems: [
        { type: "component", component: "theme-toggle" },
        { type: "trigger", trigger: "design-token-panel" },
        { type: "component", component: "github-link" },
        { type: "trigger", trigger: "ai-chat" },
        { type: "component", component: "search" },
      ],
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-override", "src/config/settings.ts"),
      "utf-8",
    );
    // Extract the headerRightItems block to assert exact order.
    const blockMatch = content.match(
      /headerRightItems:\s*\[([\s\S]*?)\]\s*satisfies\s+HeaderRightItem\[\]\s*as\s+HeaderRightItem\[\],/,
    );
    expect(blockMatch).not.toBeNull();
    const block = blockMatch![1]!;
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).toEqual([
      `{ type: "component", component: "theme-toggle" },`,
      `{ type: "trigger", trigger: "design-token-panel" },`,
      `{ type: "component", component: "github-link" },`,
      `{ type: "trigger", trigger: "ai-chat" },`,
      `{ type: "component", component: "search" },`,
    ]);
  });

  it("falls back to hardcoded default when headerRightItems is omitted", async () => {
    const choices: UserChoices = {
      projectName: "test-hri-fallback",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-fallback", "src/config/settings.ts"),
      "utf-8",
    );
    // The legacy hardcoded fallback gates designTokenPanel on the feature.
    expect(content).toContain('trigger: "design-token-panel"');
    expect(content).toContain('component: "github-link"');
    expect(content).toContain('component: "theme-toggle"');
    // ai-chat is not in the legacy fallback path.
    expect(content).not.toContain('trigger: "ai-chat"');
  });

  it("honors an explicit empty headerRightItems array (no items)", async () => {
    // Empty array means "user wants no header-right items at all" — must not
    // silently fall back to the hardcoded default. validatePreset accepts [],
    // and presetToChoices forwards it; settings-gen must honor it too.
    const choices: UserChoices = {
      projectName: "test-hri-empty",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
      headerRightItems: [],
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-empty", "src/config/settings.ts"),
      "utf-8",
    );
    const match = content.match(
      /headerRightItems:\s*\[([\s\S]*?)\]\s*satisfies\s+HeaderRightItem\[\]\s*as\s+HeaderRightItem\[\],/,
    );
    expect(match).toBeTruthy();
    // Block should be empty (whitespace only) — no fallback entries leaked in.
    const matchedBlock = match?.[1] ?? "";
    expect(matchedBlock.trim()).toBe("");
    // Specifically, the legacy fallback's design-token-panel trigger must not
    // appear even though designTokenPanel is in the features list.
    expect(content).not.toContain('trigger: "design-token-panel"');
    expect(content).not.toContain('component: "github-link"');
  });

  it("emits ai-chat verbatim when explicitly listed in the preset", async () => {
    // The runtime filter (filterHeaderRightItems) hides ai-chat when
    // aiAssistant is false in the scaffold, but emission must still preserve
    // the entry so the preset round-trips and so users can flip aiAssistant
    // later without re-editing headerRightItems.
    const choices: UserChoices = {
      projectName: "test-hri-aichat",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
      headerRightItems: [
        { type: "trigger", trigger: "ai-chat" },
        { type: "component", component: "theme-toggle" },
      ],
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-aichat", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('trigger: "ai-chat"');
  });
});

describe("scaffold — search item in default headerRightItems fallback (#2139)", () => {
  // The host header slots the search widget at the `search` component position.
  // Without this item in the generated settings, scaffolded projects silently
  // show no search box even when the search feature is selected (default: true).

  it("emits search item in headerRightItems when search feature is selected (no override)", async () => {
    const choices: UserChoices = {
      projectName: "test-hri-search-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-search-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('component: "search"');
  });

  it("does NOT emit search item in headerRightItems when search feature is absent", async () => {
    // Bare-minimum choices: search removed so the fallback must omit the search entry.
    const choices: UserChoices = {
      projectName: "test-hri-search-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-search-off", "src/config/settings.ts"),
      "utf-8",
    );
    // Only the headerRightItems block must be checked — not any other potential
    // occurrence of "search" in the file.
    const blockMatch = content.match(
      /headerRightItems:\s*\[([\s\S]*?)\]\s*satisfies\s+HeaderRightItem\[\]\s*as\s+HeaderRightItem\[\],/,
    );
    expect(blockMatch).not.toBeNull();
    const block = blockMatch![1]!;
    expect(block).not.toContain('"search"');
  });

  it("search item appears after theme-toggle and before language-switcher in default fallback", async () => {
    const choices: UserChoices = {
      projectName: "test-hri-search-order",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "i18n"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-search-order", "src/config/settings.ts"),
      "utf-8",
    );
    const blockMatch = content.match(
      /headerRightItems:\s*\[([\s\S]*?)\]\s*satisfies\s+HeaderRightItem\[\]\s*as\s+HeaderRightItem\[\],/,
    );
    expect(blockMatch).not.toBeNull();
    const block = blockMatch![1]!;
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const themeIdx = lines.findIndex((l) => l.includes('"theme-toggle"'));
    const searchIdx = lines.findIndex((l) => l.includes('"search"'));
    const langIdx = lines.findIndex((l) => l.includes('"language-switcher"'));
    expect(themeIdx).toBeGreaterThanOrEqual(0);
    expect(searchIdx).toBeGreaterThan(themeIdx);
    expect(langIdx).toBeGreaterThan(searchIdx);
  });

  it("explicit headerRightItems override is unaffected by the search feature gate (#2139)", async () => {
    // User-supplied override must pass through verbatim — the search gate only
    // applies to the default-fallback path, not when choices.headerRightItems
    // is explicitly set.
    const choices: UserChoices = {
      projectName: "test-hri-search-override",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
      headerRightItems: [
        { type: "component", component: "theme-toggle" },
      ],
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-search-override", "src/config/settings.ts"),
      "utf-8",
    );
    const blockMatch = content.match(
      /headerRightItems:\s*\[([\s\S]*?)\]\s*satisfies\s+HeaderRightItem\[\]\s*as\s+HeaderRightItem\[\],/,
    );
    expect(blockMatch).not.toBeNull();
    const block = blockMatch![1]!;
    // Only the explicitly-listed theme-toggle; no auto-injected search.
    expect(block).not.toContain('"search"');
    expect(block).toContain('"theme-toggle"');
  });
});

describe("scaffold — llmsTxt feature", () => {
  it("settings have llmsTxt: true when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-llms-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "llmsTxt"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-llms-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("llmsTxt: true");
  });

  it("settings have llmsTxt: false when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-llms-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-llms-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("llmsTxt: false");
  });
});

describe("scaffold — footer features", () => {
  // The last 2 tests below (metaTags defaults, head-template gating) both
  // scaffold the identical bare `search`-only config (only projectName
  // differed) — scaffold each of the 3 distinct configs used in this
  // describe once in beforeAll instead of once per `it` (#2531 — dedupe
  // scaffold() calls). This shadows the module-level `projectPath` for this
  // describe only.
  const footerNavChoices: UserChoices = {
    projectName: "test-footer-nav",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "footerNavGroup"],
    packageManager: "pnpm",
  };
  const footerCrChoices: UserChoices = {
    projectName: "test-footer-cr",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "footerCopyright"],
    packageManager: "pnpm",
  };
  const footerBothChoices: UserChoices = {
    projectName: "test-footer-both",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "footerNavGroup", "footerCopyright"],
    packageManager: "pnpm",
  };
  const metaTagsDefaultsChoices: UserChoices = {
    projectName: "test-meta-tags-defaults",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(footerNavChoices);
    await scaffold(footerCrChoices);
    await scaffold(footerBothChoices);
    await scaffold(metaTagsDefaultsChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("generates footer with links when footerNavGroup is enabled", async () => {
    const content = await fs.readFile(
      projectPath("test-footer-nav", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("footer: {");
    expect(content).toContain('title: "Docs"');
    expect(content).toContain("Getting Started");
    expect(content).not.toContain("copyright:");
  });

  it("generates footer with copyright when footerCopyright is enabled", async () => {
    const content = await fs.readFile(
      projectPath("test-footer-cr", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("footer: {");
    expect(content).toContain("copyright:");
    expect(content).toContain("links: [],");
  });

  it("generates footer with both links and copyright", async () => {
    const content = await fs.readFile(
      projectPath("test-footer-both", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("footer: {");
    expect(content).toContain('title: "Docs"');
    expect(content).toContain("copyright:");
  });

  // S4 (#2078): metaTags block is emitted unconditionally with scaffold defaults
  // so scaffolded projects are type-correct against the updated
  // _head-with-defaults.tsx template. Choice-driven values (ogImage path,
  // twitterCard type) come in S5.
  it("emits metaTags block unconditionally with scaffold defaults (S4 #2078)", async () => {
    const content = await fs.readFile(
      projectPath("test-meta-tags-defaults", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("metaTags: {");
    expect(content).toContain("description: true,");
    expect(content).toContain("keywords: false,");
    expect(content).toContain("ogImage: false,");
    expect(content).toContain("ogSiteName: true,");
    expect(content).toContain("twitterCard: false,");
    expect(content).toContain("MetaTagsConfig");
  });

  // S4 (#2078): with scaffold defaults (ogImage: false, twitterCard: false,
  // keywords: false) the head injection must gate those tags via
  // settings.metaTags, emit og:title + description + og:site_name, and NOT
  // unconditionally emit og:image / twitter:* / keywords.
  //
  // Post-relocation (epic #2344, S5): the metaTags gating + composeMetaTitle
  // call moved OFF the generated `_head-with-defaults.tsx` stub and INTO the
  // package factory `@takazudo/zudo-doc/head-with-defaults`.
  //
  // Post-collapse (epic #2420, GENSYNC #2429): `_head-with-defaults.tsx` was
  // removed from the scaffold template — chrome wiring collapsed into `_chrome.ts`.
  // The gating logic is asserted against the package factory source.
  it("_head-with-defaults gates og:image/twitter:card/keywords via settings.metaTags (S4 #2078)", async () => {
    // Scaffold no longer emits _head-with-defaults.tsx (collapsed into _chrome.ts, #2420).
    expect(
      await fs.pathExists(projectPath("test-meta-tags-defaults", "pages/lib/_head-with-defaults.tsx")),
    ).toBe(false);

    // The metaTags gating + composeMetaTitle emission now lives in the factory.
    const headSrc = await fs.readFile(
      packageSrcPath("head-with-defaults/index.tsx"),
      "utf-8",
    );
    // og:title is always emitted — DocHead contract (OgTags always emits og:title)
    expect(headSrc).toContain("composeMetaTitle(title)");
    // description is gated on metaTags.description
    expect(headSrc).toContain("metaTags.description");
    // og:site_name is gated on metaTags.ogSiteName
    expect(headSrc).toContain("metaTags.ogSiteName");
    // og:image and twitter:image are gated on metaTags.ogImage
    expect(headSrc).toContain("metaTags.ogImage");
    // twitterCard block is gated on metaTags.twitterCard
    expect(headSrc).toContain("metaTags.twitterCard");
    // keywords are gated on metaTags.keywords
    expect(headSrc).toContain("metaTags.keywords");
    // No hardcoded og:image path (must come from metaTags.ogImage)
    expect(headSrc).not.toContain('"/img/ogp.png"');
    // No unconditional TwitterCard emission
    expect(headSrc).not.toContain('card="summary_large_image"');
  });

});


describe("scaffold — changelog feature", () => {
  // "headerNav does NOT include Changelog" and "headerNav does NOT include
  // Claude" both scaffold the identical bare `search`-only config (only
  // projectName differed) — scaffold each of the 3 distinct configs used in
  // this describe once in beforeAll instead of once per `it` (#2531 —
  // dedupe scaffold() calls). This shadows the module-level `projectPath`
  // for this describe only.
  const changelogOnChoices: UserChoices = {
    projectName: "test-changelog-on",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "changelog"],
    packageManager: "pnpm",
  };
  const noClogChoices: UserChoices = {
    projectName: "test-no-clog",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };
  const claudeNavOnChoices: UserChoices = {
    projectName: "test-claude-nav-on",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "claudeResources"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(changelogOnChoices);
    await scaffold(noClogChoices);
    await scaffold(claudeNavOnChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("headerNav includes Changelog and creates starter content when enabled", async () => {
    const content = await fs.readFile(
      projectPath("test-changelog-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("Changelog");
    expect(content).toContain("/docs/changelog");
    expect(
      await fs.pathExists(
        projectPath(
          "test-changelog-on",
          "src/content/docs/changelog/index.mdx",
        ),
      ),
    ).toBe(true);
  });

  it("headerNav does NOT include Changelog when disabled", async () => {
    const content = await fs.readFile(
      projectPath("test-no-clog", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).not.toContain("/docs/changelog");
  });

  it("headerNav includes Claude when claudeResources enabled", async () => {
    const content = await fs.readFile(
      projectPath("test-claude-nav-on", "src/config/settings.ts"),
      "utf-8",
    );
    // The "claude" categoryMatch is what drives both the header link and the
    // groupSatelliteNodes() nesting of claude-md/claude-skills/... on the index.
    expect(content).toContain('categoryMatch: "claude"');
    expect(content).toContain("/docs/claude");
  });

  it("headerNav does NOT include Claude when claudeResources disabled", async () => {
    const content = await fs.readFile(
      projectPath("test-no-clog", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).not.toContain('categoryMatch: "claude"');
  });
});

describe("scaffold — skillSymlinker feature", () => {
  it("copies setup-doc-skill.sh and adds npm script when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-symlinker-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "skillSymlinker"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-symlinker-on", "scripts/setup-doc-skill.sh"),
      ),
    ).toBe(true);
    const pkg = await fs.readJson(
      projectPath("test-symlinker-on", "package.json"),
    );
    expect(pkg.scripts["setup:doc-skill"]).toBe(
      "bash scripts/setup-doc-skill.sh",
    );
    expect(pkg.scripts["setup:doc-skill-silent"]).toBe(
      "bash scripts/setup-doc-skill.sh --silent",
    );
  });

  it("does NOT include setup-doc-skill.sh when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-symlinker-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-symlinker-off", "scripts/setup-doc-skill.sh"),
      ),
    ).toBe(false);
    const pkg = await fs.readJson(
      projectPath("test-symlinker-off", "package.json"),
    );
    expect(pkg.scripts["setup:doc-skill"]).toBeUndefined();
    expect(pkg.scripts["setup:doc-skill-silent"]).toBeUndefined();
  });
});

describe("scaffold — .gitignore skill block (#2173)", () => {
  it("ignores the deterministic <projectName>-wisdom skill directory when skillSymlinker is on", async () => {
    const choices: UserChoices = {
      projectName: "gitignore-skill-proj",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["skillSymlinker"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const gitignore = await fs.readFile(
      projectPath("gitignore-skill-proj", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain(
      ".claude/skills/gitignore-skill-proj-wisdom/SKILL.md",
    );
    expect(gitignore).toContain(
      ".claude/skills/gitignore-skill-proj-wisdom/docs",
    );
    // No i18n → the script never creates a docs-ja symlink, so no ignore entry.
    expect(gitignore).not.toContain(
      ".claude/skills/gitignore-skill-proj-wisdom/docs-ja",
    );
  });

  it("ignores the docs-ja symlink only when i18n is also enabled", async () => {
    const choices: UserChoices = {
      projectName: "gitignore-skill-ja",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["skillSymlinker", "i18n"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const gitignore = await fs.readFile(
      projectPath("gitignore-skill-ja", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain(
      ".claude/skills/gitignore-skill-ja-wisdom/docs-ja",
    );
  });

  it("emits no skill ignore block when skillSymlinker is off", async () => {
    const choices: UserChoices = {
      projectName: "gitignore-skill-none",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const gitignore = await fs.readFile(
      projectPath("gitignore-skill-none", ".gitignore"),
      "utf-8",
    );
    // The setup-doc-skill.sh script and `setup:doc-skill` npm script are gated
    // on skillSymlinker, so its ignore entries must not be emitted without it.
    expect(gitignore).not.toContain("# Generated doc-lookup skill");
    expect(gitignore).not.toContain(".claude/skills/");
  });
});

describe("scaffold — claudeSkills feature", () => {
  // "ships user-facing zudo-doc-* skills" and "emits b4push stub script"
  // both scaffold the identical `search`+`claudeSkills` config (only
  // projectName differed); "does NOT ship zudo-doc-* skills" and "does NOT
  // emit b4push script" both scaffold the identical bare `search`-only
  // config. Scaffold each of the 2 distinct configs once in beforeAll
  // instead of once per `it` (#2531 — dedupe scaffold() calls). The
  // `it.each` below tests 3 genuinely distinct packageManager configs and
  // keeps its own per-test scaffold via the module-level
  // `projectPath`/ambient tempDir, so this helper is named
  // `sharedProjectPath` (not `projectPath`) to avoid shadowing that test's
  // lookup.
  const claudeSkillsOnChoices: UserChoices = {
    projectName: "test-claude-skills-on",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "claudeSkills"],
    packageManager: "pnpm",
  };
  const claudeSkillsOffChoices: UserChoices = {
    projectName: "test-claude-skills-off",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function sharedProjectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(claudeSkillsOnChoices);
    await scaffold(claudeSkillsOffChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("ships user-facing zudo-doc-* skills when enabled", async () => {
    // The three user-facing skill dirs are present
    for (const skill of [
      "zudo-doc-design-system",
      "zudo-doc-translate",
      "zudo-doc-version-bump",
    ]) {
      expect(
        await fs.pathExists(
          sharedProjectPath("test-claude-skills-on", `.claude/skills/${skill}/SKILL.md`),
        ),
      ).toBe(true);
    }
  });

  it("emits b4push stub script when enabled (sub #414)", async () => {
    const pkg = await fs.readJson(
      sharedProjectPath("test-claude-skills-on", "package.json"),
    );
    expect(pkg.scripts.b4push).toBe("pnpm check && pnpm build");
  });

  it.each([
    ["npm", "npm run check && npm run build"],
    ["yarn", "yarn check && yarn build"],
    ["bun", "bun run check && bun run build"],
  ])(
    "emits b4push script using %s run when package manager is %s",
    async (pm, expected) => {
      const choices: UserChoices = {
        projectName: `test-b4push-${pm}`,
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: ["search", "claudeSkills"],
        packageManager: pm as UserChoices["packageManager"],
      };
      await scaffold(choices);
      const pkg = await fs.readJson(
        projectPath(`test-b4push-${pm}`, "package.json"),
      );
      expect(pkg.scripts.b4push).toBe(expected);
    },
  );

  it("does NOT ship zudo-doc-* skills when disabled", async () => {
    expect(
      await fs.pathExists(
        sharedProjectPath(
          "test-claude-skills-off",
          ".claude/skills/zudo-doc-design-system",
        ),
      ),
    ).toBe(false);
  });

  it("does NOT emit b4push script when disabled (sub #414)", async () => {
    const pkg = await fs.readJson(
      sharedProjectPath("test-claude-skills-off", "package.json"),
    );
    expect(pkg.scripts.b4push).toBeUndefined();
  });
});

describe("scaffold — tauri feature", () => {
  // "does NOT generate src-tauri/" and "does NOT reference FindInPageInit"
  // both scaffold the identical bare `search`-only config (only projectName
  // differed) — scaffold each of the 2 distinct configs used in this
  // describe once in beforeAll instead of once per `it` (#2531 — dedupe
  // scaffold() calls). This shadows the module-level `projectPath` for this
  // describe only.
  const noTauriChoices: UserChoices = {
    projectName: "test-no-tauri",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };
  const tauriOnChoices: UserChoices = {
    projectName: "test-tauri-find-in-page",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "tauri"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(noTauriChoices);
    await scaffold(tauriOnChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("does NOT generate src-tauri/ when tauri is disabled", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-no-tauri", "src-tauri/Cargo.toml"),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath("test-no-tauri", "src/utils/find-in-page.ts"),
      ),
    ).toBe(false);

    const pkg = await fs.readJson(
      projectPath("test-no-tauri", "package.json"),
    );
    expect(pkg.scripts["dev:tauri"]).toBeUndefined();
  });

  it("wires the FindInPageInit island into pages/lib/_body-end-islands.tsx when tauri is enabled", async () => {
    const bodyEnd = await fs.readFile(
      projectPath(
        "test-tauri-find-in-page",
        "pages/lib/_body-end-islands.tsx",
      ),
      "utf-8",
    );
    // The three injections: import, displayName, Island mount. Without them
    // the component files are orphaned and zfb's island scanner never
    // registers FindInPageInit (#2052).
    expect(bodyEnd).toContain(
      'import FindInPageInit from "@/components/find-in-page-init";',
    );
    expect(bodyEnd).toContain('displayName = "FindInPageInit"');
    expect(bodyEnd).toContain("<FindInPageInit />");
    // Keybind interceptor must hydrate at load, not idle.
    expect(bodyEnd).toMatch(/when: "load",\s*\n\s*children: <FindInPageInit \/>/);
    // No leftover slot anchors in the generated output.
    expect(bodyEnd).not.toContain("@slot:");

    // The island entry module must carry the "use client" directive so it
    // is bundled as a live island.
    const initComponent = await fs.readFile(
      projectPath(
        "test-tauri-find-in-page",
        "src/components/find-in-page-init.tsx",
      ),
      "utf-8",
    );
    expect(initComponent.split("\n")[0]).toBe('"use client";');
  });

  it("does NOT reference FindInPageInit in pages/lib/_body-end-islands.tsx when tauri is disabled", async () => {
    const bodyEnd = await fs.readFile(
      projectPath(
        "test-no-tauri",
        "pages/lib/_body-end-islands.tsx",
      ),
      "utf-8",
    );
    expect(bodyEnd).not.toContain("FindInPageInit");
    // No leftover slot anchors in the generated output.
    expect(bodyEnd).not.toContain("@slot:");
  });
});

describe("scaffold — body-end-islands feature gating (#2058)", () => {
  // pages/lib/_body-end-islands.tsx feature-gates the AiChatModal island +
  // sr-only "AI Assistant" landmark on settings.aiAssistant and the
  // ImageEnlarge island on settings.imageEnlarge. These conditionals are part
  // of the wholesale-copied base template, so every scaffold variant carries
  // them regardless of the flag values — a feature-off consumer
  // (aiAssistant/imageEnlarge false) then ships neither the dead island marker
  // nor the misleading landmark heading. The designTokenPanel island is NOT in
  // the base template — it is injected by the designTokenPanel feature (#2162),
  // so with the feature off the file carries no panel reference at all.
  it("gates AiChatModal/heading on aiAssistant and ImageEnlarge on imageEnlarge", async () => {
    const choices: UserChoices = {
      projectName: "test-body-end-gating",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "imageEnlarge"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    const bodyEnd = await fs.readFile(
      projectPath("test-body-end-gating", "pages/lib/_body-end-islands.tsx"),
      "utf-8",
    );
    // AI assistant gating wraps both the island and the landmark heading.
    expect(bodyEnd).toContain("settings.aiAssistant ?");
    expect(bodyEnd).toContain('<h2 class="sr-only">AI Assistant</h2>');
    // Image-enlarge island gating.
    expect(bodyEnd).toContain("settings.imageEnlarge");
    // designTokenPanel feature is OFF here, so its gating/island is injected
    // by the feature elsewhere and the base output carries no panel reference.
    expect(bodyEnd).not.toContain("settings.designTokenPanel");
    expect(bodyEnd).not.toContain("DesignTokenPanel");
    // No leftover slot anchors in the generated output.
    expect(bodyEnd).not.toContain("@slot:");
  });
});

describe("scaffold — tauri-dev feature (Mode 2)", () => {
  it("generates src-tauri-dev/ when tauriDev is enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-tauri-dev",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "tauriDev"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    // src-tauri-dev/ directory exists with key files
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/Cargo.toml")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/src/main.rs")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/tauri.conf.json")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/capabilities/default.json")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/frontend/index.html")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/icons/icon.png")),
    ).toBe(true);

    // package.json has tauri-dev scripts that cd into the src-tauri-dev crate
    const pkg = await fs.readJson(projectPath("test-tauri-dev", "package.json"));
    expect(pkg.scripts["dev:tauri-dev"]).toBe(
      "cd src-tauri-dev && cargo tauri dev",
    );
    expect(pkg.scripts["build:tauri-dev"]).toBe(
      "cd src-tauri-dev && cargo tauri build",
    );
    // Mode 1 tauri scripts must NOT be present (only tauriDev enabled)
    expect(pkg.scripts["dev:tauri"]).toBeUndefined();

    // Cargo.toml package name patched with "-dev" suffix to avoid Mode 1 collision
    const cargo = await fs.readFile(
      projectPath("test-tauri-dev", "src-tauri-dev/Cargo.toml"),
      "utf-8",
    );
    expect(cargo).toContain('name = "test-tauri-dev-dev"');
    expect(cargo).not.toContain('name = "zudo-doc-dev"');

    // tauri.conf.json identity is NOT patched (Mode 2 fixed identity)
    const conf = await fs.readFile(
      projectPath("test-tauri-dev", "src-tauri-dev/tauri.conf.json"),
      "utf-8",
    );
    expect(conf).toContain('"productName": "zudo-doc dev"');

    // .gitignore has src-tauri-dev entries
    const gitignore = await fs.readFile(
      projectPath("test-tauri-dev", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain("src-tauri-dev/target");
    expect(gitignore).toContain("src-tauri-dev/gen");
  });

  it("does NOT generate src-tauri-dev/ when tauriDev is disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-no-tauri-dev",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    expect(
      await fs.pathExists(projectPath("test-no-tauri-dev", "src-tauri-dev/Cargo.toml")),
    ).toBe(false);

    const pkg = await fs.readJson(projectPath("test-no-tauri-dev", "package.json"));
    expect(pkg.scripts["dev:tauri-dev"]).toBeUndefined();
    expect(pkg.scripts["build:tauri-dev"]).toBeUndefined();
  });
});

describe("scaffold — plugin copying and settings", () => {
  const choices: UserChoices = {
    projectName: "test-minimal",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "sidebarFilter"],
    packageManager: "pnpm",
  };

  // Every test below reads the same scaffold output and none mutate the
  // tree, so `choices` is scaffolded once in beforeAll instead of once per
  // `it` (#2531 — dedupe scaffold() calls). This shadows the module-level
  // `projectPath` for this describe only.
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(choices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  // F1 (S4 #2013): the 6 Astro/Shiki-era files (docs-source-map, hast-utils,
  // rehype-code-title, rehype-heading-links, rehype-mermaid, url-utils) were
  // confirmed dead — no generated file imports them. They were deleted from
  // templates/base/src/plugins/ and their deps pruned from generatePackageJson().
  it("does NOT copy dead Astro-era plugin files to src/plugins/ (F1 — #2013)", async () => {
    const deadFiles = [
      "docs-source-map.ts",
      "url-utils.ts",
      "hast-utils.ts",
      "rehype-code-title.ts",
      "rehype-heading-links.ts",
      "rehype-mermaid.ts",
    ];
    for (const file of deadFiles) {
      expect(
        await fs.pathExists(
          projectPath("test-minimal", "src/plugins", file),
        ),
        `dead plugin file src/plugins/${file} must NOT be present in generated output`,
      ).toBe(false);
    }
  });

  it("generated settings.ts contains onBrokenMarkdownLinks set to warn", async () => {
    const content = await fs.readFile(
      projectPath("test-minimal", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("onBrokenMarkdownLinks");
    expect(content).toContain('"warn"');
  });

  // F1 (S4 #2013): github-slugger, @types/hast, @types/mdast, unist-util-visit
  // were only used by the dead src/plugins/*.ts files — pruned from generated
  // package.json.
  it("does NOT include github-slugger in dependencies (F1 — dead dep)", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.dependencies["github-slugger"]).toBeUndefined();
  });

  it("does NOT include @types/hast in devDependencies (F1 — dead dep)", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.devDependencies["@types/hast"]).toBeUndefined();
  });

  it("does NOT include @types/mdast in devDependencies (F1 — dead dep)", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.devDependencies["@types/mdast"]).toBeUndefined();
  });

  it("does NOT include unist-util-visit in dependencies (F1 — dead dep)", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.dependencies["unist-util-visit"]).toBeUndefined();
  });

  it("does NOT include clsx in dependencies (F1 — dead dep)", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.dependencies["clsx"]).toBeUndefined();
  });

  it("includes html-validate in devDependencies", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.devDependencies["html-validate"]).toBeDefined();
  });

  it("includes check:html script", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.scripts["check:html"]).toBe(
      'html-validate "dist/**/*.html"',
    );
  });

  it("includes z-index codegen scripts (#2148, bin re-pointed to package S9b #2334)", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.scripts["gen:z-index"]).toBe("gen-z-index");
    expect(pkg.scripts["check:z-index"]).toBe("gen-z-index --check");
  });

  it("does not emit check:pages (host-only gate — template stubs not type-clean, #2018)", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.scripts["check:pages"]).toBeUndefined();
  });
});

describe("scaffold — CLAUDE.md generation", () => {
  it("creates CLAUDE.md with project name and tech stack", async () => {
    const choices: UserChoices = {
      projectName: "test-claudemd",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "sidebarFilter"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-claudemd", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("# Test Claudemd");
    expect(content).toContain("zudo-doc");
    expect(content).toContain("**zfb**");
    expect(content).toContain("pnpm dev");
    expect(content).toContain("pnpm build");
    expect(content).toContain("docs/            # MDX content");
  });

  it("includes i18n section when i18n is enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-claudemd-i18n",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["i18n", "search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-claudemd-i18n", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("## i18n");
    expect(content).toContain("docs-ja");
  });

  it("does NOT include i18n section when i18n is disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-claudemd-noi18n",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-claudemd-noi18n", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).not.toContain("## i18n");
  });

  it("lists enabled features", async () => {
    const choices: UserChoices = {
      projectName: "test-claudemd-features",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "docHistory", "llmsTxt"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-claudemd-features", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("## Enabled Features");
    expect(content).toContain("**search**");
    expect(content).toContain("**docHistory**");
    expect(content).toContain("**llmsTxt**");
  });

  it("uses the correct package manager in commands", async () => {
    const choices: UserChoices = {
      projectName: "test-claudemd-npm",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "npm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-claudemd-npm", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("npm run dev");
    expect(content).toContain("npm run build");
    expect(content).not.toContain("pnpm");
  });
});

describe("scaffold — frontmatterPreview setting", () => {
  // Both tests below scaffold the identical bare `search`-only config (only
  // projectName differed) — scaffold once in beforeAll instead of once per
  // `it` (#2531 — dedupe scaffold() calls). This shadows the module-level
  // `projectPath` for this describe only; the canonical projectName is
  // "test-fp-default" (from the first test).
  const choices: UserChoices = {
    projectName: "test-fp-default",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(choices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("generated settings.ts contains frontmatterPreview: false by default", async () => {
    const content = await fs.readFile(
      projectPath("test-fp-default", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("frontmatterPreview:");
    expect(content).toContain("FrontmatterPreviewConfig | false");
  });

  it("frontmatter-preview-defaults.ts exists in base template", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-fp-default",
          "src/config/frontmatter-preview-defaults.ts",
        ),
      ),
    ).toBe(true);
  });
});

describe("scaffold — imageEnlarge feature", () => {
  // The 8 tests below collapse to 2 distinct configs (only projectName
  // differed within each group): `search`+`imageEnlarge` (4 tests, canonical
  // "test-ie-on") and bare `search` (4 tests, canonical "test-ie-off").
  // Scaffold each once in beforeAll instead of once per `it` (#2531 —
  // dedupe scaffold() calls). This shadows the module-level `projectPath`
  // for this describe only.
  const ieOnChoices: UserChoices = {
    projectName: "test-ie-on",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "imageEnlarge"],
    packageManager: "pnpm",
  };
  const ieOffChoices: UserChoices = {
    projectName: "test-ie-off",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(ieOnChoices);
    await scaffold(ieOffChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("settings have imageEnlarge: true when enabled", async () => {
    const content = await fs.readFile(
      projectPath("test-ie-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("imageEnlarge: true");
  });

  it("settings have imageEnlarge: false when feature not selected", async () => {
    const content = await fs.readFile(
      projectPath("test-ie-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("imageEnlarge: false");
  });

  it("island file src/components/image-enlarge.tsx exists when enabled", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-ie-on", "src/components/image-enlarge.tsx"),
      ),
    ).toBe(true);
  });

  // W6A (#1734): image-enlarge stays always-on with a no-op stub in base
  // (carries both the default export and the ImageEnlargeSsrFallback named
  // export the body-end Island wrapper imports). The imageEnlarge feature
  // template overwrites the stub with the real island when enabled.
  it("ships image-enlarge as a no-op stub when imageEnlarge feature is off (W6A)", async () => {
    const stubPath = projectPath(
      "test-ie-off",
      "src/components/image-enlarge.tsx",
    );
    expect(await fs.pathExists(stubPath)).toBe(true);
    const content = await fs.readFile(stubPath, "utf-8");
    expect(content).toContain("W6A stub");
    expect(content).toContain("return null");
    expect(content).toContain("export default");
    expect(content).toContain("ImageEnlargeSsrFallback");
  });

  it("rehype-image-enlarge.ts is NOT present (removed in S2 — replaced by MDX p-override)", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-ie-off", "src/plugins/rehype-image-enlarge.ts"),
      ),
    ).toBe(false);
  });

  it("zfb.config.ts does not contain Astro-specific rehype symbols (imageEnlarge is a layout island)", async () => {
    const config = await fs.readFile(
      projectPath("test-ie-on", "zfb.config.ts"),
      "utf-8",
    );
    // imageEnlarge is now a userland p-override — not wired via the zfb config.
    expect(config).not.toContain("rehypeImageEnlarge");
    // imageEnlarge key was removed from zfb next.18 Rust config schema.
    expect(config).not.toContain("imageEnlarge:");
  });

  it("pages/_mdx-components.ts is absent (MDX wiring collapsed into _chrome.ts, #2420)", async () => {
    // Post-collapse (epic #2420, GENSYNC #2429): _mdx-components.ts was removed
    // from the template. MDX extras (HtmlPreview, Details, Island, etc.) are now
    // wired inside _chrome.ts via hostBindings.mdxExtras.
    expect(
      await fs.pathExists(projectPath("test-ie-on", "pages/_mdx-components.ts")),
    ).toBe(false);
  });

  it("pages/_mdx-components.ts is absent when imageEnlarge is disabled (#2420)", async () => {
    // Post-collapse (epic #2420, GENSYNC #2429): same absence regardless of feature.
    expect(
      await fs.pathExists(projectPath("test-ie-off", "pages/_mdx-components.ts")),
    ).toBe(false);
  });

});

describe("scaffold — tagGovernance feature", () => {
  it("settings emit warn + tagVocabulary=true when enabled, and scripts+devDeps are added", async () => {
    const choices: UserChoices = {
      projectName: "test-tag-gov-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "tagGovernance"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    const settings = await fs.readFile(
      projectPath("test-tag-gov-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).toContain('tagGovernance: "warn"');
    expect(settings).toContain("tagVocabulary: true");

    // Scripts shipped by the feature
    expect(
      await fs.pathExists(
        projectPath("test-tag-gov-on", "scripts/tags-audit.ts"),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath("test-tag-gov-on", "scripts/tags-suggest.ts"),
      ),
    ).toBe(true);

    // package.json has scripts + devDeps
    const pkg = await fs.readJson(
      projectPath("test-tag-gov-on", "package.json"),
    );
    // S9b #2334: tags:audit now uses the package bin
    expect(pkg.scripts["tags:audit"]).toBe("tags-audit");
    expect(pkg.scripts["tags:suggest"]).toBe("tsx scripts/tags-suggest.ts");
    for (const dep of [
      "string-similarity",
      "pluralize",
      "picocolors",
      "@inquirer/prompts",
      "tsx",
    ]) {
      expect(pkg.devDependencies[dep], `expected devDep ${dep}`).toBeDefined();
    }
    // gray-matter ships unconditionally as a runtime dep
    expect(pkg.dependencies["gray-matter"]).toBeDefined();
  });

  it("settings emit off + tagVocabulary=false when disabled, no scripts emitted", async () => {
    const choices: UserChoices = {
      projectName: "test-tag-gov-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    const settings = await fs.readFile(
      projectPath("test-tag-gov-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).toContain('tagGovernance: "off"');
    expect(settings).toContain("tagVocabulary: false");

    expect(
      await fs.pathExists(
        projectPath("test-tag-gov-off", "scripts/tags-audit.ts"),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath("test-tag-gov-off", "scripts/tags-suggest.ts"),
      ),
    ).toBe(false);

    const pkg = await fs.readJson(
      projectPath("test-tag-gov-off", "package.json"),
    );
    expect(pkg.scripts["tags:audit"]).toBeUndefined();
    expect(pkg.scripts["tags:suggest"]).toBeUndefined();
    expect(pkg.devDependencies["string-similarity"]).toBeUndefined();
    expect(pkg.devDependencies["pluralize"]).toBeUndefined();
    expect(pkg.devDependencies["@inquirer/prompts"]).toBeUndefined();
  });
});

describe("scaffold — footerTaglist feature", () => {
  it("does NOT emit taglist block when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-footer-taglist-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "tagGovernance"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const settings = await fs.readFile(
      projectPath("test-footer-taglist-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).not.toContain("taglist: {");
  });
});

describe("scaffold — vanilla output (both tag flags off)", () => {
  it("produces footer: false and tagGovernance: off", async () => {
    const choices: UserChoices = {
      projectName: "test-vanilla-tags",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const settings = await fs.readFile(
      projectPath("test-vanilla-tags", "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).toContain('tagGovernance: "off"');
    expect(settings).toContain("tagVocabulary: false");
    expect(settings).toContain("footer: false");
    expect(settings).not.toContain("taglist: {");
  });
});

describe("scaffold — always emits framework-required settings fields (sub #408)", () => {
  /**
   * Regression guard for sub-issue #408. These five fields are read by
   * framework components and must always be declared in the generated
   * settings.ts — otherwise `pnpm check` on a fresh scaffold fails with
   * ts(2339) "Property X does not exist" errors.
   *
   * The test exercises several preset shapes (barebone, feature-heavy,
   * i18n + light-dark, github URL) to confirm the fields are emitted for
   * every code path, not only the default one.
   */
  const REQUIRED_FIELDS = [
    "githubUrl",
    "tagPlacement",
    "frontmatterPreview",
    "tagVocabulary",
    "tagGovernance",
  ] as const;

  const presets: ReadonlyArray<{ name: string; choices: UserChoices }> = [
    {
      name: "barebone (no features, single scheme)",
      choices: {
        projectName: "test-req-barebone",
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      },
    },
    {
      name: "search only (common minimal preset)",
      choices: {
        projectName: "test-req-search",
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: ["search"],
        packageManager: "pnpm",
      },
    },
    {
      name: "tag-governance enabled",
      choices: {
        projectName: "test-req-tag-gov",
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: ["search", "tagGovernance"],
        packageManager: "pnpm",
      },
    },
    {
      name: "feature-heavy (i18n + light-dark + many features)",
      choices: {
        projectName: "test-req-heavy",
        defaultLang: "en",
        colorSchemeMode: "light-dark",
        lightScheme: "Default Light",
        darkScheme: "Default Dark",
        respectPrefersColorScheme: true,
        defaultMode: "dark",
        features: [
          "i18n",
          "search",
          "designTokenPanel",
          "docHistory",
          "tagGovernance",
          "footerTaglist",
          "bodyFootUtil",
        ],
        githubUrl: "https://github.com/example/demo",
        packageManager: "pnpm",
      },
    },
  ];

  for (const preset of presets) {
    it(`declares all 5 framework-required fields: ${preset.name}`, async () => {
      await scaffold(preset.choices);
      const content = await fs.readFile(
        projectPath(preset.choices.projectName, "src/config/settings.ts"),
        "utf-8",
      );
      const missing = REQUIRED_FIELDS.filter(
        (field) => !new RegExp(`^\\s{2}${field}\\s*:`, "m").test(content),
      );
      expect(
        missing,
        `Generated settings.ts for "${preset.choices.projectName}" is missing ` +
          `required fields: ${missing.join(", ")}. These fields are read by ` +
          `framework components and must always be declared.`,
      ).toEqual([]);
    });
  }

  it("explicitly types each required field so framework consumers compile", async () => {
    // Guard against accidental narrowing (e.g., emitting `tagPlacement: "after-title"`
    // as a string literal rather than `as TagPlacement`), which would prevent
    // downstream projects from setting alternate values without a type assertion.
    const choices: UserChoices = {
      projectName: "test-req-typing",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-req-typing", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toMatch(/githubUrl:\s*(?:"[^"]*"|false)\s+as\s+string\s*\|\s*false,/);
    expect(content).toMatch(/tagPlacement:\s*"[^"]+"\s+as\s+TagPlacement,/);
    expect(content).toMatch(
      /frontmatterPreview:[\s\S]*?as\s+FrontmatterPreviewConfig\s*\|\s*false,/,
    );
    expect(content).toMatch(/tagVocabulary:\s*(?:true|false)\s+as\s+boolean,/);
    expect(content).toMatch(/tagGovernance:\s*"[^"]+"\s+as\s+TagGovernanceMode,/);
  });
});

describe("drift detection — generator vs main project settings", () => {
  /**
   * This test catches feature drift between the main project's settings.ts
   * and what the generator produces. If a new setting is added to the main
   * project but not to settings-gen.ts, this test will fail.
   */
  it("generated settings.ts has all fields from the main settings.ts", async () => {
    // Read the main project's settings.ts to extract field names
    const mainSettingsPath = path.resolve(
      __dirname,
      "../../../../src/config/settings.ts",
    );
    const mainSettings = await fs.readFile(mainSettingsPath, "utf-8");

    // Extract top-level field names from `export const settings = { ... }`
    const settingsBlock = mainSettings.slice(
      mainSettings.indexOf("export const settings = {"),
    );
    // Match field names at 2-space indent (top-level settings object keys)
    const fieldPattern = /^ {2}(\w+)\s*:/gm;
    const mainFields: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = fieldPattern.exec(settingsBlock)) !== null) {
      mainFields.push(match[1]!);
    }

    expect(mainFields.length).toBeGreaterThan(10); // Sanity check

    // Scaffold a minimal project and read generated settings
    const choices: UserChoices = {
      projectName: "test-drift",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "sidebarFilter"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const generated = await fs.readFile(
      projectPath("test-drift", "src/config/settings.ts"),
      "utf-8",
    );

    // Fields intentionally absent from generated projects (with justification).
    // "Opt-in showcase-only" fields are set in the showcase's src/config/settings.ts
    // but must NOT appear in generated projects because the default (absent/undefined)
    // is the correct value for a blank project.
    const SHOWCASE_ONLY_FIELDS = new Set([
      // Showcase-specific: only zudolab/zudo-doc should auto-link issue refs in its own docs.
      // Generated projects must opt in explicitly — omitting gives "no autolinks" (old behaviour).
      // See zudo-doc#2321 Wave-0 correctness fix.
      "githubAutolinksRepo",
    ]);

    // Check that every field in the main settings exists in the generated output
    const missingFields = mainFields.filter(
      (field) => !SHOWCASE_ONLY_FIELDS.has(field) && !generated.includes(`${field}:`),
    );
    expect(
      missingFields,
      `Generator is missing settings fields: ${missingFields.join(", ")}. ` +
        `Update packages/create-zudo-doc/src/settings-gen.ts or run /l-update-generator`,
    ).toEqual([]);
  });
});

describe("scaffold — framework TS error fixes (sub #410)", () => {
  /**
   * Regression guards for sub-issue #410. One remaining live guard:
   *   - mermaid stays an unconditional dependency in every scaffolded
   *     package.json so that `src/components/mermaid-init.tsx` can
   *     import it at type-check time without a missing-module error.
   */
  it("mermaid stays an unconditional dependency in scaffolded package.json (strategy a)", async () => {
    const choices: UserChoices = {
      projectName: "test-410-mermaid",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(
      projectPath("test-410-mermaid", "package.json"),
    );
    expect(
      pkg.dependencies?.mermaid,
      "mermaid must stay an unconditional runtime dependency so the dynamic " +
        "import in src/components/mermaid-init.tsx resolves at type-check time",
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// zfb.config.ts shape — ≥ 3 representative feature combinations
//
// ALL tests in this describe block depend on:
//   - topic-config-generators  (zfb-config-gen.ts that emits zfb.config.ts)
//   - topic-template-files     (base template retarget to zfb layout)
// ---------------------------------------------------------------------------

describe("scaffold — zfb.config.ts shape (topic-config-generators)", () => {
  // Pattern 1: minimal (search + sidebarFilter, no i18n, single scheme)
  describe("minimal", () => {
    const choices: UserChoices = {
      projectName: "test-zfb-minimal",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "sidebarFilter"],
      packageManager: "pnpm",
    };

    // Every test below reads the same scaffold output and none mutate the
    // tree, so `choices` is scaffolded once in beforeAll instead of once per
    // `it` (#2531 — dedupe scaffold() calls). This shadows the module-level
    // `projectPath` for this describe only.
    let sharedDir: string;
    function projectPath(...segments: string[]): string {
      return path.join(sharedDir, segments[0]!, ...segments.slice(1));
    }
    beforeAll(async () => {
      const cwdBefore = process.cwd();
      sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
      process.chdir(sharedDir);
      await scaffold(choices);
      process.chdir(cwdBefore);
    });
    afterAll(async () => {
      await fs.remove(sharedDir);
    });

    it("creates zfb.config.ts with defineConfig from zfb/config", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-minimal", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain('from "zfb/config"');
      expect(config).toContain("defineConfig(");
      expect(config).not.toContain('from "astro/config"');
    });

    it("zfb.config.ts declares framework: preact and tailwind", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-minimal", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain('framework: "preact"');
      expect(config).toContain("tailwind:");
    });

    it("zfb.config.ts uses zudoDocPreset (S5b — collections/plugins/markdown delegated to preset)", async () => {
      // S5b (#2329): the thin preset-based shape delegates collections, plugins,
      // markdown features, codeHighlight, resolveMarkdownLinks, and trailingSlash
      // to zudoDocPreset() from @takazudo/zudo-doc/preset. The generated config
      // spreads the result and keeps only the host-owned shell fields.
      // S5 (#2408): translations + colorSchemes forwarded unconditionally so
      // generated projects get the same route-label and color-scheme resolution
      // on package-owned routes as the host.
      const config = await fs.readFile(
        projectPath("test-zfb-minimal", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain(
        'import { zudoDocPreset } from "@takazudo/zudo-doc/preset"',
      );
      expect(config).toContain(
        'import { translations } from "./src/config/i18n"',
      );
      expect(config).toContain(
        'import { colorSchemes } from "./src/config/color-schemes"',
      );
      expect(config).toContain(
        "...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary, translations, colorSchemes })",
      );
      // The inline boilerplate must NOT appear — it lives inside the preset.
      expect(config).not.toContain("  collections,");
      expect(config).not.toContain("plugins: integrationPlugins,");
    });

    it("src/content.config.ts is NOT emitted (content config lives in zfb.config.ts)", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-zfb-minimal", "src/content.config.ts"),
        ),
      ).toBe(false);
    });

    // migration guard: scaffold output must not include Astro deps (the cutover at #500 S5 removed them).
    // W4A (#1732): @takazudo/zudo-doc is now also a runtime dep — pinned
    // to the v2 publish version that release-create-zudo-doc.sh keeps in
    // lockstep with the generator's own version.
    it("package.json lists @takazudo/zfb and @takazudo/zudo-doc as runtime dependencies (post-S5, post-W4A)", async () => {
      const pkg = await fs.readJson(
        projectPath("test-zfb-minimal", "package.json"),
      );
      expect(pkg.dependencies["@takazudo/zfb"]).toBeDefined();
      expect(pkg.dependencies["astro"]).toBeUndefined();
      expect(pkg.dependencies["@takazudo/zudo-doc"]).toBeDefined();
      expect(pkg.dependencies["@takazudo/zudo-doc"]).toMatch(/^\^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
    });

    // W6B (#1735) — runtime deps required by always-on scaffolded
    // pages/lib code or by the zfb engine bundler. Each was caught by
    // the consumer-build verification gate (one missing-dep error per
    // round). Without these, `zfb build` fails before any page compiles:
    //   - zod                       → @takazudo/zudo-doc/preset calls
    //                                 z.toJSONSchema internally; zod is a
    //                                 required peer dep of the preset module.
    //                                 S5b: no longer emitted directly by
    //                                 zfb-config-gen, but still needed so the
    //                                 preset's bare `import { z } from "zod"`
    //                                 resolves in the consumer's node_modules.
    //   - preact-render-to-string   → zfb's emitted entry.mjs SSR's pages
    //                                 via `renderToString` from this pkg
    //   - katex                     → pages/lib/_math-block.tsx renders
    //                                 LaTeX server-side via katex.renderToString()
    it("package.json lists zod, preact-render-to-string, katex as runtime deps (W6B — needed by always-on scaffolded code)", async () => {
      const pkg = await fs.readJson(
        projectPath("test-zfb-minimal", "package.json"),
      );
      expect(pkg.dependencies["zod"]).toBe("^4.3.6"); // must match @takazudo/zudo-doc peer floor
      expect(pkg.dependencies["preact-render-to-string"]).toBeDefined();
      expect(pkg.dependencies["katex"]).toBeDefined();
    });
  });

  // Pattern 2: barebone — everything off (no features, single scheme)
  describe("barebone (everything off)", () => {
    const choices: UserChoices = {
      projectName: "test-zfb-barebone",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };

    // Every test below reads the same scaffold output and none mutate the
    // tree, so `choices` is scaffolded once in beforeAll instead of once per
    // `it` (#2531 — dedupe scaffold() calls). This shadows the module-level
    // `projectPath` for this describe only.
    let sharedDir: string;
    function projectPath(...segments: string[]): string {
      return path.join(sharedDir, segments[0]!, ...segments.slice(1));
    }
    beforeAll(async () => {
      const cwdBefore = process.cwd();
      sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
      process.chdir(sharedDir);
      await scaffold(choices);
      process.chdir(cwdBefore);
    });
    afterAll(async () => {
      await fs.remove(sharedDir);
    });

    it("zfb.config.ts exists without any optional plugin imports", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-barebone", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain('from "zfb/config"');
      expect(config).not.toContain("docHistory");
      expect(config).not.toContain("llmsTxt");
      expect(config).not.toContain("claudeResources");
    });

    it("src/content.config.ts is NOT emitted", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-zfb-barebone", "src/content.config.ts"),
        ),
      ).toBe(false);
    });

    it("no locale collections in zfb.config.ts (i18n off)", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-barebone", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).not.toContain("docs-ja");
    });
  });

  // Pattern 3: most features on (i18n, search, docHistory, llmsTxt, claudeResources)
  describe("most features on", () => {
    const choices: UserChoices = {
      projectName: "test-zfb-full",
      defaultLang: "en",
      colorSchemeMode: "light-dark",
      lightScheme: "Default Light",
      darkScheme: "Default Dark",
      respectPrefersColorScheme: true,
      defaultMode: "dark",
      features: [
        "i18n",
        "search",
        "sidebarFilter",
        "docHistory",
        "llmsTxt",
        "claudeResources",
        "imageEnlarge",
      ],
      packageManager: "pnpm",
    };

    // Every test below reads the same scaffold output and none mutate the
    // tree, so `choices` is scaffolded once in beforeAll instead of once per
    // `it` (#2531 — dedupe scaffold() calls). This shadows the module-level
    // `projectPath` for this describe only.
    let sharedDir: string;
    function projectPath(...segments: string[]): string {
      return path.join(sharedDir, segments[0]!, ...segments.slice(1));
    }
    beforeAll(async () => {
      const cwdBefore = process.cwd();
      sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
      process.chdir(sharedDir);
      await scaffold(choices);
      process.chdir(cwdBefore);
    });
    afterAll(async () => {
      await fs.remove(sharedDir);
    });

    it("zfb.config.ts uses preset (feature data is in settings, not inlined in config)", async () => {
      // S5b (#2329): the thin preset-based config is feature-agnostic.
      // Collections (including locale collections) and plugin wiring are
      // driven by settings.* at zfb-load time inside zudoDocPreset().
      // No inline locale loops, plugin conditionals, or docHistory/llmsTxt/
      // claudeResources mentions are needed in the generated file.
      // S5 (#2408): translations + colorSchemes forwarded unconditionally.
      const config = await fs.readFile(
        projectPath("test-zfb-full", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain(
        'import { zudoDocPreset } from "@takazudo/zudo-doc/preset"',
      );
      expect(config).toContain(
        'import { translations } from "./src/config/i18n"',
      );
      expect(config).toContain(
        'import { colorSchemes } from "./src/config/color-schemes"',
      );
      expect(config).toContain(
        "...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary, translations, colorSchemes })",
      );
      // Inline collection loops must NOT appear — they live in the preset.
      expect(config).not.toContain("Object.entries(settings.locales)");
      // Plugin conditionals must NOT appear — they live in the preset.
      expect(config).not.toContain("docHistory-plugin");
      expect(config).not.toContain("llms-txt-plugin");
      expect(config).not.toContain("claude-resources-plugin");
    });

    it("zfb.config.ts wires docHistory/llmsTxt/claudeResources via preset (not inline)", async () => {
      // S5b (#2329): feature routing is entirely settings-driven via the
      // preset. The generated config uses zudoDocPreset() — there are no
      // inline `settings.docHistory`, `settings.llmsTxt`, or
      // `settings.claudeResources` conditionals in the config file itself.
      const config = await fs.readFile(
        projectPath("test-zfb-full", "zfb.config.ts"),
        "utf-8",
      );
      // The config itself must not contain these — they live in the preset.
      expect(config).not.toContain("settings.docHistory");
      expect(config).not.toContain("settings.llmsTxt");
      expect(config).not.toContain("settings.claudeResources");
    });

    // imageEnlarge is a layout island, not a markdown rehype plugin in
    // the zfb.config.ts pipeline. Make the negative assertion explicit
    // so a future regression that re-introduces it gets caught.
    it("zfb.config.ts does NOT wire rehypeImageEnlarge (it is a layout island)", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-full", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).not.toContain("rehypeImageEnlarge");
    });

    it("src/content.config.ts is NOT emitted", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-zfb-full", "src/content.config.ts"),
        ),
      ).toBe(false);
    });
  });
});

// W6A (#1734) — page mirror parity assertions. The unconditional pages from
// the host repo's pages/ tree are mirrored into templates/base/pages/ and must
// show up in every scaffold variant; pages/api/** is excluded as worker-only
// per spec-lock Decision 5.
// Note: pages/404.tsx and pages/sitemap.xml.tsx were removed from the template
// in the Stub-Deletion Fast-Follow (epic #2369) — those routes are now injected
// by the package (packageOwnedRoutes), not scaffolded. The docs catch-all stub
// pages/docs/[[...slug]].tsx was removed the same way in #2390 (supersedes
// #2377): generated projects render docs via the package-injected route.
// Post-collapse (epic #2420, GENSYNC #2429): ~23 individual chrome shell files
// collapsed into `_chrome.ts` + `_route-context.ts`; pages/_mdx-components.ts
// removed (MDX extras wired via hostBindings.mdxExtras in _chrome.ts).
describe("scaffold — W6A page mirror (templates/base/pages)", () => {
  const UNCONDITIONAL_PAGES = [
    "pages/index.tsx",
    "pages/_data.ts",
    "pages/lib/_body-end-islands.tsx",
    "pages/lib/_chrome.ts",
    "pages/lib/_details.tsx",
    "pages/lib/_doc-route-entries.ts",
    "pages/lib/_extract-headings.ts",
    "pages/lib/_frontmatter-preview-data.ts",
    "pages/lib/_nav-source-cache.ts",
    "pages/lib/_nav-source-docs.ts",
    "pages/lib/_preset-generator.tsx",
    "pages/lib/_route-context.ts",
    "pages/lib/_search-widget.tsx",
    "pages/lib/doc-page-props.ts",
    "pages/lib/locale-merge.ts",
  ];

  const BAREBONE: UserChoices = {
    projectName: "test-pages-barebone",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: [],
    packageManager: "pnpm",
  };

  const ALL_FEATURES: UserChoices = {
    projectName: "test-pages-all",
    defaultLang: "en",
    colorSchemeMode: "light-dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
    defaultMode: "dark",
    features: [
      "i18n",
      "search",
      "sidebarFilter",
      "sidebarToggle",
      "sidebarResizer",
      "docHistory",
      "llmsTxt",
      "claudeResources",
      "claudeSkills",
      "designTokenPanel",
      "imageEnlarge",
      "bodyFootUtil",
      "footerNavGroup",
      "footerCopyright",
      "changelog",
      "skillSymlinker",
      "tagGovernance",
    ],
    packageManager: "pnpm",
  };

  // BAREBONE and ALL_FEATURES are each scaffolded exactly once below —
  // every test in this describe reuses one of these two outputs and none
  // mutate the tree, so scaffolding used to run once per `it` (and even
  // twice more per `it` via the `for` loops below) for the *same* two
  // configs. Scaffold each once in beforeAll instead (#2531 — dedupe
  // scaffold() calls). This shadows the module-level `projectPath` for
  // this describe only.
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(BAREBONE);
    await scaffold(ALL_FEATURES);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("emits all 15 unconditional page files in a barebone scaffold", async () => {
    for (const rel of UNCONDITIONAL_PAGES) {
      expect(
        await fs.pathExists(projectPath("test-pages-barebone", rel)),
        `expected ${rel} to exist in barebone scaffold`,
      ).toBe(true);
    }
  });

  it("emits all 15 unconditional page files in an all-features scaffold", async () => {
    for (const rel of UNCONDITIONAL_PAGES) {
      expect(
        await fs.pathExists(projectPath("test-pages-all", rel)),
        `expected ${rel} to exist in all-features scaffold`,
      ).toBe(true);
    }
  });

  it("does not emit pages/api/ai-chat.tsx in any scaffold variant (W6A spec-lock Decision 5)", async () => {
    // Worker-only SSR endpoint — explicit exclusion via EXCLUDE_FROM_MIRROR
    // in src/scaffold.ts. Asserts both variants: a barebone with no features
    // and an all-features scaffold. Neither should ship pages/api/**.
    for (const choices of [BAREBONE, ALL_FEATURES]) {
      const apiDir = projectPath(choices.projectName, "pages/api");
      expect(
        await fs.pathExists(apiDir),
        `pages/api/ must not be emitted in ${choices.projectName}`,
      ).toBe(false);
      const aiChat = projectPath(choices.projectName, "pages/api/ai-chat.tsx");
      expect(await fs.pathExists(aiChat)).toBe(false);
    }
  });

  it("does NOT emit the docs catch-all stub pages/docs/[[...slug]].tsx (package-injected, #2390)", async () => {
    // The default-locale docs catch-all is now injected by the package
    // (packageOwnedRoutes); its host stub was deleted from templates/base so
    // generated projects render docs through the package-owned route, whose
    // chrome wires the Details/HtmlPreview/Island MDX components. Asserts both
    // a barebone and an all-features scaffold.
    for (const choices of [BAREBONE, ALL_FEATURES]) {
      expect(
        await fs.pathExists(
          projectPath(choices.projectName, "pages/docs/[[...slug]].tsx"),
        ),
        `pages/docs/[[...slug]].tsx must not be emitted in ${choices.projectName}`,
      ).toBe(false);
    }
  });

  it("ships the #doc-history-meta seed JSON in every scaffold variant", async () => {
    // The mirrored pages import "#doc-history-meta" — the tsconfig alias
    // resolves to .zfb/doc-history-meta.json. The seed file containing
    // exactly {} ships in templates/base/.zfb/ so the import resolves
    // even when docHistory is disabled. The doc-history prebuild step
    // overwrites it at build time when the feature is enabled.
    const seedPath = projectPath(
      "test-pages-barebone",
      ".zfb/doc-history-meta.json",
    );
    expect(await fs.pathExists(seedPath)).toBe(true);
    expect(await fs.readFile(seedPath, "utf-8")).toBe("{}\n");
  });

  it("tsconfig.json carries the #doc-history-meta path alias", async () => {
    const tsconfig = await fs.readJson(
      projectPath("test-pages-barebone", "tsconfig.json"),
    );
    expect(tsconfig.compilerOptions.paths["#doc-history-meta"]).toEqual([
      ".zfb/doc-history-meta.json",
    ]);
  });

  // W6B (#1735) — react → preact/compat alias at the tsconfig layer.
  // Lets the mirrored pages and feature templates `import ... from
  // "react"` and have TypeScript + zfb's FsResolver (which walks up to
  // the nearest tsconfig.json and resolves compilerOptions.paths at
  // build time, per upstream zfb PR #139) route the import to
  // preact/compat.
  //
  // Spec deviations from #1735 W2 §1.2:
  //
  // 1. Trailing slash on `react` + `react-dom` is load-bearing. Without
  //    it, esbuild (running in `platform: "neutral"` mode in zfb's
  //    islands bundler) resolves the alias to the bare path
  //    `node_modules/preact/compat`, then refuses to read the package's
  //    `main` field and errors with "Main fields must be configured
  //    explicitly when using the 'neutral' platform". With trailing
  //    slash, esbuild treats the alias as a package-directory and
  //    resolves correctly. Confirmed empirically by the consumer-build
  //    gate; matches the host's tsconfig shape verbatim.
  // 2. `react-dom/*` (subpath wildcard) is intentionally omitted —
  //    the host doesn't ship it and no scaffolded code imports a
  //    react-dom subpath.
  // 3. The spec also asked for a `vite.resolve.alias` belt-and-braces
  //    layer in zfb.config.ts. zfb's `ZfbConfig` type (verified in
  //    node_modules/@takazudo/zfb/dist/config.d.ts) has no `vite`
  //    field — adding one breaks `pnpm check`. The host builds with
  //    tsconfig paths only.
  it("tsconfig.json aliases react/react-dom to preact/compat (matches host shape verbatim)", async () => {
    const tsconfig = await fs.readJson(
      projectPath("test-pages-barebone", "tsconfig.json"),
    );
    expect(tsconfig.compilerOptions.paths["react"]).toEqual([
      "./node_modules/preact/compat/",
    ]);
    expect(tsconfig.compilerOptions.paths["react/jsx-runtime"]).toEqual([
      "./node_modules/preact/jsx-runtime",
    ]);
    expect(tsconfig.compilerOptions.paths["react-dom"]).toEqual([
      "./node_modules/preact/compat/",
    ]);
  });
});

// ---------------------------------------------------------------------------
// W7A (#1736) — zfb-config-gen reconcile: the generated zfb.config.ts must
// reference plugin `.mjs` files actually shipped by the templates, otherwise
// `zfb build` fails at config bundling (the W6B-flagged blocker). These
// tests assert the import-resolution chain end-to-end at scaffold time so
// the consumer build only fails for *new* drift, not for known-broken state.
//
// Package-first migration cleanup (#2337): the 5 feature plugin .mjs wrappers
// (search-index, connect-adapter, doc-history, llms-txt, claude-resources)
// were deleted from the templates because generated projects now use the
// preset approach — plugins are referenced via `@takazudo/zudo-doc/plugins/*`
// package specifiers inside the preset.
// #2358: copy-public-plugin.mjs also removed — zfb native `publicDir` replaces it.
// tsx is no longer emitted for docHistory/claudeResources features: the
// package plugins import the runner directly (no `tsx -e` spawn) since
// @takazudo/zudo-doc now ships compiled dist/.
// ---------------------------------------------------------------------------

describe("scaffold — W7A zfb plugin .mjs files exist after composition (#1736)", () => {
  it("barebone scaffold ships NO project-local .mjs plugins (all owned by preset or native zfb)", async () => {
    // S5b (#2329) + #2337 + #2358: the preset-based zfb.config.ts has no inline
    // `./plugins/*.mjs` references. Plugins are referenced via
    // `@takazudo/zudo-doc/plugins/*` package specifiers inside the preset.
    // copy-public-plugin.mjs was removed (#2358) — zfb native publicDir replaces it.
    // All .mjs plugin wrappers are absent from templates.
    const choices: UserChoices = {
      projectName: "test-w7a-plugins-barebone",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    // All .mjs plugin wrappers must NOT ship — they are dead code since
    // the preset references the package plugins directly (#2337) and
    // copy-public is handled by zfb natively (#2358).
    for (const file of [
      "plugins/copy-public-plugin.mjs",
      "plugins/search-index-plugin.mjs",
      "plugins/connect-adapter.mjs",
      "plugins/doc-history-plugin.mjs",
      "plugins/llms-txt-plugin.mjs",
      "plugins/claude-resources-plugin.mjs",
    ]) {
      expect(
        await fs.pathExists(
          projectPath("test-w7a-plugins-barebone", file),
        ),
        `expected ${file} to be absent (orphaned after #2337/#2358)`,
      ).toBe(false);
    }
  });

  it("all-features scaffold has no project-local .mjs plugins (preset owns all, publicDir native)", async () => {
    // S5b (#2329) + #2337 + #2358: the thin preset-based zfb.config.ts has no
    // inline `./plugins/*.mjs` references — plugins are referenced via
    // `@takazudo/zudo-doc/plugins/*` package specifiers inside the preset.
    // copy-public-plugin.mjs was removed in #2358 (zfb native publicDir).
    const choices: UserChoices = {
      projectName: "test-w7a-plugins-all",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "docHistory", "llmsTxt", "claudeResources"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    // copy-public-plugin.mjs must NOT be present (removed in #2358)
    expect(
      await fs.pathExists(
        projectPath("test-w7a-plugins-all", "plugins/copy-public-plugin.mjs"),
      ),
      "copy-public-plugin.mjs must be absent after #2358",
    ).toBe(false);
    // The thin generated config must not reference any ./plugins/*.mjs inline
    const config = await fs.readFile(
      projectPath("test-w7a-plugins-all", "zfb.config.ts"),
      "utf-8",
    );
    const inlinePluginRefs = [
      ...config.matchAll(/"\.\/plugins\/([\w-]+\.mjs)"/g),
    ];
    expect(inlinePluginRefs.length).toBe(0);
  });

  it("doc-history scaffold does NOT ship tsx devDep (package plugin imports runner directly)", async () => {
    // #2337: doc-history-plugin.mjs was removed from the templates. The
    // package plugin (@takazudo/zudo-doc/plugins/doc-history) imports the
    // runner directly since @takazudo/zudo-doc ships compiled dist/ — no
    // `tsx -e` spawn, so tsx is not needed as a devDep for this feature.
    // tsx is still emitted for tagGovernance (scripts/tags-suggest.ts).
    const choices: UserChoices = {
      projectName: "test-w7a-dh-tsx",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["docHistory"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(
      projectPath("test-w7a-dh-tsx", "package.json"),
    );
    expect(pkg.devDependencies?.tsx).toBeUndefined();
  });
});

// W7B (#1737) — i18n feature emits the locale-prefixed page set when selected,
// and zero pages/[locale]/** files when not selected. The emitted file(s) must
// be byte-identical to their feature templates.
//
// #2390 (supersedes #2377): the locale docs catch-all stub
// pages/[locale]/docs/[[...slug]].tsx was removed from the i18n feature
// template — that route is now package-injected (packageOwnedRoutes), so i18n
// ships only [locale]/index.tsx and the negative assertion below proves the
// catch-all is NOT scaffolded.
//
// Cross-feature note: versioning + docTags also emit pages/[locale]/**
// files (versions.tsx, tags/[tag].tsx, tags/index.tsx) — those are W7C
// scope and live in different feature template dirs. The "off" assertion
// below uses a feature set that selects neither i18n, versioning, nor
// docTags so the [locale]/** namespace is provably empty.
describe("scaffold — W7B i18n feature pages (templates/features/i18n)", () => {
  const I18N_PAGE_FILES = ["pages/[locale]/index.tsx"];

  const I18N_ON: UserChoices = {
    projectName: "test-w7b-i18n-on",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["i18n", "search"],
    packageManager: "pnpm",
  };

  const I18N_OFF: UserChoices = {
    projectName: "test-w7b-i18n-off",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "sidebarFilter"],
    packageManager: "pnpm",
  };

  // Absolute path to the feature-template source files, relative to this
  // test file. Used by the byte-identical assertion.
  const FEATURE_PAGES_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "templates/features/i18n/files/pages",
  );

  // I18N_ON is scaffolded 3x below (identical output each time) and
  // I18N_OFF once — scaffold each once in beforeAll instead (#2531 —
  // dedupe scaffold() calls). This shadows the module-level `projectPath`
  // for this describe only.
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(I18N_ON);
    await scaffold(I18N_OFF);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("emits pages/[locale]/index.tsx when i18n is selected", async () => {
    for (const rel of I18N_PAGE_FILES) {
      expect(
        await fs.pathExists(projectPath("test-w7b-i18n-on", rel)),
        `expected ${rel} to exist when i18n is selected`,
      ).toBe(true);
    }
  });

  it("does NOT emit pages/[locale]/docs/[[...slug]].tsx even when i18n is selected (package-injected, #2390)", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-w7b-i18n-on", "pages/[locale]/docs/[[...slug]].tsx"),
      ),
      "locale docs catch-all is package-injected — must not be scaffolded",
    ).toBe(false);
  });

  it("does NOT emit any pages/[locale]/** files when i18n is not selected", async () => {
    const localeDir = projectPath("test-w7b-i18n-off", "pages/[locale]");
    expect(
      await fs.pathExists(localeDir),
      "pages/[locale]/ must not exist when i18n is off",
    ).toBe(false);
  });

  it("emitted pages/[locale]/index.tsx is byte-identical to the feature template", async () => {
    const emitted = await fs.readFile(
      projectPath("test-w7b-i18n-on", "pages/[locale]/index.tsx"),
      "utf-8",
    );
    const template = await fs.readFile(
      path.join(FEATURE_PAGES_DIR, "[locale]/index.tsx"),
      "utf-8",
    );
    expect(emitted).toEqual(template);
  });
});

// W7C — Feature-conditional pages: versioning + docTags  (#1738)
// ---------------------------------------------------------------------------
//
// Each feature ships a `files/pages/` subtree that copyFeatureFiles emits
// verbatim. The `[locale]/**` (and `v/[version]/ja/**`) subsets are stripped
// by each feature's postProcess hook when i18n is NOT also selected — so a
// single-locale project never ships orphan locale routes, and an all-features
// scaffold ships the union.
// ---------------------------------------------------------------------------

describe("scaffold — W7C docTags feature pages (#1738)", () => {
  // "does NOT emit docs/tags/**" and "strips [locale]/docs/tags/**" both
  // scaffold the identical `search`+`docTags` config (only projectName
  // differed) — scaffold each of the 3 distinct configs used in this
  // describe once in beforeAll instead of once per `it` (#2531 — dedupe
  // scaffold() calls). This shadows the module-level `projectPath` for this
  // describe only.
  const docTagsChoices: UserChoices = {
    projectName: "test-doctags-only",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "docTags"],
    packageManager: "pnpm",
  };
  const docTagsI18nChoices: UserChoices = {
    projectName: "test-doctags-i18n",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "i18n", "docTags"],
    packageManager: "pnpm",
  };
  const noDocTagsChoices: UserChoices = {
    projectName: "test-no-doctags",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "i18n"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(docTagsChoices);
    await scaffold(docTagsI18nChoices);
    await scaffold(noDocTagsChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  // Route stubs for tags were removed in the Stub-Deletion Fast-Follow (epic
  // #2369). These routes are now injected by the package (packageOwnedRoutes)
  // so the scaffold must NOT emit them as files.
  it("does NOT emit docs/tags/[tag].tsx + docs/tags/index.tsx as scaffold files (package-injected)", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-doctags-only", "pages/docs/tags/[tag].tsx"),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath("test-doctags-only", "pages/docs/tags/index.tsx"),
      ),
    ).toBe(false);
  });

  it("strips [locale]/docs/tags/** when docTags is selected but i18n is OFF", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-doctags-only", "pages/[locale]/docs/tags"),
      ),
    ).toBe(false);
  });

  it("does NOT emit [locale]/docs/tags/{[tag].tsx,index.tsx} as scaffold files (package-injected)", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-doctags-i18n",
          "pages/[locale]/docs/tags/[tag].tsx",
        ),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath(
          "test-doctags-i18n",
          "pages/[locale]/docs/tags/index.tsx",
        ),
      ),
    ).toBe(false);
  });

  it("does NOT emit any docs/tags/** when docTags is not selected", async () => {
    expect(
      await fs.pathExists(projectPath("test-no-doctags", "pages/docs/tags")),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath("test-no-doctags", "pages/[locale]/docs/tags"),
      ),
    ).toBe(false);
  });
});

describe("scaffold — W7C versioning feature pages (#1738)", () => {
  // "does NOT emit docs/versions.tsx OR v/[version]/docs/..." and "strips
  // [locale]/docs/versions.tsx + v/[version]/ja/**" both scaffold the
  // identical `search`+`versioning` config (only projectName differed) —
  // scaffold each of the 3 distinct configs used in this describe once in
  // beforeAll instead of once per `it` (#2531 — dedupe scaffold() calls).
  // This shadows the module-level `projectPath` for this describe only.
  const versioningChoices: UserChoices = {
    projectName: "test-versioning-pages-only",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "versioning"],
    packageManager: "pnpm",
  };
  const versioningI18nChoices: UserChoices = {
    projectName: "test-versioning-i18n",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "i18n", "versioning"],
    packageManager: "pnpm",
  };
  const noVersioningChoices: UserChoices = {
    projectName: "test-no-versioning",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "i18n"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(versioningChoices);
    await scaffold(versioningI18nChoices);
    await scaffold(noVersioningChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  // pages/docs/versions.tsx was removed in the Stub-Deletion Fast-Follow
  // (epic #2369) — that route is now injected by the package
  // (packageOwnedRoutes). The versioned DOC catch-all routes
  // (v/[version]/docs/[[...slug]].tsx and v/[version]/[locale]/docs/[[...slug]].tsx)
  // were removed the same way in #2390 (supersedes #2377): they are now
  // package-injected too, so the scaffold must NOT emit them as files. The
  // versioning feature now ships only pages/lib/_versions-page.tsx.
  it("does NOT emit docs/versions.tsx OR v/[version]/docs/[[...slug]].tsx (both package-injected) when versioning is selected (i18n off)", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-versioning-pages-only", "pages/docs/versions.tsx"),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath(
          "test-versioning-pages-only",
          "pages/v/[version]/docs/[[...slug]].tsx",
        ),
      ),
    ).toBe(false);
  });

  it("strips [locale]/docs/versions.tsx + v/[version]/ja/** when versioning is selected but i18n is OFF", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-versioning-pages-only",
          "pages/[locale]/docs/versions.tsx",
        ),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath("test-versioning-pages-only", "pages/v/[version]/[locale]"),
      ),
    ).toBe(false);
  });

  it("does NOT emit [locale]/docs/versions.tsx OR v/[version]/[locale]/docs/[[...slug]].tsx (both package-injected) when versioning + i18n are both selected", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-versioning-i18n",
          "pages/[locale]/docs/versions.tsx",
        ),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath(
          "test-versioning-i18n",
          "pages/v/[version]/[locale]/docs/[[...slug]].tsx",
        ),
      ),
    ).toBe(false);
  });

  it("does NOT emit any docs/versions.tsx or v/[version]/** when versioning is not selected", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-no-versioning", "pages/docs/versions.tsx"),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(projectPath("test-no-versioning", "pages/v")),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath(
          "test-no-versioning",
          "pages/[locale]/docs/versions.tsx",
        ),
      ),
    ).toBe(false);
  });
});

describe("scaffold — zfb next.30 pin bump (PR #1910)", () => {
  /**
   * S6 (#1808) pinned all three zfb packages at next.13. #1817 bumped them to
   * 0.1.0-next.14. #1824 bumped them to 0.1.0-next.19 — next.18 hard-removed
   * the built-in imageEnlarge markdown feature (re-implemented in userland via
   * MDX p-override); next.19 adds the islands esbuild react/jsx-runtime→preact
   * alias fix (Takazudo/zudo-front-builder#633). #1832 bumped them to
   * 0.1.0-next.21 — next.20/next.21 are Rust-engine-internal robustness
   * releases (no SDK API change). #1833 bumped them to 0.1.0-next.22 — an
   * additive bundler/markdown migration-parity release. #1834 bumped them to
   * 0.1.0-next.23: the host adopts bundle.exclude in its own zfb.config.ts
   * (next.23 also ships bundle.mainFields / bundle.external). #1831 bumped them
   * to 0.1.0-next.24: next.24 adds :::caution to admonitionsPreset. Now bumped
   * to 0.1.0-next.25 (#1840): BREAKING — next.25 removes `admonitionsPreset`
   * entirely (hard-errors at load); replaced by the generic
   * `markdown.features.directives` map. Host zfb.config.ts migrated in #1840;
   * generated projects must also pin next.25. #1870 bumped to 0.1.0-next.28:
   * next.26/next.28 are fix/feature releases with no consumer-facing breaking
   * change (UTF-8 preserved in directive quoted attrs, `.mdx` route-template
   * extension strip, embedded-V8 worker console capture). next.27 is skipped
   * deliberately — its published adapter tarball omitted emit-worker.mjs and
   * crashes every adapter consumer (Takazudo/zudo-front-builder#794; fixed in
   * next.28). next.29 (PR #1910): islands code-splitting
   * (dynamic import() boundaries become self-hashed chunks), dev-server route
   * pruning/SSR-reload fixes, and a symlink-safe outdir wipe at build start.
   * Bumped to 0.1.0-next.30 (PR #1910): adds Next.js-style `[[...slug]]`
   * optional-catchall route syntax (Takazudo/zudo-front-builder#812) and raises
   * the zfb-runtime hono floor to ^4.12.23, clearing 9 known advisories (#813);
   * plus two router hardening fixes (overlapping-sibling rejection #816,
   * per-segment rank sort for dev/prod parity) — no consumer-facing breaking
   * change. Now bumped to 0.1.0-next.31: CSS-pipeline and islands-scanner fixes
   * (authored-CSS path when Tailwind is disabled, reproducible CSS-Modules
   * scoped names via project-relative paths, dev-mode git-restore detection,
   * Tailwind temp-file cleanup, near-miss `"use client"` directive scanner) —
   * no consumer-facing breaking change. Bumped to 0.1.0-next.33: adds the
   * opt-in hierarchical heading-ID strategy
   * (Takazudo/zudo-front-builder#871) — `markdown.features.headingIds.strategy`,
   * which the generated config + TOC builder consume via
   * `settings.headingIdStrategy`. next.34 was a routine bin-wrapper
   * signal-handling release. Bumped to 0.1.0-next.35: fixes resolve_links
   * rewriting bare same-page `[text](#anchor)` / `[text](?query)` links to
   * `/<parent-dir>/#anchor` (zudolab/zudo-doc#1948, upstream
   * Takazudo/zudo-front-builder#875). next.36/next.37 were docs-site and CLI
   * ergonomics releases (no engine/SDK change). next.38 added client scripts
   * (`.client.*` + `clientScript()`), the `when="media"` island strategy,
   * exported VNode types, and stricter cross-file anchor validation; upstream
   * BREAKING: removed the no-op `linkValidation.allowExternal` knob — never
   * emitted by the generator, so no migration needed. next.39: features +
   * fixes, no breaking changes — npm-dist `"use client"` island scanning,
   * link-resolution fixes for directory-style hrefs, and island-registry
   * hardening (warns on island marker-name collisions). next.40: `zfb dev`
   * lazy rendering on by default (pages render on first request;
   * `ZFB_DEV_EAGER=1` restores eager mode, Takazudo/zudo-front-builder#1029)
   * — dev-server-only, no breaking changes. next.41: URL-space fallback in
   * resolve_links for dir-style hrefs written from non-index pages
   * (Takazudo/zudo-front-builder#1030), and the data-file skip warning now
   * respects collection include/exclude globs (#1032). Now bumped to
   * 0.1.0-next.50: next.42–next.44 were release-tooling, formatter-glob, and
   * embed-as-library enhancements; next.45 docs-only; next.46 opt-in dev
   * boot-lazy mode + client-router timer lifecycle fixes; next.47 dual
   * light/dark syntect themes (themeLight/themeDark, #1067) plus stricter
   * build-start rejection of unknown theme names; next.48 re-exports
   * @takazudo/zfb/config from the zfb-shim.d.ts type shim — type-only fix;
   * next.49 client-router WebKit bfcache fix (re-sync history index +
   * originalLocation on bfcache restore so browser Back after an SPA navigation
   * returns to the previous page); next.50 client-router fix to commit the SPA
   * history entry before the View Transition so on WebKit/iOS a single browser
   * Back creates a distinct entry instead of falling off the site — both
   * runtime-only bug fixes, additive, no consumer-facing breaking change. Now
   * bumped to 0.1.0-next.51: additive public-API surface (VNode/VNodeArray/
   * VNodeObject exported from "@takazudo/zfb", #972) plus removal of the no-op
   * linkValidation.allowExternal knob (#925) — both non-breaking for a fresh
   * scaffold. Now bumped to 0.1.0-next.52: adds the
   * ClientRouter({ preserveHtmlAttrs }) option (zfb#1104) so runtime <html>
   * attributes (data-sidebar-hidden / data-theme) survive SPA swaps
   * (zudolab/zudo-doc#2200) — additive, non-breaking for a fresh scaffold.
   * Bumped to 0.1.0-next.53: zfb-content GFM-autolink fix terminating the
   * autolink path at CJK boundaries (zfb#1105) - content-rendering bug fix,
   * additive, no consumer-facing breaking change.
   * Now bumped to 0.1.0-next.54: bug-fix + perf release (cross-OS CSS hash
   * stability, multi-valued response headers, supplementary-plane CJK
   * reading-time, CLI/server/runtime hardening) — no breaking changes.
   * Bumped to 0.1.0-next.55: dev-perf + bug-fix release — `zfb dev`
   * incremental shadow materialise (per-session skip cache, dev tick
   * ~6.7s→2.5s) plus a materialise skip-cache wipe on pipeline
   * config-fingerprint change; production builds byte-for-byte unchanged,
   * no consumer-facing breaking change.
   * Bumped to 0.1.0-next.58: routine upstream prerelease adoption
   * (next.58) — no consumer-facing breaking change.
   * Bumped to 0.1.0-next.59: routine upstream prerelease adoption
   * (next.59) — no consumer-facing breaking change.
   * Bumped to 0.1.0-next.60: routine upstream prerelease adoption
   * (next.60) — no consumer-facing breaking change.
   * Bumped to 0.1.0-next.61: routine upstream prerelease adoption
   * (next.61) — no consumer-facing breaking change.
   * Bumped to 0.1.0-next.62: routine upstream prerelease adoption
   * (next.62) — carries build-time package-owned-routes capability
   * (injectRoute in build, definePreset, presets[], addClientEntry) plus
   * router/build fixes. No consumer-facing breaking change.
   * Bumped to 0.1.0-next.65: dev-render of injected routes (zfb#1227, next.63)
   * + islands bundler seeds the host tsconfig `paths` (e.g. `@/*`) into its
   * synthetic tsconfig (zfb#1238) — fixes silent island hydration failure under
   * route injection; unblocks packageOwnedRoutes. No consumer-facing change.
   * Bumped to 0.1.0-next.68: routine upstream prerelease adoption (next.68) in
   * lockstep with the root package.json pins. No consumer-facing change.
   * Bumped to 0.1.0-next.69: routine upstream prerelease adoption (next.69) in
   * lockstep with the root package.json pins. No consumer-facing change.
   * Bumped to 0.1.0-next.70: re-aligned with the root package.json pins after
   * the scaffold pin lagged at next.69 (broke check-pin-parity). No
   * consumer-facing change.
   * Bumped to 0.1.0-next.71: routine toolchain bump carrying the zfb
   * external-@import hoisting work. No consumer-facing change.
   * Bumped to 0.1.0-next.72: routine upstream prerelease adoption (next.72) in
   * lockstep with the root package.json pins. No consumer-facing change.
   * Bumped to 0.1.0-next.74: routine upstream prerelease adoption (next.74,
   * next.73 skipped) in lockstep with the root package.json pins. No
   * consumer-facing change.
   * Bumped to 0.1.0-next.76: routine toolchain bump from next.75, in
   * lockstep with the root package.json pins. No consumer-facing change.
   * Generated package.json must pin all three.
   */
  it("pins @takazudo/zfb at 0.1.0-next.76", async () => {
    const choices: UserChoices = {
      projectName: "test-pin-bump",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(projectPath("test-pin-bump", "package.json"));
    expect(pkg.dependencies["@takazudo/zfb"]).toBe("0.1.0-next.76");
    expect(pkg.dependencies["@takazudo/zfb-runtime"]).toBe("0.1.0-next.76");
    expect(pkg.dependencies["@takazudo/zfb-adapter-cloudflare"]).toBe(
      "0.1.0-next.76",
    );
  });
});

describe("scaffold — W7C cross-feature union (i18n + docTags + versioning) (#1738)", () => {
  // After the Stub-Deletion Fast-Follow (epic #2369) and #2390 (supersedes
  // #2377), every feature-conditional DOC route is now injected by the package
  // (packageOwnedRoutes) — the tags pages, the versions pages, AND the
  // versioned-docs catch-alls (v/[version]/**) — so NONE are emitted as scaffold
  // files. Post-collapse (epic #2420, GENSYNC #2429): pages/lib/_versions-page.tsx
  // and pages/lib/_tag-pages.tsx were also removed from the feature templates —
  // those renderers now live in the package (injected via packageOwnedRoutes).
  it("emits no feature-conditional doc route stubs as scaffold files; all are package-injected", async () => {
    const choices: UserChoices = {
      projectName: "test-union-all",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "i18n", "docTags", "versioning"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    // These routes are all package-injected — NOT emitted as scaffold files.
    const absentExpected = [
      "pages/docs/tags/[tag].tsx",
      "pages/docs/tags/index.tsx",
      "pages/[locale]/docs/tags/[tag].tsx",
      "pages/[locale]/docs/tags/index.tsx",
      "pages/docs/versions.tsx",
      "pages/[locale]/docs/versions.tsx",
      "pages/v/[version]/docs/[[...slug]].tsx",
      "pages/v/[version]/[locale]/docs/[[...slug]].tsx",
      // Post-collapse (#2420): lib renderers also removed from feature templates.
      "pages/lib/_versions-page.tsx",
      "pages/lib/_tag-pages.tsx",
    ];
    for (const rel of absentExpected) {
      expect(
        await fs.pathExists(projectPath("test-union-all", rel)),
        `expected ${rel} to be ABSENT (package-injected, not scaffolded)`,
      ).toBe(false);
    }
  });
});

describe("scaffold — S8 versioned locale route generalization (#1892)", () => {
  /**
   * Regression guard: the versioned non-default-locale route must use a
   * generic [locale] dynamic segment (not a hardcoded 'ja' directory).
   * paths() must loop Object.keys(settings.locales) and emit params.locale;
   * the component must read locale from params, not hardcode "ja".
   * A project with a non-ja locale (e.g. fr) must get a
   * v/[version]/[locale]/docs/[[...slug]].tsx route, not a dead 404.
   *
   * #2390 (supersedes #2377): this route is no longer scaffolded as a host
   * stub — it is package-injected (packageOwnedRoutes). The regression guard
   * therefore now targets the route at its new home: the published
   * `@takazudo/zudo-doc/routes-src/v-locale-docs-slug.tsx` source the routes
   * plugin injects. (The package route uses settings.defaultLocale instead of
   * a hardcoded "en" base — strictly more generic than the old stub.)
   */
  it("package-injected v/[version]/[locale] route uses params.locale — not hardcoded 'ja'", async () => {
    const routeFile = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "zudo-doc/routes-src/v-locale-docs-slug.tsx",
    );
    expect(
      await fs.pathExists(routeFile),
      "package routes-src/v-locale-docs-slug.tsx should exist (run the package build first)",
    ).toBe(true);
    const src = await fs.readFile(routeFile, "utf8");
    // Route must NOT hardcode "ja" as the locale
    expect(src, "route must not contain const locale = \"ja\"").not.toContain(
      'const locale = "ja"',
    );
    // Route must read locale from params
    expect(src, "route must read locale from params").toContain("params.locale");
    // paths() must loop over settings.locales keys (generic, not ja-specific)
    expect(
      src,
      "paths() must enumerate Object.keys(settings.locales)",
    ).toContain("Object.keys(settings.locales)");
  });
});

// ---------------------------------------------------------------------------
// F4 (S4 #2013) — centralized project-name validation
// Tests validateProjectName utility (shared by CLI arg, prompt, preset, and
// programmatic API paths).
// ---------------------------------------------------------------------------

describe("validateProjectName — locked grammar (F4 #2013)", () => {
  it("accepts a valid lowercase kebab name", () => {
    expect(validateProjectName("my-docs")).toBeNull();
  });

  it("accepts a single-char name", () => {
    expect(validateProjectName("a")).toBeNull();
  });

  it("accepts a name starting with a digit", () => {
    expect(validateProjectName("1my-docs")).toBeNull();
  });

  it("accepts a name with dots", () => {
    expect(validateProjectName("my.docs")).toBeNull();
  });

  it("accepts a name with underscores", () => {
    expect(validateProjectName("my_docs")).toBeNull();
  });

  it("accepts a name with hyphens", () => {
    expect(validateProjectName("my-docs-v2")).toBeNull();
  });

  it("accepts a name exactly 214 characters", () => {
    expect(validateProjectName("a".repeat(214))).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateProjectName("")).toMatch(/required/);
  });

  it("rejects a name longer than 214 characters", () => {
    expect(validateProjectName("a".repeat(215))).toMatch(/214/);
  });

  it("rejects a name with uppercase letters", () => {
    expect(validateProjectName("My-Docs")).toMatch(/lowercase/);
  });

  it("rejects a name with spaces", () => {
    expect(validateProjectName("my docs")).toMatch(/lowercase/);
  });

  it("rejects a name starting with a hyphen", () => {
    expect(validateProjectName("-my-docs")).toMatch(/lowercase/);
  });

  it("rejects a name starting with a dot", () => {
    expect(validateProjectName(".my-docs")).toMatch(/lowercase/);
  });

  it("rejects a name starting with an underscore", () => {
    expect(validateProjectName("_my-docs")).toMatch(/lowercase/);
  });

  it("rejects a name with a slash", () => {
    expect(validateProjectName("my/docs")).toMatch(/lowercase/);
  });

  it("rejects a name with a backslash", () => {
    expect(validateProjectName("my\\docs")).toMatch(/lowercase/);
  });

  it("rejects a scoped npm name", () => {
    expect(validateProjectName("@scope/my-docs")).toMatch(/lowercase/);
  });
});

describe("scaffold — programmatic API rejects invalid project names (F4 #2013)", () => {
  // Exercises the createZudoDoc() entry point directly — the validator fires
  // before scaffold() is called, so no directory is created.
  it("createZudoDoc() throws for an invalid project name with uppercase", async () => {
    await expect(
      createZudoDoc({
        projectName: "My-Invalid-Docs",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Invalid projectName/);
  });

  it("createZudoDoc() throws for a name with spaces", async () => {
    await expect(
      createZudoDoc({
        projectName: "my invalid",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Invalid projectName/);
  });

  it("createZudoDoc() throws for a name longer than 214 chars", async () => {
    await expect(
      createZudoDoc({
        projectName: "a".repeat(215),
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Invalid projectName/);
  });

  // Post-catalog-drop (#2619) only Default Light/Dark exist. The API must reject
  // a removed scheme name (e.g. "Dracula") like the CLI/preset paths — otherwise
  // it writes the dead name into settings.ts and the generated site throws
  // "Unknown color scheme" at build.
  it("createZudoDoc() throws for a removed single scheme name", async () => {
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "single",
        singleScheme: "Dracula",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Unknown color scheme "Dracula"/);
  });

  it("createZudoDoc() throws for a removed light scheme name", async () => {
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "light-dark",
        lightScheme: "GitHub Light",
        darkScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Unknown light scheme "GitHub Light"/);
  });

  it("createZudoDoc() throws for a removed dark scheme name", async () => {
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "light-dark",
        lightScheme: "Default Light",
        darkScheme: "Nord",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Unknown dark scheme "Nord"/);
  });
});

describe("scaffold — metaTags preset override (S5 #2079)", () => {
  it("emits S4 defaults when metaTags is absent from choices", async () => {
    const choices: UserChoices = {
      projectName: "test-metatags-default",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-metatags-default", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("metaTags: {");
    expect(content).toContain("description: true");
    expect(content).toContain("keywords: false");
    expect(content).toContain("ogImage: false");
    expect(content).toContain("ogSiteName: true");
    expect(content).toContain("twitterCard: false");
  });

  it("emits chosen values when ogImage is enabled in the preset", async () => {
    const choices: UserChoices = {
      projectName: "test-metatags-ogimage",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
      metaTags: {
        description: true,
        keywords: false,
        ogImage: "/img/ogp.png",
        ogSiteName: true,
        twitterCard: false,
      },
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-metatags-ogimage", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("metaTags: {");
    expect(content).toContain('ogImage: "/img/ogp.png"');
  });

  it("emits twitterCard and handles when full twitter config is set", async () => {
    const choices: UserChoices = {
      projectName: "test-metatags-twitter",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
      metaTags: {
        description: true,
        keywords: false,
        ogImage: false,
        ogSiteName: true,
        twitterCard: "summary_large_image",
        twitterSite: "@brand",
        twitterCreator: "@author",
      },
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-metatags-twitter", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('"summary_large_image"');
    expect(content).toContain('"@brand"');
    expect(content).toContain('"@author"');
  });
});

// #2162 — zdtp scaffolding gated behind designTokenPanel feature
describe("scaffold — designTokenPanel zdtp gating (#2162)", () => {
  describe("feature OFF — zero zdtp / design-token-panel references", () => {
    const choices: UserChoices = {
      projectName: "test-zdtp-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };

    // The first 4 tests below all read the same `choices` scaffold output and
    // none mutate the tree, so it is scaffolded once in beforeAll instead of
    // once per `it` (#2531 — dedupe scaffold() calls). The 5th test uses a
    // different config (`choicesWithDtpTrigger`) and keeps its own per-test
    // scaffold via the module-level `projectPath`/ambient tempDir, so this
    // helper is named `sharedProjectPath` (not `projectPath`) to avoid
    // shadowing that test's lookup.
    let sharedDir: string;
    function sharedProjectPath(...segments: string[]): string {
      return path.join(sharedDir, segments[0]!, ...segments.slice(1));
    }
    beforeAll(async () => {
      const cwdBefore = process.cwd();
      sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
      process.chdir(sharedDir);
      await scaffold(choices);
      process.chdir(cwdBefore);
    });
    afterAll(async () => {
      await fs.remove(sharedDir);
    });

    it("_body-end-islands.tsx contains no zdtp import, displayName, or Island", async () => {
      const content = await fs.readFile(
        sharedProjectPath("test-zdtp-off", "pages/lib/_body-end-islands.tsx"),
        "utf-8",
      );
      expect(content).not.toContain("zdtp");
      expect(content).not.toContain("design-token-panel");
      expect(content).not.toContain("DesignTokenPanel");
    });

    it("settings-types.ts contains no 'design-token-panel' literal", async () => {
      const content = await fs.readFile(
        sharedProjectPath("test-zdtp-off", "src/config/settings-types.ts"),
        "utf-8",
      );
      expect(content).not.toContain("design-token-panel");
    });

    it("settings-types.ts still exports HeaderRightTriggerName (ai-chat only)", async () => {
      const content = await fs.readFile(
        sharedProjectPath("test-zdtp-off", "src/config/settings-types.ts"),
        "utf-8",
      );
      expect(content).toContain("HeaderRightTriggerName");
      expect(content).toContain('"ai-chat"');
    });

    it("design-token-panel-bootstrap component is NOT copied to feature-off scaffold", async () => {
      expect(
        await fs.pathExists(
          sharedProjectPath(
            "test-zdtp-off",
            "src/components/design-token-panel-bootstrap.tsx",
          ),
        ),
      ).toBe(false);
    });

    it("settings-gen: user-supplied headerRightItems with design-token-panel trigger is filtered out", async () => {
      const choicesWithDtpTrigger: UserChoices = {
        projectName: "test-zdtp-hri-filter",
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: ["search"],
        packageManager: "pnpm",
        // Explicit design-token-panel trigger without the feature — must be
        // dropped silently so the generated settings.ts type-checks
        // (HeaderRightTriggerName doesn't include "design-token-panel" when off).
        headerRightItems: [
          { type: "trigger", trigger: "design-token-panel" },
          { type: "component", component: "github-link" },
        ],
      };
      await scaffold(choicesWithDtpTrigger);
      const content = await fs.readFile(
        projectPath("test-zdtp-hri-filter", "src/config/settings.ts"),
        "utf-8",
      );
      // The design-token-panel trigger must be stripped.
      expect(content).not.toContain('trigger: "design-token-panel"');
      // The github-link entry must still be present.
      expect(content).toContain('component: "github-link"');
    });
  });

  describe("feature ON — zdtp import, displayName, toggle shim, and Island present", () => {
    const choices: UserChoices = {
      projectName: "test-zdtp-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
    };

    // Every test below reads the same scaffold output and none mutate the
    // tree, so `choices` is scaffolded once in beforeAll instead of once per
    // `it` (#2531 — dedupe scaffold() calls). This shadows the module-level
    // `projectPath` for this describe only.
    let sharedDir: string;
    function projectPath(...segments: string[]): string {
      return path.join(sharedDir, segments[0]!, ...segments.slice(1));
    }
    beforeAll(async () => {
      const cwdBefore = process.cwd();
      sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
      process.chdir(sharedDir);
      await scaffold(choices);
      process.chdir(cwdBefore);
    });
    afterAll(async () => {
      await fs.remove(sharedDir);
    });

    it("_body-end-islands.tsx contains DesignTokenPanelBootstrap import", async () => {
      const content = await fs.readFile(
        projectPath("test-zdtp-on", "pages/lib/_body-end-islands.tsx"),
        "utf-8",
      );
      expect(content).toContain(
        'import DesignTokenPanelBootstrap from "@/components/design-token-panel-bootstrap"',
      );
    });

    it("_body-end-islands.tsx contains DesignTokenPanelBootstrap displayName", async () => {
      const content = await fs.readFile(
        projectPath("test-zdtp-on", "pages/lib/_body-end-islands.tsx"),
        "utf-8",
      );
      expect(content).toContain(
        '(DesignTokenPanelBootstrap as { displayName?: string }).displayName = "DesignTokenPanelBootstrap"',
      );
    });

    it("_body-end-islands.tsx contains the pre-hydration toggle shim script", async () => {
      const content = await fs.readFile(
        projectPath("test-zdtp-on", "pages/lib/_body-end-islands.tsx"),
        "utf-8",
      );
      expect(content).toContain("__zdtpToggleShimInstalled");
      expect(content).toContain("toggle-design-token-panel");
      expect(content).toContain("__zdtpReadyClicks");
    });

    it("_body-end-islands.tsx contains the DesignTokenPanelBootstrap Island mount", async () => {
      const content = await fs.readFile(
        projectPath("test-zdtp-on", "pages/lib/_body-end-islands.tsx"),
        "utf-8",
      );
      expect(content).toContain("<DesignTokenPanelBootstrap />");
    });

    it("settings-types.ts contains 'design-token-panel' in HeaderRightTriggerName", async () => {
      const content = await fs.readFile(
        projectPath("test-zdtp-on", "src/config/settings-types.ts"),
        "utf-8",
      );
      expect(content).toContain('"design-token-panel"');
      expect(content).toContain("HeaderRightTriggerName");
    });

    it("design-token-panel trigger appears in default headerRightItems fallback", async () => {
      const content = await fs.readFile(
        projectPath("test-zdtp-on", "src/config/settings.ts"),
        "utf-8",
      );
      expect(content).toContain('trigger: "design-token-panel"');
    });
  });
});

// Regression guard for #2172: the base template already imports `settings`,
// so the imageEnlarge feature must NOT inject a second
// `import { settings } from "@/config/settings";` line — a duplicate would be
// an illegal ES-module re-declaration of the same lexical binding.
//
// Post-collapse (epic #2420, GENSYNC #2429): pages/_mdx-components.ts is no
// longer emitted. The duplicate-settings-import guard no longer applies to that
// file — MDX extras now live in _chrome.ts via hostBindings.mdxExtras.
describe("scaffold — imageEnlarge does not duplicate the settings import (#2172)", () => {
  it("pages/_mdx-components.ts is absent when imageEnlarge is enabled (#2420)", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-dup-import",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "imageEnlarge"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    // File no longer emitted; the duplicate-import concern is moot.
    expect(
      await fs.pathExists(projectPath("test-ie-dup-import", "pages/_mdx-components.ts")),
    ).toBe(false);
  });
});

describe("scaffold — dynamicPageTransition feature (#2267)", () => {
  // The 12 tests below collapse to 2 distinct configs (only projectName
  // differed within each group): `search`+`dynamicPageTransition` (6
  // "feature ON" tests, canonical "test-dpt-on-file") and bare `search` (6
  // "feature OFF" tests, canonical "test-dpt-off-file"). Scaffold each once
  // in beforeAll instead of once per `it` (#2531 — dedupe scaffold()
  // calls). This shadows the module-level `projectPath` for this describe
  // only.
  const dptOnChoices: UserChoices = {
    projectName: "test-dpt-on-file",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "dynamicPageTransition"],
    packageManager: "pnpm",
  };
  const dptOffChoices: UserChoices = {
    projectName: "test-dpt-off-file",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };
  let sharedDir: string;
  function projectPath(...segments: string[]): string {
    return path.join(sharedDir, segments[0]!, ...segments.slice(1));
  }
  beforeAll(async () => {
    const cwdBefore = process.cwd();
    sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(sharedDir);
    await scaffold(dptOnChoices);
    await scaffold(dptOffChoices);
    process.chdir(cwdBefore);
  });
  afterAll(async () => {
    await fs.remove(sharedDir);
  });

  it("feature ON: generates client-router-bootstrap.tsx", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-dpt-on-file",
          "src/components/client-router-bootstrap.tsx",
        ),
      ),
    ).toBe(true);
  });

  it("feature ON: global.css contains page-loading.css import, overlay token, and ::view-transition- rule", async () => {
    const css = await fs.readFile(
      projectPath("test-dpt-on-file", "src/styles/global.css"),
      "utf-8",
    );
    // Page-loading CSS is now shipped as a package artifact (#2283) — expect
    // a gated @import, not inline rule bodies.
    expect(css).toContain('@import "@takazudo/zudo-doc/page-loading.css";');
    expect(css).toContain("--color-page-loading-overlay");
    expect(css).not.toContain(".page-loading-overlay {");
    expect(css).not.toContain("@keyframes page-loading-spin");
    // View-Transitions CSS must still be present.
    expect(css).toMatch(/::view-transition-/);
  });

  it("feature ON: settings.ts contains dynamicPageTransition: true", async () => {
    const content = await fs.readFile(
      projectPath("test-dpt-on-file", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("dynamicPageTransition: true");
  });

  it("feature OFF: does NOT generate client-router-bootstrap.tsx", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-dpt-off-file",
          "src/components/client-router-bootstrap.tsx",
        ),
      ),
    ).toBe(false);
  });

  it("feature OFF: global.css does NOT contain page-loading import, overlay token, or ::view-transition- rules; imports anchor is cleaned", async () => {
    const css = await fs.readFile(
      projectPath("test-dpt-off-file", "src/styles/global.css"),
      "utf-8",
    );
    expect(css).not.toContain("page-loading.css");
    expect(css).not.toContain("--color-page-loading-overlay");
    expect(css).not.toContain(".page-loading-overlay");
    expect(css).not.toMatch(/::view-transition-/);
    // The @slot:global-css:imports anchor must have been cleaned up.
    expect(css).not.toContain("@slot:global-css:imports");
  });

  it("feature OFF: settings.ts contains dynamicPageTransition: false", async () => {
    const content = await fs.readFile(
      projectPath("test-dpt-off-file", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("dynamicPageTransition: false");
  });

  // #2276: every <DocLayoutWithDefaults> render site must thread
  // enableClientRouter={settings.dynamicPageTransition} so the SPA router is
  // gated per-page by the settings flag.
  //
  // Post-collapse (epic #2420, GENSYNC #2429): `_doc-page-shell.tsx` was removed
  // from the scaffold template — chrome wiring collapsed into `_chrome.ts`. For the
  // shell render site we assert the prop in the package factory source. The
  // scaffold no longer emits `_doc-page-shell.tsx` in any variant.
  it("feature ON: _doc-page-shell.tsx is absent; package factory threads enableClientRouter", async () => {
    // Post-collapse: file is no longer emitted.
    expect(
      await fs.pathExists(projectPath("test-dpt-on-file", "pages/lib/_doc-page-shell.tsx")),
    ).toBe(false);

    // The actual prop on <DocLayoutWithDefaults> lives in the package factory.
    const shellFactory = await fs.readFile(
      packageSrcPath("doc-page-shell/index.tsx"),
      "utf-8",
    );
    expect(shellFactory).toContain(
      "enableClientRouter={settings.dynamicPageTransition}",
    );
  });

  it("feature OFF: _doc-page-shell.tsx is absent; package factory threads enableClientRouter", async () => {
    // Post-collapse: file is no longer emitted.
    expect(
      await fs.pathExists(projectPath("test-dpt-off-file", "pages/lib/_doc-page-shell.tsx")),
    ).toBe(false);

    // The prop must be present in the factory regardless of feature state.
    const shellFactory = await fs.readFile(
      packageSrcPath("doc-page-shell/index.tsx"),
      "utf-8",
    );
    expect(shellFactory).toContain(
      "enableClientRouter={settings.dynamicPageTransition}",
    );
  });

  // S4 (#2503): pages/index.tsx adopted the shared HomePageView body (#2502)
  // and is now a thin data-prep consumer — the <DocLayoutWithDefaults> render
  // (and its enableClientRouter prop) moved into the package factory
  // (home-page/index.tsx), same as the doc-page-shell precedent above. The
  // prop lives in the factory regardless of feature state, so pages/index.tsx
  // itself no longer threads it.
  it("feature ON: pages/index.tsx delegates to HomePageView; package factory threads enableClientRouter", async () => {
    const content = await fs.readFile(
      projectPath("test-dpt-on-file", "pages/index.tsx"),
      "utf-8",
    );
    expect(content).toContain("HomePageView");
    expect(content).not.toContain("enableClientRouter");

    const homePageFactory = await fs.readFile(
      packageSrcPath("home-page/index.tsx"),
      "utf-8",
    );
    expect(homePageFactory).toContain(
      "enableClientRouter={settings.dynamicPageTransition}",
    );
  });

  it("feature OFF: pages/index.tsx delegates to HomePageView; package factory threads enableClientRouter", async () => {
    const content = await fs.readFile(
      projectPath("test-dpt-off-file", "pages/index.tsx"),
      "utf-8",
    );
    expect(content).toContain("HomePageView");
    expect(content).not.toContain("enableClientRouter");

    const homePageFactory = await fs.readFile(
      packageSrcPath("home-page/index.tsx"),
      "utf-8",
    );
    expect(homePageFactory).toContain(
      "enableClientRouter={settings.dynamicPageTransition}",
    );
  });

  // pages/404.tsx was removed from the scaffold template in the Stub-Deletion
  // Fast-Follow (epic #2369) — the 404 route is now injected by the package
  // (packageOwnedRoutes). The enableClientRouter prop is handled inside the
  // package factory; no scaffold file needs to thread it for 404.
  it("does NOT emit pages/404.tsx as a scaffold file (package-injected) when dynamicPageTransition is ON", async () => {
    expect(
      await fs.pathExists(projectPath("test-dpt-on-file", "pages/404.tsx")),
    ).toBe(false);
  });

  it("does NOT emit pages/404.tsx as a scaffold file (package-injected) when dynamicPageTransition is OFF", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-dpt-off-file", "pages/404.tsx"),
      ),
    ).toBe(false);
  });
});

describe("scaffold — noindex feature (#2218)", () => {
  it("settings have noindex: true when noindex feature is selected", async () => {
    const choices: UserChoices = {
      projectName: "test-noindex-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "noindex"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-noindex-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("noindex: true as boolean");
    expect(content).not.toContain("noindex: false as boolean");
  });

  it("settings have noindex: false when noindex feature is not selected", async () => {
    const choices: UserChoices = {
      projectName: "test-noindex-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-noindex-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("noindex: false as boolean");
    expect(content).not.toContain("noindex: true as boolean");
  });
});
