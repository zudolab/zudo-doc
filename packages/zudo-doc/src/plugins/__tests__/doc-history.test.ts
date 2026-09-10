import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runDocHistoryMetaStep: vi.fn(),
  runDocHistoryPostBuild: vi.fn(),
  createDocHistoryDevMiddleware: vi.fn(() => () => undefined),
  connectToZfbHandler: vi.fn((middleware: unknown) => middleware),
}));

vi.mock("../internal/doc-history/index.js", () => ({
  runDocHistoryMetaStep: mocks.runDocHistoryMetaStep,
  runDocHistoryPostBuild: mocks.runDocHistoryPostBuild,
  createDocHistoryDevMiddleware: mocks.createDocHistoryDevMiddleware,
}));
vi.mock("../connect-adapter.js", () => ({
  connectToZfbHandler: mocks.connectToZfbHandler,
}));

import docHistory from "../doc-history.js";

const projectRoot = "/runtime/project-root";

function context(options: Record<string, unknown> = {}) {
  return {
    projectRoot,
    outDir: "/runtime/out",
    options: {
      docsDir: "src/content/docs",
      locales: { ja: { dir: "src/content/docs-ja" } },
      base: "/",
      ...options,
    },
    logger: { info: vi.fn(), warn: vi.fn() },
    register: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("doc-history plugin UI gate", () => {
  it("keeps preBuild metadata generation when ui is false", async () => {
    const ctx = context({ ui: false, exclude: ["drafts/**"] });

    await docHistory.preBuild!(ctx as never);

    expect(mocks.runDocHistoryMetaStep).toHaveBeenCalledWith({
      projectRoot,
      docsDir: "src/content/docs",
      locales: { ja: { dir: "src/content/docs-ja" } },
      exclude: ["drafts/**"],
    });
  });

  it("skips postBuild generation when ui is false, even in CI", async () => {
    const previousCi = process.env.CI;
    const previousGenerate = process.env.GEN_DOC_HISTORY;
    process.env.CI = "1";
    process.env.GEN_DOC_HISTORY = "1";

    try {
      await docHistory.postBuild!(context({ ui: false }) as never);
    } finally {
      if (previousCi === undefined) delete process.env.CI;
      else process.env.CI = previousCi;
      if (previousGenerate === undefined) delete process.env.GEN_DOC_HISTORY;
      else process.env.GEN_DOC_HISTORY = previousGenerate;
    }

    expect(mocks.runDocHistoryPostBuild).not.toHaveBeenCalled();
  });

  it("keeps postBuild generation enabled when ui is omitted", async () => {
    await docHistory.postBuild!(context() as never);

    expect(mocks.runDocHistoryPostBuild).toHaveBeenCalledWith(
      expect.objectContaining({ docsDir: "src/content/docs" }),
      expect.objectContaining({ outDir: "/runtime/out" }),
    );
  });

  it("does not register the dev proxy when ui is false", () => {
    const ctx = context({ ui: false });

    docHistory.devMiddleware!(ctx as never);

    expect(ctx.register).not.toHaveBeenCalled();
    expect(mocks.createDocHistoryDevMiddleware).not.toHaveBeenCalled();
  });

  it("registers the dev proxy when ui is omitted", () => {
    const ctx = context();

    docHistory.devMiddleware!(ctx as never);

    expect(ctx.register).toHaveBeenCalledTimes(1);
    expect(ctx.register).toHaveBeenCalledWith(
      "/doc-history",
      expect.any(Function),
    );
  });
});
