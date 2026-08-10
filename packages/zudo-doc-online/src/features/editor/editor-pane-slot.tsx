/**
 * The editor buffer: a CodeMirror 6 view mounted into the slot the workspace
 * chrome reserves for it.
 *
 * This file is the mount seam — `EditorPaneSlotProps` is the whole contract
 * between the chrome and the editor, and the chrome guarantees:
 *
 * - The host is a `position: absolute; inset: 0` box inside an unbroken
 *   `min-height: 0` flex chain (see `split.tsx`), so `height: 100%` resolves
 *   to real pixels rather than collapsing to zero.
 * - `value` is the page BODY only. Frontmatter lives in the metadata row and
 *   never appears in this buffer (epic #3327 contract 1).
 * - `onChange` receives the whole next document, undebounced —
 *   `PageSaveMachine`'s ~500ms trailing debounce owns autosave, and a second
 *   debounce here would only make "Edited" lie about when it started.
 *
 * ## Why so much of this lives in refs
 *
 * A CodeMirror pane driven as a controlled component — document in
 * `useState`, written back through the props on every keystroke — thrashes.
 * Each keystroke re-renders the host, the sync effect writes the document
 * back into the view, and the view re-measures against a document it already
 * had; the visible symptoms are a caret that jumps and a scroll position that
 * will not stay put. So the document lives in `docRef`, and the only thing
 * that ever writes into the view is a change the view did NOT originate.
 * `docRef` is what tells the two apart: when `value` comes back equal to what
 * the last update produced, it is our own edit echoing through the save
 * machine and is ignored.
 *
 * Three narrower hazards have their own guards:
 *
 * - **Page switches replace the state, not the document.** `view.setState`
 *   gives the new page a fresh undo history — a `dispatch` would leave the
 *   previous page's text one ⌘Z away inside the new page's buffer — and the
 *   scroll goes back to the top, because keeping page A's scroll offset on
 *   page B is meaningless.
 * - **Programmatic replacements are annotated.** Adopting the server's text
 *   after a conflict discard is not a user edit; without the annotation the
 *   update listener would hand it straight back to the save machine and mark
 *   the freshly-reconciled page dirty again.
 * - **A full-document replacement of the SAME page restores `scrollTop`.**
 *   CodeMirror has no reason to preserve it across a change that big, and a
 *   reader halfway down a page they did not edit should not be thrown back to
 *   the top.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import {
  buildEditorExtensions,
  createEditorCompartments,
  currentVimMode,
  observeVimMode,
  readOnlyExtension,
  readVimEnabled,
  registerWriteExCommand,
  vimExtension,
  vimModeLabel,
  writeVimEnabled,
} from "./editor-extensions";
import type { KeyValueStorage } from "./persistence";
import {
  countWords,
  editorContentTicker,
  EditorContentTicker,
  PageSwitchCounter,
} from "./use-editor-content";

/** Marks a transaction this component dispatched, so it is not echoed back. */
const ProgrammaticChange = Annotation.define<boolean>();

export interface EditorPaneStatus {
  /** 1-based caret line. */
  line: number;
  /** 1-based caret column. */
  column: number;
  words: number;
  /** Vim mode label (`-- NORMAL --`). Absent when vim mode is off. */
  mode?: string;
  /**
   * Turns vim mode on or off. Present whenever the editor CAN do vim, which
   * is what lets the status bar keep offering the toggle after vim has been
   * switched off and `mode` has gone away.
   */
  onToggleVim?: () => void;
}

export interface EditorPaneSlotProps {
  pageId: string;
  /** The page body. Never contains a frontmatter block. */
  value: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  onStatusChange?: (status: EditorPaneStatus) => void;
  /** `:w` — save the current draft now, bypassing the autosave debounce. */
  onRequestSave?: () => void;
  /** Test seam: `null` disables the vim-mode preference persistence. */
  storage?: KeyValueStorage | null;
  /** Test seam: the content tick this pane publishes to. */
  ticker?: EditorContentTicker;
}

export default function EditorPaneSlot({
  pageId,
  value,
  onChange,
  readOnly = false,
  onStatusChange,
  onRequestSave,
  storage,
  ticker = editorContentTicker,
}: EditorPaneSlotProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef(createEditorCompartments());
  const switchCounterRef = useRef(new PageSwitchCounter());

  // Latest-props refs: the CodeMirror callbacks outlive any one render, so
  // they must not close over the props of the render that created them.
  //
  // `onChange` is stored WITH the page it belongs to. The chrome rebuilds it
  // per render around the newly active save machine, so an edit reported
  // while the buffer still held the previous page's text would be autosaved
  // into the newly selected page's file. The buffer swap below is a layout
  // effect precisely so that window never opens; pairing the two here means
  // the invariant is enforced rather than merely timed.
  const editTargetRef = useRef({ pageId, onChange });
  const onStatusChangeRef = useRef(onStatusChange);
  const onRequestSaveRef = useRef(onRequestSave);
  editTargetRef.current = { pageId, onChange };
  onStatusChangeRef.current = onStatusChange;
  onRequestSaveRef.current = onRequestSave;

  /** The document the view is known to hold — see the module comment. */
  const docRef = useRef(value);
  /** The page whose body is currently loaded, which lags `pageId` by one effect. */
  const loadedPageRef = useRef(pageId);
  const wordsRef = useRef(countWords(value));
  const vimModeRef = useRef<string | undefined>(undefined);
  const detachVimRef = useRef<(() => void) | null>(null);

  const [vimEnabled, setVimEnabled] = useState(() => readVimEnabled(storage));
  const vimEnabledRef = useRef(vimEnabled);
  vimEnabledRef.current = vimEnabled;

  const toggleVim = useCallback(() => {
    setVimEnabled((enabled) => {
      const next = !enabled;
      writeVimEnabled(next, storage);
      return next;
    });
  }, [storage]);
  const toggleVimRef = useRef(toggleVim);
  toggleVimRef.current = toggleVim;

  const report = useCallback((): void => {
    const view = viewRef.current;
    const notify = onStatusChangeRef.current;
    if (!view || !notify) return;
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    notify({
      line: line.number,
      column: head - line.from + 1,
      words: wordsRef.current,
      ...(vimModeRef.current === undefined ? {} : { mode: vimModeRef.current }),
      onToggleVim: () => toggleVimRef.current(),
    });
  }, []);

  /**
   * (Re)binds the vim mode listener. Must run after anything that recreates
   * the vim plugin: the initial mount, a state replacement on page switch,
   * and the toggle itself.
   */
  const syncVimListener = useCallback(
    (view: EditorView): void => {
      detachVimRef.current?.();
      detachVimRef.current = null;
      if (!vimEnabledRef.current) {
        vimModeRef.current = undefined;
        return;
      }
      vimModeRef.current = vimModeLabel(currentVimMode(view));
      detachVimRef.current = observeVimMode(view, (event) => {
        vimModeRef.current = vimModeLabel(event);
        report();
      });
    },
    [report],
  );

  const handleUpdate = useCallback(
    (update: ViewUpdate): void => {
      if (update.docChanged) {
        const next = update.state.doc.toString();
        docRef.current = next;
        const programmatic = update.transactions.some(
          (transaction) => transaction.annotation(ProgrammaticChange) === true,
        );
        const target = editTargetRef.current;
        // Dropping an edit whose page no longer matches the buffer loses a
        // keystroke the user is about to have replaced anyway; reporting it
        // would write one page's body into another page's file.
        if (!programmatic && target.pageId === loadedPageRef.current) {
          target.onChange(next);
        }
        ticker.publish({
          pageId: loadedPageRef.current,
          markdown: next,
          token: switchCounterRef.current.token,
        });
      }
      if (update.docChanged || update.selectionSet || update.focusChanged) report();
    },
    [ticker, report],
  );

  // Mount once. Every later change reaches the view through a transaction,
  // never through a rebuild — recreating the view would drop the caret, the
  // scroll offset and the undo history on every prop change.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const initialPageId = loadedPageRef.current;
    const token = switchCounterRef.current.switchTo(initialPageId);
    const view = new EditorView({
      state: EditorState.create({
        doc: docRef.current,
        extensions: buildEditorExtensions({
          compartments: compartmentsRef.current,
          vimEnabled: vimEnabledRef.current,
          readOnly,
          onUpdate: handleUpdate,
        }),
      }),
      parent: host,
    });
    viewRef.current = view;

    syncVimListener(view);
    const releaseWrite = registerWriteExCommand(view, () => onRequestSaveRef.current?.());
    ticker.publishNow({
      pageId: initialPageId,
      markdown: docRef.current,
      token,
    });
    report();

    return () => {
      detachVimRef.current?.();
      detachVimRef.current = null;
      releaseWrite();
      view.destroy();
      viewRef.current = null;
      // With no editor mounted there IS no editor content, and a subscriber
      // left holding the last page's body would render it as though it were
      // still on screen.
      ticker.reset();
    };
    // Mount-only on purpose: `readOnly` and the callbacks are kept current by
    // their own effects and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page switch, then external document replacement — in that order, because
  // a switch also changes `value` and must not be mistaken for one.
  //
  // LAYOUT effect, not a passive one. A passive effect runs after paint, so a
  // tab switch would leave a window — at least one frame — in which the
  // buffer still shows page A while the props already address page B's save
  // machine. A keystroke landing in that window is page A's text arriving as
  // page B's edit, and ~500ms later it is page B's file on disk. Running in
  // the commit phase closes the window entirely: the props and the buffer
  // change together, exactly as they did when this pane was a controlled
  // textarea.
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (loadedPageRef.current !== pageId) {
      loadedPageRef.current = pageId;
      const token = switchCounterRef.current.switchTo(pageId);
      view.setState(
        EditorState.create({
          doc: value,
          extensions: buildEditorExtensions({
            compartments: compartmentsRef.current,
            vimEnabled: vimEnabledRef.current,
            readOnly,
            onUpdate: handleUpdate,
          }),
        }),
      );
      view.scrollDOM.scrollTop = 0;
      docRef.current = value;
      wordsRef.current = countWords(value);
      syncVimListener(view);
      ticker.publishNow({ pageId, markdown: value, token });
      report();
      return;
    }

    // Fast path for the common case — the save machine handing our own edit
    // straight back — so a keystroke does not serialise the whole document
    // just to discover nothing changed. The authoritative check is the next
    // one; this only skips the `toString()`.
    if (value === docRef.current) return;
    const current = view.state.doc.toString();
    if (value === current) {
      docRef.current = value;
      return;
    }

    const scrollTop = view.scrollDOM.scrollTop;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor: Math.min(view.state.selection.main.anchor, value.length) },
      annotations: ProgrammaticChange.of(true),
    });
    view.scrollDOM.scrollTop = scrollTop;
    docRef.current = value;
  }, [pageId, value, readOnly, handleUpdate, syncVimListener, report, ticker]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: compartmentsRef.current.readOnly.reconfigure(readOnlyExtension(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: compartmentsRef.current.vim.reconfigure(vimExtension(vimEnabled)),
    });
    // Drop the label HERE, at the reconfigure that invalidates it, rather than
    // leaving it to `syncVimListener`. Turning vim off destroys the adapter the
    // mode listener was bound to, so the label is stale the instant this
    // dispatch lands; clearing it in the same step means no later step has to
    // run for the chip to stop claiming a mode the editor is no longer in.
    if (!vimEnabled) vimModeRef.current = undefined;
    syncVimListener(view);
    report();
  }, [vimEnabled, syncVimListener, report]);

  // The word count rides the debounced tick rather than the update listener:
  // it is an O(document) scan, and nobody needs it to be exact mid-word.
  useEffect(
    () =>
      ticker.subscribe(() => {
        const tick = ticker.getSnapshot();
        if (!tick || tick.pageId !== loadedPageRef.current) return;
        wordsRef.current = countWords(tick.markdown);
        report();
      }),
    [ticker, report],
  );

  return <div ref={hostRef} className="size-full overflow-hidden" />;
}
