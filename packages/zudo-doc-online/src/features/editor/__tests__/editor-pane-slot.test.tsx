// @vitest-environment jsdom
/**
 * The CodeMirror pane in isolation.
 *
 * CodeMirror 6 mounts and dispatches perfectly well under jsdom — what jsdom
 * cannot do is lay anything out, so every measurement is zero and nothing
 * here may assert on pixels. That is a real limit, not an oversight: scroll
 * restoration and the block cursor's appearance are in the report's
 * browser-verification list rather than faked with stubbed rects.
 *
 * Everything below drives the editor the way a user would — through
 * transactions on the live view — rather than through the props, so the
 * echo-suppression and page-switch guards are exercised for real.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import { EditorView } from "@codemirror/view";
import { CodeMirror, Vim, getCM } from "@replit/codemirror-vim";
import EditorPaneSlot, { type EditorPaneStatus } from "../editor-pane-slot";
import { EditorContentTicker } from "../use-editor-content";
import { VIM_MODE_STORAGE_KEY } from "../persistence";
import { createFakeStorage, type FakeStorage } from "./support";

interface PaneProps {
  pageId: string;
  value: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
  onStatusChange?: (status: EditorPaneStatus) => void;
  onRequestSave?: () => void;
}

interface MountedPane {
  container: HTMLElement;
  storage: FakeStorage;
  ticker: EditorContentTicker;
  view: () => EditorView;
  rerender: (props: PaneProps) => void;
  /** A commit with NO passive-effect flush — the frame a tab switch opens. */
  rerenderWithoutEffects: (props: PaneProps) => void;
  statuses: EditorPaneStatus[];
  latestStatus: () => EditorPaneStatus;
}

const mountedPanes: MountedPane[] = [];

function mount(props: PaneProps, storage = createFakeStorage()): MountedPane {
  const container = document.createElement("div");
  document.body.appendChild(container);
  // A long window plus an explicit flush keeps the debounce deterministic:
  // no spec waits on wall-clock time to see a tick.
  const ticker = new EditorContentTicker({ delayMs: 10_000 });
  const statuses: EditorPaneStatus[] = [];

  function paint(next: PaneProps): void {
    render(
      <EditorPaneSlot
        {...next}
        onChange={next.onChange ?? (() => {})}
        onStatusChange={(status) => {
          statuses.push(status);
          next.onStatusChange?.(status);
        }}
        storage={storage}
        ticker={ticker}
      />,
      container,
    );
  }

  function draw(next: PaneProps): void {
    act(() => paint(next));
  }

  draw(props);

  const mounted: MountedPane = {
    container,
    storage,
    ticker,
    view: () => {
      const dom = container.querySelector<HTMLElement>(".cm-editor");
      const view = dom && EditorView.findFromDOM(dom);
      if (!view) throw new Error("no CodeMirror view is mounted");
      return view;
    },
    rerender: draw,
    // Preact's `render` flushes LAYOUT effects synchronously and defers
    // passive ones, so calling it bare reproduces exactly the window a
    // `useEffect`-based buffer swap would leave open.
    rerenderWithoutEffects: paint,
    statuses,
    latestStatus: () => {
      const status = statuses.at(-1);
      if (!status) throw new Error("the pane never reported a status");
      return status;
    },
  };
  mountedPanes.push(mounted);
  return mounted;
}

/**
 * `Vim`'s ex API types its editor parameter as "vim state is definitely
 * attached", which an attached adapter guarantees but `getCM`'s return type
 * does not express. The check makes that guarantee explicit before the cast.
 */
function vimAdapter(view: EditorView): Parameters<typeof Vim.handleEx>[0] {
  const cm = getCM(view);
  if (!cm?.state.vim) throw new Error("vim is not attached to this editor");
  return cm as Parameters<typeof Vim.handleEx>[0];
}

/** Replaces the whole document the way a keystroke burst eventually would. */
function typeInto(view: EditorView, text: string): void {
  act(() => {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  });
}

function docOf(view: EditorView): string {
  return view.state.doc.toString();
}

afterEach(() => {
  for (const pane of mountedPanes.splice(0)) {
    render(null, pane.container);
    pane.container.remove();
  }
  document.body.innerHTML = "";
});

/** Storage that starts a pane with vim already on. */
function vimOnStorage(): FakeStorage {
  return createFakeStorage({ [VIM_MODE_STORAGE_KEY]: "on" });
}

describe("mounting", () => {
  it("shows the page body and reports the caret, word count and file label", () => {
    const pane = mount({ pageId: "page-a", value: "# Title\n\nsome body text" });

    expect(docOf(pane.view())).toBe("# Title\n\nsome body text");
    expect(pane.latestStatus()).toMatchObject({ line: 1, column: 1, words: 5 });
  });

  it("turns off the platform text meddling that would corrupt markdown", () => {
    const pane = mount({ pageId: "page-a", value: "text" });
    const content = pane.view().contentDOM;

    // An autocorrected `--` or an autocapitalised fence language is a
    // corrupted document, not a helpful suggestion.
    expect(content.getAttribute("autocorrect")).toBe("off");
    expect(content.getAttribute("autocapitalize")).toBe("off");
    expect(content.getAttribute("spellcheck")).toBe("false");
    expect(content.getAttribute("aria-label")).toBe("Page markdown");
  });
});

describe("editing", () => {
  it("reports the whole next document, undebounced", () => {
    const onChange = vi.fn();
    const pane = mount({ pageId: "page-a", value: "start", onChange });

    typeInto(pane.view(), "start more");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("start more");
  });

  it("ignores its own edit echoing back through the save machine", () => {
    const onChange = vi.fn();
    const pane = mount({ pageId: "page-a", value: "start", onChange });
    const view = pane.view();

    typeInto(view, "typed by the user");
    act(() => view.dispatch({ selection: { anchor: 5 } }));
    onChange.mockClear();

    // What the save machine does with every edit: hand the same text back as
    // the new `value`. Rewriting the document here would drag the caret to
    // the end of the line on every single keystroke.
    pane.rerender({ pageId: "page-a", value: "typed by the user", onChange });

    expect(onChange).not.toHaveBeenCalled();
    expect(docOf(view)).toBe("typed by the user");
    expect(view.state.selection.main.anchor).toBe(5);
    expect(pane.view()).toBe(view);
  });

  it("adopts a document replaced from outside without calling it a user edit", () => {
    const onChange = vi.fn();
    const pane = mount({ pageId: "page-a", value: "my local draft", onChange });
    const view = pane.view();
    onChange.mockClear();

    // The conflict-discard path: the chrome loads the server's text.
    pane.rerender({ pageId: "page-a", value: "someone else's text", onChange });

    expect(docOf(view)).toBe("someone else's text");
    // Echoing this back to the save machine would mark the just-reconciled
    // page dirty again and start the whole conflict over.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the caret inside the document after a shorter replacement", () => {
    const pane = mount({ pageId: "page-a", value: "a fairly long starting body" });
    const view = pane.view();
    act(() => {
      view.dispatch({ selection: { anchor: view.state.doc.length } });
    });

    pane.rerender({ pageId: "page-a", value: "tiny" });

    expect(view.state.selection.main.anchor).toBeLessThanOrEqual(4);
  });
});

describe("switching pages", () => {
  it("loads the new page's body without reporting it as an edit", () => {
    const onChange = vi.fn();
    const pane = mount({ pageId: "page-a", value: "body of A", onChange });
    const view = pane.view();
    typeInto(view, "edited A");
    onChange.mockClear();

    pane.rerender({ pageId: "page-b", value: "body of B", onChange });

    expect(docOf(view)).toBe("body of B");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the previous page's text out of the new page's undo history", () => {
    // Driven through vim's undo because it is the one undo command reachable
    // from this package's dependencies — the history it walks is CodeMirror's
    // own, so the guarantee under test is the real one.
    const pane = mount({ pageId: "page-a", value: "body of A" }, vimOnStorage());
    const view = pane.view();
    typeInto(view, "edited A heavily");

    pane.rerender({ pageId: "page-b", value: "body of B" });
    act(() => CodeMirror.commands.undo(vimAdapter(view)));

    // A `dispatch` would have left page A one undo away INSIDE page B's
    // buffer, and the next autosave would have written it to page B's file.
    expect(docOf(view)).toBe("body of B");
    expect(view.scrollDOM.scrollTop).toBe(0);
  });

  it("never lets page A's queued tick land after the switch to page B", () => {
    const pane = mount({ pageId: "page-a", value: "body of A" });
    const seen: string[] = [];
    pane.ticker.subscribe(() => {
      const tick = pane.ticker.getSnapshot();
      if (tick) seen.push(`${tick.pageId}:${tick.markdown}`);
    });

    typeInto(pane.view(), "a long edit made on page A");
    pane.rerender({ pageId: "page-b", value: "body of B" });

    // Immediately — no flush, no timer. A subscriber reading the tick in the
    // frame after the switch would otherwise still be shown page A's text
    // under page B's identity.
    expect(seen).toEqual(["page-b:body of B"]);

    pane.ticker.flush();
    expect(seen).toEqual(["page-b:body of B"]);
  });

  it("never feeds the previous page's text to the newly selected page", () => {
    const onChange = vi.fn();
    const pane = mount({ pageId: "page-a", value: "body of A", onChange });
    const view = pane.view();
    typeInto(view, "a draft only page A should ever receive");
    onChange.mockClear();

    // The chrome rebuilds `onChange` around page B's save machine during this
    // very commit. If the buffer swap waited for a passive effect, the buffer
    // would still hold page A's draft here — and the keystroke below would
    // autosave it into page B's file ~500ms later.
    pane.rerenderWithoutEffects({ pageId: "page-b", value: "body of B", onChange });
    act(() => {
      view.dispatch({ changes: { from: view.state.doc.length, insert: "!" } });
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith("body of B!");
  });

  it("recounts the words for the page that is actually open", () => {
    const pane = mount({ pageId: "page-a", value: "one two three four" });
    expect(pane.latestStatus().words).toBe(4);

    pane.rerender({ pageId: "page-b", value: "just two" });

    expect(pane.latestStatus().words).toBe(2);
  });
});

describe("the content tick", () => {
  it("carries the debounced text that the word count and preview read", () => {
    const pane = mount({ pageId: "page-a", value: "one" });

    typeInto(pane.view(), "one two three");
    expect(pane.latestStatus().words).toBe(1);

    act(() => pane.ticker.flush());

    expect(pane.ticker.getSnapshot()).toMatchObject({
      pageId: "page-a",
      markdown: "one two three",
    });
    expect(pane.latestStatus().words).toBe(3);
  });
});

describe("read-only", () => {
  it("refuses edits and drops contenteditable while a conflict is unresolved", () => {
    const pane = mount({ pageId: "page-a", value: "body", readOnly: false });
    const view = pane.view();

    pane.rerender({ pageId: "page-a", value: "body", readOnly: true });

    expect(view.state.readOnly).toBe(true);
    // Without this the user gets a caret in a buffer their keystrokes cannot
    // change, which reads as a broken editor rather than a locked one.
    expect(view.contentDOM.getAttribute("contenteditable")).toBe("false");

    pane.rerender({ pageId: "page-a", value: "body", readOnly: false });
    expect(view.state.readOnly).toBe(false);
  });
});

describe("vim mode", () => {
  it("is off by default and reports no mode", () => {
    const pane = mount({ pageId: "page-a", value: "body" });

    expect(pane.latestStatus().mode).toBeUndefined();
    // The toggle is still offered — it is the only way back on.
    expect(typeof pane.latestStatus().onToggleVim).toBe("function");
  });

  it("turns on through the status toggle, reports the mode, and persists", () => {
    const pane = mount({ pageId: "page-a", value: "body" });

    act(() => pane.latestStatus().onToggleVim?.());

    expect(pane.latestStatus().mode).toBe("-- NORMAL --");
    expect(pane.storage.entries.get(VIM_MODE_STORAGE_KEY)).toBe("on");
    expect(getCM(pane.view())).toBeTruthy();
  });

  it("turns back off, dropping the mode and the vim keymap", () => {
    const pane = mount({ pageId: "page-a", value: "body" });
    act(() => pane.latestStatus().onToggleVim?.());
    act(() => pane.latestStatus().onToggleVim?.());

    expect(pane.latestStatus().mode).toBeUndefined();
    expect(pane.storage.entries.get(VIM_MODE_STORAGE_KEY)).toBe("off");
    expect(getCM(pane.view())).toBeNull();
  });

  it("starts enabled when a previous session left it on", () => {
    const pane = mount(
      { pageId: "page-a", value: "body" },
      vimOnStorage(),
    );

    expect(pane.latestStatus().mode).toBe("-- NORMAL --");
  });

  it("keeps reporting the mode after a page switch rebuilds the editor state", () => {
    const pane = mount(
      { pageId: "page-a", value: "body of A" },
      vimOnStorage(),
    );

    pane.rerender({ pageId: "page-b", value: "body of B" });
    act(() => {
      getCM(pane.view())?.signal("vim-mode-change", { mode: "insert" });
    });

    // `setState` discards the vim plugin instance the mode listener was bound
    // to. A stale binding still LOOKS right — the label lingers on its last
    // value — so the only honest check is whether a NEW mode change is
    // followed at all.
    expect(pane.latestStatus().mode).toBe("-- INSERT --");
  });

  it("follows the mode as vim changes it", () => {
    const pane = mount(
      { pageId: "page-a", value: "body" },
      vimOnStorage(),
    );
    const cm = getCM(pane.view());

    act(() => {
      cm?.signal("vim-mode-change", { mode: "visual", subMode: "linewise" });
    });

    expect(pane.latestStatus().mode).toBe("-- VISUAL LINE --");
  });
});

describe(":w", () => {
  it("saves the current draft through the chrome's save path", () => {
    const onRequestSave = vi.fn();
    const pane = mount(
      { pageId: "page-a", value: "body", onRequestSave },
      vimOnStorage(),
    );
    act(() => Vim.handleEx(vimAdapter(pane.view()), "w"));

    expect(onRequestSave).toHaveBeenCalledTimes(1);
  });

  it("saves the editor it was typed in, not whichever mounted last", () => {
    const saveFirst = vi.fn();
    const saveSecond = vi.fn();
    const first = mount(
      { pageId: "page-a", value: "body of A", onRequestSave: saveFirst },
      vimOnStorage(),
    );
    mount(
      { pageId: "page-b", value: "body of B", onRequestSave: saveSecond },
      vimOnStorage(),
    );

    // `Vim.defineEx` registers the command GLOBALLY, so a module-level
    // "current handler" would silently save the wrong page as soon as a
    // second editor exists — a pop-out preview, or a future second pane.
    act(() => Vim.handleEx(vimAdapter(first.view()), "w"));

    expect(saveFirst).toHaveBeenCalledTimes(1);
    expect(saveSecond).not.toHaveBeenCalled();
  });
});
