import { h, signal, computed, Show, For, Fragment, getScope } from "@takazudo/zfb/zudo-react";
import { renderToString, islandRoot } from "@takazudo/zfb/zudo-react/server";
import { Island } from "@takazudo/zfb";
function Demo() { const on = signal(true); return h(Show, { when: on, children: () => h("b", null, "Y"), fallback: () => h("i", null, "N") }); }
function List() { const items = signal([{id:"a",l:"A"},{id:"b",l:"B"}]); return h("ul", null, h(For, { each: items, by: (i) => i.id, children: (it) => h("li", null, computed(() => it.value.l)) })); }
function Scoped() { const s = getScope(); s.onActivate(() => {}); s.effect(() => {}); return h("p", { class: computed(() => "a b") }, "x"); }
function WithKids({ children }) { return h("div", null, children); }
const cases = {
  show: () => h(Demo, null),
  forList: () => h(List, null),
  scoped: () => h(Scoped, null),
  scriptRaw: () => h("script", { rawHtml: "window.x=1" }),
  scriptRawClose: () => h("script", { rawHtml: "a</script>b" }),
  scriptChildren: () => h("script", null, "window.x=1"),
  styleRaw: () => h("style", { rawHtml: ".a{color:red}" }),
  titleReactive: () => h("title", null, signal("T")),
  hiddenReactive: () => h("div", { hidden: signal(true) }),
  islandRootNoBuild: () => islandRoot(h(Demo, null), { identity: { component: "Demo", build: "b1" } }),
  islandRootWrongName: () => islandRoot(h(Demo, null), { identity: { component: "Other", build: "b1" } }),
  IslandSdk: () => h(Island, null, h(Demo, null)),
  IslandSdkWithChildren: () => h(Island, null, h(WithKids, null, h("b", null, "x"))),
  islandInP: () => h("p", null, islandRoot(h(Demo, null), { identity: { component: "Demo", build: "b1" } })),
  islandInTable: () => h("table", null, h("tbody", null, h("tr", null, h("td", null, islandRoot(h(Demo, null), { identity: { component: "Demo", build: "b1" } }))))),
  selectInIslandMultiple: () => islandRoot(h(function Sel(){ return h("select", { multiple: true }, h("option", { value: "a" }, "a")); }, null), { identity: { component: "Sel", build: "b1" } }),
  modelValue: () => islandRoot(h(function M(){ return h("input", { modelValue: signal("x") }); }, null), { identity: { component: "M", build: "b1" } }),
  modelComputed: () => islandRoot(h(function M2(){ return h("input", { modelValue: computed(() => "x") }); }, null), { identity: { component: "M2", build: "b1" } }),
  propsDate: () => islandRoot(h(function P({ d }){ return h("p", null, "x"); }, { d: new Date() }), { identity: { component: "P", build: "b1" } }),
  propsUndef: () => islandRoot(h(function P2({ d }){ return h("p", null, "x"); }, { d: undefined }), { identity: { component: "P2", build: "b1" } }),
  displayNameMismatch: () => { const C = function Real(){ return h("p",null,"x"); }; C.displayName = "Alias"; return islandRoot(h(C, null), { identity: { component: "Real", build: "b1" } }); },
  asyncTopLevel: () => h("div", null, Promise.resolve("x")),
  nestedIsland: () => islandRoot(h(function Outer(){ return islandRoot(h(Demo, null), { identity: { component: "Demo", build: "b1" } }); }, null), { identity: { component: "Outer", build: "b1" } }),
};
for (const [k, fn] of Object.entries(cases)) {
  try { const out = renderToString(fn()); console.log("OK  ", k, JSON.stringify(out).slice(0, 260)); }
  catch (e) { console.log("FAIL", k, String(e.message).slice(0, 200)); }
}
