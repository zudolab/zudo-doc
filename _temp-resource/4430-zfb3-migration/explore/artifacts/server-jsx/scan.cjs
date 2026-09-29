// Read-only AST scanner: node scan.cjs <filelist> <out.json>
const ts = require("$HOME/repos/myoss/zudo-doc/node_modules/typescript");
const fs = require("fs");
const path = require("path");
const ROOT = "$HOME/repos/myoss/zudo-doc";
const [, , listFile, outFile] = process.argv;
const files = fs.readFileSync(listFile, "utf8").split("\n").filter(Boolean);
const words = (s) => new Set(s.split(" "));
// Copied verbatim from zfb v3.0.0 packages/zfb/src/zudo-react/render-html.ts
const voidTags = words("area base br col embed hr img input link meta param source track wbr");
const booleanAttrs = words("hidden inert readonly autofocus required disabled checked selected multiple open controls muted loop autoplay novalidate formnovalidate allowfullscreen");
const commonAttrs = words("id class title lang dir slot role style hidden inert contenteditable draggable spellcheck tabindex accesskey translate onclick onload onerror");
const htmlAttrs = words("href target rel download src alt width height type name value placeholder for charset datetime readonly autofocus required disabled checked selected multiple open controls muted loop autoplay novalidate formnovalidate maxlength minlength min max step pattern autocomplete accept accept-charset http-equiv content media method action enctype rows cols colspan rowspan scope cite poster loading decoding sizes srcset crossorigin referrerpolicy sandbox allow allowfullscreen");
const svgAttrs = words("width height viewBox preserveAspectRatio gradientUnits gradientTransform markerWidth markerHeight refX refY xlink:href xml:lang stroke-width fill-rule clip-rule stroke-linecap stroke-linejoin stop-color stop-opacity fill stroke d x y x1 x2 y1 y2 cx cy r rx ry points transform opacity offset");
const svgTags = words("svg g path circle ellipse rect line polyline polygon text tspan defs symbol use clipPath mask linearGradient radialGradient stop title desc foreignObject");
const htmlTags = words("html head body title base link meta style script div span p a br hr main header footer nav section article aside h1 h2 h3 h4 h5 h6 ul ol li dl dt dd blockquote pre code strong em b i small mark time figure figcaption img picture source video audio track canvas form label input button textarea select option optgroup fieldset legend output progress meter datalist table caption thead tbody tfoot tr th td col colgroup details summary dialog template slot iframe noscript address abbr bdi bdo cite data del dfn ins kbd map area object param q rp rt ruby s samp sub sup u var wbr embed xmp noembed noframes plaintext");
const reserved = words("key ref children rawHtml");
const forms = words("modelValue modelChecked defaultValue defaultChecked");
const renames = { className: "class", htmlFor: "for", charSet: "charset", dateTime: "datetime", tabIndex: "tabindex", readOnly: "readonly", strokeWidth: "stroke-width", dangerouslySetInnerHTML: "rawHtml", autoComplete: "autocomplete", autoFocus: "autofocus", spellCheck: "spellcheck", maxLength: "maxlength", crossOrigin: "crossorigin", srcSet: "srcset", fillRule: "fill-rule", clipRule: "clip-rule", strokeLinecap: "stroke-linecap", strokeLinejoin: "stroke-linejoin", stopColor: "stop-color", xlinkHref: "xlink:href", httpEquiv: "http-equiv", colSpan: "colspan", rowSpan: "rowspan", contentEditable: "contenteditable" };
const tableCtx = words("table thead tbody tfoot tr colgroup select optgroup");

const out = { files: {}, totals: {} };
const inc = (o, k, n = 1) => (o[k] = (o[k] || 0) + n);
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  const text = fs.readFileSync(abs, "utf8");
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const F = { renames: {}, unknownAttrs: {}, unknownTags: {}, boolOnNonBool: [], camelStyleKeys: [], eventFnProps: [], stringOnHandlers: [], spreads: 0, componentsUsed: {}, asyncFns: [], unbrandedLiterals: [], hCalls: 0, voidChildren: [], tableCtxNonIntrinsic: [], intrinsicCount: 0, displayName: [], rawHtmlTags: {} };
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const tagName = (t) => t.getText(sf);
  function visitAttrs(tag, attrs, node) {
    const isSvg = svgTags.has(tag) && tag !== "title";
    const custom = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag);
    for (const a of attrs.properties) {
      if (ts.isJsxSpreadAttribute(a)) { F.spreads++; continue; }
      const name = a.name.getText(sf);
      if (name === "dangerouslySetInnerHTML") inc(F.rawHtmlTags, tag);
      if (renames[name]) { inc(F.renames, `${name}->${renames[name]}`); continue; }
      if (/^on[A-Z]/.test(name)) { F.eventFnProps.push(`${line(a)}:${tag}.${name}`); continue; }
      if (/^on[a-z]+$/.test(name)) { F.stringOnHandlers.push(`${line(a)}:${tag}.${name}`); continue; }
      if (reserved.has(name) || forms.has(name) || name.startsWith("on:")) continue;
      if (name === "style" && a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression && ts.isObjectLiteralExpression(a.initializer.expression)) {
        for (const p of a.initializer.expression.properties) {
          const k = p.name ? p.name.getText(sf).replace(/^["']|["']$/g, "") : "(spread)";
          if (/[A-Z]/.test(k) && !k.startsWith("--")) F.camelStyleKeys.push(`${line(p)}:${k}`);
        }
      }
      const known = custom || commonAttrs.has(name) || (isSvg ? svgAttrs.has(name) : htmlAttrs.has(name)) || /^data-[\w.-]+$/.test(name) || /^aria-[\w.-]+$/.test(name);
      if (!known) inc(F.unknownAttrs, `${tag}.${name}`);
      // boolean-shorthand or {true}/{false} on a non-boolean attr (runtime: "requires a string")
      const isBoolInit = !a.initializer || (ts.isJsxExpression(a.initializer) && a.initializer.expression && (a.initializer.expression.kind === ts.SyntaxKind.TrueKeyword || a.initializer.expression.kind === ts.SyntaxKind.FalseKeyword));
      if (known && isBoolInit && !booleanAttrs.has(name) && !name.startsWith("aria-") && !name.startsWith("data-")) F.boolOnNonBool.push(`${line(a)}:${tag}.${name}`);
    }
  }
  function childKinds(node) {
    return node.children.filter((c) => !(ts.isJsxText(c) && !c.text.trim()));
  }
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const open = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = tagName(open.tagName);
      if (/^[a-z]/.test(tag)) {
        F.intrinsicCount++;
        const isKnown = htmlTags.has(tag) || svgTags.has(tag) || /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag);
        if (!isKnown) inc(F.unknownTags, tag);
        visitAttrs(tag, open.attributes, node);
        if (ts.isJsxElement(node) && voidTags.has(tag) && childKinds(node).length) F.voidChildren.push(`${line(node)}:${tag}`);
        if (ts.isJsxElement(node) && tableCtx.has(tag)) {
          for (const c of childKinds(node)) {
            if ((ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c))) {
              const ct = tagName((ts.isJsxElement(c) ? c.openingElement : c).tagName);
              if (!/^[a-z]/.test(ct)) F.tableCtxNonIntrinsic.push(`${line(c)}:${tag}>${ct}`);
            } else if (ts.isJsxFragment(c)) F.tableCtxNonIntrinsic.push(`${line(c)}:${tag}><>`);
            else if (ts.isJsxExpression(c)) F.tableCtxNonIntrinsic.push(`${line(c)}:${tag}>{expr}(check)`);
          }
        }
      } else inc(F.componentsUsed, tag);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
      const nm = node.name ? node.name.getText(sf) : (ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(sf) : "(anon)");
      let hasJsx = false; (function w(n) { if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) hasJsx = true; else ts.forEachChild(n, w); })(node.body || node);
      if (/^[A-Z]/.test(nm) || hasJsx) F.asyncFns.push(`${line(node)}:${nm}${hasJsx ? " [returns JSX]" : ""}`);
    }
    if (ts.isObjectLiteralExpression(node)) {
      const keys = node.properties.map((p) => (p.name ? p.name.getText(sf) : ""));
      if (keys.includes("type") && keys.includes("props")) F.unbrandedLiterals.push(`${line(node)}:{${keys.join(",")}}`);
    }
    if (ts.isCallExpression(node)) {
      const c = node.expression.getText(sf);
      if (c === "h" || c === "createElement" || c.endsWith(".createElement") && !c.startsWith("document")) F.hCalls++;
    }
    if (ts.isBinaryExpression(node) && node.left.getText(sf).endsWith(".displayName")) F.displayName.push(`${line(node)}:${node.getText(sf).slice(0, 80)}`);
    ts.forEachChild(node, visit);
  }
  visit(sf);
  out.files[rel] = F;
  for (const [k, v] of Object.entries(F)) {
    if (typeof v === "number") inc(out.totals, k, v);
    else if (Array.isArray(v)) inc(out.totals, k, v.length);
    else { out.totals[k] = out.totals[k] || {}; for (const [kk, vv] of Object.entries(v)) inc(out.totals[k], kk, vv); }
  }
}
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
const t = out.totals;
const sortObj = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", ");
console.log("files:", files.length, "intrinsic JSX elements:", t.intrinsicCount);
console.log("renames:", sortObj(t.renames));
console.log("unknownAttrs:", sortObj(t.unknownAttrs));
console.log("unknownTags:", sortObj(t.unknownTags));
console.log("rawHtml(dangerously) tags:", sortObj(t.rawHtmlTags));
for (const k of ["boolOnNonBool", "camelStyleKeys", "eventFnProps", "stringOnHandlers", "spreads", "asyncFns", "unbrandedLiterals", "hCalls", "voidChildren", "tableCtxNonIntrinsic", "displayName"]) console.log(k + ":", t[k]);
console.log("top components:", sortObj(t.componentsUsed).split(", ").slice(0, 40).join(", "));
