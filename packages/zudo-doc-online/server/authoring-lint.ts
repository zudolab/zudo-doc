/**
 * Authoring lint for page bodies.
 *
 * These are the zudo-doc content conventions an author (human or agent) is
 * most likely to get wrong when writing from outside the framework. They are
 * WARNINGS, never errors: a write always lands, and the response carries the
 * advice. Blocking a save on a style rule would be the wrong trade for an
 * agent that is mid-edit, and a half-written page is a legitimate state.
 *
 * The rules encode conventions that live outside this codebase (zudo-doc's
 * markdown dialect), which is why each one carries the reason in its message —
 * the MCP surface hands these straight to an agent as teaching material.
 */

export type AuthoringWarningCode =
  | "h1-in-body"
  | "unknown-directive"
  | "brace-admonition-title";

export interface AuthoringWarning {
  code: AuthoringWarningCode;
  message: string;
  /** 1-based line in the markdown body, when the rule points at one. */
  line?: number;
}

/** The complete admonition vocabulary — anything else renders as plain text. */
export const KNOWN_DIRECTIVES = [
  "note",
  "tip",
  "info",
  "warning",
  "danger",
  "caution",
  "details",
] as const;

export type KnownDirective = (typeof KNOWN_DIRECTIVES)[number];

const KNOWN_DIRECTIVE_SET: ReadonlySet<string> = new Set(KNOWN_DIRECTIVES);

/** An ATX heading may be indented up to three spaces; four would be code. */
const ATX_H1 = /^ {0,3}#(?!#)\s*\S/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const DIRECTIVE_OPEN = /^ {0,3}:::\s*([A-Za-z][A-Za-z0-9-]*)/;
const BRACE_TITLE = /\{\s*title\s*=/;

/**
 * Scans a page body. Fenced code is skipped so a markdown tutorial that shows
 * `# Heading` inside a fence is not lectured about its own example.
 */
export function lintMarkdown(markdown: string): AuthoringWarning[] {
  const warnings: AuthoringWarning[] = [];
  const lines = markdown.split(/\r\n|\r|\n/);

  let openFence: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] ?? "";
      if (openFence === null) {
        openFence = marker[0] ?? "`";
        continue;
      }
      if (marker.startsWith(openFence)) openFence = null;
      continue;
    }
    if (openFence !== null) continue;

    if (ATX_H1.test(line)) {
      warnings.push({
        code: "h1-in-body",
        line: lineNumber,
        message:
          "A page body must start at h2 (##). The frontmatter title is rendered as the page's only h1.",
      });
    }

    const directive = DIRECTIVE_OPEN.exec(line);
    if (directive) {
      const name = directive[1] ?? "";
      if (!KNOWN_DIRECTIVE_SET.has(name)) {
        warnings.push({
          code: "unknown-directive",
          line: lineNumber,
          message: `Unknown directive ":::${name}". Supported directives: ${KNOWN_DIRECTIVES.join(", ")}.`,
        });
      }
      if (BRACE_TITLE.test(line)) {
        warnings.push({
          code: "brace-admonition-title",
          line: lineNumber,
          message:
            'A directive title uses bracket syntax — ":::note[Title]". The {title="..."} form is not supported.',
        });
      }
    }
  }

  return warnings;
}
