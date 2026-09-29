import { h, signal } from "@takazudo/zfb/zudo-react";
import { renderToString } from "@takazudo/zfb/zudo-react/server";
const cases = {
  scriptSrc: () => h("script", { src: "/a.js", type: "module" }),
  scriptJsonLd: () => h("script", { type: "application/ld+json", rawHtml: '{"a":"<b>"}' }),
  titleMulti: () => h("title", null, "A", " | ", "B"),
  titleNum: () => h("title", null, "Page ", 2),
  noscript: () => h("noscript", null, h("img", { src: "a", alt: "" })),
  templateStatic: () => h("template", null, h("p", null, "x")),
  iframeChildren: () => h("iframe", { src: "x" }),
  svgTitle: () => h("svg", null, h("title", null, "t")),
  svgUseXlink: () => h("svg", null, h("use", { "xlink:href": "#i" })),
  svgClass: () => h("svg", { class: "icon", fill: "none", stroke: "currentColor", "stroke-width": 2 }),
  aTarget: () => h("a", { href: "x", target: "_blank", rel: "noopener" }, "x"),
  buttonType: () => h("button", { type: "button", "aria-label": "x", disabled: false }, "x"),
  inputSearch: () => h("input", { type: "search", placeholder: "s", autocomplete: "off" }),
  dataAttrBool: () => h("div", { "data-open": true, "data-n": 3 }),
  onloadString: () => h("link", { rel: "stylesheet", href: "x", media: "print", onload: "this.media='all'" }),
  valueStatic: () => h("input", { value: "x" }),
  checkedStatic: () => h("input", { type: "checkbox", checked: false }),
  selectDefault: () => h("select", { defaultValue: "b" }, h("option", { value: "a" }, "a"), h("option", { value: "b" }, "b")),
  optionSelected: () => h("select", null, h("option", { value: "a", selected: true }, "a")),
  textareaChildren: () => h("textarea", null, "x"),
  preText: () => h("pre", null, "\nabc"),
  hrClass: () => h("hr", { class: "x" }),
  brChild: () => h("br", null, "x"),
  headLinkPreconnect: () => h("link", { rel: "preconnect", href: "https://x", crossorigin: "" }),
  metaOg: () => h("meta", { name: "og:title", content: "x" }),
  imgSrcset: () => h("img", { src: "a", srcset: "a 1x, b 2x", alt: "", decoding: "async", loading: "lazy" }),
  videoAttrs: () => h("video", { src: "a", controls: true, muted: true, playsinline: true }),
  dialog: () => h("dialog", { id: "d", "aria-modal": "true" }),
  labelFormAttr: () => h("button", { form: "f" }, "x"),
  tdColspan: () => h("table", null, h("tbody", null, h("tr", null, h("td", { colspan: 2 }, "x")))),
  thScope: () => h("table", null, h("thead", null, h("tr", null, h("th", { scope: "col" }, "x")))),
  kbdNested: () => h("kbd", null, h("kbd", null, "Ctrl")),
  detailsName: () => h("details", { name: "g" }, h("summary", null, "s")),
  summaryRole: () => h("summary", { role: "button" }, "s"),
};
for (const [k, fn] of Object.entries(cases)) {
  try { const out = renderToString(fn()); console.log("OK  ", k, JSON.stringify(out).slice(0, 160)); }
  catch (e) { console.log("FAIL", k, String(e.message).slice(0, 160)); }
}
