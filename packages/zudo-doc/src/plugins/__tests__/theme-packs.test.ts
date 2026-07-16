// Fast, isolated unit coverage for the theme-packs plugin (ADR
// docs/adr/theme-packs.md, Decision 2, #2820). Calls `setup()`/`postBuild()`/
// `devMiddleware()` directly against a minimal mock context (no full `zfb
// build`) — mirrors `routes.test.ts`'s style.
//
// Exercised against the REAL bundled
// `src/theme-packs/{broadsheet,default,foundry,ledger,manuscript,swissgrid}/`
// directories (resolved via the plugin's own `new URL("../theme-packs/",
// import.meta.url)`, which — under vitest, running the source directly —
// resolves to `src/theme-packs/`): no fixture directory needed, and this
// doubles as a smoke test that the committed packs actually satisfy the
// registry loader + validator.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import themePacksPlugin from "../theme-packs.js";

const tempDirs: string[] = [];
function makeOutDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-theme-packs-plugin-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const logger = { info() {}, warn() {}, error() {} };

describe("theme-packs plugin — setup()", () => {
  it("does not throw with default options (all bundled packs enabled)", () => {
    expect(() =>
      themePacksPlugin.setup!({ options: {}, logger } as never),
    ).not.toThrow();
  });

  it("throws naming the bad slug + available ones for an unknown themePack", () => {
    expect(() =>
      themePacksPlugin.setup!({ options: { themePack: "nope" }, logger } as never),
    ).toThrowError(/nope/);
  });

  it("throws naming duplicates for a themePacks list with a repeated slug", () => {
    expect(() =>
      themePacksPlugin.setup!({
        options: { themePacks: ["default", "default"] },
        logger,
      } as never),
    ).toThrowError(/duplicate/);
  });

  it("throws for an unknown slug in themePacks, naming the available packs", () => {
    expect(() =>
      themePacksPlugin.setup!({
        options: { themePacks: ["default", "not-a-real-pack"] },
        logger,
      } as never),
    ).toThrowError(/not-a-real-pack/);
  });
});

describe("theme-packs plugin — postBuild()", () => {
  it("copies the full bundled set (6 packs) when themePacks is omitted", async () => {
    const outDir = makeOutDir();
    await themePacksPlugin.postBuild!({
      outDir,
      options: {},
      logger,
      projectRoot: outDir,
      config: {} as never,
    } as never);

    const destRoot = join(outDir, "theme-packs");
    expect(existsSync(join(destRoot, "default", "meta.json"))).toBe(true);
    expect(existsSync(join(destRoot, "default", "pack.css"))).toBe(false);
    expect(existsSync(join(destRoot, "foundry", "meta.json"))).toBe(true);
    expect(existsSync(join(destRoot, "foundry", "pack.css"))).toBe(true);
    expect(existsSync(join(destRoot, "foundry", "fonts", "Inter-latin.woff2"))).toBe(true);
    expect(existsSync(join(destRoot, "foundry", "fonts", "Inter-latin-ext.woff2"))).toBe(true);
    expect(existsSync(join(destRoot, "foundry", "fonts", "OFL.txt"))).toBe(true);

    const manifest = JSON.parse(readFileSync(join(destRoot, "index.json"), "utf8")) as {
      schemaVersion: number;
      packs: Array<{ slug: string }>;
    };
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.packs.map((p) => p.slug)).toEqual([
      "default",
      "broadsheet",
      "foundry",
      "ledger",
      "manuscript",
      "swissgrid",
    ]);
  });

  it('no-ops (writes nothing) when themePacks is explicitly ["default"]', async () => {
    const outDir = makeOutDir();
    await themePacksPlugin.postBuild!({
      outDir,
      options: { themePacks: ["default"] },
      logger,
      projectRoot: outDir,
      config: {} as never,
    } as never);
    expect(existsSync(join(outDir, "theme-packs"))).toBe(false);
  });
});

describe("theme-packs plugin — devMiddleware()", () => {
  function makeRegisterCtx(options: Record<string, unknown>) {
    const registered: Array<{ path: string; handler: unknown }> = [];
    const ctx = {
      options,
      logger,
      register(path: string, handler: unknown) {
        registered.push({ path, handler });
      },
    };
    return { ctx, registered };
  }

  it("registers <base>/theme-packs and serves foundry's pack.css", async () => {
    const { ctx, registered } = makeRegisterCtx({ base: "/" });
    themePacksPlugin.devMiddleware!(ctx as never);
    expect(registered).toHaveLength(1);
    expect(registered[0]?.path).toBe("/theme-packs");

    const handler = registered[0]!.handler as (
      req: unknown,
    ) => Promise<{ status: number; headers?: Record<string, string>; body?: string } | undefined>;
    const res = await handler({ method: "GET", url: "/theme-packs/foundry/pack.css", headers: {} });
    expect(res?.status).toBe(200);
    expect(res?.headers?.["content-type"]).toBe("text/css");
    expect(res?.body).toContain('html[data-theme-pack="foundry"]');
  });

  it("serves the aggregated index.json", async () => {
    const { ctx, registered } = makeRegisterCtx({ base: "/" });
    themePacksPlugin.devMiddleware!(ctx as never);
    const handler = registered[0]!.handler as (
      req: unknown,
    ) => Promise<{ status: number; headers?: Record<string, string>; body?: string } | undefined>;
    const res = await handler({ method: "GET", url: "/theme-packs/index.json", headers: {} });
    expect(res?.headers?.["content-type"]).toBe("application/json");
    const manifest = JSON.parse(res!.body!) as { packs: Array<{ slug: string }> };
    expect(manifest.packs.map((p) => p.slug)).toEqual([
      "default",
      "broadsheet",
      "foundry",
      "ledger",
      "manuscript",
      "swissgrid",
    ]);
  });

  it("does not register anything when only default is enabled (no-op)", () => {
    const { ctx, registered } = makeRegisterCtx({ base: "/", themePacks: ["default"] });
    themePacksPlugin.devMiddleware!(ctx as never);
    expect(registered).toHaveLength(0);
  });

  it("prefixes the registered path with a non-root base", () => {
    const { ctx, registered } = makeRegisterCtx({ base: "/my-docs/" });
    themePacksPlugin.devMiddleware!(ctx as never);
    expect(registered[0]?.path).toBe("/my-docs/theme-packs");
  });
});
