import json,collections,pathlib
r=json.load(open('/tmp/zudo421-parity/static.json'))
out={'head':'2926b1da','baseline':'337b9f110793dccb4759bddd5273eab38cd9d2f0','counts':r['counts'],'layers':dict(collections.Counter(d['layer'] for d in r['differences'])),'routes':{},'islands':{},'css':{},'classTokens':{}}
props=collections.Counter(); paths=[]; identities=[]
for d in r['differences']:
 l=d['layer']
 if l=='routes':out['routeChanges']={'added':sorted(set(d['actual'])-set(d['expected'])),'removed':sorted(set(d['expected'])-set(d['actual']))}
 elif l=='islands':
  a,b=d['expected'],d['actual']; changes=[]
  if [(x['name'],x['skipSsr']) for x in a]!=[(x['name'],x['skipSsr']) for x in b]:identities.append(d['route'])
  for x,y in zip(a,b):
   if x['path']!=y['path']:paths.append({'route':d['route'],'name':x['name'],'before':x['path'],'after':y['path']})
   if x['props']!=y['props']:
    if x['props'] is None and y['props']=={}:key=x['name']+':null→{}';props[key]+=1;changes.append(key)
    else:
     xp=x['props'] or {};yp=y['props'] or {}
     for k in xp.keys()|yp.keys():
      if xp.get(k)!=yp.get(k):key=x['name']+'.'+k;props[key]+=1;changes.append(key)
  out['routes'][d['route']]={'islandCountBefore':len(a),'islandCountAfter':len(b),'changedProps':changes}
 elif l.startswith('css.'):out['css'][l]={'added':d['added'],'removed':d['removed']}
 elif l=='classes':
  ac=collections.Counter(c for e in d['added'] for c in e['classes']);bc=collections.Counter(c for e in d['removed'] for c in e['classes'])
  for key,c in [('added',ac-bc),('removed',bc-ac)]:
   dest=out['classTokens'].setdefault(key,{})
   for token,n in c.items():dest[token]=dest.get(token,0)+n
out['islands']={'identityChangedRoutes':identities,'pathChanges':paths,'propChanges':dict(props)}
path=pathlib.Path('_temp-resource/4430-zfb3-migration/parity/4.2.1');path.mkdir(parents=True,exist_ok=True)
(path/'static-analysis.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k not in ['routes','css','classTokens']},indent=2));print('CSS',[(k,len(v['added']),len(v['removed'])) for k,v in out['css'].items()]);print('tokens',out['classTokens'])
