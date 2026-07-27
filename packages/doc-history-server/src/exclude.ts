// DUPLICATED BY DESIGN — keep in sync with
// packages/zudo-doc/src/doc-history-exclude/index.ts (the canonical copy).
//
// `@takazudo/zudo-doc` used to import this module via the `/exclude` subpath,
// but it does so from its always-bundled chrome graph while this package is only
// an OPTIONAL peer — which broke `docHistory: false` builds at esbuild
// (zudolab/zudo-doc#3110). The reverse direction is not available either: this
// package is a standalone, dependency-free Node server/CLI and cannot take on
// `@takazudo/zudo-doc` (framework peers + a package cycle). Hence two copies,
// pinned together by
// packages/zudo-doc/src/doc-history-exclude/__tests__/parity.test.ts.
//
// The `./exclude` subpath export stays published — removing it would be a
// breaking change for any external consumer.

/** Compile doc-history exclude globs into a reusable slug predicate. */
export function compileExclude(patterns: string[]): (slug: string) => boolean {
  const matchers = patterns.map((pattern) => {
    let source = "";

    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];

      // A trailing /** includes the parent itself because ** may span zero
      // segments. Elsewhere, **/ consumes any number of complete segments.
      if (char === "/" && pattern.slice(i + 1) === "**") {
        source += "(?:/.*)?";
        break;
      }
      if (pattern.slice(i, i + 3) === "**/") {
        source += "(?:[^/]+/)*";
        i += 2;
        continue;
      }
      if (pattern.slice(i, i + 2) === "**") {
        source += ".*";
        i++;
        continue;
      }
      if (char === "*") {
        source += "[^/]*";
        continue;
      }
      if (char === "?") {
        source += "[^/]";
        continue;
      }

      source += char?.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }

    return new RegExp(`^${source}$`);
  });

  return (slug) => matchers.some((matcher) => matcher.test(slug));
}
