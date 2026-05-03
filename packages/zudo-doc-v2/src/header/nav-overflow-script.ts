// Inline-script source for the desktop-nav overflow controller.
//
// In the original `header.astro` template the script lived directly
// inside a `<script>` tag (which Astro pipes through the bundler). For
// the JSX port we emit the same logic verbatim via
// `dangerouslySetInnerHTML`, so the value below is plain ECMAScript —
// any TypeScript-only constructs (generic params, type casts, parameter
// type annotations) have been dropped so the browser can parse it
// directly.
//
// The behaviour matches the original modulo lifecycle vocabulary:
//   1. Locate the `[data-header-nav]` flex container, its `[data-nav-more]`
//      overflow trigger, and its dropdown menu.
//   2. Measure each top-level nav item, then greedily hide items that
//      would overflow and rebuild the "..." dropdown to mirror them
//      (including the bold-parent + indented-children pattern for
//      `[data-nav-item-dropdown]` entries).
//   3. Wire toggle / outside-click / Escape handlers to the overflow
//      menu and aria-expanded state to the in-place dropdowns.
//   4. Re-run on the v2 after-navigate event so the overflow stays
//      correct after a View Transitions navigation. The event name is
//      pulled from `AFTER_NAVIGATE_EVENT` in
//      `transitions/page-events.ts` (today: `DOMContentLoaded`) rather
//      than a hard-coded `astro:*` literal — see that module for the
//      vocabulary rationale.
//
// Kept as a separate module (rather than inlined in `header.tsx`) so
// the JSX file stays focused on markup and so future edits to the
// script can be reviewed in isolation.

import { AFTER_NAVIGATE_EVENT } from "../transitions/page-events.js";

export const NAV_OVERFLOW_SCRIPT = `(function () {
  var cleanupNavOverflow = null;

  function initNavOverflow() {
    if (cleanupNavOverflow) cleanupNavOverflow();

    var nav = document.querySelector("[data-header-nav]");
    var moreContainer = document.querySelector("[data-nav-more]");
    var moreMenu = document.querySelector("[data-nav-more-menu]");
    var moreToggle = document.querySelector("[data-nav-more-toggle]");
    if (!nav || !moreContainer || !moreMenu || !moreToggle) return;

    var items = Array.from(nav.querySelectorAll(":scope > [data-nav-item]"));
    if (items.length === 0) return;

    var controller = new AbortController();

    function update() {
      items.forEach(function (el) { el.style.display = ""; });
      moreContainer.style.display = "";
      moreMenu.innerHTML = "";
      moreMenu.classList.add("hidden");
      moreToggle.setAttribute("aria-expanded", "false");

      var itemWidths = items.map(function (el) { return el.offsetWidth; });
      var moreWidth = moreContainer.offsetWidth;
      var navGap = parseFloat(getComputedStyle(nav).columnGap) || 0;
      var available = nav.clientWidth;

      if (available <= 0) {
        moreContainer.style.display = "none";
        return;
      }

      var total = 0;
      for (var i = 0; i < itemWidths.length; i++) {
        total += itemWidths[i] + (i > 0 ? navGap : 0);
      }

      if (total <= available) {
        moreContainer.style.display = "none";
        return;
      }

      var used = 0;
      var cutoffIndex = 0;

      for (var i2 = 0; i2 < items.length; i2++) {
        var w = itemWidths[i2] + (i2 > 0 ? navGap : 0);
        if (used + w > available - moreWidth - navGap) break;
        used += w;
        cutoffIndex = i2 + 1;
      }

      for (var i3 = cutoffIndex; i3 < items.length; i3++) {
        items[i3].style.display = "none";
      }

      for (var i4 = cutoffIndex; i4 < items.length; i4++) {
        var el = items[i4];
        var isDropdown = el.hasAttribute("data-nav-item-dropdown");

        if (isDropdown) {
          var parentLink = el.querySelector(":scope > a");
          var childLinks = el.querySelectorAll(":scope > div a");
          if (parentLink) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = parentLink.href;
            var parentText = parentLink.textContent ? parentLink.textContent.trim().replace(/\\s+/g, " ") : "";
            a.textContent = parentText;
            a.className = "block px-hsp-md py-vsp-2xs text-small font-bold hover:bg-accent/10 hover:underline focus-visible:underline text-fg";
            if (parentLink.getAttribute("aria-current") === "page") {
              a.className += " text-accent";
            }
            li.appendChild(a);
            moreMenu.appendChild(li);
          }
          childLinks.forEach(function (child) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = child.href;
            a.textContent = child.textContent ? child.textContent.trim() : "";
            var isChildActive = child.hasAttribute("data-active");
            a.className = isChildActive
              ? "block pl-hsp-xl pr-hsp-md py-vsp-2xs text-small font-bold text-accent hover:bg-accent/10 hover:underline focus-visible:underline"
              : "block pl-hsp-xl pr-hsp-md py-vsp-2xs text-small text-muted hover:bg-accent/10 hover:text-fg hover:underline focus-visible:underline";
            li.appendChild(a);
            moreMenu.appendChild(li);
          });
        } else {
          var anchor = el;
          var li2 = document.createElement("li");
          var a2 = document.createElement("a");
          a2.href = anchor.href;
          a2.textContent = anchor.textContent ? anchor.textContent.trim() : "";
          a2.className = "block px-hsp-md py-vsp-2xs text-small hover:bg-accent/10 hover:underline focus-visible:underline text-fg";
          if (anchor.getAttribute("aria-current") === "page") {
            a2.className += " font-bold text-accent";
          }
          li2.appendChild(a2);
          moreMenu.appendChild(li2);
        }
      }
    }

    moreToggle.addEventListener("click", function () {
      var isOpen = !moreMenu.classList.contains("hidden");
      moreMenu.classList.toggle("hidden", isOpen);
      moreToggle.setAttribute("aria-expanded", String(!isOpen));
    }, { signal: controller.signal });

    document.addEventListener("click", function (e) {
      if (!moreContainer.contains(e.target)) {
        moreMenu.classList.add("hidden");
        moreToggle.setAttribute("aria-expanded", "false");
      }
    }, { signal: controller.signal });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!moreMenu.classList.contains("hidden")) {
        moreMenu.classList.add("hidden");
        moreToggle.setAttribute("aria-expanded", "false");
        moreToggle.focus();
        return;
      }
      var active = document.activeElement;
      var dropdown = active && active.closest ? active.closest("[data-nav-item-dropdown]") : null;
      if (dropdown && active && active.blur) {
        active.blur();
      }
    }, { signal: controller.signal });

    var dropdowns = nav.querySelectorAll("[data-nav-item-dropdown]");
    dropdowns.forEach(function (dd) {
      var trigger = dd.querySelector(":scope > a");
      if (!trigger) return;
      function setExpanded(v) {
        trigger.setAttribute("aria-expanded", String(v));
      }
      dd.addEventListener("mouseenter", function () { setExpanded(true); }, { signal: controller.signal });
      dd.addEventListener("mouseleave", function () { setExpanded(false); }, { signal: controller.signal });
      dd.addEventListener("focusin", function () { setExpanded(true); }, { signal: controller.signal });
      dd.addEventListener("focusout", function (e) {
        if (!dd.contains(e.relatedTarget)) {
          setExpanded(false);
        }
      }, { signal: controller.signal });
    });

    var ro = new ResizeObserver(update);
    ro.observe(nav);
    controller.signal.addEventListener("abort", function () { ro.disconnect(); });

    document.fonts.ready.then(update);

    update();

    cleanupNavOverflow = function () { controller.abort(); };
  }

  initNavOverflow();
  document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)}, initNavOverflow);
})();`;
