/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createRouteContextPayload } from "../../route-context-payload/index.js";
import { createRouteContext } from "../../route-context/index.js";
import { createChrome } from "../../chrome/index.js";
import { prepareHomeIntros } from "../../home-intro/prepare.js";
import type { Settings } from "../../settings.js";

async function renderHome(settings: Partial<Settings>, locale = "en") {
  const payload = createRouteContextPayload({ siteTitle: "Integration site", settings });
  payload.homeIntros = await prepareHomeIntros(payload.settings);
  const route = createRouteContext(JSON.parse(JSON.stringify(payload)), { stableDocs: () => [] });
  const { HomePageView } = createChrome(route, {
    homeExtras: () => <a href="/legacy">Legacy extra</a>,
  });
  return render(<HomePageView locale={locale} tree={[]} categoryOrder={[]} tagCount={0}
    wide={route.settings.home?.wide} />);
}

describe("prepared homepage intro through serialized route context and chrome", () => {
  it.each([undefined, "", " \n\t "])("omits the wrapper and upper rule for %j", async introMarkdown => {
    const html = await renderHome({ home: { introMarkdown } });
    expect(html).not.toContain("zd-compact-prose");
    expect(html.match(/data-home-rule=/g)).toHaveLength(1);
    expect(html).toContain('data-home-rule="lower"');
    expect(html).toContain(">Explore the documentation</h2>");
  });

  it.each(["auto", "/images/logo.svg", false] as const)("preserves logo=%s and extras with rich intro", async logo => {
    const html = await renderHome({ logo, home: { introMarkdown: "# Intro\n\n## Details\n\n[Read](docs/start)\n\n```js\nconst answer = 42;\n```" } });
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.match(/data-home-rule=/g)).toHaveLength(2);
    expect(html).toContain('href="/docs/start"');
    expect(html).toContain('class="hi-root"');
    expect(html).toContain("hi-kw");
    expect(html).not.toContain("hash-link");
    expect(html.indexOf("Legacy extra")).toBeLessThan(html.indexOf('data-home-rule="upper"'));
    if (logo === "auto") expect(html).toContain("data-auto-logo=");
    else if (logo === false) expect(html).not.toContain("w-[320px]");
    else expect(html).toContain("/images/logo.svg");
  });

  it.each([false, true])("retains wide=%s, localized links and independent sitemap heading", async wide => {
    const html = await renderHome({
      base: "/manual/",
      home: { wide, introMarkdown: "Untranslated intro sentinel", sitemapHeading: "Custom index" },
      locales: { ja: { label: "日本語", dir: "docs-ja", introMarkdown: "# 紹介\n\n[読む](docs/start) ![図](/images/logo.png)", sitemapHeading: " " } },
    }, "ja");
    expect(html).toContain('href="/manual/ja/docs/start"');
    expect(html).toContain('src="/manual/images/logo.png"');
    expect(html).toContain(">ドキュメントを探す</h2>");
    expect(html).not.toContain("Untranslated intro sentinel");
    expect(html.includes("data-zd-wide")).toBe(wide);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it.each(["", " \n "])("does not restore fallback for locale suppression %j", async introMarkdown => {
    const html = await renderHome({
      home: { introMarkdown: "Must not appear" },
      locales: { ja: { label: "日本語", dir: "docs-ja", introMarkdown } },
    }, "ja");
    expect(html).not.toContain("Must not appear");
    expect(html).not.toContain("zd-compact-prose");
    expect(html.match(/data-home-rule=/g)).toHaveLength(1);
  });
});
