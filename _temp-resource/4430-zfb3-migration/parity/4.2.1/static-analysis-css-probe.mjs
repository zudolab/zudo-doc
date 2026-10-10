import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from '/workspace/zudo-doc/node_modules/@playwright/test/index.mjs';
const out = '/tmp/zudo421-parity/locked-css';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium'});
const report={browser:browser.version(),created:new Date().toISOString(),method:'Unmodified built HTML, same real routes and public UI; no injected CSS, elements, network stubs or asset mirrors',variants:{},differences:[],gaps:[]};
const props=['display','visibility','color','backgroundColor','borderColor','borderWidth','borderStyle','width','height','margin','padding','fontFamily','fontSize','fontWeight','lineHeight','boxSizing','appearance','outlineStyle','outlineWidth','outlineColor','opacity','transform','transitionProperty','transitionDuration','transitionTimingFunction','animationName','animationDuration','listStyleType','verticalAlign','textDecorationLine','content','WebkitTapHighlightColor'];
const captures={};
async function fontsReady(page){await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Font readiness timed out')),10000))]));}
async function snapshot(page,key,selector,pseudo=null){
 await fontsReady(page);
 const loc=(typeof selector==='string'?page.locator(selector):selector).first();
 if(!await loc.count())throw new Error(`Required element absent: ${selector}`);
 const value=await loc.evaluate((el,{props,pseudo})=>{
  const s=getComputedStyle(el,pseudo);const matching=[];const inaccessible=[];
  const visit=(rules,ancestry=[])=>{for(const r of rules){if(r.selectorText){let matches=false;try{matches=el.matches(r.selectorText);}catch{}if(matches){const declarations={};for(const p of ['display','margin-top','padding-left','color','border-color','transition-duration','transition-timing-function','width','font-weight','--tw-ease','--zw-ease-in-out'])if(r.style.getPropertyValue(p))declarations[p]=r.style.getPropertyValue(p)+(r.style.getPropertyPriority(p)?' !important':'');if(Object.keys(declarations).length)matching.push({selector:r.selectorText,ancestry,declarations});}}else if(r.cssRules)visit(r.cssRules,[...ancestry,r.conditionText??r.name??r.constructor.name]);}};
  for(const sheet of document.styleSheets){try{visit(sheet.cssRules);}catch{inaccessible.push(sheet.href);}}
  return {tag:el.tagName,classes:el.getAttribute('class'),text:el.textContent?.trim().slice(0,90),pseudo,computed:Object.fromEntries(props.map(p=>[p,s[p]])),matchingRules:matching,inaccessibleStylesheets:inaccessible};
 },{props,pseudo});captures[key]=value;
}
async function attempt(key,fn){try{await fn();}catch(e){report.gaps.push({variant:report.active,key,error:String(e)});}}
try{
for(const [variant,dir]of [['baseline','/workspace/zudo-v2-baseline/dist'],['current','/workspace/zudo-doc/dist']]){
 report.active=variant;for(const k of Object.keys(captures))delete captures[k];
 const root=resolve(dir);const server=createServer((req,res)=>{let path;try{path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}if(existsSync(path)&&statSync(path).isDirectory())path=join(path,'index.html');if(!existsSync(path)){res.writeHead(404).end();return;}const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};res.setHeader('Content-Type',mime[extname(path)]??'application/octet-stream');createReadStream(path).pipe(res);});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`;
 try{
 for(const scheme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1600,height:1000},colorScheme:scheme});const page=await context.newPage();page.setDefaultTimeout(7000);
  const go=async route=>{const response=await page.goto(base+route,{waitUntil:'load'});if(!response?.ok())throw new Error(`${route}: ${response?.status()}`);};
  const snap=(key,selector,pseudo)=>snapshot(page,`${scheme}/${key}`,selector,pseudo);
  const chevron=async state=>{const svg=page.locator('[data-site-nav] button[aria-expanded] svg').first();await snap(`chevron-svg-${state}`,svg);captures[`${scheme}/chevron-effective-${state}`]={computed:await svg.evaluate(el=>{const style=getComputedStyle(el),m=el.getScreenCTM(),rect=el.getBoundingClientRect();if(!m)throw new Error('No SVG screen matrix');return {color:style.color,stroke:style.stroke,width:rect.width,height:rect.height,orientationDeg:Math.round(Math.atan2(m.b,m.a)*180/Math.PI),expanded:el.closest('button').getAttribute('aria-expanded')};})};};
  await attempt(`${scheme}/home-icons`,async()=>{await go('/');for(const width of [1280,1536,1600]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);await snap(`icon-${width}`,'svg[class~="w-[18px]"]');if(captures[`${scheme}/icon-${width}`].computed.width!=='18px')throw new Error('Expected inert 2xl icon width 18px');}await snap('hr','hr');});
  await attempt(`${scheme}/authored-dl-collision`,async()=>{await go('/files/demo/spec.pdf/');await snap('details-dt','[data-zd-asset-details-list] dt');await snap('details-dd','[data-zd-asset-details-list] dd');await snap('asset-details-transition','.zd-asset-details-toggle');});
  await attempt(`${scheme}/peer`,async()=>{await go('/docs/components/note-tray-index/');const peer=page.locator('a.peer').first();await snap('peer-default','a.peer ~ time');await peer.hover();await snap('peer-hover','a.peer ~ time');await page.mouse.move(0,0);await peer.focus();await snap('peer-focus','a.peer ~ time');for(const state of ['hover','focus'])if(captures[`${scheme}/peer-${state}`].computed.color===captures[`${scheme}/peer-default`].computed.color)throw new Error(`Peer ${state} did not change affected descendant color`);});
  await attempt(`${scheme}/transitions`,async()=>{await go('/docs/getting-started/');await snap('sidebar-transition','.zd-desktop-sidebar-toggle');await go('/docs/blog/sixteen-rem-drawer/');await snap('toc-transition','.zd-desktop-toc-toggle');});
  await attempt(`${scheme}/tree-transition`,async()=>{await go('/');const button=page.locator('[data-site-nav] button[aria-expanded]').first();await snap('tree-transition-before','[data-site-nav] button[aria-expanded] .transition-transform');await chevron('before');await button.click();await page.waitForTimeout(350);await snap('tree-transition-after','[data-site-nav] button[aria-expanded] .transition-transform');await chevron('after');});
  await attempt(`${scheme}/hidden-reset`,async()=>{await go('/docs/components/tabs/');await snap('hidden-reset','[hidden][role="tabpanel"]');});
  await attempt(`${scheme}/checkbox-reset`,async()=>{await go('/docs/claude-skills/color-scheme-a11y/');await snap('checkbox-reset','input[type="checkbox"]');});
  await attempt(`${scheme}/search-controls`,async()=>{await go('/docs/getting-started/');await snap('search-input','[data-search-input]');await snap('search-placeholder','[data-search-input]','::placeholder');});
  await attempt(`${scheme}/ai-controls`,async()=>{await go('/docs/getting-started/');await page.locator('#ai-chat-trigger').click();const dialog=page.locator('dialog').filter({hasText:'AI Assistant'});await dialog.waitFor({state:'visible'});await snap('ai-dialog',dialog);await snap('ai-backdrop',dialog,'::backdrop');const input=dialog.getByPlaceholder('Type your message...');await snap('ai-input',input);await snap('ai-placeholder',input,'::placeholder');await input.focus();await snap('ai-input-focus',input);await page.keyboard.press('Tab');const active=page.locator(':focus');await snap('ai-keyboard-next',active);await page.keyboard.press('Escape');});
  await attempt(`${scheme}/panel-ui`,async()=>{
   await go('/docs/getting-started/');await page.locator('#design-token-trigger').click();await page.locator('.tokenpanel-shell').waitFor({state:'visible'});await page.getByRole('tab',{name:/^Spacing\b/}).click();
   const token='--spacing-hsp-lg',input=page.getByLabel(`${token} value`,{exact:true});await input.waitFor({state:'visible'});await snap('panel-number',input);
   const read=()=>page.evaluate(t=>getComputedStyle(document.documentElement).getPropertyValue(t).trim(),token);
   const before=await read();const originalInput=await input.inputValue();await input.fill('3');await page.waitForFunction(t=>getComputedStyle(document.documentElement).getPropertyValue(t).trim()==='3rem',token);
   captures[`${scheme}/panel-token-edit`]={computed:{before,edited:await read(),originalInput}};
   await page.getByRole('button',{name:`Revert ${token}`,exact:true}).click();await page.waitForFunction(({t,v})=>getComputedStyle(document.documentElement).getPropertyValue(t).trim()===v,{t:token,v:before});captures[`${scheme}/panel-token-edit`].computed.reverted=await read();
   await page.getByRole('tab',{name:/^Color\b/}).click();await snap('panel-select','.tokenpanel-shell select');
  });
  await context.close();
  // No-JS context isolates authored CSS group behavior from click listeners.
  const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:1600,height:1000},colorScheme:scheme});const p=await nojs.newPage();p.setDefaultTimeout(7000);
  await attempt(`${scheme}/group-css-only`,async()=>{const res=await p.goto(base+'/docs/getting-started/',{waitUntil:'load'});if(!res.ok())throw new Error(String(res.status()));const group=p.locator('[data-language-switcher]').first();await snapshot(p,`${scheme}/group-default`,'[data-language-menu]');if(await p.locator('[data-language-menu]').first().isVisible())throw new Error('Group menu unexpectedly initially visible');await group.hover();if(!await p.locator('[data-language-menu]').first().isVisible())throw new Error('Group hover did not reveal descendant');await snapshot(p,`${scheme}/group-hover`,'[data-language-menu]');await p.mouse.move(0,0);await group.locator('[data-language-toggle]').focus();if(!await p.locator('[data-language-menu]').first().isVisible())throw new Error('Group focus did not reveal descendant');await snapshot(p,`${scheme}/group-focus`,'[data-language-menu]');});await nojs.close();
 }
 report.variants[variant]={root,captures:structuredClone(captures)};
 }finally{await new Promise(ok=>server.close(ok));}
}
const a=report.variants.baseline.captures,b=report.variants.current.captures;
for(const key of new Set([...Object.keys(a),...Object.keys(b)])){if(!a[key]||!b[key]){report.differences.push({key,missing:!a[key]?'baseline':'current'});continue;}for(const p of new Set([...Object.keys(a[key].computed),...Object.keys(b[key].computed)]))if(a[key].computed[p]!==b[key].computed[p])report.differences.push({key,property:p,baseline:a[key].computed[p],current:b[key].computed[p]});}
report.uncoveredResetInventory=['file-selector-button: no shared static input[type=file] found','abbr, small, sub, sup: no shared static elements found','textarea: no shared static element found; actual AI control is input[type=text], measured separately','font/emoji and tap highlight need platform-specific visual interpretation; properties alone do not prove glyph parity'];
}finally{delete report.active;await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({states:Object.fromEntries(Object.entries(report.variants).map(([v,r])=>[v,Object.keys(r.captures).length])),gaps:report.gaps,differences:report.differences,uncovered:report.uncoveredResetInventory},null,2));
process.exitCode=report.gaps.length||report.differences.length||report.uncoveredResetInventory.length?1:0;
