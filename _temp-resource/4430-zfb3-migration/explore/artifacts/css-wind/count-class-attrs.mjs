import { execSync } from "node:child_process"; import { readFileSync } from "node:fs"; import { createRequire } from "node:module"; import { join } from "node:path";
const ROOT=process.argv[2]; const ts=createRequire(join(ROOT,"package.json"))("typescript");
const groups={"packages/zudo-doc/src":0,"pages":0,"src":0,"packages/create-zudo-doc/templates":0}; const kinds={};
for (const f of execSync(`git -C ${ROOT} ls-files 'packages/zudo-doc/src/**/*.tsx' 'pages/**/*.tsx' 'src/**/*.tsx' 'packages/create-zudo-doc/templates/**/*.tsx'`,{encoding:"utf8"}).split("\n").filter(x=>x&&!x.includes("__tests__"))) {
  const sf=ts.createSourceFile(f,readFileSync(join(ROOT,f),"utf8"),99,true,ts.ScriptKind.TSX);
  (function v(n){ if(ts.isJsxAttribute(n)&&/^(class|className)$/.test(n.name.getText())){ const g=Object.keys(groups).find(k=>f.startsWith(k)); groups[g]++; const i=n.initializer; const k=!i?"bare":ts.isStringLiteral(i)?"string":ts.isJsxExpression(i)&&i.expression?(ts.isTemplateExpression(i.expression)?"template-with-interp":ts.isNoSubstitutionTemplateLiteral(i.expression)?"template-static":ts.isStringLiteral(i.expression)?"string-in-braces":ts.SyntaxKind[i.expression.kind]):"other"; kinds[k]=(kinds[k]||0)+1;} ts.forEachChild(n,v);})(sf);
}
console.log("class/className JSX attribute sites by tree:",groups); console.log("initializer kinds:",kinds);
