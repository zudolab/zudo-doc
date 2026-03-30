import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import {
  applyInjections,
  cleanAnchors,
  resolveSelectedFeatures,
  validateDependencies,
  type Injection,
  type FeatureModule,
} from "../compose.js";
import type { UserChoices } from "../prompts.js";

const TEMP_PREFIX = "compose-test-";
let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
});

afterEach(async () => {
  await fs.remove(tempDir);
});

// ---------------------------------------------------------------------------
// applyInjections
// ---------------------------------------------------------------------------

describe("applyInjections", () => {
  it("inserts content before an anchor (default position)", async () => {
    const file = "test.astro";
    await fs.writeFile(
      path.join(tempDir, file),
      `<div>\n  <!-- @slot:header:actions -->\n</div>\n`,
    );

    const injections: Injection[] = [
      {
        file,
        anchor: "<!-- @slot:header:actions -->",
        content: "  <button>Click me</button>",
      },
    ];

    await applyInjections(tempDir, injections);
    const result = await fs.readFile(path.join(tempDir, file), "utf-8");
    expect(result).toBe(
      `<div>\n  <button>Click me</button>\n  <!-- @slot:header:actions -->\n</div>\n`,
    );
  });

  it("inserts content after an anchor", async () => {
    const file = "test.astro";
    await fs.writeFile(
      path.join(tempDir, file),
      `<div>\n  <!-- @slot:body:end -->\n</div>\n`,
    );

    const injections: Injection[] = [
      {
        file,
        anchor: "<!-- @slot:body:end -->",
        content: "  <Modal />",
        position: "after",
      },
    ];

    await applyInjections(tempDir, injections);
    const result = await fs.readFile(path.join(tempDir, file), "utf-8");
    expect(result).toBe(
      `<div>\n  <!-- @slot:body:end -->\n  <Modal />\n</div>\n`,
    );
  });

  it("replaces content between :start and :end anchors", async () => {
    const file = "test.astro";
    await fs.writeFile(
      path.join(tempDir, file),
      [
        "<main>",
        "  <!-- @slot:breadcrumb:start -->",
        "  <slot name=\"breadcrumb\" />",
        "  <!-- @slot:breadcrumb:end -->",
        "</main>",
        "",
      ].join("\n"),
    );

    const injections: Injection[] = [
      {
        file,
        anchor: "<!-- @slot:breadcrumb:start -->",
        content: "  <VersionSwitcher />\n  <Breadcrumb />",
        position: "replace",
      },
    ];

    await applyInjections(tempDir, injections);
    const result = await fs.readFile(path.join(tempDir, file), "utf-8");
    expect(result).toBe(
      ["<main>", "  <VersionSwitcher />", "  <Breadcrumb />", "</main>", ""].join("\n"),
    );
  });

  it("handles multiple injections to the same file in order", async () => {
    const file = "test.astro";
    await fs.writeFile(
      path.join(tempDir, file),
      `<div>\n  <!-- @slot:actions -->\n</div>\n`,
    );

    const injections: Injection[] = [
      {
        file,
        anchor: "<!-- @slot:actions -->",
        content: "  <ButtonA />",
      },
      {
        file,
        anchor: "<!-- @slot:actions -->",
        content: "  <ButtonB />",
      },
    ];

    await applyInjections(tempDir, injections);
    const result = await fs.readFile(path.join(tempDir, file), "utf-8");
    // Both injected before the anchor, ButtonA first then ButtonB
    expect(result).toContain("<ButtonA />");
    expect(result).toContain("<ButtonB />");
    expect(result.indexOf("<ButtonA />")).toBeLessThan(
      result.indexOf("<ButtonB />"),
    );
  });

  it("skips injection when anchor is not found", async () => {
    const file = "test.astro";
    const original = `<div>no anchor here</div>\n`;
    await fs.writeFile(path.join(tempDir, file), original);

    const injections: Injection[] = [
      {
        file,
        anchor: "<!-- @slot:missing -->",
        content: "should not appear",
      },
    ];

    await applyInjections(tempDir, injections);
    const result = await fs.readFile(path.join(tempDir, file), "utf-8");
    expect(result).toBe(original);
  });

  it("skips injection when target file does not exist", async () => {
    const injections: Injection[] = [
      {
        file: "nonexistent.astro",
        anchor: "<!-- @slot:x -->",
        content: "nope",
      },
    ];
    // Should not throw
    await applyInjections(tempDir, injections);
  });
});

// ---------------------------------------------------------------------------
// cleanAnchors
// ---------------------------------------------------------------------------

describe("cleanAnchors", () => {
  it("removes unused anchor lines from files", async () => {
    const file = "test.astro";
    await fs.writeFile(
      path.join(tempDir, file),
      [
        "<div>",
        "  <!-- @slot:header:actions -->",
        "  <p>Keep this</p>",
        "  // @slot:imports",
        "</div>",
        "",
      ].join("\n"),
    );

    await cleanAnchors(tempDir, [file]);
    const result = await fs.readFile(path.join(tempDir, file), "utf-8");
    expect(result).not.toContain("@slot:");
    expect(result).toContain("<p>Keep this</p>");
    expect(result).toContain("<div>");
    expect(result).toContain("</div>");
  });

  it("preserves non-anchor comments", async () => {
    const file = "test.css";
    await fs.writeFile(
      path.join(tempDir, file),
      [
        "/* Regular comment */",
        "/* @slot:feature-styles */",
        ".base { color: red; }",
        "",
      ].join("\n"),
    );

    await cleanAnchors(tempDir, [file]);
    const result = await fs.readFile(path.join(tempDir, file), "utf-8");
    expect(result).toContain("/* Regular comment */");
    expect(result).not.toContain("@slot:");
  });

  it("skips files that do not exist", async () => {
    // Should not throw
    await cleanAnchors(tempDir, ["nonexistent.astro"]);
  });
});

// ---------------------------------------------------------------------------
// resolveSelectedFeatures
// ---------------------------------------------------------------------------

describe("resolveSelectedFeatures", () => {
  const baseChoices: UserChoices = {
    projectName: "test",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Dracula",
    features: [],
    packageManager: "pnpm",
  };

  const mockModules: Record<string, FeatureModule> = {
    search: () => ({
      name: "search",
      injections: [],
    }),
    footer: () => ({
      name: "footer",
      injections: [],
    }),
    docHistory: () => ({
      name: "docHistory",
      injections: [],
    }),
  };

  it("selects features based on choices.features", () => {
    const choices = { ...baseChoices, features: ["search"] };
    const result = resolveSelectedFeatures(choices, mockModules);
    expect(result.map((f) => f.name)).toEqual(["search"]);
  });

  it("selects footer when footerNavGroup is chosen", () => {
    const choices = { ...baseChoices, features: ["footerNavGroup"] };
    const result = resolveSelectedFeatures(choices, mockModules);
    expect(result.map((f) => f.name)).toEqual(["footer"]);
  });

  it("selects footer when footerCopyright is chosen", () => {
    const choices = { ...baseChoices, features: ["footerCopyright"] };
    const result = resolveSelectedFeatures(choices, mockModules);
    expect(result.map((f) => f.name)).toEqual(["footer"]);
  });

  it("selects footer only once when both footer flags are chosen", () => {
    const choices = {
      ...baseChoices,
      features: ["footerNavGroup", "footerCopyright"],
    };
    const result = resolveSelectedFeatures(choices, mockModules);
    const footerCount = result.filter((f) => f.name === "footer").length;
    expect(footerCount).toBe(1);
  });

  it("returns empty array when no features selected", () => {
    const result = resolveSelectedFeatures(baseChoices, mockModules);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateDependencies
// ---------------------------------------------------------------------------

describe("validateDependencies", () => {
  it("passes when all dependencies are satisfied", () => {
    const features = [
      { name: "a", injections: [] },
      { name: "b", injections: [], dependencies: ["a"] },
    ];
    expect(() =>
      validateDependencies(features, new Set(["a", "b"])),
    ).not.toThrow();
  });

  it("throws when a dependency is missing", () => {
    const features = [
      { name: "b", injections: [], dependencies: ["a"] },
    ];
    expect(() => validateDependencies(features, new Set(["b"]))).toThrow(
      /Feature "b" requires "a"/,
    );
  });

  it("passes when features have no dependencies", () => {
    const features = [
      { name: "a", injections: [] },
      { name: "b", injections: [] },
    ];
    expect(() =>
      validateDependencies(features, new Set(["a", "b"])),
    ).not.toThrow();
  });
});
