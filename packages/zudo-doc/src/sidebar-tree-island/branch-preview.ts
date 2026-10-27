import { computed, signal, type ReadonlySignal, type Ref } from "@takazudo/zfb/zudo-react";

/** Trigger attribute: the tooltip's title text. */
export const TIP_ATTR = "data-sidebar-tip";
/** Trigger attribute: optional secondary tooltip line. */
export const TIP_DETAIL_ATTR = "data-sidebar-tip-detail";

const TRIGGER_SELECTOR = `[${TIP_ATTR}]`;
const FRAME_SELECTOR = "[data-sidebar-focus]";
const POINTER_SHOW_DELAY_MS = 250;
// Long enough to cross the gap from the trigger onto the tooltip.
const HIDE_DELAY_MS = 120;
const GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;

let instanceCount = 0;

export interface BranchPreview {
  /** Occurrence previewed in this sidebar instance, or null. Never persisted or broadcast. */
  active: ReadonlySignal<string | null>;
  clear: () => void;
}

/** Hover preview is mouse/pen only so a touch tap focuses in one step and leaves nothing behind. */
const isHoverPointer = (event: Event) => {
  const type = (event as PointerEvent).pointerType;
  return type === "mouse" || type === "pen";
};

const isFocusVisible = (element: Element) => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
};

const isActionableFrame = (element: Element) =>
  element.matches(FRAME_SELECTOR) && element.getAttribute("aria-disabled") !== "true";

const previewKey = (element: Element) =>
  isActionableFrame(element) ? (element as HTMLElement).dataset.sidebarFocusScope || null : null;

/**
 * Transient branch preview + tooltip for one sidebar island instance.
 * Call `activate()` from the island's `onActivate`; it returns the cleanup.
 * The desktop tree and the mobile drawer are separate instances, so each
 * visible sidebar owns at most one preview and one tooltip.
 */
export function createBranchPreview(navRef: Ref<HTMLElement>): BranchPreview & { activate: () => () => void } {
  const pointerKey = signal<string | null>(null);
  const focusKey = signal<string | null>(null);
  // Pointer hover over an actionable frame wins over the keyboard-focused one.
  const active = computed(() => pointerKey.value ?? focusKey.value);
  let tooltip: HTMLElement | null = null;
  let owner: HTMLElement | null = null;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const hideTooltip = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (owner?.getAttribute("aria-describedby") === tooltip?.id) owner?.removeAttribute("aria-describedby");
    owner = null;
    if (tooltip) tooltip.hidden = true;
  };

  const clear = () => {
    pointerKey.value = null;
    focusKey.value = null;
    hideTooltip();
  };

  const place = (trigger: HTMLElement, tip: HTMLElement) => {
    // Measure from the origin: a stale right-side `left` would shrink-wrap the
    // fixed tooltip to the remaining viewport width.
    tip.style.left = "0px";
    tip.style.top = "0px";
    const anchor = trigger.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const maxLeft = window.innerWidth - box.width - VIEWPORT_MARGIN_PX;
    // Start past the sidebar's edge so the hoverable tooltip never covers the
    // row's disclosure, which sits right beside the frame.
    const edge = Math.max(anchor.right, navRef.current?.getBoundingClientRect().right ?? anchor.right);
    let left = edge + GAP_PX;
    let top = anchor.top + anchor.height / 2 - box.height / 2;
    // No room beside the trigger (narrow drawer): drop below it instead.
    if (left > maxLeft) {
      left = Math.max(VIEWPORT_MARGIN_PX, Math.min(anchor.left + anchor.width / 2 - box.width / 2, maxLeft));
      top = anchor.bottom + GAP_PX;
      if (top + box.height > window.innerHeight - VIEWPORT_MARGIN_PX) top = anchor.top - GAP_PX - box.height;
    }
    top = Math.max(VIEWPORT_MARGIN_PX, Math.min(top, window.innerHeight - box.height - VIEWPORT_MARGIN_PX));
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  };

  const showTooltip = (trigger: HTMLElement) => {
    if (!tooltip) return;
    clearTimeout(hideTimer);
    if (owner && owner !== trigger && owner.getAttribute("aria-describedby") === tooltip.id) owner.removeAttribute("aria-describedby");
    owner = trigger;
    const title = document.createElement("strong");
    title.textContent = trigger.getAttribute(TIP_ATTR) ?? "";
    const parts: Node[] = [title];
    const detail = trigger.getAttribute(TIP_DETAIL_ATTR);
    if (detail) {
      const line = document.createElement("span");
      line.textContent = detail;
      parts.push(line);
    }
    tooltip.replaceChildren(...parts);
    tooltip.hidden = false;
    trigger.setAttribute("aria-describedby", tooltip.id);
    place(trigger, tooltip);
  };

  const scheduleHide = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideTooltip, HIDE_DELAY_MS);
  };

  const triggerOf = (target: EventTarget | null) => {
    const nav = navRef.current;
    if (!nav || !(target instanceof Element)) return null;
    const trigger = target.closest<HTMLElement>(TRIGGER_SELECTOR);
    return trigger && nav.contains(trigger) ? trigger : null;
  };

  const activate = () => {
    const tip = document.createElement("div");
    tip.id = `zd-sidebar-tip-${++instanceCount}`;
    tip.setAttribute("role", "tooltip");
    tip.setAttribute("data-sidebar-tooltip", "");
    tip.hidden = true;
    document.body.append(tip);
    tooltip = tip;

    const onPointerOver = (event: Event) => {
      const trigger = triggerOf(event.target);
      if (!trigger || !isHoverPointer(event) || trigger.contains((event as PointerEvent).relatedTarget as Node | null)) return;
      pointerKey.value = previewKey(trigger);
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      if (owner === trigger && !tip.hidden) return;
      showTimer = setTimeout(() => showTooltip(trigger), POINTER_SHOW_DELAY_MS);
    };
    const onPointerOut = (event: Event) => {
      const trigger = triggerOf(event.target);
      const next = (event as PointerEvent).relatedTarget as Node | null;
      if (!trigger || trigger.contains(next)) return;
      pointerKey.value = null;
      // Moving onto the tooltip keeps it open (hoverable content).
      if (next && tip.contains(next)) return;
      if (owner === trigger && trigger === document.activeElement && isFocusVisible(trigger)) return;
      scheduleHide();
    };
    const onFocusIn = (event: Event) => {
      const trigger = triggerOf(event.target);
      if (!trigger || !isFocusVisible(trigger)) return;
      focusKey.value = previewKey(trigger);
      clearTimeout(showTimer);
      showTooltip(trigger);
    };
    const onFocusOut = (event: Event) => {
      const trigger = triggerOf(event.target);
      if (!trigger) return;
      focusKey.value = null;
      if (owner === trigger) scheduleHide();
    };
    const onTipEnter = () => clearTimeout(hideTimer);
    const onTipLeave = (event: Event) => {
      const next = (event as PointerEvent).relatedTarget as Node | null;
      if (owner && next && owner.contains(next)) return;
      if (owner && owner === document.activeElement && isFocusVisible(owner)) return;
      scheduleHide();
    };
    // Capture phase so an open tooltip consumes the first Escape before the
    // mobile drawer's document listener sees it (that listener honours
    // defaultPrevented — layered Escape ownership, zudolab/zudo-doc#4393).
    const onKeyDown = (event: Event) => {
      const key = event as KeyboardEvent;
      if (key.key !== "Escape" || key.isComposing || tip.hidden) return;
      // Escape aimed at an unrelated surface (e.g. a dialog opened while the
      // pointer still rests on a frame) must reach its own owner.
      const target = key.target;
      if (target instanceof Element && target !== document.body && !navRef.current?.contains(target) && !tip.contains(target)) {
        hideTooltip();
        pointerKey.value = null;
        return;
      }
      key.preventDefault();
      key.stopPropagation();
      hideTooltip();
      pointerKey.value = null;
    };
    // Keyboard focus scrolls the sidebar to reveal its target, so follow the
    // trigger instead of dismissing; a trigger that left the DOM dismisses.
    let scrollFrame = 0;
    const onScroll = () => {
      if (tip.hidden || scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        if (tip.hidden) return;
        if (owner?.isConnected) place(owner, tip);
        else hideTooltip();
      });
    };
    // The drawer stays mounted when closed and goes `inert`; a hidden sidebar
    // must not keep a preview or tooltip.
    // The <nav> sits inside a <Show> (the root-menu view can replace it), so
    // fall back to the drawer itself when the ref is not mounted yet.
    const drawer = navRef.current ? navRef.current.closest("[data-zd-mobile-sidebar]") : document.querySelector("[data-zd-mobile-sidebar]");
    const observer = drawer ? new MutationObserver(() => { if (drawer.hasAttribute("inert")) clear(); }) : undefined;
    observer?.observe(drawer!, { attributes: true, attributeFilter: ["inert"] });
    // The lg breakpoint (Wind `lg:` / features.css) where the drawer and the desktop sidebar swap.
    const media = window.matchMedia?.("(min-width: 1024px)");
    const onBreakpoint = () => clear();
    media?.addEventListener?.("change", onBreakpoint);

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    tip.addEventListener("pointerenter", onTipEnter);
    tip.addEventListener("pointerleave", onTipLeave);
    return () => {
      cancelAnimationFrame(scrollFrame);
      clear();
      observer?.disconnect();
      media?.removeEventListener?.("change", onBreakpoint);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
      tip.remove();
      tooltip = null;
    };
  };

  return { active, clear, activate };
}
