/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Stable DOM hook regression test (zudolab/zudo-doc#2873).
 *
 * `data-doc-description` is emitted on TWO description `<p>` sites: the
 * regular entry-page emitter (`doc-content-header`, covered separately) and
 * this factory's own auto-index branch (a category page with no
 * `index.mdx`). Only the latter is exercised here — the two emitters render
 * from different code paths, so each needs its own explicit coverage.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createDocPageShell } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

const BASE_PROPS = {
  locale: "en",
  slug: "cat",
  breadcrumbs: [],
  prev: null,
  next: null,
  headings: [],
  navSection: undefined,
  sidebarPersistKey: undefined,
  currentPath: "/docs/cat",
  versionSwitcher: null,
};

describe("createDocPageShell — auto-index data-doc-description hook", () => {
  it("emits data-doc-description on the auto-index description <p>", () => {
    const ctx = makeFakeChromeContext();
    const DocPageShell = createDocPageShell(ctx);
    const html = render(
      <DocPageShell
        {...BASE_PROPS}
        kind="autoIndex"
        title="Cat"
        description="Cat description text"
        autoIndexLabel="Cat"
        autoIndexChildren={[]}
      />,
    );

    expect(html).toMatch(/<p[^>]*data-doc-description[^>]*>Cat description text<\/p>/);
  });

  it("omits the <p> entirely when no description is set (no stray hook)", () => {
    const ctx = makeFakeChromeContext();
    const DocPageShell = createDocPageShell(ctx);
    const html = render(
      <DocPageShell
        {...BASE_PROPS}
        kind="autoIndex"
        title="Cat"
        autoIndexLabel="Cat"
        autoIndexChildren={[]}
      />,
    );

    expect(html).not.toContain("data-doc-description");
  });
});
