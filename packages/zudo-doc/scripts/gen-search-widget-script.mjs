#!/usr/bin/env node
// scripts/gen-search-widget-script.mjs
//
// Generates the gitignored `src/search-widget-script/generated-script.ts`
// build artifact (zudolab/zudo-doc#3412, epic #3404 "deps and fixes").
//
// WHY this exists (the load-bearing reason — recoverable only from the
// issue): the previous `src/search-widget-script/index.ts` built
// SEARCH_WIDGET_SCRIPT as a template literal evaluated at MODULE-EVALUATION
// TIME, embedding `prepareLc`/`scoreEntry` via `Function.prototype.toString()`
// on the LIVE imported bindings. A downstream bundler that minifies/renames
// node_modules exports renames those live functions while the template's
// literal text still calls the un-renamed names (`prepareLc(...)`,
// `scoreEntry(...)`) — silent ReferenceError, dead widget. And because the
// string was recomputed by executing code, its bytes were render-path
// dependent — no stable CSP hash.
//
// This script freezes the whole embedding ONCE, at zudo-doc's own package
// build time, into a plain string literal — so nothing downstream ever
// reflects on a live function again.
//
// HOW: reads `src/search-widget-script/scoring.ts` and
// `src/transitions/page-events.ts` SOURCE, strips TypeScript types
// deterministically via `ts.transpileModule()` (typescript is already a
// devDependency — no new dep), executes each transpiled CommonJS module in
// an isolated sandbox (empty `module`/`exports`, no external deps — both
// source files are import-free), then reads the REAL runtime values off the
// sandbox's `exports`:
//   - `exports.prepareLc.toString()` / `exports.scoreEntry.toString()` — the
//     exact same Function.prototype.toString() mechanism the old code used,
//     just run once here instead of on every module evaluation downstream.
//   - `exports.AFTER_NAVIGATE_EVENT` — the real event-name string, never
//     hardcoded here.
//
// Composes the full IIFE script string (the template logic moved out of
// index.ts) and writes it, write-if-changed, to
// `src/search-widget-script/generated-script.ts` with a GENERATED banner —
// same convention as `routes-src/` / `virtual-modules.d.ts` (see
// copy-routes-src.mjs / copy-virtual-modules.mjs). Gitignored; NOT added to
// the package `exports` map or `files[]` — it stays internal like
// `scoring.ts`.
//
// `buildSearchWidgetScript()` is exported so both this script's CLI entry
// point AND the vitest drift-guard test
// (`src/search-widget-script/__tests__/index.test.ts`) can call it: the test
// re-runs the REAL extraction (fresh transpile of the current source files)
// and asserts it byte-matches the frozen `SEARCH_WIDGET_SCRIPT` shipped in
// `generated-script.ts` — catching the case where `scoring.ts` or
// `page-events.ts` changed but the generated file was never regenerated.
//
// Runs BEFORE tsup (build / prepare / predev — see package.json) so the
// first compile always has `generated-script.ts` on disk to import from
// `index.ts`, AND is hooked into the tsup `--watch` `onSuccess` chain
// (tsup.config.ts) so a mid-watch edit to either source file regenerates it;
// write-if-changed keeps that loop-free (an unchanged regeneration does not
// re-trigger tsup's watcher).

import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const SCORING_SRC_PATH = resolve(
  PKG_ROOT,
  "src/search-widget-script/scoring.ts",
);
const PAGE_EVENTS_SRC_PATH = resolve(
  PKG_ROOT,
  "src/transitions/page-events.ts",
);
const OUTPUT_PATH = resolve(
  PKG_ROOT,
  "src/search-widget-script/generated-script.ts",
);

// Explicit compiler options (per the issue spec) — CommonJS so each source's
// `export`s become plain `exports.X = X` assignments we can read off a
// sandboxed `module.exports`, ES2020 so `var`-style function bodies pass
// through unchanged (no downlevel helpers), isolatedModules because each
// file is transpiled alone with no cross-file type info.
const TRANSPILE_OPTIONS = {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: false,
    isolatedModules: true,
  },
  reportDiagnostics: true,
};

/** A source string carrying no CommonJS/ESM module scaffolding that could
 *  survive the transpile into the embedded browser script. Matches only the
 *  syntactic shapes (`require(...)`, `import(...)`, `module.exports`,
 *  `exports.x`), NOT the bare words — the extracted function text includes
 *  body comments, and a comment merely mentioning "import"/"export" must not
 *  fail the build. */
function assertNoModuleScaffolding(label, text) {
  if (/\brequire\s*\(|\bimport\s*\(|\bmodule\.exports\b|\bexports\s*\./.test(text)) {
    throw new Error(
      `[gen-search-widget-script] ${label} leaked module scaffolding into the embedded script:\n${text}`,
    );
  }
}

/** Transpile a TS source file to CommonJS JS, type-stripped, via the TS compiler API. */
function transpile(sourcePath) {
  const source = readFileSync(sourcePath, "utf8");
  const { outputText, diagnostics } = ts.transpileModule(
    source,
    TRANSPILE_OPTIONS,
  );
  if (diagnostics && diagnostics.length > 0) {
    const messages = diagnostics
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
      .join("; ");
    throw new Error(
      `[gen-search-widget-script] failed to transpile ${sourcePath}: ${messages}`,
    );
  }
  return outputText;
}

/** Execute transpiled CommonJS source in an isolated sandbox and return its exports. */
function executeCommonJs(code, label) {
  const moduleObj = { exports: {} };
  const fn = new Function("module", "exports", code);
  try {
    fn(moduleObj, moduleObj.exports);
  } catch (err) {
    throw new Error(
      `[gen-search-widget-script] failed to execute transpiled ${label}: ${err.message}`,
    );
  }
  return moduleObj.exports;
}

/** Extract the real, unit-tested prepareLc/scoreEntry source text from scoring.ts. */
function extractScoringFunctions() {
  const outputText = transpile(SCORING_SRC_PATH);
  const exportsObj = executeCommonJs(outputText, "scoring.ts");
  const { prepareLc, scoreEntry } = exportsObj;
  if (typeof prepareLc !== "function" || typeof scoreEntry !== "function") {
    throw new Error(
      "[gen-search-widget-script] scoring.ts did not export prepareLc/scoreEntry functions",
    );
  }
  const prepareLcSrc = prepareLc.toString();
  const scoreEntrySrc = scoreEntry.toString();
  assertNoModuleScaffolding("prepareLc", prepareLcSrc);
  assertNoModuleScaffolding("scoreEntry", scoreEntrySrc);
  return { prepareLcSrc, scoreEntrySrc };
}

/** Extract the real AFTER_NAVIGATE_EVENT value from transitions/page-events.ts — never hardcoded. */
function extractAfterNavigateEvent() {
  const outputText = transpile(PAGE_EVENTS_SRC_PATH);
  const exportsObj = executeCommonJs(outputText, "page-events.ts");
  const value = exportsObj.AFTER_NAVIGATE_EVENT;
  if (typeof value !== "string" || !value) {
    throw new Error(
      "[gen-search-widget-script] AFTER_NAVIGATE_EVENT missing or not a string in transitions/page-events.ts",
    );
  }
  return value;
}

/**
 * Composes the full `<site-search>` client IIFE script, string-for-string
 * identical to the old template-literal build in index.ts, but with the
 * three previously-live interpolations replaced by frozen values extracted
 * above.
 */
export function buildSearchWidgetScript() {
  const { prepareLcSrc, scoreEntrySrc } = extractScoringFunctions();
  const afterNavigateEventLiteral = JSON.stringify(extractAfterNavigateEvent());

  return /* javascript */ `(function () {
  if (customElements.get("site-search")) return; // guard double-registration

  var PAGE_SIZE = 10;

  // Allowlist-based href sanitizer: only relative paths and http(s) URLs are
  // permitted. Anything else (e.g. javascript:, data:) falls back to "#" so a
  // malicious entry in search-index.json cannot turn a result link into a
  // script-injection vector.
  function safeHref(url) {
    if (!url) return "#";
    var s = String(url);
    if (s.startsWith("/") || s.startsWith("http://") || s.startsWith("https://")) {
      return s;
    }
    return "#";
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
  }

  function parseTerms(query) {
    return query.trim().split(/\\s+/).filter(Boolean);
  }

  // scoreEntry / prepareLc: embedded verbatim (via Function.prototype.toString(),
  // captured once at package build time by scripts/gen-search-widget-script.mjs)
  // from the real, unit-tested implementation in ./scoring.ts — see the module
  // header comment there and search-widget-script/__tests__/scoring.test.ts.
  // This keeps the shipped inline script and the tested source identical by
  // construction instead of relying on a hand-copied mirror staying in sync.
  ${prepareLcSrc}

  ${scoreEntrySrc}

  function highlightTerms(text, terms) {
    if (!terms.length) return escapeHtml(text);
    var escaped = terms.map(function(t) { return escapeRegExp(t); });
    var pattern = new RegExp("(" + escaped.join("|") + ")", "gi");
    return text.split(pattern).map(function(seg, i) {
      return i % 2 === 1
        ? "<mark>" + escapeHtml(seg) + "</mark>"
        : escapeHtml(seg);
    }).join("");
  }

  function truncate(text, query, max) {
    max = max || 200;
    if (text.length <= max) return text;
    var terms = parseTerms(query);
    var lower = text.toLowerCase();
    var best = -1;
    for (var i = 0; i < terms.length; i++) {
      var idx = lower.indexOf(terms[i].toLowerCase());
      if (idx !== -1 && (best === -1 || idx < best)) best = idx;
    }
    if (best === -1) return text.slice(0, max) + "\\u2026";
    var half = Math.floor(max / 2);
    var start = Math.max(0, best - half);
    var end = start + max;
    if (end > text.length) { end = text.length; start = Math.max(0, end - max); }
    var result = text.slice(start, end);
    if (start > 0) result = "\\u2026" + result;
    if (end < text.length) result += "\\u2026";
    return result;
  }

  customElements.define("site-search", class SiteSearch extends HTMLElement {
    constructor() {
      super();
      this._dialog = null;
      this._openBtn = null;
      this._closeBtn = null;
      this._input = null;
      this._results = null;
      this._countWide = null;
      this._countNarrow = null;
      this._entries = null;
      this._loading = false;
      this._indexUnavailable = false;
      this._debounce = null;
      this._currentQuery = "";
      this._allResults = [];
      this._shownCount = 0;
      this._shortcut = "";
      this._resultCountTemplate = "";
      // Locale-aware status strings (threaded from the SSR component via
      // data-* attributes, same mechanism as _resultCountTemplate). English
      // literals below in connectedCallback are fallbacks only.
      this._searchUnavailable = "";
      this._loadingIndex = "";
      this._noResults = "";
      this._keydownHandler = null;
      // Delegated click handler on the results container: closing the dialog
      // when a result link is activated (epic #2148). Held so disconnectedCallback
      // can detach it on body swap.
      this._resultsClickHandler = null;
      this._observer = null;
      this._sentinel = null;
      this._isLoadingBatch = false;
      // Snapshot of the initial results-area HTML (includes SSR placeholder).
      // Captured in connectedCallback so we can restore it on input-clear
      // without re-querying the DOM (the placeholder node is replaced once
      // search results are rendered).
      this._placeholderHtml = "";
      // Held so we can remove the document-level after-navigate listener
      // in disconnectedCallback. zudolab/zudo-doc#1523 — under Strategy B
      // SPA navigation a non-persisted <site-search> element would leak
      // one document listener per nav without this hook.
      this._afterNavHandler = null;
    }

    connectedCallback() {
      this._dialog = this.querySelector("[data-search-dialog]");
      this._openBtn = this.querySelector("[data-open-search]");
      this._closeBtn = this.querySelector("[data-close-search]");
      this._input = this.querySelector("[data-search-input]");
      this._results = this.querySelector("[data-search-results]");
      this._countWide = this.querySelector("[data-search-count]");
      this._countNarrow = this.querySelector("[data-search-count-narrow]");
      this._resultCountTemplate = this.dataset.resultCountTemplate || "{count} results";
      this._searchUnavailable = this.dataset.searchUnavailable || "Search unavailable";
      this._loadingIndex = this.dataset.loadingIndex || "Loading search index\\u2026";
      this._noResults = this.dataset.noResults || "No results found.";
      // Snapshot the placeholder HTML before any search renders overwrite it.
      this._placeholderHtml = this._results ? this._results.innerHTML : "";

      // Platform keyboard-shortcut label — injected into [data-kbd-shortcut]
      var nav = navigator;
      var isMac = /Mac|iPhone|iPad|iPod/.test(
        (nav.userAgentData && nav.userAgentData.platform) || nav.userAgent
      );
      this._shortcut = isMac ? "\\u2318K" : "Ctrl+K";
      var kbdEl = this.querySelector("[data-kbd-shortcut]");
      if (kbdEl) kbdEl.textContent = this._shortcut;

      // Wire open/close handlers
      var self = this;
      if (this._openBtn) {
        this._openBtn.addEventListener("click", function() { self.openDialog(); });
      }
      if (this._closeBtn) {
        this._closeBtn.addEventListener("click", function() { self.closeDialog(); });
      }
      if (this._dialog) {
        this._dialog.addEventListener("close", function() {
          document.documentElement.style.overflow = "";
        });
        this._dialog.addEventListener("click", function(e) {
          if (e.target === self._dialog) self.closeDialog();
        });
      }
      if (this._input) {
        this._input.addEventListener("input", function() { self.handleInput(); });
      }

      // Close-on-result-click (epic #2148): result links are created dynamically
      // in renderResult(), so use one delegated listener on the results container
      // instead of per-link handlers. We do NOT preventDefault — the link's own
      // navigation (zfb Strategy-B SPA swap or a plain load) must still proceed;
      // we only close the <dialog> so it does not linger over the swapped page.
      // closeDialog() runs synchronously before navigation; the dialog's close
      // restores documentElement overflow via the existing "close" listener.
      if (this._results) {
        this._resultsClickHandler = function(e) {
          var t = e.target;
          while (t && t !== self._results) {
            if (t.tagName === "A") { self.closeDialog(); return; }
            t = t.parentNode;
          }
        };
        this._results.addEventListener("click", this._resultsClickHandler);
      }

      // Global keyboard shortcut (⌘K / Ctrl+K to open)
      this._keydownHandler = function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          self.openDialog();
        }
      };
      document.addEventListener("keydown", this._keydownHandler);

      // View-Transitions compat: re-run on the v2 after-navigate event.
      // Stored on the instance so disconnectedCallback can detach it on
      // body swap when this element is NOT persisted via
      // data-zfb-transition-persist (zudolab/zudo-doc#1523).
      this._afterNavHandler = function() {
        // Backstop for the original bug (epic #2148): if the dialog is somehow
        // still open after an SPA body swap (e.g. a nav path that bypassed the
        // result-click handler), close it so it does not linger / flash over the
        // newly-swapped page. Safe no-op when already closed.
        if (self._dialog && self._dialog.open) self.closeDialog();
        var kbdEl2 = self.querySelector("[data-kbd-shortcut]");
        if (kbdEl2) kbdEl2.textContent = self._shortcut;
      };
      document.addEventListener(${afterNavigateEventLiteral}, this._afterNavHandler);
    }

    disconnectedCallback() {
      if (this._keydownHandler) {
        document.removeEventListener("keydown", this._keydownHandler);
        this._keydownHandler = null;
      }
      if (this._afterNavHandler) {
        document.removeEventListener(${afterNavigateEventLiteral}, this._afterNavHandler);
        this._afterNavHandler = null;
      }
      if (this._resultsClickHandler && this._results) {
        this._results.removeEventListener("click", this._resultsClickHandler);
        this._resultsClickHandler = null;
      }
      this.teardownSentinel();
    }

    openDialog() {
      if (!this._dialog) return;
      document.documentElement.style.overflow = "hidden";
      this._dialog.showModal();
      if (this._input) {
        this._input.focus();
        this._input.select();
      }
      if (!this._entries && !this._loading) {
        this.loadIndex();
      }
    }

    closeDialog() {
      if (!this._dialog) return;
      this._dialog.close();
      document.documentElement.style.overflow = "";
    }

    handleInput() {
      var self = this;
      if (this._debounce) clearTimeout(this._debounce);
      this._debounce = setTimeout(function() { self.search(); }, 150);
    }

    loadIndex() {
      if (this._loading) return;
      this._loading = true;
      var self = this;
      var base = this.dataset.base || "/";
      fetch(base + "search-index.json")
        .then(function(r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function(data) {
          self._entries = Array.isArray(data) ? data : (data.entries || []);
          prepareLc(self._entries);
          self._loading = false;
          // Clear the unavailable flag BEFORE re-running search so a successful
          // retry (e.g. via the openDialog() reload path) fully recovers (#2062).
          self._indexUnavailable = false;
          // If user already typed, search now
          if (self._input && self._input.value.trim()) {
            self.search();
          }
        })
        .catch(function() {
          self._loading = false;
          self._indexUnavailable = true;
          if (self._results) {
            self._results.innerHTML = "<p class=\\"text-small text-muted\\">" + escapeHtml(self._searchUnavailable) + "</p>";
          }
        });
    }

    search() {
      var query = this._input ? this._input.value.trim() : "";
      this._currentQuery = query;

      if (!query) {
        this.teardownSentinel();
        this._allResults = [];
        this._shownCount = 0;
        if (this._results) this._results.innerHTML = this.placeholderHtml();
        this.updateCount();
        return;
      }

      if (!this._entries) {
        // Index failed to load: show the terminal "Search unavailable" state and
        // stop — do NOT show "Loading search index…" or refetch on every
        // keystroke (#2062). The openDialog() reload path is the intended retry
        // trigger. Clear any stale result state/count/sentinel first.
        if (this._indexUnavailable) {
          this.teardownSentinel();
          this._allResults = [];
          this._shownCount = 0;
          if (this._results) {
            this._results.innerHTML = "<p class=\\"text-small text-muted\\">" + escapeHtml(this._searchUnavailable) + "</p>";
          }
          this.updateCount();
          return;
        }
        if (this._results) {
          this._results.innerHTML = "<p class=\\"text-small text-muted\\">" + escapeHtml(this._loadingIndex) + "</p>";
        }
        if (!this._loading) this.loadIndex();
        return;
      }

      // Lowercase the query terms once here so scoreEntry() can do plain
      // indexOf() against pre-lowercased entry fields without repeating
      // toLowerCase() across the entire index on every keystroke.
      var terms = parseTerms(query).map(function(t) { return t.toLowerCase(); });
      var scored = [];
      for (var i = 0; i < this._entries.length; i++) {
        var s = scoreEntry(this._entries[i], terms);
        if (s > 0) scored.push({ entry: this._entries[i], score: s });
      }
      scored.sort(function(a, b) { return b.score - a.score; });
      this._allResults = scored;
      this._shownCount = 0;
      this.teardownSentinel();
      this.updateCount();

      if (!scored.length) {
        if (this._results) {
          this._results.innerHTML = "<p class=\\"text-small text-muted\\">" + escapeHtml(this._noResults) + "</p>";
        }
        return;
      }

      if (this._results) this._results.innerHTML = "";
      this.loadMore();
      if (this._shownCount < this._allResults.length) {
        this.setupSentinel();
      }
    }

    loadMore() {
      if (this._isLoadingBatch) return;
      if (this._shownCount >= this._allResults.length) return;
      this._isLoadingBatch = true;
      try {
        var batch = this._allResults.slice(this._shownCount, this._shownCount + PAGE_SIZE);
        var self = this;
        for (var i = 0; i < batch.length; i++) {
          var article = self.renderResult(batch[i].entry);
          if (self._sentinel && self._sentinel.parentNode === self._results) {
            self._results.insertBefore(article, self._sentinel);
          } else if (self._results) {
            self._results.appendChild(article);
          }
        }
        this._shownCount += batch.length;
        if (this._shownCount >= this._allResults.length) {
          this.teardownSentinel();
        }
      } finally {
        this._isLoadingBatch = false;
      }
    }

    setupSentinel() {
      this.teardownSentinel();
      if (!this._results) return;
      var sentinel = document.createElement("div");
      sentinel.setAttribute("data-search-sentinel", "");
      sentinel.setAttribute("aria-hidden", "true");
      sentinel.style.height = "1px";
      sentinel.style.width = "100%";
      this._results.appendChild(sentinel);
      this._sentinel = sentinel;
      var self = this;
      this._observer = new IntersectionObserver(function(entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) self.loadMore();
        }
      }, { root: this._results, rootMargin: "200px 0px" });
      this._observer.observe(sentinel);
    }

    teardownSentinel() {
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      if (this._sentinel) { this._sentinel.remove(); this._sentinel = null; }
    }

    updateCount() {
      var count = this._allResults.length;
      var template = this._resultCountTemplate;
      var text = count > 0 ? template.replace("{count}", String(count)) : "";
      var show = !!text;
      if (this._countWide) {
        this._countWide.textContent = text;
        this._countWide.classList.toggle("hidden", !show);
      }
      if (this._countNarrow) {
        this._countNarrow.textContent = text;
        this._countNarrow.classList.toggle("hidden", !show);
      }
    }

    placeholderHtml() {
      return this._placeholderHtml;
    }

    renderResult(entry) {
      var article = document.createElement("article");
      article.className = "-mx-hsp-lg border-b border-muted";
      var link = document.createElement("a");
      link.href = safeHref(entry.url);
      link.className =
        "group block px-hsp-lg py-vsp-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
      var title = document.createElement("span");
      title.className =
        "font-semibold text-fg group-hover:text-accent group-hover:underline group-focus-visible:underline";
      var terms = parseTerms(this._currentQuery);
      title.innerHTML = highlightTerms(entry.title || "", terms);
      link.appendChild(title);
      var text = entry.description || entry.body;
      if (text) {
        var excerpt = document.createElement("p");
        excerpt.className =
          "mt-vsp-2xs text-caption text-muted leading-relaxed group-hover:underline group-focus-visible:underline decoration-muted";
        var truncated = truncate(text, this._currentQuery, 200);
        excerpt.innerHTML = highlightTerms(truncated, terms);
        link.appendChild(excerpt);
      }
      article.appendChild(link);
      return article;
    }
  });
})();`;
}

// ── CLI entry: write-if-changed ─────────────────────────────────────────────
// Realpath both sides: Node resolves the ESM entry's `import.meta.url` to its
// REAL path (default --preserve-symlinks=false) while `process.argv[1]` keeps
// whatever spelling the invoker typed, so under a symlinked checkout a plain
// `resolve()` comparison silently mismatches and the CLI becomes an exit-0
// no-op — leaving generated-script.ts missing (hard tsup failure later) or,
// worse, stale.
const isMainModule = (() => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMainModule) {
  const script = buildSearchWidgetScript();

  const banner = `// GENERATED FILE — do not edit by hand.
// Produced by scripts/gen-search-widget-script.mjs (zudolab/zudo-doc#3412)
// from src/search-widget-script/scoring.ts (prepareLc/scoreEntry,
// type-stripped) and src/transitions/page-events.ts (AFTER_NAVIGATE_EVENT).
// Re-run \`pnpm --filter @takazudo/zudo-doc gen:search-widget-script\` (or any
// build/dev entry point, which already runs it) to regenerate after editing
// either source file.
`;

  const output = `${banner}
/** Composes the frozen \`<site-search>\` client IIFE script. Exported so the
 * vitest drift guard can prove SEARCH_WIDGET_SCRIPT below still matches this
 * literal (a re-generation of it would be a no-op, not a rebuild). */
export function buildSearchWidgetScript(): string {
  return ${JSON.stringify(script)};
}

/** Client-side script string for the SiteSearch custom element. See the
 * module header of this generator for the embedding contract; see
 * scoring.ts / transitions/page-events.ts for the frozen sources. */
export const SEARCH_WIDGET_SCRIPT: string = buildSearchWidgetScript();
`;

  const existing = existsSync(OUTPUT_PATH)
    ? readFileSync(OUTPUT_PATH, "utf8")
    : null;

  if (existing === output) {
    process.stdout.write(
      "[gen-search-widget-script] generated-script.ts unchanged, skip write\n",
    );
  } else {
    writeFileSync(OUTPUT_PATH, output, "utf8");
    process.stdout.write(
      "[gen-search-widget-script] generated-script.ts written\n",
    );
  }
}
