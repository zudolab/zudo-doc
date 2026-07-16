"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// ThemePackSwitcher — the bottom-right theme-pack switcher flyout island
// (ADR `docs/adr/theme-packs.md` Decision 7; epic Theme Core #2812,
// sub-issue #2821).
//
// A small round launcher button fixed at the VIEWPORT's bottom-right toggles
// a card anchored directly above it showing the active pack's name (bold),
// its description (muted small), the Light/Dark badge from `meta.mode`,
// Prev/Next cycle buttons (wraparound — the SSR `order` prop IS the cycle
// order), a browse-all grid trigger (the #2825 dialog seam below), and a
// close ✕. The whole surface sits on the semantic `popover` z-index tier
// (`z-popover`, 40 — `z-index-defaults`), never a raw integer.
//
// Data flow (ADR Decision 7): props are the lightweight serializable
// `{ active, order, base }` projection the chrome factories derive from
// `ctx.themePackRegistry` at SSR time (`chrome/derive.tsx`). This island
// never fetches `theme-packs/index.json` and never loads pack stylesheets to
// render — the full-meta fetch is the browse-all dialog's job (#2825).
// Switching goes through `applyThemePack` (the #2822 engine, this
// directory's `theme-pack-sync.ts`), which owns validation, the atomic link
// swap, persistence, and the `theme-pack-changed` event; display state only
// advances FROM that event (`connectActivePackSync`), so an aborted/failed
// switch never moves the UI.
//
// SSR safety: the initial render (card closed, `active` = the SSR-configured
// slug) is a pure function of the serializable props, so server and client
// first render agree byte-for-byte; the user's possibly-different stored
// pack is synced in `useEffect` AFTER hydration (the ThemeToggle pattern).
//
// Use the preact hook entrypoints directly — zfb's esbuild step does not
// alias "react" to "preact/compat" (the theme-toggle precedent).

import type { JSX, VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ChevronLeft, ChevronRight, Close } from "../icons/index.js";
import { applyThemePack } from "./theme-pack-sync.js";
import {
  connectActivePackSync,
  connectEscapeToClose,
  nextPackSlug,
  prevPackSlug,
  resolveActiveEntry,
  type ThemePackOrderEntry,
} from "./switcher-state.js";

export type { ThemePackOrderEntry } from "./switcher-state.js";

/**
 * Island props (ADR Decision 7 "Switcher data flow") — serializable ONLY:
 * they ride the island marker's `data-props` JSON across the SSR → hydrate
 * boundary, so no functions/components may ever be added here.
 */
export interface ThemePackSwitcherProps {
  /** The SSR-known active pack slug (`settings.themePack`); the user's
   *  stored choice is synced from the DOM after hydration. */
  active: string;
  /** The resolved, enabled packs IN SWITCHER ORDER — the Prev/Next cycle
   *  order and the dialog grid order. */
  order: ThemePackOrderEntry[];
  /** Base prefix WITH trailing slash (`ctx.withBase("/")`) — forwarded to
   *  the browse-all dialog for its `{base}theme-packs/index.json` fetch. */
  base: string;
}

/** Props of the browse-all dialog mounted through {@link ThemePackDialogSlot}
 *  — the #2825 contract. The dialog fetches `{base}theme-packs/index.json`
 *  lazily on first open for the full meta (preview swatches); cards apply
 *  via `applyThemePack(slug)` and the dialog stays open (ADR Decision 7). */
export interface ThemePackDialogProps {
  /** Whether the dialog is currently open. */
  open: boolean;
  /** Close callback (Esc / ✕ / backdrop — the dialog's own close paths). */
  onClose: () => void;
  /** The switcher order — also the dialog grid order. */
  order: ThemePackOrderEntry[];
  /** Currently active pack slug (live — follows `theme-pack-changed`). */
  active: string;
  /** Base prefix WITH trailing slash for the `index.json` fetch. */
  base: string;
}

/** The browse-all dialog component contract (#2825). */
export type ThemePackDialogComponent = (props: ThemePackDialogProps) => JSX.Element | null;

/**
 * #2825 MOUNT SEAM — the browse-all dialog render slot.
 *
 * The dialog is a component rendered INSIDE this island's tree (single
 * island — no separate island registration; island props must stay
 * serializable, so it cannot arrive as a prop). #2825 fills this slot with a
 * STATIC import of `ThemePackDialog` from `../theme-pack-dialog/index.js`:
 *
 *   import { ThemePackDialog } from "../theme-pack-dialog/index.js";
 *   const ThemePackDialogSlot: ThemePackDialogComponent | null = ThemePackDialog;
 *
 * While `null`, the browse-all grid button renders disabled and nothing
 * mounts at the render point below.
 */
const ThemePackDialogSlot: ThemePackDialogComponent | null = null;

/** Browse-all grid icon (2×2 rounded squares) — local like the theme-toggle
 *  sun/moon icons; `../icons` has no grid glyph and this stays private. */
function GridIcon({ className }: { className?: string }): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={className || undefined}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

/** Launcher glyph — a paint-swatch/palette circle. */
function PaletteIcon({ className }: { className?: string }): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={className || undefined}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-1.5 3.3c.5.6.2 1.7-.7 1.7H12z"
      />
      <circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const CONTROL_BUTTON_CLASS =
  "flex items-center gap-hsp-xs rounded border border-muted bg-bg px-hsp-md py-hsp-2xs text-caption text-fg transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const ICON_BUTTON_CLASS =
  "flex items-center justify-center rounded p-hsp-2xs text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";

/**
 * The bottom-right theme-pack switcher flyout. Mounted (settings-gated on
 * `themePackSwitcher`) by the package body-end islands via
 * `Island({ when: "load" })` — see
 * `../doc-body-end-islands/theme-pack-switcher-island.tsx`.
 */
export function ThemePackSwitcher({ active, order, base }: ThemePackSwitcherProps): JSX.Element {
  // Initial state must match the server render (hydration safety): card
  // closed, active = the SSR-configured slug. The user's stored pack is
  // synced from the DOM in the effect below.
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState(active);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Live sync: DOM value now + on every committed switch (any surface).
  useEffect(() => connectActivePackSync(setActiveSlug), []);

  // Escape closes the open card and returns focus to the launcher. Not
  // registered while the browse-all dialog is open — the dialog owns its own
  // Escape handling (#2825).
  useEffect(() => {
    if (!open || dialogOpen) return undefined;
    return connectEscapeToClose(() => {
      setOpen(false);
      launcherRef.current?.focus();
    });
  }, [open, dialogOpen]);

  // Keyboard accessibility: opening moves focus into the card (tabindex=-1
  // container) so Tab reaches Prev/Next/browse/✕ immediately.
  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open]);

  const entry = resolveActiveEntry(order, activeSlug);

  function cycle(step: 1 | -1): void {
    const target = step === 1 ? nextPackSlug(order, activeSlug) : prevPackSlug(order, activeSlug);
    // Display state advances via the theme-pack-changed event only — a
    // rejected/failed apply must not move the card (ADR Decision 3).
    if (target !== null && target !== activeSlug) void applyThemePack(target);
  }

  function closeCard(): void {
    setOpen(false);
    launcherRef.current?.focus();
  }

  function openDialog(): void {
    // The centered dialog replaces the flyout card on screen; closing the
    // card keeps exactly one Escape target active at a time.
    setOpen(false);
    setDialogOpen(true);
  }

  return (
    <div class="fixed right-hsp-lg bottom-hsp-lg z-popover flex flex-col items-end gap-vsp-2xs">
      {open ? (
        <div
          ref={cardRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Theme pack switcher"
          class="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-vsp-2xs rounded-lg border border-muted bg-surface p-hsp-lg shadow-lg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <div class="flex items-start justify-between gap-hsp-sm">
            <p class="text-body font-bold text-fg" aria-live="polite">
              {entry?.name ?? activeSlug}
            </p>
            <div class="flex shrink-0 items-center gap-hsp-2xs">
              <button
                type="button"
                aria-label="Browse all theme packs"
                title="Browse all theme packs"
                disabled={ThemePackDialogSlot === null}
                onClick={openDialog}
                class={ICON_BUTTON_CLASS}
              >
                <GridIcon className="h-icon-sm w-icon-sm" />
              </button>
              <button
                type="button"
                aria-label="Close theme pack switcher"
                title="Close"
                onClick={closeCard}
                class={ICON_BUTTON_CLASS}
              >
                <Close className="h-icon-sm w-icon-sm" />
              </button>
            </div>
          </div>
          {entry !== null && (
            <span class="self-start rounded-full border border-muted px-hsp-sm text-micro tracking-wide text-muted uppercase">
              {entry.mode === "dark" ? "Dark" : "Light"}
            </span>
          )}
          {entry !== null && entry.description !== "" && (
            <p class="text-caption text-muted">{entry.description}</p>
          )}
          <div class="flex items-center justify-between gap-hsp-sm">
            <button
              type="button"
              aria-label="Previous theme pack"
              disabled={order.length < 2}
              onClick={() => cycle(-1)}
              class={CONTROL_BUTTON_CLASS}
            >
              <ChevronLeft className="h-icon-xs w-icon-xs" />
              Prev
            </button>
            <button
              type="button"
              aria-label="Next theme pack"
              disabled={order.length < 2}
              onClick={() => cycle(1)}
              class={CONTROL_BUTTON_CLASS}
            >
              Next
              <ChevronRight className="h-icon-xs w-icon-xs" />
            </button>
          </div>
        </div>
      ) : null}
      <button
        ref={launcherRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Theme pack switcher"
        title="Theme packs"
        onClick={() => setOpen(!open)}
        class="flex h-10 w-10 items-center justify-center rounded-full border border-muted bg-surface text-fg shadow-lg transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        <PaletteIcon className="h-icon-md w-icon-md" />
      </button>
      {/* #2825 dialog render point — see the ThemePackDialogSlot seam note. */}
      {ThemePackDialogSlot !== null ? (
        <ThemePackDialogSlot
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          order={order}
          active={activeSlug}
          base={base}
        />
      ) : null}
    </div>
  );
}
// Pin the island marker name regardless of bundler identifier mangling —
// zfb's Island() derives the SSR marker via `displayName ?? name`
// (zudolab/zudo-doc#1446; the theme-toggle precedent).
ThemePackSwitcher.displayName = "ThemePackSwitcher";
