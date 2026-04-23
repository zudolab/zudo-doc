# Smart-break dynamic/non-MDX surfaces — audit inventory

Scope: issue #376 — audit statically-rendered strings in dynamic/non-MDX
components and apply smart-break (SmartBreak / smartBreakToHtml) to path-like
text sites. `isPathLike` is conservative by design — non-path prose passes
through untouched — so applying SmartBreak to borderline call sites is
cheap and safe.

## Surface matrix

| # | File | Text site | Decision | Reason |
|---|---|---|---|---|
| 1 | `src/components/doc-history.tsx` | `entry.message` (commit subject) | **Applied** (`<SmartBreak>`) | Commit messages commonly reference paths, URLs, or file names. |
| 2 | `src/components/doc-history.tsx` | `entry.hash.slice(0, 7)` | Not-path-like | 7-char git short SHA. No delimiters, never path-like. |
| 3 | `src/components/doc-history.tsx` | `entry.author` | Not-path-like | Author display name. |
| 4 | `src/components/doc-history.tsx` | `row.leftLine` / `row.rightLine` (diff body) | **Deferred** | Diff is shown in a horizontally-scrollable fixed-layout table, one line per `<td>`. Diff bodies are code, not headers / labels, and users expect horizontal scroll for long lines; wbr injection is orthogonal and would introduce visual drift vs. the original file. |
| 5 | `src/components/toc.tsx` | `heading.text` | **Applied** (`<SmartBreak>`) | Heading text is usually prose, but can contain filenames (e.g. "Configuring settings.ts") or URLs. Cheap safety net. |
| 6 | `src/components/mobile-toc.tsx` | `heading.text` | **Applied** (`<SmartBreak>`) | Same reasoning as toc.tsx; the mobile variant mirrors the same data. |
| 7 | `src/components/ai-chat-modal.tsx` | User message (`{msg.content}` plain text) | **Applied** (`<SmartBreak>`) | User-typed content may contain URLs or paths; rendered as plain text so a wrapper is trivial. |
| 8 | `src/components/ai-chat-modal.tsx` | Assistant message (`dangerouslySetInnerHTML` from `renderMarkdown`) | **Deferred** | `renderMarkdown` is a self-contained HTML renderer that does not reuse the MDX component-override pipeline. Integrating smart-break would require injecting wbr post-tokenization or rewriting the renderer; the vast majority of path-like text in assistant replies already appears inside `<code>` / fenced code blocks, which wrap via monospace CSS. Out of scope for this audit — worth a follow-up if real overflow is observed. |
| 9 | `src/components/ai-chat-modal.tsx` | Header text "AI Assistant", placeholder, status text ("Thinking…", "Ask a question…") | Not-path-like | Static English prose / UI labels. |
| 10 | `src/components/frontmatter-preview.astro` | `rendered?.text` (string/number/bool/array-of-strings values) | **Applied** (`smartBreakToHtml` via `set:html`) | Frontmatter values include file paths (e.g. `image`, `slug`, `permalink`), URLs, and arrays of tags. `smartBreakToHtml` is a no-op for non-path prose and booleans/numbers. |
| 11 | `src/components/frontmatter-preview.astro` | `key` column (`{key}`) | Not-path-like | Keys are always short field names (e.g. `title`, `tags`); delimiters are rare. |
| 12 | `src/components/frontmatter-preview.astro` | `rendered?.code` (JSON fallback) | Not-path-like | Already wrapped in `<code>` with `break-words`; JSON is not the target of the "path-like" heuristic. |
| 13 | `src/components/theme-toggle.tsx` | aria-label, no visible path text | Not-path-like | Labels like "Switch to dark mode". |
| 14 | `src/components/design-token-tweak/export-modal.tsx` | exported CSS in a `<textarea>` | Not-path-like | Text lives inside a `<textarea>`; wbr has no effect there. |
| 15 | `src/components/design-token-tweak/**` | token labels, hex value inputs | Not-path-like | All short labels / input boxes. |

## Template mirror updates

The following base/feature template files mirror the edited source files and
must be kept in lockstep (checked by `pnpm check:template-drift`):

- `packages/create-zudo-doc/templates/features/docHistory/files/src/components/doc-history.tsx`
- `packages/create-zudo-doc/templates/base/src/components/toc.tsx`
- `packages/create-zudo-doc/templates/base/src/components/mobile-toc.tsx`
- `packages/create-zudo-doc/templates/base/src/components/frontmatter-preview.astro`

`ai-chat-modal.tsx` does not have a template counterpart — no mirror needed.

## Incidental fix — `SmartBreak` return type

The foundation from #371 declared `SmartBreak` as returning Preact's `VNode`.
TypeScript treats Preact's `VNode` and React's `JSX.Element` as distinct types,
so `.tsx` files that `import ... from "react"` (e.g. `toc.tsx`, `mobile-toc.tsx`,
`doc-history.tsx`, `ai-chat-modal.tsx`) could not use `<SmartBreak>` as a JSX
child without a type error:

```
Type 'VNode<{}>' is not assignable to type 'ReactNode | Promise<ReactNode>'.
```

At runtime, `@astrojs/preact` with `compat: true` aliases React calls to Preact
so this is a pure typing gap. Fix: widen `SmartBreak`'s declared return type
from `VNode` to `any`. The internal `smartBreak()` and `smartBreakToHtml()`
functions keep their precise return types. All 41 existing smart-break unit
tests continue to pass.

Mirrored into `packages/create-zudo-doc/templates/base/src/utils/smart-break.tsx`
so downstream scaffolded projects get the same permissive signature.

## Verification

- `pnpm check` — typecheck clean after edits.
- `pnpm vitest run src/utils/__tests__/smart-break.test.ts` — 41/41 passing.
- No new runtime dependencies; every edit is a wrapper around an existing
  text-node render site.
