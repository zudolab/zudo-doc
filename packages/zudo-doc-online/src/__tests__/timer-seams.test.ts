// @vitest-environment jsdom
/**
 * Cross-cutting guard: no class in this package may store a BARE global timer
 * function on a field.
 *
 * `this.scheduleTimeout = options.scheduleTimeout ?? setTimeout` looks
 * harmless and passes every existing spec, but the field is later invoked as
 * `this.scheduleTimeout(...)` — a method call, so `this` inside is the class
 * instance. Browsers implement `setTimeout`/`setInterval` as Web IDL
 * operations on `WindowOrWorkerGlobalScope` and reject a foreign `this` with
 * `TypeError: Illegal invocation`. In Chrome that fires on every editor
 * keystroke: the save chip never arms, nothing persists, and because the
 * ticker runs inside CodeMirror's update listener the throw aborts the update
 * so the preview never publishes either.
 *
 * Node and jsdom implement those functions as plain functions that ignore
 * `this`, which is exactly why a green suite proved nothing here. These specs
 * install a Web IDL-strict shim that DOES check `this`, reproducing the Chrome
 * failure in node — so each class is driven through its real default path with
 * no timer seam injected, and must not throw.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { PageSaveMachine } from "../store/save-machine";
import type { PagePayload, ProjectStore } from "../store/contract";
import { EditorContentTicker } from "../features/editor/use-editor-content";
import { PreviewRenderLoop } from "../features/preview/render-runtime";
import { PopoutRegistry } from "../features/popout/popout-registry";

type GlobalTimerName =
  | "setTimeout"
  | "clearTimeout"
  | "setInterval"
  | "clearInterval";

const TIMER_NAMES: GlobalTimerName[] = [
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
];

const originals = new Map<GlobalTimerName, unknown>();

/**
 * Replaces the global timer functions with versions that enforce the `this`
 * binding a browser enforces. A plain call (`setTimeout(cb, ms)`) leaves
 * `this` undefined in a module's strict-mode scope and is accepted; a call
 * through a field (`this.scheduleTimeout(cb, ms)`) passes the owning instance
 * and throws, exactly as Chrome does.
 */
function installStrictTimers(): void {
  for (const name of TIMER_NAMES) {
    const real = globalThis[name] as (...args: unknown[]) => unknown;
    originals.set(name, real);
    const strict = function (this: unknown, ...args: unknown[]): unknown {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return real(...args);
    };
    (globalThis as Record<string, unknown>)[name] = strict;
  }
}

function restoreTimers(): void {
  for (const [name, real] of originals) {
    (globalThis as Record<string, unknown>)[name] = real;
  }
  originals.clear();
}

afterEach(() => {
  restoreTimers();
});

/** Proves the shim reproduces the bug, so a passing spec below means something. */
describe("strict-timer shim", () => {
  it("throws Illegal invocation for a bare global stored on a field", () => {
    installStrictTimers();
    const holder = { schedule: globalThis.setTimeout };

    expect(() => holder.schedule(() => undefined, 0)).toThrow("Illegal invocation");
  });

  it("accepts a wrapped call", () => {
    installStrictTimers();
    const holder = {
      schedule: (callback: () => void, ms: number) => setTimeout(callback, ms),
    };

    const handle = holder.schedule(() => undefined, 0);
    clearTimeout(handle);
  });
});

describe("default timer seams survive a browser-strict `this` check", () => {
  const page: PagePayload = {
    id: "page-1",
    slug: "intro",
    categoryId: "cat-1",
    revision: 1,
    frontmatter: { title: "Intro" },
    markdown: "Hello\n",
    warnings: [],
  };

  it("PageSaveMachine arms its autosave debounce", () => {
    installStrictTimers();
    const store: ProjectStore = {
      loadSnapshot: vi.fn(),
      applyOutlineCommand: vi.fn(),
      loadPage: vi.fn(),
      savePage: vi.fn(),
    };
    // No scheduleTimeout/clearTimeoutImpl injected — the default path is what
    // the browser actually runs, and the only path this spec is about.
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: page });

    expect(() => machine.edit({ markdown: "Typed\n" })).not.toThrow();
    machine.dispose();
  });

  it("EditorContentTicker publishes", () => {
    installStrictTimers();
    // A fresh instance, not the module singleton: the singleton is constructed
    // at import time, before the shim is installed, so it would capture the
    // real global either way and prove nothing.
    const ticker = new EditorContentTicker();

    expect(() =>
      ticker.publish({ pageId: "page-1", markdown: "Typed\n", token: 1 }),
    ).not.toThrow();
  });

  it("PreviewRenderLoop schedules a render", () => {
    installStrictTimers();
    const loop = new PreviewRenderLoop({ render: async () => "<p>ok</p>" });

    expect(() => loop.schedule("Typed\n")).not.toThrow();
    loop.reset();
  });

  it("PopoutRegistry starts its close poll", () => {
    installStrictTimers();
    const registry = new PopoutRegistry({
      windowOpener: () => ({ closed: false, close: () => undefined }),
      channel: null,
    });

    expect(() => registry.open("proj-a", "page-1")).not.toThrow();
    registry.dispose();
  });
});
