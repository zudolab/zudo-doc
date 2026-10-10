import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {chromium} from '/workspace/zudo-doc/node_modules/@playwright/test/index.mjs';
const output='/tmp/zudo421-parity/duration-candidates';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium'});
const report={browser:browser.version(),method:'Real-route transition-colors candidate measurements; settled default/hover/focus; no network stubs or product patches',variants:{},gaps:[],differences:[]};
const properties=['color','backgroundColor','borderColor','backgroundImage','outlineStyle','outlineWidth','outlineColor','outlineOffset','opacity','margin','width','height','textDecorationLine','transitionProperty','transitionDuration','transitionTimingFunction'];
try{for(const [variant,root]of [['baseline','/workspace/zudo-v2-baseline/dist'],['current','/workspace/zudo-doc/dist']]){
 const result={root,states:{}};report.variants[variant]=result;
 const server=createServer((req,res)=>{let path;try{path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}if(existsSync(path)&&statSync(path).isDirectory())path=join(path,'index.html');if(!existsSync(path)||!statSync(path).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.json':'application/json','.svg':'image/svg+xml'})[extname(path)]??'application/octet-stream');createReadStream(path).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{for(const scheme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1600,height:1000},colorScheme:scheme});const page=await context.newPage();page.setDefaultTimeout(7000);
  const go=async route=>{const response=await page.goto(`http://127.0.0.1:${server.address().port}${route}`,{waitUntil:'load'});if(!response.ok())throw new Error(`${route}: ${response.status()}`);await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Font readiness timeout')),10000))]));};
  const capture=async(key,loc)=>{if(await loc.count()!==1)throw new Error(`${key}: expected one element`);await loc.evaluate(async el=>{getComputedStyle(el).color;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const animations=el.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime));await Promise.race([Promise.allSettled(animations.map(a=>a.finished)),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Animation settle timeout')),5000))]);});result.states[`${scheme}/${key}`]=await loc.evaluate((el,properties)=>{const s=getComputedStyle(el);return {tag:el.tagName,classes:el.getAttribute('class'),computed:{...Object.fromEntries(properties.map(p=>[p,s[p]])),focused:el===document.activeElement,focusVisible:el.matches(':focus-visible')},href:el.getAttribute('href'),ariaLabel:el.getAttribute('aria-label')};},properties);};
  const attempt=async(key,fn)=>{try{await fn();}catch(error){report.gaps.push({variant,scheme,key,error:String(error)});}};
  const measure=async(key,loc)=>{await loc.waitFor({state:'visible'});await page.mouse.move(0,0);await capture(key+'-default',loc);await loc.hover();await capture(key+'-hover',loc);await page.mouse.move(0,0);await page.keyboard.press('Tab');await loc.focus();await capture(key+'-focus',loc);};
  await attempt('header-controls',async()=>{
   await go('/docs/getting-started/');
   for(const [key,selector]of [['language','[data-language-toggle]'],['version','[data-version-toggle]'],['search','[data-open-search]'],['ai-trigger','#ai-chat-trigger'],['token-trigger','#design-token-trigger'],['github-link','header a[href*="github.com"][target="_blank"]'],['nav-plain','header a[data-nav-item]:not([aria-haspopup])'],['nav-dropdown','header [data-nav-item-dropdown] > a']])await attempt(key,()=>measure(key,page.locator(selector).filter({visible:true}).first()));
   await attempt('history',()=>measure('history',page.getByRole('button',{name:'View document history',exact:true})));
  });
  await attempt('toc',async()=>{await go('/docs/components/html-preview/');await measure('toc-link',page.locator('[data-zd-toc] a').filter({visible:true}).first());});
  await attempt('code-tabs',async()=>{await go('/docs/components/tabs/');await measure('code-tab-inactive',page.locator('[data-tab-btn][aria-selected="false"]').filter({visible:true}).first());});
  await attempt('ai-close',async()=>{await go('/docs/getting-started/');await page.locator('#ai-chat-trigger').click();const dialog=page.locator('dialog').filter({hasText:'AI Assistant'});await dialog.waitFor({state:'visible'});await measure('ai-close',dialog.getByRole('button',{name:'Close',exact:true}));await page.keyboard.press('Escape');});
  await attempt('theme-packs',async()=>{
   await go('/');const launcher=page.getByRole('button',{name:'Theme pack switcher',exact:true});await measure('pack-launcher',launcher);await launcher.click();const flyout=page.locator('[data-switcher-card]');await flyout.waitFor({state:'visible'});
   for(const [key,label]of [['pack-prev','Previous theme pack'],['pack-next','Next theme pack'],['pack-browse','Browse all theme packs'],['pack-close','Close theme pack switcher']])await attempt(key,()=>measure(key,flyout.getByRole('button',{name:label,exact:true})));
   await flyout.getByRole('button',{name:'Browse all theme packs',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Preview theme',exact:true});await dialog.waitFor({state:'visible'});await measure('pack-dialog-close',dialog.getByRole('button',{name:'Close',exact:true}));await measure('pack-card',dialog.getByRole('button',{name:/^Apply /}).first());await page.keyboard.press('Escape');
  });
  await context.close();
 }}finally{await new Promise(ok=>server.close(ok));}
}
report.unavailableCandidates=['Theme-pack Retry requires a naturally failing registry request; not induced or stubbed','Custom header link branches depend on host configuration; generic/header-specific variants not present are not assumed covered'];
const a=report.variants.baseline.states,b=report.variants.current.states;for(const key of new Set([...Object.keys(a),...Object.keys(b)])){if(!a[key]||!b[key]){report.differences.push({key,missing:!a[key]?'baseline':'current'});continue;}for(const prop of Object.keys(a[key].computed))if(a[key].computed[prop]!==b[key].computed[prop])report.differences.push({key,property:prop,baseline:a[key].computed[prop],current:b[key].computed[prop]});}
}finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({counts:Object.fromEntries(Object.entries(report.variants).map(([k,v])=>[k,Object.keys(v.states).length])),gaps:report.gaps,differences:report.differences},null,2));process.exitCode=report.gaps.length||report.differences.length||report.unavailableCandidates.length?1:0;
