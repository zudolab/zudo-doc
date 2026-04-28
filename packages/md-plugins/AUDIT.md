# md-plugins audit — Astro → zfb migration

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
| `remarkResolveMarkdownLinks` | `ResolveLinksPlugin` | ✅ (with caveat) | Both rewrite `.md`/`.mdx` link targets to final site URLs. JS rebuilds the source map on every call (so dev-server new files Just Work); zfb expects a pre-built `HashMap<PathBuf, String>` from the orchestrator. Final URL output matches given the same source map. JS additionally probes extensionless candidates (`./guide` → `./guide.mdx`, `./guide/index.mdx`). zfb does NOT — it keys strictly on the explicit path. **Action:** decide whether the extensionless probing must be ported or whether content can be re-authored to use explicit extensions. Filed as a follow-up issue. |
| `remarkMath` (3rd-party) | — | ❌ | Not in zfb defaults. Either port, add a Rust crate (e.g. `markdown-rs` math support), or run as a JS shim. Currently feature-flagged via `settings.math`. |
| `remarkCjkFriendly` (3rd-party) | — | ❌ | Not in zfb defaults. Adjusts emphasis/strong parsing around CJK characters. Currently feature-flagged via `settings.cjkFriendly`. Likely best ported as a small Rust visitor since it modifies tokenisation rather than rendering. |
| `remarkDirective` (3rd-party) | (handled inside `AdmonitionsPlugin`) | ✅ | zfb's directives are parsed natively by the Rust admonitions / directive registry. No counterpart needed in zfb config. |

### Rehype (hast) plugins

| JS plugin | zfb counterpart | Status | Notes |
| --- | --- | --- | --- |
| `rehypeCodeTitle` | `CodeTitlePlugin` | ⚠️ | **Different markup.** JS wraps `<pre>` in `<div class="code-block-container"><div class="code-block-title">…</div><pre>…</pre></div>`. zfb wraps in `<figure class="code-figure"><figcaption>…</figcaption><pre>…</pre></figure>`. CSS selectors and the title-rendering Astro component will need to be updated to the new shape on the zfb side, or the Rust plugin needs to be aligned to the existing markup. |
| `rehypeHeadingLinks` | `HeadingLinksPlugin` | ⚠️ | **Different anchor markup.** JS appends `<a href="#id" class="hash-link" aria-label="Direct link to ...">` (empty body — the `#` symbol is rendered via CSS `::after`). zfb prepends `<a href="#id" class="heading-anchor" aria-label="Permalink to this heading">#</a>` (literal `#` text). Both add `id`. Slug algorithm matches (`github-slugger`-equivalent dedup). |
| `rehypeImageEnlarge` | `ImageEnlargePlugin` | ⚠️ | **Different selector AND output.** JS wraps any `<p>` whose only non-whitespace child is `<img>` in `<figure class="zd-enlargeable"><img><button class="zd-enlarge-btn">…SVG…</button></figure>` and supports `title="no-enlarge"` opt-out. zfb only acts on `<img width="…">` and emits an `<ImageEnlarge>` MDX marker (the actual UI is provided by a downstream component). The two strategies are not interchangeable. **Action:** align zfb to the JS strategy, or update content to use explicit `width` attributes plus a new MDX component. |
| `rehypeMermaid` | `MermaidPlugin` | ⚠️ | **Different output.** JS replaces `<pre><code class="language-mermaid">…</code></pre>` with `<div class="mermaid" data-mermaid>…body…</div>` (extracted text, code wrapper discarded). zfb merely adds `data-mermaid="true"` to the `<pre>` and leaves the body in place. Client-side render JS needs to know which shape to look for. |
| `rehypeStripMdExtension` | `StripMdExtensionPlugin` | ⚠️ | Both strip `.md`/`.mdx` from internal `<a href>` paths. JS additionally adds a trailing slash to extensionless relative paths (`./guide` → `./guide/`) for sites running in `trailingSlash: "always"` mode. zfb does not do the trailing-slash patch. **Action:** add the trailing-slash behaviour to zfb (gated on a config flag), or rely on `ResolveLinksPlugin` already producing trailing-slash URLs. |
| `rehypeKatex` (3rd-party) | — | ❌ | Not in zfb defaults. Either port, find a Rust KaTeX renderer, or shim in JS post-zfb. Feature-flagged via `settings.math`. |

## Plugins that need zfb-side work

These are tracked as follow-up GitHub issues against this repo
(`zudolab/zudo-doc`, label `zfb-migration`):

1. **remarkMath + rehypeKatex** — math rendering not in zfb defaults.
2. **remarkCjkFriendly** — CJK-friendly emphasis parsing not in zfb defaults.
3. **rehypeImageEnlarge** — output markup divergence (figure wrapper +
   button SVG vs. `<ImageEnlarge>` MDX marker).
4. **rehypeHeadingLinks** — anchor placement, class name, aria-label,
   and inner `#` body diverge.
5. **rehypeCodeTitle** — wrapper/title element shape diverges
   (`code-block-container/code-block-title` vs `code-figure/figcaption`).
6. **rehypeMermaid** — replacement strategy diverges
   (`<div class="mermaid">` vs `<pre data-mermaid="true">`).
7. **rehypeStripMdExtension** — trailing-slash patch missing on zfb side.
8. **remarkResolveMarkdownLinks** — extensionless candidate probing
   (`./guide` → `./guide.mdx` / `./guide/index.mdx`) not in zfb.
9. **remarkAdmonitions** — JS implementation does not handle
   `:::details`; zfb does. Align before cutover.

## Fixture corpus

`__fixtures__/` contains 13 representative MDX files plus reference
HTML output under `__fixtures__/expected-html/`. The driver lives at
`src/__tests__/fixtures.test.ts` and runs as part of `pnpm test`.

| Fixture | Exercises |
| --- | --- |
| `01-basic-prose.mdx` | Paragraphs, inline marks, links, ul/ol nesting |
| `02-headings.mdx` | h2–h6, dedup of repeated slugs, nested formatting |
| `03-admonitions-directive.mdx` | `:::note/tip/info/warning/danger` directive form |
| `04-admonitions-jsx.mdx` | JSX-form admonitions (`<Note>`, `<Tip>`, …) |
| `05-code-titles.mdx` | Fenced code with and without `title="…"` meta |
| `06-mermaid.mdx` | Mermaid flowchart and sequence diagram |
| `07-image-enlarge.mdx` | Block image, sized image, inline-in-paragraph image, linked image, opt-out title |
| `08-md-links.mdx` | `.md`/`.mdx` link rewriting incl. anchors and queries |
| `09-tables.mdx` | GFM tables with inline marks, code, and links |
| `10-math.mdx` | `remarkMath` + `rehypeKatex` (inline and display) |
| `11-cjk.mdx` | `remarkCjkFriendly` (Japanese, Chinese, Korean) |
| `12-blockquote-and-rule.mdx` | Blockquotes, `<hr>`, GFM strikethrough |
| `13-strip-md-extension.mdx` | Raw HTML `<a>` links exercising `rehypeStripMdExtension` |

### What the captured HTML proves — and what it does not

Astro's runtime is intentionally **not** booted here (per the topic
brief). The fixture driver builds a `unified` pipeline that mirrors
`astro.config.ts`, but with these documented limitations:

- **Shiki is not run.** A small in-test `rehypeShimShiki` step adds
  the two attributes the rehype plugins depend on (`data-language` on
  `<pre>` and `meta` on `<code>`). The reference HTML therefore does
  **not** include syntax-highlighted spans. zfb will run `SyntectPlugin`
  to produce its own highlighted output; final byte-diff verification
  against the live site is OUT OF SCOPE here and must happen once
  zfb is fully wired into the build.
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
