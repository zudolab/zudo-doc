/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// SSG HTML-presence tests for the theme-pack DOM contract on <DocLayout> /
// <DocLayoutWithDefaults> (ADR `docs/adr/theme-packs.md` Decision 3; #2822):
//
//   - `dataThemePack` renders the build-static `data-theme-pack` attribute on
//     <html> (the no-JS path needs the CONFIGURED slug in SSR output).
//   - `data-theme-pack` rides <ClientRouter preserveHtmlAttrs> so zfb's SPA
//     root-attribute swap re-applies the live (user-persisted) value instead
//     of resetting to the incoming document's configured default.

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { DocLayout } from "../doc-layout.js";
import { DocLayoutWithDefaults } from "../doc-layout-with-defaults.js";

describe("DocLayout — theme-pack DOM contract", () => {
  it("renders data-theme-pack on <html> when dataThemePack is passed", () => {
    const html = render(
      <DocLayout title="T" header={<header />} main={<p>body</p>} dataThemePack="foundry" />,
    );
    expect(html).toMatch(/<html[^>]* data-theme-pack="foundry"/);
  });

  it("omits the <html> attribute when dataThemePack is undefined (feature inert)", () => {
    const html = render(
      <DocLayout title="T" header={<header />} main={<p>body</p>} />,
    );
    // Scoped to the opening <html> tag — the preserve-attrs meta legitimately
    // carries the literal "data-theme-pack" on every page.
    const htmlTag = html.slice(0, html.indexOf(">") + 1);
    expect(htmlTag).not.toContain("data-theme-pack");
  });

  it("lists data-theme-pack in the ClientRouter preserve-attrs meta on every routed page", () => {
    const html = render(
      <DocLayout title="T" header={<header />} main={<p>body</p>} />,
    );
    expect(html).toContain(
      '<meta name="zfb-preserve-html-attrs" content="data-sidebar-hidden data-theme data-theme-pack style"/>',
    );
  });

  it("forwards dataThemePack through DocLayoutWithDefaults", () => {
    const html = render(
      <DocLayoutWithDefaults title="T" dataThemePack="foundry">
        <p>body</p>
      </DocLayoutWithDefaults>,
    );
    expect(html).toMatch(/<html[^>]* data-theme-pack="foundry"/);
  });
});
