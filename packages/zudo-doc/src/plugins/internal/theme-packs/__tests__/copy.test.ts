// Fast, isolated unit coverage for `copyEnabledThemePacks` — the postBuild
// copy step (ADR docs/adr/theme-packs.md, Decision 2, #2820). Uses fabricated
// fixture pack directories (not the real src/theme-packs/) so the no-op vs.
// copy behavior can be exercised independently of the committed default /
// foundry packs — plugin-level coverage against the REAL bundled packs lives
// in `../../__tests__/theme-packs.test.ts`.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { copyEnabledThemePacks } from "../copy.js";
import type { ThemePackMeta, ThemePackRegistry } from "../../../../theme-packs-registry/index.js";

const tempDirs: string[] = [];
function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
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

describe("copyEnabledThemePacks", () => {
  it("no-ops (writes nothing) when the enabled set has no CSS-bearing pack", () => {
    const packsDir = makeTempDir("zudo-doc-theme-packs-src-");
    mkdirSync(join(packsDir, "default"), { recursive: true });
    writeFileSync(join(packsDir, "default", "meta.json"), JSON.stringify(fixtureMeta("default")));
    const outDir = makeTempDir("zudo-doc-theme-packs-out-");

    const enabled: ThemePackRegistry = [
      { slug: "default", meta: fixtureMeta("default"), hasStylesheet: false },
    ];
    const result = copyEnabledThemePacks({ packsDir, enabled, outDir });

    expect(result).toEqual({ copied: false });
    expect(existsSync(join(outDir, "theme-packs"))).toBe(false);
  });

  it("copies meta.json + pack.css + fonts/* for a CSS-bearing pack and writes the aggregated index.json", () => {
    const packsDir = makeTempDir("zudo-doc-theme-packs-src-");
    mkdirSync(join(packsDir, "default"), { recursive: true });
    writeFileSync(join(packsDir, "default", "meta.json"), JSON.stringify(fixtureMeta("default")));
    mkdirSync(join(packsDir, "acme", "fonts"), { recursive: true });
    writeFileSync(join(packsDir, "acme", "meta.json"), JSON.stringify(fixtureMeta("acme")));
    writeFileSync(join(packsDir, "acme", "pack.css"), 'html[data-theme-pack="acme"]{--zd-bg:#fff}');
    writeFileSync(join(packsDir, "acme", "fonts", "Acme.woff2"), "binary-stub");
    writeFileSync(join(packsDir, "acme", "fonts", "OFL.txt"), "license text");

    const outDir = makeTempDir("zudo-doc-theme-packs-out-");
    const enabled: ThemePackRegistry = [
      { slug: "default", meta: fixtureMeta("default"), hasStylesheet: false },
      { slug: "acme", meta: fixtureMeta("acme"), hasStylesheet: true },
    ];

    const result = copyEnabledThemePacks({ packsDir, enabled, outDir });

    expect(result.copied).toBe(true);
    const destRoot = join(outDir, "theme-packs");
    expect(result.destDir).toBe(destRoot);
    expect(existsSync(join(destRoot, "default", "meta.json"))).toBe(true);
    expect(existsSync(join(destRoot, "default", "pack.css"))).toBe(false);
    expect(existsSync(join(destRoot, "acme", "meta.json"))).toBe(true);
    expect(existsSync(join(destRoot, "acme", "pack.css"))).toBe(true);
    expect(existsSync(join(destRoot, "acme", "fonts", "Acme.woff2"))).toBe(true);
    expect(existsSync(join(destRoot, "acme", "fonts", "OFL.txt"))).toBe(true);

    const manifest = JSON.parse(readFileSync(join(destRoot, "index.json"), "utf8"));
    expect(manifest).toEqual({
      schemaVersion: 1,
      packs: [fixtureMeta("default"), fixtureMeta("acme")],
    });
  });

  it("copies only enabled packs, skipping any bundled-but-disabled pack", () => {
    const packsDir = makeTempDir("zudo-doc-theme-packs-src-");
    mkdirSync(join(packsDir, "acme"), { recursive: true });
    writeFileSync(join(packsDir, "acme", "meta.json"), JSON.stringify(fixtureMeta("acme")));
    writeFileSync(join(packsDir, "acme", "pack.css"), 'html[data-theme-pack="acme"]{--zd-bg:#fff}');
    mkdirSync(join(packsDir, "unused"), { recursive: true });
    writeFileSync(join(packsDir, "unused", "meta.json"), JSON.stringify(fixtureMeta("unused")));
    writeFileSync(join(packsDir, "unused", "pack.css"), 'html[data-theme-pack="unused"]{--zd-bg:#000}');

    const outDir = makeTempDir("zudo-doc-theme-packs-out-");
    const enabled: ThemePackRegistry = [
      { slug: "acme", meta: fixtureMeta("acme"), hasStylesheet: true },
    ];

    copyEnabledThemePacks({ packsDir, enabled, outDir });

    const destRoot = join(outDir, "theme-packs");
    expect(existsSync(join(destRoot, "acme", "meta.json"))).toBe(true);
    expect(existsSync(join(destRoot, "unused"))).toBe(false);
  });
});
