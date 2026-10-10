// Point a create-zudo-doc consumer at the candidate tarballs and add the nested
// sidebar fixture the 06R checks need (#4509 / #4475).
// Usage: node prepare-consumer.mjs <consumerDir> <tarballDir>
// Everything except @takazudo/zudo-doc and @takazudo/zudo-doc-history-server
// still resolves from the public registry.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [consumerArg, tarballArg] = process.argv.slice(2);
if (!consumerArg || !tarballArg) {
  console.error("usage: prepare-consumer.mjs <consumerDir> <tarballDir>");
  process.exit(2);
}
const consumer = path.resolve(consumerArg);
const tarballDir = path.resolve(tarballArg);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

if (consumer.startsWith(repoRoot + path.sep) || tarballDir.startsWith(repoRoot + path.sep)) {
  throw new Error("consumer and tarballs must live outside the repository");
}

const tarballs = readdirSync(tarballDir).filter((f) => f.endsWith(".tgz"));
const pick = (prefix) => {
  const hit = tarballs.filter((f) => f.startsWith(prefix) && /^\d/.test(f.slice(prefix.length)));
  if (hit.length !== 1) throw new Error(`expected one ${prefix}*.tgz in ${tarballDir}, got ${hit.join(", ") || "none"}`);
  return `file:${path.join(tarballDir, hit[0])}`;
};
const zudoDoc = pick("takazudo-zudo-doc-");
const historyServer = pick("takazudo-zudo-doc-history-server-");

const pkgPath = path.join(consumer, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.dependencies["@takazudo/zudo-doc"] = zudoDoc;
if (pkg.dependencies["@takazudo/zudo-doc-history-server"]) {
  pkg.dependencies["@takazudo/zudo-doc-history-server"] = historyServer;
}
// Overrides also pin transitive/peer resolutions, so a registry copy of the
// same version number (5.28.2 is already published) can never win.
pkg.pnpm = {
  ...(pkg.pnpm ?? {}),
  overrides: {
    ...(pkg.pnpm?.overrides ?? {}),
    "@takazudo/zudo-doc": zudoDoc,
    "@takazudo/zudo-doc-history-server": historyServer,
  },
};
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// Generated content is one flat category; Broaden/Restore and branch focus
// need a configured nested tree, so reuse the e2e sidebar fixture's guides.
const guidesSrc = path.join(repoRoot, "e2e/fixtures/sidebar/src/content/docs/guides");
const guidesDst = path.join(consumer, "src/content/docs/guides");
if (!existsSync(guidesDst)) cpSync(guidesSrc, guidesDst, { recursive: true });

const configPath = path.join(consumer, "zfb.config.ts");
let config = readFileSync(configPath, "utf8");
if (!config.includes('categoryMatch: "guides"')) {
  const anchor = 'categoryMatch: "getting-started",\n      },';
  if (!config.includes(anchor)) throw new Error("headerNav anchor not found in zfb.config.ts");
  config = config.replace(
    anchor,
    `${anchor}\n      {\n        label: "Guides",\n        path: "/docs/guides",\n        categoryMatch: "guides",\n      },`,
  );
  writeFileSync(configPath, config);
}

const git = (...args) => execFileSync("git", args, { cwd: consumer, stdio: "pipe" }).toString();
if (existsSync(path.join(consumer, ".git")) && git("status", "--porcelain").trim()) {
  git("add", "-A");
  git("-c", "user.name=installed-consumer", "-c", "user.email=installed-consumer@example.invalid",
    "commit", "-q", "-m", "test: candidate tarballs and nested sidebar fixture");
}
console.log(JSON.stringify({ consumer, zudoDoc, historyServer: pkg.dependencies["@takazudo/zudo-doc-history-server"] ? historyServer : "(not a dependency; override only)" }, null, 2));
