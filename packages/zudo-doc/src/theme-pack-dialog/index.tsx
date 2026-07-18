"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// ThemePackDialog — the browse-all theme-pack grid modal (epic Theme Core
// #2812, sub-issue #2825; ADR `docs/adr/theme-packs.md` Decision 7). Rendered
// INSIDE the #2821 ThemePackSwitcher flyout island's own tree via the
// `ThemePackDialogSlot` seam (`../theme-pack-switcher/index.tsx`) — not a
// separate island registration (island props must stay serializable, so this
// component arrives as a statically-imported value, never a prop). Built on
// `useModalDialog` (the ai-chat-modal pattern): native <dialog>, showModal,
// backdrop-click close, SPA-nav close, focus management.
//
// Data: lazily fetches `{base}theme-packs/index.json` on FIRST open only,
// cached in component state (this component never unmounts — it lives for
// the page's lifetime inside the switcher island — so component state alone
// satisfies "first open only"). Never loads any pack stylesheet or webfont;
// every card paints from the fetched meta's resolved `preview` swatches
// (ADR Decision 1/7, `ThemePackCard`). Clicking a card calls
// `applyThemePack(slug)` and the dialog STAYS OPEN (live comparison is the
// point — close is Esc/backdrop/✕ only); the selected ring only advances
// from the `theme-pack-changed` event (never the click itself), so an
// aborted/failed apply never moves the ring (ADR Decision 3 failure
// semantics).
//
// Use the preact/compat hook entrypoints — matches `useModalDialog`'s own
// React-typed ref shape and the ai-chat-modal precedent this dialog mirrors.

import { useCallback, useEffect, useRef, useState } from "preact/compat";
import { Close } from "../icons/index.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import type { ThemePackMeta } from "../theme-packs-registry/index.js";
import { applyThemePack, DEFAULT_THEME_PACK_SLUG } from "../theme-pack-switcher/theme-pack-sync.js";
import { connectActivePackSync } from "../theme-pack-switcher/switcher-state.js";
import type { ThemePackDialogProps } from "../theme-pack-switcher/index.js";
import { useModalDialog } from "../use-modal-dialog/index.js";
import { parseThemePackRegistryPayload, resolveDialogMode } from "./dialog-state.js";
import { ThemePackCard } from "./theme-pack-card.js";

type RegistryState = "idle" | "loading" | "loaded" | "error";

/** Window event ThemeToggle dispatches after a light/dark toggle (see
 *  `theme-toggle/color-scheme-sync.ts`) — re-declared locally rather than
 *  imported (the `design-token-panel-bootstrap.tsx` convention) so this
 *  dialog depends on only the one piece of that contract it needs: the event
 *  NAME to re-read the active mode by. Cross-package contract — do not
 *  rename. */
const COLOR_SCHEME_CHANGED_EVENT = "color-scheme-changed";

/** Stable selector for the flyout's ALWAYS-mounted round launcher button
 *  (`theme-pack-switcher/index.tsx`) — see the focus-restore note below.
 *  Strictly more precise than the prior `[aria-label="Theme pack switcher"]`
 *  selector: that aria-label value also matches the flyout card (#2873). */
const LAUNCHER_SELECTOR = "[data-switcher-launcher]";

export function ThemePackDialog({ open, onClose, order, active, base }: ThemePackDialogProps) {
  const [registryState, setRegistryState] = useState<RegistryState>("idle");
  const [packs, setPacks] = useState<ThemePackMeta[] | null>(null);
  const [mode, setMode] = useState<"light" | "dark">(() =>
    typeof document === "undefined"
      ? "light"
      : resolveDialogMode(document.documentElement.getAttribute("data-theme")),
  );
  const [activeSlug, setActiveSlug] = useState(active);
  const launcherFocusRef = useRef<HTMLElement | null>(null);

  // Whether there is anything to fetch at all. The theme-packs plugin
  // deliberately emits NEITHER a postBuild `index.json` NOR a devMiddleware
  // route when the resolved `themePacks` census has no CSS-bearing pack (ADR
  // `docs/adr/theme-packs.md` Decision 2: "no-ops when the resolved enabled
  // set contains no CSS-bearing pack, i.e. only `default`"). A site can
  // enable the switcher with e.g. `themePacks: ["default"]` — the flyout's
  // browse-all button isn't gated on `order.length` (that file is out of
  // this sub-issue's scope), so this dialog can still be opened in that
  // configuration. Fetching `theme-packs/index.json` there would always 404;
  // detect it from the SSR `order` prop up front and skip the doomed fetch.
  const hasBrowsablePacks = order.some((entry) => entry.slug !== DEFAULT_THEME_PACK_SLUG);

  // Live sync: the selected ring only ever advances from a COMMITTED switch
  // (flyout Prev/Next, another open dialog card, or this one) — never the
  // click itself, since a failed/aborted apply never fires
  // `theme-pack-changed` (ADR Decision 3).
  useEffect(() => connectActivePackSync(setActiveSlug), []);

  // Repaint cards on a light/dark mode toggle (ADR Decision 7: "re-read on
  // color-scheme-changed so open-dialog cards repaint on a mode toggle").
  useEffect(() => {
    function sync() {
      setMode(resolveDialogMode(document.documentElement.getAttribute("data-theme")));
    }
    window.addEventListener(COLOR_SCHEME_CHANGED_EVENT, sync);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED_EVENT, sync);
  }, []);

  // The flyout closes its own card — unmounting the grid-icon trigger that
  // opened this dialog — in the SAME render pass that opens this dialog
  // (`theme-pack-switcher/index.tsx`'s `openDialog()`), so useModalDialog's
  // default document.activeElement capture would race that unmount and land
  // on <body>. The round launcher button is the one ALWAYS-mounted element
  // left once both the card and this dialog are closed, so resolve it here
  // instead of threading a new prop through the fixed #2825
  // ThemePackDialogProps contract: `returnFocusRef.current` is read lazily at
  // CLOSE time (not open time), so populating it on every open is race-free.
  useEffect(() => {
    if (!open) return;
    launcherFocusRef.current = document.querySelector<HTMLElement>(LAUNCHER_SELECTOR);
  }, [open]);

  // Lazy fetch — FIRST open only, plus an explicit Retry. Split into two
  // effects on purpose: `fetchToken` is the ONLY fetch trigger, bumped either
  // by the first open (guarded by `hasOpenedRef` below) or by `retry()`. The
  // fetch effect must NOT depend on `registryState` even though it sets it —
  // an earlier version did, and `setRegistryState("loading")` inside the
  // effect made it re-run against its own dependency, firing the cleanup
  // (`cancelled = true`) on the in-flight closure before the real fetch ever
  // resolved, so every successful load was silently discarded.
  const hasOpenedRef = useRef(false);
  const [fetchToken, setFetchToken] = useState(0);

  useEffect(() => {
    if (open && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      if (hasBrowsablePacks) setFetchToken((t) => t + 1);
    }
  }, [open, hasBrowsablePacks]);

  useEffect(() => {
    if (fetchToken === 0) return;
    let cancelled = false;
    setRegistryState("loading");
    fetch(`${base}theme-packs/index.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`theme-packs/index.json responded ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        const parsed = parseThemePackRegistryPayload(data);
        if (parsed === null) {
          setRegistryState("error");
          return;
        }
        setPacks(parsed);
        setRegistryState("loaded");
      })
      .catch(() => {
        if (!cancelled) setRegistryState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchToken, base]);

  const retry = useCallback(() => setFetchToken((t) => t + 1), []);

  const { dialogRef, handleBackdropClick } = useModalDialog({
    isOpen: open,
    onClose,
    navigateEvent: AFTER_NAVIGATE_EVENT,
    backdropClickClose: true,
    manageFocus: true,
    returnFocusRef: launcherFocusRef,
  });

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="zd-theme-pack-dialog-title"
      className="z-modal m-auto max-h-[85vh] w-[calc(100vw-2rem)] max-w-[64rem] rounded-lg border border-muted bg-surface p-0 text-fg backdrop:z-modal-backdrop backdrop:bg-bg/80"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex shrink-0 items-center justify-between gap-hsp-sm border-b border-muted px-hsp-lg py-vsp-sm">
          <h2 id="zd-theme-pack-dialog-title" className="text-title font-bold text-fg">
            Preview theme
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="flex items-center justify-center text-muted transition-colors hover:text-fg"
          >
            <Close className="h-icon-sm w-icon-sm" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-hsp-lg py-vsp-lg">
          {!hasBrowsablePacks ? (
            <p className="py-vsp-xl text-center text-small text-muted">
              No other theme packs are configured — only the default look is available.
            </p>
          ) : (
            <>
              {registryState === "error" && (
                <div
                  role="alert"
                  className="mx-auto flex max-w-sm flex-col items-center gap-vsp-xs rounded-[0.75rem] border border-danger bg-bg px-hsp-lg py-vsp-lg text-center text-small text-danger"
                >
                  <p>Could not load theme previews.</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded border border-danger px-hsp-md py-hsp-2xs text-caption text-danger transition-colors hover:bg-danger/10"
                  >
                    Retry
                  </button>
                </div>
              )}
              {(registryState === "idle" || registryState === "loading") && (
                <>
                  <p role="status" className="sr-only">
                    Loading theme previews…
                  </p>
                  <div
                    aria-hidden="true"
                    className="grid grid-cols-1 gap-hsp-lg sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {order.map((entry) => (
                      <div
                        key={entry.slug}
                        className="h-40 animate-pulse rounded-lg border border-muted bg-surface/50"
                      />
                    ))}
                  </div>
                </>
              )}
              {packs !== null && (
                <div className="grid grid-cols-1 gap-hsp-lg sm:grid-cols-2 lg:grid-cols-3">
                  {packs.map((meta) => (
                    <ThemePackCard
                      key={meta.slug}
                      meta={meta}
                      mode={mode}
                      isActive={meta.slug === activeSlug}
                      onSelect={() => {
                        void applyThemePack(meta.slug);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
ThemePackDialog.displayName = "ThemePackDialog";
