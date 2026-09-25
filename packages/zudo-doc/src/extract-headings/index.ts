// extract-headings — extract TOC headings from a raw MDX body.
// Moved from the showcase's `pages/lib/_extract-headings.ts` into the shared
// package as part of the package-first migration (epic #2321, S4 #2327).
//
// Key change: the original read `settings.tocMinDepth` and
// `settings.tocMaxDepth` directly (a project singleton import). The
// package-side version takes those values as explicit parameters so the
// package never imports the project's settings singleton.
//
// The showcase re-exports this from `@takazudo/zudo-doc/extract-headings` and
// passes the values from the local `settings` object at each call site.
//
// Algorithm:
//   1. Walk the body line-by-line looking for ATX-style markdown headings
//      (`## Text` through `###### Text`, h2–h6).
//   2. Strip inline markdown markup (links, inline code, bold, italic) from the
//      heading text to get the plain visible text — matching what the renderer's
//      `extractText` HAST walker sees after MDX → HTML conversion.
//   3. Compute a hierarchical heading ID that matches what zfb's Rust
//      `HeadingLinks` plugin emits at render time. IDs are ancestor-prefixed
//      (`## Foo` / `### Moo` / `#### Mew` → `foo`, `foo-moo`,
//      `foo-moo-mew`) and deduped on the full path. The allocator runs over ALL
//      matched h2–h6 so its per-document state stays in lockstep with the
//      renderer. h1 is NOT slugged — the renderer never assigns an id to h1.
//   4. Return only depth 2–4 headings by default (h1 is the page title; h5–h6
//      are too granular). The window is configurable via `tocMinDepth` /
//      `tocMaxDepth` in opts (restriction-only: min 2, max 4).
//
// Caveats:
//   - This is a line walk over raw text, not an AST parse. A small scanner
//     (`classifyLines`) mirrors how zfb's MDX parser (markdown-rs) delimits JSX
//     so that `##` lines inside a multi-line JSX expression (`{…}`, a template
//     literal in an attribute, a `{/* … */}` comment) or inside a multi-line
//     quoted attribute value are not headings (#4396). Headings in JSX
//     *children* stay headings — the renderer assigns them ids too.
//   - Expression braces are counted naively, exactly like markdown-rs: it does
//     not look inside JS strings, template literals or comments when finding the
//     closing `}` (a `}` inside `"…"` closes the expression and fails the
//     compile). A string-aware count would diverge from the renderer on valid
//     documents — `render={() => <p>It's</p>}` would open a phantom `'` string
//     and swallow every heading after it.
//   - `.md` files are scanned the same way: zfb's `compile()` build path parses
//     `.md` content as MDX too (a `{` in `.md` prose opens an expression there).
//   - Fail-open: a construct still open at end of document (the renderer rejects
//     such a document with an unexpected-EOF error) is re-read as literal text,
//     so the headings after it are restored instead of silently dropped. A bare
//     open tag (`<Foo` with no quote or `{` pending) is abandoned as soon as a
//     character that cannot continue a JSX tag appears — such as the `#` of a
//     heading line — so a stray `a <b` in prose never hides a heading either.
//   - Lines inside code fences (``` … ``` or ~~~ … ~~~) are skipped to avoid
//     treating literal `## code` examples as real headings. Fence detection
//     uses `line.trimStart()` to handle indented fences correctly.
//   - Reference-style links (`[text][id]`) and image links (`![alt](url)`)
//     are not stripped — uncommon in headings, treated as plain text.
//   - The renderer slugs all h2–h6 regardless of `tocMinDepth`/`tocMaxDepth`, so
//     this extractor must also allocate over every matched heading (including
//     those outside the emit window) to keep the shared dedup counter / ancestor
//     stack in sync.
//   - Slug parity: we port zfb's exact Rust `slugify` (see `slugify` below)
//     instead of using npm `github-slugger`, because the two diverge on
//     punctuation (`.` → `-` vs removed, `/`/`—` collapsing, etc.) and that
//     divergence would desync the TOC anchor from the rendered heading id.
//   - Residual risk: text-extraction parity (inline JSX / reference links not
//     fully stripped) — the slug parity itself is now exact.

// Punctuation stripped (treated as a separator) by zfb's slugify — the ASCII
// set from `crates/zfb-content/src/plugins/heading_links.rs::slugify`. Note `-`
// and `_` are NOT here: they are kept verbatim.
const SLUGIFY_STRIPPED = new Set(
  "!\"#$%&'()*+,./:;<=>?@[\\]^`{|}~".split(""),
);

/**
 * Slugify one heading's text — a byte-faithful TS port of zfb's Rust `slugify`
 * (`crates/zfb-content/src/plugins/heading_links.rs`). Using the exact upstream
 * algorithm (rather than npm `github-slugger`, which strips punctuation
 * differently) is what keeps the TOC anchor identical to the rendered `id`.
 *
 * Rule: walk code points; whitespace, ASCII control, or a {@link SLUGIFY_STRIPPED}
 * char collapses to a single `-` (runs coalesce); every other char is lowercased
 * and kept (Unicode letters/digits, `-`, `_` survive). A single trailing `-` is
 * dropped; a leading `-` is never emitted.
 */
export function slugify(input: string): string {
  let out = "";
  let lastDash = true; // suppress a leading dash
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    const isControl = cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f);
    if (isControl || /\s/u.test(ch) || SLUGIFY_STRIPPED.has(ch)) {
      if (!lastDash) {
        out += "-";
        lastDash = true;
      }
    } else {
      out += ch.toLowerCase();
      lastDash = false;
    }
  }
  if (out.endsWith("-")) out = out.slice(0, -1);
  return out;
}

export interface HeadingItem {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

/**
 * Per-document heading-ID allocator — a faithful TS mirror of zfb's Rust
 * `SlugAllocator` (`crates/zfb-content/src/plugins/heading_links.rs`). Construct
 * one per document; call `allocate(depth, text)` for every matched h2–h6 in
 * document order (the result is the rendered heading `id`).
 *
 * `base = slugify(text)`; pop the ancestor stack while its top is at or deeper
 * than `depth`; `candidate = {parent.id}-{base}` (just `base` at the top of the
 * outline); `id = nextSlug(candidate)` (dedup on the *full path*); push
 * `(depth, id)`. A deduped parent therefore contributes its FINAL id to
 * children. Empty-text headings get the empty string and touch no state (the
 * renderer skips them entirely).
 */
class SlugAllocator {
  /** Dedup counter, keyed by the (possibly ancestor-prefixed) slug path. */
  private readonly seen = new Map<string, number>();
  /** Hierarchical ancestor stack of `{ depth, final id }`. */
  private readonly stack: { depth: number; id: string }[] = [];

  allocate(depth: number, text: string): string {
    const base = slugify(text);
    if (base === "") return "";
    // Pop ancestors at or below this depth so a sibling/shallower heading
    // re-roots the chain (h2 → h4 jumps nest under the nearest real ancestor).
    for (let top = this.stack.at(-1); top !== undefined && top.depth >= depth; top = this.stack.at(-1)) {
      this.stack.pop();
    }
    const parent = this.stack.at(-1);
    const candidate = parent !== undefined ? `${parent.id}-${base}` : base;
    const id = this.nextSlug(candidate);
    this.stack.push({ depth, id });
    return id;
  }

  /**
   * Repeat-numbering on an already-slugified candidate: first occurrence returns
   * `candidate`, later ones `candidate-1`, `candidate-2`, …. Mirrors zfb's
   * `next_slug` — including the empty-string short-circuit (an empty base never
   * advances the counter), so it does NOT re-slugify (the candidate is already a
   * valid slug path).
   */
  private nextSlug(candidate: string): string {
    if (candidate === "") return "";
    const count = this.seen.get(candidate) ?? 0;
    this.seen.set(candidate, count + 1);
    return count === 0 ? candidate : `${candidate}-${count}`;
  }
}

/**
 * Strip inline markdown markup from a heading line to obtain the plain visible
 * text that `rehype-heading-links` sees after MDX → HTML conversion.
 *
 * Protects code spans and Markdown backslash escapes before stripping markup.
 * An escaped delimiter must remain literal, while a backslash inside code is
 * literal content. Only ASCII punctuation is escapable in CommonMark.
 *
 * Strips (in order):
 *   - Inline links: `[text](url)` → `text`
 *   - Inline code spans: `` `code` `` → `code`
 *   - Bold: `**text**` or `__text__` → `text`
 *   - Italic: `*text*` or `_text_` → `text`
 *
 * Underscore emphasis (`__`/`_`) only fires at word boundaries, per CommonMark's
 * intraword rule: `_` inside a word is literal. Without this guard, identifiers
 * like `SKIP_DOC_HISTORY` or `DOCS_SITE_URL` lose their underscores here, and the
 * resulting slug diverges from the rendered heading `id` (the renderer keeps the
 * underscores). Asterisk emphasis (`*`) is left intraword-greedy — `*` does not
 * appear in identifiers and CommonMark does allow intraword `*`.
 */
function stripInlineMarkdown(raw: string): string {
  const protectedText: string[] = [];
  const protect = (value: string): string => {
    const index = protectedText.push(value) - 1;
    return `\uE000${index}\uE001`;
  };
  let masked = "";
  for (let i = 0; i < raw.length;) {
    if (raw[i] === "\\" && i + 1 < raw.length && /[!-/:-@[-`{-~]/.test(raw[i + 1] ?? "")) {
      masked += protect(raw[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (raw[i] === "`") {
      const opener = /^`+/.exec(raw.slice(i))?.[0] ?? "`";
      const closer = /`+/g;
      closer.lastIndex = i + opener.length;
      let match: RegExpExecArray | null;
      while ((match = closer.exec(raw)) !== null && match[0].length !== opener.length) {
        // A code span closes only with a run of the same length.
      }
      if (match !== null) {
        let code = raw.slice(i + opener.length, match.index).replace(/\n/g, " ");
        if (code.startsWith(" ") && code.endsWith(" ") && /[^ ]/.test(code)) {
          code = code.slice(1, -1);
        }
        masked += protect(code);
        i = match.index + opener.length;
        continue;
      }
    }
    masked += raw[i];
    i++;
  }

  return (
    masked
      // Inline links [text](url) — replace with link text only.
      // Must run before bold/italic to avoid mismatching `*` inside URLs.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Bold **text** or __text__ (underscore form only at word boundaries)
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/(?<![A-Za-z0-9])__([^_]+)__(?![A-Za-z0-9])/g, "$1")
      // Italic *text* or _text_ (underscore form only at word boundaries)
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])/g, "$1")
      .replace(/\uE000(\d+)\uE001/g, (_match, index: string) => protectedText[Number(index)] ?? "")
      .trim()
  );
}

/**
 * Resolve and clamp the depth window from raw (possibly invalid) inputs.
 *
 * Enforces `2 <= min <= max <= 4`. If either value is NaN or the chain breaks,
 * falls back to the full default window [2, 4].
 */
function resolveDepthWindow(
  rawMin: unknown,
  rawMax: unknown,
): { lo: number; hi: number } {
  const min = Math.trunc(Number(rawMin));
  const max = Math.trunc(Number(rawMax));
  if (
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min >= 2 &&
    min <= max &&
    max <= 4
  ) {
    return { lo: min, hi: max };
  }
  return { lo: 2, hi: 4 };
}

/**
 * Extract TOC headings from a raw MDX/markdown body.
 *
 * Uses the same hierarchical slugging algorithm as zfb's `HeadingLinks` plugin
 * so the `href="#slug"` values in the TOC match the rendered heading element
 * IDs. Allocates over ALL matched h2–h6 (keeping the dedup
 * counter and hierarchical ancestor stack in sync with the renderer) but only
 * pushes depth 2–4 items into the result (configurable via opts). h1 is not
 * matched — the renderer does not assign ids to h1.
 *
 * Unlike the original showcase version, this function takes all settings as
 * explicit parameters rather than reading from the project's `settings` singleton.
 * This keeps the package import-graph free of project singletons.
 *
 * @param body - Raw markdown body string (frontmatter already stripped).
 * @param opts - Settings for the heading depth window. Production call sites
 *   should pass values from the project's `settings` object.
 * @returns Array of `{ depth, slug, text }` items in document order.
 */
export function extractHeadings(
  body: string,
  opts?: {
    tocMinDepth?: number;
    tocMaxDepth?: number;
  },
): HeadingItem[] {
  const { lo, hi } = resolveDepthWindow(
    opts?.tocMinDepth ?? 2,
    opts?.tocMaxDepth ?? 4,
  );

  return collectHeadings(body, lo, hi);
}

/** All rendered h2–h6 IDs, including headings below the TOC depth window. */
export function extractAllHeadingIds(body: string): string[] {
  return collectHeadings(body, 2, 6).map((heading) => heading.slug).filter(Boolean);
}

function collectHeadings(body: string, lo: number, hi: number): HeadingItem[] {
  const allocator = new SlugAllocator();
  const headings: HeadingItem[] = [];
  const lines = body.split("\n");
  const candidate = classifyLines(lines);

  for (const [index, line] of lines.entries()) {
    if (candidate[index] !== true) continue;

    // Match ATX headings at depth h2–h6. The renderer's heading-links plugin
    // slugs h2–h6 only (h1 is never assigned an id — the frontmatter title is
    // the page's h1), so matching h1 here would advance the shared dedup counter
    // out of step with the renderer and break the TOC anchor for a same-text h2.
    // Allow one or more spaces/tabs after the hashes (both valid per CommonMark).
    const match = /^(#{2,6})[ \t]+(.+)$/.exec(line.trim());
    if (!match) continue;

    const hashes = match[1];
    const rawText = match[2];
    if (hashes === undefined || rawText === undefined) continue;

    const depth = hashes.length;
    // Strip inline markup to get the plain text the renderer sees, so the slug
    // matches the heading element's rendered id attribute.
    const text = stripInlineMarkdown(rawText.trim());

    // Always allocate (advancing the dedup counter and ancestor stack to
    // maintain parity with the renderer across all h2–h6), but only push
    // within the configured depth window.
    const slug = allocator.allocate(depth, text);
    if (depth >= lo && depth <= hi) {
      headings.push({ depth, slug, text });
    }
  }

  return headings;
}

// Characters that may continue a JSX open/close tag outside a quoted value or
// attribute expression: names (incl. member `.` / namespace `:` / `-`),
// whitespace, `=`, `/`, `>`, a quote, or `{`.
const JSX_TAG_CHAR = /[\p{ID_Continue}$\-.:=/>"'{\s]/u;
const JSX_TAG_START = /[\p{ID_Start}$_/>]/u;
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;
const ATX_HEADING = /^#{1,6}(?:[ \t]|$)/;

/**
 * Find where a code span opened on an earlier line closes: the first backtick
 * run of `runLength` before the paragraph ends (blank line, ATX heading or code
 * fence). Returns the position just past the closer, or null when unmatched.
 */
function findCodeSpanEnd(
  lines: readonly string[],
  from: number,
  runLength: number,
): { line: number; col: number } | null {
  for (let lineIndex = from; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? "";
    const trimmed = line.trimStart();
    if (trimmed.trim() === "" || ATX_HEADING.test(trimmed) || /^(?:`{3,}|~{3,})/.test(trimmed)) {
      return null;
    }
    for (const match of line.matchAll(/`+/g)) {
      if (match[0].length === runLength) {
        return { line: lineIndex, col: match.index + runLength };
      }
    }
  }
  return null;
}

/**
 * Mark each line as a heading candidate (`true`) or not. A line is a candidate
 * only when it starts at top-level Markdown: outside a code fence, a JSX
 * expression, and a multi-line JSX tag. See the file header for the rules and
 * the fail-open behaviour; `ignoredOpeners` holds the positions of constructs
 * that were never closed, which a re-scan treats as literal text.
 */
function classifyLines(lines: readonly string[]): boolean[] {
  const ignoredOpeners = new Set<string>();
  for (;;) {
    const result = scanLines(lines, ignoredOpeners);
    if (result.unclosedOpener === null) return result.candidate;
    ignoredOpeners.add(result.unclosedOpener);
  }
}

function scanLines(
  lines: readonly string[],
  ignoredOpeners: ReadonlySet<string>,
): { candidate: boolean[]; unclosedOpener: string | null } {
  const candidate: boolean[] = [];
  // Track the opening fence character and length so we correctly match the
  // closing fence. Markdown allows backtick and tilde fences (``` or ~~~),
  // and longer fences to nest shorter same-character ones.
  let codeFenceOpener: string | null = null;
  // JSX state. `exprDepth > 0` = inside `{…}` (naive brace count); `tag` =
  // inside `<Name …` before its `>`, with `quote` set inside a quoted value.
  let exprDepth = 0;
  let tag: { quote: string | null } | null = null;
  // Where the outermost open construct began, for the fail-open re-scan.
  let opener: string | null = null;
  // Resume point after a code span that closes on a later line of the same
  // paragraph; lines it covers are paragraph text, never headings.
  let codeSpanEnd: { line: number; col: number } | null = null;

  for (const [lineIndex, line] of lines.entries()) {
    let start = 0;
    if (codeSpanEnd !== null) {
      candidate.push(false);
      if (lineIndex < codeSpanEnd.line) continue;
      start = codeSpanEnd.col;
      codeSpanEnd = null;
    }
    const trimmed = line.trimStart();
    if (start === 0 && tag !== null && tag.quote === null && exprDepth === 0) {
      const first = trimmed[0];
      if (first !== undefined && !JSX_TAG_CHAR.test(first)) tag = null;
    }
    if (start > 0) {
      // The tail of a multi-line code span's closing line: scan it as Markdown.
    } else if (exprDepth > 0 || tag !== null) {
      candidate.push(false);
    } else {
      // Detect code fence open/close. A fence is 3+ backticks OR 3+ tildes,
      // optionally followed by a language specifier. The closing fence must use
      // the same character and match or exceed the opener's length.
      // Use trimStart() so indented fences (e.g. inside lists) are also detected.
      const fence = /^([`~]{3,})/.exec(trimmed)?.[1];
      if (fence !== undefined) {
        if (codeFenceOpener === null) {
          codeFenceOpener = fence;
        } else if (
          fence[0] === codeFenceOpener[0] &&
          fence.length >= codeFenceOpener.length
        ) {
          codeFenceOpener = null;
        }
        // Whether opening, closing, or a mismatched-character line (content
        // inside a fence), never treat a fence line as a heading.
        candidate.push(false);
        continue;
      }
      candidate.push(codeFenceOpener === null);
      if (codeFenceOpener !== null) continue;
    }

    for (let i = start; i < line.length; i++) {
      const ch = line[i] ?? "";
      if (exprDepth > 0) {
        if (ch === "{") exprDepth++;
        else if (ch === "}") exprDepth--;
        continue;
      }
      if (tag !== null) {
        if (tag.quote !== null) {
          // JSX attribute strings have no escapes: the next same quote ends it.
          if (ch === tag.quote) tag.quote = null;
        } else if (ch === '"' || ch === "'") {
          tag.quote = ch;
        } else if (ch === "{") {
          exprDepth = 1;
        } else if (ch === ">") {
          tag = null;
        } else if (!JSX_TAG_CHAR.test(ch)) {
          // Not a tag after all: re-read this character as Markdown.
          tag = null;
          i--;
        }
        continue;
      }

      // Top-level Markdown.
      if (ch === "\\" && ASCII_PUNCTUATION.test(line[i + 1] ?? "")) {
        i++;
        continue;
      }
      if (ch === "`") {
        // Skip a same-line code span; an unmatched run is literal backticks.
        const run = /^`+/.exec(line.slice(i))?.[0] ?? "`";
        const closer = /`+/g;
        closer.lastIndex = i + run.length;
        let match: RegExpExecArray | null;
        while ((match = closer.exec(line)) !== null && match[0].length !== run.length) {
          // A code span closes only with a run of the same length.
        }
        if (match === null && !ATX_HEADING.test(trimmed)) {
          // A code span may continue onto later lines of the same paragraph.
          codeSpanEnd = findCodeSpanEnd(lines, lineIndex + 1, run.length);
          if (codeSpanEnd !== null) break;
        }
        i = (match === null ? i : match.index) + run.length - 1;
        continue;
      }
      const position = `${lineIndex}:${i}`;
      if (ignoredOpeners.has(position)) continue;
      if (ch === "{") {
        exprDepth = 1;
        opener = position;
      } else if (ch === "<" && JSX_TAG_START.test(line[i + 1] ?? "")) {
        tag = { quote: null };
        opener = position;
      }
    }
    if (exprDepth === 0 && tag === null) opener = null;
  }

  return {
    candidate,
    unclosedOpener: exprDepth > 0 || tag !== null ? opener : null,
  };
}
