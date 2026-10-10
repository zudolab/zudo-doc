import { compile } from "./takazudo-zfb-md-wasm-3.0.0/package/dist/index.js";
import { renderToString } from "@takazudo/zfb/zudo-react/server";
import { writeFileSync } from "node:fs";
const cases = {
  olStart: "3. three\n4. four\n",
  tableAlign: "| a | b |\n|:-:|--:|\n| 1 | 2 |\n",
  detailsInP: "<details><summary>S</summary>body</details>\n",
  footnote: "Text[^1]\n\n[^1]: note\n",
  imgLazy: '<img src="a.png" loading="lazy" alt="x" />\n',
  rawSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>\n',
  iframe: '<iframe src="https://x" allowfullscreen></iframe>\n',
  classAttr: '<div class="x">a</div>\n',
  classNameAttr: '<div className="x">a</div>\n',
  styleAttrMdx: '<div style={{"background-color":"red"}}>a</div>\n',
  styleCamelMdx: '<div style={{backgroundColor:"red"}}>a</div>\n',
  taskList: "- [x] done\n",
};
let i = 0;
for (const [k, src] of Object.entries(cases)) {
  try {
    const r = await compile(src, {});
    const f = `./md-case-${i++}.mjs`;
    writeFileSync(f, r.code);
    const mod = await import(f);
    const out = renderToString(mod.default({}));
    console.log("OK  ", k, JSON.stringify(out).slice(0, 160));
  } catch (e) { console.log("FAIL", k, String(e.message).slice(0, 160)); }
}
