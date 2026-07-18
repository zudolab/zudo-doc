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
