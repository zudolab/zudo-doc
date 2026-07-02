# md-plugins audit — Astro → zfb migration

## Package status — PRIVATE fixture/parity-test asset

**This package is NOT published and is NOT shippable API.**

It exists solely to:

1. Hold the JS-side plugin implementations as a reference corpus for parity
   diffing against the zfb Rust pipeline.
2. Run `src/__tests__/` and exercise `__fixtures__/` so regressions in either
   the JS or zfb side are caught by `pnpm test` before merge.

`scaffold.ts` (`packages/create-zudo-doc`) explicitly excludes this package
from generated project dependencies. `zfb.config.ts` references it only in
comments. **Do not import from app code.**

See `src/index.ts` for the surviving exports and their test-only rationale.

---

## Status note (deep-review #1338, 2026-05-04)

`stripMdExt: true` is now wired in `zfb.config.ts` so author-written
`[label](./other.mdx)` links resolve to rendered route URLs at build
time. After enabling it, `dist/` carried only two stragglers:

- `dist/ja/docs/getting-started/writing-docs/index.html`
- `dist/ja/docs/guides/header-navigation/index.html`

Both leftovers are `[label](path.mdx)` references inside `:::note` /
`:::tip` admonition directives — zfb's strip-md-ext pass does not
descend into the admonition-injected JSX subtree. Tracked separately;
the gap is documented here rather than blocking the deep-review pass.

---

This document classifies every plugin under `packages/md-plugins/src/`
against the Rust pipeline shipped by **zfb** (the Rust-native build
orchestrator that will replace the Astro pipeline). It also describes
the fixture corpus under `__fixtures__/` and what it can — and can NOT
— prove on its own.

References:

- Tracking issue: zudolab/zudo-doc#475
- Epic PR: zudolab/zudo-doc#483
- Super-epic: zudolab/zudo-doc#473
- zfb pipeline (Rust): `crates/zfb-content/src/pipeline.rs` —
  `Pipeline::with_defaults()`

## zfb default pipeline (Rust)

`Pipeline::with_defaults()` wires the following visitors in this order:

**mdast phase**

1. `AdmonitionsPlugin` — backed by `DirectiveRegistry::with_defaults`,
   handles `:::note`, `:::tip`, `:::warning`, `:::danger`, `:::info`,
   `:::details`. Emits `MdxJsxFlowElement` nodes (`<Note>`, `<Tip>`,
   …).

**hast phase**

2. `HeadingLinksPlugin`
3. `CodeTitlePlugin`
4. `ImageEnlargePlugin`
5. `MermaidPlugin`
6. `SyntectPlugin` (code highlighting — Astro's Shiki-equivalent)

**Explicitly NOT in defaults** (per the Rust doc-comment on
`with_defaults`):

- `ResolveLinksPlugin` — needs a project-specific path → URL
  `source_map`, so the orchestrator constructs it explicitly.
- `StripMdExtensionPlugin` — opt-in for sites whose authors hand-write
  `[link](other.md)` style references.

## Plugin classification

Legend:

- ✅ **drop-in** — the JS plugin and the zfb default produce the
  same logical output; minor attribute/class differences are noted
  separately and tracked as follow-up issues.
- ⚠️ **divergence** — the JS plugin and zfb default produce different
  HTML/JSX. Decision needed: align zfb to JS, align JS to zfb, or run
  the JS variant as a shim during transition.
- ❌ **not in zfb defaults** — JS plugin has no zfb counterpart;
  must be ported, replaced, or added as a JS shim.

### Remark (mdast) plugins

| JS plugin | zfb counterpart | Status | Notes |
| --- | --- | --- | --- |
| `remarkAdmonitions` | `AdmonitionsPlugin` | ⚠️ | JS handles 5 directives (note/tip/info/warning/danger). zfb handles 6 (adds `details`) and ships a runtime-extensible `DirectiveRegistry`. Output JSX node names match for the 5 shared directives. JS plugin currently silently passes `:::details` through as a raw container directive. Recommend aligning JS to zfb (add details) before final cutover, or relying on zfb defaults post-cutover. |
| `remarkResolveMarkdownLinks` | `ResolveLinksPlugin` | ✅ resolved (zudo-doc#2325, 2026-06-24; re-verified zudo-doc#2539) | **STALE NOTE CORRECTED (was: "orchestrator does not instantiate ResolveLinksPlugin").** The zudo-doc#2321 package-first migration wired `resolveMarkdownLinks: buildResolveMarkdownLinks(settings)` into `packages/zudo-doc/src/preset.ts` (`zudoDocPreset()`, landed in #2325), so every `zudoDocPreset()` consumer — including this repo's own `zfb.config.ts` — now passes a real per-collection source map (`{ dir, routePrefix }` for the default docs dir, each locale, and each version) to the Rust `ResolveLinksPlugin`. Re-verified end-to-end against a built smoke-fixture `dist/` for zudo-doc#2539: `[Sibling page](./page-1.mdx)` resolves to `href="/docs/guides/page-1/"`, including the query-string case (`[With query](./page-1.mdx?foo=bar)` → `href="/docs/guides/page-1/?foo=bar"`) — see `e2e/smoke-markdown-features.spec.ts`. The JS shim file (`packages/md-plugins/src/remark-resolve-markdown-links.ts`) is no longer a "dead code in the consumer" placeholder describing an unwired plugin; it remains solely as fixture/parity-test reference per this package's stated purpose. |
| `remarkMath` (3rd-party) | — | ❌ | Not in zfb defaults. Either port, add a Rust crate (e.g. `markdown-rs` math support), or run as a JS shim. Currently feature-flagged via `settings.math`. |
| `remarkCjkFriendly` (3rd-party) | `CjkFriendlyPlugin` | ✅ retired (zfb #102, T4, 2026-05-01) | zfb #102 ported the CJK-aware emphasis/strong tokenisation as `CjkFriendlyPlugin`, which `Pipeline::with_defaults()` registers as the first mdast visitor (see `crates/zfb-content/src/pipeline.rs:227`). Verified end-to-end against the production build at this commit: `dist/ja/docs/reference/cjk-friendly/index.html` renders `<strong class="font-bold text-fg">扱わない</strong>` from the source `**扱わない**`-pattern in `src/content/docs-ja/reference/cjk-friendly.mdx`, and 10+ other JA pages contain CJK runs wrapped in `<strong>`. There is no separate JS shim file for CJK in this repo — `remark-cjk-friendly` is a 3rd-party npm package consumed only by `__tests__/fixtures.test.ts` for parity diffing, so the dependency stays as-is until the fixture corpus itself is retired. The `settings.cjkFriendly` flag is now dead code on the JS side and is preserved purely for downstream-template back-compat. |
| `remarkDirective` (3rd-party) | (handled inside `AdmonitionsPlugin`) | ✅ | zfb's directives are parsed natively by the Rust admonitions / directive registry. No counterpart needed in zfb config. |

### Rehype (hast) plugins

| JS plugin | zfb counterpart | Status | Notes |
| --- | --- | --- | --- |
| `rehypeCodeTitle` | `CodeTitlePlugin` | ✅ retired (zfb #104) | zfb now emits `<div class="code-block-container"><div class="code-block-title">…</div><pre>…</pre></div>` byte-for-byte. JS shim deleted (both `packages/md-plugins/src/rehype-code-title.ts` and `src/plugins/rehype-code-title.ts`); `__fixtures__/05-code-titles.{mdx,html}` retired. |
| `rehypeHeadingLinks` | `HeadingLinksPlugin` | ✅ retired (zfb #104) | zfb appends `<a href="#id" class="hash-link" aria-label="Direct link to …"></a>` (empty body, `#` glyph rendered via CSS `::after`) with the same github-slugger-equivalent dedup. JS shim deleted; `__fixtures__/02-headings.{mdx,html}` retired. |
| `rehypeImageEnlarge` | `ImageEnlargePlugin` | ✅ retired (zfb #104) | zfb selector and shape match the JS shim verbatim — any `<p>` whose only non-whitespace child is `<img>` is replaced with `<figure class="zd-enlargeable"><img><button class="zd-enlarge-btn" hidden>…4-polygon SVG…</button></figure>`, `title="no-enlarge"` opt-out preserved, idempotent over already-wrapped figures. JS shim deleted; `__fixtures__/07-image-enlarge.{mdx,html}` retired. |
| `rehypeMermaid` | `MermaidPlugin` | ✅ retired (zfb #104) | zfb keys on `<pre><code class="language-mermaid">` directly (no Shiki dependency) and emits `<div class="mermaid" data-mermaid>{body text}</div>` — same output shape as the JS shim, even though the upstream selector differs. Client-side renderer is unchanged. JS shim deleted; `__fixtures__/06-mermaid.{mdx,html}` retired. |
| `rehypeStripMdExtension` | `StripMdExtensionPlugin` | ⚠️ intentional divergence — pinned + covered (zudo-doc#2539) | zfb's `with_trailing_slash` mode matches the JS shim for the common `.md`/`.mdx` → `/` and extensionless-relative cases. **Divergence:** the JS regex `/\.mdx?(#.*)?$/` does not handle query strings — `./other.md?foo=bar` is left as-is in the JS pipeline (`__fixtures__/expected-html/08-md-links.html` line 6, now annotated in-fixture with an HTML comment explaining this is a pinned retired-bug reference, not a live regression). The zfb port intentionally fixes this bug: for real markdown-syntax links reaching `StripMdExtensionPlugin` via `resolveMarkdownLinks`, the query string is preserved and the path is still resolved/slash-terminated (e.g. `./other.mdx?foo=bar` → `/docs/.../other/?foo=bar`). This is no longer just documented here — it is proven end-to-end against a built `dist/` by `e2e/smoke-markdown-features.spec.ts` (zudo-doc#2539). Note the JS-side and Rust-side coverage differ in shape: the JS fixture exercises raw HTML `<a href>` attributes as well as markdown-syntax links (both go through `rehype-raw` in this package's driver), whereas in the production MDX pipeline a JSX-authored `<a href="...">` bypasses `StripMdExtensionPlugin`/`resolveMarkdownLinks` entirely (it is not a markdown mdast link node) and is emitted byte-for-byte as authored — also asserted by the new e2e spec. JS shim and fixture are kept as the historical/retired-bug reference; see AUDIT NOTE-2 below. |
| `rehypeKatex` (3rd-party) | — | ❌ | Not in zfb defaults. Either port, find a Rust KaTeX renderer, or shim in JS post-zfb. Feature-flagged via `settings.math`. |

## Plugins that need zfb-side work

These are tracked as follow-up GitHub issues against this repo
(`zudolab/zudo-doc`, label `zfb-migration`):

1. **remarkMath + rehypeKatex** — math rendering not in zfb defaults.
2. ~~**remarkCjkFriendly**~~ — resolved by zfb #102 (`CjkFriendlyPlugin`,
   wired in `Pipeline::with_defaults`). Verified at the dist level on
   2026-05-01 (T4).
3. ~~**rehypeImageEnlarge**~~ — resolved by zfb #104; JS shim retired (T5).
4. ~~**rehypeHeadingLinks**~~ — resolved by zfb #104; JS shim retired (T5).
5. ~~**rehypeCodeTitle**~~ — resolved by zfb #104; JS shim retired (T5).
6. ~~**rehypeMermaid**~~ — resolved by zfb #104; JS shim retired (T5).
7. **rehypeStripMdExtension** — zfb #104 added trailing-slash behaviour and
   fixed the `\.mdx?(#.*)?$` query-string bug; the bug fix is a documented
   divergence from the JS fixture (`./other.md?foo=bar` → `./other/?foo=bar`
   in zfb vs. unchanged in JS). ~~Filed as a follow-up so downstream
   contracts state the fix is intentional.~~ **Superseded (zudo-doc#2539):**
   the fix is proven end-to-end against production `dist/` by
   `e2e/smoke-markdown-features.spec.ts` — no upstream zfb issue is needed to
   "clarify" the contract, the L3 golden IS the contract now. JS shim + the
   `08-md-links` fixture stay as the retired-bug reference (see NOTE-2).
8. ~~**remarkResolveMarkdownLinks**~~ — **resolved (zudo-doc#2325,
   2026-06-24).** zfb #103 ported the extensionless probe into
   `ResolveLinksPlugin` itself, AND the zudo-doc#2321 package-first migration
   wired the orchestrator side: `packages/zudo-doc/src/preset.ts`
   (`zudoDocPreset()`) now passes `resolveMarkdownLinks:
   buildResolveMarkdownLinks(settings)` — a real per-collection source map —
   into every consumer's zfb config, including this repo's own
   `zfb.config.ts`. `.md`/`.mdx` links now resolve at the dist level
   (re-verified for zudo-doc#2539 against a built smoke-fixture `dist/`; see
   NOTE-1). JS shim retained as fixture/parity-test reference only (this
   package's stated purpose — see the package-status note at the top of this
   file).
9. **remarkAdmonitions** — JS implementation does not handle
   `:::details`; zfb does. Align before cutover.

## NOTE — pending upstream zfb follow-ups (out of scope for this repo)

**Both NOTEs below are now RESOLVED at the zudo-doc consumer level** — kept
for history (they explain why the JS shims and fixture corpus still exist
even though production no longer exhibits either gap) rather than deleted.

### NOTE-1: `ResolveLinksPlugin` orchestrator wiring — RESOLVED (zudo-doc#2325)

**Status:** wired in production; JS shim retained only as fixture/parity-test
reference (see item 8 above).

The zfb port of `remarkResolveMarkdownLinks` lives in
`crates/zfb-content/src/plugins/resolve_links.rs` (zfb #103). At the time this
note was first written (2026-05-01), the zfb **orchestrator** did not yet
instantiate `ResolveLinksPlugin` for the production build. That gap closed
with the zudo-doc#2321 package-first migration (#2325, 2026-06-24):
`zudoDocPreset()` now builds and passes a real project-level source map
(`buildResolveMarkdownLinks()` — one `{ dir, routePrefix }` entry per content
collection: default docs dir, each locale, each version) to
`ResolveLinksPlugin`. Re-verified for zudo-doc#2539 against a built
smoke-fixture `dist/`: `[Sibling page](./page-1.mdx)` → `href="/docs/guides/page-1/"`.
See `e2e/smoke-markdown-features.spec.ts` for the standing L3 regression
coverage — no upstream `Takazudo/zudo-front-builder` action is needed here.

### NOTE-2: `rehypeStripMdExtension` query-string divergence — RESOLVED at the consumer level (zudo-doc#2539)

**Status:** intentionally pinned in the JS fixture (annotated in-fixture with
an HTML comment) + proven fixed in production by an L3 golden.

The JS regex `/\.mdx?(#.*)?$/` does not match query strings, so
`./other.md?foo=bar` is left unchanged in the JS pipeline
(`__fixtures__/expected-html/08-md-links.html` line 6 — the source `.mdx`
fixture now carries an HTML comment directly below this case explaining it is
a deliberately pinned retired-bug reference, not a live regression). The zfb
port (`StripMdExtensionPlugin`, zfb #104) intentionally fixes this bug.

Rather than waiting on an upstream `Takazudo/zudo-front-builder` issue to
"formally document" the fix as the defined contract, zudo-doc#2539 added a
standing L3 assertion against production `dist/`
(`e2e/smoke-markdown-features.spec.ts`, "With query" case) that fails if this
regresses. The JS fixture is unchanged (still pins the old JS-only bug
behaviour on purpose, per the package's stated fixture/parity-test purpose)
— only the production contract needed proving, and it now is.

## Fixture corpus

`__fixtures__/` contains 9 representative MDX files plus reference
HTML output under `__fixtures__/expected-html/`. The driver lives at
`src/__tests__/fixtures.test.ts` and runs as part of `pnpm test`.

After zfb #104 retired the four "shape" rehype plugins, the fixtures
that exercised them only (`02-headings`, `05-code-titles`, `06-mermaid`,
`07-image-enlarge`) were dropped. Coverage of those shapes lives in the
zfb crate's per-plugin Rust unit tests.

| Fixture | Exercises |
| --- | --- |
| `01-basic-prose.mdx` | Paragraphs, inline marks, links, ul/ol nesting |
| `03-admonitions-directive.mdx` | `:::note/tip/info/warning/danger` directive form |
| `04-admonitions-jsx.mdx` | JSX-form admonitions (`<Note>`, `<Tip>`, …) |
| `08-md-links.mdx` | `.md`/`.mdx` link rewriting incl. anchors and queries — the query-string case (line 6 of the expected HTML) intentionally pins the retired JS `rehypeStripMdExtension` bug and carries an in-fixture comment saying so; the production Rust fix is proven separately by `e2e/smoke-markdown-features.spec.ts` (see NOTE-2) |
| `09-tables.mdx` | GFM tables with inline marks, code, and links |
| `10-math.mdx` | `remarkMath` + `rehypeKatex` (inline and display) |
| `11-cjk.mdx` | `remarkCjkFriendly` (Japanese, Chinese, Korean) |
| `12-blockquote-and-rule.mdx` | Blockquotes, `<hr>`, GFM strikethrough |
| `13-strip-md-extension.mdx` | Raw HTML `<a>` links exercising `rehypeStripMdExtension` |

Production (zfb Rust) coverage for the behaviour clusters this corpus
represents — admonitions/directives, CJK-friendly emphasis, `.md`/`.mdx` link
rewriting (incl. the query-string case), and GFM tables — now also has L3
golden coverage against a built `dist/` in `e2e/smoke-markdown-features.spec.ts`
plus the pre-existing `e2e/smoke-admonitions.spec.ts` /
`e2e/smoke-directives.spec.ts` (zudolab/zudo-doc#2539). That is genuinely new
coverage, not a duplicate of this corpus: this corpus proves the **JS shim's**
own behaviour (useful for the parity-diffing purpose stated at the top of
this file); the e2e specs prove the **shipping Rust pipeline's** behaviour,
which no automated test asserted before #2539.

### What the captured HTML proves — and what it does not

zfb's runtime is intentionally **not** booted here. The fixture driver
builds a `unified` pipeline that mirrors `zfb.config.ts`, but with these
documented limitations:

- **Shiki / Syntect is not run.** Reference HTML does not include
  syntax-highlighted spans; the remaining fixtures avoid fenced code
  entirely so the absence is invisible in expected output.
- **`remarkResolveMarkdownLinks` is NOT run** in the driver because
  the fixtures do not have a real filesystem source map. The
  `rehypeStripMdExtension` cleanup still runs, so the `.md`/`.mdx` →
  `/` rewrite is exercised. The resolve plugin has independent
  unit-test coverage in `src/__tests__/remark-resolve-markdown-links.test.ts`.
- **MDX JSX is not resolved.** `rehype-raw` parses fixtures' raw HTML
  (e.g. `<Note>` in `04-admonitions-jsx.mdx`) into hast elements with
  lowercased tag names. The directive-form admonitions in
  `03-admonitions-directive.mdx` are converted into `mdxJsxFlowElement`
  nodes by `remarkAdmonitions`, which `remark-rehype` then renders as
  bare `<div>` (no MDX runtime is present to resolve `<Note>` to a
  component). Both are expected; the underlying transform is what is
  being captured, not the final rendered HTML.

These limitations are intentional. The fixture corpus exists so that:

1. The same MDX inputs can be processed by zfb once it is wired up,
   and the JSX-module / HTML output can be diffed against the captured
   reference;
2. Future plugin changes on the JS side accidentally regressing
   behaviour are caught by `pnpm test` before merge;
3. The plugin classification table above can be updated with concrete
   examples whenever zfb behaviour changes.

### Regenerating the corpus

To regenerate the reference HTML after intentional plugin changes:

```bash
cd packages/md-plugins
UPDATE_FIXTURES=1 pnpm test
```

The driver writes back `__fixtures__/expected-html/<name>.html` for
each fixture and then asserts every fixture matches its file. Without
`UPDATE_FIXTURES=1`, the driver only asserts.
