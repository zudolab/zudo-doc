# Port the content typography and MDX component layer (content/*, mdx-components, code groups, tabs, details, math, smart-break, home-intro)

Owner: [#4457](https://github.com/zudolab/zudo-doc/issues/4457). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Round-2 locked spec (3.1.0)

Decision [#4480](https://github.com/zudolab/zudo-doc/issues/4480), based on [#4479 packed evidence](../../../_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md). Planned contract only; implementation and browser evidence remain pending. This overrides the named round-1 deviations.

Void the earlier prohibition on forwarding `start` and the round-1 rawHtml `<ol>` serializer/display-contents wrapper. `ContentOl` uses native `<ol start={start}>` and normal children. #4479 Z02 proves declarations, actual MDX SSR and hydration at 3.1.0. Test start-at-3, resumed/default/task lists, class/attribute forwarding and child composition without extra wrappers or CSS counters.

Use native `<pre>` leading-LF protection (#4479 Z25); do not manually double/strip LF or add an opaque pre workaround. Keep precise SSR/hydrate text tests and hand real-browser parser/code-copy checks to #4468/#4475; the happy-dom probe simulated HTML-parser LF removal. Other typography/rawHtml trust reviews remain; #3359 is still unresolved for any relevant native attrs. Table restrictions remain the published contract despite corrected #3377 documentation.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/code-group/index.tsx` | `toArray` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-group/index.tsx` | `CodeGroup` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer-script.ts` | `HIGHLIGHTED_CODE_BLOCK_SELECTOR` | raw injection → reviewed rawHtml; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer-script.ts` | `CODE_BLOCK_ENHANCER_SELECTOR` | raw injection → reviewed rawHtml; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer-script.ts` | `CODE_WRAP_STORAGE_KEY` | raw injection → reviewed rawHtml; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer-script.ts` | `CODE_BLOCK_ENHANCER_SCRIPT` | raw injection → reviewed rawHtml; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer.tsx` | `CodeBlockEnhancer` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/mermaid-init-script.ts` | `MERMAID_CDN_MODULE_URL` | raw injection → reviewed rawHtml; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/mermaid-init-script.ts` | `buildMermaidInitScript` | raw injection → reviewed rawHtml; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/mermaid-init.tsx` | `MermaidInitProps` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/mermaid-init.tsx` | `MermaidInit` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/tabs-init-script.ts` | `TABS_INIT_SCRIPT` | className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/tabs-init.tsx` | `TabsInit` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/tabs.tsx` | `TabsProps` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/code-syntax/tabs.tsx` | `Tabs` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content-admonition/index.tsx` | `AdmonitionVariant` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content-admonition/index.tsx` | `AdmonitionProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content-admonition/index.tsx` | `makeAdmonition` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/component-map.ts` | `defaultComponents` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-blockquote.tsx` | `ContentBlockquote` | className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-code.tsx` | `ContentCode` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-code.tsx` | `extractText` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-code.tsx` | `looksLikeHtmlMarkup` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-code.tsx` | `decodeEntities` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-link.tsx` | `ContentLink` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-link.tsx` | `CreateContentLinkOptions` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-link.tsx` | `createContentLink` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-link.tsx` | `extractText` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-link.tsx` | `decodeEntities` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-ol.tsx` | `ContentOl` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-paragraph.tsx` | `ContentParagraph` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-strong.tsx` | `ContentStrong` | className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-table.tsx` | `ContentTable` | className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/content-ul.tsx` | `ContentUl` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/heading-h2.tsx` | `HeadingH2` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/heading-h3.tsx` | `HeadingH3` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/heading-h4.tsx` | `HeadingH4` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/content/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/details/details.tsx` | `DetailsProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/details/details.tsx` | `Details` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/details/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/CONTRACT.md` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/index.tsx` | `HOME_SECTION_HEADING_CLASS` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/index.tsx` | `renderNode` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/index.tsx` | `CompactProse` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/prepare.ts` | `HomeIntroSettings` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/prepare.ts` | `resolveIntroUrl` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/prepare.ts` | `inspect` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/prepare.ts` | `prepareNode` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/prepare.ts` | `prepareHomeIntro` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/prepare.ts` | `prepareHomeIntros` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/resolve.ts` | `resolveHomeIntro` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/types.ts` | `IntroNode` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/types.ts` | `PreparedHomeIntro` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/home-intro/types.ts` | `PreparedHomeIntros` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/math-block/index.tsx` | `pickKatex` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/math-block/index.tsx` | `MathBlockProps` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/math-block/index.tsx` | `MathBlock` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mdx-components/index.ts` | `MdxNavData` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mdx-components/index.ts` | `CreateMdxComponentsOptions` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mdx-components/index.ts` | `makeContentImg` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mdx-components/index.ts` | `makeEnlargeableParagraph` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mdx-components/index.ts` | `createMdxComponents` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/smart-break/index.tsx` | `isPathLike` | raw injection → reviewed rawHtml; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/smart-break/index.tsx` | `htmlEscape` | raw injection → reviewed rawHtml; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/smart-break/index.tsx` | `smartBreak` | raw injection → reviewed rawHtml; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/smart-break/index.tsx` | `SmartBreak` | raw injection → reviewed rawHtml; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/smart-break/index.tsx` | `escapeAndInjectWbr` | raw injection → reviewed rawHtml; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/smart-break/index.tsx` | `smartBreakToHtml` | raw injection → reviewed rawHtml; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tab-item/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tab-item/tab-item.tsx` | `TabItemProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tab-item/tab-item.tsx` | `TabItem` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer-script.ts:3` | `// Converted from the TypeScript <script> block in` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer-script.ts:5` | `// so the string can be emitted via \`dangerouslySetInnerHTML\` and parsed` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer.tsx:9` | `//   2. A <script> tag that self-initializes the copy/wrap button enhancer.` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer.tsx:11` | `// This JSX version renders the same markup via \`dangerouslySetInnerHTML\` so` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer.tsx:22` | `* and emits the code-block enhancer init script via \`dangerouslySetInnerHTML\`.` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/code-block-enhancer.tsx:39` | `<script dangerouslySetInnerHTML={{ __html: CODE_BLOCK_ENHANCER_SCRIPT }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/index.ts:13` | `//                       URL because the inline \`<script>\` reaches the` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init-script.ts:3` | `// Converted from the TypeScript <script> block in` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init-script.ts:5` | `// so the string can be emitted via \`dangerouslySetInnerHTML\` and parsed` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init-script.ts:74` | `* (or to their own \`<script dangerouslySetInnerHTML>\` site).` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init-script.ts:80` | `// <script> tag prematurely and start parsing the rest as HTML.` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init-script.ts:300` | `// public ESM CDN URL because the inline <script> reaches the` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init.tsx:6` | `// The original component rendered a single <script> tag that:` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init.tsx:16` | `// This JSX version emits the identical script via \`dangerouslySetInnerHTML\`.` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init.tsx:21` | `// ESM CDN URL so the inline \`<script>\` (no bundler in the path) can` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init.tsx:66` | `* \`dangerouslySetInnerHTML\`. The script lazily imports mermaid only when` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/mermaid-init.tsx:79` | `return <script dangerouslySetInnerHTML={{ __html: script }} />;` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/tabs-init.tsx:6` | `// The original component rendered a <script> tag that created nav` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/tabs-init.tsx:21` | `* tabs interactivity script via \`dangerouslySetInnerHTML\`.` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/code-syntax/tabs-init.tsx:34` | `return <script dangerouslySetInnerHTML={{ __html: TABS_INIT_SCRIPT }} />;` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/math-block/index.tsx:77` | `dangerouslySetInnerHTML={{ __html: html }}` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/math-block/index.tsx:86` | `dangerouslySetInnerHTML={{ __html: html }}` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/smart-break/index.tsx:115` | `* an HTML string for \`set:html\` / dangerouslySetInnerHTML).` | pending per-site review; R-RAW; identify producer/trust and disposal |

Round 2 removes the planned #3360 opaque-list site: native ContentOl/MDX start is required. Enumerate existing rawHtml trust sites normally; no list serializer or display-contents wrapper is authorized. #3359 remains unresolved only where a relevant unsupported attribute actually occurs.

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned source set | No mapped gap in planning TSV | Confirm generated candidate or matching shipped authored selector; unknown ordinary class is not proof | pending scan confirmation |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/code-syntax/__tests__/code-block-enhancer.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/code-syntax/__tests__/code-block-wrap-persistence.test.ts` — pending port/run result.
- `packages/zudo-doc/src/code-syntax/__tests__/mermaid-init.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/code-syntax/__tests__/tabs.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/content/__tests__/content.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/details/__tests__/details.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/home-intro/__tests__/home-intro.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/math-block/__tests__/math-block-optional-katex.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/math-block/__tests__/math-block.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/mdx-components/__tests__/mdx-components.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/smart-break/__tests__/smart-break.test.ts` — pending port/run result.
- `packages/zudo-doc/src/tab-item/__tests__/tab-item.test.tsx` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
