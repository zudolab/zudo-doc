import { createHash } from "node:crypto";
import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";
import type { UserChoices } from "../prompts.js";
import { capitalize, pmRunCommand } from "../utils.js";

// zfb writes prerendered routes and bundle assets flat under dist even when
// `base` prefixes their URLs. Wrangler serves dist literally, so a site and
// MCP endpoint mounted below the origin need these files at dist/<base>/.
// The agent exporter and public copier already write there; snapshot only the
// remaining flat files before copying so the step is safe to repeat.
const stageCloudflareBaseScript = `import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
function findManifests(dir, found = []) {
  const candidate = path.join(dir, "agent", "v1", "manifest.json");
  if (existsSync(candidate)) found.push(candidate);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "agent") findManifests(path.join(dir, entry.name), found);
  }
  return found;
}
const manifests = findManifests(dist);
if (manifests.length !== 1) throw new Error("Expected one agent/v1/manifest.json in dist");
const base = JSON.parse(readFileSync(manifests[0], "utf8")).site?.base;
if (typeof base !== "string" || !base.startsWith("/") || base.includes("\\\\")) {
  throw new Error("Invalid agent manifest site.base");
}
const segments = base.split("/").filter(Boolean);
if (segments.some((segment) => segment === "." || segment === "..")) {
  throw new Error("Invalid agent manifest site.base");
}
if (segments.length) {
  const target = path.join(dist, ...segments);
  const files = [];
  function collect(dir) {
    if (dir === target) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (dir === dist && ["_worker.js", "_zfb_inner.mjs", "__zfb", ".assetsignore"].includes(entry.name)) continue;
      const source = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(source);
      else files.push(path.relative(dist, source));
    }
  }
  collect(dist);
  for (const rel of files) {
    const destination = path.join(target, rel);
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(path.join(dist, rel), destination, { force: true });
  }
}
`;

const wranglerConfig = (choices: UserChoices): string =>
  JSON.stringify(
    {
      $schema: "./node_modules/wrangler/config-schema.json",
      name: cloudflareWorkerName(choices.projectName),
      main: "./dist/_worker.js",
      compatibility_date: "2024-12-01",
      compatibility_flags: ["nodejs_compat"],
      assets: {
        directory: "./dist",
        binding: "ASSETS",
        not_found_handling: "404-page",
        run_worker_first: false,
      },
    },
    null,
    2,
  ) + "\n";

function cloudflareWorkerName(projectName: string): string {
  const normalized = projectName
    .replace(/[._]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized.length <= 63) return normalized;

  const suffix = createHash("sha256")
    .update(projectName)
    .digest("hex")
    .slice(0, 8);
  const prefix = normalized.slice(0, 54).replace(/-+$/g, "");
  return prefix + "-" + suffix;
}

function generateMcpReadme(choices: UserChoices): string {
  const siteName = capitalize(choices.projectName.replace(/-/g, " "));
  const build = pmRunCommand(choices.packageManager, "build");
  const verify = pmRunCommand(choices.packageManager, "preview:worker");
  const deploy = pmRunCommand(choices.packageManager, "deploy");

  return [
    "# " + siteName,
    "",
    "Documentation site generated with the zudo-doc framework.",
    "",
    "## Cloudflare MCP deployment",
    "",
    "This project enables the read-only <code>search</code> and <code>fetch</code> MCP tools for the current published documentation. It also builds the static agent documentation feed under <code>/agent/v1/</code> relative to the configured site base; that feed can be published separately as static files.",
    "",
    "Wrangler uses a DNS-safe Worker name derived from the project name; dots and underscores become dashes, and names longer than 63 characters receive a short stable suffix.",
    "",
    "### Build and verify locally",
    "",
    "Install dependencies, then build the site and agent feed:",
    "",
    "    " + choices.packageManager + " install",
    "    " + build,
    "",
    "When <code>base</code> is a non-root path, the build stages the prerendered pages, llms files, and browser assets under that path for Wrangler. The Worker entry remains at <code>dist/_worker.js</code>.",
    "",
    "Run the built Worker locally with Wrangler:",
    "",
    "    " + verify,
    "",
    "Wrangler's local Worker runtime serves the generated site and MCP route without Cloudflare credentials. Use the URL printed by Wrangler to verify the site before deployment.",
    "",
    "### Deploy to your Cloudflare account",
    "",
    "Set the public canonical origin in the zfb.config.ts file before deploying. For a site hosted at https://docs.example.com, add <code>siteUrl: \"https://docs.example.com\"</code> inside <code>zudoDoc({ ... })</code>. If the site is hosted below an origin path, set its <code>base</code> separately; the MCP URL combines the origin, base, and <code>/mcp</code>.",
    "",
    "Authenticate Wrangler with the Cloudflare account that should own this Worker, then deploy explicitly:",
    "",
    "    wrangler login",
    "    " + deploy,
    "",
    "Scaffolding and building do not log in or deploy. The deploy command publishes this project to the Cloudflare account selected by Wrangler.",
    "",
    "### Connect an MCP client",
    "",
    "Connect a client that supports Streamable HTTP to:",
    "",
    "    <siteUrl><base>/mcp",
    "",
    "For a root-hosted site, this is https://docs.example.com/mcp. For a site with <code>base: \"/manual\"</code>, it is https://docs.example.com/manual/mcp. Set <code>siteUrl</code> to the stable public canonical origin so search and fetch results cite correct human-readable URLs. Connecting a ChatGPT MCP client is a separate owner-controlled step.",
    "",
    "## Public documentation only",
    "",
    "The MCP endpoint and static agent feed expose public documentation included in the build. The package's draft, unlisted, and <code>search_exclude</code> rules apply to the generated corpus. <code>robots.txt</code>, <code>noindex</code>, and an unlisted flag are not authentication. Do not enable this feature for protected or private documentation. Cloudflare account setup, access controls, and any usage costs remain the site owner's responsibility.",
    "",
  ].join("\n");
}

/**
 * Optional Cloudflare Workers deployment files for the MCP feature.
 * Static agent-export-only projects do not select this module or gain any
 * provider dependencies/configuration.
 */
export const mcpFeature: FeatureModule = (choices) => ({
  name: "mcp",
  injections: [],
  postProcess: async (targetDir) => {
    await fs.outputFile(
      path.join(targetDir, "wrangler.jsonc"),
      wranglerConfig(choices),
    );
    await fs.outputFile(
      path.join(targetDir, "README.md"),
      generateMcpReadme(choices),
    );
    await fs.outputFile(
      path.join(targetDir, "scripts/stage-cloudflare-base.mjs"),
      stageCloudflareBaseScript,
    );
  },
});
