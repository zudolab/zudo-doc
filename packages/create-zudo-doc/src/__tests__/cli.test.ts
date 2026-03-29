import { describe, it, expect } from "vitest";
import { parseArgs } from "../cli.js";

describe("parseArgs", () => {
  describe("project name", () => {
    it("from positional arg", () => {
      expect(parseArgs(["my-docs"]).name).toBe("my-docs");
    });

    it("from --name flag", () => {
      expect(parseArgs(["--name", "my-docs"]).name).toBe("my-docs");
    });

    it("undefined when not provided", () => {
      expect(parseArgs([]).name).toBeUndefined();
    });
  });

  describe("string flags", () => {
    it("--lang", () => {
      expect(parseArgs(["--lang", "ja"]).lang).toBe("ja");
    });

    it("--color-scheme-mode", () => {
      expect(parseArgs(["--color-scheme-mode", "single"]).colorSchemeMode).toBe("single");
    });

    it("--scheme", () => {
      expect(parseArgs(["--scheme", "Dracula"]).scheme).toBe("Dracula");
    });

    it("--light-scheme", () => {
      expect(parseArgs(["--light-scheme", "GitHub Light"]).lightScheme).toBe("GitHub Light");
    });

    it("--dark-scheme", () => {
      expect(parseArgs(["--dark-scheme", "GitHub Dark"]).darkScheme).toBe("GitHub Dark");
    });

    it("--default-mode", () => {
      expect(parseArgs(["--default-mode", "light"]).defaultMode).toBe("light");
    });

    it("--pm", () => {
      expect(parseArgs(["--pm", "npm"]).pm).toBe("npm");
    });
  });

  describe("boolean feature flags — enabled", () => {
    const featureFlags: [string, keyof ReturnType<typeof parseArgs>][] = [
      ["i18n", "i18n"],
      ["search", "search"],
      ["sidebar-filter", "sidebarFilter"],
      ["claude-resources", "claudeResources"],
      ["color-tweak-panel", "colorTweakPanel"],
      ["sidebar-resizer", "sidebarResizer"],
      ["sidebar-toggle", "sidebarToggle"],
      ["versioning", "versioning"],
      ["doc-history", "docHistory"],
      ["llms-txt", "llmsTxt"],
      ["skill-symlinker", "skillSymlinker"],
      ["footer-nav-group", "footerNavGroup"],
      ["footer-copyright", "footerCopyright"],
      ["changelog", "changelog"],
    ];

    it.each(featureFlags)(
      "--%s sets %s to true",
      (flag, prop) => {
        const result = parseArgs([`--${flag}`]);
        expect(result[prop]).toBe(true);
      },
    );

    it.each(featureFlags)(
      "--no-%s sets %s to false",
      (flag, prop) => {
        const result = parseArgs([`--no-${flag}`]);
        expect(result[prop]).toBe(false);
      },
    );
  });

  describe("omitted flags are undefined", () => {
    it("all feature flags undefined when not passed", () => {
      const result = parseArgs([]);
      expect(result.i18n).toBeUndefined();
      expect(result.search).toBeUndefined();
      expect(result.sidebarFilter).toBeUndefined();
      expect(result.claudeResources).toBeUndefined();
      expect(result.colorTweakPanel).toBeUndefined();
      expect(result.sidebarResizer).toBeUndefined();
      expect(result.sidebarToggle).toBeUndefined();
      expect(result.versioning).toBeUndefined();
      expect(result.docHistory).toBeUndefined();
      expect(result.llmsTxt).toBeUndefined();
      expect(result.skillSymlinker).toBeUndefined();
      expect(result.footerNavGroup).toBeUndefined();
      expect(result.footerCopyright).toBeUndefined();
      expect(result.changelog).toBeUndefined();
    });
  });

  describe("respect-system-preference", () => {
    it("--respect-system-preference sets true", () => {
      expect(parseArgs(["--respect-system-preference"]).respectSystemPreference).toBe(true);
    });

    it("--no-respect-system-preference sets false", () => {
      expect(parseArgs(["--no-respect-system-preference"]).respectSystemPreference).toBe(false);
    });
  });

  describe("shorthand aliases", () => {
    it("-y sets yes", () => {
      expect(parseArgs(["-y"]).yes).toBe(true);
    });

    it("-h sets help", () => {
      expect(parseArgs(["-h"]).help).toBe(true);
    });
  });

  describe("combined command", () => {
    it("parses a full command correctly", () => {
      const result = parseArgs([
        "my-docs",
        "--lang", "ja",
        "--color-scheme-mode", "single",
        "--scheme", "Dracula",
        "--search",
        "--no-i18n",
        "--sidebar-toggle",
        "--no-doc-history",
        "--pm", "pnpm",
        "--yes",
      ]);
      expect(result.name).toBe("my-docs");
      expect(result.lang).toBe("ja");
      expect(result.colorSchemeMode).toBe("single");
      expect(result.scheme).toBe("Dracula");
      expect(result.search).toBe(true);
      expect(result.i18n).toBe(false);
      expect(result.sidebarToggle).toBe(true);
      expect(result.docHistory).toBe(false);
      expect(result.pm).toBe("pnpm");
      expect(result.yes).toBe(true);
    });
  });
});
