import { buildNavTree } from "$HOME/repos/myoss/zudo-doc/packages/zudo-doc/dist/site-schema/nav-tree.js";
import { serializeProps } from "./zfb3/package/dist/zudo-react/server.js";
const docs = [
  { id: "guide/intro.mdx", slug: "guide/intro", data: { title: "Intro", sidebar_position: 1 } },
  { id: "guide/next.mdx", slug: "guide/next", data: { title: "Next", sidebar_position: 2, description: "d" } },
];
const tree = buildNavTree(docs, "en", undefined, (s, l) => `/docs/${s}/`);
console.log(JSON.stringify(tree).slice(0, 200));
const undefKeys = []; (function walk(n, p) { if (Array.isArray(n)) n.forEach((x, i) => walk(x, `${p}[${i}]`)); else if (n && typeof n === "object") for (const [k, v] of Object.entries(n)) { if (v === undefined) undefKeys.push(`${p}.${k}`); walk(v, `${p}.${k}`); } })(tree, "nodes");
console.log("undefined-valued keys:", undefKeys.length, undefKeys.slice(0, 8).join(" "));
try { serializeProps({ nodes: tree }); console.log("serializeProps OK"); } catch (e) { console.log("serializeProps FAIL:", e.message); }
try { serializeProps({ nodes: [], currentSlug: undefined }); console.log("top-level undefined OK"); } catch (e) { console.log("top-level undefined FAIL:", e.message); }
