"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useState, useEffect, useRef } from "preact/hooks";
import { createPortal } from "preact/compat";
import { useHydrationPending } from "../hydration-pending.js";
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
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"
      strokeLinecap="square" strokeLinejoin="miter">
      {preference === "light" ? (
        <><circle cx="12" cy="12" r="3.6" /><path d="M12 2.5V6M12 18V21.5M2.5 12H6M18 12H21.5M5.3 5.3L7.8 7.8M16.2 16.2L18.7 18.7M5.3 18.7L7.8 16.2M16.2 7.8L18.7 5.3" /></>
      ) : preference === "dark" ? (
        <path d="M10.2 2.9C5.7 3.9 2.6 7.9 3 12.6C3.4 17.7 7.9 21.5 13 21.1C16.9 20.7 20.1 17.9 21 14.1C18.6 15.7 15.6 15.8 13.2 14.3C9.3 12 8 6.8 10.2 2.9Z" />
      ) : (
        <path d="M2.5 3.5H21.5V16.5H2.5ZM12 16.5V20.5M7.5 20.5H16.5" />
      )}
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

// Keep the named export: zfb's island scanner keys on the ThemeToggle name.
export function ThemeToggle({
  defaultMode = "dark",
  respectPrefersColorScheme = true,
  labels = englishLabels,
  pendingUntilHydrated = true,
}: ThemeToggleProps) {
  const pending = useHydrationPending(pendingUntilHydrated);
  // The menu exists only after a client interaction; allocate across island roots.
  const menuId = useRef("");
  const ensureMenuId = () => {
    if (!menuId.current) menuId.current = `zd-appearance-${++menuSequence}`;
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [preference, setPreference] = useState<ThemePreference>(
    respectPrefersColorScheme ? "system" : defaultMode,
  );
  const [resolved, setResolved] = useState<ColorSchemeMode>(defaultMode);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  useEffect(() => {
    const sync = () => {
      setPreference(readThemePreference(defaultMode, respectPrefersColorScheme));
      setResolved(readColorSchemeFromDom(defaultMode));
    };
    sync();
    const unsubscribePreference = subscribeThemePreferenceChanged(() => {
      sync();
      setOpen(false);
    });
    const unsubscribeScheme = subscribeColorSchemeChanged(sync);
    return () => {
      unsubscribePreference();
      unsubscribeScheme();
    };
  }, [defaultMode, respectPrefersColorScheme]);

  useEffect(() => {
    if (!open) return;
    // A portaled menu still sits below the third-party token panel's very high
    // stacking tier. The native popover top layer keeps it actionable while
    // that panel is open, without competing with the host's z-index scale.
    const menu = menuRef.current;
    menu?.showPopover?.();
    const position = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 8;
      const width = Math.min(260, window.innerWidth - gap * 2);
      // Measure after the popover enters the top layer. A fixed guess clips
      // the System helper once the option rows meet the 44px touch target.
      const desiredHeight = menu?.scrollHeight ?? 280;
      const roomBelow = window.innerHeight - rect.bottom - gap * 2;
      const roomAbove = rect.top - gap * 2;
      const above = roomBelow < desiredHeight && roomAbove > roomBelow;
      const maxHeight = Math.max(80, Math.min(desiredHeight, above ? roomAbove : roomBelow));
      setPlacement({
        left: Math.max(gap, Math.min(rect.right - width, window.innerWidth - width - gap)),
        top: above ? Math.max(gap, rect.top - gap - maxHeight) : rect.bottom + gap,
        width,
        maxHeight,
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) setOpen(false);
    };
    const onNavigate = () => setOpen(false);
    position();
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener(AFTER_NAVIGATE_EVENT, onNavigate);
    return () => {
      if (menu?.hidePopover && menu.matches(":popover-open")) menu.hidePopover();
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener(AFTER_NAVIGATE_EVENT, onNavigate);
    };
  }, [open]); // activeIndex is set before opening; arrow movement focuses directly.

  useEffect(() => {
    if (open && placement) itemRefs.current[activeIndex]?.focus();
  }, [open, placement]); // Focus once the portaled menu is visible.

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const select = (next: ThemePreference) => {
    applyThemePreference(next);
    setPreference(next);
    setResolved(readColorSchemeFromDom(defaultMode));
    close(true);
  };
  const move = (index: number) => {
    const next = (index + preferences.length) % preferences.length;
    setActiveIndex(next);
    itemRefs.current[next]?.focus();
  };
  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      // Let the browser move focus before unmounting the focused menu item.
      window.setTimeout(() => close(), 0);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(2);
    }
  };

  return (
    <div ref={rootRef} className="relative inline-flex" data-zd-theme-menu="">
      <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? menuId.current : undefined}
        aria-label={`${labels.appearance}: ${labels[preference]}`}
        aria-disabled={pending ? "true" : undefined}
        data-zd-pending={pending ? "" : undefined}
        onClick={() => {
          if (pending) return;
          if (open) close(true);
          else { setPlacement(null); ensureMenuId(); setActiveIndex(preferences.indexOf(preference)); setOpen(true); }
        }}
        onKeyDown={(event) => {
          if (pending) { if (event.key === "Enter" || event.key === " ") event.preventDefault(); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setPlacement(null); ensureMenuId(); setActiveIndex(event.key === "ArrowDown" ? 0 : 2); setOpen(true);
          } else if (event.key === "Escape" && open) { event.preventDefault(); close(true); }
        }}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      ><PreferenceIcon preference={preference} /></button>
      {open && createPortal(<div ref={menuRef} id={menuId.current} role="menu" aria-label={labels.appearance}
        popover={typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype ? "manual" : undefined}
        onKeyDown={onMenuKeyDown}
        className="fixed z-tooltip overflow-y-auto rounded-lg border border-muted bg-surface p-hsp-xs text-fg shadow-lg"
        style={placement ? { left: placement.left, top: placement.top, right: "auto", bottom: "auto", margin: 0, width: placement.width, maxHeight: placement.maxHeight } : { visibility: "hidden", left: 0, top: 0, right: "auto", bottom: "auto", margin: 0, width: Math.min(260, window.innerWidth - 16) }}>
        <div className="px-hsp-sm py-vsp-xs text-small font-semibold" aria-hidden="true">{labels.appearance}</div>
        {preferences.map((option, index) => (
          <button key={option} ref={(node) => { itemRefs.current[index] = node; }} type="button"
            role="menuitemradio" aria-checked={preference === option}
            onFocus={() => setActiveIndex(index)} onClick={() => select(option)}
            className={`flex min-h-[44px] w-full items-center gap-hsp-sm rounded px-hsp-sm text-left text-small ${preference === option ? "bg-accent/10" : ""} hover:bg-accent/10 focus-visible:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent`}
          >
            <PreferenceIcon preference={option} />
            <span className="flex-1">{labels[option]}</span>
            <span aria-hidden="true" className="text-accent">{preference === option ? "✓" : ""}</span>
          </button>
        ))}
        <div className="px-hsp-sm py-vsp-xs text-small text-muted">
          {labels.systemHelper.replace("{mode}", labels[resolved])}
        </div>
      </div>, document.body)}
    </div>
  );
}
ThemeToggle.displayName = "ThemeToggle";
