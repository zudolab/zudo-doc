/** Normalize MDX for a published text corpus without evaluating its modules. */
export function normalizeAgentMarkdown(source: string, pageUrl: string, resolveSourceLink?: (target: string) => string | undefined): { text: string; unsupportedDynamicContent: boolean } {
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
  text = text.replace(/<([A-Z][\w.]*)\b[^>]*>/g, () => {
    unsupportedDynamicContent = true;
    return "[Dynamic content unavailable in text export]";
  });
  text = text.replace(/<\/([A-Z][\w.]*)\s*>/g, "");
  text = text.replace(/<\/?[a-z][\w-]*(?=[\s/>])[^>]*>/g, "");
  for (let i = literals.length - 1; i >= 0; i--) text = text.replaceAll(`${marker}${i}\u0000`, () => literals[i]!);
  return { text: text.trim(), unsupportedDynamicContent };
}
