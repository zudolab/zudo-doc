# S3 Content & MDX Components Audit

**Sub-issue:** #1363 (epic #1360)
**Build command:** `pnpm build` (zfb build) from worktree root
**Base value:** `/pj/zudo-doc/` (from `settings.base`)
**Build result:** 217 pages built, exit 0, no warnings in stdout
**Build log:** `/tmp/s3-build.log`
**Conclusion:** **mixed** — 2 of 10 showcase pages render correctly; 8 fall back to raw-text mode via `<pre data-zfb-content-fallback>`. Admonition directive syntax is broken across the board. Shiki highlighting not applied to any code block. Several features require zfb-upstream fixes or missing plugin wiring before they can be verified end-to-end.

---

## Verification Matrix

| Feature | Status | Severity | Root cause class | Evidence (DOM excerpt or path) | Suggested next step |
|---|---|---|---|---|---|
| Admonitions — directive syntax (`:::note ... :::`) | FAIL | block | zudo-doc-side | `:::note\nThis is a note...\n:::` rendered as `<p>` raw text in `dist/docs/components/admonitions/index.html`; `remark-directive` + `remarkAdmonitions` exist in `src/plugins/` but are NOT wired into `zfb.config.ts` MDX plugin chain | Wire `remark-directive` + `remarkAdmonitions` into the zfb MDX remark plugin list; follow-up #1378 |
| Admonitions — JSX syntax (`<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>`) | PARTIAL | regress | zudo-doc-side | On non-fallback pages (e.g. `dist/docs/reference/design-token-panel/index.html`): `<div data-admonition="note" class="admonition admonition-note"><div class="admonition-body">…</div></div>`. Stub in `_mdx-components.ts` renders body but no auto-title when `title` prop omitted. Pages that fall back (8/10 S3 pages) cannot exercise this path. | Replace `makeAdmonitionStub` with real Preact component that mirrors Astro-era output including default title; blocked on fallback root-cause fix |
| basic-components — typography overrides (h2–h4, p, a, strong, blockquote, ul/ol, table) | FAIL | regress | zfb-upstream | `dist/docs/components/basic-components/index.html` is in `<pre data-zfb-content-fallback>` mode; no `htmlOverrides` bindings reached; `src/components/content/` Preact files exist but MDX compilation aborted | Resolve fallback root cause (see below); once fixed, verify `<h2 class="text-subheading …">` etc. rendered by `heading-h2.tsx` etc. |
| details — collapsible `<details>`/`<summary>` | FAIL | regress | zfb-upstream | `dist/docs/components/details/index.html` in fallback; native `<details>` HTML inside MDX source may be triggering MDX compiler abort; `DetailsWrapper` in `_mdx-components.ts` exists but unreachable | Resolve fallback root cause; native `<details>` in MDX body is the suspected trigger |
| html-preview — `<HtmlPreview>` component | FAIL | regress | zfb-upstream | `dist/docs/components/html-preview/index.html` in fallback; template-literal prop values (`` html={`…`} ``) in MDX body suspected to abort MDX compiler | Resolve fallback root cause; `HtmlPreviewWrapper` is registered in `_mdx-components.ts` |
| image-enlarge (island) | PARTIAL | regress | zfb-upstream | `dist/docs/components/image-enlarge/index.html` in fallback — no `<figure class="zd-enlargeable">` or `<button class="zd-enlarge-btn">` in content (they appear only as escaped text inside fallback `<pre>`). Island SSR marker `data-zfb-island-skip-ssr="ImageEnlarge"` IS present in `<body>` end-area with SSR fallback `<dialog class="zd-enlarge-dialog …"></dialog>`. Static island wiring is correct; runtime behavior unverifiable without browser. | Resolve fallback root cause so rehype plugin wraps images; interactive verification deferred to manager dispatch |
| math-equations — KaTeX | FAIL | block | zfb-upstream | `dist/docs/components/math-equations/index.html` in fallback; `<MathBlock>` JSX appears as `&lt;MathBlock latex=…>` escaped text; no `<span class="katex">` anywhere in dist. `MathBlock` component (`pages/lib/_math-block.tsx`) registered in `_mdx-components.ts`. | Resolve fallback root cause; `math` fenced code block + `<MathBlock>` JSX are the suspected triggers |
| mermaid-diagrams — Mermaid SVG | FAIL | block | zfb-upstream | `dist/docs/components/mermaid-diagrams/index.html` in fallback; `graph LR\nA[Start] ...` appears as raw code text inside fallback `<pre>`; no `<svg>` mermaid output in content area | Resolve fallback root cause; `mermaid` code fence blocks suspected to trigger MDX compiler abort in zfb pipeline |
| tabs — `<Tabs>` + `<TabItem>` | PASS | — | — | `dist/docs/components/tabs/index.html`: `<div data-tabs="true" class="tabs-container …"><div role="tabpanel" data-tab-value="npm" data-tab-label="npm" data-tab-default class="tab-panel">npm install zudo-doc</div>…`. All three tab panels rendered. `groupId` sync markup present. | No action needed |
| smart-break — `SmartBreak` utility | FAIL | regress | zfb-upstream | `dist/docs/reference/smart-break/index.html` in fallback; prose link `[CJK-friendly markdown](./cjk-friendly.mdx)` visible as raw markdown text inside fallback `<pre>`; SmartBreak JSX stub registered in `_mdx-components.ts` | Resolve fallback root cause; SmartBreak itself is a stub (renders null) so visual effect requires real component |
| cjk-friendly — `remark-cjk-friendly` | FAIL | block | zfb-upstream | `dist/docs/reference/cjk-friendly/index.html` in fallback; no bold CJK text rendered as `<strong>`; page entirely raw text; `cjkFriendly: true` in settings but plugin wiring in zfb pipeline is unverifiable | Resolve fallback root cause; verify CJK emphasis once MDX compilation succeeds |
| Code blocks (Shiki) — syntax highlighting | FAIL | regress | zfb-upstream | All code blocks across all rendered pages have `<code class="language-bash">` language class but zero `<span style="color:…">` Shiki tokens. No `shiki` config in `zfb.config.ts`. Verified in `dist/docs/components/tabs/index.html` and `dist/docs/components/admonitions/index.html` | Wire Shiki theme (from `settings.colorScheme → shikiTheme`) into zfb MDX code-highlight pipeline; follow-up #1379 |
| Code blocks — filename header | UNVERIFIED | cosmetic | zfb-upstream | No pages in corpus use `\`\`\`lang title="…"\`` syntax in showcase docs; cannot confirm presence or absence. zfb#104 comment in `zfb.config.ts` claims code-title is handled natively. | Add a code block with filename title to a showcase doc and rebuild to confirm |
| Heading hash-links — h2–h4 produce `<a>` anchors | PASS | — | — | `dist/docs/components/tabs/index.html`: `<h2 id="basic-usage-2" …>Basic Usage<a href="#basic-usage-2" aria-label="Direct link to Basic Usage" class="text-accent underline hover:text-accent-hover"></a></h2>`. All verified h2 headings have id + anchor link. h3/h4 hash-links unverifiable (no non-fallback page has h3/h4 in prose). | No action for h2; add h3/h4 test case to verify lower heading levels |
| Internal MDX link resolution — `stripMdExt` | PARTIAL | cosmetic | zfb-upstream | `stripMdExt: true` in `zfb.config.ts` (zfb#131); navigation links in sidebar data carry `/pj/zudo-doc/docs/…/` URLs (correct). Prose link `[CJK-friendly markdown](./cjk-friendly.mdx)` in `smart-break.mdx` (fallback page) appears as raw markdown in `<pre>` — cannot verify route resolution. `html-preview.mdx` uses absolute `/docs/components/basic-components#supported-languages` (missing base path) — broken link regardless of strip. | Resolve fallback root cause; fix absolute `/docs/…` link in `html-preview.mdx` to use relative `./basic-components.mdx#supported-languages` |
| `onBrokenMarkdownLinks` — warn-but-not-fail | PARTIAL | cosmetic | zudo-doc-side | Setting is `"warn"` in `settings.ts` line 85. The `remarkResolveMarkdownLinks` plugin exists in `packages/md-plugins/` and respects `onBrokenLinks: "warn"` (console.warn path). However, the plugin is NOT wired into `zfb.config.ts` — it lives in `src/plugins/remark-resolve-markdown-links.ts` as a re-export but is never consumed by the zfb MDX pipeline. Build log shows zero warnings (no broken link detection running). | Wire `remarkResolveMarkdownLinks` into zfb MDX remark plugin list with `onBrokenLinks: settings.onBrokenMarkdownLinks`; file follow-up issue #1364 (shared with admonitions — same root: missing remark plugin wiring) |

---

## Cross-cutting Finding: Widespread Fallback Rendering (68 EN pages)

**68 of ~110 EN pages** (and 43 JA pages) rendered via `<pre data-zfb-content-fallback>[zfb fallback render]…</pre>` instead of executing the MDX-compiled JSX function. Affected S3 cluster pages: basic-components, details, html-preview, image-enlarge, math-equations, mermaid-diagrams, smart-break, cjk-friendly. Not affected: tabs, admonitions.

**Correlation analysis (zudo-doc-side vs. zfb-upstream):**

| Pattern | Fallback? | Notes |
|---|---|---|
| Quad-backtick code fences (`\`\`\`\``) | Not correlated — tabs has 4 quad fences, no fallback |
| `mermaid` code fence language | YES — mermaid-diagrams falls back |
| Native `<details>` HTML element in MDX body | YES — details.mdx falls back |
| Template literal in JSX props (`` html={`…`} ``) | YES — html-preview falls back |
| `math` code fence + `<MathBlock>` JSX | YES — math-equations falls back |
| Standard MDX tables + plain code blocks | Borderline — basic-components falls back |

The fallback mechanism is zfb's `build_snapshot` / content bridge — when the MDX pre-compile step fails to emit a valid module, the engine falls back to raw-content `<pre>` rendering rather than aborting the build. This is a **zfb-upstream** root cause: certain MDX constructs (native HTML elements, mermaid fences, template-literal prop values) appear to abort the Rust-side MDX pre-compile step silently.

**Follow-up issue for this finding:** #1380 (filed separately — "Widespread `data-zfb-content-fallback` rendering in MDX pages with native HTML / mermaid / template-literal props").

---

## JA Locale Parity

- `dist/ja/docs/components/admonitions/index.html`: no fallback — JA mirror renders correctly (same as EN).
- `dist/ja/docs/components/tabs/index.html`: no fallback — JA mirror renders correctly.
- All other JA S3 pages mirror the EN fallback pattern.
- JA source files exist for all S3 pages under `src/content/docs-ja/components/` and `src/content/docs-ja/reference/`.

---

## Follow-up Issues Filed

| Issue | Signature |
|---|---|
| #1378 | `remarkAdmonitions` + `remarkResolveMarkdownLinks` not wired into zfb MDX remark plugin chain; directive syntax (`:::note`) and `onBrokenMarkdownLinks` non-functional |
| #1379 | Shiki syntax highlighting not applied to any code block; `shikiTheme` from color-scheme config is not connected to the zfb MDX code-highlight pipeline |
| #1380 | Widespread `data-zfb-content-fallback` rendering for MDX pages containing native HTML elements, `mermaid` code fences, or template-literal JSX props — silent abort in zfb Rust MDX pre-compile step |
