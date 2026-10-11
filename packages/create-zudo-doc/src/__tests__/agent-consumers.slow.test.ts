/** Packed-package, generated-consumer proof for static export and Cloudflare MCP. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { scaffold } from "../scaffold.js";
import type { UserChoices } from "../prompts.js";
import { installScaffoldedDeps, overrideWithLocalZudoDoc, runOrThrow } from "./slow-build-helpers.js";

const choices = (projectName: string, features: string[], defaultLang = "en", additionalLangs: string[] = []): UserChoices => ({
  projectName, features, defaultLang,
  ...(additionalLangs.length ? { additionalLangs } : {}),
  colorSchemeMode: "single", singleScheme: "Default Dark", packageManager: "pnpm",
  ...(features.includes("mcp") ? { mcpDeploy: "cloudflare" as const } : {}),
});

let root: string;
let originalCwd: string;
let worker: ChildProcess | undefined;
let workerLog = "";
let referencePromise: Promise<string> | undefined;
let adoptionZudoDocTarball: string;
const dir = (name: string) => path.join(root, name);

async function build(name: string, features: string[], defaultLang = "en", additionalLangs: string[] = [], base = ""): Promise<string> {
  await scaffold(choices(name, features, defaultLang, additionalLangs));
  const project = dir(name);
  if (base) {
    const configPath = path.join(project, "zfb.config.ts");
    const config = await fs.readFile(configPath, "utf8");
    expect(config).toContain("zudoDoc({");
    await fs.writeFile(configPath, config.replace("zudoDoc({", `zudoDoc({\n    base: "${base}",`));
  }
  if (features.includes("agentExport")) {
    const docs = path.join(project, "src/content/docs");
    await fs.outputFile(path.join(docs, "agent-proof.mdx"), `---\ntitle: Agent Proof\n---\n\nThe generated consumer contains the violet platypus marker.\n\n## Example\n\nUse \`<Widget />\` literally. [Source link](./agent-proof.mdx#example).\n`);
    for (const [flag, value] of [["draft", "true"], ["unlisted", "true"], ["search_exclude", "true"]]) {
      await fs.outputFile(path.join(docs, `excluded-${flag}.mdx`), `---\ntitle: Excluded ${flag}\n${flag}: ${value}\n---\n\nsecret-${flag}-marker\n`);
    }
  }
  // This project is already outside the repository workspace. Let pnpm read
  // its own pnpm-workspace.yaml, including the approved binary build scripts.
  installScaffoldedDeps(project, false);
  overrideWithLocalZudoDoc(project, false);
  runOrThrow("pnpm build", project, { SKIP_DOC_HISTORY: "1" });
  return project;
}

async function artifacts(project: string, prefix = ""): Promise<{ manifest: any; index: any; output: string }> {
  const output = path.join(project, "dist", prefix, "agent/v1");
  const manifest = await fs.readJson(path.join(output, "manifest.json"));
  const index = await fs.readJson(path.join(output, "search-index.json"));
  expect(manifest.schemaVersion).toBe(1);
  expect(index.fingerprint).toBe(manifest.fingerprint);
  for (const item of manifest.items) {
    expect(await fs.pathExists(path.join(output, "items", `${item.key}.json`))).toBe(true);
  }
  return { manifest, index, output };
}

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local port");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

async function startWorker(project: string, base = "/manual"): Promise<string> {
  workerLog = "";
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  worker = spawn("pnpm", ["preview:worker", "--ip", "127.0.0.1", "--port", String(port)], {
    cwd: project, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout?.on("data", (chunk: Buffer) => { workerLog += chunk.toString(); });
  worker.stderr?.on("data", (chunk: Buffer) => { workerLog += chunk.toString(); });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (worker.exitCode !== null) throw new Error(`Wrangler exited early: ${workerLog}`);
    try {
      const response = await fetch(`${origin}${base}/agent/v1/manifest.json`);
      if (response.ok) return origin;
    } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Wrangler did not start: ${workerLog}`);
}

async function stopWorker(): Promise<void> {
  if (!worker?.pid) return;
  try { process.kill(-worker.pid, "SIGTERM"); } catch { /* already exited */ }
  await Promise.race([
    new Promise<void>((resolve) => worker!.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);
  try { process.kill(-worker.pid, "SIGKILL"); } catch { /* already exited */ }
  worker = undefined;
}

// The reference helper must come from the packed candidate initializer, not
// npm's identically versioned but older 5.28.2 release or workspace source.
async function adoptionReference(): Promise<string> {
  const initializer = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const packDir = dir("initializer-pack");
  await fs.ensureDir(packDir);
  // Unlike zudo-doc, the initializer has no prepare/prepack build hook.
  // Cold slow-test jobs must pack the current CLI/API, not absent or stale dist.
  runOrThrow("pnpm build", initializer);
  runOrThrow(`pnpm pack --pack-destination "${packDir}"`, initializer);
  const tarballs = (await fs.readdir(packDir)).filter((name) => name.endsWith(".tgz"));
  expect(tarballs).toHaveLength(1);
  const tools = dir("reference-tools");
  await fs.outputJson(path.join(tools, "package.json"), {
    private: true,
    dependencies: { "create-zudo-doc": `file:${path.join(packDir, tarballs[0]!)}` },
  });
  installScaffoldedDeps(tools, false);
  runOrThrow("pnpm exec create-zudo-doc ../mcp-reference --mcp --mcp-deploy cloudflare --yes", tools);
  const reference = dir("mcp-reference");
  const referencePkg = await fs.readJson(path.join(reference, "package.json"));
  const candidatePkg = await fs.readJson(path.join(initializer, "../zudo-doc/package.json"));
  // The scaffold intentionally emits a caret range; candidate installation
  // below replaces that range with the packed artifact, never npm's release.
  expect(referencePkg.dependencies["@takazudo/zudo-doc"]).toBe(`^${candidatePkg.version}`);
  const docPackDir = dir("documentation-pack");
  await fs.ensureDir(docPackDir);
  runOrThrow(`pnpm pack --pack-destination "${docPackDir}"`, path.join(initializer, "../zudo-doc"));
  const docTarballs = (await fs.readdir(docPackDir)).filter((name) => name.endsWith(".tgz"));
  expect(docTarballs).toHaveLength(1);
  adoptionZudoDocTarball = path.join(docPackDir, docTarballs[0]!);
  return reference;
}

async function assertLocalAssets(origin: string, base: string, proof: any): Promise<void> {
  // Use the returned canonical citation's actual path on the local origin.
  const citation = new URL(proof.url);
  expect(citation.origin).toBe("https://docs.example.test");
  expect(citation.pathname).toBe(`${base}/docs/agent-proof`);
  const page = await fetch(new URL(citation.pathname, origin));
  expect(page.status).toBe(200);
  const html = await page.text();
  const resourceTags = html.match(/<(?:script|link)\b[^>]*>/g)?.join("\n") ?? "";
  // minifyHtml is enabled by default and can remove optional attribute quotes.
  // Read either legal serialization while retaining the required JS/CSS checks.
  const assets = [...resourceTags.matchAll(/\s(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)]
    .map((match) => new URL(match[1] ?? match[2] ?? match[3]!, page.url))
    .filter((asset) => /\.(?:js|css)$/.test(asset.pathname));
  expect(assets.some((asset) => asset.pathname.endsWith(".js")), resourceTags).toBe(true);
  expect(assets.some((asset) => asset.pathname.endsWith(".css")), resourceTags).toBe(true);
  for (const asset of assets) {
    expect(asset.origin).toBe(origin);
    expect(asset.pathname.startsWith(`${base}/`)).toBe(true);
    expect((await fetch(asset)).status).toBe(200);
  }
}

beforeAll(async () => {
  originalCwd = process.cwd();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "zudo-agent-consumers-"));
  process.chdir(root);
  await build("static-en", ["agentExport", "llmsTxt"], "en", ["ja"]);
  await build("static-ja", ["agentExport", "llmsTxt"], "ja");
  await build("mcp-manual", ["agentExport", "llmsTxt", "mcp"], "en", ["ja"], "/manual");
}, 20 * 60 * 1000);

afterAll(async () => {
  await stopWorker();
  process.chdir(originalCwd);
  if (root) await fs.remove(root);
});

describe("packed generated agent consumers", () => {
  it("keeps static-only builds portable and excludes unpublished pages", async () => {
    const project = dir("static-en");
    const pkg = await fs.readJson(path.join(project, "package.json"));
    expect(pkg.dependencies["@modelcontextprotocol/sdk"]).toBeUndefined();
    expect(pkg.dependencies["@takazudo/zfb-adapter-cloudflare"]).toBeUndefined();
    expect(await fs.pathExists(path.join(project, "node_modules/@modelcontextprotocol/sdk"))).toBe(false);
    expect(await fs.pathExists(path.join(project, "dist/_worker.js"))).toBe(false);
    const { manifest, index, output } = await artifacts(project);
    expect(manifest.documents.some((document: any) => document.locale === "ja")).toBe(true);
    expect(index.items.some((item: any) => item.text.includes("violet platypus marker"))).toBe(true);
    const serialized = JSON.stringify({ manifest, index });
    for (const flag of ["draft", "unlisted", "search_exclude"]) {
      expect(serialized).not.toContain(`excluded-${flag}`);
      expect(serialized).not.toContain(`secret-${flag}-marker`);
    }
    expect(await fs.readFile(path.join(output, "pages", `${manifest.documents.find((document: any) => document.title === "Agent Proof").key}.md`), "utf8")).toContain("violet platypus marker");
    const proofText = index.items.find((item: any) => item.title === "Agent Proof").text;
    expect(proofText).toContain("`<Widget />`");
    expect(proofText).toContain("[Source link](/docs/agent-proof#example)");
    expect(await fs.readFile(path.join(project, "dist/llms.txt"), "utf8")).toContain("agent");
  });

  it("uses the actual JA default locale for IDs and canonical routes", async () => {
    const { manifest } = await artifacts(dir("static-ja"));
    expect(manifest.defaultLocale).toBe("ja");
    const proof = manifest.documents.find((document: any) => document.title === "Agent Proof");
    expect(proof.locale).toBe("ja");
    expect(proof.url).toContain("/docs/agent-proof");
    expect(proof.url).not.toContain("/ja/docs/");
  });

  it("serves its own docs and MCP tools from the local Cloudflare runtime", async () => {
    const project = dir("mcp-manual");
    const { manifest } = await artifacts(project, "manual");
    expect(manifest.documents.some((document: any) => document.locale === "ja" && document.url.includes("/manual/ja/docs/"))).toBe(true);
    const origin = await startWorker(project);
    try {
      const htmlResponse = await fetch(`${origin}/manual/docs/agent-proof/`);
      if (htmlResponse.status !== 200) {
        const paths = (await fs.readdir(path.join(project, "dist"), { recursive: true }))
          .filter((file) => typeof file === "string" && file.endsWith(".html"))
          .filter((file) => file.includes("agent-proof"));
        throw new Error(`Expected /manual/docs/agent-proof/ HTML 200, got ${htmlResponse.status}; emitted HTML: ${JSON.stringify(paths)}`);
      }
      expect((await fetch(`${origin}/manual/agent/v1/manifest.json`)).status).toBe(200);
      const proof = manifest.documents.find((document: any) => document.title === "Agent Proof");
      expect((await fetch(`${origin}${proof.markdownUrl}`)).status).toBe(200);
      expect((await fetch(`${origin}/manual/llms.txt`)).status).toBe(200);
      const endpoint = `${origin}/manual/mcp`;
      const client = new Client({ name: "packed-consumer-test", version: "1.0.0" });
      const transport = new StreamableHTTPClientTransport(new URL(endpoint));
      await client.connect(transport);
      try {
        expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual(["fetch", "search"]);
        const found = await client.callTool({ name: "search", arguments: { query: "violet platypus" } });
        const results = (found.structuredContent as any).results;
        expect(results.length).toBeGreaterThan(0);
        const fetched = await client.callTool({ name: "fetch", arguments: { id: results[0].id } });
        expect(JSON.stringify(fetched.structuredContent)).toContain("violet platypus marker");
        expect((fetched.structuredContent as any).text).toContain("`<Widget />`");
        expect((fetched.structuredContent as any).text).toContain("[Source link](/manual/docs/agent-proof#example)");
        expect((await client.callTool({ name: "fetch", arguments: { id: "unknown-id" } })).isError).toBe(true);
      } finally { await client.close(); }
      const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
      for (const body of [
        { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "legacy-test", version: "1" } } },
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search", arguments: { query: "violet platypus" } } },
      ]) {
        const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
        expect(response.status).toBe(200);
        expect(response.headers.get("mcp-session-id")).toBeNull();
        if (body.method === "tools/call") {
          const payload = await response.json() as any;
          expect(payload.result.structuredContent.results.length).toBeGreaterThan(0);
        }
      }
      expect((await fetch(endpoint, { method: "GET" })).status).toBe(405);
      expect((await fetch(endpoint, { method: "OPTIONS" })).status).toBe(204);
      expect((await fetch(`${origin}/mcp`, { method: "POST", headers, body: "{}" })).status).toBe(404);
    } finally { await stopWorker(); }
  }, 60_000);

  it.each(["", "/manual"])("adopts and removes MCP in an existing static consumer at base %j", async (base) => {
    const name = base ? "adopt-manual" : "adopt-root";
    const project = await build(name, ["agentExport", "llmsTxt"], "en", ["ja"], base);
    const configPath = path.join(project, "zfb.config.ts");
    const packagePath = path.join(project, "package.json");
    const authoredConfig = (await fs.readFile(configPath, "utf8"))
      .replace("zudoDoc({", 'zudoDoc({\n    siteUrl: "https://docs.example.test",');
    await fs.writeFile(configPath, authoredConfig);
    await fs.outputFile(path.join(project, "src/content/docs-ja/agent-proof.mdx"),
      "---\ntitle: 日本語の検証\n---\n\n紫色のカモノハシの設定を検証します。\n");
    // An authored build suffix must survive adoption and removal, and run
    // before staging so its output is also reachable below /manual.
    await fs.outputFile(path.join(project, "scripts/postbuild.mjs"),
      'import { writeFileSync } from "node:fs";\nwriteFileSync("dist/authored-postbuild.txt", "preserved");\n');
    const pkg = await fs.readJson(packagePath);
    const originalScripts = { ...pkg.scripts, build: `${pkg.scripts.build} && node scripts/postbuild.mjs` };
    pkg.scripts = { ...originalScripts };
    await fs.writeJson(packagePath, pkg, { spaces: 2 });
    runOrThrow("pnpm build", project, { SKIP_DOC_HISTORY: "1" });
    const originalArtifacts = await artifacts(project, base.slice(1));
    expect(originalArtifacts.manifest.site.base).toBe(base || "/");

    const reference = await (referencePromise ??= adoptionReference());
    // Keep this tarball until teardown; the older helper deletes its temporary
    // tarball after install, so its file spec cannot support later reinstalls.
    pkg.dependencies["@takazudo/zudo-doc"] = `file:${adoptionZudoDocTarball}`;
    const referencePkg = await fs.readJson(path.join(reference, "package.json"));
    for (const dependency of ["@modelcontextprotocol/sdk", "@takazudo/zfb-adapter-cloudflare"]) {
      pkg.dependencies[dependency] = referencePkg.dependencies[dependency];
    }
    pkg.devDependencies.wrangler = referencePkg.devDependencies.wrangler;
    pkg.scripts = {
      ...originalScripts,
      build: `${originalScripts.build} && node scripts/stage-cloudflare-base.mjs`,
      "preview:worker": "wrangler dev",
      deploy: "pnpm build && wrangler deploy",
    };
    await fs.writeJson(packagePath, pkg, { spaces: 2 });
    await fs.writeFile(configPath, authoredConfig.replace("zudoDoc({",
      'zudoDoc({\n    mcp: true,\n    adapter: "@takazudo/zfb-adapter-cloudflare",'));
    await fs.copy(path.join(reference, "scripts/stage-cloudflare-base.mjs"),
      path.join(project, "scripts/stage-cloudflare-base.mjs"), { overwrite: false, errorOnExist: true });
    const wrangler = await fs.readJson(path.join(reference, "wrangler.jsonc"));
    wrangler.name = name;
    await fs.writeJson(path.join(project, "wrangler.jsonc"), wrangler, { spaces: 2 });
    const originalIgnore = await fs.readFile(path.join(project, ".gitignore"), "utf8");
    await fs.writeFile(path.join(project, ".gitignore"), `${originalIgnore}\n.wrangler/\n`);
    installScaffoldedDeps(project, false);

    // Positive omission control: the adapter build succeeds but prerendered
    // HTML is flat, so literal Wrangler assets lack the base-prefixed page.
    runOrThrow(`pnpm exec ${originalScripts.build}`, project, { SKIP_DOC_HISTORY: "1" });
    expect(await fs.pathExists(path.join(project, "dist/docs/agent-proof/index.html"))).toBe(true);
    if (base) {
      expect(await fs.pathExists(path.join(project, "dist/manual/docs/agent-proof/index.html"))).toBe(false);
    }
    runOrThrow("pnpm build", project, { SKIP_DOC_HISTORY: "1" });
    const { manifest } = await artifacts(project, base.slice(1));
    expect(manifest.site).toEqual(originalArtifacts.manifest.site);
    const origin = await startWorker(project, base);
    try {
      const proof = manifest.documents.find((document: any) => document.title === "Agent Proof");
      await assertLocalAssets(origin, base, proof);
      expect(await (await fetch(`${origin}${base}/authored-postbuild.txt`)).text()).toBe("preserved");
      for (const url of [`${base}/llms.txt`, `${base}/agent/v1/manifest.json`, manifest.searchIndex.url,
        proof.markdownUrl, manifest.items.find((item: any) => item.pageId === proof.id).artifactUrl]) {
        expect((await fetch(new URL(new URL(url, origin).pathname, origin))).status).toBe(200);
      }
      const client = new Client({ name: "existing-consumer-recipe", version: "1.0.0" });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}${base}/mcp`)));
      try {
        expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual(["fetch", "search"]);
        for (const [query, marker, locale] of [
          ["violet platypus", "violet platypus marker", "en"],
          ["紫色のカモノハシ", "紫色のカモノハシ", "ja"],
        ]) {
          const found = await client.callTool({ name: "search", arguments: { query } });
          const results = (found.structuredContent as any).results;
          const match = results.find((result: any) => manifest.documents.some((document: any) =>
            document.locale === locale && document.itemIds.includes(result.id)));
          expect(match).toBeDefined();
          const fetched = await client.callTool({ name: "fetch", arguments: { id: match.id } });
          const item = fetched.structuredContent as any;
          expect(item.text).toContain(marker);
          expect(item.metadata.locale).toBe(locale);
          expect(item.url).toBe(match.url);
          const citation = new URL(item.url);
          expect(citation.origin).toBe("https://docs.example.test");
          expect(citation.pathname.startsWith(`${base}/${locale === "ja" ? "ja/" : ""}docs/`)).toBe(true);
          expect((await fetch(new URL(citation.pathname, origin))).status).toBe(200);
        }
      } finally { await client.close(); }
    } finally { await stopWorker(); }

    // The MCP-only pieces are removed; authored config/scripts/content and
    // the packed documentation dependency remain, including static export.
    await fs.writeFile(configPath, authoredConfig);
    pkg.scripts = { ...originalScripts };
    for (const dependency of ["@modelcontextprotocol/sdk", "@takazudo/zfb-adapter-cloudflare"]) {
      delete pkg.dependencies[dependency];
    }
    delete pkg.devDependencies.wrangler;
    await fs.writeJson(packagePath, pkg, { spaces: 2 });
    await fs.remove(path.join(project, "wrangler.jsonc"));
    await fs.remove(path.join(project, "scripts/stage-cloudflare-base.mjs"));
    await fs.writeFile(path.join(project, ".gitignore"), originalIgnore);
    installScaffoldedDeps(project, false);
    runOrThrow("pnpm build", project, { SKIP_DOC_HISTORY: "1" });
    const restored = await artifacts(project, base.slice(1));
    expect(restored.manifest).toEqual(manifest);
    expect(await fs.readFile(configPath, "utf8")).toBe(authoredConfig);
    expect((await fs.readJson(packagePath)).scripts).toEqual(originalScripts);
    expect(await fs.readFile(path.join(project, "dist/authored-postbuild.txt"), "utf8")).toBe("preserved");
    expect(await fs.pathExists(path.join(project, "dist/_worker.js"))).toBe(false);
    expect(await fs.pathExists(path.join(project, "dist", base.slice(1), "mcp"))).toBe(false);
    for (const dependency of ["@modelcontextprotocol/sdk", "@takazudo/zfb-adapter-cloudflare", "wrangler"]) {
      expect(await fs.pathExists(path.join(project, "node_modules", dependency))).toBe(false);
    }
    expect(await fs.pathExists(path.join(restored.output, "pages",
      `${restored.manifest.documents.find((document: any) => document.title === "Agent Proof").key}.md`))).toBe(true);
    expect(await fs.pathExists(path.join(project, "dist", base.slice(1), "llms.txt"))).toBe(true);
  }, 20 * 60 * 1000);

});
