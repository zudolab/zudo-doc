/** @jsxRuntime automatic */
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Child } from "@takazudo/zfb/zudo-react";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { AssetIndexEntry } from "../../route-context-payload/types.js";
import { createAssetIndexPageView } from "../index.js";

const { layoutProps, headProps } = vi.hoisted(() => ({
  layoutProps: [] as Array<Record<string, unknown>>,
  headProps: [] as Array<Record<string, unknown>>,
}));

// The shared shell owns head serialization and page chrome. This leaf suite
// pins asset-index route/body composition while #4458 ports standard head
// attributes currently rejected by the pinned zfb 3.1 runtime.
vi.mock("../../doclayout/index.js", () => ({
  DocLayoutWithDefaults: (props: Record<string, unknown>) => {
    layoutProps.push(props);
    return [<div data-zd-test-head>{props.head as Child}</div>, props.children as Child];
  },
}));
vi.mock("../../head-with-defaults/index.js", () => ({
  createHeadWithDefaults: () => (props: Record<string, unknown>) => {
    headProps.push(props);
    return null;
  },
}));

beforeEach(() => {
  layoutProps.length = 0;
  headProps.length = 0;
});

function latestLayout(): Record<string, unknown> {
  return layoutProps.at(-1) ?? {};
}

function latestHead(): Record<string, unknown> {
  return headProps.at(-1) ?? {};
}

function asset(overrides: Partial<AssetIndexEntry> = {}): AssetIndexEntry {
  return {
    path: "demo/readme.txt",
    name: "readme.txt",
    dir: "demo",
    kind: "text",
    mime: "text/plain",
    bytes: 1200,
    lines: 12,
    ...overrides,
  };
}

const translations: Record<string, string> = {
  "asset.crumb": "Assets",
  "asset.indexBadge": "Index",
  "asset.indexDescription": "Every managed file.",
  "asset.fileCount": "{count} files",
  "asset.fileCountSingle": "{count} file",
  "asset.folderCount": "{count} folders",
  "asset.folderCountSingle": "{count} folder",
  "asset.expandAll": "Expand all",
  "asset.collapseAll": "Collapse all",
  "asset.indexEmpty": "No assets found.",
  "asset.lines": "{count} lines",
};

function page(entries: AssetIndexEntry[], options: { base?: string; routePrefix?: string; dir?: string; locale?: string; translationOverrides?: Record<string, string> } = {}): string {
  const base = options.base ?? "/";
  const routePrefix = options.routePrefix ?? "files";
  const dir = options.dir ?? "assets";
  const withBase = (path: string) => `${base === "/" ? "" : `/${base.replace(/^\/+|\/+$/g, "")}`}${path}`;
  const ctx = makeFakeChromeContext({
    settings: { base, assetViewerDir: dir, assetViewerRoutePrefix: routePrefix },
    overrides: {
      assetManifest: { dir, routePrefix, entries, excerpts: {} },
      withBase,
      t: (key: string) => options.translationOverrides?.[key] ?? translations[key] ?? key,
      absoluteUrl: (path: string) => `https://docs.example${path}`,
    },
  });
  const View = createAssetIndexPageView(ctx);
  return render(<View entries={entries} locale={options.locale} />);
}

describe("asset index page SSG", () => {
  it("renders wide chrome, marker, nested disclosures, metadata, and trailing-slashed file links", () => {
    const html = page([
      asset(),
      asset({ path: "demo/deep/logo.png", name: "logo.png", dir: "demo/deep", kind: "image", mime: "image/png", lines: undefined, width: 320, height: 180, bytes: 2048 }),
    ]);
    expect(html).toContain("data-zd-asset-index-page");
    expect(latestLayout().contentWide).toBe(true);
    expect(html.match(/<details open>/g)).toHaveLength(2);
    expect(html).toContain('<ul><li><details open>');
    expect(html).not.toMatch(/\brole="(?:tree|treeitem|group)"/);
    expect(html).toMatch(/<button\b(?=[^>]*\bdisabled\b)(?=[^>]*data-zd-asset-index-action="expand")/);
    expect(html).toMatch(/<button\b(?=[^>]*\bdisabled\b)(?=[^>]*data-zd-asset-index-action="collapse")/);
    expect(html).toContain('href="/files/demo/readme.txt/"');
    expect(html).toContain('href="/files/demo/deep/logo.png/"');
    expect(html).toMatch(/href="\/files\/demo\/readme\.txt\/"[^>]*><svg[^>]*class="h-icon-sm w-icon-sm shrink-0 text-muted"/);
    expect(html).toContain("2 files");
    expect(html).toContain("2 folders");
    expect(html).toContain("320 × 180");
    expect(html).toContain("public/assets/");
  });

  it("applies a base and custom route prefix exactly once", () => {
    const html = page([asset()], { base: "/pj/x/", routePrefix: "media/view" });
    expect(html).toContain('href="/pj/x/media/view/demo/readme.txt/"');
    expect(latestHead().canonical).toBe("https://docs.example/pj/x/media/view/");
    expect(html).not.toContain("/pj/x/pj/x/");
  });

  it("renders locale chrome and preserves the locale in canonical and leaf links", () => {
    const html = page([asset()], {
      locale: "ja",
      translationOverrides: {
        "asset.crumb": "アセット",
        "asset.indexDescription": "管理対象ファイルの一覧。",
      },
    });
    expect(latestLayout().lang).toBe("ja");
    expect(html).toContain("アセット");
    expect(latestHead().canonical).toBe("https://docs.example/ja/files/");
    expect(html).toContain('href="/ja/files/demo/readme.txt/"');
    expect(html).not.toContain('href="/files/demo/readme.txt/"');
  });

  it("shows an empty state while retaining the page shell", () => {
    const html = page([]);
    expect(html).toContain("data-zd-asset-index-page");
    expect(html).toContain("data-zd-asset-index-empty");
    expect(html).toContain("No assets found.");
    expect(html).not.toContain("<ul data-zd-asset-tree");
  });

  it("uses the path basename for titled-sidecar entries and refines archives locally", () => {
    const html = page([
      asset({ path: "demo/release.zip", name: "Download the release", kind: "other", mime: "application/zip", lines: undefined }),
    ]);
    expect(html).toContain(">release.zip</span>");
    expect(html).not.toContain(">Download the release</span>");
    expect(html).toContain('<rect x="3" y="4" width="18" height="4" rx="1"></rect>');
  });
});
