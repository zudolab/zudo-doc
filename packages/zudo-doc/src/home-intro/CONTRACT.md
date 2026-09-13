# Homepage introduction contract

`HomeConfig.introMarkdown` and `HomeConfig.sitemapHeading` default to empty
strings. `LocaleConfig` accepts the same optional strings. A defined locale
field wins over its home counterpart, including an explicit empty string.
Whitespace-only intro renders nothing. A blank resolved sitemap heading uses
`t("home.sitemapHeading", locale)`: English “Explore the documentation”,
Japanese “ドキュメントを探す”. The existing description remains the tagline.

## Preparation and downstream adapter API

The async routes-plugin `virtual:zudo-doc-route-context` loader calls
`prepareHomeIntros(settings)` and serializes `homeIntros` alongside settings.
`createRouteContext(payload)` exposes `ctx.homeIntros[locale]`. Host root and
localized pages should consume that virtual payload too. The loader exists
when `packageOwnedRoutes` is false. A host creating payloads outside that
plugin calls `prepareHomeIntros` at its own async server/build boundary and
passes the result as `createRouteContextPayload({ ..., homeIntros })`.

The public server-only `@takazudo/zudo-doc/home-intro/prepare` export contains
`prepareHomeIntro(source, settings, locale)`, `prepareHomeIntros(settings)` and
`resolveIntroUrl`. Its public zfb `/parse` and `/render` imports load only for a
nonblank intro; the optional `@takazudo/zfb-md-wasm` peer is required then.
Rendering failure is build-fatal, with a `home.introMarkdown` diagnostic.

The public presentational `@takazudo/zudo-doc/home-intro` export contains
`CompactProse({ intro })`, `resolveHomeIntro(settings, locale,
translatedSitemapHeading)`, and serializable payload types. It carries no
renderer, WASM or Node import and is synchronous. `intro` is trusted prepared
data, not arbitrary editor JSON. It reuses `defaultComponents` for non-heading
Markdown and `makeAdmonition` for alerts; headings are plain native elements, except that
the H2 carries `HOME_SECTION_HEADING_CLASS` (`zd-home-heading …`) so it matches
the sitemap and Tags headings and stays free of theme-pack h2 decoration
(zudolab/zudo-doc#4194).
No raw HTML sink, eval, MDX compilation or document TOC insertion is involved.

Use `.zd-home-inner` for both identity and prose outer wrappers: 100% available
width capped at 60rem, centered with zero minimum inline size. `CompactProse`
provides `.zd-content.zd-compact-prose`; content.css owns its compact flow and
heading sizes. The downstream layout owns separators and padding outside this
width cap, and the independent sitemap H2. Empty/null intro yields no element.

## Supported feature matrix

| Feature | Contract |
|---|---|
| Headings H1–H6 | H1 becomes H2; other levels retained. Production H2+ IDs retained; generated hash anchors removed. H1 normalization does not allocate a new ID. No document TOC. |
| Paragraphs, emphasis, strong, deletion, breaks | Production CommonMark/GFM rendering with shared typography. |
| Ordered/unordered/nested/task lists | Supported, with checked/disabled checkbox attributes preserved. |
| Links, reference links, images | Supported under the URL rules below; image alt/title, link title and safe attributes retained. Images responsive. No filesystem dimension lookup or asset-viewer remapping. |
| Quotes and GitHub alerts | Supported; alerts use the package admonition components. |
| Fenced/inline code | Production semantic `hi-root`/`hi-*` classes retained. Fenced code scrolls internally. Executable-looking code examples remain inert. |
| Tables and thematic breaks | Supported; exact generated text-alignment styles retained, tables use the shared scrolling wrapper. |
| Ruby | Production `{base}^{reading}` non-executable visitor supported. |
| Mermaid | Production `class="mermaid" data-mermaid` markup when `settings.mermaid` is true; ordinary fenced code when false. Existing page Mermaid initialization renders it. Downstream visual verification required. |
| Math | No plain-Markdown math conversion in the shared pipeline: dollar notation remains literal even when `math` is true. Existing docs use explicit `MathBlock` JSX; that executable component syntax is excluded here. |
| Directives, transclusion, filesystem includes | Rejected by the raw parser even when configured for document pages. Custom directive component mappings and source-relative includes require a document source, which this field deliberately has none of. |
| Raw HTML, JSX, MDX expressions, import/export, YAML frontmatter | Diagnosed and rejected, never executed. Code fences and inline code may show these as examples. MDX expressions are diagnosed when they parse as MDX; non-MDX literal braces remain inert Markdown text. Initial paragraph import/export statements are reserved and rejected. |
| Code tabs/enrichment, reading-time/TOC exports, heading markers | Not enabled in this field. Ordinary fences remain supported; advanced fence metadata is not promised component parity. |

The shared preset feature builder supplies the supported production visitors;
source-dependent/component-only visitors are removed explicitly. This is
serializable Markdown, not arbitrary MDX parity. Parser checks reject author
HTML before rendering; parse5 then checks generated element/attribute names,
URL schemes and table styles. Unknown rendered markup is a loud error, not a
silent destructive sanitizer pass. This preserves semantic classes and safe
image/link/task/table attributes.

## Link and image resolution

Ordinary relative URLs resolve against the current localized homepage URL
(with a terminating slash). Site-root-relative URLs receive the configured
base exactly once. Explicit locale prefixes are preserved. Safe absolute HTTP
and HTTPS URLs remain absolute; links additionally allow mailto and tel.
Fragments remain fragments. Protocol-relative URLs, data/javascript/vbscript
schemes, controls and backslashes are rejected. Spaces in URL paths are URL
encoded. `.md`/`.mdx` extensions are never rewritten, no source file is invented,
and `..` follows ordinary URL resolution (it can leave the base).

| Base | Locale | Authored URL | Result |
|---|---|---|---|
| `/` | en | `docs/start` | `/docs/start` |
| `/` | ja | `docs/start` | `/ja/docs/start` |
| `/manual/` | en | `docs/start` | `/manual/docs/start` |
| `/manual/` | ja | `docs/start` | `/manual/ja/docs/start` |
| `/manual/` | ja | `/docs/start` | `/manual/docs/start` |
| `/manual/` | ja | `/ja/docs/start` | `/manual/ja/docs/start` |
| `/manual/` | ja | `/manual/ja/docs/start` | `/manual/ja/docs/start` |
| `/manual/` | ja | `images/logo.png` | `/manual/ja/images/logo.png` |
| `/manual/` | ja | `/images/logo.png` | `/manual/images/logo.png` |
| `/manual/` | ja | `../images/logo.png` | `/manual/images/logo.png` |
| `/manual/` | ja | `#section` | `#section` |
| `/manual/` | ja | `?view=all` | `/manual/ja/?view=all` |
| `/manual/` | ja | `guide.mdx` | `/manual/ja/guide.mdx` |
| `/manual/` | ja | `https://example.com/a?q=1#b` | unchanged |
