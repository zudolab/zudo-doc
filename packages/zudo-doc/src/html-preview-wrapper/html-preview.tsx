/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { useMemo } from "preact/hooks";
import type { VNode } from "preact";
import { PreviewBase } from "./preview-base.js";
import { dedent } from "./dedent.js";
import { preflightCss } from "./preflight.js";

export interface HtmlPreviewProps {
  html: string;
  css?: string;
  head?: string;
  js?: string;
  title?: string;
  height?: number;
  defaultOpen?: boolean;
  /**
   * When true, injects `<style>html,body{height:100%}</style>` into the
   * preview document so the preview's content can stretch to fill the
   * iframe (e.g. a flex/grid layout that relies on `height: 100%` reaching
   * the viewport).
   *
   * ⚠️ **Interacts with auto-height — pair with an explicit
   * {@link HtmlPreviewProps.height}.** Auto-height measures
   * `iframe.contentDocument.body.scrollHeight` and resizes the iframe to
   * fit; `fullHeight` makes the body's height derive FROM the iframe's own
   * height instead, which creates a feedback loop when the iframe height is
   * itself derived from the body. This component does not attempt to
   * detect or break that loop — always set `height` alongside `fullHeight`.
   *
   * @default false
   */
  fullHeight?: boolean;
  /**
   * iframe `sandbox` attribute value. When omitted, defaults to the value
   * computed from the preview content (`allow-scripts allow-same-origin`
   * when scripts are present, `allow-same-origin` otherwise — see
   * {@link resolveSandbox}).
   *
   * ⚠️ **Trust assumption.** The default keeps `allow-same-origin`, which
   * combined with `allow-scripts` effectively *voids* the iframe sandbox:
   * scripts inside the preview can reach the parent document's origin. This
   * is safe only for **author-trusted** content (e.g. zudo-doc's own
   * MDX-authored previews). Downstream consumers rendering semi-trusted or
   * user-submitted HTML should pass a stricter value (e.g. `"allow-scripts"`
   * or `""`).
   *
   * Note: removing `allow-same-origin` breaks the auto-height mechanism
   * (the parent can no longer read `iframe.contentDocument` to measure the
   * body), so set a fixed {@link HtmlPreviewProps.height} when you do.
   * Passing the empty string `""` (maximally restrictive) is honored —
   * only `undefined` triggers the computed default.
   */
  sandbox?: string;
  /** Per-component css for code block display (before global merge) */
  componentCss?: string;
  /** Per-component head for code block display (before global merge) */
  componentHead?: string;
  /** Per-component js for code block display (before global merge) */
  componentJs?: string;
  /**
   * External stylesheet URLs, emitted as `<link rel="stylesheet" href="...">`
   * tags in the srcdoc head — injected AFTER the preflight/fullHeight styles
   * and BEFORE {@link HtmlPreviewProps.head}/{@link HtmlPreviewProps.css}, so
   * author styles can still override them.
   *
   * Per-usage only (v1) — there is no site-wide `globalConfig` equivalent.
   *
   * ⚠️ Loaded **client-side at view time** (a network dependency at render),
   * not build-bundled — the preview may show unstyled content until the
   * stylesheet(s) finish loading.
   *
   * @default undefined
   */
  externalStyles?: string[];
  /**
   * External script URLs, emitted as `<script src="...">` tags in the
   * srcdoc head. Presence flips the sandbox/`syncDelay` derivation to
   * script-allowing exactly like an inline {@link HtmlPreviewProps.js} — see
   * {@link containsScript} / {@link resolveSandbox}.
   *
   * Per-usage only (v1) — there is no site-wide `globalConfig` equivalent.
   *
   * ⚠️ Loaded **client-side at view time** (a network dependency at render),
   * not build-bundled.
   *
   * @default undefined
   */
  externalScripts?: string[];
  /**
   * When false, skips the injected Tailwind-preflight `<style>` reset.
   * Useful when a framework loaded via {@link HtmlPreviewProps.externalStyles}
   * or {@link HtmlPreviewProps.externalScripts} ships its own reset and would
   * otherwise be double-applied.
   *
   * @default true
   */
  preflight?: boolean;
  /**
   * When true, renders {@link HtmlPreviewProps.externalStyles} and
   * {@link HtmlPreviewProps.externalScripts} as literal `<link>`/`<script
   * src>` lines at the top of the "HTML" code panel. Excluded by default so
   * CDN plumbing doesn't clutter the visible lesson code.
   *
   * @default false
   */
  showResources?: boolean;
}

export function containsScript(
  head?: string,
  js?: string,
  externalScripts?: string[],
): boolean {
  if (js) return true;
  if (head && /<script/i.test(head)) return true;
  if (externalScripts && externalScripts.length > 0) return true;
  return false;
}

/**
 * Resolve the iframe `sandbox` attribute value.
 *
 * An explicit `sandbox` prop wins (including the empty string `""`, the most
 * restrictive value — only `undefined` falls through). Otherwise the default
 * is derived from `hasScripts`:
 *
 * - with scripts → `"allow-scripts allow-same-origin"`
 * - without scripts → `"allow-same-origin"`
 *
 * `allow-same-origin` is kept in BOTH defaults on purpose: the parent reads
 * `iframe.contentDocument` for auto-height measurement, and a srcdoc iframe
 * sandboxed without `allow-same-origin` gets an opaque origin that blocks
 * those reads even from the parent page. The combination voids sandboxing
 * for script-bearing previews — acceptable here because preview content is
 * author-trusted MDX. See {@link HtmlPreviewProps.sandbox} for the downstream
 * trust note.
 */
export function resolveSandbox(
  sandbox: string | undefined,
  hasScripts: boolean,
): string {
  return (
    sandbox ??
    (hasScripts ? "allow-scripts allow-same-origin" : "allow-same-origin")
  );
}

// Injection order contract (epic-wide): preflight -> fullHeight style ->
// externalStyles links -> externalScripts tags -> head -> author css / js.
// Keep the fullHeight style immediately after preflight so `externalStyles`
// can insert cleanly between it and `head` without reordering this.
const fullHeightStyle = "<style>html,body{height:100%}</style>";

export function buildSrcdoc(
  html: string,
  css?: string,
  head?: string,
  js?: string,
  fullHeight?: boolean,
  externalStyles?: string[],
  externalScripts?: string[],
  preflight?: boolean,
): string {
  const includePreflight = preflight ?? true;
  const externalStylesHtml = (externalStyles ?? [])
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("\n");
  const externalScriptsHtml = (externalScripts ?? [])
    .map((src) => `<script src="${src}"></script>`)
    .join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${includePreflight ? `<style>${preflightCss}</style>` : ""}
${fullHeight ? fullHeightStyle : ""}
${externalStylesHtml}
${externalScriptsHtml}
${head ?? ""}
${css ? `<style>${css}</style>` : ""}
</head>
<body>${html}
${js ? `<script>${js}</script>` : ""}
</body>
</html>`;
}

/**
 * HTML preview widget — renders an isolated iframe with viewport
 * controls and a collapsible code section.
 *
 * JSX port of src/components/html-preview/html-preview.tsx with
 * React → Preact hook imports.
 *
 * Requires client-side JS (iframe load events, height sync, code
 * toggle). Mount as an island via `<HtmlPreview client:visible />` in
 * Astro, or wire up the SSR-skip placeholder pattern for non-Astro
 * consumers.
 */
export function HtmlPreview({
  html,
  css,
  head,
  js,
  title,
  height,
  defaultOpen,
  fullHeight,
  sandbox,
  componentCss,
  componentHead,
  componentJs,
  externalStyles,
  externalScripts,
  preflight,
  showResources,
}: HtmlPreviewProps): VNode {
  const srcdoc = useMemo(
    () =>
      buildSrcdoc(
        html,
        css,
        head,
        js,
        fullHeight,
        externalStyles,
        externalScripts,
        preflight,
      ),
    [html, css, head, js, fullHeight, externalStyles, externalScripts, preflight],
  );
  const hasScripts = containsScript(head, js, externalScripts);
  const syncDelay = hasScripts ? 300 : 0;
  const sandboxValue = resolveSandbox(sandbox, hasScripts);

  const codeBlocks = useMemo(() => {
    const resourceLines = showResources
      ? [
          ...(externalStyles ?? []).map(
            (href) => `<link rel="stylesheet" href="${href}">`,
          ),
          ...(externalScripts ?? []).map(
            (src) => `<script src="${src}"></script>`,
          ),
        ]
      : [];
    const htmlCode = resourceLines.length
      ? `${resourceLines.join("\n")}\n\n${dedent(html)}`
      : dedent(html);
    return [
      { language: "html", title: "HTML", code: htmlCode },
      ...(componentCss
        ? [{ language: "css", title: "CSS", code: dedent(componentCss) }]
        : []),
      ...(componentHead
        ? [{ language: "html", title: "Head", code: dedent(componentHead) }]
        : []),
      ...(componentJs
        ? [
            {
              language: "javascript",
              title: "JS",
              code: dedent(componentJs),
            },
          ]
        : []),
    ];
  }, [
    html,
    componentCss,
    componentHead,
    componentJs,
    showResources,
    externalStyles,
    externalScripts,
  ]);

  return (
    <PreviewBase
      title={title}
      height={height}
      srcdoc={srcdoc}
      defaultOpen={defaultOpen}
      sandbox={sandboxValue}
      syncDelay={syncDelay}
      codeBlocks={codeBlocks}
    />
  );
}
