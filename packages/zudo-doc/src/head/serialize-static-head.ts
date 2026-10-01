// workaround for https://github.com/Takazudo/zudo-front-builder/issues/3359
import { Island } from "@takazudo/zfb";
import { Fragment, isDescription } from "@takazudo/zfb/zudo-react";
import type { Child, Description } from "@takazudo/zfb/zudo-react";

const HEAD_TAGS = new Set([
  "base",
  "link",
  "meta",
  "noscript",
  "script",
  "style",
  "title",
]);
const VOID_TAGS = new Set(["base", "link", "meta"]);
const BOOLEAN_ATTRIBUTES = new Set(["async", "defer", "disabled", "nomodule"]);
const MAX_DEPTH = 64;
const MAX_NODES = 10_000;

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function assertStaticScriptOrStyle(tag: string, value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`Static head <${tag}> requires a string rawHtml payload`);
  }
  if (/<!--\/?zr:1:|data-zfb-island(?:-skip-ssr)?\s*=/i.test(value)) {
    throw new TypeError(`Static head <${tag}> contains a reserved island boundary`);
  }
  if (new RegExp(`</${tag}`, "i").test(value)) {
    throw new TypeError(`Static head <${tag}> rawHtml contains a closing tag`);
  }
}

function serializeAttributes(tag: string, props: Readonly<Record<string, unknown>>): string {
  let html = "";
  for (const [name, value] of Object.entries(props)) {
    if (name === "children" || name === "key" || name === "ref" || name === "rawHtml") {
      continue;
    }
    if (!/^[a-z][a-z\d:_-]*$/.test(name)) {
      throw new TypeError(`Invalid static head attribute name: ${name}`);
    }
    if (/^on(?!load$)/i.test(name)) {
      throw new TypeError(`Static head event attribute is not supported: ${name}`);
    }
    if (name === "onload") {
      const safeMediaSwap =
        tag === "link" &&
        typeof value === "string" &&
        /^this\.media='[a-z\d\s(),:.%+\-/*<>=]*'$/i.test(value);
      if (!safeMediaSwap) {
        throw new TypeError("Static head supports only bounded link media onload handlers");
      }
    }
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      if (name.startsWith("data-") || name.startsWith("aria-")) {
        html += ` ${name}="${value}"`;
      } else if (BOOLEAN_ATTRIBUTES.has(name) && value) {
        html += ` ${name}=""`;
      } else if (!BOOLEAN_ATTRIBUTES.has(name)) {
        throw new TypeError(`Static head boolean attribute is not supported: ${name}`);
      }
      continue;
    }
    if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new TypeError(`Static head attribute ${name} must be a scalar`);
    }
    html += ` ${name}="${escapeAttribute(String(value))}"`;
  }
  return html;
}

function serializeNode(
  value: Child,
  parentTag: string | null,
  depth: number,
  budget: { nodes: number },
): string {
  budget.nodes += 1;
  if (budget.nodes > MAX_NODES || depth > MAX_DEPTH) {
    throw new TypeError("Static head description exceeds its serialization bounds");
  }
  if (value === null || value === undefined || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number") {
    if (parentTag !== "title") {
      if (String(value).trim() === "") return "";
      throw new TypeError("Text is only allowed inside a static head <title>");
    }
    return escapeText(String(value));
  }
  if (Array.isArray(value)) {
    return value
      .map((child) => serializeNode(child, parentTag, depth + 1, budget))
      .join("");
  }
  if (!isDescription(value)) {
    throw new TypeError("Static head children must be pure zudo-react descriptions");
  }

  const description = value as Description;
  const { type, props } = description;
  if (type === Fragment) {
    return serializeNode(props.children as Child, parentTag, depth + 1, budget);
  }
  if (typeof type === "function") {
    if (type === Island) {
      throw new TypeError("Static head descriptions cannot contain islands");
    }
    return serializeNode(type(props), parentTag, depth + 1, budget);
  }
  if (typeof type !== "string" || !HEAD_TAGS.has(type)) {
    throw new TypeError(`Unsupported static head element: ${String(type)}`);
  }
  if (parentTag === "title") {
    throw new TypeError("Static head <title> accepts text only");
  }
  if (parentTag !== null && parentTag !== "noscript") {
    throw new TypeError(`Static head <${parentTag}> cannot contain <${type}>`);
  }

  const children = props.children as Child;
  const hasChildren = Object.hasOwn(props, "children");
  const rawHtml = props.rawHtml;
  if (VOID_TAGS.has(type) && (hasChildren || rawHtml !== undefined)) {
    throw new TypeError(`Static head <${type}> cannot have children`);
  }
  if ((type === "script" || type === "style") && hasChildren) {
    throw new TypeError(`Static head <${type}> requires rawHtml and cannot have children`);
  }

  const attributes = serializeAttributes(type, props);
  if (VOID_TAGS.has(type)) return `<${type}${attributes}>`;
  if (type === "script" || type === "style") {
    assertStaticScriptOrStyle(type, rawHtml);
    return `<${type}${attributes}>${rawHtml}</${type}>`;
  }
  if (rawHtml !== undefined) {
    throw new TypeError(`Static head <${type}> does not accept rawHtml`);
  }
  if (type === "title") {
    return `<title${attributes}>${serializeNode(children, type, depth + 1, budget)}</title>`;
  }
  return `<${type}${attributes}>${serializeNode(children, type, depth + 1, budget)}</${type}>`;
}

/**
 * Serialize the pure descriptions used by the document head into one static
 * HTML payload. The bounded tag set preserves authored head order while
 * escaping text and attributes; executable script/style content must already
 * be a trusted static rawHtml string and cannot contain closing tags or island
 * boundary markers.
 */
export function serializeStaticHead(children: Child): string {
  return serializeNode(children, null, 0, { nodes: 0 });
}
