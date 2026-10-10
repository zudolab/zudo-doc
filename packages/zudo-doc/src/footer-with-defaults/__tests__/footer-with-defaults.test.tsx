/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { createFooterWithDefaults } from "../index.js";

describe("FooterWithDefaults server rendering", () => {
  it("keeps the locale-keyed persist root and resolves locale text and links", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        footer: {
          links: [
            {
              title: "Resources",
              locales: { ja: { title: "リソース" } },
              items: [
                {
                  label: "Guides",
                  href: "/docs/guides",
                  locales: { ja: { label: "ガイド" } },
                },
              ],
            },
          ],
        },
      },
    });
    const FooterWithDefaults = createFooterWithDefaults(ctx);

    const html = render(<FooterWithDefaults lang="ja" />);

    expect(html).toContain('data-zfb-transition-persist="footer-ja"');
    expect(html).toContain('data-footer');
    expect(html).toContain("リソース");
    expect(html).toContain('href="/ja/docs/guides"');
    expect(html).toContain("ガイド");
  });
});
