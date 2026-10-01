"use client";

/** @jsxRuntime automatic */
import { computed, getScope, Show, signal } from "@takazudo/zfb/zudo-react";
import { ChevronLeft, ChevronRight } from "../icons/index.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import { readTocState, setTocDataAttribute, writeTocState } from "./storage.js";

export function DesktopTocToggle() {
  // Keep SSR and the initial client render visible. The activation callback
  // reads storage only after hydration, when browser APIs are available.
  const visible = signal(true);
  const scope = getScope();

  scope.onActivate(() => {
    const initialVisibility = readTocState();
    visible.value = initialVisibility;
    setTocDataAttribute(initialVisibility);

    const restoreDocumentAttribute = () => setTocDataAttribute(readTocState());
    document.addEventListener(AFTER_NAVIGATE_EVENT, restoreDocumentAttribute);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, restoreDocumentAttribute);
  });

  const toggle = () => {
    const next = !visible.value;
    visible.value = next;
    writeTocState(next);
    setTocDataAttribute(next);
  };

  return (
    <button
      type="button"
      on:click={toggle}
      class="zd-desktop-toc-toggle hidden xl:flex fixed bottom-vsp-xl z-sidebar items-center justify-center w-[1.5rem] h-[3rem] bg-surface border border-muted border-r-0 text-muted cursor-pointer transition-[right,color] duration-200 ease-in-out hover:text-fg"
      style="border-radius:var(--radius-DEFAULT) 0 0 var(--radius-DEFAULT)"
      aria-label={computed(() => visible.value ? "Hide table of contents" : "Show table of contents")}
      aria-pressed={visible}
    >
      <Show when={computed(() => visible.value)}>
        {() => <ChevronRight class="h-icon-sm w-icon-sm" />}
      </Show>
      <Show when={computed(() => !visible.value)}>
        {() => <ChevronLeft class="h-icon-sm w-icon-sm" />}
      </Show>
    </button>
  );
}
DesktopTocToggle.displayName = "DesktopTocToggle";
