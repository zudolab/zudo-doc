"use client";

import { computed, getScope, Show, signal, type ReadonlySignal, type Ref } from "@takazudo/zfb/zudo-react";
import { hydrationPending } from "../hydration-pending.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import {
  applyThemePreference,
  readColorSchemeFromDom,
  readThemePreference,
  subscribeColorSchemeChanged,
  subscribeThemePreferenceChanged,
  type ColorSchemeMode,
  type ThemePreference,
} from "./color-scheme-sync.js";

const preferences: ThemePreference[] = ["light", "dark", "system"];
let menuSequence = 0;

function PreferenceIcon({ preference }: { preference: ThemePreference }) {
  return (
    <svg aria-hidden="true" width="20" height="20"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
      stroke-linecap="square" stroke-linejoin="miter">
      <Show when={computed(() => preference === "light")}>{() => <><circle cx="12" cy="12" r="3.6" /><path d="M12 2.5V6M12 18V21.5M2.5 12H6M18 12H21.5M5.3 5.3L7.8 7.8M16.2 16.2L18.7 18.7M5.3 18.7L7.8 16.2M16.2 7.8L18.7 5.3" /></>}</Show>
      <Show when={computed(() => preference === "dark")}>{() => <path d="M10.2 2.9C5.7 3.9 2.6 7.9 3 12.6C3.4 17.7 7.9 21.5 13 21.1C16.9 20.7 20.1 17.9 21 14.1C18.6 15.7 15.6 15.8 13.2 14.3C9.3 12 8 6.8 10.2 2.9Z" />}</Show>
      <Show when={computed(() => preference === "system")}>{() => <path d="M2.5 3.5H21.5V16.5H2.5ZM12 16.5V20.5M7.5 20.5H16.5" />}</Show>
    </svg>
  );
}

export interface ThemeToggleLabels {
  appearance: string;
  light: string;
  dark: string;
  system: string;
  systemHelper: string;
}

const englishLabels: ThemeToggleLabels = {
  appearance: "Appearance",
  light: "Light",
  dark: "Dark",
  system: "System",
  systemHelper: "Follows device · currently {mode}",
};

export interface ThemeToggleProps {
  defaultMode?: ColorSchemeMode;
  respectPrefersColorScheme?: boolean;
  labels?: ThemeToggleLabels;
  /** Keep activation pending until the first successful mount. @default true */
  pendingUntilHydrated?: boolean;
}

interface AppearanceMenuProps {
  id: string;
  labels: ThemeToggleLabels;
  preference: ReadonlySignal<ThemePreference>;
  resolved: ReadonlySignal<ColorSchemeMode>;
  activeIndex: ReadonlySignal<number>;
  triggerRef: Ref<HTMLButtonElement>;
  rootRef: Ref<HTMLDivElement>;
  close: (restoreFocus?: boolean) => void;
  select: (next: ThemePreference) => void;
  move: (index: number) => void;
}

function AppearanceMenu({ id, labels, preference, resolved, activeIndex, triggerRef, rootRef, close, select, move }: AppearanceMenuProps) {
  const scope = getScope();
  const menuRef: Ref<HTMLDivElement> = { current: null };
  const itemRefs: Ref<HTMLButtonElement>[] = preferences.map(() => ({ current: null }));
  const placement = signal({ visibility: "hidden", left: "0px", top: "0px", right: "auto", bottom: "auto", margin: "0", width: "260px", "max-height": "none" });

  scope.onActivate(() => {
    const menu = menuRef.current;
    if (!menu) return;
    menu.showPopover?.();
    const position = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 8;
      const width = Math.max(0, Math.min(260, window.innerWidth - gap * 2));
      const desiredHeight = menu.scrollHeight || 280;
      const roomBelow = window.innerHeight - rect.bottom - gap * 2;
      const roomAbove = rect.top - gap * 2;
      const above = roomBelow < desiredHeight && roomAbove > roomBelow;
      const maxHeight = Math.max(80, Math.min(desiredHeight, above ? roomAbove : roomBelow));
      const left = Math.max(gap, Math.min(rect.right - width, window.innerWidth - width - gap));
      const top = above ? Math.max(gap, rect.top - gap - maxHeight) : rect.bottom + gap;
      placement.value = { visibility: "visible", left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto", margin: "0", width: `${width}px`, "max-height": `${maxHeight}px` };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menu.contains(event.target as Node)) close();
    };
    const onNavigate = () => close();
    position();
    itemRefs[activeIndex.value]?.current?.focus();
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener(AFTER_NAVIGATE_EVENT, onNavigate);
    return () => {
      if (menu.hidePopover && menu.matches(":popover-open")) menu.hidePopover();
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener(AFTER_NAVIGATE_EVENT, onNavigate);
    };
  });

  const onMenuKeyDown = (event: Event) => {
    const keyboard = event as KeyboardEvent;
    if (keyboard.isComposing) return;
    if (keyboard.key === "Escape") {
      keyboard.preventDefault();
      keyboard.stopPropagation();
      close(true);
    } else if (keyboard.key === "Tab") {
      window.setTimeout(() => close(), 0);
    } else if (keyboard.key === "ArrowDown" || keyboard.key === "ArrowUp" || keyboard.key === "Home" || keyboard.key === "End") {
      keyboard.preventDefault();
      const next = keyboard.key === "Home" ? 0 : keyboard.key === "End" ? 2 : activeIndex.value + (keyboard.key === "ArrowDown" ? 1 : -1);
      move(next);
      itemRefs[(next + preferences.length) % preferences.length]?.current?.focus();
    }
  };

  return <div ref={menuRef} id={id} role="menu" aria-label={labels.appearance}
    on:keydown={onMenuKeyDown}
    class="fixed z-tooltip overflow-y-auto rounded-lg border border-muted bg-surface p-hsp-xs text-fg shadow-lg"
    style={placement} popover="manual">
    <div class="px-hsp-sm py-vsp-xs text-small font-semibold" aria-hidden="true">{labels.appearance}</div>
    {preferences.map((option, index) => <button ref={itemRefs[index]} type="button"
      role="menuitemradio" aria-checked={computed(() => preference.value === option)}
      on:focus={() => move(index)} on:click={() => select(option)}
      class={computed(() => `flex min-h-[44px] w-full items-center gap-hsp-sm rounded px-hsp-sm text-left text-small ${preference.value === option ? "bg-accent/10" : ""} hover:bg-accent/10 focus-visible:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent`)}>
      <PreferenceIcon preference={option} />
      <span class="flex-1">{labels[option]}</span>
      <span aria-hidden="true" class="text-accent">{computed(() => preference.value === option ? "✓" : "")}</span>
    </button>)}
    <div class="px-hsp-sm py-vsp-xs text-small text-muted">
      {computed(() => labels.systemHelper.replace("{mode}", labels[resolved.value]))}
    </div>
  </div>;
}

// Keep the named export: zfb's island scanner keys on the ThemeToggle name.
export function ThemeToggle({ defaultMode = "dark", respectPrefersColorScheme = true, labels = englishLabels, pendingUntilHydrated = true }: ThemeToggleProps) {
  const scope = getScope();
  const pending = hydrationPending(scope, pendingUntilHydrated);
  const rootRef: Ref<HTMLDivElement> = { current: null };
  const triggerRef: Ref<HTMLButtonElement> = { current: null };
  const preference = signal<ThemePreference>(respectPrefersColorScheme ? "system" : defaultMode);
  const resolved = signal<ColorSchemeMode>(defaultMode);
  const open = signal(false);
  const activeIndex = signal(0);
  let menuId = "";
  const ensureMenuId = () => { if (!menuId) menuId = `zd-appearance-${++menuSequence}`; };

  scope.onActivate(() => {
    const sync = () => {
      preference.value = readThemePreference(defaultMode, respectPrefersColorScheme);
      resolved.value = readColorSchemeFromDom(defaultMode);
    };
    sync();
    const unsubscribePreference = subscribeThemePreferenceChanged(() => { sync(); open.value = false; });
    const unsubscribeScheme = subscribeColorSchemeChanged(sync);
    return () => { unsubscribePreference(); unsubscribeScheme(); };
  });

  const close = (restoreFocus = false) => {
    open.value = false;
    if (restoreFocus) requestAnimationFrame(() => {
      if (!scope.abortSignal.aborted && !open.value) triggerRef.current?.focus();
    });
  };
  const select = (next: ThemePreference) => {
    close(true);
    applyThemePreference(next);
    preference.value = next;
    resolved.value = readColorSchemeFromDom(defaultMode);
  };
  const move = (index: number) => { activeIndex.value = (index + preferences.length) % preferences.length; };
  const show = (index: number) => { ensureMenuId(); move(index); open.value = true; };

  return <div ref={rootRef} class="relative inline-flex" data-zd-theme-menu="">
    <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open}
      aria-controls={computed(() => open.value ? menuId : undefined)}
      aria-label={computed(() => `${labels.appearance}: ${labels[preference.value]}`)}
      aria-disabled={computed(() => pending.value ? "true" : undefined)}
      data-zd-pending={computed(() => pending.value ? "" : undefined)}
      on:click={() => { if (pending.value) return; if (open.value) close(true); else show(preferences.indexOf(preference.value)); }}
      on:keydown={(event: Event) => {
        const keyboard = event as KeyboardEvent;
        if (keyboard.isComposing) return;
        if (pending.value) { if (keyboard.key === "Enter" || keyboard.key === " ") keyboard.preventDefault(); return; }
        if (keyboard.key === "ArrowDown" || keyboard.key === "ArrowUp") {
          keyboard.preventDefault(); show(keyboard.key === "ArrowDown" ? 0 : 2);
        } else if (keyboard.key === "Escape" && open.value) {
          keyboard.preventDefault(); keyboard.stopPropagation(); close(true);
        }
      }}
      class="inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2">
      <Show when={computed(() => preference.value === "light")}>{() => <PreferenceIcon preference="light" />}</Show>
      <Show when={computed(() => preference.value === "dark")}>{() => <PreferenceIcon preference="dark" />}</Show>
      <Show when={computed(() => preference.value === "system")}>{() => <PreferenceIcon preference="system" />}</Show>
    </button>
    <Show when={open}>{() => <AppearanceMenu id={menuId} labels={labels} preference={preference} resolved={resolved} activeIndex={activeIndex} triggerRef={triggerRef} rootRef={rootRef} close={close} select={select} move={move} />}</Show>
  </div>;
}
ThemeToggle.displayName = "ThemeToggle";
