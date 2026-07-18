/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { useEffect, useState } from "preact/hooks";
import type { VNode } from "preact";
import { startHighlightRequest } from "./highlight-runtime.js";

export interface HighlightedCodeProps {
  code: string;
  language: string;
}

/**
 * Syntax-highlighted code block backed by zfb's semantic-class WASM API.
 * Falls back to a plain `<pre><code>` block while the runtime is loading or
 * when the current request cannot produce safe markup.
 *
 * JSX port of src/components/html-preview/highlighted-code.tsx.
 */
export function HighlightedCode({
  code,
  language,
}: HighlightedCodeProps): VNode {
  const [highlighted, setHighlighted] = useState<{
    code: string;
    language: string;
    html: string;
  } | null>(null);

  // A prop change must show the new source's fallback immediately, before its
  // effect runs. Keeping the source identity beside the markup prevents a
  // previous request's HTML from flashing for the new code/language pair.
  const html =
    highlighted?.code === code && highlighted.language === language
      ? highlighted.html
      : null;

  useEffect(() => {
    return startHighlightRequest({
      code,
      language,
      onSettled(nextHtml) {
        setHighlighted(
          nextHtml == null ? null : { code, language, html: nextHtml },
        );
      },
    });
  }, [code, language]);

  if (!html) {
    return (
      <pre class="m-0 p-hsp-md bg-code-bg text-caption leading-relaxed overflow-x-auto">
        <code class="font-mono whitespace-pre">{code}</code>
      </pre>
    );
  }

  return (
    <div
      class="zd-html-preview-code"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
