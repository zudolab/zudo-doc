import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { eject, EJECTABLE } from "@takazudo/zudo-doc/eject";
import type { ZudoDocJson } from "@takazudo/zudo-doc/eject";

const TEMP_PREFIX = "create-zudo-doc-eject-test-";

// ── Fixture helpers ───────────────────────────────────────────────────────────

/**
 * Build a minimal fixture package tree that looks like what
 * @takazudo/zudo-doc ships: an `eject/<component>/` directory with a couple
 * of TS source files. This allows tests to run without the real installed
 * package.
 *
 * Returns the path to the fake package root.
 */
async function buildFixturePackage(
  dir: string,
  component: string,
  files: Record<string, string> = {},
): Promise<string> {
  const pkgRoot = path.join(dir, "fake-pkg");
  await fs.ensureDir(path.join(pkgRoot, "eject", component));
  await fs.writeJson(path.join(pkgRoot, "package.json"), {
    name: "@takazudo/zudo-doc",
    version: "0.2.22",
  });

  // Default files if none provided
  const defaultFiles: Record<string, string> = {
    "index.ts": `export { Comp } from "./comp.js";\n`,
    "comp.tsx": `/** @jsxRuntime automatic */\nexport function Comp() { return null; }\n`,
  };
  const toWrite = Object.keys(files).length > 0 ? files : defaultFiles;

  for (const [name, content] of Object.entries(toWrite)) {
    await fs.outputFile(path.join(pkgRoot, "eject", component, name), content);
  }
  return pkgRoot;
}

/**
 * Injectable package-root resolver that always returns `fixturePkgRoot`.
 */
function makeResolver(fixturePkgRoot: string) {
  return (_cwd: string) => fixturePkgRoot;
}

// ── Test state ────────────────────────────────────────────────────────────────

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.remove(tempDir);
});

// ── EJECTABLE map ─────────────────────────────────────────────────────────────

describe("EJECTABLE map", () => {
  it("contains exactly 18 components", () => {
    expect(Object.keys(EJECTABLE)).toHaveLength(18);
  });

  it("includes all required components", () => {
    const required = [
      "header",
      "footer",
      "breadcrumb",
      "toc",
      "sidebar",
      "theme-toggle",
      "page-loading",
      "tab-item",
      "doc-pager",
      "content-admonition",
      "code-group",
      "details",
      "sidebar-tree-island",
      "sidebar-toggle-island",
      "desktop-sidebar-toggle-island",
      "image-enlarge",
      "doc-history",
      "site-tree-nav-island",
    ];
    for (const name of required) {
      expect(EJECTABLE).toHaveProperty(name);
    }
  });

  it("all entries have the correct package subpath shape", () => {
    for (const [name, entry] of Object.entries(EJECTABLE)) {
      expect(entry.packageSubpath).toBe(`@takazudo/zudo-doc/${name}`);
      expect(entry.localDir).toBe(`src/components/zudo-doc/${name}`);
    }
  });

  it("statically classifies every entry and fails closed on new classes or entries", () => {
    const byClass: Record<string, Array<[string, (typeof EJECTABLE)[string]]>> = {};
    for (const pair of Object.entries(EJECTABLE)) {
      const kind = pair[1].classification.kind;
      (byClass[kind] ??= []).push(pair);
    }

    expect((byClass.primary ?? []).map(([name]) => name).sort()).toEqual([
      "breadcrumb",
      "doc-pager",
      "footer",
      "header",
      "sidebar",
      "toc",
    ]);
    expect((byClass.nested ?? []).map(([name]) => name).sort()).toEqual([
      "desktop-sidebar-toggle-island",
      "doc-history",
      "image-enlarge",
      "page-loading",
      "sidebar-toggle-island",
      "sidebar-tree-island",
      "site-tree-nav-island",
      "theme-toggle",
    ]);
    expect((byClass.content ?? []).map(([name]) => name).sort()).toEqual([
      "code-group",
      "content-admonition",
      "details",
      "tab-item",
    ]);
    expect(Object.keys(byClass).sort()).toEqual(["content", "nested", "primary"]);
  });
});

// ── eject() — binding-aware guidance ─────────────────────────────────────────

describe("eject() — binding-aware guidance", () => {
  const primaryCases = [
    ["header", "Header"],
    ["footer", "Footer"],
    ["sidebar", "Sidebar"],
    ["toc", "Toc"],
    ["breadcrumb", "Breadcrumb"],
    ["doc-pager", "DocPager"],
  ] as const;

  for (const [component, slot] of primaryCases) {
    it(`warns that an unwired ${component} copy needs the ${slot} primary slot`, async () => {
      const projectDir = path.join(tempDir, `project-${component}`);
      await fs.ensureDir(projectDir);
      const pkgRoot = await buildFixturePackage(tempDir, component);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

      await eject(component, {
        cwd: projectDir,
        resolvePackageRoot: makeResolver(pkgRoot),
      });

      const warning = warn.mock.calls.flat().join("\n");
      const output = log.mock.calls.flat().join("\n");
      expect(warning).toContain(`chromeBindings.${slot}`);
      expect(warning).toContain(`the ${slot} primary replacement slot`);
      expect(warning).toContain("Editing the copy will not change your site");
      expect(warning).toContain("/docs/reference/customizing/");
      expect(output).toContain("but it is not wired into the rendered site");
      expect(output).not.toContain(`✓ Ejected ${component}`);

      warn.mockRestore();
      log.mockRestore();
    });
  }

  const nestedCases = [
    ["theme-toggle", "chromeBindings.headerRightComponents"],
    ["page-loading", "chromeBindings.BodyEndIslands"],
    ["sidebar-tree-island", "chromeBindings.Sidebar"],
    ["sidebar-toggle-island", "chromeBindings.Header"],
    ["desktop-sidebar-toggle-island", "settings.sidebarToggle"],
    ["image-enlarge", "chromeBindings.BodyEndIslands"],
    ["doc-history", "chromeBindings.DocHistory"],
    ["site-tree-nav-island", "chromeBindings.mdxExtras.SiteTreeNav"],
  ] as const;

  for (const [component, remediation] of nestedCases) {
    it(`warns with the exact supported remediation for nested ${component}`, async () => {
      const projectDir = path.join(tempDir, `project-${component}`);
      await fs.ensureDir(projectDir);
      const pkgRoot = await buildFixturePackage(tempDir, component);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

      await eject(component, {
        cwd: projectDir,
        resolvePackageRoot: makeResolver(pkgRoot),
      });

      const warning = warn.mock.calls.flat().join("\n");
      expect(warning).toContain("rendered by package chrome");
      expect(warning).toContain(remediation);
      expect(warning).toContain("/docs/reference/customizing/");
      expect(log.mock.calls.flat().join("\n")).toContain(
        "but it is not wired into the rendered site",
      );

      warn.mockRestore();
      log.mockRestore();
    });
  }

  it("points theme-toggle at a new named registry entry, not the reserved built-in", async () => {
    const projectDir = path.join(tempDir, "project-theme-toggle-registry");
    await fs.ensureDir(projectDir);
    const pkgRoot = await buildFixturePackage(tempDir, "theme-toggle");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await eject("theme-toggle", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    const warning = warn.mock.calls.flat().join("\n");
    expect(warning).toContain("under a new name");
    expect(warning).toContain("settings.headerRightItems");
    expect(warning).toContain('built-in name "theme-toggle" is reserved');

    warn.mockRestore();
    log.mockRestore();
  });

  const contentCases = [
    ["tab-item", "chromeBindings.mdxExtras.TabItem"],
    ["content-admonition", "matching chromeBindings.mdxExtras keys"],
    ["code-group", "chromeBindings.mdxExtras.CodeGroup"],
    ["details", "chromeBindings.mdxExtras.Details"],
  ] as const;

  for (const [component, remediation] of contentCases) {
    it(`keeps quiet manual mdxExtras guidance for ${component}`, async () => {
      const projectDir = path.join(tempDir, `project-${component}`);
      await fs.ensureDir(projectDir);
      const pkgRoot = await buildFixturePackage(tempDir, component);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

      await eject(component, {
        cwd: projectDir,
        resolvePackageRoot: makeResolver(pkgRoot),
      });

      expect(warn).not.toHaveBeenCalled();
      const output = log.mock.calls.flat().join("\n");
      expect(output).toContain(remediation);
      expect(output).toContain("/docs/guides/custom-components/");
      expect(output).toContain(`✓ Ejected ${component}`);

      warn.mockRestore();
      log.mockRestore();
    });
  }

  it("stays successful and quiet when a configured chrome import is rewritten", async () => {
    const projectDir = path.join(tempDir, "project-configured-header");
    const hostFile = path.join(projectDir, "src/chrome-bindings.tsx");
    await fs.outputFile(
      hostFile,
      `import { Header } from "@takazudo/zudo-doc/header";\nexport { Header };\n`,
    );
    const pkgRoot = await buildFixturePackage(tempDir, "header");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await eject("header", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    expect(warn).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join("\n")).toContain("✓ Ejected header");
    expect(await fs.readFile(hostFile, "utf8")).not.toContain(
      '@takazudo/zudo-doc/header',
    );

    warn.mockRestore();
    log.mockRestore();
  });
});

// ── eject() — copy + provenance ───────────────────────────────────────────────

describe("eject() — copy + provenance", () => {
  it("copies the eject source tree into the local destination dir", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    const pkgRoot = await buildFixturePackage(tempDir, "footer");
    await eject("footer", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    const destDir = path.join(projectDir, "src/components/zudo-doc/footer");
    expect(await fs.pathExists(destDir)).toBe(true);
    expect(await fs.pathExists(path.join(destDir, "index.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(destDir, "comp.tsx"))).toBe(true);
  });

  it("writes .zudo-doc.json with the component recorded", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    const pkgRoot = await buildFixturePackage(tempDir, "sidebar");
    await eject("sidebar", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    const provenancePath = path.join(projectDir, ".zudo-doc.json");
    expect(await fs.pathExists(provenancePath)).toBe(true);
    const provenance = await fs.readJson(provenancePath) as ZudoDocJson;
    expect(provenance.packageVersion).toBe("0.2.22");
    expect(provenance.ejected["sidebar"]).toBe("src/components/zudo-doc/sidebar");
  });

  it("records the installed package version from eject source package.json", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    // Use a different version to verify it reads from the fixture pkg
    const pkgRoot = await buildFixturePackage(tempDir, "toc");
    await fs.writeJson(path.join(pkgRoot, "package.json"), {
      name: "@takazudo/zudo-doc",
      version: "1.5.0",
    });

    await eject("toc", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    const provenance = await fs.readJson(
      path.join(projectDir, ".zudo-doc.json"),
    ) as ZudoDocJson;
    expect(provenance.packageVersion).toBe("1.5.0");
  });
});

// ── eject() — import rewiring ─────────────────────────────────────────────────

describe("eject() — import rewiring", () => {
  it("rewrites parent-relative cross-component imports to package subpaths", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    const componentFiles: Record<string, string> = {
      "index.ts": `export { Header } from "./header.js";\n`,
      "header.tsx": [
        `/** @jsxRuntime automatic */`,
        `import { ChevronRight } from "../icons/index.js";`,
        `import { SmartBreak } from "../smart-break/index.js";`,
        `export function Header() { return null; }`,
      ].join("\n") + "\n",
    };

    const pkgRoot = await buildFixturePackage(tempDir, "header", componentFiles);
    await eject("header", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    const headerPath = path.join(
      projectDir,
      "src/components/zudo-doc/header/header.tsx",
    );
    const content = await fs.readFile(headerPath, "utf8");
    expect(content).toContain(`from "@takazudo/zudo-doc/icons"`);
    expect(content).toContain(`from "@takazudo/zudo-doc/smart-break"`);
    expect(content).not.toContain(`from "../icons/`);
    expect(content).not.toContain(`from "../smart-break/`);
  });

  it("keeps same-dir relatives verbatim", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    const componentFiles: Record<string, string> = {
      "index.ts": `export { Footer } from "./footer.js";\n`,
      "footer.tsx": [
        `/** @jsxRuntime automatic */`,
        `import { types } from "./types.js";`,
        `import { helper } from "./utils.js";`,
        `export function Footer() { return null; }`,
      ].join("\n") + "\n",
      "types.ts": `export type FooterTypes = {};\n`,
    };

    const pkgRoot = await buildFixturePackage(tempDir, "footer", componentFiles);
    await eject("footer", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    const footerPath = path.join(
      projectDir,
      "src/components/zudo-doc/footer/footer.tsx",
    );
    const content = await fs.readFile(footerPath, "utf8");
    expect(content).toContain(`from "./types.js"`);
    expect(content).toContain(`from "./utils.js"`);
  });

  it("rewrites transitions parent-relative import to @takazudo/zudo-doc/transitions", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    const componentFiles: Record<string, string> = {
      "index.ts": `export { Overlay } from "./overlay.js";\n`,
      "overlay.ts": [
        `import { AFTER_NAVIGATE_EVENT, BEFORE_NAVIGATE_EVENT } from "../transitions/page-events.js";`,
        `export const Overlay = null;`,
      ].join("\n") + "\n",
    };

    const pkgRoot = await buildFixturePackage(
      tempDir,
      "page-loading",
      componentFiles,
    );
    await eject("page-loading", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    const overlayPath = path.join(
      projectDir,
      "src/components/zudo-doc/page-loading/overlay.ts",
    );
    const content = await fs.readFile(overlayPath, "utf8");
    // The transitions barrel re-exports page-events symbols, so this rewrite is safe
    expect(content).toContain(`from "@takazudo/zudo-doc/transitions"`);
    expect(content).not.toContain(`from "../transitions/`);
  });
});

// ── eject() — host call site rewiring ────────────────────────────────────────

describe("eject() — host call site rewiring", () => {
  it("rewrites host src/ import of the package subpath to local path", async () => {
    const projectDir = path.join(tempDir, "project");

    // Seed a host call site
    const hostFile = path.join(projectDir, "src/pages/my-page.tsx");
    await fs.outputFile(
      hostFile,
      [
        `import { ThemeToggle } from "@takazudo/zudo-doc/theme-toggle";`,
        `export default function Page() { return null; }`,
      ].join("\n") + "\n",
    );

    const pkgRoot = await buildFixturePackage(tempDir, "theme-toggle");
    await eject("theme-toggle", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    const rewritten = await fs.readFile(hostFile, "utf8");
    expect(rewritten).not.toContain(`from "@takazudo/zudo-doc/theme-toggle"`);
    // Should now point at the local destination (as a relative path from the host file)
    expect(rewritten).toContain(`components/zudo-doc/theme-toggle`);
  });
});

// ── eject() — idempotency ─────────────────────────────────────────────────────

describe("eject() — idempotency", () => {
  it("is a safe no-op when the component is already recorded in .zudo-doc.json", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    // Pre-seed .zudo-doc.json as if the component was already ejected
    const provenancePath = path.join(projectDir, ".zudo-doc.json");
    const existing: ZudoDocJson = {
      packageVersion: "0.2.22",
      ejected: {
        details: "src/components/zudo-doc/details",
      },
    };
    await fs.writeJson(provenancePath, existing, { spaces: 2 });

    // Also create the destination dir with a "user-edited" file
    const destDir = path.join(projectDir, "src/components/zudo-doc/details");
    await fs.ensureDir(destDir);
    await fs.writeFile(path.join(destDir, "my-customization.tsx"), "// user edit\n");

    const pkgRoot = await buildFixturePackage(tempDir, "details");
    await eject("details", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    // The user's custom file must still exist (not clobbered)
    const customFile = path.join(destDir, "my-customization.tsx");
    expect(await fs.pathExists(customFile)).toBe(true);
    const customContent = await fs.readFile(customFile, "utf8");
    expect(customContent).toBe("// user edit\n");

    // .zudo-doc.json must not have gained duplicate entries
    const afterProvenance = await fs.readJson(provenancePath) as ZudoDocJson;
    expect(Object.keys(afterProvenance.ejected)).toHaveLength(1);
    expect(afterProvenance.ejected["details"]).toBe("src/components/zudo-doc/details");
  });

  it("secondary guard: skips if destination dir exists even without provenance entry", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    // No .zudo-doc.json entry, but the dest dir already exists
    const destDir = path.join(projectDir, "src/components/zudo-doc/details");
    await fs.ensureDir(destDir);
    await fs.writeFile(path.join(destDir, "user-file.tsx"), "// mine\n");

    const pkgRoot = await buildFixturePackage(tempDir, "details");
    await eject("details", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    // The user's file must still be untouched
    const userFile = path.join(destDir, "user-file.tsx");
    expect(await fs.pathExists(userFile)).toBe(true);
    expect(await fs.readFile(userFile, "utf8")).toBe("// mine\n");
  });

  it("appends to an existing .zudo-doc.json without overwriting other entries", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    // Seed with an existing ejected component
    const provenancePath = path.join(projectDir, ".zudo-doc.json");
    await fs.writeJson(
      provenancePath,
      {
        packageVersion: "0.2.22",
        ejected: { footer: "src/components/zudo-doc/footer" },
      },
      { spaces: 2 },
    );

    const pkgRoot = await buildFixturePackage(tempDir, "breadcrumb");
    await eject("breadcrumb", {
      cwd: projectDir,
      resolvePackageRoot: makeResolver(pkgRoot),
    });

    const afterProvenance = await fs.readJson(provenancePath) as ZudoDocJson;
    // Both entries must exist
    expect(afterProvenance.ejected["footer"]).toBe("src/components/zudo-doc/footer");
    expect(afterProvenance.ejected["breadcrumb"]).toBe(
      "src/components/zudo-doc/breadcrumb",
    );
  });
});

// ── eject() — island smoke tests ─────────────────────────────────────────────
//
// Verify that each island can be ejected: source is copied and parent-relative
// cross-component imports are rewritten to @takazudo/zudo-doc/<seg>.
// Islands have parent-relative imports in their top-level index.tsx; no nested
// subdirectory files exist, so the existing rewireImports top-level pass covers them.

describe("eject() — island smoke tests", () => {
  const islandCases: Array<{
    component: string;
    // A parent-relative import that must be rewritten
    crossImport: string;
    // Expected segment after rewrite
    expectedSeg: string;
  }> = [
    {
      component: "sidebar-tree-island",
      crossImport: `import { ChevronRight } from "../icons/index.js";`,
      expectedSeg: "icons",
    },
    {
      component: "sidebar-toggle-island",
      crossImport: `import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";`,
      expectedSeg: "transitions",
    },
    {
      component: "desktop-sidebar-toggle-island",
      crossImport: `import { ChevronRight, ChevronLeft } from "../icons/index.js";`,
      expectedSeg: "icons",
    },
    {
      component: "image-enlarge",
      crossImport: `import { useModalDialog } from "../use-modal-dialog/index.js";`,
      expectedSeg: "use-modal-dialog",
    },
    {
      component: "doc-history",
      crossImport: `import { History, Close, ArrowLeft } from "../icons/index.js";`,
      expectedSeg: "icons",
    },
    {
      component: "site-tree-nav-island",
      crossImport: `import { ChevronRight } from "../icons/index.js";`,
      expectedSeg: "icons",
    },
  ];

  for (const { component, crossImport, expectedSeg } of islandCases) {
    it(`ejects ${component} and rewrites cross-component imports`, async () => {
      const projectDir = path.join(tempDir, `project-${component}`);
      await fs.ensureDir(projectDir);

      const files: Record<string, string> = {
        "index.tsx": [
          `"use client";`,
          `/** @jsxRuntime automatic */`,
          crossImport,
          `export function Component() { return null; }`,
        ].join("\n") + "\n",
      };

      const pkgRoot = await buildFixturePackage(tempDir, component, files);
      await eject(component, {
        cwd: projectDir,
        resolvePackageRoot: makeResolver(pkgRoot),
      });

      const destDir = path.join(
        projectDir,
        `src/components/zudo-doc/${component}`,
      );
      expect(await fs.pathExists(destDir)).toBe(true);

      const indexPath = path.join(destDir, "index.tsx");
      expect(await fs.pathExists(indexPath)).toBe(true);

      const content = await fs.readFile(indexPath, "utf8");
      // Parent-relative import must be rewritten to the package subpath
      expect(content).toContain(
        `from "@takazudo/zudo-doc/${expectedSeg}"`,
      );
      expect(content).not.toContain(`from "../${expectedSeg}/`);
    });
  }
});

// ── eject() — unknown component ───────────────────────────────────────────────

describe("eject() — unknown component", () => {
  it("rejects an unknown component name and calls process.exit(1)", async () => {
    const projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    const pkgRoot = await buildFixturePackage(tempDir, "header");

    // process.exit throws in vitest — catch it
    let exitCode: number | undefined;
    const originalExit = process.exit.bind(process);
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    try {
      await eject("not-a-real-component", {
        cwd: projectDir,
        resolvePackageRoot: makeResolver(pkgRoot),
      });
    } catch {
      // Expected — process.exit was called
    } finally {
      process.exit = originalExit;
    }

    expect(exitCode).toBe(1);
  });
});
