import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
    expect(en).toHaveLength(106);
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
      if (existsSync(DIST)) {
        expect(
          existsSync(join(DIST, rule.destination.slice(1), "index.html")),
          `${rule.destination} built page`,
        ).toBe(true);
      }
    }

    expect(rules.some(({ source }) => source.endsWith("/changelog/zudo-doc"))).toBe(false);
    expect(rules.some(({ destination }) => destination.endsWith("/changelog/zudo-doc"))).toBe(false);
  });

  it("matches the built public artifact whenever a build is present", () => {
    if (!existsSync(DIST_REDIRECTS)) return;
    expect(readFileSync(DIST_REDIRECTS, "utf8")).toBe(readFileSync(PUBLIC_REDIRECTS, "utf8"));
  });
});
