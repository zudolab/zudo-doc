/** @vitest-environment happy-dom */
import "../../__tests__/fixtures/install-island-metadata.js";
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { h } from "@takazudo/zfb/zudo-react";
import { renderIsland, renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { createDocPageShell } from "../index.js";
import { normalizeIslandData } from "../../chrome/derive.js";

describe("full document composition on zudo-react", () => {
  it("renders the page body and scanner metadata on every island wrapper", () => {
    const DocPageShell = createDocPageShell(makeFakeChromeContext());
    const html = renderSsr(
      <DocPageShell
        kind="entry"
        locale="en"
        slug="guides/overview"
        title="Overview"
        description="A complete document"
        breadcrumbs={[{ label: "Guides", href: "/docs/guides" }, { label: "Overview" }]}
        prev={null}
        next={null}
        headings={[{ depth: 2, slug: "first", text: "First" }]}
        navSection="guides"
        sidebarPersistKey="sidebar-en-guides"
        currentPath="/docs/guides/overview"
        versionSwitcher={null}
        contentHeaderSlot={<><h1>Overview</h1><p data-meta-proof>Created today</p></>}
        contentSlot={<section id="body-proof"><h2 id="first">First</h2><p>Document body</p></section>}
        docHistorySlot={<div data-history-proof>History</div>}
      />,
    );
    const document = new Window().document;
    document.documentElement.innerHTML = html;
    expect(document.querySelector("#body-proof")?.textContent).toContain("Document body");
    expect(document.querySelector("[data-meta-proof]")?.textContent).toContain("Created today");
    expect(document.querySelector("[data-history-proof]")?.textContent).toContain("History");
    const wrappers = [...document.querySelectorAll("[data-zfb-island], [data-zfb-island-skip-ssr]")];
    expect(wrappers.length).toBeGreaterThan(0);
    for (const wrapper of wrappers) {
      expect(wrapper.getAttribute("data-zfb-transport")).toBe("json/1");
      expect(wrapper.getAttribute("data-zfb-protocol")).toBe("zudo-react/1");
      expect(wrapper.getAttribute("data-zfb-build")).toBe("4464-doc-composition-test");
      expect(wrapper.hasAttribute("data-props")).toBe(true);
      expect(wrapper.closest("[data-zfb-island] [data-zfb-island], [data-zfb-island-skip-ssr] [data-zfb-island-skip-ssr]")).toBeNull();
    }
  });

  it("copies optional records before transport without changing source own keys", () => {
    const source = { nodes: [{ slug: "one", description: undefined, nested: { value: null, omitted: undefined } }], optional: undefined };
    const normalized = normalizeIslandData(source);
    expect(Object.hasOwn(source, "optional")).toBe(true);
    expect(Object.hasOwn(source.nodes[0]!, "description")).toBe(true);
    expect(Object.hasOwn(normalized, "optional")).toBe(false);
    expect(Object.hasOwn(normalized.nodes[0]!, "description")).toBe(false);
    expect(normalized.nodes[0]?.nested).toEqual({ value: null });
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized);
  });

  it("gives SSR and hydration the same normalized own keys", async () => {
    type Props = { nested: { value: null; omitted?: string }; optional?: string };
    const Probe = (props: Props) => <span data-own-keys={Object.keys(props).join(",")} data-nested-keys={Object.keys(props.nested).join(",")}>{String(props.nested.value)}</span>;
    const source = { nested: { value: null, omitted: undefined }, optional: undefined };
    const props = normalizeIslandData(source);
    const ssr = renderSsr(h(Probe, props));
    expect(ssr).toContain('data-own-keys="nested"');
    expect(ssr).toContain('data-nested-keys="value"');
    const view = await renderIsland(Probe, props, { identity: { component: "Probe", build: "4464-props-test" } });
    try {
      expect(view.diagnostics).toEqual([]);
      expect(view.root.querySelector("[data-own-keys]")?.getAttribute("data-own-keys")).toBe("nested");
      expect(view.root.querySelector("[data-nested-keys]")?.getAttribute("data-nested-keys")).toBe("value");
      expect(Object.hasOwn(source, "optional")).toBe(true);
    } finally {
      view.dispose();
    }
  });

  it("rejects invalid arrays and runtime values at the same boundary", () => {
    expect(() => normalizeIslandData({ items: [undefined] })).toThrow(/Invalid island data/);
    expect(() => normalizeIslandData({ items: new Array(1) })).toThrow(/Sparse island array/);
    expect(() => normalizeIslandData({ date: new Date() })).toThrow(/Invalid island record/);
    expect(() => normalizeIslandData({ callback: () => null })).toThrow(/Invalid island data/);
    const extraArray = ["valid"] as string[] & { extra?: string };
    extraArray.extra = "invalid";
    expect(() => normalizeIslandData({ extraArray })).toThrow(/Invalid island array key/);
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => normalizeIslandData(cyclic)).toThrow(/Cyclic island data/);
    const withGetter = Object.defineProperty({}, "danger", { enumerable: true, get: () => 1 });
    expect(() => normalizeIslandData(withGetter)).toThrow(/Accessor island data/);
  });
});
