/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/**
 * Regression coverage for button injection after Mermaid render and theme
 * re-render (#3132), plus the zoom dialog's open/zoom/pan/close interactions.
 * The test replays Mermaid's DOM mutations instead of loading Mermaid itself.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";
import { flushAll, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { MermaidEnlarge } from "../index.js";

const DIAGRAM_SOURCE = "graph LR\n  A[Start] --> B[End]";
const RENDERED_SVG = '<svg class="flowchart"><g></g></svg>';
const disposers: Array<() => void> = [];

/** Build the SSG shape a doc page ships: `main > .zd-content > div.mermaid`. */
function mountPage(): HTMLElement {
  document.body.innerHTML = `
    <main>
      <article class="zd-content">
        <div class="mermaid" data-mermaid>${DIAGRAM_SOURCE}</div>
      </article>
    </main>
  `;
  const container = document.querySelector<HTMLElement>(".mermaid");
  if (!container) throw new Error("fixture markup did not mount");
  return container;
}

/** Replay what `mermaid.run` + the init script do to a container. */
function simulateMermaidRender(container: HTMLElement): void {
  container.innerHTML = RENDERED_SVG;
  container.setAttribute("data-processed", "true");
  container.setAttribute("data-mermaid-rendered", "");
  container.setAttribute("data-mermaid-src", DIAGRAM_SOURCE);
}

/**
 * Replay `reinitMermaid`: restore the cached source (wiping every child),
 * then drop the render markers so the next init pass regenerates it.
 */
function simulateMermaidReinit(container: HTMLElement): void {
  const src = container.getAttribute("data-mermaid-src");
  if (src !== null) container.textContent = src;
  container.querySelector("svg")?.remove();
  container.removeAttribute("data-processed");
  container.removeAttribute("data-mermaid-rendered");
}

async function flushObservers(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await flushAll();
}

async function renderMermaidEnlarge() {
  const view = await renderIsland(MermaidEnlarge, {}, {
    identity: { component: "MermaidEnlarge", build: "test" },
  });
  disposers.push(view.dispose);
  expect(view.diagnostics).toEqual([]);
  return view;
}

function enlargeButton(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(":scope > .zd-enlarge-btn");
}

async function ensureButton(container: HTMLElement): Promise<void> {
  simulateMermaidRender(container);
  await flushObservers();
  expect(enlargeButton(container)).not.toBeNull();
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("MermaidEnlarge — enlarge-button injection", () => {
  it("injects the button when the diagram renders after the island activates", async () => {
    const container = mountPage();
    await renderMermaidEnlarge();
    expect(enlargeButton(container)).toBeNull();

    await ensureButton(container);

    expect(container.classList.contains("zd-mermaid-enlargeable")).toBe(true);
  });

  it("injects the button when the diagram already rendered before activation", async () => {
    const container = mountPage();
    simulateMermaidRender(container);

    await renderMermaidEnlarge();

    expect(enlargeButton(container)).not.toBeNull();
  });

  it("does not inject a second button on a repeat scan", async () => {
    const container = mountPage();
    await renderMermaidEnlarge();
    await ensureButton(container);
    container.setAttribute("data-mermaid-rendered", "");
    await flushObservers();

    expect(container.querySelectorAll(":scope > .zd-enlarge-btn")).toHaveLength(1);
  });

  it("re-injects the button after a theme re-render wipes it (#3132)", async () => {
    const container = mountPage();
    await renderMermaidEnlarge();
    await ensureButton(container);

    simulateMermaidReinit(container);
    await flushObservers();
    expect(enlargeButton(container)).toBeNull();
    expect(container.hasAttribute("data-mermaid-enlarge-ready")).toBe(true);

    await ensureButton(container);
    expect(enlargeButton(container)).not.toBeNull();
  });

  it("survives repeated theme re-renders", async () => {
    const container = mountPage();
    await renderMermaidEnlarge();
    await ensureButton(container);

    for (let index = 0; index < 3; index++) {
      simulateMermaidReinit(container);
      await flushObservers();
      await ensureButton(container);
    }

    expect(container.querySelectorAll(":scope > .zd-enlarge-btn")).toHaveLength(1);
  });

  it("opens, zooms, pans, closes, and closes on navigation", async () => {
    const container = mountPage();
    const view = await renderMermaidEnlarge();
    await ensureButton(container);
    const observerCleanup = vi.spyOn(MutationObserver.prototype, "disconnect");

    enlargeButton(container)!.click();
    await flushAll();
    const dialog = view.root.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector(".zd-mermaid-transform svg")?.outerHTML).toBe(RENDERED_SVG);
    const updatedGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    updatedGroup.setAttribute("data-refresh", "true");
    container.querySelector("svg")!.append(updatedGroup);
    await flushObservers();
    expect(dialog.querySelector(".zd-mermaid-transform svg g[data-refresh]"))
      .not.toBeNull();

    const zoomIn = dialog.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!;
    const zoomOut = dialog.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!;
    const panToggle = dialog.querySelector<HTMLButtonElement>('[aria-label="Toggle pan mode"]')!;
    zoomIn.click();
    await flushAll();
    expect(zoomOut.disabled).toBe(false);
    const viewport = dialog.querySelector<HTMLDivElement>(".zd-mermaid-viewport")!;
    const transform = dialog.querySelector<HTMLDivElement>(".zd-mermaid-transform")!;
    Object.defineProperty(transform, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 100, width: 200, height: 100,
        toJSON: () => ({}),
      } as DOMRect),
    });
    Object.defineProperty(viewport, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(viewport, "releasePointerCapture", { configurable: true, value: vi.fn() });

    panToggle.click();
    await flushAll();
    expect(panToggle.getAttribute("aria-pressed")).toBe("true");
    expect(viewport.hasAttribute("data-pan-active")).toBe(true);

    const pointerDown = new Event("pointerdown", { bubbles: true });
    Object.defineProperties(pointerDown, {
      clientX: { value: 0 }, clientY: { value: 0 }, pointerId: { value: 1 },
    });
    viewport.dispatchEvent(pointerDown);
    const pointerMove = new Event("pointermove", { bubbles: true });
    Object.defineProperties(pointerMove, {
      clientX: { value: 100 }, clientY: { value: 50 }, pointerId: { value: 1 },
    });
    viewport.dispatchEvent(pointerMove);
    await flushAll();
    expect(transform.getAttribute("style")).toContain("translate(20px, 10px)");

    const keyboardPan = new KeyboardEvent("keydown", {
      key: "ArrowRight", bubbles: true, cancelable: true,
    });
    viewport.dispatchEvent(keyboardPan);
    await flushAll();
    expect(keyboardPan.defaultPrevented).toBe(true);
    expect(transform.getAttribute("style")).toContain("translate(-20px, 10px)");

    const pointerUp = new Event("pointerup", { bubbles: true });
    Object.defineProperties(pointerUp, { pointerId: { value: 1 } });
    viewport.dispatchEvent(pointerUp);

    zoomOut.click();
    await flushAll();
    expect(transform.getAttribute("style")).toContain("translate(0px, 0px) scale(1)");
    expect(panToggle.getAttribute("aria-pressed")).toBe("false");

    dialog.querySelector<HTMLButtonElement>('[aria-label="Close enlarged diagram"]')!.click();
    await flushAll();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector(".zd-mermaid-toolbar")).toBeNull();
    expect(observerCleanup).toHaveBeenCalled();

    enlargeButton(container)!.click();
    await flushAll();
    expect(dialog.open).toBe(true);
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
    expect(dialog.open).toBe(false);

    document.querySelector("main")!.innerHTML = `
      <article class="zd-content">
        <div class="mermaid" data-mermaid>${DIAGRAM_SOURCE}</div>
      </article>
    `;
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    const nextContainer = document.querySelector<HTMLElement>("main .mermaid")!;
    await ensureButton(nextContainer);
    expect(enlargeButton(nextContainer)).not.toBeNull();
  });

  it("disconnects the content observer and delegated handlers on disposal", async () => {
    const container = mountPage();
    const documentAdd = vi.spyOn(document, "addEventListener");
    const documentRemove = vi.spyOn(document, "removeEventListener");
    const view = await renderMermaidEnlarge();
    await ensureButton(container);
    const clickHandler = documentAdd.mock.calls.find(([type]) => type === "click")?.[1];
    expect(clickHandler).toBeTypeOf("function");

    view.dispose();
    const index = disposers.indexOf(view.dispose);
    if (index >= 0) disposers.splice(index, 1);
    expect(documentRemove).toHaveBeenCalledWith("click", clickHandler);
    expect(documentRemove).toHaveBeenCalledWith(AFTER_NAVIGATE_EVENT, expect.any(Function));

    simulateMermaidReinit(container);
    await flushObservers();
    simulateMermaidRender(container);
    await flushObservers();
    expect(enlargeButton(container)).toBeNull();
  });
});
