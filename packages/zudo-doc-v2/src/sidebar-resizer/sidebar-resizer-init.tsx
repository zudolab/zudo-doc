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
// AFTER_NAVIGATE_EVENT resolves to "DOMContentLoaded" under zfb's full-reload
// navigation model. Because each navigation is a real page load, registering
// for DOMContentLoaded on the newly-loaded page is equivalent to the
// astro:page-load post-navigate hook — no persistent listener is needed.

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
    Object.assign(handle.style,{position:"absolute",top:"0",right:"0",width:"6px",height:"100%",cursor:"col-resize",zIndex:"10",transition:"background 0.15s"});

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
      function onMove(ev){targetWidth=Math.max(MIN_W,Math.min(MAX_W,ev.clientX-sidebarLeft));ghost.style.left=sidebarLeft+targetWidth+"px";}
      function cleanup(){
        dragging=false;updateHandleVisual();
        document.documentElement.style.cursor="";
        document.documentElement.style.userSelect="";
        ghost.remove();
        handle.removeEventListener("pointermove",onMove);
        handle.removeEventListener("pointerup",onUp);
        handle.removeEventListener("pointercancel",onCancel);
        handle.removeEventListener("lostpointercapture",onCancel);
      }
      function onUp(ev){handle.releasePointerCapture(ev.pointerId);cleanup();if(targetWidth>0)applyWidth(targetWidth);}
      function onCancel(){cleanup();}
      handle.addEventListener("pointermove",onMove);
      handle.addEventListener("pointerup",onUp);
      handle.addEventListener("pointercancel",onCancel);
      handle.addEventListener("lostpointercapture",onCancel);
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
 * - Re-runs on `AFTER_NAVIGATE_EVENT` (`DOMContentLoaded`) for
 *   view-transitions support (each navigation is a full page load under zfb).
 * - Idempotent: repeated calls on the same DOM are safe.
 */
export function SidebarResizerInit(): JSX.Element {
  return (
    <script dangerouslySetInnerHTML={{ __html: SIDEBAR_RESIZER_INIT_SCRIPT }} />
  );
}

export default SidebarResizerInit;
