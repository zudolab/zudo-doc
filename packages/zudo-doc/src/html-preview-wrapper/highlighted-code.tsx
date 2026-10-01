/** @jsxRuntime automatic */
import {
  computed,
  getScope,
  signal,
  Show,
  type Child,
} from "@takazudo/zfb/zudo-react";
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
 * The runtime request is scoped to the current source panel mount.
 */
export function HighlightedCode({
  code,
  language,
}: HighlightedCodeProps): Child {
  const scope = getScope();
  const highlighted = signal<string | null>(null);
  scope.onActivate(() =>
    startHighlightRequest({
      code,
      language,
      onSettled(nextHtml) {
        highlighted.value = nextHtml;
      },
    }),
  );

  const html = computed(() => highlighted.value);
  return (
    <Show
      when={computed(() => html.value != null)}
      fallback={() => (
        <pre class="m-0 p-hsp-md bg-code-bg text-caption leading-relaxed overflow-x-auto">
          <code class="font-mono whitespace-pre">{code}</code>
        </pre>
      )}
    >
      {() => <div class="zd-html-preview-code" rawHtml={html} />}
    </Show>
  );
}
