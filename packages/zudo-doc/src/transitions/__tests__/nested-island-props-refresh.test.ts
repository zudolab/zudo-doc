/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { h, signal, flush } from "@takazudo/zfb/zudo-react";
import { islandRoot, renderToString } from "@takazudo/zfb/zudo-react/server";
import { mountIslands, unmountIslands, mountNewIslands, cancelPendingIslands } from "@takazudo/zfb/runtime";
import { swapFunctions } from "@takazudo/zfb-runtime/client-router";
import { BEFORE_SWAP_EVENT } from "../page-events.js";
import { installNestedIslandPropsRefresh, ensureNestedIslandPropsRefresh, disposeNestedIslandPropsRefresh } from "../nested-island-props-refresh.js";

const PERSIST = "data-zfb-transition-persist";
const ROOT = 'data-zfb-island="Counter" data-zfb-transport="json/1" data-zfb-protocol="zudo-react/1" data-zfb-build="test"';
const oldProps = '{"value":"old"}';
const newProps = '{"value":"new"}';
const island = (props = oldProps, extra = "") => `<div ${ROOT} data-props='${props}' ${extra}><button>old</button></div>`;
const header = (body: string, attrs = "") => `<header ${PERSIST}="header" ${attrs}>${body}</header>`;
const aside = (body: string) => `<aside id="desktop-sidebar" ${PERSIST}="aside">${body}</aside>`;
const incoming = (body: string) => new DOMParser().parseFromString(`<!doctype html><html><body>${body}</body></html>`, "text/html");
const root = (doc: Document = document) => doc.querySelector('[data-zfb-island="Counter"]')!;
const disposers: Array<() => void> = [];
function install() { disposers.push(installNestedIslandPropsRefresh({ document })); }
function prepare(next: Document, delegate: (...args: unknown[]) => unknown = () => undefined) {
  const event = new Event(BEFORE_SWAP_EVENT) as Event & { newDocument: Document; swap: (...args: unknown[]) => unknown };
  event.newDocument = next;
  event.swap = delegate;
  document.dispatchEvent(event);
  return event;
}
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  disposeNestedIslandPropsRefresh(document);
  unmountIslands(document.body);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("zfb 3.1 persisted chrome preparation", () => {
  it("leaves live DOM untouched on cancellation and preserves original swap receiver, args, result and throw", () => {
    install(); document.body.innerHTML = header(island());
    const live = root();
    const next = incoming(header(island(newProps)));
    const receiver = { value: 1 };
    const delegate = vi.fn(function (this: unknown, arg: unknown) { return { receiver: this, arg }; });
    const event = prepare(next, delegate);
    expect(root()).toBe(live);
    expect(live.getAttribute("data-props")).toBe(oldProps);
    const result = Reflect.apply(event.swap, receiver, [42]);
    expect(result).toEqual({ receiver, arg: 42 });
    expect(Reflect.apply(event.swap, receiver, [99])).toBe(result);
    expect(delegate).toHaveBeenCalledOnce();
    const error = new Error("delegate");
    const failing = prepare(incoming(header(island())), () => { throw error; });
    expect(() => failing.swap()).toThrow(error);
    expect(() => failing.swap()).toThrow(error);
  });

  it("copies host-preserved exact props only into a detached incoming root with identical identity", () => {
    install(); document.body.innerHTML = header(island(oldProps, "data-zd-props-preserve"));
    const next = incoming(header(island(newProps)));
    prepare(next);
    expect(root(next).getAttribute("data-props")).toBe(oldProps);
    expect(root().getAttribute("data-props")).toBe(oldProps);
    expect(root().hasAttribute("data-zfb-island-remount")).toBe(false);
    const changed = incoming(header(island(newProps).replace('data-zfb-build="test"', 'data-zfb-build="other"')));
    prepare(changed);
    expect(root(changed).getAttribute("data-props")).toBe(newProps);
  });

  it("honors preserve on header and aside ancestors, including absent props", () => {
    install(); document.body.innerHTML = header(island(), "data-zd-props-preserve") + aside(island());
    root().removeAttribute("data-props");
    document.querySelector("aside")!.setAttribute("data-zd-props-preserve", "");
    const next = incoming(header(island(newProps)) + aside(island(newProps)));
    prepare(next);
    expect(next.querySelector("header [data-zfb-island]")!.hasAttribute("data-props")).toBe(false);
    expect(next.querySelector("aside [data-zfb-island]")!.getAttribute("data-props")).toBe(oldProps);
  });

  it("opts unsafe incoming ancestors out of persistence for duplicate keys/names, additions, removals and structure changes", () => {
    install(); document.body.innerHTML = header(island());
    const bodies = [
      header(island() + island()),
      header("<p>new</p>" + island()),
      header(""),
      header(island()) + header(island()),
    ];
    for (const body of bodies) {
      const next = incoming(body);
      prepare(next);
      expect(next.querySelector("header")!.hasAttribute(PERSIST)).toBe(false);
    }
    document.body.innerHTML = header(island()) + header(island());
    const ambiguousLiveMatch = incoming(header(island()));
    prepare(ambiguousLiveMatch);
    expect(ambiguousLiveMatch.querySelector("header")!.hasAttribute(PERSIST)).toBe(false);
    document.body.innerHTML = header(island());
    const added = incoming(header(island() + '<div data-zfb-island="Extra"></div>'));
    prepare(added);
    expect(added.querySelector("header")!.hasAttribute(PERSIST)).toBe(false);
  });

  it("keeps a unique incoming persist boundary when there is no live counterpart", () => {
    install(); document.body.innerHTML = header(island());
    const next = incoming(header(island()) + `<aside id="desktop-sidebar" ${PERSIST}="sidebar-en-guides">${island()}</aside>`);

    prepare(next);

    expect(document.querySelector('[data-zfb-transition-persist="sidebar-en-guides"]')).toBeNull();
    expect(next.querySelector('[data-zfb-transition-persist="sidebar-en-guides"]')).not.toBeNull();
    expect(next.querySelector("header")!.hasAttribute(PERSIST)).toBe(true);
  });

  it("opts out when scheduling metadata is added, changed or removed, including skip SSR", () => {
    install(); document.body.innerHTML = header(island(oldProps, 'data-when="visible" data-media="screen"'));
    for (const extra of ['', 'data-when="idle" data-media="screen"', 'data-when="visible"']) {
      const next = incoming(header(island(newProps, extra)));
      prepare(next);
      expect(next.querySelector("header")!.hasAttribute(PERSIST)).toBe(false);
    }
    document.body.innerHTML = header('<div data-zfb-island-skip-ssr="Counter" data-when="visible"></div>');
    const next = incoming(header('<div data-zfb-island-skip-ssr="Counter" data-when="visible"></div>'));
    prepare(next);
    expect(next.querySelector("header")!.hasAttribute(PERSIST)).toBe(true);
  });

  it("keeps a mutated unchanged live handle and scope state through packed native teardown and swap", async () => {
    install();
    const identity = { component: "Counter", build: "test" };
    let count: ReturnType<typeof signal<number>> | undefined;
    let activations = 0;
    let cleanups = 0;
    function Counter() {
      count = signal(0);
      return h("button", { "on:click": () => { count!.value++; } }, count);
    }
    const node = h(Counter, {});
    const html = renderToString(islandRoot(node, { identity }));
    document.body.innerHTML = header(html);
    const { hydrate, mount } = await import("@takazudo/zfb/zudo-react/client");
    mountIslands({ Counter: { identity, mount(_props, element, mode) {
      activations++;
      const handle = mode === "render" ? mount(node, element, { identity }) : hydrate(node, element, { identity });
      return handle && { protocol: "zudo-react/1" as const, identity, get disposed() { return handle.disposed; }, dispose() { cleanups++; handle.dispose(); }, unmount() { cleanups++; handle.unmount(); } };
    } } });
    const button = document.querySelector("button")!;
    button.dispatchEvent(new Event("click")); await flush();
    expect(button.textContent).toBe("1");
    const next = incoming(header(html));
    prepare(next);
    unmountIslands(document.body, next.body);
    swapFunctions.swapBodyElement(next.body, document.body);
    mountNewIslands();
    expect(document.querySelector("button")).toBe(button);
    expect(activations).toBe(1);
    expect(cleanups).toBe(0);
    button.dispatchEvent(new Event("click")); await flush();
    expect(button.textContent).toBe("2");
  });

  it("provides an idempotent eager document singleton", () => {
    const spy = vi.spyOn(document, "addEventListener");
    ensureNestedIslandPropsRefresh({ document });
    ensureNestedIslandPropsRefresh({ document });
    expect(spy.mock.calls.filter(([name]) => name === BEFORE_SWAP_EVENT)).toHaveLength(1);
  });
});

describe("packed native changed-root lifecycle", () => {
  it("recreates changed props with render and disposes the old scope", async () => {
    install();
    const identity = { component: "Counter", build: "props-case" };
    let activations = 0;
    let cleanups = 0;
    const modes: string[] = [];
    function Counter({ value }: { value: string }) { return h("button", {}, value); }
    const ssr = (value: string) => renderToString(islandRoot(h(Counter, { value }), { identity }));
    document.body.innerHTML = header(ssr("old"));
    const { hydrate, mount } = await import("@takazudo/zfb/zudo-react/client");
    mountIslands({ Counter: { identity, mount(props, element, mode) {
      activations++; modes.push(mode);
      const node = h(Counter, { value: props.value as string });
      const handle = mode === "render" ? mount(node, element, { identity }) : hydrate(node, element, { identity });
      return handle && { protocol: "zudo-react/1" as const, identity, get disposed() { return handle.disposed; }, dispose() { cleanups++; handle.dispose(); }, unmount() { cleanups++; handle.unmount(); } };
    } } });
    const oldButton = document.querySelector("button")!;
    const next = incoming(header(ssr("new")));
    prepare(next);
    unmountIslands(document.body, next.body);
    swapFunctions.swapBodyElement(next.body, document.body);
    mountNewIslands(); await flush();
    expect(document.querySelector("button")!.textContent).toBe("new");
    expect(document.querySelector("button")).not.toBe(oldButton);
    expect(modes).toEqual(["hydrate", "render"]);
    expect(activations).toBe(2);
    expect(cleanups).toBe(1);
  });
});


describe("deferred native mount across a swap", () => {
  it("cancels an old idle mount and reads the incoming exact props when the new schedule fires", async () => {
    vi.useFakeTimers();
    install();
    const identity = { component: "Counter", build: "deferred-case" };
    const seen: string[] = [];
    function Counter({ value }: { value: string }) { return h("span", {}, value); }
    const ssr = (value: string) => renderToString(islandRoot(h(Counter, { value }), { identity }));
    document.body.innerHTML = header(ssr("old").replace("data-zfb-island=", 'data-when="idle" data-zfb-island='));
    mountIslands({ Counter: { identity, mount(props) {
      seen.push(String(props.value));
      return { protocol: "zudo-react/1" as const, identity, disposed: false, dispose() {}, unmount() {} };
    } } });
    const next = incoming(header(ssr("new").replace("data-zfb-island=", 'data-when="idle" data-zfb-island=')));
    prepare(next);
    const old = root();
    cancelPendingIslands();
    unmountIslands(document.body, next.body);
    swapFunctions.swapBodyElement(next.body, document.body);
    mountNewIslands();
    await vi.runAllTimersAsync();
    expect(root()).toBe(old);
    // The new wrapper's serialized props are the source of truth after cancel.
    expect(seen).toEqual(["new"]);
  });
});

describe("packed marker-kind change", () => {
  it("recreates a normal root as skip SSR in render mode", async () => {
    install();
    const identity = { component: "Counter", build: "kind-case" };
    const modes: string[] = [];
    function Counter() { return h("strong", {}, "mounted"); }
    const node = h(Counter, {});
    const html = renderToString(islandRoot(node, { identity }));
    document.body.innerHTML = header(html);
    const { hydrate, mount } = await import("@takazudo/zfb/zudo-react/client");
    mountIslands({ Counter: { identity, mount(_props, element, mode) {
      modes.push(mode);
      return mode === "render" ? mount(node, element, { identity }) : hydrate(node, element, { identity });
    } } });
    const next = incoming(header(html.replace('data-zfb-island="Counter"', 'data-zfb-island-skip-ssr="Counter"')));
    prepare(next);
    unmountIslands(document.body, next.body);
    swapFunctions.swapBodyElement(next.body, document.body);
    mountNewIslands(); await flush();
    expect(modes).toEqual(["hydrate", "render"]);
    expect(document.querySelector("strong")?.textContent).toBe("mounted");
    expect(document.querySelector("header")!.hasAttribute(PERSIST)).toBe(true);
  });
});
