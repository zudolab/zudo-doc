/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it, vi } from "vitest";
import { createVersionsPageView } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { ChromeContext } from "../../factory-context/index.js";
import { renderNav } from "../../nav-indexing/__tests__/helpers.js";

// This factory test concerns only the rendered versions content. Keep the
// outer DocLayout shell out of the fixture because its configured head markup
// belongs to the separate static-head port (#4458).
vi.mock("../../doclayout/index.js", () => ({
  DocLayoutWithDefaults: ({ children }: { children: unknown }) => children,
}));

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
    const root = renderNav(<VersionsPageView locale="en" />);

    // Latest-docs link.
    expect(root.querySelector('a[href="/docs/overview/getting-started"]')).not.toBeNull();
    // Hardcode regression check: the old literal must be absent.
    expect(root.querySelector('a[href="/docs/getting-started"]')).toBeNull();

    // Each past version's docs link.
    expect(root.querySelector('a[href="/v/1.0/docs/overview/getting-started/"]')).not.toBeNull();
    expect(root.querySelector('a[href="/v/2.0/docs/overview/getting-started/"]')).not.toBeNull();
  });

  it("drops the locale prefix on a non-default locale when entryDocSlug is defaultLocaleOnly (#2569)", () => {
    // A defaultLocaleOnly entry slug has no non-default-locale route, so a
    // /ja versions page must link into the default-locale URL space instead
    // of minting a /ja/docs/... 404 href.
    const ctx = makeFakeChromeContext({
      settings: {
        entryDocSlug: "claude-md/setup",
        versions: [{ slug: "1.0", label: "1.0.0" }],
      },
      overrides: {
        isDefaultLocaleOnlyPath: (path: string) => path.startsWith("/docs/claude-md/"),
      } as Partial<ChromeContext>,
    });

    const VersionsPageView = createVersionsPageView(ctx);
    const root = renderNav(<VersionsPageView locale="ja" />);

    expect(root.querySelector('a[href="/docs/claude-md/setup"]')).not.toBeNull();
    expect(root.querySelector('a[href="/v/1.0/docs/claude-md/setup/"]')).not.toBeNull();
    expect(root.querySelector('a[href="/ja/docs/claude-md/setup"]')).toBeNull();
  });
});
