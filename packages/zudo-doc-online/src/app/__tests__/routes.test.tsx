/**
 * The routed-surface keying contract. `RouteView` is called as a plain
 * function so the assertion reads the produced vnodes directly — mounting
 * would pull in every feature's lazy chunk (and its network calls) for a
 * fact that lives entirely in the vnode tree.
 */

import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import type { Route } from "../router";
import { RouteView } from "../routes";

function routedVNode(route: Route): VNode {
  const suspense = RouteView({ route }) as VNode<{ children: VNode }>;
  return suspense.props.children;
}

describe("RouteView keying", () => {
  it("keys every project-scoped surface by projectSlug so a project switch remounts it", () => {
    const outlineA = routedVNode({ name: "outline", projectSlug: "proj-a" });
    const outlineB = routedVNode({ name: "outline", projectSlug: "proj-b" });
    expect(outlineA.key).toBe("proj-a");
    expect(outlineB.key).toBe("proj-b");
    expect(outlineA.type).toBe(outlineB.type);

    const editorA = routedVNode({
      name: "editor",
      projectSlug: "proj-a",
      pageId: "page-1",
    });
    const editorB = routedVNode({
      name: "editor",
      projectSlug: "proj-b",
      pageId: "page-1",
    });
    expect(editorA.key).toBe("proj-a");
    expect(editorB.key).toBe("proj-b");

    const popoutA = routedVNode({
      name: "popped-out-preview",
      projectSlug: "proj-a",
      pageId: "page-1",
    });
    expect(popoutA.key).toBe("proj-a");
  });

  it("keeps the same instance across a page change within one project", () => {
    const first = routedVNode({
      name: "editor",
      projectSlug: "proj-a",
      pageId: "page-1",
    });
    const second = routedVNode({
      name: "editor",
      projectSlug: "proj-a",
      pageId: "page-2",
    });
    expect(first.key).toBe(second.key);
  });
});
