/**
 * SLOT FILE — the CodeMirror sub-issue (#3336) replaces this file and nothing
 * else. Treat `EditorPaneSlotProps` as the contract between the chrome and
 * whatever renders the buffer.
 *
 * What the chrome guarantees to whatever lives here:
 *
 * - The host is a `position: absolute; inset: 0` box inside a `min-height: 0` flex
 *   chain (see `split.tsx`). An embedded editor may therefore use `height:
 *   100%` safely — the chain is intact, so it resolves against a real pixel
 *   height instead of collapsing to 0.
 * - `value` is the page BODY only. Frontmatter lives in the metadata row and
 *   never appears in this buffer (epic #3327 contract 1).
 * - `onChange` is called with the whole next document. The caller feeds it
 *   straight to `PageSaveMachine.edit({ markdown })`, whose ~500ms trailing
 *   debounce owns autosave — do not debounce again here.
 * - `onStatusChange` is optional and drives the status bar. `mode` is the
 *   reserved slot for the vim mode indicator: the placeholder below never
 *   reports one, and the status bar renders nothing rather than inventing a
 *   `-- NORMAL --` this editor cannot honour.
 *
 * The placeholder itself is a plain `<textarea>` wired to exactly that
 * contract, so autosave, the dirty dot, the save chip and the conflict UX are
 * all provably working end to end before CodeMirror arrives.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { useCompositionGuard } from "./ime";

interface PageDraft {
  pageId: string;
  markdown: string;
}

export interface EditorPaneStatus {
  /** 1-based caret line. */
  line: number;
  /** 1-based caret column. */
  column: number;
  words: number;
  /** Editor mode label (e.g. a vim mode). Absent when the editor has none. */
  mode?: string;
}

export interface EditorPaneSlotProps {
  pageId: string;
  /** The page body. Never contains a frontmatter block. */
  value: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  onStatusChange?: (status: EditorPaneStatus) => void;
}

export default function EditorPaneSlot({
  pageId,
  value,
  onChange,
  readOnly = false,
  onStatusChange,
}: EditorPaneSlotProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Local state exists ONLY for the duration of an IME composition. Preact
  // rewrites a controlled input's DOM value on any re-render, and during a
  // composition — when `onChange` is deliberately suppressed, so `value` sits
  // at the pre-composition text — that rewrite would wipe the candidate the
  // user is still choosing.
  //
  // It is tagged with the page it belongs to, and outside a composition it is
  // null, so the textarea is otherwise fully controlled by `value`. Both
  // details matter: a buffer that survived a tab switch would render the
  // PREVIOUS page's body for one frame, and an input in that frame would feed
  // it to the newly-selected page's `onChange` — autosaving one page's text
  // over another.
  const [composedDraft, setComposedDraft] = useState<PageDraft | null>(null);
  const buffer = composedDraft?.pageId === pageId ? composedDraft.markdown : value;

  function report(): void {
    const element = textareaRef.current;
    if (!element || !onStatusChange) return;
    onStatusChange(describeCaret(element.value, element.selectionStart ?? 0));
  }

  // Autosaving half-composed romaji would write real garbage to the page
  // file, so the buffer waits for the IME to finish the same way the metadata
  // fields do. CodeMirror handles this itself, so the replacement of this
  // file need not carry the guard forward.
  const isComposing = useCompositionGuard(textareaRef, (markdown) => {
    setComposedDraft(null);
    onChange(markdown);
    report();
  });

  // Re-report whenever the document or the page changes, so the status bar is
  // correct on load and after a tab switch — not only after a keystroke.
  useEffect(report, [value, pageId, onStatusChange]);

  return (
    <textarea
      ref={textareaRef}
      value={buffer}
      readOnly={readOnly}
      spellcheck={false}
      aria-label="Page markdown"
      className="size-full resize-none border-0 bg-transparent px-hsp-lg py-vsp-sm font-mono text-small leading-(--zdo-editor-leading) text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2"
      onInput={(event) => {
        const next = event.currentTarget.value;
        if (isComposing()) {
          setComposedDraft({ pageId, markdown: next });
          return;
        }
        setComposedDraft(null);
        onChange(next);
        report();
      }}
      onKeyUp={report}
      onClick={report}
    />
  );
}

export function describeCaret(text: string, caret: number): EditorPaneStatus {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const newlineIndex = before.lastIndexOf("\n");
  return {
    line: before.split("\n").length,
    column: before.length - newlineIndex,
    words: countWords(text),
  };
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}
