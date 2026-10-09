"use client";

/** @jsxRuntime automatic */
import { computed, getScope, Show, signal } from "@takazudo/zfb/zudo-react";
import { ChevronLeft, ChevronRight } from "../icons/index.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import { readState, setDataAttribute, writeState } from "./storage.js";

export function DesktopSidebarToggle() {
  // Keep SSR and the initial client render visible. The activation callback
  // reads storage only after hydration, when browser APIs are available.
  const visible = signal(true);
  const scope = getScope();

  scope.onActivate(() => {
    const initialVisibility = readState();
    visible.value = initialVisibility;
    setDataAttribute(initialVisibility);

    const restoreDocumentAttribute = () => setDataAttribute(readState());
    document.addEventListener(AFTER_NAVIGATE_EVENT, restoreDocumentAttribute);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, restoreDocumentAttribute);
  });

  const toggle = () => {
    const next = !visible.value;
    visible.value = next;
    writeState(next);
    setDataAttribute(next);
  };

  return (
    <button
      type="button"
      on:click={toggle}
      class="zd-desktop-sidebar-toggle hidden lg:flex fixed bottom-vsp-xl z-sidebar items-center justify-center w-[1.5rem] h-[3rem] bg-surface border border-muted border-l-0 text-muted cursor-pointer transition-[left,color] duration-200 hover:text-fg"
      style="border-radius:0 var(--radius-DEFAULT) var(--radius-DEFAULT) 0"
      aria-label={computed(() => visible.value ? "Hide sidebar" : "Show sidebar")}
      aria-pressed={visible}
    >
      <Show when={computed(() => visible.value)}>
        {() => <ChevronLeft class="h-icon-sm w-icon-sm" />}
      </Show>
      <Show when={computed(() => !visible.value)}>
        {() => <ChevronRight class="h-icon-sm w-icon-sm" />}
      </Show>
    </button>
  );
}
DesktopSidebarToggle.displayName = "DesktopSidebarToggle";
