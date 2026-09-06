import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PUBLIC_REDIRECTS = join(ROOT, "public/_redirects");
const DIST_REDIRECTS = join(ROOT, "dist/_redirects");
const DIST = join(ROOT, "dist");
const EN_ZUDO_CHANGELOG = join(ROOT, "src/content/docs/changelog/zudo-doc");
const JA_ZUDO_CHANGELOG = join(ROOT, "src/content/docs-ja/changelog/zudo-doc");

type RedirectRule = {
  source: string;
  destination: string;
  status: number;
};

function versions(root: string): string[] {
  return readdirSync(root)
    .filter((name) => name.endsWith(".mdx") && name !== "index.mdx")
    .map((name) => name.slice(0, -".mdx".length))
    .sort(new Intl.Collator("en", { numeric: true }).compare);
}

function parseRedirects(path: string): RedirectRule[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0 && !line.startsWith("#"))
    .map(({ line, lineNumber }) => {
      const tokens = line.split(/\s+/);
      if (tokens.length !== 3) {
        throw new Error(`expected three tokens on _redirects line ${lineNumber}`);
      }
      const [source, destination, rawStatus] = tokens;
      const status = Number(rawStatus);
      if (!source || !destination || !Number.isInteger(status)) {
        throw new Error(`invalid _redirects line ${lineNumber}`);
      }
      return { source, destination, status };
    });
}

// Compares dist/_redirects against public/_redirects, but only when dist is at least as
// fresh as public — see the it() block below and the acceptance criteria in issue #4011
// for why an existsSync-only guard produces a false red on a warm tree.
function assertDistRedirectsMatchesPublic(
  distPath: string,
  publicPath: string,
  warn: (message: string) => void = (message) => console.warn(message),
): void {
  if (!existsSync(distPath)) return;
  const distMtimeMs = statSync(distPath).mtimeMs;
  const publicMtimeMs = statSync(publicPath).mtimeMs;
  if (distMtimeMs < publicMtimeMs) {
    // Residual gap: this skip trades a guaranteed-false red (comparing a stale dist/
    // against a just-edited public/) for a possible false green in one narrow scenario —
    // a warm tree where a *later* build stops copying _redirects into dist/ altogether.
    // In that case the stale leftover keeps its old mtime forever, so this guard would
    // skip indefinitely instead of ever catching the dropped copy step. That's accepted
    // because everywhere a build has actually just run (CI, or any local `pnpm build`),
    // dist/_redirects is newer than public/_redirects, so the comparison below still
    // fires and the dropped-copy signal stays fully live. The degradation is confined to
    // stale warm trees, which is exactly where today's existsSync-only guard was already
    // comparing meaningless bytes.
    warn(
      `[changelog-redirects] skipping dist/public comparison: dist/_redirects ` +
        `(mtime ${new Date(distMtimeMs).toISOString()}) predates public/_redirects ` +
        `(mtime ${new Date(publicMtimeMs).toISOString()}) — the build is stale, not the ` +
        `redirects file. Run \`pnpm build\` to refresh dist/ before trusting this check.`,
    );
    return;
  }
  expect(readFileSync(distPath, "utf8")).toBe(readFileSync(publicPath, "utf8"));
}

function expectedRules(en: string[], ja: string[]): RedirectRule[] {
  return [
    ...en.map((version) => ({
      source: `/docs/changelog/${version}`,
      destination: `/docs/changelog/zudo-doc/${version}`,
      status: 301,
    })),
    ...ja.map((version) => ({
      source: `/ja/docs/changelog/${version}`,
      destination: `/ja/docs/changelog/zudo-doc/${version}`,
      status: 301,
    })),
  ];
}

describe("showcase package changelog redirects", () => {
  const en = versions(EN_ZUDO_CHANGELOG);
  const ja = versions(JA_ZUDO_CHANGELOG);
  const rules = parseRedirects(PUBLIC_REDIRECTS);

  it("covers exactly every historical EN and JA route", () => {
    expect(en).toHaveLength(110);
    expect(ja).toEqual(en);
    expect(rules).toEqual(expectedRules(en, ja));
  });

  it("keeps sources and destinations unique and explicit", () => {
    expect(new Set(rules.map(({ source }) => source)).size).toBe(rules.length);
    expect(new Set(rules.map(({ destination }) => destination)).size).toBe(rules.length);
    expect(rules.every(({ source, destination, status }) =>
      status === 301 && !source.includes("*") && !destination.includes("*") &&
      !source.includes(":") && !destination.includes(":")
    )).toBe(true);
  });

  it("points at existing bilingual version pages without landing-page loops", () => {
    for (const rule of rules) {
      const isJapanese = rule.source.startsWith("/ja/");
      const version = rule.source.split("/").at(-1);
      if (!version) throw new Error(`missing version in ${rule.source}`);
      const sourceFile = join(
        isJapanese ? JA_ZUDO_CHANGELOG : EN_ZUDO_CHANGELOG,
        `${version}.mdx`,
      );
      expect(existsSync(sourceFile), `${rule.destination} source`).toBe(true);
      expect(rule.destination).toBe(
        `${isJapanese ? "/ja" : ""}/docs/changelog/zudo-doc/${version}`,
      );
      expect(rule.destination).not.toMatch(/\/changelog\/zudo-doc\/?$/);
      expect(rule.destination).not.toBe(rule.source);
      // dist/index.html is a representative rendered-page marker, not a build-completion
      // sentinel: it proves the build emitted at least one page, ruling out an empty dist/
      // left by an interrupted build, but a build killed after this file and before the
      // changelog pages would still assert and fail here.
      if (existsSync(join(DIST, "index.html"))) {
        expect(
          existsSync(join(DIST, rule.destination.slice(1), "index.html")),
          `${rule.destination} built page`,
        ).toBe(true);
      }
    }

    expect(rules.some(({ source }) => source.endsWith("/changelog/zudo-doc"))).toBe(false);
    expect(rules.some(({ destination }) => destination.endsWith("/changelog/zudo-doc"))).toBe(false);
  });

  it("matches the built public artifact whenever a build is fresh", () => {
    assertDistRedirectsMatchesPublic(DIST_REDIRECTS, PUBLIC_REDIRECTS);
  });
});

describe("assertDistRedirectsMatchesPublic freshness guard", () => {
  function seedFixture(distContent: string, publicContent: string, distOlder: boolean) {
    const dir = mkdtempSync(join(tmpdir(), "changelog-redirects-freshness-"));
    const distPath = join(dir, "dist-redirects");
    const publicPath = join(dir, "public-redirects");
    writeFileSync(distPath, distContent, "utf8");
    writeFileSync(publicPath, publicContent, "utf8");
    const now = Date.now();
    const older = new Date(now - 60_000);
    const newer = new Date(now);
    utimesSync(distPath, distOlder ? older : newer, distOlder ? older : newer);
    utimesSync(publicPath, distOlder ? newer : older, distOlder ? newer : older);
    return { distPath, publicPath };
  }

  it("skips the comparison and warns when dist predates public, even with differing content", () => {
    const { distPath, publicPath } = seedFixture("stale dist\n", "edited public\n", true);
    const warn = vi.fn();
    expect(() => assertDistRedirectsMatchesPublic(distPath, publicPath, warn)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/skipping dist\/public comparison/);
  });

  it("compares and fails when dist is fresh and differs from public", () => {
    const { distPath, publicPath } = seedFixture("dist content\n", "public content\n", false);
    const warn = vi.fn();
    expect(() => assertDistRedirectsMatchesPublic(distPath, publicPath, warn)).toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it("compares and passes when dist is fresh and matches public", () => {
    const { distPath, publicPath } = seedFixture("same content\n", "same content\n", false);
    const warn = vi.fn();
    expect(() => assertDistRedirectsMatchesPublic(distPath, publicPath, warn)).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it("does nothing when dist does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "changelog-redirects-freshness-"));
    const publicPath = join(dir, "public-redirects");
    writeFileSync(publicPath, "public content\n", "utf8");
    const warn = vi.fn();
    expect(() =>
      assertDistRedirectsMatchesPublic(join(dir, "missing-dist"), publicPath, warn),
    ).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});
