const TOKEN_RUN = /[a-z0-9_]+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+/gu;
const IDENTIFIER = /^[a-z0-9_]+$/;

/** Pure tokenizer shared by Node export code and workerd retrieval. */
export function tokenizeAgentText(input: string): string[] {
  const normalized = input.normalize("NFKC").toLowerCase();
  const tokens = new Set<string>();
  for (const match of normalized.matchAll(TOKEN_RUN)) {
    const run = match[0];
    if (IDENTIFIER.test(run)) {
      tokens.add(run);
      continue;
    }
    const points = Array.from(run);
    for (let i = 0; i < points.length; i += 1) {
      tokens.add(points[i]!);
      if (i + 1 < points.length) tokens.add(points[i]! + points[i + 1]!);
    }
  }
  return [...tokens].sort();
}
