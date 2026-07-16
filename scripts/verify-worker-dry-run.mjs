import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outdir = mkdtempSync(join(tmpdir(), "zudo-doc-worker-dry-run-"));
const skipBuild = process.argv.includes("--skip-build");

try {
  // The default remains a standalone fresh-build proof. CI/local contract
  // orchestration may pass --skip-build only after producing or restoring the
  // exact dist artifact that the runtime suite also consumes.
  if (!skipBuild) {
    execFileSync("pnpm", ["build"], { cwd: root, stdio: "inherit" });
  }

  execFileSync(
    "pnpm",
    ["exec", "wrangler", "deploy", "--dry-run", "--outdir", outdir],
    { cwd: root, stdio: "inherit" },
  );

  const modules = readdirSync(outdir).filter((name) => name.endsWith(".js"));
  if (modules.length !== 1) {
    throw new Error(`expected one emitted JavaScript entry, found: ${modules.join(", ")}`);
  }

  const emitted = readFileSync(join(outdir, modules[0]), "utf8");
  if (!/export\s*\{[^}]*AiChatDailySpendCap[^}]*default[^}]*\}/s.test(emitted)) {
    throw new Error("dry-run entry does not export both AiChatDailySpendCap and default");
  }
  if (!emitted.includes("__zfb_cf_adapter_als__")) {
    throw new Error("dry-run entry does not contain the generated adapter handler graph");
  }
  if (!emitted.includes("daily_admission_counter")) {
    throw new Error("dry-run entry does not contain the SQLite Durable Object graph");
  }

  console.log(`verified dry-run module: ${modules[0]}`);
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
