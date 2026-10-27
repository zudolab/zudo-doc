// PR-gated installed-consumer proof for #4572; fast MathBlock tests own API shape.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scaffold } from "../../packages/create-zudo-doc/src/scaffold.js";

const root = path.resolve(import.meta.dirname, "../..");
const scratch = mkdtempSync(path.join(tmpdir(), "zudo-math-consumer-"));
let tarball: string;
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd, encoding: "utf8", timeout: 180_000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NODE_PATH: "" },
  });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(" ")} (${cwd})\n${result.error ?? ""}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

beforeAll(() => {
  // Same immutable/sanitized snapshot convention as theme-packs-tarball.test.ts.
  const source = path.join(root, "packages/zudo-doc");
  const snapshot = path.join(scratch, "package");
  mkdirSync(snapshot);
  const manifest = JSON.parse(readFileSync(path.join(source, "package.json"), "utf8"));
  for (const file of manifest.files) cpSync(path.join(source, file), path.join(snapshot, file), { recursive: true });
  for (const hook of ["prepare", "prepack", "postpack"]) delete manifest.scripts[hook];
  writeFileSync(path.join(snapshot, "package.json"), JSON.stringify(manifest, null, 2));
  run("npm", ["pack", "--ignore-scripts", "--pack-destination", scratch], snapshot);
  tarball = path.join(scratch, readdirSync(scratch).find((f) => f.endsWith(".tgz"))!);
  console.log(JSON.stringify({ tarball, sha256: hash(tarball), sourceManifestSha256: hash(path.join(source, "package.json")), workspaceLockSha256: hash(path.join(root, "pnpm-lock.yaml")) }));
}, 60_000);

afterAll(() => {
  if (process.env.ZUDO_MATH_KEEP_CONSUMERS === "1") console.log(`Math consumers retained: ${scratch}`);
  else rmSync(scratch, { recursive: true, force: true });
});

async function consumer(version?: string) {
  const name = version ? `math-${version.replaceAll(".", "-")}` : "math-absent";
  const dir = path.join(scratch, name);
  await scaffold({ projectName: name, destination: dir, defaultLang: "en", colorSchemeMode: "light-dark", lightScheme: "Default Light", darkScheme: "Default Dark", features: [], packageManager: "pnpm" });
  const manifestPath = path.join(dir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.dependencies["@takazudo/zudo-doc"] = `file:${tarball}`;
  if (version) manifest.dependencies.katex = version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  // Only this negative fixture disables peer auto-install; workspace policy stays intact.
  if (!version) writeFileSync(path.join(dir, ".npmrc"), readFileSync(path.join(dir, ".npmrc"), "utf8") + "\nauto-install-peers=false\n");
  run("pnpm", ["install", "--strict-peer-dependencies", "--no-frozen-lockfile"], dir);
  run("pnpm", ["install", "--strict-peer-dependencies", "--frozen-lockfile"], dir);
  return dir;
}

const probe = String.raw`
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from '@takazudo/zfb/zudo-react/server';
import { MathBlock } from '@takazudo/zudo-doc/math-block';
const require = createRequire(import.meta.url);
const entry = require.resolve('@takazudo/zudo-doc/math-block');
const packageRequire = createRequire(entry);
const version = process.argv[2];
if (version === 'absent') {
  assert.throws(() => require.resolve('katex'), {code:'MODULE_NOT_FOUND'});
  assert.throws(() => packageRequire.resolve('katex'), {code:'MODULE_NOT_FOUND'});
  assert.throws(() => MathBlock({latex:'x'}), /MathBlock requires the optional peer "katex"/);
  console.log(JSON.stringify({absent:true, entry:realpathSync(entry)}));
} else {
  const katexPath = realpathSync(packageRequire.resolve('katex'));
  assert.ok(katexPath.startsWith(realpathSync(process.cwd()) + path.sep));
  assert.ok(realpathSync(entry).startsWith(realpathSync(process.cwd()) + path.sep));
  assert.equal(katexPath, realpathSync(require.resolve('katex')));
  const katex = packageRequire('katex');
  assert.equal(katex.version, version);
  const html = renderToString(MathBlock({latex:'\\frac{1}{2}'}));
  assert.match(html, /<mfrac>/);
  assert.match(renderToString(MathBlock({latex:'\\sum_{i=1}^n i',block:true})), /∑/);
  assert.match(renderToString(MathBlock({latex:'\\frac{'})), /katex-error/);
  Object.prototype.trust = true;
  try {
    assert.doesNotMatch(renderToString(MathBlock({latex:'\\href{javascript:alert(1)}{x}\\includegraphics{https://example.invalid/math.png}'})), /<(?:a|img)\b/);
  } finally { delete Object.prototype.trust; }
  console.log(JSON.stringify({version, katexPath, entry:realpathSync(entry)}));
}
`;

const content = String.raw`---
title: Math consumer
sidebar_position: 10
---

English prose with <MathBlock latex="\frac{1}{2}" /> inline. 日本語の文中にも <MathBlock latex="x^2" /> を表示します。

<MathBlock latex="\sum_{i=1}^{n} i = \frac{n(n+1)}{2}" block />

<MathBlock latex="\frac{" block />

<MathBlock latex="x_1+x_2+x_3+x_4+x_5+x_6+x_7+x_8+x_9+x_{10}+x_{11}+x_{12}+x_{13}+x_{14}+x_{15}+x_{16}+x_{17}+x_{18}+x_{19}+x_{20}" block />
`;

describe("packed math consumers", () => {
  for (const version of ["0.18.2", "0.18.11", "0.19.0"]) {
    it(`installs and builds KaTeX ${version} at root and /manual`, async () => {
      const dir = await consumer(version);
      writeFileSync(path.join(dir, "probe.mjs"), probe);
      console.log(run(process.execPath, ["probe.mjs", version], dir));
      console.log(JSON.stringify({ consumer: dir, lockSha256: hash(path.join(dir, "pnpm-lock.yaml")), packageRealpath: realpathSync(path.join(dir, "node_modules/@takazudo/zudo-doc")) }));
      const css = path.join(dir, "src/styles/global.css");
      writeFileSync(css, readFileSync(css, "utf8").replace('@import "@takazudo/zudo-doc/features.css";', '@import "katex/dist/katex.min.css";\n@import "@takazudo/zudo-doc/features.css";'));
      writeFileSync(path.join(dir, "src/content/docs/math.mdx"), content);
      const config = path.join(dir, "zfb.config.ts");
      const original = readFileSync(config, "utf8");
      for (const base of ["/", "/manual"]) {
        writeFileSync(config, original.replace("zudoDoc({", `zudoDoc({\n    base: ${JSON.stringify(base)},\n    math: true,`));
        run("pnpm", ["build"], dir);
        const html = readFileSync(path.join(dir, "dist/docs/math/index.html"), "utf8");
        expect(html).toContain("<mfrac>");
        expect(html).toContain("∑");
        expect(html).toContain("katex-error");
        expect(html).toContain("日本語の文中にも");
        expect(html).toContain(`${base === "/" ? "" : base}/assets/`);
        const origin = "https://consumer.invalid";
        const assetPrefix = `${base === "/" ? "" : base}/assets/`;
        // The configured theme pack (Graphite by default) ships its own
        // stylesheet under theme-packs/, outside the bundled assets.
        const styles = [...html.matchAll(/<link\b[^>]*href=["']?([^"'\s>]+\.css(?:\?[^"'\s>]*)?)["']?[^>]*>/g)]
          .map((match) => match[1]!)
          .filter((href) => !href.includes("/theme-packs/"));
        expect(styles.length).toBeGreaterThan(0);
        const mathStyles = styles.map((href) => {
          const url = new URL(href, `${origin}${base === "/" ? "" : base}/docs/math/`);
          expect(url.origin).toBe(origin);
          expect(url.pathname.startsWith(assetPrefix)).toBe(true);
          const file = path.join(dir, "dist", url.pathname.slice(base === "/" ? 1 : base.length + 1));
          return { url, css: readFileSync(file, "utf8") };
        }).filter(({ css }) => css.includes("KaTeX_Main") && css.includes(".katex-mathml"));
        expect(mathStyles.length).toBeGreaterThan(0);
        for (const { url, css } of mathStyles) {
          const fonts = [...css.matchAll(/url\(["']?([^"')]*KaTeX[^"')]+)["']?\)/g)];
          expect(fonts.length).toBeGreaterThan(0);
          for (const [, href] of fonts) {
            const font = new URL(href!, url);
            expect(font.origin).toBe(origin);
            expect(font.pathname.startsWith(assetPrefix)).toBe(true);
            expect(readFileSync(path.join(dir, "dist", font.pathname.slice(base === "/" ? 1 : base.length + 1))).length).toBeGreaterThan(0);
          }
        }
        console.log(JSON.stringify({ version, base, built: true, htmlSha256: hash(path.join(dir, "dist/docs/math/index.html")) }));
      }
    }, 240_000);
  }

  it("builds a generated math-disabled project with KaTeX genuinely absent", async () => {
    const dir = await consumer();
    writeFileSync(path.join(dir, "probe.mjs"), probe);
    console.log(run(process.execPath, ["probe.mjs", "absent"], dir));
    run("pnpm", ["build"], dir);
    expect(readFileSync(path.join(dir, "dist/docs/getting-started/index.html"), "utf8")).toContain("Getting Started");
    console.log(JSON.stringify({ consumer: dir, absent: true, built: true, lockSha256: hash(path.join(dir, "pnpm-lock.yaml")) }));
  }, 180_000);
});
