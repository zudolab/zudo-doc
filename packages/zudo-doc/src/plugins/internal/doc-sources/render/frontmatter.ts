import { matter } from "../../../../frontmatter/index.js";

export function parseFrontmatter(content: string) {
  try {
    return matter(content);
  } catch {
    return null;
  }
}

/**
 * Render a string as a YAML scalar in mdx-formatter's canonical form, so a
 * formatter pass over generated output never rewrites it.
 */
export function formatFrontmatterString(value: string): string {
  // mdx-formatter's YAML emitter quotes these characters even when a YAML
  // parser can round-trip the unquoted scalar.
  const formatterRequiresQuotes =
    /["']/.test(value) ||
    /^[?:-]/.test(value) ||
    /^(?:yes|no|on|off)$/iu.test(value) ||
    /^\+?(?:nan|inf(?:inity)?)$/iu.test(value);

  if (!/[\r\n]/.test(value)) {
    try {
      const parsed = matter(`---\nvalue: ${value}\n---\n`).data.value;
      if (parsed === value && !formatterRequiresQuotes) return value;
    } catch {
      // Fall through to the JSON-compatible quoted YAML scalar.
    }
  }
  return JSON.stringify(value);
}

export type FrontmatterValue = string | number | boolean | undefined;

/** Render an ordered frontmatter block, omitting undefined values. */
export function renderFrontmatter(fields: Array<[string, FrontmatterValue]>): string {
  const lines = ["---"];
  for (const [key, value] of fields) {
    if (value === undefined) continue;
    lines.push(
      `${key}: ${typeof value === "string" ? formatFrontmatterString(value) : String(value)}`,
    );
  }
  lines.push("---");
  return lines.join("\n");
}
