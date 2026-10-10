// Non-root control build (#4509): build the consumer with a non-root `base`
// and `copyPublicWithBase: false` (zfb's documented whole-output relocation
// contract), then relocate the entire output under <docroot>/<base>.
// Native `zfb preview` does not strip base, so the result is served by
// static-mount-server.mjs via `run.mjs mount`.
// Usage: node build-mount-control.mjs <consumerDir> <base> <docroot>
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const [consumerArg, baseArg, docrootArg] = process.argv.slice(2);
const consumer = path.resolve(consumerArg);
const base = baseArg.endsWith("/") ? baseArg : `${baseArg}/`;
const docroot = path.resolve(docrootArg);
const configPath = path.join(consumer, "zfb.config.ts");
const original = readFileSync(configPath, "utf8");
const outdir = path.join(consumer, "dist-mount");

const head = "export default defineConfig(\n  zudoDoc({\n";
const tail = "  }),\n);\n";
if (!original.includes(head) || !original.endsWith(tail)) throw new Error("unexpected zfb.config.ts shape");
const patched = original
  .replace(head, `export default defineConfig({\n  ...zudoDoc({\n    base: ${JSON.stringify(base)},\n`)
  .replace(new RegExp(`${tail.replace(/[()]/g, "\\$&")}$`), "  }),\n  copyPublicWithBase: false,\n});\n");

try {
  writeFileSync(configPath, patched);
  rmSync(outdir, { recursive: true, force: true });
  execFileSync(path.join(consumer, "node_modules/.bin/zfb"),
    ["build", "--outdir", outdir, "--scratch-dir", path.join(consumer, ".zfb-build", "mount")],
    { cwd: consumer, stdio: "inherit", env: { ...process.env, GEN_DOC_HISTORY: "1" } });
} finally {
  writeFileSync(configPath, original);
}

rmSync(docroot, { recursive: true, force: true });
const target = path.join(docroot, base);
mkdirSync(path.dirname(target), { recursive: true });
cpSync(outdir, target, { recursive: true });
if (!existsSync(path.join(target, "docs/getting-started/index.html"))) throw new Error("relocated output missing docs/getting-started");
console.log(JSON.stringify({ base, docroot, relocated: target, configPatch: patched.split("\n").filter((l) => /base:|copyPublicWithBase/.test(l)).map((l) => l.trim()) }));
