/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Card-rendering-from-meta-fixtures tests (#2825 acceptance criterion): the
// mini preview must paint entirely from `meta.preview[<mode>]` resolved plain
// colors — never by loading a pack stylesheet or webfont — plus the name,
// Light/Dark badge, and description from the rest of `ThemePackMeta`.

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { ThemePackCard } from "../theme-pack-card.js";
import type { ThemePackMeta } from "../../theme-packs-registry/index.js";

const FOUNDRY: ThemePackMeta = {
  schemaVersion: 1,
  slug: "foundry",
  name: "Foundry",
  description: "GitHub-neutral baseline.",
  mode: "light",
  version: "1.0.0",
  fonts: { sans: "Inter", mono: "System", loaded: ["Inter"] },
  preview: {
    light: {
      bg: "#ffffff",
      fg: "#1f2328",
      accent: "#0969da",
      syntax: { keyword: "#cf222e", string: "#0a3069", comment: "#6e7781", callable: "#8250df" },
    },
    dark: {
      bg: "#0d1117",
      fg: "#e6edf3",
      accent: "#4493f8",
      syntax: { keyword: "#ff7b72", string: "#a5d6ff", comment: "#8b949e", callable: "#d2a8ff" },
    },
  },
};

const DRIFT: ThemePackMeta = {
  schemaVersion: 1,
  slug: "drift",
  name: "Drift",
  description: "A dark-primary pack.",
  mode: "dark",
  version: "2.0.0",
  fonts: { sans: "System", mono: "System", display: "Jost", loaded: ["Jost"] },
  preview: {
    light: {
      bg: "#f5f5f5",
      fg: "#111111",
      accent: "#6b46c1",
      syntax: { keyword: "#900", string: "#060", comment: "#999", callable: "#06c" },
    },
    dark: {
      bg: "#1a1a2e",
      fg: "#eaeaea",
      accent: "#a78bfa",
      syntax: { keyword: "#f87171", string: "#86efac", comment: "#a1a1aa", callable: "#93c5fd" },
    },
  },
};

describe("ThemePackCard — rendering from meta fixtures", () => {
  it("paints the mini preview from preview.light when mode is light", () => {
    const html = render(
      <ThemePackCard meta={FOUNDRY} mode="light" isActive={false} onSelect={() => {}} />,
    );
    expect(html).toContain("background-color:#ffffff");
    expect(html).toContain("color:#1f2328");
    expect(html).toContain("color:#0969da"); // the styled link (accent)
    expect(html).toContain("color:#cf222e"); // syntax.keyword
    expect(html).toContain("color:#0a3069"); // syntax.string
    expect(html).toContain("color:#6e7781"); // syntax.comment
    expect(html).toContain("color:#8250df"); // syntax.callable
  });

  it("paints the mini preview from preview.dark when mode is dark (same meta)", () => {
    const html = render(
      <ThemePackCard meta={FOUNDRY} mode="dark" isActive={false} onSelect={() => {}} />,
    );
    expect(html).toContain("background-color:#0d1117");
    expect(html).toContain("color:#e6edf3");
    expect(html).toContain("color:#4493f8");
    expect(html).toContain("color:#ff7b72");
    expect(html).not.toContain("#ffffff");
  });

  it("renders the heading sample, prose line, and a fenced code line", () => {
    const html = render(
      <ThemePackCard meta={FOUNDRY} mode="light" isActive={false} onSelect={() => {}} />,
    );
    expect(html).toContain("Aa Heading");
    expect(html).toContain("The quick brown fox jumps over");
    expect(html).toContain("the lazy dog");
    expect(html).toContain("const");
    expect(html).toContain("theme");
    expect(html).toContain("&quot;foundry&quot;"); // preact-render-to-string HTML-escapes quotes in text nodes
  });

  it("renders name, description, and the Light badge from meta.mode", () => {
    const html = render(
      <ThemePackCard meta={FOUNDRY} mode="light" isActive={false} onSelect={() => {}} />,
    );
    expect(html).toContain("Foundry");
    expect(html).toContain("GitHub-neutral baseline.");
    expect(html).toContain(">Light<");
    expect(html).not.toContain(">Dark<");
  });

  it("renders the Dark badge for a dark-primary pack (badge follows meta.mode, not the paint mode)", () => {
    const html = render(
      <ThemePackCard meta={DRIFT} mode="light" isActive={false} onSelect={() => {}} />,
    );
    // Painted from preview.light (the CURRENT UI mode)...
    expect(html).toContain("background-color:#f5f5f5");
    // ...but badged Dark (DRIFT's designed-primary mode.mode).
    expect(html).toContain(">Dark<");
    expect(html).not.toContain(">Light<");
  });

  it("renders a font caption from fonts.display when present, else fonts.sans (plain text, no font-family)", () => {
    const withDisplay = render(
      <ThemePackCard meta={DRIFT} mode="light" isActive={false} onSelect={() => {}} />,
    );
    expect(withDisplay).toContain("Jost");
    expect(withDisplay).not.toContain("font-family");

    const withoutDisplay = render(
      <ThemePackCard meta={FOUNDRY} mode="light" isActive={false} onSelect={() => {}} />,
    );
    expect(withoutDisplay).toContain("Inter");
    expect(withoutDisplay).not.toContain("font-family");
  });

  it("marks the active card with a selected ring and aria-pressed", () => {
    const html = render(
      <ThemePackCard meta={FOUNDRY} mode="light" isActive={true} onSelect={() => {}} />,
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("border-accent");
    expect(html).toContain("ring-accent");
  });

  it("does not mark an inactive card with the selected ring", () => {
    const html = render(
      <ThemePackCard meta={FOUNDRY} mode="light" isActive={false} onSelect={() => {}} />,
    );
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("ring-accent");
  });

  it("never references a pack stylesheet, webfont, or <link> — paints from swatches only", () => {
    const html = render(
      <ThemePackCard meta={FOUNDRY} mode="light" isActive={false} onSelect={() => {}} />,
    );
    expect(html).not.toContain("pack.css");
    expect(html).not.toContain("<link");
    expect(html).not.toContain(".woff2");
  });

  it("gives the button a summarizing aria-label so screen readers don't recite the whole decorative preview", () => {
    const html = render(
      <ThemePackCard meta={FOUNDRY} mode="light" isActive={false} onSelect={() => {}} />,
    );
    expect(html).toContain('aria-label="Apply Foundry theme pack — Light. GitHub-neutral baseline."');
  });
});
