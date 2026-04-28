/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { Tabs } from "../tabs";
import { TabsInit } from "../tabs-init";
import { TABS_INIT_SCRIPT } from "../tabs-init-script";
import { TabItem } from "../../tab-item/tab-item";

describe("<Tabs />", () => {
  it("renders the [data-tabs] container", () => {
    const html = render(
      <Tabs>
        <TabItem label="npm">npm content</TabItem>
      </Tabs>,
    );
    expect(html).toContain("data-tabs");
    expect(html).toContain("tabs-container");
  });

  it("renders a tabs-nav role=tablist", () => {
    const html = render(
      <Tabs>
        <TabItem label="One">one</TabItem>
      </Tabs>,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain("tabs-nav");
  });

  it("renders one nav button per TabItem with the correct label", () => {
    const html = render(
      <Tabs>
        <TabItem label="npm">npm content</TabItem>
        <TabItem label="pnpm">pnpm content</TabItem>
        <TabItem label="yarn">yarn content</TabItem>
      </Tabs>,
    );
    expect(html).toContain(">npm<");
    expect(html).toContain(">pnpm<");
    expect(html).toContain(">yarn<");
  });

  it("sets data-tab-btn from label when value is omitted", () => {
    const html = render(
      <Tabs>
        <TabItem label="Alpha">alpha</TabItem>
      </Tabs>,
    );
    expect(html).toContain('data-tab-btn="Alpha"');
  });

  it("sets data-tab-btn from value when provided", () => {
    const html = render(
      <Tabs>
        <TabItem label="Alpha" value="alpha-id">alpha</TabItem>
      </Tabs>,
    );
    expect(html).toContain('data-tab-btn="alpha-id"');
  });

  it("renders nav buttons with aria-selected=false initially (TabsInit activates)", () => {
    const html = render(
      <Tabs>
        <TabItem label="One">one</TabItem>
        <TabItem label="Two">two</TabItem>
      </Tabs>,
    );
    // All buttons should have aria-selected=false; TabsInit sets the active one.
    const matches = html.match(/aria-selected="[^"]+"/g) ?? [];
    expect(matches.length).toBe(2);
    expect(matches.every((m) => m === 'aria-selected="false"')).toBe(true);
  });

  it("renders the tabs-content area with TabItem panels", () => {
    const html = render(
      <Tabs>
        <TabItem label="A">content A</TabItem>
      </Tabs>,
    );
    expect(html).toContain("tabs-content");
    expect(html).toContain("content A");
    // The panel should be hidden (TabItem renders with hidden).
    expect(html).toContain("hidden");
  });

  it("forwards the groupId as data-group-id", () => {
    const html = render(
      <Tabs groupId="install-manager">
        <TabItem label="npm">npm</TabItem>
      </Tabs>,
    );
    expect(html).toContain('data-group-id="install-manager"');
  });

  it("omits data-group-id when groupId is not provided", () => {
    const html = render(
      <Tabs>
        <TabItem label="npm">npm</TabItem>
      </Tabs>,
    );
    expect(html).not.toContain("data-group-id");
  });

  it("renders non-TabItem children in the content area without adding nav buttons", () => {
    const html = render(
      <Tabs>
        <TabItem label="A">a</TabItem>
        <p>extra content</p>
      </Tabs>,
    );
    // Only one nav button (for the TabItem).
    const navBtns = html.match(/data-tab-btn=/g) ?? [];
    expect(navBtns).toHaveLength(1);
    // The extra content still appears.
    expect(html).toContain("<p>extra content</p>");
  });
});

describe("<TabsInit />", () => {
  it("renders a <script> tag", () => {
    const html = render(<TabsInit />);
    expect(html).toContain("<script");
  });

  it("script contains activateTab and showPanel logic", () => {
    const html = render(<TabsInit />);
    expect(html).toContain("activateTab");
    expect(html).toContain("showPanel");
  });

  it("script hooks into astro:page-load", () => {
    const html = render(<TabsInit />);
    expect(html).toContain("astro:page-load");
  });

  it("script handles localStorage group sync", () => {
    const html = render(<TabsInit />);
    expect(html).toContain("localStorage");
    expect(html).toContain("syncGroup");
  });
});

describe("TABS_INIT_SCRIPT", () => {
  it("is a non-empty string", () => {
    expect(typeof TABS_INIT_SCRIPT).toBe("string");
    expect(TABS_INIT_SCRIPT.length).toBeGreaterThan(0);
  });

  it("wraps the logic in an IIFE", () => {
    expect(TABS_INIT_SCRIPT).toMatch(/^\(function\s*\(\)/);
    expect(TABS_INIT_SCRIPT.trimEnd()).toMatch(/\)\(\);$/);
  });

  it("reads data-tab-default to find the default panel", () => {
    expect(TABS_INIT_SCRIPT).toContain("data-tab-default");
  });

  it("targets [data-tab-btn] buttons (pre-rendered by Tabs component)", () => {
    expect(TABS_INIT_SCRIPT).toContain("data-tab-btn");
  });

  it("uses a tabs-init marker to avoid double-initialization", () => {
    expect(TABS_INIT_SCRIPT).toContain("tabsInit");
  });
});
