/** @jsxImportSource preact */
// Inline script component for sidebar resizer initialization.
//
// Mirrors the pattern used by CodeBlockEnhancer / TabsInit / MermaidInit:
// a JSX component that emits the full init logic as a dangerouslySetInnerHTML
// <script> so the body-end script slot gets self-contained browser code that
// does NOT depend on module resolution at runtime.
//
// The script is included unconditionally when settings.sidebarResizer is true;
// it self-guards with `if (!sidebar || sidebar.querySelector(...))` so it is
// safe to call on pages where the sidebar is hidden or already initialized.
//
// AFTER_NAVIGATE_EVENT resolves to "zfb:after-swap" under zfb's Strategy B
// SPA navigation model. The event is dispatched on `document` after every
// body swap (and on the initial page load), so registering one listener on
// the persistent <head>-injected script gives both first-paint init and
// post-swap re-init. The body itself is replaced on each nav, so the per-
// instance handle DOM is rebuilt each time and the existing-handle guard
// (`sidebar.querySelector("["+HANDLE_MARKER+"]")`) keeps re-runs idempotent.
//
// Pre-paint restore (SidebarResizerRestore / SIDEBAR_RESIZER_RESTORE_SCRIPT):
// the init script above only mutates `--zd-sidebar-w` in response to user
// input. Without a separate pre-paint reader, a page reload after a drag
// shows the CSS-default width (`clamp(14rem, 20vw, 22rem)`) instead of the
// persisted value — the saved width exists in localStorage but nothing
// applies it before paint. The Restore component emits a tiny synchronous
// `<script>` intended for `<head>` that reads `zudo-doc-sidebar-width`,
// validates it against the same [MIN_W, MAX_W] bounds the runtime uses,
// and sets `--zd-sidebar-w` on `:root` before first paint to avoid a FOUC.
// The bounds are duplicated as literals (not imported) because the script
// body is a static string emitted into HTML — sharing the constants would
// require a build step. Keep these in sync with MIN_W / MAX_W / LS_KEY /
// CSS_PROP in sidebar-resizer/index.ts.

import type { JSX } from "preact";
import { AFTER_NAVIGATE_EVENT } from "../transitions/page-events.js";

// The full initSidebarResizer implementation embedded as a browser script
// string so it can be injected via dangerouslySetInnerHTML.
// This avoids a dynamic import at runtime and matches the self-contained
// script pattern used by CodeBlockEnhancer, TabsInit, and MermaidInit.
export const SIDEBAR_RESIZER_INIT_SCRIPT = `(function(){
  var SIDEBAR_ID="desktop-sidebar";
  var HANDLE_MARKER="data-sidebar-resizer";
  var MIN_W=192,MAX_W=448,STEP=10;
  var LS_KEY="zudo-doc-sidebar-width";
  var CSS_PROP="--zd-sidebar-w";
  var ACCENT_BG="var(--zd-accent,rgba(128,128,128,0.3))";
  var ACCENT_OUTLINE="2px solid var(--zd-accent,rgba(128,128,128,0.5))";
  var ACCENT_GHOST="var(--zd-accent,rgba(128,128,128,0.5))";

  function initSidebarResizer(){
    if(typeof document==="undefined")return;
    var sidebar=document.getElementById(SIDEBAR_ID);
    if(!sidebar||sidebar.querySelector("["+HANDLE_MARKER+"]"))return;

    function readCurrentWidth(){
      var raw=getComputedStyle(document.documentElement).getPropertyValue(CSS_PROP);
      return raw?parseFloat(raw)||MIN_W:MIN_W;
    }
    var cachedWidth=readCurrentWidth();

    var handle=document.createElement("div");
    handle.setAttribute(HANDLE_MARKER,"");
    handle.setAttribute("tabindex","0");
    handle.setAttribute("role","separator");
    handle.setAttribute("aria-orientation","vertical");
    handle.setAttribute("aria-label","Resize sidebar");
    handle.setAttribute("aria-valuemin",String(MIN_W));
    handle.setAttribute("aria-valuemax",String(MAX_W));
    handle.setAttribute("aria-valuenow",String(Math.round(cachedWidth)));
    // 20px hit area > native y-scrollbar (~12-17px) so a draggable strip stays
    // visible to the LEFT of the scrollbar when sidebar overflows. zudolab/zudo-doc#1660
    Object.assign(handle.style,{position:"absolute",top:"0",right:"0",width:"20px",height:"100%",cursor:"col-resize",zIndex:"10",transition:"background 0.15s"});

    var dragging=false,focused=false;

    function applyWidth(w){
      cachedWidth=Math.max(MIN_W,Math.min(MAX_W,w));
      document.documentElement.style.setProperty(CSS_PROP,cachedWidth+"px");
      try{localStorage.setItem(LS_KEY,String(Math.round(cachedWidth)));}catch(e){}
      handle.setAttribute("aria-valuenow",String(Math.round(cachedWidth)));
    }
    function updateHandleVisual(){
      handle.style.background=(dragging||focused)?ACCENT_BG:"";
      handle.style.outline=(focused&&!dragging)?ACCENT_OUTLINE:"";
      handle.style.outlineOffset=(focused&&!dragging)?"1px":"";
    }

    handle.addEventListener("focus",function(){focused=true;updateHandleVisual();});
    handle.addEventListener("blur",function(){focused=false;updateHandleVisual();});
    handle.addEventListener("keydown",function(e){
      var w=cachedWidth;
      if(e.key==="ArrowLeft")w=Math.max(MIN_W,w-STEP);
      else if(e.key==="ArrowRight")w=Math.min(MAX_W,w+STEP);
      else if(e.key==="Home")w=MIN_W;
      else if(e.key==="End")w=MAX_W;
      else return;
      e.preventDefault();applyWidth(w);
    });
    handle.addEventListener("mouseenter",function(){if(!dragging&&!focused)handle.style.background=ACCENT_BG;});
    handle.addEventListener("mouseleave",function(){if(!dragging&&!focused)handle.style.background="";});
    handle.addEventListener("pointerdown",function(e){
      e.preventDefault();handle.setPointerCapture(e.pointerId);
      dragging=true;updateHandleVisual();
      document.documentElement.style.cursor="col-resize";
      document.documentElement.style.userSelect="none";
      var ghost=document.createElement("div");
      Object.assign(ghost.style,{position:"fixed",top:"0",width:"2px",height:"100vh",background:ACCENT_GHOST,pointerEvents:"none",zIndex:"9999"});
      var sidebarRect=sidebar.getBoundingClientRect();
      var sidebarLeft=sidebarRect.left;
      ghost.style.left=sidebarLeft+sidebarRect.width+"px";
      document.body.appendChild(ghost);
      var targetWidth=0;
      var cleaned=false;
      function onMove(ev){targetWidth=Math.max(MIN_W,Math.min(MAX_W,ev.clientX-sidebarLeft));ghost.style.left=sidebarLeft+targetWidth+"px";}
      function cleanup(){
        if(cleaned)return;cleaned=true;
        dragging=false;updateHandleVisual();
        document.documentElement.style.cursor="";
        document.documentElement.style.userSelect="";
        ghost.remove();
        handle.removeEventListener("pointermove",onMove);
        handle.removeEventListener("pointerup",onUp);
        handle.removeEventListener("pointercancel",onCancel);
        handle.removeEventListener("lostpointercapture",onLost);
      }
      function commit(){if(targetWidth>0)applyWidth(targetWidth);}
      // pointerup: normal end-of-drag. Commit then teardown.
      function onUp(){commit();cleanup();}
      // lostpointercapture: per spec fires AFTER pointerup, but browsers reorder
      // these in edge cases (cursor near y-scrollbar, fast drags, OS handoff).
      // Commit here too so a real drag still applies if pointerup is dropped.
      // Idempotent with onUp via the cleaned guard.
      function onLost(){commit();cleanup();}
      // pointercancel: actual user/OS cancellation (touch interrupted, etc.).
      // Do NOT commit — caller intent was to abort.
      function onCancel(){cleanup();}
      handle.addEventListener("pointermove",onMove);
      handle.addEventListener("pointerup",onUp);
      handle.addEventListener("pointercancel",onCancel);
      handle.addEventListener("lostpointercapture",onLost);
    });
    sidebar.appendChild(handle);
  }

  initSidebarResizer();
  document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)},initSidebarResizer);
})();`;

/**
 * Drop-in JSX body-end script for sidebar resize initialization.
 *
 * Include once in the layout (gated on `settings.sidebarResizer`). Emits
 * the full `initSidebarResizer` implementation as an inline
 * `dangerouslySetInnerHTML` script so it runs without a module import.
 *
 * - Calls `initSidebarResizer()` once on first paint.
 * - Re-runs on `AFTER_NAVIGATE_EVENT` (`zfb:after-swap`) for
 *   Strategy B SPA navigation support.
 * - Idempotent: repeated calls on the same DOM are safe.
 */
export function SidebarResizerInit(): JSX.Element {
  return (
    <script dangerouslySetInnerHTML={{ __html: SIDEBAR_RESIZER_INIT_SCRIPT }} />
  );
}

export default SidebarResizerInit;

// Pre-paint inline script: reads the persisted sidebar width from
// localStorage and applies it to `--zd-sidebar-w` on `:root` BEFORE
// first paint, so a reload after a manual resize doesn't flash to the
// CSS-default width and then "stick" at the default. Parallels the
// sibling sidebar-toggle pre-paint script that restores
// `zudo-doc-sidebar-visible`.
//
// MIN_W (192) / MAX_W (448) are duplicated here as literals — see the
// header comment for why. The clamp keeps a corrupted localStorage value
// from producing a sidebar wider than the layout supports.
export const SIDEBAR_RESIZER_RESTORE_SCRIPT = `(function(){try{var w=localStorage.getItem("zudo-doc-sidebar-width");if(!w)return;var n=parseFloat(w);if(!isFinite(n))return;if(n<192)n=192;else if(n>448)n=448;document.documentElement.style.setProperty("--zd-sidebar-w",n+"px");}catch(e){}})();`;

/**
 * Drop-in JSX `<head>` script that restores the persisted sidebar width
 * before first paint.
 *
 * Include once in the page `<head>` (gated on `settings.sidebarResizer`)
 * — placement in `<head>` is what makes this run before the body is
 * parsed, eliminating the resize-flash on reload. Body-end placement is
 * too late: the browser will have already painted at the CSS default.
 *
 * The script is a tiny synchronous IIFE that:
 *   - reads `localStorage["zudo-doc-sidebar-width"]`,
 *   - validates it as a finite number clamped to [MIN_W, MAX_W],
 *   - sets `--zd-sidebar-w` on `document.documentElement.style`.
 *
 * It silently no-ops in privacy / disabled-storage modes (try/catch),
 * matches the resilience of the runtime `applyWidth` writer.
 */
export function SidebarResizerRestore(): JSX.Element {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: SIDEBAR_RESIZER_RESTORE_SCRIPT }}
    />
  );
}
