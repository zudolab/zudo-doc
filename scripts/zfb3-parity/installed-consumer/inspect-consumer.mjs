// Installed-consumer isolation, version and runtime-identity record (#4509).
// Usage: node inspect-consumer.mjs <consumerDir> <tarballDir> [--zdtp-ref <dir>] [--out <json>]
//   --zdtp-ref: dir holding extracted `npm pack @takazudo/zdtp@<v>` trees as
//   <dir>/<version>/package; used to fingerprint which zdtp copy the BUILT
//   dist bundles (string literals unique to one version).
// Exit 1 when any isolation/identity check fails.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const zdtpRef = flag("--zdtp-ref");
const out = flag("--out");
const [consumerArg, tarballArg] = args;
const consumer = path.resolve(consumerArg);
const tarballDir = path.resolve(tarballArg);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });

const lock = readFileSync(path.join(consumer, "pnpm-lock.yaml"), "utf8");
check("lockfile has no link: or workspace: protocol", !/\b(link|workspace):/.test(lock),
  (lock.match(/\b(link|workspace):[^\s,}]*/g) ?? []).slice(0, 5).join(" ") || "none");
check("lockfile never references the repository path", !lock.includes(repoRoot), repoRoot);

const sha = (file, algo) => createHash(algo).update(readFileSync(file)).digest(algo === "sha512" ? "base64" : "hex");
const tarballs = {};
for (const f of readdirSync(tarballDir).filter((n) => n.endsWith(".tgz"))) {
  const file = path.join(tarballDir, f);
  tarballs[f] = { sha256: sha(file, "sha256"), integrity: `sha512-${sha(file, "sha512")}` };
}
for (const [name, file] of [["@takazudo/zudo-doc", "takazudo-zudo-doc-5"], ["@takazudo/zudo-doc-history-server", "takazudo-zudo-doc-history-server-5"]]) {
  const entry = Object.entries(tarballs).find(([f]) => f.startsWith(file));
  const re = new RegExp(`'${name.replace("/", "\\/")}@file:[^']*':\\n\\s+resolution: \\{integrity: (\\S+), tarball: (file:[^}]+)\\}`);
  const m = lock.match(re);
  if (!m) {
    check(`${name} resolved from candidate tarball`, name.endsWith("history-server") && !lock.includes(`'${name}@`),
      m ? "" : "not in graph");
    continue;
  }
  const integrity = m[1].replace(/,$/, "");
  check(`${name} resolved from candidate tarball (lockfile integrity == tarball sha512)`,
    entry && integrity === entry[1].integrity, `${m[2].trim()} ${integrity}`);
}

// Walk the installed graph; nothing may resolve into the repository.
const ls = JSON.parse(execFileSync("pnpm", ["ls", "--json", "--depth", "Infinity"], { cwd: consumer, maxBuffer: 256 << 20 }).toString());
const bad = [];
const seen = new Set();
const walk = (deps) => {
  for (const [name, d] of Object.entries(deps ?? {})) {
    const key = `${name}@${d.version}@${d.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = d.path ?? "";
    if (p.startsWith(repoRoot) || /^(link|workspace):/.test(d.version ?? "")) bad.push(`${name} ${d.version} ${p}`);
    walk(d.dependencies);
  }
};
for (const root of ls) { walk(root.dependencies); walk(root.devDependencies); }
check("pnpm ls: no installed package path inside the repository or via link:/workspace:", bad.length === 0, bad.slice(0, 5).join("; ") || `${seen.size} nodes walked`);

const storeDirs = readdirSync(path.join(consumer, "node_modules/.pnpm"));
const copies = (prefix) => storeDirs.filter((d) => d.startsWith(prefix));
const pkgDir = (fromDir, name) => {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const cand = path.join(dir, "node_modules", name);
    if (existsSync(cand)) return realpathSync(cand);
    if (dir === path.dirname(dir)) return null;
  }
};
const version = (dir) => (dir ? JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version : null);

const rootZfb = pkgDir(consumer, "@takazudo/zfb");
const zudoDocDir = pkgDir(consumer, "@takazudo/zudo-doc");
const runtimeDir = pkgDir(consumer, "@takazudo/zfb-runtime");
const zfbFromZudoDoc = pkgDir(zudoDocDir, "@takazudo/zfb");
const zfbFromRuntime = pkgDir(runtimeDir, "@takazudo/zfb");
check("single @takazudo/zfb copy on disk (owns zudo-react)", copies("@takazudo+zfb@").length === 1, copies("@takazudo+zfb@").join(", "));
check("single @takazudo/zfb-runtime copy on disk", copies("@takazudo+zfb-runtime@").length === 1, copies("@takazudo+zfb-runtime@").join(", "));
check("zudo-doc and zfb-runtime resolve the consumer's own zfb/zudo-react (same realpath)",
  rootZfb && rootZfb === zfbFromZudoDoc && rootZfb === zfbFromRuntime,
  [rootZfb, zfbFromZudoDoc, zfbFromRuntime].map((p) => p && path.relative(consumer, p)).join(" | "));
check("installed @takazudo/zudo-doc lives in the consumer store", zudoDocDir?.startsWith(consumer), zudoDocDir && path.relative(consumer, zudoDocDir));

const zdtpCopies = copies("@takazudo+zdtp@");
const zdtpFromZudoDoc = pkgDir(zudoDocDir, "@takazudo/zdtp");
const zfbBin = path.join(consumer, "node_modules/.bin/zfb");
const versions = {
  pnpm: execFileSync("pnpm", ["--version"], { cwd: consumer }).toString().trim(),
  node: process.version,
  zfbCli: existsSync(zfbBin) ? execFileSync(zfbBin, ["--version"], { cwd: consumer }).toString().trim().split("\n")[0] : null,
  "@takazudo/zfb": version(rootZfb),
  "@takazudo/zfb-runtime": version(runtimeDir),
  "@takazudo/zfb-md-wasm": version(pkgDir(consumer, "@takazudo/zfb-md-wasm")),
  "@takazudo/zudo-doc": version(zudoDocDir),
  "@takazudo/zudo-doc-history-server": version(pkgDir(zudoDocDir, "@takazudo/zudo-doc-history-server")),
  "@takazudo/zdtp (consumer root)": version(pkgDir(consumer, "@takazudo/zdtp")),
  "@takazudo/zdtp (resolved from installed zudo-doc, i.e. what zdtp-loader imports)": version(zdtpFromZudoDoc),
  preact: version(pkgDir(consumer, "preact")),
  zfbFamilyStoreDirs: storeDirs.filter((d) => d.startsWith("@takazudo+zfb")),
  zdtpStoreDirs: zdtpCopies,
};
if (versions["@takazudo/zdtp (consumer root)"]) {
  check("single zdtp copy on disk, 0.8.6, and it is the one zudo-doc's loader resolves",
    zdtpCopies.length === 1 && versions["@takazudo/zdtp (consumer root)"] === "0.8.6" && zdtpFromZudoDoc === pkgDir(consumer, "@takazudo/zdtp"),
    `${zdtpCopies.join(", ")} -> ${zdtpFromZudoDoc && path.relative(consumer, zdtpFromZudoDoc)}`);
} else {
  check("no zdtp installed (designTokenPanel off)", zdtpCopies.length === 0 && !zdtpFromZudoDoc, zdtpCopies.join(", ") || "none");
}

// Built-dist fingerprint: which zdtp version's unique string literals appear.
let zdtpBundle = null;
const dist = path.join(consumer, "dist");
if (zdtpRef && existsSync(dist)) {
  const jsFiles = (dir) => readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? jsFiles(p) : n.endsWith(".js") ? [p] : [];
  });
  const literals = (files) => {
    const set = new Set();
    // Word-like quoted literals only (the restricted charset cannot span code),
    // so minified identifiers never become fingerprints.
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/(["'`])([A-Za-z][A-Za-z0-9 _\-.:\/%#,]{11,159})\1/g)) set.add(m[2]);
    }
    return set;
  };
  const refs = Object.fromEntries(readdirSync(zdtpRef).filter((v) => existsSync(path.join(zdtpRef, v, "package/dist")))
    .map((v) => [v, literals(jsFiles(path.join(zdtpRef, v, "package/dist")))]));
  const distFiles = jsFiles(dist);
  const distText = distFiles.map((f) => [f, readFileSync(f, "utf8")]);
  // Versions whose dist literal sets are identical cannot be told apart by a
  // bundle, so fingerprint per group of indistinguishable versions.
  const groups = [];
  for (const [v, set] of Object.entries(refs)) {
    const g = groups.find((x) => x.set.size === set.size && [...set].every((s) => x.set.has(s)));
    if (g) g.versions.push(v);
    else groups.push({ versions: [v], set });
  }
  zdtpBundle = { groups: [] };
  for (const g of groups) {
    const unique = [...g.set].filter((s) => groups.every((o) => o === g || !o.set.has(s)));
    const hits = unique.filter((s) => distText.some(([, t]) => t.includes(s)));
    const chunks = new Set(distText.filter(([, t]) => hits.some((s) => t.includes(s))).map(([f]) => path.relative(dist, f)));
    zdtpBundle.groups.push({ versions: g.versions, uniqueLiterals: unique.length, foundInDist: hits.length, chunks: [...chunks], sample: hits.slice(0, 3) });
  }
  const matched = zdtpBundle.groups.filter((g) => g.foundInDist > 0);
  zdtpBundle.bundledGroup = matched.length === 1 ? matched[0].versions : matched.map((g) => g.versions);
  check("built dist bundles exactly one zdtp copy, fingerprinted as 0.8.6's dist",
    matched.length === 1 && matched[0].versions.includes("0.8.6") && matched[0].foundInDist > 0,
    matched.map((g) => `${g.versions.join("=")}: ${g.foundInDist}/${g.uniqueLiterals} unique literals in ${g.chunks.join(", ")}`).join("; ") || "no version-unique literal found");
}

const report = { consumer, repoRoot, tarballs, versions, zdtpBundle, checks };
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}  -- ${c.detail}`);
console.log(JSON.stringify({ versions, zdtpBundle }, null, 2));
process.exit(checks.every((c) => c.pass) ? 0 : 1);
