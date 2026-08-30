import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectAssetLinks } from "../link-graph.js";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/link-graph/", import.meta.url),
);

describe("collectAssetLinks", () => {
  function collect() {
    return collectAssetLinks({
      contentRoots: [
        {
          dir: `${fixtureRoot}/docs`,
          urlFor: (slug) => `/project/docs/${slug}/`,
        },
        {
          dir: `${fixtureRoot}/docs-v2`,
          version: "v2",
          urlFor: (slug) => `/project/v/v2/docs/${slug}/`,
        },
        {
          dir: `${fixtureRoot}/docs-ja`,
          locale: "ja",
          urlFor: (slug) => `/project/ja/docs/${slug}/`,
        },
      ],
      dir: "downloads",
      base: "/project",
      trailingSlash: true,
    });
  }

  it("collects configured-dir references with page metadata and canonical URLs", () => {
    const result = collect();

    expect([...result.linkedFrom.keys()].sort()).toEqual([
      "My Guide.pdf",
      "code#sample.ts",
      "diagram one.png",
      "資料 一.png",
    ]);
    expect(result.linkedFrom.get("diagram one.png")).toEqual([
      {
        href: "/project/docs/guide/start/",
        title: "Getting Started",
        crumb: "Guide › Getting Started",
        context: '<Asset src="/downloads/diagram%20one.png" />',
      },
    ]);
    expect(result.linkedFrom.get("資料 一.png")?.[0]).toMatchObject({
      href: "/project/ja/docs/guide/start/",
      locale: "ja",
      title: "はじめに",
    });
  });

  it("honours custom slugs and uses them for hrefs and crumbs", () => {
    const custom = resultFor(collect(), "My Guide.pdf").find(
      (ref) => ref.title === "Custom Page",
    );
    expect(custom).toEqual({
      href: "/project/docs/handbook/custom-route/",
      title: "Custom Page",
      crumb: "Handbook › Custom Page",
      context:
        'See <a href="/downloads/My%20Guide.pdf#install">the custom source</a>.',
    });
  });

  it("dedupes each asset per page, keeps the first context, and sorts refs", () => {
    const refs = resultFor(collect(), "My Guide.pdf");

    expect(refs.map(({ title }) => title)).toEqual([
      "Custom Page",
      "Getting Started",
      "Getting Started v2",
      "はじめに",
    ]);
    expect(refs.filter(({ title }) => title === "Getting Started")).toHaveLength(
      1,
    );
    expect(refs.find(({ title }) => title === "Getting Started")?.context).toBe(
      "Download [the guide](/downloads/My%20Guide.pdf) before continuing.",
    );
  });

  it("excludes links in code and all non-routable frontmatter states", () => {
    const keys = [...collect().linkedFrom.keys()];
    expect(keys).not.toContain("ignored-inline.txt");
    expect(keys).not.toContain("ignored-fence.txt");
    expect(keys).not.toContain("ignored-fence.png");
    expect(keys).not.toContain("hidden.pdf");
    expect(keys).not.toContain("unlisted.png");
    expect(keys).not.toContain("search-hidden.png");
    expect(keys).not.toContain("category-hidden.png");
  });

  it("trims ASCII or Japanese sentence context to at most 160 characters", () => {
    const context = resultFor(collect(), "My Guide.pdf").find(
      ({ locale }) => locale === "ja",
    )?.context;

    expect(context).toBeDefined();
    expect(context!.length).toBeLessThanOrEqual(160);
    expect(context).toContain('/downloads/My%20Guide.pdf');
    expect(context?.startsWith("…")).toBe(true);
    expect(context?.endsWith("…")).toBe(true);
  });

  it("extracts and dedupes AssetCode line requests", () => {
    expect(collect().excerptRequests).toEqual([
      { path: "code#sample.ts", start: 2, end: 4 },
      { path: "code#sample.ts", start: 8 },
    ]);
  });
});

function resultFor(
  result: ReturnType<typeof collectAssetLinks>,
  path: string,
) {
  const refs = result.linkedFrom.get(path);
  expect(refs).toBeDefined();
  return refs!;
}
