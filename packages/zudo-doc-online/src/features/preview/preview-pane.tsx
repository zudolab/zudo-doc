/**
 * The real preview pane -- lazy `@takazudo/zfb-md-wasm` rendering behind the
 * pane's mount, debounced against the live editor buffer via
 * `render-runtime.ts`'s `PreviewRenderLoop`.
 *
 * Reuse seam for the pop-out window (#3339): mount this component directly
 * with `{ pageId, title, path, markdown }`. It owns its own
 * `PreviewRenderLoop` instance per mount (created in a ref, not a module
 * singleton) precisely so a second window gets independent render/stale-drop
 * state instead of racing this window's -- the same reasoning
 * `use-editor-content.ts`'s header gives for why a pop-out gets its own
 * module instance of `editorContentTicker`. This component does not render
 * its own title/path header (the split view's `PaneHead` already shows
 * "Preview" + the page path -- see split.tsx); `title`/`path` are still
 * accepted and surfaced as `aria-label`/`data-preview-path` so a pop-out
 * window's OWN chrome (which has no such external header) can read them
 * back off this element, or a caller can render its own header from the
 * same props before mounting this pane. The `--zdo-wash-*` tokens the error
 * strip below reads are declared in editor-chrome.css, scoped to the
 * `.zdo-editor` class that wraps the current (only) mount site
 * (workspace.tsx) -- a pop-out window without that wrapper will need to
 * either carry the `.zdo-editor` class too or promote those wash tokens to
 * tokens.css; not solved here since #3339 is a separate sub-issue.
 */

import { useCallback, useEffect, useRef } from "preact/hooks";
import { useSyncExternalStore } from "preact/compat";
import {
  editorContentTicker,
  useEditorContentTick,
  type EditorContentTicker,
} from "../editor/use-editor-content";
import { PreviewRenderLoop, type PreviewSnapshot } from "./render-runtime";
import "./prose.css";
import "./syntax.css";

export interface PreviewPaneProps {
  pageId: string;
  title: string;
  /** `category-slug/page-slug`, as the pane exposes it (see the header comment for why it is not rendered inline here). */
  path: string;
  /** The live editor buffer -- body only, no frontmatter. */
  markdown: string;
  /** Defaults to the shared editor singleton -- injectable the same way `EditorPaneSlot`'s own `ticker` prop is, so specs can drive an isolated instance instead of leaking state across tests. */
  ticker?: EditorContentTicker;
  /** Defaults to a fresh `PreviewRenderLoop` per mount -- injectable for specs that need to control render timing/results without a real wasm call. */
  renderLoop?: PreviewRenderLoop;
}

export default function PreviewPane({
  pageId,
  title,
  path,
  markdown,
  ticker = editorContentTicker,
  renderLoop,
}: PreviewPaneProps) {
  // The editor's richer, more-frequently-ticking content stream -- prefer it
  // over the `markdown` prop whenever it belongs to THIS page (a stale tick
  // from a just-abandoned page must never be mistaken for this one's body).
  const tick = useEditorContentTick(ticker);
  const liveMarkdown = tick !== null && tick.pageId === pageId ? tick.markdown : markdown;

  const loopRef = useRef<PreviewRenderLoop | null>(null);
  if (loopRef.current === null) loopRef.current = renderLoop ?? new PreviewRenderLoop();
  const loop = loopRef.current;

  const subscribe = useCallback((listener: () => void) => loop.subscribe(listener), [loop]);
  const getSnapshot = useCallback(() => loop.getSnapshot(), [loop]);
  const snapshot: PreviewSnapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    loop.schedule(liveMarkdown);
  }, [loop, liveMarkdown]);

  useEffect(() => () => loop.reset(), [loop]);

  return (
    <div
      className="min-h-[0px] flex-1 overflow-y-auto px-hsp-xl py-vsp-md"
      aria-label={`Preview: ${title}`}
      data-preview-path={path}
    >
      <div className="mx-auto flex max-w-(--zdo-preview-measure) flex-col gap-vsp-sm">
        {snapshot.error !== null ? (
          <p
            role="alert"
            className="rounded-md border border-border bg-(--zdo-wash-danger) px-hsp-lg py-vsp-xs text-small text-danger"
          >
            {snapshot.error}
          </p>
        ) : null}

        {snapshot.html === null ? (
          snapshot.loading ? (
            <div className="rounded-md border border-border bg-surface-2 px-hsp-lg py-vsp-sm text-small text-muted">
              Loading preview engine…
            </div>
          ) : null
        ) : (
          <div className="zdo-prose" dangerouslySetInnerHTML={{ __html: snapshot.html }} />
        )}
      </div>
    </div>
  );
}
