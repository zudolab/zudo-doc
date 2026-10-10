/** @jsxRuntime automatic */
import "../../__tests__/fixtures/install-island-metadata.js";
/**
 * Client payload emission (epic #3242, #3243).
 *
 * `<DocPageShell>` serializes `unavailableVersions` onto the `<article>`
 * element via `serializeUnavailableVersions` (`../../version-availability`)
 * so a same-locale SPA navigation rewire script (#3244) can read the
 * per-page availability set from swapped content. Verifies the three-state
 * contract survives all the way into the rendered HTML:
 *   - absent prop  → no `data-doc-unavailable-versions` attribute at all
 *   - empty set    → attribute present with an empty value
 *   - populated set → attribute present with a sorted comma-joined value
 */

import { describe, expect, it } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { createDocPageShell } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { UNAVAILABLE_VERSIONS_ATTR } from "../../version-availability/index.js";

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
  kind: "autoIndex" as const,
  title: "Cat",
  autoIndexLabel: "Cat",
  autoIndexChildren: [],
};

describe("createDocPageShell — unavailable-versions article attribute", () => {
  it("omits the attribute entirely when unavailableVersions is undefined", () => {
    const ctx = makeFakeChromeContext();
    const DocPageShell = createDocPageShell(ctx);
    const html = render(<DocPageShell {...BASE_PROPS} />);

    expect(html).not.toContain(UNAVAILABLE_VERSIONS_ATTR);
  });

  it('emits an empty-value attribute when unavailableVersions is an empty set', () => {
    const ctx = makeFakeChromeContext();
    const DocPageShell = createDocPageShell(ctx);
    const html = render(
      <DocPageShell {...BASE_PROPS} unavailableVersions={new Set()} />,
    );

    // zudo-react emits the explicit empty value for a present data attribute.
    expect(html).toContain(UNAVAILABLE_VERSIONS_ATTR);
    expect(html).toContain(`${UNAVAILABLE_VERSIONS_ATTR}=""`);
  });

  it("emits a sorted comma-joined value for a populated set", () => {
    const ctx = makeFakeChromeContext();
    const DocPageShell = createDocPageShell(ctx);
    const html = render(
      <DocPageShell
        {...BASE_PROPS}
        unavailableVersions={new Set(["2.0", "1.0"])}
      />,
    );

    expect(html).toContain(`${UNAVAILABLE_VERSIONS_ATTR}="1.0,2.0"`);
  });
});
