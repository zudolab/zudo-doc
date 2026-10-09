/** Fixture-only public stylesheet controls; NOT actual-route or renderer parity. */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, sep, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '/workspace/zudo-doc/node_modules/@playwright/test/index.mjs';
const output='/tmp/zudo421-parity/reset-controls';await mkdir(output,{recursive:true});
const body=`<main class="zd-content"><h1>Public stylesheet reset controls</h1><p id="ordinary">Ordinary text 🙂 日本語 <abbr id="abbr" title="Hypertext Markup Language">HTML</abbr> <small id="small">Small text</small> H<sub id="sub">2</sub>O x<sup id="sup">2</sup></p><hr id="hr"><form><label>Text <input id="text" type="text" placeholder="Text placeholder"></label><label>Textarea <textarea id="textarea" placeholder="Textarea placeholder">Two lines\nof text</textarea></label><label>File <input id="file" type="file"></label><label>Select <select id="select"><option>First option</option><option>Second option</option></select></label><button id="button" type="button">Ordinary button</button><input id="check" type="checkbox"><input id="radio" type="radio" name="radio"><div id="hidden" hidden>Hidden control</div></form><a id="link" href="#ordinary">Keyboard focus link</a><button id="open" type="button" onclick="document.querySelector('dialog').showModal()">Open fixture dialog</button><dialog id="dialog"><p>Real native dialog</p><button id="close" type="button" onclick="this.closest('dialog').close()">Close fixture dialog</button></dialog></main>`;
const props=['display','visibility','boxSizing','color','backgroundColor','borderColor','borderStyle','borderWidth','width','height','margin','padding','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','verticalAlign','textDecorationLine','textDecorationStyle','appearance','outlineStyle','outlineWidth','outlineOffset','outlineColor','opacity','content','cursor','WebkitTapHighlightColor'];
const report={label:'Fixture-only public stylesheet comparison; no actual-route, application hydration or renderer equivalence claim',markupSha256:createHash('sha256').update(body).digest('hex'),variants:{},gaps:[],differences:[]};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium'});report.browser=browser.version();
try{for(const [variant,dir]of [['baseline','/workspace/zudo-v2-baseline/dist'],['current','/workspace/zudo-doc/dist']]){
 const root=resolve(dir),pageHtml=await readFile(join(root,'docs/getting-started/index.html'),'utf8');
 const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m=>[m[1],m[2]??m[3]??m[4]]));
 const links=[...pageHtml.matchAll(/<link\b[^>]*>/g)].map(m=>attrs(m[0])).filter(a=>a.rel==='stylesheet');if(!links.length)throw new Error(`${variant} no original stylesheets`);
 const stylesheets=[];
 for(const link of links){const url=new URL(link.href,'http://fixture.local');if(url.origin!=='http://fixture.local')throw new Error('External stylesheet needs explicit evidence, not mirroring: '+link.href);const file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep))throw new Error('CSS outside dist');const bytes=await readFile(file);stylesheets.push({href:link.href,sha256:createHash('sha256').update(bytes).digest('hex')});}
 const render=scheme=>`<!doctype html><html lang="en" data-theme="${scheme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links.map(a=>`<link rel="stylesheet" href="${a.href}">`).join('')}</head><body>${body}</body></html>`;
 for(const scheme of ['light','dark'])await writeFile(join(output,`${variant}-${scheme}.html`),render(scheme));
 const server=createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/__reset-control.html'){res.setHeader('Content-Type','text/html');res.end(render(url.searchParams.get('scheme')==='dark'?'dark':'light'));return;}let path;try{path=resolve(root,'.'+decodeURIComponent(url.pathname));}catch{res.writeHead(400).end();return;}if(!path.startsWith(root+sep)||!existsSync(path)||!statSync(path).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml'})[extname(path)]??'application/octet-stream');createReadStream(path).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const result={root,stylesheets,states:{}};report.variants[variant]=result;
 try{for(const scheme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1280,height:900},colorScheme:scheme});const page=await context.newPage();page.setDefaultTimeout(7000);
  const errors=[];page.on('requestfailed',r=>errors.push({url:r.url(),error:r.failure()?.errorText}));page.on('pageerror',e=>errors.push({error:String(e)}));
  try{await page.goto(`http://127.0.0.1:${server.address().port}/__reset-control.html?scheme=${scheme}`,{waitUntil:'load'});await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Font readiness timeout')),10000))]));
   const capture=async(key,id,pseudo=null)=>{const loc=page.locator('#'+id);if(await loc.count()!==1)throw new Error('Missing/nonunique fixture '+id);result.states[`${scheme}/${key}`]=await loc.evaluate((el,{props,pseudo})=>{const s=getComputedStyle(el,pseudo);return Object.fromEntries(props.map(p=>[p,s[p]]));},{props,pseudo});};
   for(const id of ['ordinary','abbr','small','sub','sup','hr','text','textarea','file','select','button','check','radio','hidden','link'])await capture(id,id);
   await capture('text-placeholder','text','::placeholder');await capture('textarea-placeholder','textarea','::placeholder');await capture('file-selector-button','file','::file-selector-button');
   await page.locator('#button').focus();await page.keyboard.press('Tab');if(!await page.locator('#check').evaluate(el=>el===document.activeElement))throw new Error('Keyboard focus failed to reach checkbox');await capture('checkbox-keyboard-focus','check');
   await page.locator('#textarea').focus();await capture('textarea-focus','textarea');
   await page.locator('#open').click();await page.locator('#dialog').waitFor({state:'visible'});await capture('dialog-open','dialog');await capture('dialog-backdrop','dialog','::backdrop');await capture('dialog-button-focus','close');await page.keyboard.press('Escape');if(await page.locator('#dialog').isVisible())throw new Error('Native Escape failed');
  }catch(e){report.gaps.push({variant,scheme,error:String(e)});}finally{if(errors.length)report.gaps.push({variant,scheme,networkOrPageErrors:errors});await context.close();}
 }}finally{await new Promise(ok=>server.close(ok));}
}
const a=report.variants.baseline.states,b=report.variants.current.states;
for(const key of new Set([...Object.keys(a),...Object.keys(b)])){if(!a[key]||!b[key]){report.differences.push({key,missing:!a[key]?'baseline':'current'});continue;}for(const prop of props)if(a[key][prop]!==b[key][prop])report.differences.push({key,property:prop,baseline:a[key][prop],current:b[key][prop]});}
}finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({label:report.label,states:Object.fromEntries(Object.entries(report.variants).map(([v,r])=>[v,Object.keys(r.states).length])),gaps:report.gaps,differences:report.differences},null,2));process.exitCode=report.gaps.length||report.differences.length?1:0;
