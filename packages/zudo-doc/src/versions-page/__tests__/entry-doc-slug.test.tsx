/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createVersionsPageView } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

// MANDATORY regression guard (#3216): createVersionsPageView used to hardcode
// "/docs/getting-started" for both the "latest docs" link and every past
// version's docs link. The showcase happens to configure entryDocSlug at
// exactly that default value, so a built-HTML grep of the showcase output
// cannot tell a correctly-wired factory apart from a reverted hardcode — only
// a NON-default slug proves the factory actually reads `settings.entryDocSlug`
// instead of a literal string.
describe("createVersionsPageView — entryDocSlug (#3216)", () => {
  it("emits both the latest-docs href and every past-version href from a non-default entryDocSlug", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        entryDocSlug: "overview/getting-started",
        versions: [
          { slug: "1.0", label: "1.0.0" },
          { slug: "2.0", label: "2.0.0" },
        ],
      },
    });

    const VersionsPageView = createVersionsPageView(ctx);
    const html = render(<VersionsPageView locale="en" />);

    // Latest-docs link.
    expect(html).toContain('href="/docs/overview/getting-started"');
    // Hardcode regression check: the old literal must be absent.
    expect(html).not.toContain("/docs/getting-started\"");

    // Each past version's docs link.
    expect(html).toContain('href="/v/1.0/docs/overview/getting-started/"');
    expect(html).toContain('href="/v/2.0/docs/overview/getting-started/"');
  });
});
