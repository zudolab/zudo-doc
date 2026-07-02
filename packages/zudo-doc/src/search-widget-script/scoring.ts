// scoring.ts — pure word-match index-prep / scoring functions for the
// `<site-search>` client widget (C2 / S9: pre-lowercase the index once at
// load time so scoreEntry() can do plain indexOf() against cached
// `_titleLc/_descLc/_bodyLc` fields instead of calling toLowerCase() on the
// entire index on every debounced keystroke).
//
// This module is the canonical implementation. `./index.ts` embeds these
// functions verbatim into the client IIFE via `Function.prototype.toString()`
// so the shipped inline script and this tested module can never drift —
// see the embedding comment in index.ts for why that's safe here (plain
// `function` declarations, no closures, TS types erased at compile time).
//
// Written in `var`-style ES5 function bodies (not `const`/arrow) to match
// the rest of the IIFE's coding style once embedded — cosmetic only, has
// no effect on behavior in the browsers this widget targets.

export interface SearchEntry {
  title?: string;
  description?: string;
  body?: string;
  // Pre-lowercased fields added by prepareLc().
  _titleLc?: string;
  _descLc?: string;
  _bodyLc?: string;
}

/** An entry after prepareLc() has run — the three Lc fields are guaranteed present. */
export interface ScoredSearchEntry {
  _titleLc: string;
  _descLc: string;
  _bodyLc: string;
}

// Pre-lowercase the searched fields on each entry once at load time so that
// scoreEntry() does not re-lowercase the entire index on every debounced
// keystroke. Original-case fields are preserved for display.
export function prepareLc(entries: SearchEntry[]): void {
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i]!;
    e._titleLc = (e.title || "").toLowerCase();
    e._descLc = (e.description || "").toLowerCase();
    e._bodyLc = (e.body || "").toLowerCase();
  }
}

// scoreEntry reads pre-lowercased fields (_titleLc, _descLc, _bodyLc) set by
// prepareLc() at index-load time. Terms arrive already lowercased from the
// caller so no per-call toLowerCase() is needed.
export function scoreEntry(entry: ScoredSearchEntry, terms: string[]): number {
  var score = 0;
  var titleLc = entry._titleLc;
  var descLc = entry._descLc;
  var bodyLc = entry._bodyLc;
  for (var i = 0; i < terms.length; i++) {
    var t = terms[i]!;
    if (titleLc.indexOf(t) !== -1) score += 3;
    if (descLc.indexOf(t) !== -1) score += 2;
    if (bodyLc.indexOf(t) !== -1) score += 1;
  }
  return score;
}
