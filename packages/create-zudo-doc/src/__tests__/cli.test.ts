import { describe, it, expect } from "vitest";
import { parseArgs, validateArgs, type CliArgs } from "../cli.js";
import { FEATURES } from "../constants.js";

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
      expect(parseArgs(["--scheme", "Default Dark"]).scheme).toBe("Default Dark");
    });

    it("--light-scheme", () => {
      expect(parseArgs(["--light-scheme", "Default Light"]).lightScheme).toBe("Default Light");
    });

    it("--dark-scheme", () => {
      expect(parseArgs(["--dark-scheme", "Default Dark"]).darkScheme).toBe("Default Dark");
    });

    it("--default-mode", () => {
      expect(parseArgs(["--default-mode", "light"]).defaultMode).toBe("light");
    });

    it("--pm", () => {
      expect(parseArgs(["--pm", "npm"]).pm).toBe("npm");
    });

    it("--theme-pack", () => {
      expect(parseArgs(["--theme-pack", "foundry"]).themePack).toBe("foundry");
    });

    it("--theme-pack undefined when not provided", () => {
      expect(parseArgs([]).themePack).toBeUndefined();
    });
  });

  describe("boolean feature flags — enabled", () => {
    // Derive from FEATURES constant so new features are auto-covered
    const featureFlags: [string, keyof CliArgs][] = FEATURES.map((f) => [
      f.cliFlag,
      f.value as keyof CliArgs,
    ]);

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
      for (const f of FEATURES) {
        expect(
          result[f.value as keyof CliArgs],
          `${f.value} should be undefined when not passed`,
        ).toBeUndefined();
      }
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

  describe("git flag", () => {
    it("--git sets git true", () => {
      expect(parseArgs(["--git"]).git).toBe(true);
    });

    it("--no-git sets git false", () => {
      expect(parseArgs(["--no-git"]).git).toBe(false);
    });

    it("git is undefined when not passed (index.ts defaults it on)", () => {
      expect(parseArgs([]).git).toBeUndefined();
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
        "--scheme", "Default Dark",
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
      expect(result.scheme).toBe("Default Dark");
      expect(result.search).toBe(true);
      expect(result.i18n).toBe(false);
      expect(result.sidebarToggle).toBe(true);
      expect(result.docHistory).toBe(false);
      expect(result.pm).toBe("pnpm");
      expect(result.yes).toBe(true);
    });
  });
});

// F4 (S4 #2013) — project-name validation on CLI arg path
describe("validateArgs — project-name validation (F4 #2013)", () => {
  it("accepts a valid lowercase kebab name", () => {
    expect(validateArgs({ name: "my-docs" })).toBeNull();
  });

  it("accepts a name starting with a digit", () => {
    expect(validateArgs({ name: "1my-docs" })).toBeNull();
  });

  it("accepts a name with dots and underscores", () => {
    expect(validateArgs({ name: "my.docs_v2" })).toBeNull();
  });

  it("rejects a name with uppercase letters", () => {
    expect(validateArgs({ name: "My-Docs" })).toMatch(/lowercase/);
  });

  it("rejects a name with spaces", () => {
    expect(validateArgs({ name: "my docs" })).toMatch(/lowercase/);
  });

  it("rejects a name starting with a dot", () => {
    expect(validateArgs({ name: ".my-docs" })).toMatch(/lowercase/);
  });

  it("rejects a name starting with a hyphen", () => {
    expect(validateArgs({ name: "-my-docs" })).toMatch(/lowercase/);
  });

  it("rejects a name with a slash (path-like)", () => {
    expect(validateArgs({ name: "my/docs" })).toMatch(/lowercase/);
  });

  it("rejects a name longer than 214 characters", () => {
    expect(validateArgs({ name: "a".repeat(215) })).toMatch(/214/);
  });

  it("accepts a name exactly 214 characters long", () => {
    expect(validateArgs({ name: "a".repeat(214) })).toBeNull();
  });
});

// #2823 — theme-pack CLI catalog validation
describe("validateArgs — theme-pack (ADR #2818)", () => {
  it("accepts a known theme pack slug", () => {
    expect(validateArgs({ themePack: "default" })).toBeNull();
    expect(validateArgs({ themePack: "foundry" })).toBeNull();
  });

  it("rejects an unknown theme pack slug and lists the catalog", () => {
    const error = validateArgs({ themePack: "not-a-real-pack" });
    expect(error).toMatch(/Unknown theme pack "not-a-real-pack"/);
    expect(error).toMatch(/default/);
    expect(error).toMatch(/foundry/);
  });
});
