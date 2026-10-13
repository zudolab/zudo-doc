// #4573: blocking Slow Unit Tests lane. Build/pack through the public lifecycle,
// then install into a real consumer so workspace aliases cannot hide stale output.
import { afterAll, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(__dirname, "../..");
const temporary = mkdtempSync(join(tmpdir(), "mermaid-packed-"));
afterAll(() => rmSync(temporary, { recursive: true, force: true }));

it("installed public code-syntax export emits the patched browser import", { timeout: 420_000 }, () => {
  execFileSync("npm", ["pack", "--pack-destination", temporary], {
    cwd: join(root, "packages/zudo-doc"), stdio: "pipe", timeout: 180_000,
  });
  const tarball = join(temporary, readdirSync(temporary).find((name) => name.endsWith(".tgz"))!);
  writeFileSync(join(temporary, "package.json"), JSON.stringify({ name: "mermaid-packed-proof", private: true, type: "module" }));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: temporary, stdio: "pipe", timeout: 180_000,
  });
  const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  const lockfile = join(temporary, "package-lock.json");
  const lockBefore = hash(lockfile);
  for (const command of ["ci", "install"]) {
    execFileSync("npm", [command, "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: temporary, stdio: "pipe", timeout: 180_000,
    });
    expect(hash(lockfile), `${command} must preserve the consumer lock`).toBe(lockBefore);
  }
  const proof = JSON.parse(execFileSync("node", ["--input-type=module", "-e", `
    import { MERMAID_CDN_MODULE_URL, buildMermaidInitScript } from '@takazudo/zudo-doc/code-syntax';
    console.log(JSON.stringify({ url: MERMAID_CDN_MODULE_URL, script: buildMermaidInitScript(MERMAID_CDN_MODULE_URL), resolved: import.meta.resolve('@takazudo/zudo-doc/code-syntax'), jsxRuntime: import.meta.resolve('@takazudo/zfb/zudo-react/jsx-runtime') }));
  `], { cwd: temporary, encoding: "utf8" }));
  expect(proof.url).toBe("https://esm.sh/mermaid@11.17.2");
  expect(proof.script).toContain('import("https://esm.sh/mermaid@11.17.2")');
  const installed = realpathSync(join(temporary, "node_modules/@takazudo/zudo-doc"));
  expect(installed.startsWith(temporary + "/")).toBe(true);
  expect(proof.resolved).toBe(`file://${installed}/dist/code-syntax/index.js`);
  expect(proof.jsxRuntime.startsWith(`file://${temporary}/node_modules/`)).toBe(true);
  const evidence = { url: proof.url, resolved: proof.resolved, jsxRuntime: proof.jsxRuntime, packageSha256: hash(tarball), consumerLockSha256: hash(join(temporary, "package-lock.json")) };
  console.log(JSON.stringify(evidence));
  if (process.env.MERMAID_PACKED_EVIDENCE) {
    writeFileSync(process.env.MERMAID_PACKED_EVIDENCE, JSON.stringify(evidence, null, 2) + "\n");
  }
});
