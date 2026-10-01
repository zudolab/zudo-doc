"use client";

/** @jsxRuntime automatic */
import { computed, getScope, signal, type Ref } from "@takazudo/zfb/zudo-react";
// `ensureNestedIslandPropsRefresh` is imported through the barrel (not the
// deep `./nested-island-props-refresh.js` path) on purpose: eject rewrites
// EVERY `../transitions/<anything>.js` import to the single specifier
// `@takazudo/zudo-doc/transitions`, so two distinct relative imports would
// collapse into duplicate import statements in an ejected copy.
import { AFTER_NAVIGATE_EVENT, ensureNestedIslandPropsRefresh } from "../transitions/index.js";
import { SidebarTree } from "../sidebar-tree-island/index.js";
import type { ThemeToggleLabels } from "../theme-toggle/index.js";
import type { SidebarNavNode, SidebarRootMenuItem, SidebarLocaleLink } from "../sidebar/types.js";
import type { ResolvedDateFormats } from "../settings.js";

// This island lives inside the persisted `<header>`. Install the shared
// document-lifetime preparation helper eagerly and idempotently so the native
// zfb 3.1 lifecycle can retain unchanged nested islands and recreate this one
// when its serialized page props change. SSR evaluation is a safe no-op.
ensureNestedIslandPropsRefresh();

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

// Icon visibility deliberately does NOT ride on the `.hidden` utility.
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
// boundary inside this island's `data-props` attribute. The island marker
// serializes the component's own props, not a child's props hidden inside
// `children`; passing SidebarTree that way drops its data at hydration.
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
  themeLabels?: ThemeToggleLabels;
  themeRespectSystem?: boolean;
  /**
   * Forwarded verbatim to the hosted `<SidebarTree>`. The same-locale header
   * may persist across a soft navigation; zfb 3.1 keeps this island live when
   * its effective props are unchanged and recreates it from incoming props
   * when page data changes. The locale-keyed header persistence key prevents
   * locale-specific props from crossing locales.
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
  themeLabels,
  themeRespectSystem,
  dateFormats,
}: SidebarToggleProps) {
  // State starts closed on the server and client so the hydration markup is
  // byte-stable. The tree stays mounted inside this island and receives the
  // page props directly; it is not wrapped in another Island.
  const open = signal(false);
  const hamburgerRef: Ref<HTMLButtonElement> = { current: null };
  const closeIconRef: Ref<SVGSVGElement> = { current: null };
  const menuIconRef: Ref<SVGSVGElement> = { current: null };
  const scope = getScope();

  // Keep the v2 body-scroll behavior and always release the lock when this
  // scope closes or is disposed.
  scope.effect(() => {
    const isOpen = open.value;
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (isOpen) closeIconRef.current?.style.removeProperty("display");
    else closeIconRef.current?.style.setProperty("display", "none");
    if (isOpen) menuIconRef.current?.style.setProperty("display", "none");
    else menuIconRef.current?.style.removeProperty("display");
    return () => {
      document.body.style.overflow = "";
    };
  });

  // Close the mobile drawer after a client-side route swap.
  scope.onActivate(() => {
    const handleSwap = () => {
      open.value = false;
    };
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleSwap);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handleSwap);
  });

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
  scope.effect(() => {
    if (!open.value) return;
    function handleKeyDown(event: Event) {
      const keyboard = event as KeyboardEvent;
      // An Escape that ends an IME composition belongs to the composition, not
      // to the drawer: cancelling a Japanese conversion in the drawer's own
      // "Filter navigation" input would otherwise dismiss the whole drawer and
      // yank focus to the hamburger. Same guard the sibling document-level
      // shortcut in `sidebar-tree-island/index.tsx` already uses.
      if (keyboard.isComposing) return;
      // A nested popover (the Appearance menu, or its trigger button) that
      // owns this Escape already called preventDefault() + stopPropagation()
      // to consume it for itself — see theme-toggle/index.tsx. Respecting
      // defaultPrevented here establishes layered Escape ownership: the first
      // Escape closes only the nested layer, and only a second, unconsumed
      // Escape reaches the drawer (zudolab/zudo-doc#4393).
      if (keyboard.defaultPrevented) return;
      if (keyboard.key === "Escape") {
        open.value = false;
        hamburgerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  const isClosed = computed(() => !open.value);
  const toggleClass = computed(() =>
    cx(
      "lg:hidden shrink-0 px-hsp-sm py-vsp-xs -ml-hsp-sm mr-hsp-sm text-muted hover:text-fg",
      open.value && "relative z-modal",
    ),
  );
  const backdropClass = computed(() =>
    cx(
      "fixed inset-0 z-modal-backdrop bg-overlay/30 lg:hidden",
      !open.value && "hidden",
    ),
  );
  const panelClass = computed(() => `
          fixed top-[3.5rem] left-0 z-modal h-[calc(100vh_-_3.5rem)] w-[16rem] flex flex-col
          border-r border-muted bg-bg transition-transform duration-200
          lg:hidden
          ${open.value ? "translate-x-0" : "-translate-x-full"}
        `);
  return (
    <>
      {/* Hamburger button - visible only on mobile.
          Both icons are always rendered so the SSR output has the same
          DOM shape as the hydrated tree. The inactive one is hidden
          via an inline `display:none` (see HIDDEN_ICON_STYLE above), so
          zudo-react hydrates byte-stable markup and keeps the click handler
          attached. */}
      <button
        ref={hamburgerRef}
        type="button"
        on:click={() => {
          open.value = !open.value;
        }}
        class={toggleClass}
        aria-label={computed(() =>
          open.value ? "Close sidebar" : "Open sidebar",
        )}
        aria-expanded={computed(() => (open.value ? "true" : "false"))}
      >
        {/* X icon — visible only when open */}
        <svg
          ref={closeIconRef}
          class="h-icon-lg w-icon-lg"
          style={HIDDEN_ICON_STYLE}
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width={2}
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        {/* Hamburger icon — visible only when closed */}
        <svg
          ref={menuIconRef}
          class="h-icon-lg w-icon-lg"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width={2}
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
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
          long as the drawer is open (see the button class above). Everything
          else in the header stays dimmed and non-interactive underneath.
          Backdrop tapping and Escape remain valid dismissals
          (zudolab/zudo-doc#4366). */}
      <div
        class={backdropClass}
        aria-hidden={isClosed}
        on:click={() => {
          open.value = false;
        }}
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
        inert={isClosed}
        data-zd-mobile-sidebar
        class={panelClass}
      >
        <div class="flex-1 overflow-y-auto">
          <SidebarTree
            nodes={nodes}
            currentSlug={currentSlug}
            rootMenuItems={rootMenuItems}
            backToMenuLabel={backToMenuLabel}
            locale={locale}
            localeLinks={localeLinks}
            themeDefaultMode={themeDefaultMode}
            themeLabels={themeLabels}
            themeRespectSystem={themeRespectSystem}
            dateFormats={dateFormats}
          />
        </div>
      </aside>
    </>
  );
}
SidebarToggle.displayName = "SidebarToggle";
