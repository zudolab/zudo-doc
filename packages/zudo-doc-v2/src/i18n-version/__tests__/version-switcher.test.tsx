/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import {
  VersionSwitcher,
  VERSION_SWITCHER_INIT_SCRIPT,
} from "../version-switcher";
import type { VersionEntry, VersionSwitcherLabels } from "../types";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/page-events";

type AnyVNode = VNode<{ children?: ComponentChildren; [key: string]: unknown }>;

function isVNode(v: unknown): v is AnyVNode {
  return (
    typeof v === "object" &&
    v !== null &&
    Object.prototype.hasOwnProperty.call(v, "type") &&
    Object.prototype.hasOwnProperty.call(v, "props")
  );
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

function serialize(node: ComponentChildren): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(serialize).join("");
  if (!isVNode(node)) return "";
  const { type, props } = node;
  const { children, ...rest } = (props ?? {}) as {
    children?: ComponentChildren;
    [key: string]: unknown;
  };

  if (typeof type === "function") {
    const fn = type as (p: typeof props) => ComponentChildren;
    return serialize(fn(props));
  }
  if (type == null || (typeof type === "string" && type === "")) {
    return serialize(children);
  }
  if (typeof type !== "string") return serialize(children);

  const attrs = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      if (k === "key") return "";
      if (v === true) return ` ${k}`;
      return ` ${k}="${escapeAttr(String(v))}"`;
    })
    .join("");

  const voidEls = new Set(["br", "hr", "img", "input", "wbr", "meta", "link"]);
  if (voidEls.has(type)) return `<${type}${attrs}/>`;
  return `<${type}${attrs}>${serialize(children)}</${type}>`;
}

const labels: VersionSwitcherLabels = {
  latest: "Latest",
  switcher: "Version",
  unavailable: "Not available",
  allVersions: "All versions",
};

const versions: VersionEntry[] = [
  { slug: "v2", label: "v2.0" },
  { slug: "v1", label: "v1.x" },
];

const versionUrls: Record<string, string> = {
  v2: "/v/v2/docs/intro/",
  v1: "/v/v1/docs/intro/",
};

describe("VersionSwitcher", () => {
  it("renders the data-version-switcher root, toggle, and menu", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
      />,
    );
    expect(html).toContain("data-version-switcher");
    expect(html).toContain("data-version-toggle");
    expect(html).toContain("data-version-menu");
    expect(html).toContain('id="version-menu"');
  });

  it("appends idSuffix to the menu id and aria-controls", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
        idSuffix="header"
      />,
    );
    expect(html).toContain('id="version-menu-header"');
    expect(html).toContain('aria-controls="version-menu-header"');
  });

  it("marks the Latest entry as the active row when no currentVersion is set", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
      />,
    );
    // Latest link gets aria-current="page" + bold/accent class.
    expect(html).toMatch(/<a[^>]*href="\/docs\/intro\/"[^>]*aria-current="page"/);
    expect(html).toContain("font-bold text-accent");
  });

  it("renders the matching version entry as active when currentVersion is set", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        currentVersion="v1"
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
      />,
    );
    // The trigger label reflects the current version.
    expect(html).toContain(">v1.x</span>");
    // The v1 list item carries aria-current="page".
    expect(html).toMatch(/href="\/v\/v1\/docs\/intro\/"[^>]*aria-current="page"/);
    // Latest no longer carries it.
    expect(html).not.toMatch(/href="\/docs\/intro\/"[^>]*aria-current="page"/);
  });

  it("renders unavailable versions as disabled, non-interactive links", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        unavailableVersions={new Set(["v1"])}
        labels={labels}
      />,
    );
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("pointer-events-none");
    expect(html).toContain('title="Not available"');
  });

  it("falls back to versionsPageUrl when versionUrls lacks an entry", () => {
    const html = serialize(
      <VersionSwitcher
        versions={[{ slug: "v0", label: "v0" }]}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={{}}
        labels={labels}
      />,
    );
    // Two anchors point at versionsPageUrl: the v0 row and the footer
    // "All versions" link.
    const matches = html.match(/href="\/docs\/versions\/"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("VERSION_SWITCHER_INIT_SCRIPT is non-empty and rebinds on the v2 after-navigate event", () => {
    // The rebind hooks the constant from `transitions/page-events.ts`,
    // not a hard-coded `astro:*` literal — so the script string contains
    // whatever `AFTER_NAVIGATE_EVENT` resolves to today.
    expect(VERSION_SWITCHER_INIT_SCRIPT).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
    expect(VERSION_SWITCHER_INIT_SCRIPT).toContain('AbortController');
    expect(VERSION_SWITCHER_INIT_SCRIPT).toContain('data-version-switcher');
  });
});
