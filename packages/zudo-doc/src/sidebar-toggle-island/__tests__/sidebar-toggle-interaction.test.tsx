/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import {
  mountIslands,
  mountNewIslands,
  unmountIslands,
} from "@takazudo/zfb/runtime";
import { h } from "@takazudo/zfb/zudo-react";
import { islandRoot, renderToString } from "@takazudo/zfb/zudo-react/server";
import { swapFunctions } from "@takazudo/zfb-runtime/client-router";
import { renderIsland, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { disposeSidebarScrollPreserve } from "../../sidebar-tree-island/sidebar-scroll-preserve.js";
import { buildSidebarNavigation } from "../../sidebar-utils/index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";
import { BEFORE_SWAP_EVENT } from "../../transitions/page-events.js";
import { SidebarToggle, type SidebarToggleProps } from "../index.js";

const NODES: SidebarNavNode[] = [
  {
    slug: "introduction",
    label: "Introduction",
    position: 0,
    href: "/docs/introduction",
    hasPage: true,
    children: [],
  },
];

const PROPS: SidebarToggleProps = { nodes: NODES };
const DRAWER_IDENTITY = { component: "SidebarToggle", build: "persist-test" } as const;
let view:
  | Awaited<ReturnType<typeof renderIsland<SidebarToggleProps>>>
  | undefined;

async function mount(props: SidebarToggleProps = PROPS) {
  view = await renderIsland(SidebarToggle, props, {
    identity: { component: "SidebarToggle", build: "test" },
  });
  expect(view.diagnostics).toEqual([]);
  return view;
}

function click(element: Element | null): void {
  expect(element).not.toBeNull();
  // Runtime-level client-router listeners are also present in the persisted
  // swap case below; a target-only click keeps these component interactions
  // independent of anchor/router delegation.
  element!.dispatchEvent(
    new MouseEvent("click", { bubbles: false, cancelable: true }),
  );
}

function pressEscape(
  target: EventTarget = document,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  view?.dispose();
  view = undefined;
  unmountIslands(document.body);
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  sessionStorage.clear();
  disposeSidebarScrollPreserve(document);
});

describe("SidebarToggle — hydrated interaction", () => {
  it("opens and closes the drawer, locks body scrolling, and restores focus after Escape", async () => {
    const { root } = await mount();
    const hamburger = root.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
    const [closeIcon, menuIcon] = hamburger.querySelectorAll<SVGSVGElement>("svg");
    const panel = root.querySelector("aside")!;

    expect(hamburger.getAttribute("aria-label")).toBe("Open sidebar");
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(closeIcon!.style.display).toBe("none");
    expect(menuIcon!.style.display).toBe("");

    click(hamburger);
    await flushAll();
    expect(hamburger.getAttribute("aria-label")).toBe("Close sidebar");
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");
    expect(closeIcon!.style.display).toBe("");
    expect(menuIcon!.style.display).toBe("none");

    const filter = root.querySelector<HTMLInputElement>(
      'input[aria-label="Filter navigation"]',
    )!;
    filter.focus();
    expect(document.activeElement).toBe(filter);

    pressEscape();
    await flushAll();
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(hamburger);
    expect(document.body.style.overflow).toBe("");
    expect(closeIcon!.style.display).toBe("none");
    expect(menuIcon!.style.display).toBe("");
  });

  it("closes on backdrop click and releases the body lock when the scope is disposed", async () => {
    const mounted = await mount();
    const hamburger = mounted.root.querySelector<HTMLButtonElement>("button[aria-expanded]")!;

    click(hamburger);
    await flushAll();
    expect(document.body.style.overflow).toBe("hidden");
    click(mounted.root.querySelector(".z-modal-backdrop"));
    await flushAll();
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");

    click(hamburger);
    await flushAll();
    expect(document.body.style.overflow).toBe("hidden");
    mounted.dispose();
    view = undefined;
    expect(document.body.style.overflow).toBe("");
  });

  it("ignores a composing Escape and an Escape consumed by a nested control", async () => {
    const { root } = await mount();
    const hamburger = root.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
    const filter = root.querySelector<HTMLInputElement>('input[aria-label="Filter navigation"]')!;
    click(hamburger);
    await flushAll();

    pressEscape(document, { isComposing: true });
    await flushAll();
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");

    const consumeEscape = (event: Event) => event.preventDefault();
    filter.addEventListener("keydown", consumeEscape, { once: true });
    const consumed = pressEscape(filter);
    await flushAll();
    expect(consumed.defaultPrevented).toBe(true);
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");
  });

  it("does not register the Escape listener while closed", async () => {
    const { root } = await mount();
    const decoy = document.createElement("input");
    document.body.append(decoy);
    decoy.focus();
    pressEscape();
    await flushAll();
    expect(root.querySelector('button[aria-label="Open sidebar"]')).not.toBeNull();
    expect(document.activeElement).toBe(decoy);
    decoy.remove();
  });

  it("elevates the close button only while open", async () => {
    const { root } = await mount();
    const button = root.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
    const closedClasses = button.className;
    expect(closedClasses).not.toContain("z-modal");
    expect(closedClasses.split(/\s+/)).not.toContain("relative");

    click(button);
    await flushAll();
    expect(button.className.split(/\s+/)).toContain("relative");
    expect(button.className.split(/\s+/)).toContain("z-modal");

    pressEscape();
    await flushAll();
    expect(button.className).toBe(closedClasses);
  });
});

describe("SidebarToggle — persisted same-locale navigation", () => {
  const persistHeader = (props: SidebarToggleProps) => {
    const island = islandRoot(
      h(SidebarToggle, props as unknown as Record<string, unknown>),
      { identity: DRAWER_IDENTITY },
    );
    return `<header data-zfb-transition-persist="header-en">${renderToString(island)}</header>`;
  };

  const incoming = (header: string) =>
    new DOMParser().parseFromString(`<!doctype html><html><body>${header}</body></html>`, "text/html");

  it("refreshes the cross-section tree and restores an expanded category after a native swap", async () => {
    const initialNodes: SidebarNavNode[] = [
      {
        slug: "guides",
        label: "Guides",
        position: 0,
        collapsed: true,
        hasPage: false,
        children: [
          {
            slug: "guides/first",
            label: "First",
            position: 0,
            href: "/docs/guides/first",
            hasPage: true,
            children: [],
          },
        ],
      },
      {
        slug: "about",
        label: "About",
        position: 1,
        href: "/docs/about",
        hasPage: true,
        children: [],
      },
    ];
    const nextNodes: SidebarNavNode[] = [
      {
        slug: "guides",
        label: "Guides",
        position: 0,
        collapsed: true,
        hasPage: false,
        children: [
          {
            slug: "guides/second",
            label: "Second",
            position: 0,
            href: "/docs/guides/second",
            hasPage: true,
            children: [],
          },
        ],
      },
      {
        slug: "reference",
        label: "Reference",
        position: 1,
        hasPage: false,
        children: [
          {
            slug: "reference/api",
            label: "API",
            position: 0,
            href: "/docs/reference/api",
            hasPage: true,
            children: [],
          },
        ],
      },
    ];
    let activations = 0;
    let cleanups = 0;
    const modes: string[] = [];
    const oldProps: SidebarToggleProps = {
      nodes: initialNodes,
      currentSlug: "about",
    };
    const nextProps: SidebarToggleProps = {
      nodes: nextNodes,
      currentSlug: "reference/api",
    };
    document.body.innerHTML = persistHeader(oldProps);
    const { hydrate: hydrateRoot, mount: mountClientRoot } = await import(
      "@takazudo/zfb/zudo-react/client"
    );
    mountIslands({
      SidebarToggle: {
        identity: DRAWER_IDENTITY,
        mount(props, element, mode) {
          activations++;
          modes.push(mode);
          const node = h(
            SidebarToggle,
            props as Record<string, unknown>,
          );
          const handle = mode === "render"
            ? mountClientRoot(node, element, { identity: DRAWER_IDENTITY })
            : hydrateRoot(node, element, { identity: DRAWER_IDENTITY });
          return handle && {
            protocol: "zudo-react/1" as const,
            identity: DRAWER_IDENTITY,
            get disposed() { return handle.disposed; },
            dispose() { cleanups++; handle.dispose(); },
            unmount() { cleanups++; handle.unmount(); },
          };
        },
      },
    });
    await flushAll();

    const hamburger = document.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    click(hamburger);
    await flushAll();
    click(document.querySelector('button[aria-label="Expand Guides"]'));
    await flushAll();
    expect(document.querySelector('a[href="/docs/guides/first"]')).not.toBeNull();
    expect(JSON.parse(sessionStorage.getItem("zd-sidebar-open")!)).toContain("guides");

    const next = incoming(persistHeader(nextProps));
    const event = new Event(BEFORE_SWAP_EVENT) as Event & {
      newDocument: Document;
      swap: (...args: unknown[]) => unknown;
    };
    event.newDocument = next;
    event.swap = () => undefined;
    document.dispatchEvent(event);
    unmountIslands(document.body, next.body);
    swapFunctions.swapBodyElement(next.body, document.body);
    mountNewIslands();
    await flushAll();

    expect(modes).toEqual(["hydrate", "render"]);
    expect(activations).toBe(2);
    expect(cleanups).toBe(1);
    expect(document.querySelector('a[href="/docs/guides/first"]')).toBeNull();
    expect(document.querySelector('a[href="/docs/guides/second"]')).not.toBeNull();
    expect(
      document.querySelector('a[href="/docs/reference/api"][aria-current="page"]'),
    ).not.toBeNull();
    expect(document.querySelector('button[aria-label="Collapse Guides"]')).not.toBeNull();
  });

  it("closes after a same-document navigation event", async () => {
    const { root } = await mount();
    const hamburger = root.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
    click(hamburger);
    await flushAll();
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
    expect(root.querySelector("aside")!.hasAttribute("inert")).toBe(true);
  });
});


it("keeps the mobile drawer open for focus, broaden and restore; native navigation closes it", async () => {
  const data = buildSidebarNavigation([], "en", undefined, undefined, {
    default: [{ type: "category", label: "Editorial", items: [{ type: "category", label: "Branch", items: ["introduction"] }] }, "introduction"],
  }, () => NODES, []);
  const { root } = await mount({ ...data, currentSlug: "introduction" });
  const hamburger = root.querySelector<HTMLButtonElement>('button[aria-label="Open sidebar"]')!;
  click(hamburger);
  await flushAll();
  click(root.querySelector('button[aria-label="Show only this branch: Branch"]'));
  await flushAll();
  expect(hamburger.getAttribute("aria-expanded")).toBe("true");
  click(root.querySelector('[data-sidebar-broaden]'));
  await flushAll();
  click(root.querySelector('[data-sidebar-restore]'));
  await flushAll();
  expect(hamburger.getAttribute("aria-expanded")).toBe("true");
  expect(document.body.style.overflow).toBe("hidden");
  document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
  await flushAll();
  expect(hamburger.getAttribute("aria-expanded")).toBe("false");
  expect(document.body.style.overflow).toBe("");
});
