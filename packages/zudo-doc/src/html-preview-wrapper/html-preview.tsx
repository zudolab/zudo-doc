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
}

export function containsScript(head?: string, js?: string): boolean {
  if (js) return true;
  if (head && /<script/i.test(head)) return true;
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
// externalStyles links -> head -> author css / js. Keep the fullHeight
// style immediately after preflight so later Wave-2 props (externalStyles,
// etc.) can insert cleanly between it and `head` without reordering this.
const fullHeightStyle = "<style>html,body{height:100%}</style>";

export function buildSrcdoc(
  html: string,
  css?: string,
  head?: string,
  js?: string,
  fullHeight?: boolean,
): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${preflightCss}</style>
${fullHeight ? fullHeightStyle : ""}
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
}: HtmlPreviewProps): VNode {
  const srcdoc = useMemo(
    () => buildSrcdoc(html, css, head, js, fullHeight),
    [html, css, head, js, fullHeight],
  );
  const hasScripts = containsScript(head, js);
  const syncDelay = hasScripts ? 300 : 0;
  const sandboxValue = resolveSandbox(sandbox, hasScripts);

  const codeBlocks = useMemo(
    () => [
      { language: "html", title: "HTML", code: dedent(html) },
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
    ],
    [html, componentCss, componentHead, componentJs],
  );

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
