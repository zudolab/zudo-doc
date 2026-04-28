// Browser init script for the code block enhancer.
//
// Converted from the TypeScript <script> block in
// `src/components/code-block-enhancer.astro` — TypeScript syntax stripped
// so the string can be emitted via `dangerouslySetInnerHTML` and parsed
// by the browser directly.
//
// Wrapped in an IIFE to avoid polluting the global scope.
// Kept in a separate module (rather than inlined in the TSX file) so
// future edits can be reviewed in isolation — same pattern as
// `src/header/nav-overflow-script.ts`.

export const CODE_BLOCK_ENHANCER_SCRIPT = `(function () {
  // Single shared ResizeObserver for all code blocks on the page.
  var wrapButtons = new Map();
  var resizeObserver = new ResizeObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var btn = wrapButtons.get(entries[i].target);
      if (btn) updateWrapVisibility(entries[i].target, btn);
    }
  });

  function enhanceCodeBlocks() {
    var pres = document.querySelectorAll("pre.astro-code");

    for (var pi = 0; pi < pres.length; pi++) {
      var pre = pres[pi];
      if (pre.dataset.enhanced) continue;
      pre.dataset.enhanced = "true";

      var codeEl = pre.querySelector("code");
      if (!codeEl) continue;
      var rawCode = codeEl.textContent || "";

      // Wrap <pre> in a container so buttons stay fixed during horizontal scroll.
      var wrapper = document.createElement("div");
      wrapper.className = "code-block-wrapper";
      var parent = pre.parentNode;
      if (!parent) continue;
      parent.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Button group (appended to wrapper, not pre).
      var group = document.createElement("div");
      group.className = "code-buttons";

      // Word wrap toggle (only shown when content overflows).
      var wrapBtn = createWrapButton(pre);
      group.appendChild(wrapBtn);

      // Copy button.
      var copyBtn = createCopyButton(rawCode);
      group.appendChild(copyBtn);

      wrapper.appendChild(group);

      // Track and observe for overflow changes.
      wrapButtons.set(pre, wrapBtn);
      updateWrapVisibility(pre, wrapBtn);
      resizeObserver.observe(pre);
    }
  }

  function createCopyButton(code) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-btn code-btn-copy";
    btn.setAttribute("aria-label", "Copy code");
    btn.innerHTML =
      '<svg class="code-icon code-icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
        '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
      '</svg>' +
      '<svg class="code-icon code-icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="20 6 9 17 4 12"/>' +
      '</svg>';

    var copyTimeout;
    var announce = document.querySelector(".code-block-sr-announce");

    btn.addEventListener("click", async function () {
      var success = true;
      try {
        await navigator.clipboard.writeText(code);
      } catch (_) {
        // Fallback for older browsers.
        var textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      if (success) {
        btn.classList.add("copied");
        if (announce) announce.textContent = "Copied!";
        clearTimeout(copyTimeout);
        copyTimeout = setTimeout(function () {
          btn.classList.remove("copied");
          if (announce) announce.textContent = "";
        }, 1500);
      }
    });

    return btn;
  }

  function createWrapButton(pre) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-btn code-btn-wrap";
    btn.setAttribute("aria-label", "Toggle word wrap");
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML =
      '<svg class="code-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="17 10 21 6 17 2" />' +
        '<path d="M3 6h18" />' +
        '<path d="M21 18H7" />' +
        '<polyline points="11 22 7 18 11 14" />' +
      '</svg>';

    btn.addEventListener("click", function () {
      var isWrapped = pre.classList.toggle("word-wrap");
      btn.classList.toggle("active", isWrapped);
      btn.setAttribute("aria-pressed", String(isWrapped));
    });

    return btn;
  }

  function updateWrapVisibility(pre, btn) {
    // Keep visible when active (user needs to toggle back).
    var isActive = btn.classList.contains("active");
    btn.style.display = isActive || pre.scrollWidth > pre.clientWidth ? "" : "none";
  }

  // Clean up stale references before page swap (Astro view transitions).
  document.addEventListener("astro:before-swap", function () {
    wrapButtons.forEach(function (_btn, el) {
      resizeObserver.unobserve(el);
    });
    wrapButtons.clear();
  });

  // Run on initial load.
  enhanceCodeBlocks();

  // Support Astro view transitions.
  document.addEventListener("astro:page-load", enhanceCodeBlocks);
})();`;
