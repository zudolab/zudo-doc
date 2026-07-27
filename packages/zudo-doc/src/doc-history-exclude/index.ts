// doc-history exclude matcher — CANONICAL COPY (zudolab/zudo-doc#3110).
//
// This function used to live only in `@takazudo/zudo-doc-history-server`
// (`/exclude`) and was imported from there by `doc-history-area`. That inverted
// the dependency direction: `doc-history-area` sits in the ALWAYS-bundled chrome
// graph (`packageOwnedRoutes`), so esbuild had to resolve the specifier on every
// build — but `@takazudo/zudo-doc-history-server` is an OPTIONAL peer, absent in
// `docHistory: false` projects. Result: `Could not resolve
// "@takazudo/zudo-doc-history-server/exclude"` at bundle time (regression in
// 4.3.0, from the exclude-filtering work #2962/#2973).
//
// The matcher therefore lives here, in the always-present package, and is
// imported RELATIVELY by its two consumers (`doc-history-area`,
// `plugins/internal/doc-history/pre-build`). Deliberately NOT a public subpath
// export — the consumers are internal, and a `./doc-history-exclude` entry would
// create permanent public API surface for no gain.
//
// `@takazudo/zudo-doc-history-server` keeps its own `/exclude` copy: it is a
// standalone, dependency-free Node server/CLI, so it cannot import this package
// (that would drag in preact/zfb/zod peers and create a package cycle). The two
// copies are pinned together by the behavioural parity test in
// `__tests__/parity.test.ts` — edit both, or that test fails.
//
// Keep this module dependency-free and browser-safe (no node builtins): it is
// reachable from SSR/client chrome code.

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
