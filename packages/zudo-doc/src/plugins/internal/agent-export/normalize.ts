/** Normalize MDX for a published text corpus without evaluating its modules. */
export function normalizeAgentMarkdown(source: string, pageUrl: string): { text: string; unsupportedDynamicContent: boolean } {
  let unsupportedDynamicContent = false;
  let fence: string | undefined;
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  for (const line of lines) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      const run = marker[1]!;
      if (!fence) fence = run;
      else if (run[0] === fence[0] && run.length >= fence.length) fence = undefined;
      output.push(line);
      continue;
    }
    if (fence) { output.push(line); continue; }
    if (/^\s*(?:import|export)\s/.test(line)) continue;
    let normalized = line.replace(/\{\/\*.*?\*\/\}/g, "");
    normalized = normalized.replace(/<([A-Z][\w.]*)\b[^>]*>/g, () => {
      unsupportedDynamicContent = true;
      return "[Dynamic content unavailable in text export]";
    });
    normalized = normalized.replace(/<\/([A-Z][\w.]*)\s*>/g, "");
    normalized = normalized.replace(/<\/?[a-z][\w-]*(?=[\s/>])[^>]*>/g, "");
    normalized = normalized.replace(/(!?\[[^\]]*\]\()([^\s)]+)([^)]*\))/g, (_all, before: string, target: string, after: string) => {
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#|\{)/i.test(target)) return `${before}${target}${after}`;
      try {
        const absolute = new URL(target, new URL(pageUrl, "https://agent.invalid"));
        return `${before}${absolute.origin === "https://agent.invalid" ? absolute.pathname + absolute.search + absolute.hash : absolute.toString()}${after}`;
      }
      catch { return `${before}${target}${after}`; }
    });
    output.push(normalized);
  }
  return { text: output.join("\n").trim(), unsupportedDynamicContent };
}
