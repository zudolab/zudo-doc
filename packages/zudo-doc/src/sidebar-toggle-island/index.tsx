"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Use preact hook entrypoints directly — the "react" → "preact/compat" alias
// lets us consume React-typed components in this Preact app.
import { useState, useEffect, useRef } from "preact/hooks";
// After zudolab/zudo-doc#1335 the host components pull lifecycle event names
// from the v2 transitions module rather than hard-coding `astro:*` literals.
// `ensureNestedIslandPropsRefresh` is imported through the barrel (not the
// deep `./nested-island-props-refresh.js` path) on purpose: eject rewrites
// EVERY `../transitions/<anything>.js` import to the single specifier
// `@takazudo/zudo-doc/transitions`, so two distinct relative imports would
// collapse into duplicate import statements in an ejected copy.
import { AFTER_NAVIGATE_EVENT, ensureNestedIslandPropsRefresh } from "../transitions/index.js";
import { SidebarTree } from "../sidebar-tree-island/index.js";
import type { SidebarNavNode, SidebarRootMenuItem, SidebarLocaleLink } from "../sidebar/types.js";
import type { ResolvedDateFormats } from "../settings.js";

// This island lives INSIDE the persisted `<header>`, so a same-locale swap
// lifts it verbatim and would re-mount it from the previous page's serialized
// props (zudolab/zudo-doc#3525). The refresh has to outlive the island's own
// mount/unmount cycle across a swap, so it is installed at document lifetime
// here rather than from an effect. SSR evaluation is a safe no-op.
ensureNestedIslandPropsRefresh();

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

// Icon visibility deliberately does NOT ride on Tailwind's `.hidden` utility.
// `.hidden` is emitted inside `@layer utilities`, and a consumer component pack
// that ships an UNLAYERED media reset — `img, svg, video, … { display: block }`
// — outranks every layered rule by cascade-layer precedence, no matter the
// source order. Both icons then computed to `display: block`, stacked, and made
// the mobile toggle 48px tall (zudolab/zudo-doc#4355). An inline declaration
// sits above all author rules, layered or not, so the state holds against any
// consumer stylesheet. It is a plain string so SSR and the initial client
// render serialise byte-identically for hydration.
const HIDDEN_ICON_STYLE = "display:none";

// Mobile drawer hosts the SidebarTree directly (rather than receiving it as
// JSX children) so the tree's data props ride across the SSR → hydrate
// boundary inside the Island marker's `data-props` attribute. zfb's
// `Island()` only serialises a child component's *own* props (excluding
// `children`); when SidebarTree was passed as `children`, its data was
// dropped during hydration and Preact wiped the SSR-rendered tree DOM.
// Mirroring the desktop `<Sidebar treeComponent={SidebarTree} ...>` shape
// keeps the data attached to the wrapping island. zudolab/zudo-doc#1355
// wave 13.5.

export interface SidebarToggleProps {
  nodes: SidebarNavNode[];
  currentSlug?: string;
  rootMenuItems?: SidebarRootMenuItem[];
  backToMenuLabel?: string;
  /** Display locale forwarded to the hosted SidebarTree. */
  locale?: string;
  localeLinks?: SidebarLocaleLink[];
  themeDefaultMode?: "light" | "dark";
  /**
   * Forwarded verbatim to the hosted `<SidebarTree>`. This island is the one
   * nested under the persisted `<header>`, so on a same-locale soft navigation
   * its serialized `data-props` is lifted from the previous page and refreshed
   * wholesale by `nested-island-props-refresh` — which carries the resolved
   * patterns along with `nodes`, at no extra cost, because that helper copies
   * the blob rather than enumerating prop names (#4075). The patterns cannot
   * actually differ across such a swap (the persist key is `header-${lang}`,
   * so a locale change is never a persisted swap); what matters is that they
   * are not LOST from the lifted island.
   */
  dateFormats?: ResolvedDateFormats;
}

export function SidebarToggle({
  nodes,
  currentSlug,
  rootMenuItems,
  backToMenuLabel,
  locale,
  localeLinks,
  themeDefaultMode,
  dateFormats,
}: SidebarToggleProps) {
  // Initial state must match SSR (`open=false`) so the hydration DOM
  // matches the SSG output byte-for-byte. The backdrop and toggle-icon
  // are rendered unconditionally below so the hydration tree has the
  // same shape regardless of `open`, preventing Preact from re-mounting
  // the subtree (which can drop click handlers on the hamburger button).
  const [open, setOpen] = useState(false);
  // Focus-restore target for the Escape handler below. A `ref` does not
  // serialise, so SSR/hydration markup is unaffected (zudolab/zudo-doc#4366).
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close mobile sidebar on View Transition navigation
  useEffect(() => {
    function handleSwap() {
      setOpen(false);
    }
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleSwap);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handleSwap);
  }, []);

  // Escape-to-close (zudolab/zudo-doc#4366). Deliberately inlined rather than
  // reusing `connectEscapeToClose` from theme-pack-switcher/switcher-state.js
  // — this island is ejectable and eject's `rewireImports` would rewrite that
  // relative import to `@takazudo/zudo-doc/theme-pack-switcher`, a subpath
  // absent from the package's `exports` map, shipping a broken ejected copy.
  // The listener is registered only while `open` is true: a closed drawer
  // must never swallow an Escape meant for another document-level listener
  // (language switcher, find bar, theme-pack flyout). Focus is restored to
  // the hamburger synchronously in the handler — the `<aside>` goes `inert`
  // on close, so without this, focus left inside the drawer would strand on
  // `<body>` and defeat the point of the fix for keyboard/AT users.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        hamburgerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      {/* Hamburger button - visible only on mobile.
          Both icons are always rendered so the SSR output has the same
          DOM shape as the post-hydration tree. The inactive one is hidden
          via an inline `display:none` (see HIDDEN_ICON_STYLE above), so
          Preact's hydration walk sees byte-stable markup and keeps the
          click handler attached. */}
      <button
        ref={hamburgerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cx(
          "lg:hidden shrink-0 px-hsp-sm py-vsp-xs -ml-hsp-sm mr-hsp-sm text-muted hover:text-fg",
          // While open, the button IS the close control (it shows the X), so it
          // has to sit in the drawer's own tier rather than under the backdrop —
          // `z-modal-backdrop` (50) otherwise intercepts every pointer event at
          // the button's own centre and the X is unclickable
          // (zudolab/zudo-doc#4369). `relative` is required: a bare `z-index`
          // has no effect on a statically-positioned element.
          // Conditioning on `open` is load-bearing, not cosmetic: SSR always
          // renders `open=false`, so the closed-state markup stays
          // byte-identical (hydration-stable, and the A2 no-stub parity hashes
          // for this directory do not move).
          open && "relative z-modal",
        )}
        aria-label={open ? "Close sidebar" : "Open sidebar"}
        aria-expanded={open}
      >
        {/* X icon — visible only when open */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-icon-lg w-icon-lg"
          style={open ? undefined : HIDDEN_ICON_STYLE}
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        {/* Hamburger icon — visible only when closed */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-icon-lg w-icon-lg"
          style={open ? HIDDEN_ICON_STYLE : undefined}
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Backdrop overlay - mobile only.
          Rendered unconditionally; CSS `hidden` toggles visibility so
          the SSR DOM tree matches the hydrated tree (no subtree
          mount/unmount across the hydration boundary).
          `z-modal-backdrop` (50) intentionally sits ABOVE the header
          (`z-toolbar`, 20): the open mobile drawer is a modal surface that
          dims the whole viewport, header included. The toggle button is the
          one exception — while open it renders the X and advertises itself as
          the close control, so it is lifted to `z-modal` (60) for exactly as
          long as the drawer is open (see its className above). Everything else
          in the header stays dimmed and non-interactive underneath.
          Backdrop tapping (onClick below) remains a valid dismissal, as does
          Escape (zudolab/zudo-doc#4366). */}
      <div
        className={cx("fixed inset-0 z-modal-backdrop bg-overlay/30 lg:hidden", !open && "hidden")}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar panel - mobile only (desktop sidebar is in doc-layout).
          `inert` when closed: the panel is only visually hidden via
          `-translate-x-full`, so without `inert` its links/filter/buttons
          stay in the tab order and accessibility tree while off-screen
          (zudolab/zudo-doc#2059). `inert={false}` serialises to no attribute,
          so the SSR (open=false → `inert`) and initial client render stay
          byte-stable for hydration.
          `data-zd-mobile-sidebar` is the stable theme-pack hook for this
          drawer — the mobile counterpart of the desktop `#desktop-sidebar`,
          which has no id of its own here (zudolab/zudo-doc#2887). Unlike
          `inert` it is UNCONDITIONAL, so it is hydration-stable by
          construction: it does not vary with `open`. */}
      <aside
        inert={!open}
        data-zd-mobile-sidebar
        className={`
          fixed top-[3.5rem] left-0 z-modal h-[calc(100vh-3.5rem)] w-[16rem] flex flex-col
          border-r border-muted bg-bg transition-transform duration-200
          lg:hidden
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex-1 overflow-y-auto">
          <SidebarTree
            nodes={nodes}
            currentSlug={currentSlug}
            rootMenuItems={rootMenuItems}
            backToMenuLabel={backToMenuLabel}
            locale={locale}
            localeLinks={localeLinks}
            themeDefaultMode={themeDefaultMode}
            dateFormats={dateFormats}
          />
        </div>
      </aside>
    </>
  );
}
SidebarToggle.displayName = "SidebarToggle";
