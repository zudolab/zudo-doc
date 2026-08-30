/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import render from "preact-render-to-string";
import type { AssetManifest } from "../../route-context-payload/types.js";
import { createAssetCard, createAssetCode } from "../index.js";

const manifest: AssetManifest = {
  dir: "media",
  routePrefix: "view",
  entries: [
    {
      path: "demo/file.js",
      name: "file.js",
      dir: "demo",
      kind: "code",
      mime: "text/javascript",
      language: "javascript",
      bytes: 2_900,
      lines: 94,
      description: "Manifest description",
    },
  ],
  excerpts: {
    "demo/file.js#27-44": {
      html: '<pre class="hi-root"><code><span class="line" data-line="27">const x = 1;</span></code></pre>',
      startLine: 27,
      endLine: 44,
      totalLines: 94,
      truncated: false,
    },
  },
};

const context = {
  base: "/project",
  assetManifest: manifest,
  routePrefix: "view",
  dir: "media",
};

describe("asset authoring components", () => {
  it("renders metadata and canonical viewer/raw links in the asset card", () => {
    const Asset = createAssetCard(context);
    const html = render(<Asset src="/media/demo/file.js" />);
    expect(html).toContain("demo/");
    expect(html).toContain("file.js");
    expect(html).toContain("JavaScript · 2.9 KB · 94 lines");
    expect(html).toContain("Manifest description");
    expect(html).toContain('href="/project/view/demo/file.js/"');
    expect(html).toContain('href="/project/media/demo/file.js" download');
  });

  it("renders the requested excerpt with real line data and a valid fragment", () => {
    const AssetCode = createAssetCode(context);
    const html = render(<AssetCode src="/media/demo/file.js" lines="27-44" />);
    expect(html).toContain("demo/file.js");
    expect(html).toContain("lines 27–44");
    expect(html).toContain('data-line="27"');
    expect(html).not.toContain('id="L27"');
    expect(html).toContain("Showing 18 of 94 lines");
    expect(html).toContain('href="/project/view/demo/file.js/#L27"');
  });

  it("shows a visible warning when the requested excerpt was not built", () => {
    const AssetCode = createAssetCode(context);
    const html = render(<AssetCode src="/media/demo/file.js" lines="1-2" />);
    expect(html).toContain("Excerpt not built — check the `lines` attribute");
    expect(html).toContain('role="status"');
  });

  it("shows the same warning when the lines attribute is omitted", () => {
    const AssetCode = createAssetCode(context);
    const html = render(<AssetCode src="/media/demo/file.js" />);
    expect(html).toContain("Excerpt not built — check the `lines` attribute");
  });

  it("renders nothing when the asset manifest is unavailable", () => {
    const Asset = createAssetCard({ ...context, assetManifest: null });
    const AssetCode = createAssetCode({ ...context, assetManifest: null });
    expect(render(<Asset src="/media/demo/file.js" />)).toBe("");
    expect(
      render(<AssetCode src="/media/demo/file.js" lines="27-44" />),
    ).toBe("");
  });

  it("omits an unreachable fragment beyond the truncated viewer body", () => {
    const farManifest: AssetManifest = {
      ...manifest,
      entries: [{ ...manifest.entries[0]!, lines: 3_000 }],
      excerpts: {
        "demo/file.js#2500-2510": {
          html: '<pre class="hi-root"><code><span class="line" data-line="2500">x</span></code></pre>',
          startLine: 2_500,
          endLine: 2_510,
          totalLines: 3_000,
          truncated: false,
        },
      },
    };
    const AssetCode = createAssetCode({ ...context, assetManifest: farManifest });
    const html = render(
      <AssetCode src="/media/demo/file.js" lines="2500-2510" />,
    );
    expect(html).toContain('href="/project/view/demo/file.js/"');
    expect(html).not.toContain("#L2500");
  });
});
