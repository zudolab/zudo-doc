/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Real-DOM regression tests for the enlarge-button injection loop
 * (zudolab/zudo-doc#3132 — "mermaid enlarge broken").
 *
 * Mermaid diagrams render client-side, so unlike images (SSR-wrapped in
 * `figure.zd-enlargeable`) the enlarge button is injected into the diagram
 * container by this island. The mermaid init script's re-render path
 * (`reinitMermaid` in code-syntax/mermaid-init-script.ts) restores each
 * diagram from its cached source with `el.textContent = src`, which deletes
 * every child of the container — the injected button included. The island
 * used to guard injection on the `data-mermaid-enlarge-ready` attribute,
 * which survives that wipe, so the button never came back: on a full page
 * load the design-token panel re-applies persisted `:root` overrides after
 * first paint, the mermaid observer re-renders, and both the button and the
 * `:has(.zd-enlarge-btn)` border affordance vanished for the rest of the
 * page's life. Soft navigation re-applies identical values, so its gate
 * (#2181) no-ops and the button survived — hence "works on arrival, gone
 * after reload".
 *
 * These tests replay the DOM sequence the init script produces; they do not
 * load mermaid itself.
 */

import { afterEach, describe, expect, it } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import { MermaidEnlarge } from "../index.js";

const DIAGRAM_SOURCE = "graph LR\n  A[Start] --> B[End]";
const RENDERED_SVG = '<svg class="flowchart"><g></g></svg>';

/** Build the SSG shape a doc page ships: `main > .zd-content > div.mermaid`. */
function mountPage(): { container: HTMLElement; islandHost: HTMLElement } {
  document.body.innerHTML = `
    <main>
      <article class="zd-content">
        <div class="mermaid" data-mermaid>${DIAGRAM_SOURCE}</div>
      </article>
    </main>
    <div id="island-host"></div>
  `;
  const container = document.querySelector<HTMLElement>(".mermaid");
  const islandHost = document.querySelector<HTMLElement>("#island-host");
  if (!container || !islandHost) throw new Error("fixture markup did not mount");
  return { container, islandHost };
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
 * then drop the render markers so the next init pass regenerates.
 */
function simulateMermaidReinit(container: HTMLElement): void {
  const src = container.getAttribute("data-mermaid-src");
  if (src !== null) container.textContent = src;
  container.querySelector("svg")?.remove();
  container.removeAttribute("data-processed");
  container.removeAttribute("data-mermaid-rendered");
}

/** MutationObserver callbacks are microtasks — let them flush. */
async function flushObservers(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function enlargeButton(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(":scope > .zd-enlarge-btn");
}

afterEach(() => {
  const host = document.querySelector("#island-host");
  if (host) render(null, host);
  document.body.innerHTML = "";
});

describe("MermaidEnlarge — enlarge-button injection", () => {
  it("injects the button when the diagram renders after the island mounts", async () => {
    const { container, islandHost } = mountPage();
    act(() => {
      render(<MermaidEnlarge />, islandHost);
    });
    expect(enlargeButton(container)).toBeNull();

    simulateMermaidRender(container);
    await flushObservers();

    expect(enlargeButton(container)).not.toBeNull();
    expect(container.classList.contains("zd-mermaid-enlargeable")).toBe(true);
  });

  it("injects the button when the diagram already rendered before the island mounts", async () => {
    const { container, islandHost } = mountPage();
    simulateMermaidRender(container);

    act(() => {
      render(<MermaidEnlarge />, islandHost);
    });
    await flushObservers();

    expect(enlargeButton(container)).not.toBeNull();
  });

  it("does not inject a second button on a repeat scan", async () => {
    const { container, islandHost } = mountPage();
    act(() => {
      render(<MermaidEnlarge />, islandHost);
    });
    simulateMermaidRender(container);
    await flushObservers();
    // Any extra mutation inside the scope triggers another scan pass.
    container.setAttribute("data-mermaid-rendered", "");
    await flushObservers();

    expect(container.querySelectorAll(":scope > .zd-enlarge-btn")).toHaveLength(1);
  });

  it("re-injects the button after a theme re-render wipes it (#3132)", async () => {
    const { container, islandHost } = mountPage();
    act(() => {
      render(<MermaidEnlarge />, islandHost);
    });
    simulateMermaidRender(container);
    await flushObservers();
    expect(enlargeButton(container)).not.toBeNull();

    // The re-render restores the cached source, deleting the button. The
    // `data-mermaid-enlarge-ready` attribute survives — that is exactly what
    // used to make the loss permanent.
    simulateMermaidReinit(container);
    await flushObservers();
    expect(enlargeButton(container)).toBeNull();
    expect(container.hasAttribute("data-mermaid-enlarge-ready")).toBe(true);

    simulateMermaidRender(container);
    await flushObservers();

    expect(enlargeButton(container)).not.toBeNull();
  });

  it("survives repeated theme re-renders", async () => {
    const { container, islandHost } = mountPage();
    act(() => {
      render(<MermaidEnlarge />, islandHost);
    });
    simulateMermaidRender(container);
    await flushObservers();

    for (let i = 0; i < 3; i++) {
      simulateMermaidReinit(container);
      await flushObservers();
      simulateMermaidRender(container);
      await flushObservers();
    }

    expect(container.querySelectorAll(":scope > .zd-enlarge-btn")).toHaveLength(1);
  });
});
