/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  settings: { assetViewerIndex: false },
  assetManifest: {
    dir: "assets",
    routePrefix: "files",
    entries: [{ path: "demo/file.txt", name: "file.txt", dir: "demo", kind: "text", mime: "text/plain", bytes: 1 }],
    excerpts: {},
  },
}));

vi.mock("virtual:zudo-doc-asset-bodies", () => ({ default: {} }));
vi.mock("../../routes/_context.js", () => routeState);
vi.mock("../../routes/_chrome.js", () => ({
  AssetIndexPageView: () => null,
  AssetPageView: () => null,
}));

import { paths } from "../../routes/files-path.js";

describe("files catch-all paths", () => {
  beforeEach(() => {
    routeState.settings.assetViewerIndex = false;
  });

  it("omits the zero-segment index entry when the flag is off", () => {
    expect(paths()).toEqual([
      { params: { path: ["demo", "file.txt"] }, props: { kind: "asset", entry: routeState.assetManifest.entries[0] } },
    ]);
  });

  it("prepends an empty-array catch-all index entry when the flag is on", () => {
    routeState.settings.assetViewerIndex = true;
    expect(paths()[0]).toEqual({
      params: { path: [] },
      props: { kind: "index", entries: routeState.assetManifest.entries },
    });
  });
});
