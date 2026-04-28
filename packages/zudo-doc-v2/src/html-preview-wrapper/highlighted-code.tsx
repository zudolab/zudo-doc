/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { useEffect, useState } from "preact/hooks";
import type { VNode } from "preact";

/**
 * Lazily-loaded Shiki highlighter singleton. The dynamic import is
 * intentional: Shiki is a large library that should not inflate the
 * initial JS bundle. The promise is cached so subsequent calls reuse
 * the same highlighter instance.
 *
 * Ported from src/components/html-preview/highlighted-code.tsx with
 * React → Preact hook imports.
 */
let highlighterPromise: Promise<import("shiki").HighlighterCore> | null = null;

function getHighlighter(): Promise<import("shiki").HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki")
      .then(({ createHighlighter }) =>
        createHighlighter({
          themes: ["catppuccin-latte", "vitesse-dark"],
          langs: ["html", "css", "javascript"],
        }),
      )
      .catch((err) => {
        // Clear cached rejection so next call retries
        highlighterPromise = null;
        throw err;
      });
  }
  return highlighterPromise;
}

export interface HighlightedCodeProps {
  code: string;
  language: string;
}

/**
 * Syntax-highlighted code block backed by Shiki. Falls back to a
 * plain `<pre><code>` block while Shiki is loading or if it fails.
 *
 * JSX port of src/components/html-preview/highlighted-code.tsx.
 */
export function HighlightedCode({
  code,
  language,
}: HighlightedCodeProps): VNode {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHighlighter()
      .then((highlighter) => {
        if (cancelled) return;
        const lang = highlighter.getLoadedLanguages().includes(language)
          ? language
          : "text";
        const result = highlighter.codeToHtml(code, {
          lang,
          themes: { light: "catppuccin-latte", dark: "vitesse-dark" },
          defaultColor: false,
        });
        setHtml(result);
      })
      .catch(() => {
        // Shiki failed to load — keep showing the plain-text fallback
      });
    return () => {
      cancelled = true;
    };
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
