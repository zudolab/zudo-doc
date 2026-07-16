// Fast, isolated unit coverage for `createThemePacksDevMiddleware` — the
// dev-time static-file server (ADR docs/adr/theme-packs.md, Decision 2,
// #2820). Uses a fabricated fixture pack directory so content-type dispatch,
// the no-css-for-default rule, and path-traversal rejection can all be
// exercised directly against a Connect-style req/res/next shape.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createThemePacksDevMiddleware } from "../dev-middleware.js";
import type { ThemePackMeta, ThemePackRegistry } from "../../../../theme-packs-registry/index.js";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-theme-packs-dev-mw-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixtureMeta(slug: string): ThemePackMeta {
  return {
    schemaVersion: 1,
    slug,
    name: slug,
    description: "fixture pack",
    mode: "light",
    version: "1.0.0",
    fonts: { sans: "System", mono: "System", loaded: [] },
    preview: {
      light: {
        bg: "#fff",
        fg: "#000",
        accent: "#000",
        syntax: { keyword: "#000", string: "#000", comment: "#000", callable: "#000" },
      },
      dark: {
        bg: "#000",
        fg: "#fff",
        accent: "#fff",
        syntax: { keyword: "#fff", string: "#fff", comment: "#fff", callable: "#fff" },
      },
    },
  };
}

function makeFixturePacksDir(): string {
  const packsDir = makeTempDir();
  mkdirSync(join(packsDir, "default"), { recursive: true });
  writeFileSync(join(packsDir, "default", "meta.json"), JSON.stringify(fixtureMeta("default")));
  mkdirSync(join(packsDir, "acme", "fonts"), { recursive: true });
  writeFileSync(join(packsDir, "acme", "meta.json"), JSON.stringify(fixtureMeta("acme")));
  writeFileSync(join(packsDir, "acme", "pack.css"), 'html[data-theme-pack="acme"]{--zd-bg:#fff}');
  writeFileSync(join(packsDir, "acme", "fonts", "Acme.woff2"), "binary-stub");
  return packsDir;
}

/**
 * Returns `{ res, result }` — `res` is the Connect-style response shim, and
 * `result` is a plain mutable object callers read AFTER invoking the
 * middleware (NOT destructured up front — a getter-based result object would
 * snapshot its initial value at destructure time, before `res.end()` ever
 * runs).
 */
function makeRes() {
  const result: {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    ended: boolean;
  } = { statusCode: 200, headers: {}, body: undefined, ended: false };
  const res = {
    get statusCode() {
      return result.statusCode;
    },
    set statusCode(v: number) {
      result.statusCode = v;
    },
    setHeader(name: string, value: string) {
      result.headers[name.toLowerCase()] = value;
    },
    end(b?: unknown) {
      result.body = b;
      result.ended = true;
    },
  };
  return { res, result };
}

describe("createThemePacksDevMiddleware", () => {
  function makeMiddleware(packsDir: string) {
    const enabled: ThemePackRegistry = [
      { slug: "default", meta: fixtureMeta("default"), hasStylesheet: false },
      { slug: "acme", meta: fixtureMeta("acme"), hasStylesheet: true },
    ];
    return createThemePacksDevMiddleware({ packsDir, enabled, routePrefix: "/theme-packs" });
  }

  it("serves the aggregated index.json with application/json", () => {
    const packsDir = makeFixturePacksDir();
    const middleware = makeMiddleware(packsDir);
    const { res, result } = makeRes();
    let calledNext = false;
    middleware({ url: "/theme-packs/index.json" } as never, res as never, () => {
      calledNext = true;
    });
    expect(calledNext).toBe(false);
    expect(result.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(result.body as string)).toEqual({
      schemaVersion: 1,
      packs: [fixtureMeta("default"), fixtureMeta("acme")],
    });
  });

  it("serves a CSS-bearing pack's pack.css with text/css", () => {
    const packsDir = makeFixturePacksDir();
    const middleware = makeMiddleware(packsDir);
    const { res, result } = makeRes();
    middleware({ url: "/theme-packs/acme/pack.css" } as never, res as never, () => {});
    expect(result.headers["content-type"]).toBe("text/css");
    expect(result.body).toContain('html[data-theme-pack="acme"]');
  });

  it("falls through to next() for pack.css on a pack with no stylesheet (default)", () => {
    const packsDir = makeFixturePacksDir();
    const middleware = makeMiddleware(packsDir);
    const { res } = makeRes();
    let calledNext = false;
    middleware({ url: "/theme-packs/default/pack.css" } as never, res as never, () => {
      calledNext = true;
    });
    expect(calledNext).toBe(true);
  });

  it("serves a font file with font/woff2 content type", () => {
    const packsDir = makeFixturePacksDir();
    const middleware = makeMiddleware(packsDir);
    const { res, result } = makeRes();
    middleware({ url: "/theme-packs/acme/fonts/Acme.woff2" } as never, res as never, () => {});
    expect(result.headers["content-type"]).toBe("font/woff2");
    expect(Buffer.isBuffer(result.body)).toBe(true);
    expect((result.body as Buffer).toString("utf8")).toBe("binary-stub");
  });

  it("falls through to next() for an unknown slug", () => {
    const packsDir = makeFixturePacksDir();
    const middleware = makeMiddleware(packsDir);
    const { res } = makeRes();
    let calledNext = false;
    middleware({ url: "/theme-packs/nope/pack.css" } as never, res as never, () => {
      calledNext = true;
    });
    expect(calledNext).toBe(true);
  });

  it("falls through to next() for a URL outside the registered prefix", () => {
    const packsDir = makeFixturePacksDir();
    const middleware = makeMiddleware(packsDir);
    const { res } = makeRes();
    let calledNext = false;
    middleware({ url: "/search-index.json" } as never, res as never, () => {
      calledNext = true;
    });
    expect(calledNext).toBe(true);
  });

  it("falls through (never reads outside the pack dir) for a literal '..' path segment", () => {
    const packsDir = makeFixturePacksDir();
    const middleware = makeMiddleware(packsDir);
    const { res } = makeRes();
    let calledNext = false;
    // "fonts/../../meta.json" splits into segments including a literal
    // "..", which the segment check rejects up front (falls through to
    // next() rather than ever calling resolve()/existsSync() on the
    // traversed path).
    middleware({ url: "/theme-packs/acme/fonts/../../meta.json" } as never, res as never, () => {
      calledNext = true;
    });
    expect(calledNext).toBe(true);
  });
});
