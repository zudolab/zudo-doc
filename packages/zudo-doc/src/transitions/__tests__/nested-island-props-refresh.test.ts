/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { BEFORE_SWAP_EVENT } from "../page-events.js";
import {
  disposeNestedIslandPropsRefresh,
  ensureNestedIslandPropsRefresh,
  installNestedIslandPropsRefresh,
} from "../nested-island-props-refresh.js";

const PERSIST_ATTR = "data-zfb-transition-persist";
const ISLAND_ATTR = "data-zfb-island";
const PROPS_ATTR = "data-props";
const PROPS_PRESERVE_ATTR = "data-zd-props-preserve";
const REMOUNT_ATTR = "data-zfb-island-remount";

/** Props serialization is opaque to the helper, so any stable string will do. */
const oldTree = '{"nodes":[{"slug":"guides/a"}]}';
const newTree = '{"nodes":[{"slug":"reference/b"}]}';

function setLiveBody(html: string): void {
  document.body.innerHTML = html;
}

/** Mirror the router: the incoming side is a separately parsed Document. */
function parseIncoming(bodyHtml: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${bodyHtml}</body></html>`,
    "text/html",
  );
}

/** Dispatch the REAL `zfb:before-swap` event the router fires. */
function dispatchBeforeSwap(newDocument: unknown): void {
  const event = new Event(BEFORE_SWAP_EVENT);
  Object.assign(event, { newDocument });
  document.dispatchEvent(event);
}

function island(name: string, props?: string): string {
  const propsAttr = props === undefined ? "" : ` ${PROPS_ATTR}='${props}'`;
  return `<div ${ISLAND_ATTR}="${name}"${propsAttr}></div>`;
}

function header(persistKey: string, inner: string): string {
  return `<header ${PERSIST_ATTR}="${persistKey}">${inner}</header>`;
}

function liveIsland(name: string): Element {
  const element = document.querySelector(`[${ISLAND_ATTR}="${name}"]`);
  if (!element) throw new Error(`No live island named ${name}`);
  return element;
}

// The module-level singleton registry and the happy-dom `document` both outlive
// a single test, so every direct install has to be torn down or its listener
// leaks into the next case and quietly refreshes what that case asserts stays
// stale.
const pendingDisposers: Array<() => void> = [];

function install(): () => void {
  const dispose = installNestedIslandPropsRefresh({ document });
  pendingDisposers.push(dispose);
  return dispose;
}

afterEach(() => {
  while (pendingDisposers.length > 0) pendingDisposers.pop()?.();
  disposeNestedIslandPropsRefresh(document);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("nested-island props refresh on zfb:before-swap", () => {
  it("refreshes a nested island inside a persisted root paired by exact key", () => {
    install();
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    dispatchBeforeSwap(
      parseIncoming(header("header-en", island("SidebarToggle", newTree))),
    );

    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(newTree);
  });

  it("flags a refreshed island for remount so an in-flight import re-reads props", () => {
    // zfb's `fire()` snapshots `data-props` BEFORE its dynamic import starts;
    // on resolve it uses that pre-navigation snapshot UNLESS
    // `data-zfb-island-remount` is present. Without the flag, an import in
    // flight across the swap mounts the OLD tree while the DOM attribute looks
    // correct — #3525 reproduces invisibly.
    install();
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    dispatchBeforeSwap(
      parseIncoming(header("header-en", island("SidebarToggle", newTree))),
    );

    expect(liveIsland("SidebarToggle").getAttribute(REMOUNT_ATTR)).toBe("");
  });

  it("does not flag an island whose props are unchanged", () => {
    install();
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    dispatchBeforeSwap(
      parseIncoming(header("header-en", island("SidebarToggle", oldTree))),
    );

    expect(liveIsland("SidebarToggle").hasAttribute(REMOUNT_ATTR)).toBe(false);
  });

  it("pairs roots by key, not by document position", () => {
    install();
    setLiveBody(
      header("header-en", island("SidebarToggle", oldTree)) +
        header("footer-en", island("FooterNav", oldTree)),
    );

    // Incoming emits the same two keys in the OPPOSITE order. Positional
    // matching would cross-assign the footer's props onto the header island.
    dispatchBeforeSwap(
      parseIncoming(
        header("footer-en", island("FooterNav", '{"footer":true}')) +
          header("header-en", island("SidebarToggle", newTree)),
      ),
    );

    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(newTree);
    expect(liveIsland("FooterNav").getAttribute(PROPS_ATTR)).toBe('{"footer":true}');
  });

  it("does not refresh across different locale keys", () => {
    install();
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    // A cross-locale hop: zfb replaces the header outright because the keys
    // differ, so there is nothing for this helper to pair.
    dispatchBeforeSwap(
      parseIncoming(header("header-ja", island("SidebarToggle", newTree))),
    );

    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(oldTree);
  });

  it("skips a live persisted key with no incoming counterpart", () => {
    install();
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    dispatchBeforeSwap(parseIncoming(island("SidebarToggle", newTree)));

    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(oldTree);
  });

  it("skips a persist key duplicated in the live document", () => {
    install();
    setLiveBody(
      header("header-en", island("SidebarToggle", oldTree)) +
        header("header-en", island("ThemeToggle", oldTree)),
    );

    dispatchBeforeSwap(
      parseIncoming(header("header-en", island("SidebarToggle", newTree))),
    );

    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(oldTree);
  });

  it("skips a persist key duplicated in the incoming document", () => {
    install();
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    dispatchBeforeSwap(
      parseIncoming(
        header("header-en", island("SidebarToggle", newTree)) +
          header("header-en", island("SidebarToggle", '{"third":true}')),
      ),
    );

    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(oldTree);
  });

  it("skips a name that appears twice inside one persisted root", () => {
    install();
    setLiveBody(
      header(
        "header-en",
        island("SidebarToggle", oldTree) +
          island("SidebarToggle", oldTree) +
          island("ThemeToggle", '{"mode":"light"}'),
      ),
    );

    // Incoming carries the same duplicate pair in the reverse order, plus a
    // uniquely-named sibling that must still be refreshed.
    dispatchBeforeSwap(
      parseIncoming(
        header(
          "header-en",
          island("SidebarToggle", '{"second":true}') +
            island("SidebarToggle", newTree) +
            island("ThemeToggle", '{"mode":"dark"}'),
        ),
      ),
    );

    const duplicates = document.querySelectorAll(
      `[${ISLAND_ATTR}="SidebarToggle"]`,
    );
    for (const element of duplicates) {
      expect(element.getAttribute(PROPS_ATTR)).toBe(oldTree);
    }
    expect(liveIsland("ThemeToggle").getAttribute(PROPS_ATTR)).toBe('{"mode":"dark"}');
  });

  it("excludes an island that carries its own persist attribute", () => {
    install();
    setLiveBody(
      `<header ${PERSIST_ATTR}="header-en">` +
        `<div ${ISLAND_ATTR}="SearchWidget" ${PERSIST_ATTR}="search" ${PROPS_ATTR}='${oldTree}'></div>` +
        island("SidebarToggle", oldTree) +
        `</header>`,
    );

    dispatchBeforeSwap(
      parseIncoming(
        `<header ${PERSIST_ATTR}="header-en">` +
          `<div ${ISLAND_ATTR}="SearchWidget" ${PERSIST_ATTR}="search" ${PROPS_ATTR}='${newTree}'></div>` +
          island("SidebarToggle", newTree) +
          `</header>`,
      ),
    );

    // zfb's own persisted-island props/remount path owns SearchWidget.
    expect(liveIsland("SearchWidget").getAttribute(PROPS_ATTR)).toBe(oldTree);
    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(newTree);
  });

  it("excludes an island owned by a nested persisted boundary", () => {
    install();
    setLiveBody(
      `<header ${PERSIST_ATTR}="header-en">` +
        island("SidebarToggle", oldTree) +
        `<div ${PERSIST_ATTR}="inner-widget">${island("ThemeToggle", oldTree)}</div>` +
        `</header>`,
    );

    dispatchBeforeSwap(
      parseIncoming(
        `<header ${PERSIST_ATTR}="header-en">` +
          island("SidebarToggle", newTree) +
          `<div ${PERSIST_ATTR}="inner-widget">${island("ThemeToggle", newTree)}</div>` +
          `</header>`,
      ),
    );

    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(newTree);
    // ThemeToggle is unreachable from both directions: the outer root's group
    // stops at the inner boundary, and the inner boundary is itself dropped as
    // a refresh root because it sits inside another persisted element.
    expect(liveIsland("ThemeToggle").getAttribute(PROPS_ATTR)).toBe(oldTree);
  });

  it("preserves an island carrying data-zd-props-preserve", () => {
    install();
    setLiveBody(
      header(
        "header-en",
        `<div ${ISLAND_ATTR}="SearchWidget" ${PROPS_PRESERVE_ATTR} ${PROPS_ATTR}='${oldTree}'></div>`,
      ),
    );

    dispatchBeforeSwap(
      parseIncoming(
        header(
          "header-en",
          `<div ${ISLAND_ATTR}="SearchWidget" ${PROPS_ATTR}='${newTree}'></div>`,
        ),
      ),
    );

    const preserved = liveIsland("SearchWidget");
    expect(preserved.getAttribute(PROPS_ATTR)).toBe(oldTree);
    expect(preserved.hasAttribute(REMOUNT_ATTR)).toBe(false);
  });

  it("preserves an island under a data-zd-props-preserve ancestor within the root", () => {
    install();
    setLiveBody(
      header(
        "header-en",
        `<div ${PROPS_PRESERVE_ATTR}><div ${ISLAND_ATTR}="SearchWidget" ${PROPS_ATTR}='${oldTree}'></div></div>`,
      ),
    );

    dispatchBeforeSwap(
      parseIncoming(
        header(
          "header-en",
          `<div ${PROPS_PRESERVE_ATTR}><div ${ISLAND_ATTR}="SearchWidget" ${PROPS_ATTR}='${newTree}'></div></div>`,
        ),
      ),
    );

    const preserved = liveIsland("SearchWidget");
    expect(preserved.getAttribute(PROPS_ATTR)).toBe(oldTree);
    expect(preserved.hasAttribute(REMOUNT_ATTR)).toBe(false);
  });

  it("preserves every island when the persisted root carries data-zd-props-preserve", () => {
    install();
    setLiveBody(
      `<header ${PERSIST_ATTR}="header-en" ${PROPS_PRESERVE_ATTR}>` +
        island("SearchWidget", oldTree) +
        island("SidebarToggle", oldTree) +
        `</header>`,
    );

    dispatchBeforeSwap(
      parseIncoming(
        `<header ${PERSIST_ATTR}="header-en" ${PROPS_PRESERVE_ATTR}>` +
          island("SearchWidget", newTree) +
          island("SidebarToggle", newTree) +
          `</header>`,
      ),
    );

    for (const name of ["SearchWidget", "SidebarToggle"]) {
      const preserved = liveIsland(name);
      expect(preserved.getAttribute(PROPS_ATTR)).toBe(oldTree);
      expect(preserved.hasAttribute(REMOUNT_ATTR)).toBe(false);
    }
  });

  it("refreshes an island when only an ancestor outside the persisted root is preserved", () => {
    install();
    setLiveBody(
      `<div ${PROPS_PRESERVE_ATTR}>${header("header-en", island("SearchWidget", oldTree))}</div>`,
    );

    dispatchBeforeSwap(
      parseIncoming(
        `<div ${PROPS_PRESERVE_ATTR}>${header("header-en", island("SearchWidget", newTree))}</div>`,
      ),
    );

    expect(liveIsland("SearchWidget").getAttribute(PROPS_ATTR)).toBe(newTree);
    expect(liveIsland("SearchWidget").getAttribute(REMOUNT_ATTR)).toBe("");
  });

  it("refreshes sibling islands without data-zd-props-preserve", () => {
    install();
    setLiveBody(
      header(
        "header-en",
        `<div ${ISLAND_ATTR}="SearchWidget" ${PROPS_PRESERVE_ATTR} ${PROPS_ATTR}='${oldTree}'></div>` +
          island("SidebarToggle", oldTree),
      ),
    );

    dispatchBeforeSwap(
      parseIncoming(
        header(
          "header-en",
          `<div ${ISLAND_ATTR}="SearchWidget" ${PROPS_PRESERVE_ATTR} ${PROPS_ATTR}='${newTree}'></div>` +
            island("SidebarToggle", newTree),
        ),
      ),
    );

    expect(liveIsland("SearchWidget").getAttribute(PROPS_ATTR)).toBe(oldTree);
    expect(liveIsland("SearchWidget").hasAttribute(REMOUNT_ATTR)).toBe(false);
    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(newTree);
    expect(liveIsland("SidebarToggle").getAttribute(REMOUNT_ATTR)).toBe("");
  });

  it("refreshes normally when data-zd-props-preserve exists only on the incoming side", () => {
    install();
    setLiveBody(header("header-en", island("SearchWidget", oldTree)));

    dispatchBeforeSwap(
      parseIncoming(
        header(
          "header-en",
          `<div ${ISLAND_ATTR}="SearchWidget" ${PROPS_PRESERVE_ATTR} ${PROPS_ATTR}='${newTree}'></div>`,
        ),
      ),
    );

    expect(liveIsland("SearchWidget").getAttribute(PROPS_ATTR)).toBe(newTree);
    expect(liveIsland("SearchWidget").getAttribute(REMOUNT_ATTR)).toBe("");
  });

  it("removes data-props when the incoming island has none", () => {
    install();
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    dispatchBeforeSwap(
      parseIncoming(header("header-en", island("SidebarToggle"))),
    );

    expect(liveIsland("SidebarToggle").hasAttribute(PROPS_ATTR)).toBe(false);
  });

  it("does not touch the attribute when the props are unchanged", () => {
    install();
    const themeProps = '{"defaultMode":"light"}';
    setLiveBody(
      header(
        "header-en",
        island("SidebarToggle", oldTree) + island("ThemeToggle", themeProps),
      ),
    );

    // ThemeToggle's props are page-independent, so a swap re-serializes the
    // identical string — that must not produce an attribute write.
    const themeToggle = liveIsland("ThemeToggle");
    const setAttribute = vi.spyOn(themeToggle, "setAttribute");
    const removeAttribute = vi.spyOn(themeToggle, "removeAttribute");

    dispatchBeforeSwap(
      parseIncoming(
        header(
          "header-en",
          island("SidebarToggle", newTree) + island("ThemeToggle", themeProps),
        ),
      ),
    );

    expect(setAttribute).not.toHaveBeenCalled();
    expect(removeAttribute).not.toHaveBeenCalled();
    expect(themeToggle.getAttribute(PROPS_ATTR)).toBe(themeProps);
    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(newTree);
  });

  it("ignores an event whose newDocument is missing, foreign, or the live document", () => {
    install();
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    dispatchBeforeSwap(undefined);
    dispatchBeforeSwap(null);
    dispatchBeforeSwap({ querySelectorAll: () => [] });
    dispatchBeforeSwap(document);

    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(oldTree);
  });

  it("stops refreshing after the installer's disposer runs", () => {
    const dispose = install();
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    dispose();
    dispatchBeforeSwap(
      parseIncoming(header("header-en", island("SidebarToggle", newTree))),
    );

    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(oldTree);
  });
});

describe("ensureNestedIslandPropsRefresh", () => {
  it("installs exactly one listener however many times it is called", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");

    ensureNestedIslandPropsRefresh({ document });
    ensureNestedIslandPropsRefresh({ document });
    ensureNestedIslandPropsRefresh({ document });

    const registrations = addEventListener.mock.calls.filter(
      ([type]) => type === BEFORE_SWAP_EVENT,
    );
    expect(registrations).toHaveLength(1);
  });

  it("still refreshes after repeated installation, and only once per island", () => {
    ensureNestedIslandPropsRefresh({ document });
    ensureNestedIslandPropsRefresh({ document });
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    const target = liveIsland("SidebarToggle");
    const setAttribute = vi.spyOn(target, "setAttribute");

    dispatchBeforeSwap(
      parseIncoming(header("header-en", island("SidebarToggle", newTree))),
    );

    const propsWrites = setAttribute.mock.calls.filter(([name]) => name === PROPS_ATTR);
    expect(propsWrites).toHaveLength(1);
    expect(target.getAttribute(PROPS_ATTR)).toBe(newTree);
  });

  it("can be disposed and re-installed", () => {
    ensureNestedIslandPropsRefresh({ document });
    setLiveBody(header("header-en", island("SidebarToggle", oldTree)));

    disposeNestedIslandPropsRefresh(document);
    dispatchBeforeSwap(
      parseIncoming(header("header-en", island("SidebarToggle", newTree))),
    );
    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(oldTree);

    ensureNestedIslandPropsRefresh({ document });
    dispatchBeforeSwap(
      parseIncoming(header("header-en", island("SidebarToggle", newTree))),
    );
    expect(liveIsland("SidebarToggle").getAttribute(PROPS_ATTR)).toBe(newTree);
  });

  it("disposing a document that was never installed is a no-op", () => {
    expect(() => disposeNestedIslandPropsRefresh(document)).not.toThrow();
  });

  it("is reachable from the transitions barrel", async () => {
    // `sidebar-toggle-island` is ejectable, and eject rewrites its
    // `../transitions/nested-island-props-refresh.js` import to
    // `@takazudo/zudo-doc/transitions`. If the barrel stops re-exporting this,
    // every ejected project's drawer silently loses the refresh.
    const barrel = await import("../index.js");
    expect(barrel.ensureNestedIslandPropsRefresh).toBe(
      ensureNestedIslandPropsRefresh,
    );
  });
});
