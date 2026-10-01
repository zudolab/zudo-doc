/** @vitest-environment happy-dom */
import { afterEach, expect, test } from "vitest";
import { h, signal, getScope } from "@takazudo/zfb/zudo-react";
import { renderSsr, renderIsland, flushAll } from "./zudo-react";

const active: Array<() => void> = [];
afterEach(() => { for (const dispose of active.splice(0)) dispose(); });
const identity = { component: "Counter", build: "harness-test" };

test("server component renders HTML", () => {
  function Server({ value }: { value: string }) { return h("p", null, value); }
  expect(renderSsr(h(Server, { value: "server" }))).toBe("<p>server</p>");
});

test.each(["hydrate", "mount"] as const)("%s activates and handles interaction", async (mode) => {
  const count = signal(0);
  function Counter() {
    return h("button", { "on:click": () => count.value++, type: "button" }, count);
  }
  const view = await renderIsland(Counter, {}, { identity, mode });
  active.push(view.dispose);
  expect(view.diagnostics).toEqual([]);
  expect(view.handle).not.toBeNull();
  expect(view.root.textContent).toBe("0");
  view.root.querySelector("button")!.click();
  await flushAll();
  expect(view.root.textContent).toBe("1");
});

test("hydration preserves a dirty input value", async () => {
  function Input() { return h("input", { value: "server" }); }
  const view = await renderIsland(Input, {}, {
    identity: { component: "Input", build: "test" },
    beforeActivate: (root) => { (root.firstElementChild as HTMLInputElement).value = "typed"; },
  });
  active.push(view.dispose);
  expect(view.diagnostics).toEqual([]);
  expect((view.root.firstElementChild as HTMLInputElement).value).toBe("typed");
});

test("dispose runs activation cleanup", async () => {
  let cleanups = 0;
  function Active() {
    getScope().onActivate(() => () => { cleanups++; });
    return h("p", null, "active");
  }
  const view = await renderIsland(Active, {}, { identity: { component: "Active", build: "test" } });
  expect(view.diagnostics).toEqual([]);
  view.dispose();
  expect(view.handle?.disposed).toBe(true);
  expect(cleanups).toBe(1);
  expect(view.container.isConnected).toBe(false);
});

test("mismatched markup fails closed without replacing the server DOM", async () => {
  function Fixed() { return h("p", null, "expected"); }
  const view = await renderIsland(Fixed, {}, {
    identity: { component: "Fixed", build: "test" },
    beforeActivate: (root) => { root.querySelector("p")!.textContent = "changed"; },
  });
  active.push(view.dispose);
  expect(view.handle).toBeNull();
  expect(view.diagnostics.some((d) => d.code === "ZR_HYDRATION_MISMATCH")).toBe(true);
  expect(view.root.textContent).toBe("changed");
});

test("source resolution imports a public host subpath without dist", async () => {
  const { parseIsoDate } = await import("@takazudo/zudo-doc/format-date");
  expect(parseIsoDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
});
