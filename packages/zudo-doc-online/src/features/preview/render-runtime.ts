/**
 * The preview pane's render runtime: lazy `@takazudo/zfb-md-wasm` loading,
 * the exact rendering pipeline #3338 specifies, the directive→admonition
 * post-processor, and the debounced/stale-drop render loop the pane
 * subscribes to. Kept framework-free (no Preact import) so every piece here
 * is unit-testable without mounting anything.
 *
 * ## Why a post-processor exists at all
 *
 * The bootstrap spike (`src/spikes/__tests__/wasm-spike.test.ts`) recorded
 * the load-bearing finding: `renderHtml` is an HTML-*fragment* renderer, not
 * a JSX compiler, so a `:::note` (or a GitHub-style `> [!NOTE]` alert, which
 * resolves through the same `features.directives` name map) never reaches
 * zfb's real `<Note>`/`<Tip>`/... components. It comes back as a literal,
 * unexpanded tag using the exact PascalCase name from
 * `pipeline.features.directives` (`<Note>...</Note>`), with the directive's
 * optional `[label]` carried as a `title="…"` attribute. `postProcessAdmonitions`
 * below rewrites those seven known tag names into real admonition markup.
 *
 * **Known fidelity limitation (verified empirically, not just the spike's
 * single-fixture case): the flattened tag's body is plain TEXT, not HTML.**
 * `renderHtml` drops every child element the directive body would otherwise
 * contain -- inline formatting (`**bold**`, `` `code` ``, links) collapses to
 * plain text, and a second/third paragraph loses its paragraph break entirely
 * (concatenated with zero separating whitespace onto the first). This is a
 * property of how the current wasm serializes an unresolved custom-component
 * tag, not a bug in this post-processor -- there is no richer structure left
 * to recover by the time the HTML string reaches us. Multi-paragraph or
 * heavily-formatted directive bodies will visually read as a single run-on
 * line inside an otherwise correctly styled/colored admonition box.
 */

import type { Diagnostic, PipelineOptions } from "@takazudo/zfb-md-wasm";

type WasmModule = typeof import("@takazudo/zfb-md-wasm");

/** The exact pipeline config #3338 specifies -- output parity with zfb's own build pipeline for this fixed feature set. */
export const PREVIEW_PIPELINE: PipelineOptions = {
  codeHighlight: { mode: "class" },
  gfm: { strikethrough: true, table: true, taskListItem: true, footnoteDefinition: true },
  cjkFriendly: true,
  features: {
    directives: {
      note: "Note",
      tip: "Tip",
      info: "Info",
      warning: "Warning",
      danger: "Danger",
      caution: "Caution",
      details: "Details",
    },
    githubAlerts: true,
    headingIds: { strategy: "hierarchical" },
  },
};

/** Filename passed to `renderHtml` -- drives its `.mdx` dialect selection and diagnostics display only; no file of this name exists. */
const PREVIEW_FILENAME = "preview.mdx";

/* ============================================================================
 * Directive → admonition post-processing
 * ========================================================================== */

const ADMONITION_TAGS = ["Note", "Tip", "Info", "Warning", "Danger", "Caution", "Details"] as const;
type AdmonitionTag = (typeof ADMONITION_TAGS)[number];

interface AdmonitionMeta {
  readonly kind: string;
  readonly defaultLabel: string;
}

const ADMONITION_META: Record<AdmonitionTag, AdmonitionMeta> = {
  Note: { kind: "note", defaultLabel: "Note" },
  Tip: { kind: "tip", defaultLabel: "Tip" },
  Info: { kind: "info", defaultLabel: "Info" },
  Warning: { kind: "warning", defaultLabel: "Warning" },
  Danger: { kind: "danger", defaultLabel: "Danger" },
  Caution: { kind: "caution", defaultLabel: "Caution" },
  Details: { kind: "details", defaultLabel: "Details" },
};

// Matches exactly one flattened directive tag for a recognized component
// name: the bare tag renderHtml emits (see the header finding above), an
// optional `title="…"` attribute carrying the directive's [label], and a
// flat-text body with no nested elements. The `\1` backreference requires
// the closing tag to match the same name, so this never pairs a `<Note>`
// opener with an unrelated closer.
const DIRECTIVE_TAG_RE = new RegExp(
  `<(${ADMONITION_TAGS.join("|")})(?:\\s+title="([^"]*)")?\\s*>([\\s\\S]*?)<\\/\\1>`,
  "g",
);

/**
 * Rewrites the seven known directive tags `renderHtml` can emit into real
 * `.zdo-admonition` markup (`prose.css` styles it); `Details` becomes a
 * native `<details><summary>` so it stays collapsible. Anything else in the
 * input -- including an unrecognized tag `renderHtml` might emit for a
 * directive name outside this map (for example a GitHub `[!IMPORTANT]`
 * alert, which has no configured `directives` entry) -- passes through
 * untouched: this function only transforms the 7 known tags, deliberately.
 */
export function postProcessAdmonitions(html: string): string {
  return html.replace(DIRECTIVE_TAG_RE, (_match, tag: string, title: string | undefined, body: string) => {
    const meta = ADMONITION_META[tag as AdmonitionTag];
    const label = title !== undefined && title.length > 0 ? title : meta.defaultLabel;

    if (tag === "Details") {
      return (
        `<details class="zdo-admonition zdo-admonition-${meta.kind}">` +
        `<summary class="zdo-admonition-title">${label}</summary>` +
        `<div class="zdo-admonition-body">${body}</div>` +
        `</details>`
      );
    }

    return (
      `<div class="zdo-admonition zdo-admonition-${meta.kind}">` +
      `<p class="zdo-admonition-title">${label}</p>` +
      `<div class="zdo-admonition-body">${body}</div>` +
      `</div>`
    );
  });
}

/* ============================================================================
 * Best-effort HTML sanitization before DOM injection
 *
 * `renderHtml` preserves raw HTML from the markdown source VERBATIM --
 * verified empirically (not documented in the package's own contract):
 * `<script>`, an `onload`/`onerror`/`onclick` attribute, and a
 * `javascript:` URL all survive into its output unchanged. Since this pane
 * injects that output via `dangerouslySetInnerHTML` in the SPA's own
 * origin, unsanitized content is script execution in this app -- and epic
 * #3327 explicitly designs this surface for AI-agent authoring via the MCP
 * server, so the source of a given page's markdown is not always the human
 * at the keyboard. `postProcessAdmonitions` MUST run before this (it needs
 * to see the raw `<Note>`-style tags) -- this pass runs last, right before
 * the trust boundary the HTML is about to cross.
 *
 * This is a hand-rolled allowlist walk over a real parsed DOM tree (native
 * `DOMParser`, zero new dependencies -- epic #3327 contract 4 forbids a
 * child sub-issue from adding one, e.g. DOMPurify), not a text-pattern
 * sanitizer -- a real parse tree closes most of the bypass classes a regex
 * sanitizer is prone to, but this has not had the adversarial scrutiny a
 * battle-tested library has. Treat this as a deliberate, scoped mitigation
 * for THIS tool's threat model (a loopback-bound single-user local dev
 * server -- epic non-goals), not a substitute for a real sanitizer library;
 * adopting one needs to go through the bootstrap sub-issue's
 * dependency-addition path, not a Wave-7 child.
 * ========================================================================== */

/** Tags whose entire subtree is dropped -- there is no safe way to keep their content. */
const SANITIZE_DROP_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "svg",
  "math",
  "noscript",
]);

/** Tags this pane's own pipeline can legitimately produce -- everything else is unwrapped (kept as already-sanitized text/children, tag stripped). */
const SANITIZE_ALLOWED_TAGS = new Set([
  "a",
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "del",
  "ins",
  "code",
  "pre",
  "span",
  "blockquote",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "input",
  "div",
  "details",
  "summary",
]);

const SANITIZE_GLOBAL_ATTRS = new Set(["class", "id", "title", "aria-label", "aria-hidden", "dir", "lang", "open"]);

const SANITIZE_TAG_ATTRS: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "rel"]),
  img: new Set(["src", "alt"]),
  input: new Set(["type", "disabled", "checked"]),
  ol: new Set(["start"]),
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
};

const SANITIZE_URL_ATTRS = new Set(["href", "src"]);

/** Matches an explicit URL scheme (`foo:`), so a bare relative reference like `example.com/x` or `../x` is left alone. */
const URL_SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const SAFE_URL_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

function isSafeUrl(value: string): boolean {
  // Browsers ignore embedded control characters (tab/newline/CR) when
  // resolving a URL scheme -- a known sanitizer-bypass trick strips them
  // out of `javascript:` to dodge a naive prefix check. Normalize first.
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (normalized === "" || normalized.startsWith("#")) return true;
  const schemeMatch = URL_SCHEME_RE.exec(normalized);
  const scheme = schemeMatch?.[1];
  if (scheme === undefined) return true; // no scheme -- a relative reference
  return SAFE_URL_SCHEMES.has(scheme.toLowerCase());
}

function sanitizeElement(el: Element): void {
  // Depth-first: children are fully sanitized before this element's own
  // fate (drop / unwrap / keep) is decided, so an unwrap below re-parents
  // already-safe nodes.
  for (const child of [...el.children]) {
    sanitizeElement(child);
  }

  const tag = el.tagName.toLowerCase();

  if (SANITIZE_DROP_TAGS.has(tag)) {
    el.remove();
    return;
  }

  if (!SANITIZE_ALLOWED_TAGS.has(tag)) {
    el.replaceWith(...el.childNodes);
    return;
  }

  const tagAttrs = SANITIZE_TAG_ATTRS[tag];
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    // Event-handler attributes are rejected unconditionally, ahead of the
    // allowlist below -- a belt-and-suspenders check, since none of them
    // appear in SANITIZE_GLOBAL_ATTRS/SANITIZE_TAG_ATTRS anyway.
    if (name.startsWith("on")) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (SANITIZE_URL_ATTRS.has(name) && !isSafeUrl(attr.value)) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (SANITIZE_GLOBAL_ATTRS.has(name) || tagAttrs?.has(name)) continue;
    el.removeAttribute(attr.name);
  }
}

/**
 * Best-effort sanitization pass -- see the section header above for scope
 * and rationale. A no-op outside a DOM environment (`DOMParser` absent):
 * this function is only ever meaningfully called from the browser, where
 * `preview-pane.tsx` is the sole caller right before `dangerouslySetInnerHTML`.
 */
export function sanitizePreviewHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const child of [...doc.body.children]) {
    sanitizeElement(child);
  }
  return doc.body.innerHTML;
}

/* ============================================================================
 * Lazy wasm module loading -- cached module promise, evicted on rejection
 * ========================================================================== */

/**
 * Holds the in-flight/settled module promise. A plain mutable object (rather
 * than a module-level `let`) so tests can construct their own isolated cache
 * instead of fighting a shared singleton between specs.
 */
export interface WasmModuleCache {
  promise: Promise<WasmModule> | null;
}

export function createWasmModuleCache(): WasmModuleCache {
  return { promise: null };
}

/** The production cache. Each `<PreviewPane>` mount is free to pass its own instead -- see preview-pane.tsx. */
const sharedWasmModuleCache = createWasmModuleCache();

function defaultImportModule(): Promise<WasmModule> {
  // The public package ROOT only -- never `./highlight` (a second, separate
  // wasm binary) and never a package-internal wasm path. Importing both the
  // root and `/highlight` in one bundle would load two wasm artifacts for
  // one feature; this pane needs only the root's `renderHtml`.
  return import("@takazudo/zfb-md-wasm");
}

/**
 * Lazily loads and caches the wasm module promise. On a rejected import the
 * cache is evicted (not left holding the rejected promise forever) so a
 * later mount can retry a transient chunk-load failure instead of replaying
 * the same failure indefinitely.
 */
export function loadZfbMdWasm(
  cache: WasmModuleCache = sharedWasmModuleCache,
  importModule: () => Promise<WasmModule> = defaultImportModule,
): Promise<WasmModule> {
  if (cache.promise === null) {
    cache.promise = importModule().catch((error: unknown) => {
      cache.promise = null;
      throw error;
    });
  }
  return cache.promise;
}

/* ============================================================================
 * Single render call
 * ========================================================================== */

/** Thrown by `renderPreviewHtml` for every failure mode -- expected diagnostics AND a caught wasm trap alike -- so callers have exactly one error shape to handle. */
export class PreviewRenderFailure extends Error {}

function describeDiagnostics(diagnostics: readonly Diagnostic[]): string {
  const [first] = diagnostics;
  return first?.message ?? "The preview renderer reported a failure with no diagnostic detail.";
}

function describeTrap(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `The preview engine hit an internal error and is restarting: ${detail}`;
}

export interface RenderPreviewDeps {
  cache?: WasmModuleCache;
  importModule?: () => Promise<WasmModule>;
}

/**
 * Renders one markdown snapshot to admonition-post-processed, sanitized
 * HTML -- safe to hand `preview-pane.tsx` for `dangerouslySetInnerHTML`.
 *
 * Expected failures (malformed input, an `options` mistake) never throw from
 * `renderHtml` itself -- they come back as `diagnostics` with `html: null`,
 * which this function turns into a rejected `PreviewRenderFailure` so the
 * render loop has one failure path to handle. A wasm *trap* really does
 * throw (see the package's error/trap contract); it is caught here and
 * turned into the same `PreviewRenderFailure` shape -- the instance
 * auto-recovers in the background per the package's own contract, so the
 * next call transparently uses a fresh instance.
 */
export async function renderPreviewHtml(
  markdown: string,
  deps: RenderPreviewDeps = {},
): Promise<string> {
  const wasm = await loadZfbMdWasm(deps.cache, deps.importModule);

  let html: string | null;
  let diagnostics: readonly Diagnostic[];
  try {
    const result = await wasm.renderHtml(markdown, {
      filename: PREVIEW_FILENAME,
      pipeline: PREVIEW_PIPELINE,
    });
    html = result.html;
    diagnostics = result.diagnostics;
  } catch (error) {
    throw new PreviewRenderFailure(describeTrap(error));
  }

  if (html === null) {
    throw new PreviewRenderFailure(describeDiagnostics(diagnostics));
  }
  // Order matters: admonitions must be resolved from the raw <Note>-style
  // tags BEFORE sanitization, which does not know those tag names and would
  // otherwise unwrap them as unrecognized elements.
  return sanitizePreviewHtml(postProcessAdmonitions(html));
}

/* ============================================================================
 * Debounced, stale-drop render loop
 * ========================================================================== */

export const PREVIEW_RENDER_DEBOUNCE_MS = 300;

export interface PreviewSnapshot {
  /** Last successfully rendered HTML. Null only before the first successful render. */
  html: string | null;
  /** Message from the most recent failed attempt, or null once/if one succeeds. A failure never clears a still-good `html`. */
  error: string | null;
  /** True until the very first render attempt (success or failure) has settled -- drives the "loading preview engine…" skeleton. */
  loading: boolean;
}

const INITIAL_SNAPSHOT: PreviewSnapshot = { html: null, error: null, loading: true };

export type ContentTickListener = () => void;

export interface PreviewRenderLoopOptions {
  /** Trailing debounce window. Defaults to `PREVIEW_RENDER_DEBOUNCE_MS`. */
  delayMs?: number;
  /** Injectable so specs can drive rendering without a real wasm call. Defaults to `renderPreviewHtml`. */
  render?: (markdown: string) => Promise<string>;
  /** Injectable so specs can drive the debounce without global timer patching. */
  scheduleTimeout?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutImpl?: (handle: ReturnType<typeof setTimeout>) => void;
}

/**
 * A trailing-debounced, out-of-order-safe render loop.
 *
 * Two layers of "stale" exist here, and they are different problems: the
 * debounce coalesces a burst of keystrokes into one scheduled render (same
 * idea as `use-editor-content.ts`'s `EditorContentTicker`), but the render
 * call itself is an async wasm call of unpredictable duration -- a first
 * render can be paying the one-time wasm fetch/instantiate cost while a
 * later, smaller edit's render finishes first. The monotonic `requestId`
 * below guards that second case: a result is applied only if no newer
 * request has been issued since it started, regardless of resolution order.
 */
export class PreviewRenderLoop {
  private readonly delayMs: number;
  private readonly render: (markdown: string) => Promise<string>;
  private readonly scheduleTimeout: NonNullable<PreviewRenderLoopOptions["scheduleTimeout"]>;
  private readonly clearTimeoutImpl: NonNullable<PreviewRenderLoopOptions["clearTimeoutImpl"]>;

  private readonly listeners = new Set<ContentTickListener>();
  private snapshot: PreviewSnapshot = INITIAL_SNAPSHOT;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingMarkdown: string | null = null;
  private nextRequestId = 0;
  /** The highest request id ISSUED so far -- an older in-flight request is stale the moment a newer one starts, not only once the newer one finishes. */
  private latestRequestId = 0;

  constructor(options: PreviewRenderLoopOptions = {}) {
    this.delayMs = options.delayMs ?? PREVIEW_RENDER_DEBOUNCE_MS;
    this.render = options.render ?? ((markdown) => renderPreviewHtml(markdown));
    // Wrapped, never a bare `?? setTimeout`. A bare global stored on a field is
    // later invoked as `this.scheduleTimeout(...)`, which hands the browser's
    // `setTimeout` a `this` of this instance — Chrome's Web IDL binding rejects
    // that with `TypeError: Illegal invocation`, so the preview never renders.
    // Node and jsdom don't check `this`, so the suite stays green while the
    // real browser is broken. Do not "simplify" these arrows away.
    this.scheduleTimeout =
      options.scheduleTimeout ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimeoutImpl =
      options.clearTimeoutImpl ?? ((handle) => clearTimeout(handle));
  }

  subscribe(listener: ContentTickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): PreviewSnapshot {
    return this.snapshot;
  }

  /**
   * Debounced entry point -- call on every markdown change. Mints a new
   * request id IMMEDIATELY (not only once the debounce fires): otherwise an
   * older render still in flight when a page switch or a fast follow-up
   * edit calls `schedule()` again could still land and get applied during
   * the new debounce window, painting stale content under the newer
   * content's identity for up to `delayMs`. `fire()` reuses this same id
   * rather than minting its own, so the id a render settles under always
   * matches the id of the content that was last scheduled for it.
   */
  schedule(markdown: string): void {
    this.pendingMarkdown = markdown;
    this.nextRequestId += 1;
    this.latestRequestId = this.nextRequestId;
    this.cancelTimer();
    this.timer = this.scheduleTimeout(() => {
      this.timer = undefined;
      this.fire();
    }, this.delayMs);
  }

  /** Cancels any pending debounce and marks in-flight results stale, without starting a new render. Unmount cleanup. */
  reset(): void {
    this.cancelTimer();
    this.pendingMarkdown = null;
    // Mint a request id no in-flight call could already hold, so its result
    // is recognized as stale (< latestRequestId) whenever it settles.
    this.nextRequestId += 1;
    this.latestRequestId = this.nextRequestId;
    this.snapshot = INITIAL_SNAPSHOT;
  }

  private fire(): void {
    const markdown = this.pendingMarkdown;
    if (markdown === null) return;
    this.pendingMarkdown = null;
    // The id minted by schedule() when THIS markdown was queued -- not a
    // fresh one -- so a still-newer schedule() call in the meantime (which
    // already bumped latestRequestId past it) correctly outranks it below.
    const requestId = this.latestRequestId;
    this.render(markdown).then(
      (html) => this.applyOutcome(requestId, { html, error: null }),
      (error: unknown) =>
        this.applyOutcome(requestId, {
          html: null,
          error: error instanceof Error ? error.message : String(error),
        }),
    );
  }

  private applyOutcome(requestId: number, outcome: { html: string | null; error: string | null }): void {
    // Out-of-order async protection: a newer render has since been issued --
    // this settle is stale even though it just resolved.
    if (requestId < this.latestRequestId) return;
    this.snapshot = {
      html: outcome.html ?? this.snapshot.html,
      error: outcome.error,
      loading: false,
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private cancelTimer(): void {
    if (this.timer === undefined) return;
    this.clearTimeoutImpl(this.timer);
    this.timer = undefined;
  }
}
