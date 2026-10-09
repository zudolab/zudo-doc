from pathlib import Path
import json,html,collections,difflib
root=Path('_temp-resource/4430-zfb3-migration/parity/4.2.1')
r=json.load(open('/tmp/zudo421-parity/all-body-raw.json'))
def decoded(events):
 out=[]
 for k,v in events:
  if k in ['text','entity','charref']:
   if k=='entity':v=html.unescape('&'+v+';')
   if k=='charref':v=html.unescape('&#'+v+';')
   if out and out[-1][0]=='text':out[-1][1]+=v
   else:out.append(['text',v])
  else:out.append([k,v])
 return out
for key,p in r['bodyPatterns'].items():
 routes=p['routes'];c=p['change'];body=str(c)
 if decoded(c['before'])==decoded(c['after']):category='entity serialization; identical decoded Mermaid text'
 elif key in ['1f6788873a9c482e','602f40dfa9e22d85']:category='SiteTreeNav reactive rotation wrapper; site-tree-nav-island/index.tsx:277'
 elif all('setup-preset-generator' in f for f in routes):category='PresetGenerator SSR fallback heading correction; pages/lib/_preset-generator.tsx:33'
 elif all('claude-md/packages--create-zudo-doc' in f for f in routes):category='Generated CLAUDE documentation reflects authored package handbook migration'
 elif any('Agent-readable export' in body or 'Read-only MCP server' in body or 'エージェント向けエクスポート' in body or '読み取り専用MCPサーバー' in body for _ in [0]) and not c['before']:category='Authorized agent-export/MCP content and navigation addition'
 elif key in ['9c63adb0d9ab5fac','2317e85724321da0','344323200413ca46','bed7844017e4d47e']:category='DocPager neighbor changes caused by authorized inserted guides'
 elif all(any('/'+part+'/' in '/'+f for part in ['guides/configuration','guides/llms-txt','guides/search','reference/create-zudo-doc','reference/design-token-panel','reference/host-chrome-bindings']) for f in routes):category='Authored EN/JA migration/agent documentation, TOC, or git-derived update metadata'
 else:category='UNCLASSIFIED'
 p['classification']=category;p['uniqueRouteCount']=len(set(routes));p['occurrences']=len(routes);p['routes']=sorted(set(routes))
counts=collections.Counter(p['classification']for p in r['bodyPatterns'].values())
r['summary']={'sharedRoutes':len(r['routes']),'exactBodyEventSequences':sum(x['bodyEventSequenceEqual']for x in r['routes']),'changedBodyRoutes':sum(not x['bodyEventSequenceEqual']for x in r['routes']),'uniqueChangedPatterns':len(r['bodyPatterns']),'patternClassifications':dict(counts),'changedScriptRoutes':sum(not x['scriptsEqual']for x in r['routes']),'changedStyleRoutes':sum(not x['stylesEqual']for x in r['routes'])}
r['provenance']={'baseline':'337b9f110793dccb4759bddd5273eab38cd9d2f0','current':'2926b1da1ee1b1f3d402fbe02543a1d87ba0d9fc','readOnlyAnalysis':True,'events':'body element start/end, literal text/entity/charref; comments and scripts/styles explicitly separate','notAGateNormalizer':True}
scripts=[]
for index,label,owner in [(0,'Search result decoration class','packages/zudo-doc/scripts/gen-search-widget-script.mjs'),(2,'Language switcher emitted local identifier names','packages/zudo-doc/scripts/gen-switcher-scripts.mjs'),(3,'Version switcher emitted local identifier names','packages/zudo-doc/scripts/gen-switcher-scripts.mjs')]:
 a=Path(f'/tmp/zudo421-parity/body-script-{index}-v2.js').read_text();b=Path(f'/tmp/zudo421-parity/body-script-{index}-current.js').read_text()
 scripts.append({'index':index,'description':label,'owner':owner,'routes':787,'beforeBytes':len(a.encode()),'afterBytes':len(b.encode()),'actualDiff':list(difflib.unified_diff(a.splitlines(),b.splitlines(),lineterm=''))})
r['inlineScriptAnalysis']=scripts
(root/'static-analysis-all-body.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(r['summary']);print('UNCLASSIFIED',[(k,v)for k,v in r['bodyPatterns'].items()if v['classification']=='UNCLASSIFIED'])
