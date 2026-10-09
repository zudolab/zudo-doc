import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {chromium} from '/workspace/zudo-doc/node_modules/@playwright/test/index.mjs';
const output='/tmp/zudo421-parity/chevron-animation';await mkdir(output,{recursive:true});
const report={method:'Actual home SiteTreeNav public expand/collapse clicks; SVG screen CTM sampled every animation frame until stable. No DOM/CSS/network patches. Frame trajectories retained; no fixed-clock angle equality assertion.',created:new Date().toISOString(),variants:{},gaps:[],comparisons:[]};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium'});report.browser=browser.version();
try{for(const [variant,root]of [['baseline','/workspace/zudo-v2-baseline/dist'],['current','/workspace/zudo-doc/dist']]){
 const result={root,states:{}};report.variants[variant]=result;
 const server=createServer((req,res)=>{let path;try{path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}if(existsSync(path)&&statSync(path).isDirectory())path=join(path,'index.html');if(!existsSync(path)||!statSync(path).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.json':'application/json','.svg':'image/svg+xml'})[extname(path)]??'application/octet-stream');createReadStream(path).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{for(const scheme of ['light','dark']){
 const context=await browser.newContext({viewport:{width:1600,height:1000},colorScheme:scheme});const page=await context.newPage();page.setDefaultTimeout(7000);
 try{const response=await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});if(!response.ok())throw new Error(String(response.status()));await page.evaluate(()=>document.fonts.ready);
 const button=page.locator('[data-site-nav] button[aria-expanded]').first();await button.waitFor({state:'visible'});
 for(let action=0;action<2;action++){
 await button.evaluate(button=>{
 const svg=button.querySelector('svg');if(!svg)throw new Error('Chevron missing');const owner=svg.closest('.transition-transform');if(!owner)throw new Error('Transition owner missing');
 const read=()=>{const m=svg.getScreenCTM(),s=getComputedStyle(svg),r=svg.getBoundingClientRect();if(!m)throw new Error('No SVG CTM');return {angleDeg:Math.atan2(m.b,m.a)*180/Math.PI,matrix:{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f},bounds:{x:r.x,y:r.y,width:r.width,height:r.height},color:s.color,stroke:s.stroke,expanded:button.getAttribute('aria-expanded')};};
 const os=getComputedStyle(owner),initial=read(),metadata={ownerTag:owner.tagName,ownerClasses:owner.getAttribute('class'),transitionProperty:os.transitionProperty,transitionDuration:os.transitionDuration,transitionTimingFunction:os.transitionTimingFunction};
 window.__chevronDiagnostic=new Promise(resolve=>button.addEventListener('click',()=>{const start=performance.now(),frames=[];let stable=0,moved=false,last=initial.angleDeg;const frame=timestamp=>{const value=read();frames.push({elapsedMs:timestamp-start,...value});if(Math.abs(value.angleDeg-initial.angleDeg)>.01)moved=true;if(Math.abs(value.angleDeg-last)<.001)stable++;else stable=0;last=value.angleDeg;if((moved&&stable>=6)||timestamp-start>2000){resolve({initial,metadata,frames,final:value,moved,settled:moved&&stable>=6,firstMovementMs:frames.find(f=>Math.abs(f.angleDeg-initial.angleDeg)>.01)?.elapsedMs,lastMovementMs:frames.reduce((last,f,i)=>i&&Math.abs(f.angleDeg-frames[i-1].angleDeg)>.001?f.elapsedMs:last,0)});return;}requestAnimationFrame(frame);};requestAnimationFrame(frame);},{once:true}));
 });await button.click();const state=await page.evaluate(()=>window.__chevronDiagnostic);result.states[`${scheme}/${state.final.expanded==='true'?'expand':'collapse'}`]=state;if(!state.settled)report.gaps.push({variant,scheme,action,error:'No measured movement or no settled endpoint within 2s'});
 }
 }catch(error){report.gaps.push({variant,scheme,error:String(error)});}finally{await context.close();}
 }}finally{await new Promise(ok=>server.close(ok));}
}
const a=report.variants.baseline.states,b=report.variants.current.states;for(const key of new Set([...Object.keys(a),...Object.keys(b)])){if(!a[key]||!b[key]){report.comparisons.push({key,missing:!a[key]?'baseline':'current'});continue;}report.comparisons.push({key,baselineOwner:a[key].metadata,currentOwner:b[key].metadata,baselineMovement:{firstMs:a[key].firstMovementMs,lastMs:a[key].lastMovementMs},currentMovement:{firstMs:b[key].firstMovementMs,lastMs:b[key].lastMovementMs},endpointBoundsDifferences:['width','height'].filter(p=>Math.abs(a[key].final.bounds[p]-b[key].final.bounds[p])>.001),endpointDifferences:['angleDeg','color','stroke','expanded'].filter(p=>typeof a[key].final[p]==='number'?Math.abs(a[key].final[p]-b[key].final[p])>.001:a[key].final[p]!==b[key].final[p]),baselineAngles:a[key].frames.map(f=>({t:f.elapsedMs,angle:f.angleDeg})),currentAngles:b[key].frames.map(f=>({t:f.elapsedMs,angle:f.angleDeg}))});}
}finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({gaps:report.gaps,comparisons:report.comparisons},null,2));process.exitCode=report.gaps.length?1:0;
