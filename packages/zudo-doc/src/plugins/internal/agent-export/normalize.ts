/** Literal JSX attribute values; `true` stands for a bare boolean attribute. */
export type AgentTagProps = Record<string, string | number | boolean | null | unknown[] | Record<string, unknown>>;

export interface AgentComponentTag {
  name: string;
  /** Undefined when any attribute is a non-literal expression or a spread. */
  props: AgentTagProps | undefined;
  selfClosing: boolean;
}

/**
 * Text that replaces a capitalised JSX opening tag, or undefined to keep the
 * named placeholder. `unsupported` flags the page even when text is returned.
 */
export type AgentComponentRenderer = (tag: AgentComponentTag) => { text: string; unsupported?: boolean } | undefined;

export function dynamicContentPlaceholder(name: string): string {
  return `[Dynamic content unavailable in text export: ${name}]`;
}

/** Index just past the brace that closes the `{` at `start`, skipping string and template contents. */
function skipBraces(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "\"" || ch === "'" || ch === "`") {
      for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === "\\") i++;
    } else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i + 1;
  }
  return -1;
}

function literalExpression(expression: string): { value: unknown } | undefined {
  const trimmed = expression.trim();
  const template = trimmed.match(/^`([^`$\\]*)`$/);
  if (template) return { value: template[1] };
  try {
    return { value: JSON.parse(trimmed.replace(/,(\s*[\]}])/g, "$1")) };
  } catch {
    return undefined;
  }
}

/** Parse `<Name ...>` at `start`; undefined when it is not a well-formed opening tag. */
function parseOpeningTag(text: string, start: number): (AgentComponentTag & { end: number }) | undefined {
  const name = text.slice(start + 1).match(/^[A-Z][\w.]*/)?.[0];
  if (!name) return undefined;
  let i = start + 1 + name.length;
  if (i < text.length && !/[\s/>]/.test(text[i]!)) return undefined;
  let props: AgentTagProps | undefined = {};
  while (i < text.length) {
    while (/\s/.test(text[i] ?? "")) i++;
    if (text[i] === ">") return { name, props, selfClosing: false, end: i + 1 };
    if (text.startsWith("/>", i)) return { name, props, selfClosing: true, end: i + 2 };
    if (text[i] === "{") {
      const end = skipBraces(text, i);
      if (end < 0) return undefined;
      props = undefined;
      i = end;
      continue;
    }
    const attr = text.slice(i).match(/^[A-Za-z_:][\w:.-]*/)?.[0];
    if (!attr) return undefined;
    i += attr.length;
    while (/[ \t]/.test(text[i] ?? "")) i++;
    if (text[i] !== "=") {
      if (props) props[attr] = true;
      continue;
    }
    i++;
    while (/\s/.test(text[i] ?? "")) i++;
    const quote = text[i];
    if (quote === "\"" || quote === "'") {
      const end = text.indexOf(quote, i + 1);
      if (end < 0) return undefined;
      if (props) props[attr] = text.slice(i + 1, end);
      i = end + 1;
    } else if (quote === "{") {
      const end = skipBraces(text, i);
      if (end < 0) return undefined;
      const literal = literalExpression(text.slice(i + 1, end - 1));
      if (!literal) props = undefined;
      else if (props) props[attr] = literal.value as AgentTagProps[string];
      i = end;
    } else return undefined;
  }
  return undefined;
}

/** Replace capitalised JSX opening tags with rendered text or a named placeholder; drop their closing tags. */
function replaceComponentTags(text: string, render: AgentComponentRenderer | undefined): { text: string; unsupported: boolean } {
  let unsupported = false;
  let out = "";
  let offset = 0;
  for (let i = text.indexOf("<"); i >= 0; i = text.indexOf("<", i + 1)) {
    if (i < offset || !/[A-Z]/.test(text[i + 1] ?? "")) continue;
    let tag = parseOpeningTag(text, i);
    if (!tag) {
      // Unparseable attributes (e.g. an arrow function) still hide the tag.
      const loose = text.slice(i).match(/^<([A-Z][\w.]*)\b[^>]*>/);
      if (!loose) continue;
      tag = { name: loose[1]!, props: undefined, selfClosing: loose[0].endsWith("/>"), end: i + loose[0].length };
    }
    const rendered = render?.(tag);
    if (!rendered || rendered.unsupported) unsupported = true;
    // A label written inline with its body (`<Details title="x">Body`) still needs a block break.
    const gap = rendered?.text && /\S/.test(text[tag.end] ?? "") ? "\n\n" : "";
    out += text.slice(offset, i) + (rendered ? rendered.text + gap : dynamicContentPlaceholder(tag.name));
    offset = tag.end;
  }
  return { text: out + text.slice(offset), unsupported };
}

/** Normalize MDX for a published text corpus without evaluating its modules. */
export function normalizeAgentMarkdown(source: string, pageUrl: string, resolveSourceLink?: (target: string) => string | undefined, renderComponent?: AgentComponentRenderer): { text: string; unsupportedDynamicContent: boolean } {
  let unsupportedDynamicContent = false;
  // Shield code before processing prose: examples containing JSX, comments or
  // Markdown links must remain literal, including multi-backtick code spans.
  const literals: string[] = [];
  let marker = "\u0000agent-code:";
  while (source.includes(marker)) marker += ":";
  const shield = (value: string): string => `${marker}${literals.push(value) - 1}\u0000`;
  let fence: string | undefined;
  const fenced: string[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const prose: string[] = [];
  for (const line of lines) {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      fenced.push(line);
      if (match && match[1]![0] === fence[0] && match[1]!.length >= fence.length && !match[2]!.trim()) {
        prose.push(shield(fenced.join("\n")));
        fenced.length = 0;
        fence = undefined;
      }
    } else if (match) {
      fence = match[1]!;
      fenced.push(line);
    } else prose.push(line);
  }
  if (fenced.length) prose.push(shield(fenced.join("\n")));
  let text = prose.join("\n");
  // A closing delimiter must have exactly the opening run's length.
  const runs = [...text.matchAll(/`+/g)];
  let offset = 0;
  let protectedText = "";
  for (let i = 0; i < runs.length; i++) {
    const opening = runs[i]!;
    const closingIndex = runs.findIndex((run, j) => j > i && run[0].length === opening[0].length);
    if (closingIndex < 0) continue;
    const end = runs[closingIndex]!.index! + opening[0].length;
    protectedText += text.slice(offset, opening.index) + shield(text.slice(opening.index, end));
    offset = end;
    i = closingIndex;
  }
  text = protectedText + text.slice(offset);
  text = text.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  text = text.replace(/^[ \t]*import[ \t]+(?:type[ \t]+)?(?:[\w$]+[ \t]*,[ \t]*)?\{[^}]*\}[ \t]*from[ \t]*["'][^"'\n]+["'][ \t]*;?[ \t]*$/gm, "");
  text = text.replace(/^\s*(?:import|export)[^\S\n]+.*$/gm, "");
  const resolveLink = (target: string): string => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/|\{)/i.test(target)) return target;
    const sourceUrl = resolveSourceLink?.(target);
    if (sourceUrl !== undefined) return sourceUrl;
    try {
      const absolute = new URL(target, new URL(pageUrl, "https://agent.invalid"));
      return absolute.origin === "https://agent.invalid" ? absolute.pathname + absolute.search + absolute.hash : absolute.toString();
    } catch { return target; }
  };
  text = text.replace(/(!?\[[^\]]*\]\()(?:<([^>]+)>|([^\s)]+))([^)]*\))/g,
    (_all, before: string, angled: string | undefined, plain: string | undefined, after: string) =>
      shield(before + (angled !== undefined ? `<${resolveLink(angled)}>` : resolveLink(plain!)) + after));
  text = text.replace(/^( {0,3}\[[^\]]+\]:[ \t]*)(?:<([^>]+)>|([^\s]+))/gm,
    (_all, before: string, angled: string | undefined, plain: string | undefined) =>
      shield(before + (angled !== undefined ? `<${resolveLink(angled)}>` : resolveLink(plain!))));
  ({ text, unsupported: unsupportedDynamicContent } = replaceComponentTags(text, renderComponent));
  text = text.replace(/<\/([A-Z][\w.]*)\s*>/g, "");
  text = text.replace(/<\/?[a-z][\w-]*(?=[\s/>])[^>]*>/g, "");
  for (let i = literals.length - 1; i >= 0; i--) text = text.replaceAll(`${marker}${i}\u0000`, () => literals[i]!);
  return { text: text.trim(), unsupportedDynamicContent };
}
