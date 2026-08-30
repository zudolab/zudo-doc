import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanAssets } from "../scan.js";
import { readSidecar } from "../sidecar.js";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(): Promise<{ root: string; assets: string }> {
  const root = await mkdtemp(join(tmpdir(), "zudo-asset-scan-")); roots.push(root);
  const assets = join(root, "public", "assets"); await mkdir(assets, { recursive: true });
  return { root, assets };
}

describe("scanAssets", () => {
  it("returns sorted normalized paths while skipping dots, sidecars and excludes", async () => {
    const { root, assets } = await fixture();
    await mkdir(join(assets, "nested")); await mkdir(join(assets, ".hidden"));
    await writeFile(join(assets, "z.txt"), "z"); await writeFile(join(assets, "a.txt"), "a");
    await writeFile(join(assets, "a.txt.meta.json"), "{}"); await writeFile(join(assets, ".secret"), "x");
    await writeFile(join(assets, ".hidden", "x.txt"), "x"); await writeFile(join(assets, "nested", "skip.log"), "x");
    await writeFile(join(assets, "nested", "keep.txt"), "x");
    expect(await scanAssets(root, "assets", ["**/*.log"])).toEqual(["a.txt", "nested/keep.txt", "z.txt"]);
  });

  it("follows in-root symlinks but refuses file and directory escapes", async () => {
    const { root, assets } = await fixture();
    const outside = join(root, "private"); await mkdir(outside); await writeFile(join(outside, "secret.txt"), "secret");
    await writeFile(join(assets, "real.txt"), "ok"); await symlink(join(assets, "real.txt"), join(assets, "alias.txt"));
    expect(await scanAssets(root, "assets")).toEqual(["alias.txt", "real.txt"]);
    await symlink(join(outside, "secret.txt"), join(assets, "escaped.txt"));
    await expect(scanAssets(root, "assets")).rejects.toThrow("symlink escapes");
    await rm(join(assets, "escaped.txt")); await symlink(outside, join(assets, "escaped-dir"));
    await expect(scanAssets(root, "assets")).rejects.toThrow("symlink escapes");
  });

  it("enumerates distinct in-root directory aliases and breaks symlink cycles", async () => {
    const { root, assets } = await fixture();
    await mkdir(join(assets, "real")); await writeFile(join(assets, "real", "one.txt"), "one");
    await symlink(join(assets, "real"), join(assets, "alias"));
    await symlink(assets, join(assets, "real", "cycle"));
    expect(await scanAssets(root, "assets")).toEqual(["alias/one.txt", "real/one.txt"]);
  });

  it("throws on case-insensitive URL collisions", async () => {
    const { root, assets } = await fixture(); await writeFile(join(assets, "Logo.svg"), "x"); await writeFile(join(assets, "logo.svg"), "x");
    await expect(scanAssets(root, "assets")).rejects.toThrow("URL collision");
  });

  it("throws when distinct filenames normalize to the same NFC URL", async () => {
    const { root, assets } = await fixture();
    await writeFile(join(assets, "caf\u00e9.txt"), "x");
    await writeFile(join(assets, "cafe\u0301.txt"), "x");
    await expect(scanAssets(root, "assets")).rejects.toThrow("URL collision");
  });

  it("warns for the reserved client prefix and returns empty for an absent root", async () => {
    const { root, assets } = await fixture(); await mkdir(join(assets, "client")); await writeFile(join(assets, "client", "app.js"), "x");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await scanAssets(root, "assets")).toEqual(["client/app.js"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("reserved client/"));
    expect(await scanAssets(root, "missing")).toEqual([]);
  });
});

describe("readSidecar", () => {
  it("reads a small string-only JSON sidecar", async () => {
    const { assets } = await fixture(); const asset = join(assets, "photo.png"); await writeFile(asset, "x");
    await writeFile(`${asset}.meta.json`, JSON.stringify({ title: "Photo", description: "A view", ignored: true }));
    expect(await readSidecar(asset)).toEqual({ title: "Photo", description: "A view" });
  });

  it("returns undefined when absent and warns for malformed, mistyped and oversized input", async () => {
    const { assets } = await fixture(); const asset = join(assets, "photo.png"); await writeFile(asset, "x");
    expect(await readSidecar(asset)).toBeUndefined();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const value of ["{", JSON.stringify({ title: 1 }), "x".repeat(2049)]) {
      await writeFile(`${asset}.meta.json`, value);
      expect(await readSidecar(asset)).toBeUndefined();
    }
    expect(warn).toHaveBeenCalledTimes(3);
  });
});
