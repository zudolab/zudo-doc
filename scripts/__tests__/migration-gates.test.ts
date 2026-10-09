import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compileConfig, lintContent, setConfig } from "@takazudo/zudo-design-token-lint";
import { deletionMatrix, textForAbsenceProof } from "../compatibility-deletion-matrix";
import { sha256Html } from "../parity-html-normalize.mjs";
import { checkParity } from "../check-b4push-ci-parity.mjs";

const root = resolve(import.meta.dirname, "../..");
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function audit(config: string, classes: string, strict = true) {
  const dir = mkdtempSync(join(tmpdir(), "migration-wind-control-"));
  dirs.push(dir);
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "zfb.config.ts"), `export default ${config};`);
  writeFileSync(join(dir, "src/probe.tsx"), `export default function Probe() { return <div class="${classes}"/>; }`);
  const run = spawnSync(resolve(root, "node_modules/.bin/zfb"), ["wind", "audit", "--project-root", dir, ...(strict ? ["--fail-on", "error"] : [])], { encoding: "utf8" });
  return { status: run.status, output: run.stdout + run.stderr };
}

describe("#4470 native Wind and retained token policy", () => {
  it("accepts a clean candidate without a count-only success claim", () => {
    const run = audit('{ wind: { spec: 1 } }', "flex");
    expect(run.status).toBe(0);
    expect(run.output).toContain("outcome: complete");
    expect(run.output).toMatch(/diagnostics:\s+\(none\)/);
  });
  it("rejects unsupported palette utility while retaining the diagnostic and location", () => {
    const run = audit('{ wind: { spec: 1 } }', "bg-red-500");
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/ZW006 error.*probe\.tsx:1:/);
    expect(run.output).toContain("No generated utility CSS is emitted");
    expect(audit('{ wind: { spec: 1 } }', "bg-red-500", false).status).toBe(0);
  });
  it("rejects invalid native configuration", () => {
    const run = audit('{ wind: { spec: 99 } }', "flex");
    expect(run.status).toBe(1);
    expect(run.output).toContain("error");
  });
  it("retains numeric z-index policy because native Wind permits it", () => {
    expect(audit('{ wind: { spec: 1 } }', "z-50").status).toBe(0);
    setConfig(compileConfig(JSON.parse(readFileSync(join(root, ".design-token-lint.json"), "utf8"))));
    expect(lintContent("probe.tsx", '<div class="z-50 hover:z-10"/>').map((v) => v.className)).toEqual(["z-50", "hover:z-10"]);
    expect(lintContent("probe.tsx", '<div class="z-modal p-0 gap-0"/>')).toEqual([]);
  });
});

describe("#4470 deletion proofs", () => {
  it("ignores historical comments while rejecting live CSS directives", () => {
    const historical = '/* old @theme and @source inline("x") */\n:root { --color-bg: white; }';
    for (const term of ["@theme", "@source"]) {
      expect(textForAbsenceProof(historical, "theme.css", term, true)).not.toContain(term);
      expect(textForAbsenceProof(`${historical}\n${term} {}`, "theme.css", term, true)).toContain(term);
    }
  });
  it("does not treat CSS URL slashes or quoted markers as comments", () => {
    const css = ':root { --url: url(https://example.test/x); --marker: "/*"; } @source inline("bad");';
    expect(textForAbsenceProof(css, "theme.css", "@source", true)).toContain("@source");
  });
  it("preserves JSX import-source directives and strings containing comment syntax", () => {
    expect(textForAbsenceProof('/** @jsxImportSource preact */', "probe.tsx", "@jsxImportSource preact", true)).toContain("@jsxImportSource preact");
    expect(textForAbsenceProof('const marker = "/*"; import { useState } from "preact/hooks";', "probe.ts", "preact/hooks", true)).toContain("preact/hooks");
    expect(textForAbsenceProof('const template = `x${1}`; // old preact/hooks\nexport const current = 1;', "probe.ts", "preact/hooks", true)).not.toContain("preact/hooks");
  });
  it("pins both retired stylesheet exports as negative contracts", () => {
    const proof = deletionMatrix.find((row) => row.issue === 4470 && row.proof.kind === "package-exports-absent")!.proof;
    expect(proof.kind).toBe("package-exports-absent");
    if (proof.kind === "package-exports-absent") {
      expect(proof.subpaths).toEqual(["./safelist.css", "./theme-no-reset.css"]);
      const pkg = JSON.parse(readFileSync(join(root, proof.packageJson), "utf8"));
      for (const subpath of proof.subpaths) expect(pkg.exports).not.toHaveProperty(subpath);
      expect(pkg.exports["./wind.json"]).toBe("./dist/wind.json");
    }
  });
  it("rejects deleting --fail-on error from the b4push command even if pnpm exec remains", () => {
    const command = "pnpm exec zfb wind audit --project-root . --fail-on error";
    const guards = [{ ciNeedle: command, b4pushScript: "exec", b4pushCommand: command, comment: "native error gate" }];
    expect(checkParity({ workflowSrc: `run: ${command}`, b4pushSrc: command, guards }).errors).toEqual([]);
    expect(checkParity({ workflowSrc: `run: ${command}`, b4pushSrc: command.replace(" --fail-on error", ""), guards }).errors.join("\n")).toContain("Missing exact gate command");
    expect(checkParity({ workflowSrc: `# run: ${command}`, b4pushSrc: command, guards }).errors.length).toBeGreaterThan(0);
  });
});

// Fingerprints must retain the runtime protocol, not only visible text.
it("keeps transport identity and structural comment mutations observable", () => {
  const html = '<div data-zfb-build=4fc45dd287a2e7cf data-zfb-protocol=zudo-react/1 data-zfb-transport=json/1><!--zr:1:0:c-->content<!--/zr:1:0--></div>';
  for (const changed of [
    html.replace("4fc45dd287a2e7cf", "45dbe0a0ccfce7e1"),
    html.replace("zudo-react/1", "zudo-react/2"),
    html.replace("json/1", "json/2"),
    html.replace("<!--zr:1:0:c-->", ""),
    html.replace("content", "regression"),
  ]) expect(sha256Html(changed)).not.toBe(sha256Html(html));
});
