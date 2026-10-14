import { BEFORE_SWAP_EVENT } from "./page-events.js";

/** Visual snapshot policy only; persistence and sidebar state keep their owners. */
export function buildChromeTransitionBootstrap(): string {
  return `(function(){
if(document.__zdChromeTransitionPolicy)return;
document.__zdChromeTransitionPolicy=true;
function identity(doc){
var sidebar=doc.getElementById("desktop-sidebar");
var context=sidebar&&sidebar.querySelector("[data-sidebar-context]");
var band=doc.querySelector("[data-zd-nav-section]");
return {section:band&&band.getAttribute("data-zd-nav-section"),context:band&&!band.hasAttribute("data-zd-nosidebar")&&context&&context.getAttribute("data-sidebar-context")};
}
document.addEventListener(${JSON.stringify(BEFORE_SWAP_EVENT)},function(ev){
var incoming=ev.newDocument;
if(!incoming||incoming.nodeType!==9)return;
var from=identity(document),to=identity(incoming);
var stationary=!!from.section&&!!from.context&&from.section===to.section&&from.context===to.context;
incoming.documentElement.setAttribute("data-zd-sidebar-transition",stationary?"stationary":"changing");
});
})();`;
}
