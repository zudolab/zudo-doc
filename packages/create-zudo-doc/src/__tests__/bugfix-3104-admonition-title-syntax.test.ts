import { describe, it, expect } from "vitest";
import type { UserChoices } from "../prompts.js";
import { generateCLAUDEFile } from "../claude-md-gen.js";

// Regression guard for zudolab/zudo-doc#3104.
//
// The generated CLAUDE.md used to document a Docusaurus-style
// `{title="..."}` admonition attribute. That form is not supported: MDX parses
// the braces as a JS expression, so a page following the project's own
// guidance either dies at render with `ReferenceError: title is not defined`
// (fence written without surrounding blank lines) or builds with the title
// silently dropped (fence with blank lines). Both were verified against the
// e2e smoke fixture. The supported form is the bracketed one,
// `:::note[Custom Title]`, which works with or without blank lines.
//
// This file asserts the *grammar* of the generated guidance rather than
// MDX-compiling it: CLAUDE.md is prose steering coding agents, so the failure
// mode to prevent is the text drifting back to an unsupported form. Real
// admonition rendering is covered at the build/e2e tier (the smoke fixture's
// admonitions-test page).

const baseChoices: UserChoices = {
  projectName: "test-3104",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: [],
  packageManager: "pnpm",
};

/** Every `:::directive` opener appearing in the generated CLAUDE.md. */
function directiveOpeners(content: string): string[] {
  return content.match(/:::[a-z][a-z-]*(?:\[[^\]]*\]|\{[^}]*\})?/g) ?? [];
}

describe("bugfix #3104 — generated CLAUDE.md documents supported admonition title syntax", () => {
  it("documents the bracketed title form", () => {
    const content = generateCLAUDEFile(baseChoices);

    expect(content).toContain(":::note[Custom Title]");
  });

  it("states explicitly that the braced attribute form is unsupported", () => {
    const content = generateCLAUDEFile(baseChoices);

    // The negative is the load-bearing part: agents trained on Docusaurus
    // reach for `{title=...}` by default, and the resulting ReferenceError
    // does not point back at the directive that caused it.
    expect(content).toMatch(/NOT supported/);
    expect(content).toMatch(/ReferenceError: title is not defined/);
  });

  it("only ever mentions the braced attribute to disown it", () => {
    const content = generateCLAUDEFile(baseChoices);

    // The braced form is *allowed* to appear — the warning above names it on
    // purpose. What must never happen is presenting it as usable syntax, which
    // is how the original bug read ("Each accepts an optional `{title=\"...\"}`
    // attribute"). So: every line mentioning it must also disown it.
    const bracedLines = content
      .split("\n")
      .filter((line) => /\{\s*title\s*=/.test(line));

    expect(bracedLines.length).toBeGreaterThan(0);
    for (const line of bracedLines) {
      expect(line).toMatch(/NOT supported/);
    }
  });

  it("never attaches a braced attribute to a directive opener", () => {
    const openers = directiveOpeners(generateCLAUDEFile(baseChoices));

    expect(openers.length).toBeGreaterThan(0);
    expect(openers.filter((opener) => opener.includes("{"))).toEqual([]);
  });

  it("holds for a full-feature scaffold too", () => {
    const content = generateCLAUDEFile({
      ...baseChoices,
      defaultLang: "ja",
      features: ["i18n", "search", "docHistory", "tagGovernance"],
    });

    expect(content).toContain(":::note[Custom Title]");
    expect(directiveOpeners(content).filter((o) => o.includes("{"))).toEqual(
      [],
    );
  });
});
