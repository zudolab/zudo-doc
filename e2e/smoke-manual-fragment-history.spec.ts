/** Real isolated packed consumer; uses the existing non-root mount contract. */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, expect } from "./fixtures";
import { registerFragmentHistoryTests } from "./fragment-history-helpers";

// One install/build per file worker, then all six EN/JA contracts share the
// immutable consumer output. This remains in the blocking smoke browser lane.
test.describe.configure({ mode: "default" });
let temp: string;
let server: ChildProcess | undefined;
let origin = "";
const root = path.resolve(import.meta.dirname, "..");
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(180_000);
  temp = mkdtempSync(path.join(tmpdir(), "zudo-fragment-consumer-"));
  const consumer = path.join(temp, "consumer");
  mkdirSync(consumer);
  const tarballs: Record<string, { path: string; sha256: string }> = {};
  for (const name of ["doc-history-server", "zudo-doc"]) {
    const source = path.join(root, "packages", name);
    const snapshot = path.join(temp, name);
    mkdirSync(snapshot);
    const manifest = JSON.parse(readFileSync(path.join(source, "package.json"), "utf8"));
    // Pack immutable already-built public files, with no lifecycle capable of
    // rebuilding shared dist (npm 10 runs prepare even with --ignore-scripts).
    for (const file of manifest.files as string[]) {
      if (existsSync(path.join(source, file))) cpSync(path.join(source, file), path.join(snapshot, file), { recursive: true });
    }
    delete manifest.scripts;
    writeFileSync(path.join(snapshot, "package.json"), JSON.stringify(manifest));
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts"], { cwd: snapshot, encoding: "utf8" })) as { filename: string }[];
    const tarball = path.join(snapshot, packed[0]!.filename);
    tarballs[manifest.name] = { path: tarball, sha256: hash(tarball) };
  }
  const rootManifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const dependencies: Record<string, string> = {};
  for (const name of ["@takazudo/zfb", "@takazudo/zfb-runtime", "@takazudo/zfb-md-wasm", "zod"]) dependencies[name] = rootManifest.dependencies[name];
  for (const [name, tarball] of Object.entries(tarballs)) dependencies[name] = `file:${tarball.path}`;
  writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "fragment-history-consumer", private: true, type: "module", dependencies, pnpm: { overrides: dependencies } }));
  cpSync(path.join(root, ".npmrc"), path.join(consumer, ".npmrc"));
  for (const locale of ["en", "ja"]) {
    const directory = locale === "en" ? "docs" : "docs-ja";
    const target = path.join(consumer, "src/content", directory);
    mkdirSync(target, { recursive: true });
    for (const page of ["a", "b"]) {
      const filename = `router-fragment-${page}.mdx`;
      const content = readFileSync(path.join(root, "e2e/fixtures/smoke/src/content", directory, filename), "utf8");
      writeFileSync(path.join(target, filename), content.replaceAll("](/", "](/manual/"));
    }
    writeFileSync(path.join(target, "getting-started.mdx"), "---\ntitle: Getting Started\n---\n\nConsumer mount control.\n");
  }
  writeFileSync(path.join(consumer, "tsconfig.json"), JSON.stringify({ extends: "@takazudo/zudo-doc/tsconfig.base.json", include: ["src", "zfb.config.ts"] }));
  writeFileSync(path.join(consumer, "zfb.config.ts"), `import { defineConfig } from "@takazudo/zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
export default defineConfig(
  zudoDoc({
    siteName: "Fragment history consumer",
    locales: { ja: { label: "JA", dir: "src/content/docs-ja" } },
    dynamicPageTransition: true,
    mermaid: false,
    math: false,
    designTokenPanel: false,
    docHistory: false,
    sitemap: false,
  }),
);
`);
  const run = (command: string, args: string[]) => execFileSync(command, args, { cwd: consumer, encoding: "utf8", timeout: 120_000, env: { ...process.env, INIT_CWD: consumer, SKIP_DOC_HISTORY: "1" } });
  run("pnpm", ["install"]);
  const lock = hash(path.join(consumer, "pnpm-lock.yaml"));
  run("pnpm", ["install", "--frozen-lockfile"]);
  expect(hash(path.join(consumer, "pnpm-lock.yaml"))).toBe(lock);
  run("pnpm", ["install"]);
  expect(hash(path.join(consumer, "pnpm-lock.yaml"))).toBe(lock);
  const realpaths = Object.fromEntries(Object.keys(dependencies).map((name) => [name, realpathSync(path.join(consumer, "node_modules", name))]));
  for (const resolved of Object.values(realpaths)) expect(resolved.startsWith(consumer + path.sep)).toBe(true);
  const docroot = path.join(temp, "mounted");
  run(process.execPath, [path.join(root, "scripts/zfb3-parity/installed-consumer/build-mount-control.mjs"), consumer, "/manual", docroot]);
  await testInfo.attach("installed-consumer-provenance", { body: JSON.stringify({ sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), tarballs, lockSha256: lock, realpaths }, null, 2), contentType: "application/json" });
  const probe = createServer();
  const port = await new Promise<number>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") throw new Error("missing port");
      probe.close(() => resolve(address.port));
    });
  });
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(root, "scripts/zfb3-parity/installed-consumer/static-mount-server.mjs"), docroot, String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("mount server did not become ready")), 10_000);
    server!.once("error", reject);
    server!.once("exit", (code) => reject(new Error(`mount server exited: ${code}`)));
    server!.stdout!.once("data", () => { clearTimeout(timeout); resolve(); });
  });
});

test.afterAll(async () => {
  if (server && server.exitCode === null) {
    const stopped = new Promise<void>((resolve) => server!.once("exit", () => resolve()));
    server.kill("SIGTERM");
    await stopped;
  }
  if (temp) rmSync(temp, { recursive: true, force: true });
});

registerFragmentHistoryTests("/manual", () => origin);
