// Minimal, deterministic glob matching for doc-source selections.
//
// Patterns are matched against POSIX paths relative to a mapping root.
// Supported syntax: `**` (any number of path segments), `*` (within one
// segment), `?`, `{a,b}` alternation and `[...]` character classes. Dot
// entries are matched like any other name; exclusions are always explicit.

const cache = new Map<string, RegExp>();

function escapeRegExp(char: string): string {
  return /[\\^$.*+?()[\]{}|/]/.test(char) ? `\\${char}` : char;
}

function translate(pattern: string): string {
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i]!;
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        const atSegmentStart = i === 0 || pattern[i - 1] === "/";
        const atSegmentEnd = i + 2 === pattern.length || pattern[i + 2] === "/";
        if (atSegmentStart && atSegmentEnd) {
          if (i + 2 === pattern.length) {
            out += ".*";
            i += 2;
          } else {
            out += "(?:.*/)?";
            i += 3;
          }
          continue;
        }
      }
      out += "[^/]*";
      i++;
      continue;
    }
    if (char === "?") {
      out += "[^/]";
      i++;
      continue;
    }
    if (char === "[") {
      const close = pattern.indexOf("]", i + 1);
      if (close > i + 1) {
        let body = pattern.slice(i + 1, close);
        if (body.startsWith("!")) body = `^${body.slice(1)}`;
        out += `[${body.replace(/\\/g, "\\\\")}]`;
        i = close + 1;
        continue;
      }
    }
    if (char === "{") {
      const close = pattern.indexOf("}", i + 1);
      if (close > i) {
        const alternatives = pattern.slice(i + 1, close).split(",");
        out += `(?:${alternatives.map(translate).join("|")})`;
        i = close + 1;
        continue;
      }
    }
    out += escapeRegExp(char);
    i++;
  }
  return out;
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/^\.\//, "");
  let regex = cache.get(normalized);
  if (regex === undefined) {
    regex = new RegExp(`^${translate(normalized)}$`);
    cache.set(normalized, regex);
  }
  return regex;
}

export function matchesAny(relPath: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(relPath));
}

/**
 * Whether an excluded pattern removes a whole directory, so a walk can prune
 * it. A directory is pruned when the pattern matches the directory itself or
 * every possible descendant (probed with a synthetic child name).
 */
export function excludesDirectory(dirRel: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    const regex = globToRegExp(pattern);
    return regex.test(dirRel) ||
      (regex.test(`${dirRel}/\u0000probe`) && regex.test(`${dirRel}/\u0000a/\u0000b`));
  });
}
