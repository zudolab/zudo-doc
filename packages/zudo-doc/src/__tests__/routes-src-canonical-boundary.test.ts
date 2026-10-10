import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const pkgRoot = resolve(__dirname, "../..");

describe("published route sources retain canonical boundary identity (#4059)", () => {
  it("stages the configured bootstrap as a public re-export without copying its definition", () => {
    // Exercise the actual generator in a disposable package, with the real
    // route corpus. This does not modify dist or routes-src beneath a watcher.
    const root = mkdtempSync(join(tmpdir(), "zudo-routes-canonical-"));
    try {
      mkdirSync(join(root, "scripts"));
      cpSync(join(pkgRoot, "scripts/copy-routes-src.mjs"), join(root, "scripts/copy-routes-src.mjs"));
      cpSync(join(pkgRoot, "src/routes"), join(root, "src/routes"), { recursive: true });
      execFileSync(process.execPath, [join(root, "scripts/copy-routes-src.mjs")]);
      const staged = readFileSync(join(root, "routes-src/_design-token-panel-bootstrap.tsx"), "utf8");
      expect(staged.trim()).toBe('export { ConfiguredDesignTokenPanelBootstrap } from "@takazudo/zudo-doc/routes/design-token-panel-bootstrap";');
      const manifest = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
      expect(manifest.exports["./routes/design-token-panel-bootstrap"]).toEqual({
        types: "./dist/routes/_design-token-panel-bootstrap.d.ts",
        default: "./dist/routes/_design-token-panel-bootstrap.js",
      });
      cpSync(join(pkgRoot, "scripts/check-routes-src.mjs"), join(root, "scripts/check-routes-src.mjs"));
      execFileSync(process.execPath, [join(root, "scripts/check-routes-src.mjs")]);
      // The publication guard must reject the old copied-definition shape,
      // not merely check that the route file exists and imports resolve.
      writeFileSync(join(root, "routes-src/_design-token-panel-bootstrap.tsx"),
        '"use client";\nexport function ConfiguredDesignTokenPanelBootstrap() { return null; }\n');
      const invalid = spawnSync(process.execPath, [join(root, "scripts/check-routes-src.mjs")], { encoding: "utf8" });
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain("must re-export its canonical package boundary");
      // The original source remains the sole definition, retaining the host
      // callable channel and activation/abort lifecycle in both build graphs.
      const canonical = readFileSync(join(root, "src/routes/_design-token-panel-bootstrap.tsx"), "utf8");
      expect(canonical).toContain('from "virtual:zudo-doc-design-token-panel-config"');
      expect(canonical).toContain("export function ConfiguredDesignTokenPanelBootstrap()");
      expect(canonical).toContain("scope.abortSignal");
      // Route paths and sibling imports stay available to native extraction;
      // only the boundary's definition is canonicalized.
      expect(readFileSync(join(root, "routes-src/docs-slug.tsx"), "utf8")).toContain("export function paths");
      expect(readFileSync(join(root, "routes-src/_chrome.tsx"), "utf8")).toContain('from "./_design-token-panel-bootstrap.js"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
