// Sidebar width resizer for the desktop documentation layout.
//
// Background
// ----------
// The Astro version shipped this as `src/scripts/sidebar-resizer.ts`,
// invoked from the doc layout on initial load and on the page-navigate-
// end event. In the zfb-based v2 stack `AFTER_NAVIGATE_EVENT` from
// `../transitions/page-events.ts` (today: `DOMContentLoaded`) is the
// successor to Astro's `astro:after-swap`. The layout owner is
// responsible for calling `initSidebarResizer()` on first load and
// again after each cross-page View Transition swap. The function is
// idempotent — repeated calls on the same DOM are safe — so the caller
// can hook it into whatever post-navigate signal their router uses.
//
// What the resizer does
// ---------------------
// Finds `#desktop-sidebar` and grafts a 6px-wide drag handle onto its
// right edge. The handle:
//
//   * is keyboard-accessible (tab into it, then Arrow keys / Home / End
//     to step the width by `STEP` pixels, clamped to MIN_W…MAX_W),
//   * supports pointer dragging with a fixed-position "ghost" line that
//     tracks the cursor without forcing layout reflow on every move,
//   * persists the chosen width to `localStorage` under
//     `zudo-doc-sidebar-width`, and writes the live value to the
//     `--zd-sidebar-w` CSS custom property on `:root` so the layout
//     reflects it immediately.
//
// Why the explicit width range
// ----------------------------
// The CSS default is `clamp(14rem, 20vw, 22rem)` (224–352px at the
// default 16px root size). The resizer intentionally allows a wider
// range (192–448px) than that responsive default — the user opted into
// a manual width by dragging or arrowing, so we let them go below or
// above the responsive band.
//
// Why no auto-restore at boot
// ---------------------------
// The persisted value is read indirectly: the consuming layout is
// expected to apply the saved `--zd-sidebar-w` before paint (e.g. via
// an inline pre-hydration script). This module only mutates the value
// in response to explicit user input. That keeps the module a pure
// "wire up the handle" concern and avoids a flash-of-unstyled-width on
// first paint that would happen if we tried to restore here.
//
// Re-entrancy
// -----------
// Subsequent calls find the existing `[data-sidebar-resizer]` handle
// already attached and bail out early. This matches how the Astro
// version was wired (initial call + post-navigate rebind via
// `AFTER_NAVIGATE_EVENT`).

const SIDEBAR_ID = "desktop-sidebar";
const HANDLE_MARKER = "data-sidebar-resizer";

const MIN_W = 192;
const MAX_W = 448;
const STEP = 10;

const LS_KEY = "zudo-doc-sidebar-width";
const CSS_PROP = "--zd-sidebar-w";

// These reuse the design-token accent color when it's present and fall
// back to neutral grays so the handle is still visible on any palette.
const ACCENT_BG = "var(--zd-accent, rgba(128,128,128,0.3))";
const ACCENT_OUTLINE = "2px solid var(--zd-accent, rgba(128,128,128,0.5))";
const ACCENT_GHOST = "var(--zd-accent, rgba(128,128,128,0.5))";

/**
 * Attach the sidebar drag handle to `#desktop-sidebar`. Idempotent —
 * safe to call repeatedly (e.g. after each route swap). No-op if the
 * sidebar element is missing or the handle is already in place.
 *
 * Designed to be called from the browser only. Guards against `document`
 * being undefined so accidental SSR invocation does not throw.
 */
export function initSidebarResizer(): void {
  if (typeof document === "undefined") return;

  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar || sidebar.querySelector(`[${HANDLE_MARKER}]`)) return;

  function readCurrentWidth(): number {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      CSS_PROP,
    );
    return raw ? parseFloat(raw) || MIN_W : MIN_W;
  }

  let cachedWidth = readCurrentWidth();

  const handle = document.createElement("div");
  handle.setAttribute(HANDLE_MARKER, "");
  handle.setAttribute("tabindex", "0");
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", "Resize sidebar");
  handle.setAttribute("aria-valuemin", String(MIN_W));
  handle.setAttribute("aria-valuemax", String(MAX_W));
  handle.setAttribute("aria-valuenow", String(Math.round(cachedWidth)));
  Object.assign(handle.style, {
    position: "absolute",
    top: "0",
    right: "0",
    width: "6px",
    height: "100%",
    cursor: "col-resize",
    zIndex: "10",
    transition: "background 0.15s",
  });

  let dragging = false;
  let focused = false;

  function applyWidth(w: number): void {
    cachedWidth = Math.max(MIN_W, Math.min(MAX_W, w));
    document.documentElement.style.setProperty(CSS_PROP, cachedWidth + "px");
    // Storage can throw in privacy modes / disabled-storage browsers.
    // The visual update has already happened, so silently swallow.
    try {
      localStorage.setItem(LS_KEY, String(Math.round(cachedWidth)));
    } catch {
      /* ignore */
    }
    handle.setAttribute("aria-valuenow", String(Math.round(cachedWidth)));
  }

  function updateHandleVisual(): void {
    if (dragging || focused) {
      handle.style.background = ACCENT_BG;
    } else {
      handle.style.background = "";
    }
    handle.style.outline = focused && !dragging ? ACCENT_OUTLINE : "";
    handle.style.outlineOffset = focused && !dragging ? "1px" : "";
  }

  handle.addEventListener("focus", () => {
    focused = true;
    updateHandleVisual();
  });
  handle.addEventListener("blur", () => {
    focused = false;
    updateHandleVisual();
  });

  handle.addEventListener("keydown", (e: KeyboardEvent) => {
    let w = cachedWidth;
    switch (e.key) {
      case "ArrowLeft":
        w = Math.max(MIN_W, w - STEP);
        break;
      case "ArrowRight":
        w = Math.min(MAX_W, w + STEP);
        break;
      case "Home":
        w = MIN_W;
        break;
      case "End":
        w = MAX_W;
        break;
      default:
        return;
    }
    e.preventDefault();
    applyWidth(w);
  });

  handle.addEventListener("mouseenter", () => {
    if (!dragging && !focused) handle.style.background = ACCENT_BG;
  });
  handle.addEventListener("mouseleave", () => {
    if (!dragging && !focused) handle.style.background = "";
  });

  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    dragging = true;
    updateHandleVisual();
    document.documentElement.style.cursor = "col-resize";
    document.documentElement.style.userSelect = "none";

    // Ghost line — cheap to move (no reflow), shows the target position
    // while the actual sidebar width is only committed on pointerup.
    const ghost = document.createElement("div");
    Object.assign(ghost.style, {
      position: "fixed",
      top: "0",
      width: "2px",
      height: "100vh",
      background: ACCENT_GHOST,
      pointerEvents: "none",
      zIndex: "9999",
    });
    const sidebarRect = sidebar.getBoundingClientRect();
    const sidebarLeft = sidebarRect.left;
    ghost.style.left = sidebarLeft + sidebarRect.width + "px";
    document.body.appendChild(ghost);
    let targetWidth = 0;

    const onMove = (ev: PointerEvent) => {
      targetWidth = Math.max(
        MIN_W,
        Math.min(MAX_W, ev.clientX - sidebarLeft),
      );
      ghost.style.left = sidebarLeft + targetWidth + "px";
    };

    const cleanup = () => {
      dragging = false;
      updateHandleVisual();
      document.documentElement.style.cursor = "";
      document.documentElement.style.userSelect = "";
      ghost.remove();
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      handle.removeEventListener("lostpointercapture", onCancel);
    };

    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      cleanup();
      if (targetWidth > 0) {
        applyWidth(targetWidth);
      }
    };

    const onCancel = () => {
      cleanup();
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
    handle.addEventListener("lostpointercapture", onCancel);
  });

  sidebar.appendChild(handle);
}

export { SidebarResizerInit, SIDEBAR_RESIZER_INIT_SCRIPT } from "./sidebar-resizer-init.js";
