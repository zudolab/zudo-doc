/**
 * Lightweight markdown-to-HTML renderer for chat messages.
 * Escapes HTML first, then applies markdown patterns — safe by construction.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Allowlist used by `renderInline` link rewrites. Anything outside this
// set (javascript:, data:, file:, vbscript:, etc.) renders as plain text
// so the markdown layer cannot smuggle a hostile scheme into an href.
const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:"]);

function unescapeHtml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function safeHref(rawCapturedUrl: string): string | null {
  // The captured URL has already been HTML-escaped by `escapeHtml` so we
  // need the original characters before validating with `URL`.
  const decoded = unescapeHtml(rawCapturedUrl);
  let parsed: URL;
  try {
    parsed = new URL(decoded);
  } catch {
    return null;
  }
  if (!ALLOWED_LINK_PROTOCOLS.has(parsed.protocol)) return null;
  // Re-encode and re-escape so the value embedded in `href` cannot break
  // attribute quoting or reintroduce control characters.
  return escapeHtml(encodeURI(decoded));
}

function renderInline(text: string): string {
  // Extract inline code first so bold/italic don't process inside backticks
  const codeSpans: string[] = [];
  let processed = text.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${code}</code>`);
    return `%%CODE_${idx}%%`;
  });

  processed = processed
    // bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // italic: *text* or _text_ (not inside words for _)
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>")
    // links: [text](url) — http(s) only, validated via URL parser
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_match, label, url) => {
      const href = safeHref(url);
      if (href === null) return `[${label}](${url})`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

  // Restore inline code spans
  return processed.replace(/%%CODE_(\d+)%%/g, (_match, idx) => codeSpans[parseInt(idx, 10)] ?? "");
}

/**
 * Render a block containing list lines without dropping interleaved prose
 * lines (e.g. "Here are the steps:\n- a\n- b" keeps the lead-in as a <p>).
 */
function renderListBlock(block: string, marker: RegExp, tag: "ul" | "ol"): string {
  const parts: string[] = [];
  let proseLines: string[] = [];
  let listItems: string[] = [];
  const flushProse = () => {
    if (proseLines.length > 0) {
      parts.push(`<p>${proseLines.map(renderInline).join("<br>")}</p>`);
      proseLines = [];
    }
  };
  const flushList = () => {
    if (listItems.length > 0) {
      parts.push(`<${tag}>${listItems.join("")}</${tag}>`);
      listItems = [];
    }
  };
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (marker.test(line)) {
      flushProse();
      listItems.push(`<li>${renderInline(line.replace(marker, ""))}</li>`);
    } else {
      flushList();
      proseLines.push(line);
    }
  }
  flushProse();
  flushList();
  return parts.join("");
}

export function renderMarkdown(src: string): string {
  // Escape HTML first — all subsequent replacements only add safe tags
  const escaped = escapeHtml(src);

  // Extract fenced code blocks before processing
  const codeBlocks: string[] = [];
  const withPlaceholders = escaped.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang, code) => {
      const idx = codeBlocks.length;
      const langAttr = lang ? ` data-language="${lang}"` : "";
      codeBlocks.push(`<pre${langAttr}><code>${code.trimEnd()}</code></pre>`);
      return `\n%%CODEBLOCK_${idx}%%\n`;
    },
  );

  // Split into paragraphs by double newline
  const blocks = withPlaceholders.split(/\n{2,}/);
  const rendered = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";

      // Code block placeholder
      const cbMatch = trimmed.match(/^%%CODEBLOCK_(\d+)%%$/);
      if (cbMatch) return codeBlocks[parseInt(cbMatch[1] ?? "0", 10)] ?? "";

      // Unordered list (lines starting with - or *)
      if (/^[-*] /m.test(trimmed)) {
        return renderListBlock(trimmed, /^[-*] /, "ul");
      }

      // Ordered list (lines starting with 1. 2. etc.)
      if (/^\d+\. /m.test(trimmed)) {
        return renderListBlock(trimmed, /^\d+\. /, "ol");
      }

      // Heading (# to ###)
      const headingMatch = trimmed.match(/^(#{1,3}) (.+)$/);
      if (headingMatch) {
        const hashes = headingMatch[1] ?? "";
        const headingText = headingMatch[2] ?? "";
        const level = hashes.length;
        return `<h${level + 3}>${renderInline(headingText)}</h${level + 3}>`;
      }

      // Regular paragraph — convert single newlines to <br>
      const lines = trimmed.split("\n").map(renderInline).join("<br>");
      return `<p>${lines}</p>`;
    })
    .filter(Boolean)
    .join("");

  return rendered;
}
