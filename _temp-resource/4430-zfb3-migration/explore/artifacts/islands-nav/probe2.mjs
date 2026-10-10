import { renderToString } from "./zfb3/package/dist/zudo-react/server.js";
import { jsx } from "./zfb3/package/dist/zudo-react/jsx-runtime.js";
const cases = {
  dataTrue: () => jsx("aside", { "data-zd-mobile-sidebar": true, children: "x" }),
  styleNumberPx: () => jsx("div", { style: { left: 10, "max-height": 20 }, children: "x" }),
  styleVisibility: () => jsx("div", { style: { visibility: "hidden" }, children: "x" }),
  roleMenuitemradio: () => jsx("button", { role: "menuitemradio", "aria-checked": true, type: "button", children: "x" }),
  inputValueString: () => jsx("input", { type: "text", value: "abc" }),
  inputOnInput: () => jsx("input", { type: "text", "on:input": () => {} }),
  aLangAttr: () => jsx("a", { href: "/", lang: "ja", children: "x" }),
  buttonDisabledFalse: () => jsx("button", { disabled: false, children: "x" }),
  dialogAriaLabelledby: () => jsx("dialog", { "aria-labelledby": "t", children: "x" }),
  tabindexNeg: () => jsx("div", { tabindex: -1, children: "x" }),
  classArray: () => jsx("div", { class: ["a", "b"], children: "x" }),
  classUndefined: () => jsx("div", { class: undefined, children: "x" }),
};
for (const [k, f] of Object.entries(cases)) {
  try { console.log(k.padEnd(22), "OK  ", renderToString(f()).slice(0, 110)); }
  catch (e) { console.log(k.padEnd(22), "FAIL", String(e.message).slice(0, 110)); }
}
