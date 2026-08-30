import type { AssetExcerpt } from "../../../route-context-payload/types.js";

export const MAX_HIGHLIGHT_BYTES = 1_048_576;
export const MAX_INLINE_BYTES = 5_242_880;
export const MAX_PLAIN_LINES = 2_000;
export const MAX_EXCERPT_LINES = 200;

export interface HighlightAssetResult {
  html: string | null;
  plain: boolean;
  previewable: boolean;
  truncated: boolean;
}

export interface SlicedLines {
  text: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  truncated: boolean;
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[character]!,
  );
}

/** Split text the same way as the highlighter: a terminal newline belongs to
 * the preceding line and does not manufacture an additional empty line. */
function sourceLines(text: string): string[] {
  if (text.length === 0) return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line, index) =>
    index < lines.length - 1 || text.endsWith("\n") ? `${line}\n` : line,
  );
}

function fallbackHtml(text: string): string {
  const body = sourceLines(text)
    .map((line) => `<span class="line">${escapeHtml(line)}</span>`)
    .join("");
  return `<pre class="hi-root"><code>${body}</code></pre>`;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function truncatePlainText(text: string): { text: string; truncated: boolean } {
  const lines = sourceLines(text);
  if (lines.length <= MAX_PLAIN_LINES) {
    return { text, truncated: false };
  }
  return {
    text: lines.slice(0, MAX_PLAIN_LINES).join(""),
    truncated: true,
  };
}

function plainResult(
  text: string,
  highlightedHtml?: string,
): HighlightAssetResult {
  const plain = truncatePlainText(text);
  return {
    html:
      highlightedHtml !== undefined && !plain.truncated
        ? highlightedHtml
        : fallbackHtml(plain.text),
    plain: true,
    previewable: true,
    truncated: plain.truncated,
  };
}

/**
 * Render a text asset. The optional WASM peer stays behind this awaited lazy
 * import; callers invoke this function only from the feature-gated asset-body
 * loader.
 */
export async function highlightAsset(
  text: string,
  language: string,
): Promise<HighlightAssetResult> {
  const bytes = byteLength(text);
  if (bytes > MAX_INLINE_BYTES) {
    return {
      html: null,
      plain: true,
      previewable: false,
      truncated: false,
    };
  }

  if (bytes > MAX_HIGHLIGHT_BYTES) {
    return plainResult(text);
  }

  try {
    const { highlightCode } = await import(
      "@takazudo/zfb-md-wasm/highlight"
    );
    const result = await highlightCode(text, { language, mode: "class" });
    const hasError = result.diagnostics.some(
      (diagnostic) => diagnostic.severity === "error",
    );

    if (result.html == null || hasError) {
      return plainResult(text);
    }

    if (result.diagnostics.length > 0) {
      return plainResult(text, result.html);
    }

    return {
      html: result.html,
      plain: false,
      previewable: true,
      truncated: false,
    };
  } catch {
    return plainResult(text);
  }
}

function hasLineClass(attributes: string): boolean {
  const classMatch = attributes.match(/\bclass\s*=\s*(["'])(.*?)\1/);
  return classMatch?.[2]?.split(/\s+/).includes("line") === true;
}

/** Add stable full-viewer anchors without disturbing nested hi-* tokens. */
export function withLineIds(html: string): string {
  let lineNumber = 0;
  return html.replace(/<span\b([^>]*)>/g, (tag, attributes: string) => {
    if (!hasLineClass(attributes)) return tag;
    lineNumber += 1;
    if (/(?:^|\s)id\s*=/.test(attributes)) return tag;
    return `<span${attributes} id="L${lineNumber}">`;
  });
}

export function sliceLines(
  text: string,
  start: number,
  end: number,
): SlicedLines {
  const lines = sourceLines(text);
  const totalLines = lines.length;
  if (totalLines === 0) {
    return {
      text: "",
      startLine: 0,
      endLine: 0,
      totalLines: 0,
      truncated: false,
    };
  }

  const requestedStart = Number.isFinite(start) ? Math.trunc(start) : 1;
  const requestedEnd = Number.isFinite(end) ? Math.trunc(end) : requestedStart;
  const startLine = Math.min(totalLines, Math.max(1, requestedStart));
  const clampedEnd = Math.min(totalLines, Math.max(1, requestedEnd));
  const boundedEnd = Math.max(startLine, clampedEnd);
  const endLine = Math.min(
    boundedEnd,
    startLine + MAX_EXCERPT_LINES - 1,
  );

  return {
    text: lines.slice(startLine - 1, endLine).join(""),
    startLine,
    endLine,
    totalLines,
    truncated: boundedEnd > endLine,
  };
}

function withExcerptLineNumbers(html: string, startLine: number): string {
  let lineNumber = startLine;
  return html.replace(/<span\b([^>]*)>/g, (tag, attributes: string) => {
    if (!hasLineClass(attributes)) return tag;
    const cleanAttributes = attributes
      .replace(/\s+id\s*=\s*(["']).*?\1/g, "")
      .replace(/\s+data-line\s*=\s*(["']).*?\1/g, "");
    const transformed = `<span${cleanAttributes} data-line="${lineNumber}">`;
    lineNumber += 1;
    return transformed;
  });
}

export async function renderExcerpt(
  text: string,
  language: string,
  start: number,
  end: number,
  totalLines: number,
): Promise<AssetExcerpt> {
  const normalizedTotal = Number.isFinite(totalLines)
    ? Math.max(0, Math.trunc(totalLines))
    : 0;
  if (normalizedTotal === 0) {
    return {
      html: '<pre class="hi-root"><code></code></pre>',
      startLine: 0,
      endLine: 0,
      totalLines: 0,
      truncated: false,
    };
  }

  const requestedStart = Number.isFinite(start) ? Math.trunc(start) : 1;
  const requestedEnd = Number.isFinite(end) ? Math.trunc(end) : requestedStart;
  const clampedStart = Math.min(
    normalizedTotal,
    Math.max(1, requestedStart),
  );
  const clampedEnd = Math.min(
    normalizedTotal,
    Math.max(clampedStart, requestedEnd),
  );
  const sliced = sliceLines(text, clampedStart, clampedEnd);
  const highlighted = await highlightAsset(sliced.text, language);

  return {
    html:
      highlighted.html == null
        ? ""
        : withExcerptLineNumbers(highlighted.html, sliced.startLine),
    startLine: sliced.startLine,
    endLine: sliced.endLine,
    totalLines: normalizedTotal,
    truncated: sliced.truncated,
  };
}
