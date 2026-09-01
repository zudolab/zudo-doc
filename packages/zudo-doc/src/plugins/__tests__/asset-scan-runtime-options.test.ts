import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emitSearchIndex: vi.fn(),
  createSearchIndexDevMiddleware: vi.fn(),
  emitLlmsTxt: vi.fn(),
  createLlmsTxtDevMiddleware: vi.fn(),
  connectToZfbHandler: vi.fn((middleware: unknown) => middleware),
}));

vi.mock("../internal/search-index/index.js", () => ({
  emitSearchIndex: mocks.emitSearchIndex,
  createSearchIndexDevMiddleware: mocks.createSearchIndexDevMiddleware,
}));
vi.mock("../internal/llms-txt/index.js", () => ({
  emitLlmsTxt: mocks.emitLlmsTxt,
  createLlmsTxtDevMiddleware: mocks.createLlmsTxtDevMiddleware,
}));
vi.mock("../connect-adapter.js", () => ({
  connectToZfbHandler: mocks.connectToZfbHandler,
}));

import llmsTxt from "../llms-txt.js";
import searchIndex from "../search-index.js";

const projectRoot = "/runtime/project-root";
const assetScan = {
  assetViewer: true,
  assetViewerIndexing: { search: true, llmsTxt: true, sitemap: true },
  assetViewerDir: "assets",
  assetViewerRoutePrefix: "files",
  assetViewerExclude: [],
  base: "/",
  locales: { ja: { dir: "src/content/docs-ja" } },
  defaultLocaleOnlyPrefixes: [],
};

function context(options: Record<string, unknown> = {}) {
  return {
    projectRoot,
    outDir: "/runtime/out",
    options: { ...options, assetScan },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    register: vi.fn(),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSearchIndexDevMiddleware.mockReturnValue(() => undefined);
  mocks.createLlmsTxtDevMiddleware.mockReturnValue(() => undefined);
});
describe("search-index plugin runtime asset options", () => {
  it("injects ctx.projectRoot into postBuild without changing the serialized projection", async () => {
    await searchIndex.postBuild!(context({ docsDir: "src/content/docs", base: "/" }));
    expect(mocks.emitSearchIndex).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot, assetScan }),
    );
  });

  it("injects ctx.projectRoot into the synchronous dev middleware options", () => {
    searchIndex.devMiddleware!(context({ base: "/" }));
    expect(mocks.createSearchIndexDevMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot, assetScan }),
    );
  });
});

describe("llms-txt plugin runtime asset options", () => {
  it("injects ctx.projectRoot into postBuild without changing the serialized projection", async () => {
    await llmsTxt.postBuild!(context({
      siteName: "Docs",
      siteDescription: "Description",
      defaultLocaleDir: "src/content/docs",
      base: "/",
    }));
    expect(mocks.emitLlmsTxt).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot, assetScan }),
    );
  });

  it("injects ctx.projectRoot into the synchronous dev middleware options", () => {
    llmsTxt.devMiddleware!(context({
      siteName: "Docs",
      siteDescription: "Description",
      defaultLocaleDir: "src/content/docs",
      base: "/",
    }));
    expect(mocks.createLlmsTxtDevMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot, assetScan }),
      expect.anything(),
    );
  });
});
