import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { normalizeHtml, sha256Html } from "../parity-html-normalize.mjs";

const root = resolve(import.meta.dirname, "../..");
const helper = join(root, "scripts/a2-causal-diff.py");
const reference = "scripts/__tests__/fixtures/a2-route-reference.json";
const normalizer = "scripts/parity-html-normalize.mjs";
const packsRoot = "packages/zudo-doc/src/theme-packs/";
const components: Record<string, string[]> = {
  "404.html": ["SidebarToggle"],
  "docs/getting-started/index.html": ["SidebarToggle", "SidebarTree"],
  "docs/getting-started/coverage/index.html": ["SidebarToggle", "SidebarTree", "MobileToc", "Toc"],
};
const pages = Object.keys(components);
const oldToken = "1234567890abcdef";
const newToken = "fedcba0987654321";
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function html(page: string, token = oldToken, version = "1.0.0") {
  const islands = components[page].map((name) => `<div data-zfb-island=${name} data-zfb-build=${token} data-zfb-protocol=zudo-react/1 data-zfb-transport=json/1 data-props='{"label":"日本語"}'><!--zr:1:0:c-->body<!--/zr:1:0--></div>`).join("");
  return `<html><head><script>var packs={"default":"1.0.0","washi":"${version}"};</script><link href=/assets/styles-abcdef.css></head><body><header data-zfb-transition-persist=header-en>Header</header><h1>日本語</h1><a href=/docs/getting-started/>route</a>${islands}<p class=note>content</p></body></html>`;
}

function fixture(options: { version?: string; css?: string; token?: string; transform?: (html: string, page: string) => string } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "a2-causal-"));
  dirs.push(dir);
  const repo = join(dir, "repo");
  mkdirSync(repo);
  function write(path: string, value: string) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), value);
  }
  function git(...args: string[]) {
    const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    return r.stdout.trim();
  }
  function commit() {
    git("add", "-A");
    git("-c", "user.name=Evidence Test", "-c", "user.email=evidence@example.invalid", "commit", "--allow-empty", "-qm", "fixture");
    return git("rev-parse", "HEAD");
  }
  git("init", "-q");
  write(normalizer, readFileSync(join(root, normalizer), "utf8"));
  for (const slug of ["default", "washi"]) write(`${packsRoot}${slug}/meta.json`, JSON.stringify({ slug, version: "1.0.0" }));
  write(`${packsRoot}washi/pack.css`, "body {color: black}");
  const baselineHtml = Object.fromEntries(pages.map((page) => [page, html(page)]));
  write(reference, JSON.stringify(Object.fromEntries(pages.map((page) => [page, sha256Html(baselineHtml[page])]))));
  const baselineSource = commit();
  if (options.version) write(`${packsRoot}washi/meta.json`, JSON.stringify({ slug: "washi", version: options.version }));
  if (options.css) write(`${packsRoot}washi/pack.css`, options.css);
  const candidateSource = commit();
  const baseline = join(dir, "baseline");
  const candidate = join(dir, "candidate");
  function capture(path: string, sourceHead: string, contents: Record<string, string>) {
    mkdirSync(path, { recursive: true });
    const rows = pages.map((page) => {
      const raw = contents[page];
      const name = page.replaceAll("/", "--");
      writeFileSync(join(path, name), raw);
      writeFileSync(join(path, name + ".normalized.html"), normalizeHtml(raw));
      return { page, bytes: Buffer.byteLength(raw), sha256Html: sha256Html(raw) };
    });
    writeFileSync(join(path, "manifest.json"), JSON.stringify({ sourceHead, pages: rows }));
  }
  const candidateHtml = Object.fromEntries(pages.map((page) => {
    const content = html(page, options.token, options.version);
    return [page, options.transform?.(content, page) ?? content];
  }));
  capture(baseline, baselineSource, baselineHtml);
  capture(candidate, candidateSource, candidateHtml);
  function run(overrides: Record<string, string> = {}) {
    const output = join(dir, "output");
    const args = { repo, baseline, candidate, "baseline-source": baselineSource, "candidate-source": candidateSource,
      "reference-source": baselineSource, output, ...overrides };
    const result = spawnSync("python3", [helper, ...Object.entries(args).flatMap(([key, value]) => ["--" + key, value])], { encoding: "utf8" });
    return { status: result.status, text: result.stdout + result.stderr, output: args.output,
      report: existsSync(join(args.output, "comparison.json")) ? JSON.parse(readFileSync(join(args.output, "comparison.json"), "utf8")) : null };
  }
  function manifest(change: (value: any) => void) {
    const path = join(candidate, "manifest.json");
    const value = JSON.parse(readFileSync(path, "utf8"));
    change(value);
    writeFileSync(path, JSON.stringify(value));
  }
  return { dir, repo, baseline, candidate, baselineSource, candidateSource, baselineHtml, candidateHtml, write, git, commit, capture, manifest, run };
}

describe("offline A2 causal evidence (strict fingerprints remain authoritative)", () => {
  it("compares exact bytes without claiming build freshness and never mutates input/source", () => {
    const f = fixture();
    const before = [f.git("status", "--porcelain"), readFileSync(join(f.repo, reference), "utf8"), readFileSync(join(f.candidate, "manifest.json"), "utf8")];
    const result = f.run();
    expect(result.status, result.text).toBe(0);
    expect(result.report.identityVerification).toBe("OBSERVED_ONLY_UNVERIFIED_FRESHNESS");
    expect(result.report.acceptance).toContain("No build, CI, reference update or release approval");
    expect(result.report.pages.every((p: any) => p.normalizedEqual && p.residualEqual)).toBe(true);
    expect([f.git("status", "--porcelain"), readFileSync(join(f.repo, reference), "utf8"), readFileSync(join(f.candidate, "manifest.json"), "utf8")]).toEqual(before);
  });

  it("uses exactly the existing content-hash normalization", () => {
    const result = fixture({ transform: (h) => h.replace("styles-abcdef.css", "styles-123456.css") }).run();
    expect(result.status, result.text).toBe(0);
    expect(result.report.pages.every((p: any) => !p.rawEqual && p.normalizedEqual)).toBe(true);
  });

  it.each([
    { token: newToken },
    { version: "2.0.0-beta", css: "body {color: red}" },
    { token: newToken, version: "1.0.1", css: "body {color: red}" },
  ])("requires review even for completely explained source versions/observed identity: %j", (options) => {
    const result = fixture(options).run();
    expect(result.status, result.text).toBe(1);
    expect(result.report.status).toBe("DIFFERENCES_REQUIRE_REVIEW");
    expect(result.report.pages.every((p: any) => !p.normalizedEqual && p.residualEqual)).toBe(true);
    expect(result.report.identityVerification).toContain("UNVERIFIED");
  });

  it.each([
    ["prose", (h: string) => h.replace(">content<", ">regression<")],
    ["route", (h: string) => h.replace("/docs/getting-started/", "/wrong-route/")],
    ["link attribute", (h: string) => h.replace("<a href=", "<a target=_blank href=")],
    ["class", (h: string) => h.replace("class=note", "class=hidden")],
    ["props", (h: string) => h.replaceAll('"label":"日本語"', '"label":"different"')],
    ["structural comment", (h: string) => h.replace("<!--zr:1:0:c-->", "")],
    ["island placement", (h: string) => h.replace("<div data-zfb-island=", "<section><div data-zfb-island=").replace("</div>", "</div></section>")],
    ["pack order", (h: string) => h.replace('"default":"1.0.0","washi":"1.0.1"', '"washi":"1.0.1","default":"1.0.0"')],
    ["map whitespace", (h: string) => h.replace('"washi":"1.0.1"', '"washi": "1.0.1"')],
    ["unchanged version spelling", (h: string) => h.replace('"default":"1.0.0"', '"default":"\\u0031.0.0"')],
    ["bootstrap code", (h: string) => h.replace(";</script>", ";throw 1;</script>")],
  ])("retains %s regression alongside legitimate churn", (_label, transform) => {
    const f = fixture({ token: newToken, version: "1.0.1", css: "body {color: red}", transform });
    const result = f.run();
    expect(result.status, result.text).toBe(1);
    expect(result.report.pages.every((p: any) => !p.normalizedEqual && !p.residualEqual)).toBe(true);
    expect(readFileSync(join(result.output, "404.html.residual.diff"), "utf8")).not.toBe("");
    expect(readFileSync(join(result.output, "404.html.candidate.raw.html"), "utf8")).toBe(f.candidateHtml["404.html"]);
  });

  it("does not replace token-looking text outside native attribute spans", () => {
    const f = fixture({ token: newToken, transform: (h) => h.replace(">content<", `>data-zfb-build=${newToken}<`) });
    const result = f.run();
    expect(result.status, result.text).toBe(1);
    expect(result.report.pages.every((p: any) => !p.residualEqual)).toBe(true);
    expect(readFileSync(join(result.output, "404.html.candidate.forensic.html"), "utf8")).toContain(`>data-zfb-build=${newToken}<`);
  });

  it.each(["a\u2028b\n", "a\rb\n", "日本語\n"])("uses HTMLParser LF offsets with prefix %j", (prefix) => {
    const f = fixture({ token: newToken });
    const baseline = Object.fromEntries(pages.map((p) => [p, prefix + f.baselineHtml[p]]));
    const candidate = Object.fromEntries(pages.map((p) => [p, prefix + f.candidateHtml[p]]));
    f.write(reference, JSON.stringify(Object.fromEntries(pages.map((p) => [p, sha256Html(baseline[p])]))));
    const source = f.commit();
    f.capture(f.baseline, f.baselineSource, baseline);
    f.capture(f.candidate, f.candidateSource, candidate);
    const result = f.run({ "reference-source": source });
    expect(result.status, result.text).toBe(1);
    expect(result.report.pages.every((p: any) => p.residualEqual)).toBe(true);
  });

  it.each([oldToken, newToken])("rejects encoded identity with quoted attribute decoy %s", (decoy) => {
    const result = fixture({ transform: (h) => h.replaceAll(`data-zfb-build=${oldToken}`, `title="data-zfb-build=${decoy} " data-zfb-build="&#x31;234567890abcdef"`) }).run();
    expect(result.status, result.text).toBe(2);
    expect(result.text).toContain("Unsupported encoded native identity value");
  });

  it("never restores a valid token-looking string in another attribute", () => {
    const result = fixture({ token: newToken, transform: (h) => h.replaceAll(`data-zfb-build=${newToken}`, `title="data-zfb-build=${newToken} " data-zfb-build=${newToken}`) }).run();
    expect(result.status, result.text).toBe(1);
    expect(result.report.pages.every((p: any) => !p.residualEqual)).toBe(true);
  });

  it("rejects unsupported JSON spelling on a changed source version", () => {
    const result = fixture({ version: "1.0.1", transform: (h) => h.replace('"washi":"1.0.1"', '"washi":"\\u0031.0.1"') }).run();
    expect(result.status, result.text).toBe(2);
  });

  it.each([
    ["missing", (h: string) => h.replace(` data-zfb-build=${oldToken}`, "")],
    ["malformed", (h: string) => h.replace(oldToken, "invalid")],
    ["duplicate", (h: string) => h.replace(`data-zfb-build=${oldToken}`, `data-zfb-build=${oldToken} data-zfb-build=${oldToken}`)],
    ["stray", (h: string) => h.replace("<p class=", `<p data-zfb-build=${oldToken} class=`)],
    ["misplaced", (h: string) => h.replace(` data-zfb-build=${oldToken}`, "").replace("<h1>", `<h1 data-zfb-build=${oldToken}>`)],
    ["island name", (h: string) => h.replace("data-zfb-island=SidebarToggle", "data-zfb-island=Wrong")],
    ["island removed", (h: string) => h.replace("data-zfb-island=SidebarToggle", "data-island=SidebarToggle")],
    ["protocol", (h: string) => h.replace("zudo-react/1", "zudo-react/2")],
    ["transport", (h: string) => h.replace("json/1", "json/2")],
  ])("rejects %s identity/transport evidence", (_label, transform) => {
    const result = fixture({ transform }).run();
    expect(result.status, result.text).toBe(2);
    expect(result.report).toBeNull();
  });

  it.each(["within-page", "across-page"])("rejects mixed identities %s", (mode) => {
    const result = fixture({ transform: (h, page) => mode === "within-page" ? h.replace(oldToken, newToken) : page === "404.html" ? h.replaceAll(oldToken, newToken) : h }).run();
    expect(result.status, result.text).toBe(2);
    expect(result.text).toContain("Mixed native identities");
  });

  it.each([
    ["missing", (h: string) => h.replace(',"washi":"1.0.0"', "")],
    ["extra", (h: string) => h.replace('"washi":"1.0.0"', '"washi":"1.0.0","extra":"1.0.0"')],
    ["wrong version", (h: string) => h.replace('"washi":"1.0.0"', '"washi":"9.0.0"')],
    ["duplicate key", (h: string) => h.replace('"washi":"1.0.0"', '"washi":"1.0.0","washi":"1.0.0"')],
    ["duplicate map", (h: string) => h.replace("</script>", 'var packs={"default":"1.0.0","washi":"1.0.0"};</script>')],
  ])("rejects %s pack metadata", (_label, transform) => {
    const result = fixture({ transform }).run();
    expect(result.status, result.text).toBe(2);
  });

  it("checks changed CSS even when the version maps are identical", () => {
    const result = fixture({ css: "body {color: red}" }).run();
    expect(result.status, result.text).toBe(2);
    expect(result.text).toContain("Changed CSS without a cache-buster");
  });

  it.each(["added", "removed"])("keeps source-%s pack sets as residual differences", (kind) => {
    const f = fixture();
    if (kind === "added") {
      f.write(`${packsRoot}extra/meta.json`, JSON.stringify({ slug: "extra", version: "1.0.0" }));
      f.write(`${packsRoot}extra/pack.css`, "body {color: red}");
    } else f.git("rm", "-r", packsRoot + "washi");
    const source = f.commit();
    const candidate = Object.fromEntries(pages.map((p) => [p, kind === "added"
      ? f.candidateHtml[p].replace('"washi":"1.0.0"', '"washi":"1.0.0","extra":"1.0.0"')
      : f.candidateHtml[p].replace(',"washi":"1.0.0"', "")]));
    f.capture(f.candidate, source, candidate);
    const result = f.run({ "candidate-source": source });
    expect(result.status, result.text).toBe(1);
    expect(result.report.pages.every((p: any) => !p.residualEqual)).toBe(true);
    expect(result.report.changedStylesheets).toHaveLength(1);
  });

  it.each(["slug", "version", "normalizer", "reference"])("rejects invalid source %s", (kind) => {
    const f = fixture();
    if (kind === "normalizer") f.write(normalizer, "throw new Error('must never execute');");
    else if (kind === "reference") f.write(reference, JSON.stringify(Object.fromEntries(pages.map((p) => [p, "0".repeat(64)]))));
    else f.write(`${packsRoot}washi/meta.json`, JSON.stringify({ slug: kind === "slug" ? "wrong" : "washi", version: kind === "version" ? "invalid" : "1.0.0" }));
    const source = f.commit();
    f.manifest((m) => { m.sourceHead = source; });
    const result = f.run({ "candidate-source": source, ...(kind === "reference" ? { "reference-source": source } : {}) });
    expect(result.status, result.text).toBe(2);
  });

  it.each(["sourceHead", "duplicate route", "missing route", "extra route", "hash", "length"])("rejects invalid manifest %s", (kind) => {
    const f = fixture();
    f.manifest((m) => {
      if (kind === "sourceHead") m.sourceHead = f.baselineSource;
      if (kind === "duplicate route") m.pages[1] = m.pages[0];
      if (kind === "missing route") m.pages.pop();
      if (kind === "extra route") m.pages.push({ ...m.pages[0], page: "other.html" });
      if (kind === "hash") m.pages[0].sha256Html = "0".repeat(64);
      if (kind === "length") m.pages[0].bytes++;
    });
    const result = f.run();
    expect(result.status, result.text).toBe(2);
  });

  it.each(["404.html", "404.html.normalized.html"])("rejects changed %s evidence bytes", (name) => {
    const f = fixture();
    writeFileSync(join(f.candidate, name), readFileSync(join(f.candidate, name), "utf8") + "mutation");
    expect(f.run().status).toBe(2);
  });

  it.each(["HEAD", "0".repeat(40)])("rejects mutable/missing source %s", (source) => {
    expect(fixture().run({ "candidate-source": source }).status).toBe(2);
  });

  it("records reference/source tree differences without treating them as source equivalence", () => {
    const f = fixture();
    f.write("docs/evidence.md", "reference-only followup");
    const ref = f.commit();
    const result = f.run({ "reference-source": ref });
    expect(result.status, result.text).toBe(0);
    expect(result.report.baselineReferenceTreeEqual).toBe(false);
  });

  it.each(["existing", "capture", "package", "symlink-package", "repo-docs", "git-dir"])("rejects unsafe output %s", (kind) => {
    const f = fixture();
    let output = kind === "existing" ? f.dir : kind === "capture" ? join(f.candidate, "out") : join(f.repo, "packages/zudo-doc/evidence");
    if (kind === "symlink-package") {
      symlinkSync(join(f.repo, "packages/zudo-doc"), join(f.dir, "linked"));
      output = join(f.dir, "linked/out");
    }
    if (kind === "repo-docs") output = join(f.repo, "docs/new-evidence");
    if (kind === "git-dir") output = join(f.repo, ".git/new-evidence");
    expect(f.run({ output }).status).toBe(2);
  });

  it("refuses symlinked capture bytes outside the selected directory", () => {
    const f = fixture();
    const path = join(f.candidate, "404.html");
    rmSync(path);
    symlinkSync(join(f.baseline, "404.html"), path);
    expect(f.run().status).toBe(2);
  });

  it("rejects a subdirectory --repo rather than misidentifying the package/output boundary", () => {
    const f = fixture();
    const result = f.run({ repo: join(f.repo, "scripts"), output: join(f.repo, "docs/out") });
    expect(result.status, result.text).toBe(2);
    expect(result.text).toContain("Git working-tree root");
  });

  it("rejects output inside external common Git metadata of a linked worktree", () => {
    const f = fixture();
    const worktree = join(f.dir, "worktree");
    f.git("worktree", "add", "--detach", worktree);
    const result = f.run({ repo: worktree, output: join(f.repo, ".git/out") });
    expect(result.status, result.text).toBe(2);
    expect(result.text).toContain("outside Git metadata");
  });

  it("replays original checksum-verified #4535 HTML with independent source-map snapshots", () => {
    const f = fixture();
    const snapshots = JSON.parse(readFileSync(join(root, "scripts/__tests__/fixtures/a2-causal-source-packs.json"), "utf8"));
    const archives = [
      ["accepted-main-a2-diagnostics.zip", "857f47c4016b2b4b922034f1264a9ea1946b75822f8cb726c8d9a6315f52aa9a"],
      ["pr4535-a2-diagnostics.zip", "42369a85fb38c7c4be438b737ba3cf41c6023728db1089dcfa944927bd84d2dd"],
    ];
    const contents = archives.map(([name, digest]) => {
      const archive = join(root, "docs/findings/4535-a2-rebaseline/original", name);
      expect(createHash("sha256").update(readFileSync(archive)).digest("hex")).toBe(digest);
      // Read only the three fixed members, never extract arbitrary ZIP paths.
      const run = spawnSync("python3", ["-c", "import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({p:z.read(p.replace('/', '--')).decode('utf8') for p in json.loads(sys.argv[2])}))", archive, JSON.stringify(pages)], { encoding: "utf8" });
      expect(run.status, run.stderr).toBe(0);
      return JSON.parse(run.stdout) as Record<string, string>;
    });
    const sources = snapshots.versions.map((versions: Record<string, string>, index: number) => {
      for (const [slug, version] of Object.entries(versions)) {
        f.write(`${packsRoot}${slug}/meta.json`, JSON.stringify({ slug, version }));
        if (slug !== "default") f.write(`${packsRoot}${slug}/pack.css`, `/* synthetic source replay ${version} */`);
      }
      f.write(reference, JSON.stringify(Object.fromEntries(pages.map((page) => [page, sha256Html(contents[0][page])]))));
      const source = f.commit();
      f.capture(index ? f.candidate : f.baseline, source, contents[index]);
      return source;
    });
    const result = f.run({ "baseline-source": sources[0], "candidate-source": sources[1], "reference-source": sources[0] });
    expect(result.status, result.text).toBe(1);
    expect(result.report.pages.map((p: any) => p.candidateIslands.length)).toEqual([1, 2, 4]);
    expect(result.report.changedStylesheets).toHaveLength(24);
    expect(result.report.pages.every((p: any) => !p.normalizedEqual && p.residualEqual)).toBe(true);
    expect(result.report.pages.map((p: any) => p.candidateFingerprint)).toEqual([
      "45fc2927ccf4957651ccd9936c6683dddebe2688db4910a2ea9e2c612f7c6de2",
      "66f9df15c0f2aa9ab194e56c70b6d5787230ab93f74f97cbc18299535141b18a",
      "9d6e058e392b5436ae297d81a66a66fa46ca9c976ce34cfb06b914a236528e08",
    ]);
  });
});
