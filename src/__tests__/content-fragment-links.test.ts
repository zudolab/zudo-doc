import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractHeadings, slugify } from "../../pages/lib/_extract-headings";

const ROOT = resolve(import.meta.dirname, "../..");
const CONTENT_ROOTS = [
  resolve(ROOT, "src/content/docs"),
  resolve(ROOT, "src/content/docs-ja"),
];

function collectContentFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return collectContentFiles(path);
    return /\.mdx?$/.test(entry.name) ? [path] : [];
  });
}

function withoutFencedCode(body: string): string {
  let opener: string | null = null;
  return body
    .split("\n")
    .map((line) => {
      const fence = /^\s*([`~]{3,})/.exec(line)?.[1];
      if (fence !== undefined) {
        if (opener === null) opener = fence;
        else if (fence[0] === opener[0] && fence.length >= opener.length) {
          opener = null;
        }
        return "";
      }
      return opener === null ? line : "";
    })
    .join("\n");
}

function headingText(raw: string): string {
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<![\w])__([^_]+)__(?![\w])/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(?<![\w])_([^_]+)_(?![\w])/g, "$1")
    .trim();
}

/** Test-only all-depth mirror; production extraction deliberately emits h2–h4. */
function allHierarchicalIds(body: string): string[] {
  const seen = new Map<string, number>();
  const stack: Array<{ depth: number; id: string }> = [];
  const ids: string[] = [];

  for (const line of withoutFencedCode(body).split("\n")) {
    const match = /^(#{2,6})[ \t]+(.+)$/.exec(line.trim());
    if (match === null) continue;
    const depth = match[1]!.length;
    const base = slugify(headingText(match[2]!));
    if (base === "") continue;

    while ((stack.at(-1)?.depth ?? -1) >= depth) {
      stack.pop();
    }
    const parent = stack.at(-1);
    const candidate = parent === undefined ? base : `${parent.id}-${base}`;
    const count = seen.get(candidate) ?? 0;
    seen.set(candidate, count + 1);
    const id = count === 0 ? candidate : `${candidate}-${count}`;
    stack.push({ depth, id });
    ids.push(id);
  }
  return ids;
}

function resolveContentTarget(source: string, rawHref: string): string | null {
  const hashAt = rawHref.indexOf("#");
  const rawPath = rawHref.slice(0, hashAt).split("?")[0]!;
  let target: string;

  if (rawPath === "") target = source;
  else if (rawPath.startsWith("/docs/")) {
    target = resolve(CONTENT_ROOTS[0]!, rawPath.slice("/docs/".length));
  } else if (rawPath.startsWith("/ja/docs/")) {
    target = resolve(CONTENT_ROOTS[1]!, rawPath.slice("/ja/docs/".length));
  } else if (rawPath.startsWith("/")) {
    return null;
  } else {
    target = resolve(dirname(source), decodeURIComponent(rawPath));
  }

  const candidates = extname(target)
    ? [target]
    : [target, `${target}.mdx`, `${target}.md`, resolve(target, "index.mdx")];
  return (
    candidates.find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    ) ?? null
  );
}

describe("repository content fragment links", () => {
  it("all EN/JA fragments resolve to hierarchical heading IDs", () => {
    const files = CONTENT_ROOTS.flatMap(collectContentFiles);
    const idCache = new Map<string, Set<string>>();
    const failures: string[] = [];

    for (const source of files) {
      const body = readFileSync(source, "utf8");
      const withoutCode = withoutFencedCode(body);
      // The path part is `*`, not `+`: a bare same-page fragment (`](#anchor)`)
      // has nothing before the `#`, and `resolveContentTarget` maps that empty
      // path back to the source file. Requiring a path here silently exempted
      // every same-page anchor from this guard (zudolab/zudo-doc#3131).
      const links = withoutCode.matchAll(/\]\(([^)\s]*#[^)\s]+)(?:\s+[^)]*)?\)/g);

      for (const match of links) {
        const href = match[1]!;
        if (/^(?:https?:|mailto:|javascript:)/.test(href)) continue;
        const target = resolveContentTarget(source, href);
        if (target === null) continue;

        let ids = idCache.get(target);
        if (ids === undefined) {
          const targetBody = readFileSync(target, "utf8");
          const allIds = allHierarchicalIds(targetBody);
          ids = new Set(allIds);
          idCache.set(target, ids);

          // Keep the test-only h5/h6 extension pinned to production behavior
          // for every emitted h2–h4 ID in the real corpus.
          const productionIds = extractHeadings(targetBody).map(
            (heading) => heading.slug,
          );
          for (const id of productionIds) expect(ids.has(id)).toBe(true);
        }

        const fragment = decodeURIComponent(href.slice(href.indexOf("#") + 1));
        if (!ids.has(fragment)) {
          const line = withoutCode.slice(0, match.index).split("\n").length;
          failures.push(
            `${source.slice(ROOT.length + 1)}:${line} -> ${href} (target: ${target.slice(ROOT.length + 1)})`,
          );
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
