# md-plugins audit — Astro → zfb migration

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
| `remarkResolveMarkdownLinks` | `ResolveLinksPlugin` | ⚠️ divergence (T4, 2026-05-01) | zfb #103 added extensionless candidate probing inside `ResolveLinksPlugin` itself, so the Rust plugin and the JS shim are now feature-equivalent at the unit level (probe order matches: `.mdx` → `.md` → `.../index.mdx` → `.../index.md`). HOWEVER: the zfb orchestrator (zfb-build / zfb-render) does NOT currently instantiate `ResolveLinksPlugin` at all — the JS shim has been unwired alongside the Astro removal, but no zfb-side replacement was added. As of this commit, both explicit `.mdx`/`.md` links AND extensionless candidates pass through the production build unresolved (e.g. `dist/docs/getting-started/writing-docs/index.html` contains a literal `href="../guides/frontmatter.mdx"` from the inline prose link on line 38 of the source mdx). The JS shim file at `packages/md-plugins/src/remark-resolve-markdown-links.ts` is therefore intentionally left in place (dead code in the consumer, but still authoritative for fixture / unit coverage) until the orchestrator wires `ResolveLinksPlugin` with a real source map. Tracking: needs a follow-up zfb-side issue (orchestrator wiring of `ResolveLinksPlugin` + project-level source-map provider). |
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
| `rehypeStripMdExtension` | `StripMdExtensionPlugin` | ⚠️ divergence pending zfb follow-up | zfb's `with_trailing_slash` mode matches the JS shim for the common `.md`/`.mdx` → `/` and extensionless-relative cases. **Divergence:** the JS regex `/\.mdx?(#.*)?$/` does not handle query strings — `./other.md?foo=bar` is left as-is in the JS pipeline (`__fixtures__/expected-html/08-md-links.html` line 6). The zfb port intentionally fixes this bug and emits `./other/?foo=bar`. JS shim is kept (and the fixture preserved) until the manager files an upstream zfb follow-up clarifying that the bug fix is the documented behaviour. |
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
   in zfb vs. unchanged in JS). Filed as a follow-up so downstream
   contracts state the fix is intentional. JS shim kept until the
   follow-up lands.
8. **remarkResolveMarkdownLinks** — zfb #103 ported the extensionless
   probe into `ResolveLinksPlugin` itself, BUT the zfb orchestrator does
   not yet instantiate `ResolveLinksPlugin` for the production build, so
   `.md`/`.mdx` and extensionless link rewriting are absent at the dist
   level (verified by T4 on 2026-05-01: `../guides/frontmatter.mdx`
   passes through unchanged into `dist/docs/getting-started/writing-docs/index.html`).
   Follow-up needed on the zfb side: orchestrator wiring +
   project-level source-map provider. JS shim retained until then.
9. **remarkAdmonitions** — JS implementation does not handle
   `:::details`; zfb does. Align before cutover.

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
| `08-md-links.mdx` | `.md`/`.mdx` link rewriting incl. anchors and queries |
| `09-tables.mdx` | GFM tables with inline marks, code, and links |
| `10-math.mdx` | `remarkMath` + `rehypeKatex` (inline and display) |
| `11-cjk.mdx` | `remarkCjkFriendly` (Japanese, Chinese, Korean) |
| `12-blockquote-and-rule.mdx` | Blockquotes, `<hr>`, GFM strikethrough |
| `13-strip-md-extension.mdx` | Raw HTML `<a>` links exercising `rehypeStripMdExtension` |

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
