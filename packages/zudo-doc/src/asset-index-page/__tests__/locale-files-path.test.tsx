/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  settings: {
    assetViewerIndex: true,
    assetViewerRoutePrefix: "files",
    locales: { ja: { label: "日本語", dir: "src/content/docs-ja" }, fr: { label: "Français", dir: "src/content/docs-fr" } },
  },
  assetManifest: {
    dir: "assets",
    routePrefix: "files",
    entries: [
      { path: "demo/file.txt", name: "file.txt", dir: "demo", kind: "text", mime: "text/plain", bytes: 1 },
      { path: "private/only.txt", name: "only.txt", dir: "private", kind: "text", mime: "text/plain", bytes: 1 },
    ],
    excerpts: {},
  },
  isDefaultLocaleOnlyPath: vi.fn((path: string) => path.startsWith("/files/private/")),
}));

vi.mock("virtual:zudo-doc-asset-bodies", () => ({ default: {} }));
vi.mock("../../routes/_context.js", () => routeState);
vi.mock("../../routes/_chrome.js", () => ({
  AssetIndexPageView: () => null,
  AssetPageView: () => null,
}));

import { paths } from "../../routes/locale-files-path.js";

describe("locale files catch-all paths", () => {
  beforeEach(() => {
    routeState.settings.assetViewerIndex = true;
    routeState.isDefaultLocaleOnlyPath.mockImplementation((path: string) =>
      path.startsWith("/files/private/"),
    );
  });

  it("builds the locale × asset cross-product and filters default-only assets", () => {
    expect(paths()).toEqual([
      { params: { locale: "ja", path: [] }, props: { kind: "index", entries: [routeState.assetManifest.entries[0]] } },
      { params: { locale: "ja", path: ["demo", "file.txt"] }, props: { kind: "asset", entry: routeState.assetManifest.entries[0] } },
      { params: { locale: "fr", path: [] }, props: { kind: "index", entries: [routeState.assetManifest.entries[0]] } },
      { params: { locale: "fr", path: ["demo", "file.txt"] }, props: { kind: "asset", entry: routeState.assetManifest.entries[0] } },
    ]);
  });

  it("reproduces the default-locale-only opt-out for the whole viewer prefix", () => {
    routeState.isDefaultLocaleOnlyPath.mockImplementation((path: string) =>
      path.startsWith("/files/"),
    );
    expect(paths()).toEqual([]);
  });
});
