// Inline-script source for the desktop-nav overflow controller.
//
// In the original `header` template the script lived directly
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
//      correct after an SPA body-swap navigation. The event name is
//      pulled from `AFTER_NAVIGATE_EVENT` in
//      `transitions/page-events.ts` (today: `zfb:after-swap`) rather
//      than a hard-coded `astro:*` literal — see that module for the
//      vocabulary rationale. The first-paint init relies on the
//      top-level `initNavOverflow()` call further down (after-swap
//      does NOT fire on the initial page load).
//
// Kept as a separate module (rather than inlined in `header.tsx`) so
// the JSX file stays focused on markup and so future edits to the
// script can be reviewed in isolation.

import { AFTER_NAVIGATE_EVENT } from "../transitions/page-events.js";

export const NAV_OVERFLOW_SCRIPT = `(function () {
  var cleanupNavOverflow = null;

  function trimSlashes(p) {
    while (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
    return p || "/";
  }

  function navPathname(a) {
    try { return trimSlashes(new URL(a.href, location.href).pathname); }
    catch (e) { return ""; }
  }

  function isUnderPath(cur, p) {
    if (!p) return false;
    if (cur === p) return true;
    return p !== "/" && cur.indexOf(p + "/") === 0;
  }

  // Recompute which header nav item is "active" from the CURRENT URL and
  // repaint the highlight. SSR sets the active item on first paint, but the
  // header is persisted across same-locale client-router swaps
  // (data-zfb-transition-persist), so without this the highlight would stay
  // frozen on the page where the header was first rendered. Mirrors the
  // sidebar island's client-side approach (match location.pathname against
  // each entry's href) and the SSR longest-match + dropdown-parent rules.
  // URL-based: hrefs and location.pathname both carry the base + locale
  // prefix, so they compare directly without stripping.
  function applyActiveNav() {
    var nav = document.querySelector("[data-header-nav]");
    if (!nav) return;
    var topItems = Array.from(nav.querySelectorAll(":scope > [data-nav-item]"));
    if (topItems.length === 0) return;

    var cur = trimSlashes(location.pathname);

    // Deepest (longest) nav path the current URL lives under, across both
    // top-level and dropdown-child paths — matches computeActiveNavPath.
    var activePath = "";
    topItems.forEach(function (it) {
      var isDropdown = it.hasAttribute("data-nav-item-dropdown");
      var topA = isDropdown ? it.querySelector(":scope > a") : it;
      if (topA) {
        var tp = navPathname(topA);
        if (isUnderPath(cur, tp) && tp.length > activePath.length) activePath = tp;
      }
      if (isDropdown) {
        it.querySelectorAll(":scope > div a").forEach(function (c) {
          var cp = navPathname(c);
          if (isUnderPath(cur, cp) && cp.length > activePath.length) activePath = cp;
        });
      }
    });

    function setTopActive(a, active) {
      if (!a) return;
      if (active) {
        a.classList.add("bg-fg", "text-bg");
        a.classList.remove("text-muted", "hover:text-accent", "hover:underline", "focus:underline");
        a.setAttribute("aria-current", "page");
      } else {
        a.classList.remove("bg-fg", "text-bg");
        a.classList.add("text-muted", "hover:text-accent", "hover:underline", "focus:underline");
        a.removeAttribute("aria-current");
      }
    }

    topItems.forEach(function (it) {
      var isDropdown = it.hasAttribute("data-nav-item-dropdown");
      var topA = isDropdown ? it.querySelector(":scope > a") : it;
      var topActive = false;

      if (isDropdown) {
        var parentMatch = !!topA && navPathname(topA) === activePath && activePath !== "";
        var anyChild = false;
        it.querySelectorAll(":scope > div a").forEach(function (c) {
          var childActive = navPathname(c) === activePath && activePath !== "";
          if (childActive) {
            anyChild = true;
            c.setAttribute("data-active", "");
            c.classList.add("font-bold", "text-accent");
            c.classList.remove("text-fg", "hover:text-accent");
          } else {
            c.removeAttribute("data-active");
            c.classList.remove("font-bold", "text-accent");
            c.classList.add("text-fg", "hover:text-accent");
          }
        });
        topActive = parentMatch || anyChild;
        var svg = topA ? topA.querySelector("svg") : null;
        if (svg) {
          if (topActive) { svg.classList.add("text-bg"); svg.classList.remove("text-muted"); }
          else { svg.classList.add("text-muted"); svg.classList.remove("text-bg"); }
        }
      } else {
        topActive = activePath !== "" && navPathname(topA) === activePath;
      }

      setTopActive(topA, topActive);
    });
  }

  function initNavOverflow() {
    if (cleanupNavOverflow) cleanupNavOverflow();

    // Repaint the active highlight for the current URL before measuring /
    // cloning, so the overflow "···" menu mirrors the correct active state.
    applyActiveNav();

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
            a.className = "block px-hsp-md py-vsp-2xs text-small font-bold hover:bg-accent/10 hover:underline focus-visible:underline text-fg hover:text-accent";
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
          a2.className = "block px-hsp-md py-vsp-2xs text-small hover:bg-accent/10 hover:underline focus-visible:underline text-fg hover:text-accent";
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
