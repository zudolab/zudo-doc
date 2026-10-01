/** @jsxRuntime automatic */
/**
 * Render navigation descriptions with zudo-react's owned server renderer, then
 * assert on the parsed HTML tree instead of walking engine descriptions.
 */

import type { Child } from "@takazudo/zfb/zudo-react";
import { Window } from "happy-dom";
import type {
  HTMLDivElement as HappyHTMLDivElement,
  HTMLElement as HappyHTMLElement,
} from "happy-dom";
import { renderSsr } from "../../__tests__/helpers/zudo-react.js";

const testWindow = new Window();

export function renderNav(node: Child): HappyHTMLDivElement {
  const root = testWindow.document.createElement("div");
  root.innerHTML = renderSsr(node);
  return root;
}

export function hasClass(root: HappyHTMLElement, className: string): boolean {
  return Array.from(root.querySelectorAll("[class]"))
    .some((element) => element.classList.contains(className));
}
