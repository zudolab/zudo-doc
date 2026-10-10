/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */

import { afterEach, describe, expect, it, vi } from "vitest";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";
import { flushAll, renderIsland, renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { ImageEnlarge } from "../index.js";
import { ImageEnlargeSsrFallback } from "../ssr-fallback.js";
import { IMAGE_ENLARGE_DIALOG_CLASS } from "../../island-types/index.js";

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  readonly observe = vi.fn<(target: Element) => void>();
  readonly disconnect = vi.fn<() => void>();

  constructor(_callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }
}

const disposers: Array<() => void> = [];

function pageWithImage() {
  document.body.innerHTML = `
    <main>
      <article class="zd-content">
        <figure class="zd-enlargeable">
          <button class="zd-enlarge-btn" type="button" aria-label="Enlarge image" hidden></button>
          <img src="/diagram.png" srcset="/diagram@2x.png 2x" alt="Example diagram">
        </figure>
      </article>
    </main>
  `;
  const image = document.querySelector<HTMLImageElement>(".zd-enlargeable img")!;
  setNaturalSize(image);
  return {
    image,
    button: document.querySelector<HTMLButtonElement>(".zd-enlarge-btn")!,
  };
}

function setNaturalSize(image: HTMLImageElement) {
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 2400 },
    naturalHeight: { configurable: true, value: 1200 },
    clientWidth: { configurable: true, value: 600 },
  });
}

async function mountImageEnlarge() {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  ResizeObserverStub.instances = [];
  const view = await renderIsland(ImageEnlarge, {}, {
    identity: { component: "ImageEnlarge", build: "test" },
  });
  disposers.push(view.dispose);
  expect(view.diagnostics).toEqual([]);
  return view;
}

function disposeView(view: Awaited<ReturnType<typeof mountImageEnlarge>>) {
  const index = disposers.indexOf(view.dispose);
  if (index >= 0) disposers.splice(index, 1);
  view.dispose();
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ImageEnlarge — SSR shell", () => {
  it("pins the island marker name", () => {
    expect(ImageEnlarge.displayName).toBe("ImageEnlarge");
  });

  it("renders the same empty dialog shell in its static fallback and closed island", () => {
    const fallback = renderSsr(<ImageEnlargeSsrFallback />);
    const closed = renderSsr(<ImageEnlarge />);
    expect(fallback).toContain("<dialog");
    expect(fallback).toContain(IMAGE_ENLARGE_DIALOG_CLASS.split(" ")[0]);
    expect(fallback).not.toContain("button");
    expect(fallback).not.toContain("img");
    expect(closed).toContain("<dialog");
    expect(closed).toContain(IMAGE_ENLARGE_DIALOG_CLASS.split(" ")[0]);
    expect(closed).not.toContain("zd-enlarge-dialog-close");
    expect(closed).toBe(fallback);
  });
});

describe("ImageEnlarge — active image dialog", () => {
  it("opens from eligible image content, preserves srcset, closes, and cleans its observers", async () => {
    const { image, button } = pageWithImage();
    const documentAdd = vi.spyOn(document, "addEventListener");
    const documentRemove = vi.spyOn(document, "removeEventListener");
    const windowAdd = vi.spyOn(window, "addEventListener");
    const windowRemove = vi.spyOn(window, "removeEventListener");
    const view = await mountImageEnlarge();
    const observer = ResizeObserverStub.instances[0]!;

    expect(observer.observe).toHaveBeenCalledWith(image);
    expect(button.hasAttribute("hidden")).toBe(false);

    image.click();
    await flushAll();

    const dialog = view.root.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(true);
    const enlarged = dialog.querySelector<HTMLImageElement>("img")!;
    expect(enlarged.getAttribute("src")).toBe(image.src);
    expect(enlarged.getAttribute("srcset")).toBe("/diagram@2x.png 2x");
    expect(enlarged.getAttribute("sizes")).toBe("85vw");
    expect(enlarged.alt).toBe("Example diagram");

    dialog.querySelector<HTMLButtonElement>(".zd-enlarge-dialog-close")!.click();
    await flushAll();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector("img")).toBeNull();

    const clickHandler = documentAdd.mock.calls.find(([type]) => type === "click")?.[1];
    expect(clickHandler).toBeTypeOf("function");
    disposeView(view);
    expect(observer.disconnect).toHaveBeenCalled();
    expect(documentRemove).toHaveBeenCalledWith("click", clickHandler);
    expect(documentRemove).toHaveBeenCalledWith(AFTER_NAVIGATE_EVENT, expect.any(Function));
    expect(windowAdd).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(windowRemove).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("keeps srcset absent for an image without a responsive source", async () => {
    const { image } = pageWithImage();
    image.removeAttribute("srcset");
    await mountImageEnlarge();
    image.click();
    await flushAll();
    const enlarged = document.querySelector<HTMLDialogElement>("dialog")!
      .querySelector<HTMLImageElement>("img")!;
    expect(enlarged.hasAttribute("srcset")).toBe(false);
    expect(enlarged.hasAttribute("sizes")).toBe(false);
  });

  it("reconnects image observers to the swapped content after navigation", async () => {
    pageWithImage();
    const view = await mountImageEnlarge();
    const main = document.querySelector("main")!;
    main.innerHTML = `
      <article class="zd-content">
        <figure class="zd-enlargeable">
          <button class="zd-enlarge-btn" type="button" aria-label="Enlarge image" hidden></button>
          <img src="/next.png" alt="Next page image">
        </figure>
      </article>
    `;
    const nextImage = main.querySelector<HTMLImageElement>("img")!;
    setNaturalSize(nextImage);
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();

    const button = main.querySelector<HTMLButtonElement>(".zd-enlarge-btn")!;
    expect(button.hasAttribute("hidden")).toBe(false);
    expect(ResizeObserverStub.instances[0]!.observe).toHaveBeenCalledWith(nextImage);
    nextImage.click();
    await flushAll();
    expect(view.root.querySelector("dialog")?.open).toBe(true);
  });
});
