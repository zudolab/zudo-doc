/** @vitest-environment happy-dom */
/**
 * Real-DOM tests for the code block word-wrap preference.
 *
 * Word wrap used to live only in a DOM class, so it was lost on every
 * reload — painful in the doc-writing loop (`pnpm dev` → edit MDX → reload).
 * It is now a PAGE-WIDE preference persisted in `sessionStorage`: toggling
 * any button wraps every block on the page, and the choice is restored on
 * the next load.
 *
 * These tests execute the real init script against a DOM fixture. happy-dom
 * has no layout engine, so `scrollWidth`/`clientWidth` are stubbed per
 * element to model an overflowing vs. a comfortably-fitting code block —
 * the distinction that decides whether the wrap button is offered at all.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CODE_BLOCK_ENHANCER_SCRIPT,
  CODE_WRAP_STORAGE_KEY,
} from "../code-block-enhancer-script.js";

const OVERFLOWING = "overflowing";
const FITTING = "fitting";

/**
 * Stand-in that records observed elements so a test can fire the callback the
 * way a browser would when a hidden block gains a layout box.
 */
class FakeResizeObserver {
  static callbacks: Array<(entries: Array<{ target: Element }>) => void> = [];
  static observed = new Set<Element>();

  constructor(cb: (entries: Array<{ target: Element }>) => void) {
    FakeResizeObserver.callbacks.push(cb);
  }
  observe(el: Element): void {
    FakeResizeObserver.observed.add(el);
  }
  unobserve(el: Element): void {
    FakeResizeObserver.observed.delete(el);
  }
  disconnect(): void {}

  /** Deliver a resize notification for `el` to every live observer. */
  static fire(el: Element): void {
    for (const cb of FakeResizeObserver.callbacks) {
      if (FakeResizeObserver.observed.has(el)) cb([{ target: el }]);
    }
  }
}

interface Block {
  pre: HTMLElement;
  wrapBtn: HTMLButtonElement;
}

/**
 * Render two highlighted blocks and run the enhancer over them.
 *
 * Call order matters: `sessionStorage` must already hold the desired
 * preference, because the IIFE reads it once on execution — which is
 * exactly how a page load restores the setting.
 */
function loadPage(): { overflowing: Block; fitting: Block } {
  document.body.innerHTML = `
    <main>
      <pre class="hi-root" data-fixture="${OVERFLOWING}"><code>const longVariable = "a deliberately long line";</code></pre>
      <pre class="hi-root" data-fixture="${FITTING}"><code>const x = 1;</code></pre>
    </main>
  `;

  stubWidths(queryPre(OVERFLOWING), { scrollWidth: 800, clientWidth: 400 });
  stubWidths(queryPre(FITTING), { scrollWidth: 120, clientWidth: 400 });

  new Function(CODE_BLOCK_ENHANCER_SCRIPT)();

  return { overflowing: readBlock(OVERFLOWING), fitting: readBlock(FITTING) };
}

function queryPre(fixture: string): HTMLElement {
  const pre = document.querySelector<HTMLElement>(
    `pre[data-fixture="${fixture}"]`,
  );
  if (!pre) throw new Error(`fixture ${fixture} did not mount`);
  return pre;
}

function readBlock(fixture: string): Block {
  const pre = queryPre(fixture);
  // The enhancer moves each <pre> into a .code-block-wrapper and appends the
  // button group as a sibling, so the button is reached via the parent.
  const wrapBtn = pre.parentElement?.querySelector<HTMLButtonElement>(
    "button.code-btn-wrap",
  );
  if (!wrapBtn) throw new Error(`fixture ${fixture} was not enhanced`);
  return { pre, wrapBtn };
}

/** happy-dom reports 0 for every layout box — model the two cases we care about. */
function stubWidths(
  el: HTMLElement,
  widths: { scrollWidth: number; clientWidth: number },
): void {
  Object.defineProperty(el, "scrollWidth", {
    value: widths.scrollWidth,
    configurable: true,
  });
  Object.defineProperty(el, "clientWidth", {
    value: widths.clientWidth,
    configurable: true,
  });
}

function isWrapped(block: Block): boolean {
  return block.pre.classList.contains("word-wrap");
}

function isButtonShown(block: Block): boolean {
  return block.wrapBtn.style.display !== "none";
}

beforeEach(() => {
  FakeResizeObserver.callbacks = [];
  FakeResizeObserver.observed = new Set();
  Reflect.set(globalThis, "ResizeObserver", FakeResizeObserver);
  sessionStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = "";
  sessionStorage.clear();
});

describe("code block wrap preference", () => {
  it("starts unwrapped when nothing is stored", () => {
    const { overflowing, fitting } = loadPage();

    expect(isWrapped(overflowing)).toBe(false);
    expect(isWrapped(fitting)).toBe(false);
    expect(overflowing.wrapBtn.getAttribute("aria-pressed")).toBe("false");
    expect(sessionStorage.getItem(CODE_WRAP_STORAGE_KEY)).toBeNull();
  });

  it("offers the button only on blocks that overflow", () => {
    const { overflowing, fitting } = loadPage();

    expect(isButtonShown(overflowing)).toBe(true);
    expect(isButtonShown(fitting)).toBe(false);
  });

  it("toggling one button wraps every block on the page", () => {
    const { overflowing, fitting } = loadPage();

    overflowing.wrapBtn.click();

    for (const block of [overflowing, fitting]) {
      expect(isWrapped(block)).toBe(true);
      expect(block.wrapBtn.classList.contains("active")).toBe(true);
      expect(block.wrapBtn.getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("keeps the button hidden on a fitting block even while wrap is on", () => {
    // Regression guard: wrapping makes `scrollWidth > clientWidth` false for
    // every block, so a naive "keep visible while active" rule would reveal a
    // wrap button on short blocks that never needed one.
    const { overflowing, fitting } = loadPage();

    overflowing.wrapBtn.click();

    expect(isButtonShown(overflowing)).toBe(true);
    expect(isButtonShown(fitting)).toBe(false);
  });

  it("persists the choice under the documented key", () => {
    const { overflowing } = loadPage();

    overflowing.wrapBtn.click();
    expect(sessionStorage.getItem(CODE_WRAP_STORAGE_KEY)).toBe("1");

    overflowing.wrapBtn.click();
    expect(sessionStorage.getItem(CODE_WRAP_STORAGE_KEY)).toBe("0");
    expect(isWrapped(overflowing)).toBe(false);
  });

  it("restores the stored choice on the next page load", () => {
    sessionStorage.setItem(CODE_WRAP_STORAGE_KEY, "1");

    const { overflowing, fitting } = loadPage();

    for (const block of [overflowing, fitting]) {
      expect(isWrapped(block)).toBe(true);
      expect(block.wrapBtn.getAttribute("aria-pressed")).toBe("true");
    }
    // Restoring must not resurrect the button on a block that fits.
    expect(isButtonShown(fitting)).toBe(false);
  });

  it("stays unwrapped when the stored value is off", () => {
    sessionStorage.setItem(CODE_WRAP_STORAGE_KEY, "0");

    const { overflowing } = loadPage();

    expect(isWrapped(overflowing)).toBe(false);
    expect(overflowing.wrapBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("offers the toggle on a tab-panel block opened after wrap was restored", () => {
    // A <pre> inside a closed <TabItem> panel is `hidden`, so it measures 0/0
    // at enhancement time. Caching that as "fits" while wrap is on would hide
    // its toggle permanently — on a page whose only overflowing block lives in
    // a tab, that leaves no way to turn wrapping back off.
    sessionStorage.setItem(CODE_WRAP_STORAGE_KEY, "1");

    document.body.innerHTML = `
      <main>
        <div class="tab-panel" hidden><pre data-fixture="${OVERFLOWING}"><code>a very long line</code></pre></div>
      </main>
    `;
    const pre = queryPre(OVERFLOWING);
    stubWidths(pre, { scrollWidth: 0, clientWidth: 0 }); // hidden: no layout box

    new Function(CODE_BLOCK_ENHANCER_SCRIPT)();
    const block = readBlock(OVERFLOWING);

    // While hidden it is neither wrapped nor offering a toggle — nothing is
    // known about it yet.
    expect(isWrapped(block)).toBe(false);
    expect(isButtonShown(block)).toBe(false);

    // Open the tab: the panel gains a layout box and the observer fires.
    block.pre.closest(".tab-panel")?.removeAttribute("hidden");
    stubWidths(block.pre, { scrollWidth: 800, clientWidth: 400 });
    FakeResizeObserver.fire(block.pre);

    expect(isButtonShown(block)).toBe(true);
    expect(isWrapped(block)).toBe(true);
    expect(block.wrapBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("settles after the wrap it applies triggers a second resize", () => {
    // Applying word-wrap from inside the observer changes the block's height,
    // so the browser delivers one more notification. That second pass must be
    // a no-op rather than flipping state back and forth.
    sessionStorage.setItem(CODE_WRAP_STORAGE_KEY, "1");
    const { overflowing } = loadPage();

    FakeResizeObserver.fire(overflowing.pre);
    FakeResizeObserver.fire(overflowing.pre);

    expect(isWrapped(overflowing)).toBe(true);
    expect(isButtonShown(overflowing)).toBe(true);
    expect(overflowing.wrapBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("re-hides the toggle when a widened block stops overflowing", () => {
    // Pre-existing behaviour that must survive the cache: while unwrapped, the
    // measurement stays live.
    const { overflowing } = loadPage();
    expect(isButtonShown(overflowing)).toBe(true);

    stubWidths(overflowing.pre, { scrollWidth: 300, clientWidth: 900 });
    FakeResizeObserver.fire(overflowing.pre);

    expect(isButtonShown(overflowing)).toBe(false);
  });

  it("still enhances blocks when storage access throws", () => {
    // Safari private mode and some cookie-blocking configurations throw on
    // any sessionStorage access — the enhancer must degrade, not die.
    const denied = {
      getItem(): string {
        throw new Error("storage denied");
      },
      setItem(): void {
        throw new Error("storage denied");
      },
    };
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      "sessionStorage",
    );
    Object.defineProperty(globalThis, "sessionStorage", {
      value: denied,
      configurable: true,
    });

    try {
      const { overflowing, fitting } = loadPage();

      expect(isWrapped(overflowing)).toBe(false);
      expect(() => overflowing.wrapBtn.click()).not.toThrow();
      expect(isWrapped(overflowing)).toBe(true);
      expect(isWrapped(fitting)).toBe(true);
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "sessionStorage", original);
      }
    }
  });
});
