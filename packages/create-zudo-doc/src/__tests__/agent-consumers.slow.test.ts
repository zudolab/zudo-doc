/** Packed-package, generated-consumer proof for static export and Cloudflare MCP. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import net from "node:net";
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
    await fs.outputFile(path.join(docs, "agent-proof.mdx"), `---\ntitle: Agent Proof\n---\n\nThe generated consumer contains the violet platypus marker.\n`);
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

async function startWorker(project: string): Promise<string> {
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
      const response = await fetch(`${origin}/manual/agent/v1/manifest.json`);
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
});
