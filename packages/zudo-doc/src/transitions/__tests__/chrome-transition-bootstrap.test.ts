import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { buildChromeTransitionBootstrap } from "../chrome-transition-bootstrap.js";
import { BEFORE_SWAP_EVENT } from "../page-events.js";

function documentWith(section = "guides", context = "current:en:automatic:tree") {
  const window = new Window();
  window.document.body.innerHTML = `<header>fresh header</header><aside id="desktop-sidebar"><nav data-sidebar-context="${context}"></nav></aside><main data-zd-nav-section="${section}">article</main>`;
  return window;
}

describe("chrome snapshot policy", () => {
  it("keeps same-category navigation stationary even when persistence is removed", () => {
    const live = documentWith();
    const next = documentWith();
    new Function("document", buildChromeTransitionBootstrap())(live.document);
    const event = new live.Event(BEFORE_SWAP_EVENT);
    Object.assign(event, { newDocument: next.document });
    live.document.dispatchEvent(event);
    expect(next.document.documentElement.getAttribute("data-zd-sidebar-transition")).toBe("stationary");
    expect(live.document.documentElement.hasAttribute("data-zd-sidebar-transition")).toBe(false);
    expect(next.document.querySelector("header")?.textContent).toBe("fresh header");
    expect(next.document.querySelector("aside")?.hasAttribute("data-zfb-transition-persist")).toBe(false);
  });

  it.each([
    ["reference", "current:en:automatic:tree"],
    ["guides", "current:ja:automatic:tree"],
    ["guides", "v1:en:automatic:tree"],
    ["guides", "current:en:custom:other"],
    ["guides", ""],
    ["", "current:en:automatic:tree"],
  ])("isolates section/context %s / %s", (section, context) => {
    const live = documentWith();
    const next = documentWith(section, context);
    // A previous navigation's decision must not survive the next swap.
    next.document.documentElement.setAttribute("data-zd-sidebar-transition", "stationary");
    new Function("document", buildChromeTransitionBootstrap())(live.document);
    const event = new live.Event(BEFORE_SWAP_EVENT);
    Object.assign(event, { newDocument: next.document });
    live.document.dispatchEvent(event);
    expect(next.document.documentElement.getAttribute("data-zd-sidebar-transition")).toBe("changing");
  });

  it("handles absent sidebars and installs once across script re-execution", () => {
    const live = documentWith();
    const next = documentWith();
    next.document.querySelector("aside")?.remove();
    const install = new Function("document", buildChromeTransitionBootstrap());
    install(live.document);
    install(live.document);
    const event = new live.Event(BEFORE_SWAP_EVENT);
    Object.assign(event, { newDocument: next.document });
    live.document.dispatchEvent(event);
    expect(next.document.documentElement.getAttribute("data-zd-sidebar-transition")).toBe("changing");
    expect(() => live.document.dispatchEvent(new live.Event(BEFORE_SWAP_EVENT))).not.toThrow();
  });
});
