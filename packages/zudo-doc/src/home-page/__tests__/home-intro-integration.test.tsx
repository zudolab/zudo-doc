/** @jsxRuntime automatic */
import { describe, expect, it, vi } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import type { Child } from "@takazudo/zfb/zudo-react";
import { createRouteContextPayload } from "../../route-context-payload/index.js";
import { createRouteContext } from "../../route-context/index.js";
import { createChrome } from "../../chrome/index.js";
import { prepareHomeIntros } from "../../home-intro/prepare.js";
import type { PreparedHomeIntro } from "../../home-intro/types.js";
import type { Settings } from "../../settings.js";

// These boundaries are ported in adjacent migration topics: the shared shell
// (#4458), generated logo (#4459), and CompactProse (#4457). Keep this suite
// focused on route-context preparation plus home-page composition.
vi.mock("../../doclayout/index.js", () => ({
  DocLayoutWithDefaults: (props: Record<string, unknown>) => (
    <div data-zd-test-home-layout data-zd-wide={props.contentWide ? "" : undefined}>{props.children as Child}</div>
  ),
}));
vi.mock("../../head-with-defaults/index.js", () => ({
  createHeadWithDefaults: () => () => null,
}));
vi.mock("../../auto-logo/index.js", () => ({
  AutoLogo: ({ class: className, seed }: { class?: string; seed: string }) => (
    <svg class={className} data-auto-logo={seed} aria-hidden="true" />
  ),
}));
vi.mock("@takazudo/zfb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@takazudo/zfb")>();
  return {
    ...actual,
    Island: () => <div data-zd-test-home-island data-when="idle" />,
  };
});
vi.mock("../../home-intro/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../home-intro/index.js")>();
  const { renderPreparedIntro } = await import("./render-prepared-intro.js");
  return {
    ...actual,
    CompactProse: ({ intro }: { intro: PreparedHomeIntro | null | undefined }) =>
      intro?.nodes.length ? <div class="zd-content zd-compact-prose">{renderPreparedIntro(intro)}</div> : null,
  };
});

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
