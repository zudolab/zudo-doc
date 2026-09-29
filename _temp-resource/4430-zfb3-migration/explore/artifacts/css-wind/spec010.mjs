import fs from "node:fs";
// Count authored UNLAYERED selectors whose specificity is exactly (0,1,0):
// these tie with a plain utility, and wind moves utilities AFTER authored CSS.
function spec(sel){
  let s=sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g,"");
  s=s.replace(/::?[a-z-]+\((?:[^()]|\([^()]*\))*\)/g,(m)=>{ // :is/:not/:has -> take arg roughly
    const inner=m.replace(/^::?[a-z-]+\(/,"").slice(0,-1);
    if(/^:(is|not|has)\(/.test(m)){const [a,b,c]=spec(inner.split(",")[0]);return " "+"#".repeat(a)+".c".repeat(b)+" e".repeat(c)+" ";}
    return ".pc";
  });
  const ids=(s.match(/#[\w-]+/g)||[]).length;
  const cls=(s.match(/\.[\w-]+|\[[^\]]*\]|(?<!:):(?!:)[a-z-]+/g)||[]).length;
  const els=(s.replace(/\[[^\]]*\]/g,"").match(/(^|[\s>+~])[a-z][\w-]*|::[a-z-]+/g)||[]).length;
  return [ids,cls,els];
}
const out={};
for (const f of process.argv.slice(2)) {
  let css=fs.readFileSync(f,"utf8").replace(/\/\*[\s\S]*?\*\//g,"");
  // strip layered blocks
  css=css.replace(/@layer [\w-]+\s*\{(?:[^{}]|\{[^{}]*\})*\}/g,"");
  const sels=[...css.matchAll(/(^|[};])\s*([^{}@;]+)\{/g)].map(m=>m[2].trim()).filter(s=>!/^(from|to|\d+%)$/.test(s));
  let tie=[];
  for (const group of sels) for (const sel of group.split(/,(?![^(]*\))/)) {
    const [a,b,c]=spec(sel.trim()); if(a===0&&b===1&&c===0) tie.push(sel.trim());
  }
  out[f]=tie;
  console.log(f.split("/").slice(-2).join("/"), "selectors:", sels.length, "exact (0,1,0):", tie.length);
}
fs.writeFileSync("spec010.json",JSON.stringify(out,null,1));
