// Shape tests for the relocated package plugins.
//
// Each plugin module exports a `ZfbPlugin`-shaped default. These tests
// import the source modules (vitest resolves the `.js` specifiers to the
// `.ts` sources) and assert:
//   - the default export is an object with a `name` string
//   - the expected lifecycle method(s) are functions
//
// They intentionally do NOT invoke the lifecycle hooks (which require
// a real file system / git repo / running server) — just structural
// presence guards so a botched relocation surfaces immediately. The
// dist/exports-map surface is verified separately by the build + the
// `check-plugins.mjs` prepack guard, not here.

import { describe, it, expect } from "vitest";

import docHistory from "../plugins/doc-history.js";
import llmsTxt from "../plugins/llms-txt.js";
import searchIndex from "../plugins/search-index.js";
import claudeResources from "../plugins/claude-resources.js";
import { connectToZfbHandler } from "../plugins/connect-adapter.js";

describe("doc-history plugin shape", () => {
  it("has a name string", () => {
    expect(typeof docHistory.name).toBe("string");
    expect(docHistory.name).toBe("doc-history");
  });

  it("has preBuild, postBuild, and devMiddleware functions", () => {
    expect(typeof docHistory.preBuild).toBe("function");
    expect(typeof docHistory.postBuild).toBe("function");
    expect(typeof docHistory.devMiddleware).toBe("function");
  });
});

describe("llms-txt plugin shape", () => {
  it("has a name string", () => {
    expect(typeof llmsTxt.name).toBe("string");
    expect(llmsTxt.name).toBe("llms-txt");
  });

  it("has postBuild and devMiddleware functions", () => {
    expect(typeof llmsTxt.postBuild).toBe("function");
    expect(typeof llmsTxt.devMiddleware).toBe("function");
  });
});

describe("search-index plugin shape", () => {
  it("has a name string", () => {
    expect(typeof searchIndex.name).toBe("string");
    expect(searchIndex.name).toBe("search-index");
  });

  it("has postBuild and devMiddleware functions", () => {
    expect(typeof searchIndex.postBuild).toBe("function");
    expect(typeof searchIndex.devMiddleware).toBe("function");
  });
});

describe("claude-resources plugin shape", () => {
  it("has a name string", () => {
    expect(typeof claudeResources.name).toBe("string");
    expect(claudeResources.name).toBe("@takazudo/zudo-doc-claude-resources");
  });

  it("has a preBuild function", () => {
    expect(typeof claudeResources.preBuild).toBe("function");
  });
});

describe("connect-adapter shape", () => {
  it("exports connectToZfbHandler as a function", () => {
    expect(typeof connectToZfbHandler).toBe("function");
  });

  it("returns a function when called with a middleware", () => {
    const middleware = (_req: unknown, _res: unknown, next: () => void) => { next(); };
    const handler = connectToZfbHandler(middleware);
    expect(typeof handler).toBe("function");
  });
});
