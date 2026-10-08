// Package-build input only. Consumers import the generated string constants.
import { switchLocaleHref } from "../src/i18n-version/switcher-url-state.js";
import { computeVersionSwitcherState } from "../src/i18n-version/switcher-url-state.js";
import { AFTER_NAVIGATE_EVENT } from "../src/transitions/page-events.js";
import { CURRENT_PATH_SCRIPT_PRELUDE } from "../src/current-path/index.js";
import { UNAVAILABLE_VERSIONS_ATTR } from "../src/version-availability/index.js";

export const LANGUAGE_SWITCHER_INIT_SCRIPT = `(function(){
var FLAG="__zdLanguageSwitcherInit";
${CURRENT_PATH_SCRIPT_PRELUDE}
var switchLocaleHref=${switchLocaleHref.toString()};
function close(c,restoreFocus){
var toggle=c.querySelector("[data-language-toggle]");
var menu=c.querySelector("[data-language-menu]");
if(!toggle||!menu)return;
menu.classList.add("hidden");
toggle.setAttribute("aria-expanded","false");
if(restoreFocus)toggle.focus();
}
function refresh(){
var containers=document.querySelectorAll("[data-language-switcher]");
for(var i=0;i<containers.length;i++){
var c=containers[i];
close(c,false);
var menu=c.querySelector("[data-language-menu]");
if(menu){
menu.classList.remove("group-hover:block","group-focus-within:block");
}
if(!c.hasAttribute("data-default-locale"))continue;
var config={base:c.getAttribute("data-base")||"",defaultLocale:c.getAttribute("data-default-locale")||"",trailingSlash:c.getAttribute("data-trailing-slash")==="true"};
var currentLang=c.getAttribute("data-current-locale")||config.defaultLocale;
var anchors=c.querySelectorAll("a[lang]");
for(var j=0;j<anchors.length;j++){
var a=anchors[j];
var target=a.getAttribute("lang");
if(!target)continue;
a.setAttribute("href",switchLocaleHref(readCurrentPath(CURRENT_PATH_DATASET_KEY),config,currentLang,target));
}
}
}
if(window[FLAG]){window[FLAG]();return;}
window[FLAG]=refresh;
document.addEventListener("click",function(e){
var target=e.target;
var toggle=target&&target.closest?target.closest("[data-language-toggle]"):null;
if(toggle){
var switcher=toggle.closest("[data-language-switcher]");
if(switcher){
var menu=switcher.querySelector("[data-language-menu]");
var willOpen=toggle.getAttribute("aria-expanded")!=="true";
document.querySelectorAll("[data-language-switcher]").forEach(function(c){if(c!==switcher)close(c,false);});
if(menu){menu.classList.toggle("hidden",!willOpen);toggle.setAttribute("aria-expanded",String(willOpen));}
}
return;
}
document.querySelectorAll("[data-language-switcher]").forEach(function(c){if(!c.contains(target))close(c,false);});
});
document.addEventListener("keydown",function(e){
if(e.key!=="Escape")return;
document.querySelectorAll('[data-language-toggle][aria-expanded="true"]').forEach(function(toggle){
var switcher=toggle.closest("[data-language-switcher]");
if(switcher)close(switcher,true);
});
});
refresh();
document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)},refresh);
})();`;

export const VERSION_SWITCHER_REWIRE_SCRIPT = `(function(){
var FLAG="__zdVersionSwitcherRewire";
if(window[FLAG])return;
window[FLAG]=true;
var ATTR=${JSON.stringify(UNAVAILABLE_VERSIONS_ATTR)};
${CURRENT_PATH_SCRIPT_PRELUDE}
var computeVersionSwitcherState=${computeVersionSwitcherState.toString()};
function setActive(a,active){
a.classList.toggle("font-bold",active);
a.classList.toggle("text-accent",active);
a.classList.toggle("text-fg",!active);
if(active){a.setAttribute("aria-current","page");}else{a.removeAttribute("aria-current");}
}
function setDisabled(a,disabled,unavailableLabel){
a.classList.toggle("hover:bg-accent/10",!disabled);
a.classList.toggle("hover:underline",!disabled);
a.classList.toggle("focus-visible:underline",!disabled);
a.classList.toggle("text-muted/50",disabled);
a.classList.toggle("cursor-not-allowed",disabled);
a.classList.toggle("pointer-events-none",disabled);
if(disabled){
a.setAttribute("aria-disabled","true");
a.setAttribute("tabindex","-1");
a.setAttribute("title",unavailableLabel);
a.classList.remove("font-bold","text-accent","text-fg");
a.removeAttribute("aria-current");
}else{
a.removeAttribute("aria-disabled");
a.removeAttribute("tabindex");
a.removeAttribute("title");
}
}
function rewire(){
var articleEl=document.querySelector("["+ATTR+"]");
var hasAvailabilityData=articleEl!==null;
var unavailableSlugs=hasAvailabilityData?(articleEl.getAttribute(ATTR)||"").split(",").filter(Boolean):[];
var containers=document.querySelectorAll("[data-version-rewire]");
for(var i=0;i<containers.length;i++){
var c=containers[i];
var config={base:c.getAttribute("data-base")||"",defaultLocale:c.getAttribute("data-default-locale")||"",trailingSlash:c.getAttribute("data-trailing-slash")==="true",currentLocale:c.getAttribute("data-current-locale")||""};
var unavailableLabel=c.getAttribute("data-unavailable-label")||"";
var versionAnchors=c.querySelectorAll("[data-version-slug]");
var slugs=[];
for(var j=0;j<versionAnchors.length;j++){
var s=versionAnchors[j].getAttribute("data-version-slug");
if(s)slugs.push(s);
}
var state=computeVersionSwitcherState(readCurrentPath(CURRENT_PATH_DATASET_KEY),config,slugs);
var latest=c.querySelector("[data-version-latest]");
if(latest){
latest.setAttribute("href",state.latestHref);
setActive(latest,state.activeVersion===null);
}
for(var k=0;k<versionAnchors.length;k++){
var a=versionAnchors[k];
var slug=a.getAttribute("data-version-slug");
if(!slug)continue;
var href=state.versionHrefs[slug];
if(href!=null)a.setAttribute("href",href);
if(hasAvailabilityData){
var disabled=unavailableSlugs.indexOf(slug)!==-1;
setDisabled(a,disabled,unavailableLabel);
if(!disabled)setActive(a,state.activeVersion===slug);
}else{
var alreadyDisabled=a.getAttribute("aria-disabled")==="true";
if(!alreadyDisabled)setActive(a,state.activeVersion===slug);
}
}
var label=c.querySelector("[data-version-trigger-label]");
if(label){
if(state.activeVersion===null){
if(latest)label.textContent=latest.textContent;
}else{
var activeLabel=null;
for(var m=0;m<versionAnchors.length;m++){
if(versionAnchors[m].getAttribute("data-version-slug")===state.activeVersion){activeLabel=versionAnchors[m].textContent;break;}
}
label.textContent=activeLabel!=null?activeLabel:state.activeVersion;
}
}
}
}
// The initial call is deferred to DOMContentLoaded when the script (inline in
// <header>, which parses before <article>) would otherwise run before the
// article element exists. Running early would read a missing ATTR as "no
// unavailable slugs" and clobber the SSR-correct disabled state with
// everything-enabled — a first-paint variant of the bug this rewire exists
// to fix (see the doc comment above; SSR already rendered the right state for
// this page, so a brief deferral loses nothing).
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",rewire);}else{rewire();}
document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)},rewire);
})();`;
