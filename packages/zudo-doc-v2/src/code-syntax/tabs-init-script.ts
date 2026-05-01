// Browser init script for tabs interactivity.
//
// Simplified counterpart of `src/components/tabs-init.astro`.
//
// The original script created `<button>` elements for each panel entirely
// at runtime. The JSX `<Tabs>` component now server-renders the buttons,
// so this script only needs to:
//   1. Determine which tab should be active (localStorage or data-tab-default
//      or first panel).
//   2. Apply active styles to the correct button and show the matching panel.
//   3. Wire click handlers to every `[data-tab-btn]` button.
//   4. Handle group-sync via localStorage when a `data-group-id` is present.
//
// Wrapped in an IIFE to avoid polluting the global scope.
// Run on initial load and re-run on the v2 after-navigate event for
// View Transitions support. The event name is pulled from
// `AFTER_NAVIGATE_EVENT` in `transitions/page-events.ts` (today:
// `DOMContentLoaded`) rather than a hard-coded `astro:*` literal — see
// zudolab/zudo-doc#1335 E2 task 2 half B for the vocabulary swap.

import { AFTER_NAVIGATE_EVENT } from "../transitions/page-events.js";

export const TABS_INIT_SCRIPT = `(function () {
  var BASE_BTN = "px-hsp-lg py-vsp-xs text-small font-medium border-b-[5px] -mb-px transition-colors";
  var ACTIVE_BTN = BASE_BTN + " text-accent border-accent";
  var INACTIVE_BTN = BASE_BTN + " text-muted border-transparent hover:text-fg";

  function activateTab(container, value) {
    // Update button styles.
    var buttons = container.querySelectorAll("[data-tab-btn]");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var isActive = btn.dataset.tabBtn === value;
      btn.className = isActive ? ACTIVE_BTN : INACTIVE_BTN;
      btn.setAttribute("aria-selected", String(isActive));
    }
    // Update panel visibility.
    showPanel(container, value);
  }

  function showPanel(container, value) {
    var panels = container.querySelectorAll(".tab-panel");
    for (var i = 0; i < panels.length; i++) {
      var panel = panels[i];
      panel.hidden = panel.dataset.tabValue !== value;
    }
  }

  function syncGroup(groupId, value, source) {
    var others = document.querySelectorAll("[data-tabs][data-group-id=\\"" + CSS.escape(groupId) + "\\"]");
    for (var i = 0; i < others.length; i++) {
      var container = others[i];
      if (container === source) continue;
      var hasPanel = container.querySelector(".tab-panel[data-tab-value=\\"" + CSS.escape(value) + "\\"]");
      if (hasPanel) activateTab(container, value);
    }
  }

  function initTabs() {
    var containers = document.querySelectorAll("[data-tabs]");

    for (var ci = 0; ci < containers.length; ci++) {
      var container = containers[ci];
      if (container.dataset.tabsInit) continue;
      container.dataset.tabsInit = "true";

      var panels = container.querySelectorAll(".tab-panel");
      if (panels.length === 0) continue;

      var groupId = container.dataset.groupId;

      // Determine which tab should be active.
      var activeValue = null;

      if (groupId) {
        var stored = localStorage.getItem("tabs-group-" + groupId);
        if (stored) {
          // Only use stored value if a matching panel exists.
          for (var pi = 0; pi < panels.length; pi++) {
            if (panels[pi].dataset.tabValue === stored) {
              activeValue = stored;
              break;
            }
          }
        }
      }

      if (!activeValue) {
        var defaultPanel = container.querySelector(".tab-panel[data-tab-default]");
        activeValue = defaultPanel
          ? defaultPanel.dataset.tabValue
          : panels[0].dataset.tabValue;
      }

      // Activate the correct tab (set button styles + show panel).
      activateTab(container, activeValue);

      // Wire click handlers on the server-rendered buttons.
      (function (cont, gid) {
        var buttons = cont.querySelectorAll("[data-tab-btn]");
        for (var bi = 0; bi < buttons.length; bi++) {
          (function (btn) {
            btn.addEventListener("click", function () {
              var val = btn.dataset.tabBtn;
              activateTab(cont, val);
              if (gid) {
                localStorage.setItem("tabs-group-" + gid, val);
                syncGroup(gid, val, cont);
              }
            });
          })(buttons[bi]);
        }
      })(container, groupId);
    }
  }

  // Run on initial load.
  initTabs();

  // Re-run after every page-navigate-end signal so View Transitions
  // navigations (which under the zfb runtime are real page loads) see
  // the tabs initialised on the new page.
  document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)}, initTabs);
})();`;
