import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareEntriesNewestFirst,
  generateChangelogMarkdown,
  loadChangelogEntries,
} from "../../packages/zudo-doc/src/integrations/changelog/index.js";
import type { ChangelogConfig } from "../../packages/zudo-doc/src/integrations/changelog/index.js";
import { settings } from "../../src/config/settings.js";

const ROOT = resolve(__dirname, "../..");

describe("real changelog corpus -> generated CHANGELOG.md", () => {
  const changelogs: ChangelogConfig[] = Array.isArray(settings.changelogs)
    ? settings.changelogs
    : [];

  it("has at least one changelog output configured", () => {
    expect(changelogs.length).toBeGreaterThan(0);
  });

  for (const config of changelogs) {
    it(`regenerates ${config.outputFile} byte-identical from the real MDX corpus, newest-first and MDX-free`, () => {
      const sourceDir = resolve(ROOT, config.sourceDir);
      const entries = loadChangelogEntries({ sourceDir });

      if (config.outputFile === "packages/zudo-doc/CHANGELOG.md") {
        expect(entries.length).toBeGreaterThan(0);
      }

      const resorted = [...entries].sort(compareEntriesNewestFirst);
      expect(entries.map((entry) => entry.version)).toEqual(
        resorted.map((entry) => entry.version),
      );

      const markdown = generateChangelogMarkdown(entries, {
        title: config.title,
        packageName: config.packageName,
      });

      expect(markdown.startsWith("# ")).toBe(true);

      // MDX-only syntax must not leak outside of fenced code samples.
      const proseOnly = markdown.replace(/^```[\s\S]*?^```$/gm, "");
      expect(proseOnly).not.toMatch(/^import\s/m);
      expect(proseOnly).not.toMatch(/^export\s/m);
      expect(proseOnly).not.toMatch(/\{\/\*/);
      expect(proseOnly).not.toMatch(/^:::/m);
      expect(proseOnly).not.toMatch(/<\/?[A-Z][A-Za-z0-9]*[ />]/);

      // Drift guard: the committed output must match what the real source
      // regenerates today, so a stale commit or a sanitizer regression fails
      // this test instead of shipping silently.
      const committed = readFileSync(resolve(ROOT, config.outputFile), "utf-8");
      expect(committed).toBe(markdown);
    });
  }

  it("lists every generated package changelog in its npm files[] contract", () => {
    for (const config of changelogs) {
      expect(existsSync(resolve(ROOT, config.outputFile))).toBe(true);
      const packageJsonPath =
        config.outputFile.split("/").slice(0, 2).join("/") + "/package.json";
      const packageJson = JSON.parse(readFileSync(resolve(ROOT, packageJsonPath), "utf-8")) as {
        files?: string[];
      };
      expect(packageJson.files).toContain("CHANGELOG.md");
    }
  });

  for (const config of changelogs) {
    it(`${config.outputFile} has no dead relative .md/.mdx links, and every in-file anchor link resolves to a real heading`, () => {
      const committed = readFileSync(resolve(ROOT, config.outputFile), "utf-8");
      const withoutCode = stripCodeForLinkCheck(committed);

      // A relative .md/.mdx link is always dead once flattened into a single
      // file — emit-time rewriting (links.ts) must have turned every one of
      // these into either an in-file anchor or an unlinked label.
      expect(withoutCode).not.toMatch(/\]\(\.\/[^)]*\.mdx?(?:#[^)"]*)?\)/i);
      expect(withoutCode).not.toMatch(/\]\(\.\.\/[^)]*\.mdx?(?:#[^)"]*)?\)/i);

      // Independent re-derivation of GitHub's anchor slugger (not a reuse of
      // links.ts's own allocator), so this proves correctness against the
      // committed file rather than just self-consistency of one algorithm.
      const anchors = computeAnchorsForDocument(committed);
      const anchorLinkRe = /\]\(#([^)\s"]+)/g;
      const targets = [...withoutCode.matchAll(anchorLinkRe)].map((m) => m[1] ?? "");
      for (const target of targets) {
        expect(anchors.has(target)).toBe(true);
      }
    });
  }
});

// --- Independent oracle for the anchor-link assertion above --------------
//
// Deliberately reimplemented rather than imported from links.ts, so this
// test proves the committed file is correct against GitHub's real anchor
// behavior instead of merely agreeing with whatever links.ts computed.

function githubSlugifyForTest(text: string): string {
  const allowed = /[\p{L}\p{N}_\- ]/u;
  let out = "";
  for (const ch of text.toLowerCase()) {
    if (allowed.test(ch)) out += ch === " " ? "-" : ch;
  }
  return out;
}

function computeAnchorsForDocument(markdown: string): Set<string> {
  const seen = new Map<string, number>();
  const anchors = new Set<string>();
  let fenceChar: string | null = null;
  let fenceLen = 0;

  for (const line of markdown.split("\n")) {
    const trimmed = line.trimStart();
    const fenceMatch = /^([`~]{3,})/.exec(trimmed);
    if (fenceMatch) {
      const fence = fenceMatch[1]!;
      if (fenceChar === null) {
        fenceChar = fence[0]!;
        fenceLen = fence.length;
      } else if (fence[0] === fenceChar && fence.length >= fenceLen) {
        fenceChar = null;
      }
      continue;
    }
    if (fenceChar !== null) continue;

    const headingMatch = /^(#{1,6})[ \t]+(.+)$/.exec(line.trim());
    if (!headingMatch) continue;
    const text = headingMatch[2]!.trim().replace(/\s+#+\s*$/, "");
    const slug = githubSlugifyForTest(text);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  }

  return anchors;
}

/** Drop fenced code blocks (```/~~~, 3+ chars) and inline code spans, so a
 * link-shape regex scan doesn't false-positive on link syntax quoted inside
 * an example. */
function stripCodeForLinkCheck(markdown: string): string {
  const lines: string[] = [];
  let fenceChar: string | null = null;
  let fenceLen = 0;

  for (const line of markdown.split("\n")) {
    const trimmed = line.trimStart();
    const fenceMatch = /^([`~]{3,})/.exec(trimmed);
    if (fenceChar === null) {
      if (fenceMatch) {
        fenceChar = fenceMatch[1]![0]!;
        fenceLen = fenceMatch[1]!.length;
        continue;
      }
      lines.push(line);
    } else if (fenceMatch && fenceMatch[1]![0] === fenceChar && fenceMatch[1]!.length >= fenceLen) {
      fenceChar = null;
    }
  }

  return lines.join("\n").replace(/(`+)([\s\S]*?)\1(?!`)/g, "");
}
