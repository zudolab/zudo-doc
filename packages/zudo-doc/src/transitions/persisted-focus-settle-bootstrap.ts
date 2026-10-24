import { BEFORE_SWAP_EVENT } from "./page-events.js";

// zfb moves persisted chrome with moveBefore(). Chromium (reproduced on 151 and
// 153; not on 140/145) queues a native focus reveal for a moved focused subtree
// until the next layout, and the router's scrollTo(0, 0) in settleLocation can
// skip layout — so the reveal lands after the reset and leaves the viewport at
// the footer. One layout read after the DOM move, before settleLocation runs,
// flushes that reveal while the router still owns the final scroll position.
// The generic owner is the zfb runtime; this uses its public event.swap seam.
/** Settles a retained persisted focus before the router applies its scroll policy. */
export function buildPersistedFocusSettleBootstrap(): string {
  return `(function(){
if(document.__zdPersistedFocusSettle)return;
document.__zdPersistedFocusSettle=true;
document.addEventListener(${JSON.stringify(BEFORE_SWAP_EVENT)},function(ev){
if(typeof ev.swap!=="function")return;
var originalSwap=ev.swap;
var wrapped=function(){
var active=document.activeElement;
var retained=!!active&&typeof active.closest==="function"&&!!active.closest("[data-zfb-transition-persist]");
var result=originalSwap.apply(this,arguments);
if(retained&&active.isConnected&&document.activeElement===active)void document.documentElement.offsetHeight;
return result;
};
try{ev.swap=wrapped;}catch(e){}
});
})();`;
}
