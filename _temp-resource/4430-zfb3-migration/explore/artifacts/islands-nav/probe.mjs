import { renderToString } from "./zfb3/package/dist/zudo-react/server.js";
import { jsx } from "./zfb3/package/dist/zudo-react/jsx-runtime.js";
const cases = {
  svgXmlns: () => jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", children: jsx("path", { d: "M0 0" }) }),
  scriptDefer: () => jsx("script", { src: "/a.js", defer: true }),
  scriptAsync: () => jsx("script", { src: "/a.js", async: true }),
  metaProperty: () => jsx("meta", { property: "og:title", content: "x" }),
  linkAs: () => jsx("link", { rel: "preload", as: "font", href: "/f.woff2" }),
  aHreflang: () => jsx("a", { href: "/", hreflang: "ja", children: "x" }),
  inputInputmode: () => jsx("input", { type: "text", inputmode: "search" }),
  inputForm: () => jsx("input", { type: "text", form: "f1" }),
  buttonPopovertarget: () => jsx("button", { popovertarget: "p", children: "x" }),
  divPopover: () => jsx("div", { popover: "auto", children: "x" }),
  inert: () => jsx("aside", { inert: true, children: "x" }),
  ariaHiddenBool: () => jsx("div", { "aria-hidden": false, children: "x" }),
  dialogOpen: () => jsx("dialog", { open: false, children: "x" }),
  styleString: () => jsx("div", { style: "display:none", children: "x" }),
  styleCamel: () => jsx("div", { style: { paddingLeft: "1rem" }, children: "x" }),
  styleKebab: () => jsx("div", { style: { "padding-left": "1rem" }, children: "x" }),
  styleCustomProp: () => jsx("div", { style: { "--zd-x": "1px" }, children: "x" }),
  classNameProp: () => jsx("div", { className: "a", children: "x" }),
  onClick: () => jsx("button", { onClick: () => {}, children: "x" }),
  htmlLang: () => jsx("html", { lang: "en", "data-theme": "light", children: jsx("body", {}) }),
  metaCharset: () => jsx("meta", { charset: "utf-8" }),
  imgFetchpriority: () => jsx("img", { src: "/a.png", alt: "", fetchpriority: "high" }),
  selectMultiple: () => jsx("select", { multiple: true, children: jsx("option", { value: "a", children: "a" }) }),
  svgStrokeLinecap: () => jsx("svg", { viewBox: "0 0 24 24", children: jsx("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M0 0" }) }),
  svgFocusable: () => jsx("svg", { focusable: "false", children: jsx("path", { d: "M0" }) }),
  iframeSrcdoc: () => jsx("iframe", { srcdoc: "<p>x</p>", title: "t" }),
  detailsName: () => jsx("details", { name: "g", children: jsx("summary", { children: "s" }) }),
  inputAutocap: () => jsx("input", { type: "text", autocapitalize: "off", enterkeyhint: "search", spellcheck: "false" }),
  textareaWrap: () => jsx("textarea", { wrap: "off" }),
  kbd: () => jsx("kbd", { children: "x" }),
};
for (const [k, f] of Object.entries(cases)) {
  try { console.log(k.padEnd(22), "OK  ", renderToString(f()).slice(0, 110)); }
  catch (e) { console.log(k.padEnd(22), "FAIL", String(e.message).slice(0, 110)); }
}
