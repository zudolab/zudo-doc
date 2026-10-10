from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote
import json,collections
class P(HTMLParser):
 def __init__(self):super().__init__();self.ids=set();self.links=[];self.external=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id'in a:self.ids.add(a['id'])
  if t=='a':
   h=a.get('href','')
   if h.startswith('#') and len(h)>1:self.links.append(h)
   if a.get('target')=='_blank':self.external.append((h,a.get('rel','')))
roots=[Path('/workspace/zudo-v2-baseline/dist'),Path('/workspace/zudo-doc/dist')]
changed=[];bad=[];security=[]
for p in sorted(roots[0].rglob('*.html')):
 rel=p.relative_to(roots[0]);q=roots[1]/rel
 if not q.exists():continue
 pair=[]
 for f in [p,q]:
  x=P();x.feed(f.read_text());pair.append(x)
 a,b=pair
 oldbad=set(h for h in a.links if unquote(h[1:])not in a.ids);newbad=set(h for h in b.links if unquote(h[1:])not in b.ids)
 if oldbad!=newbad:bad.append({'file':str(rel),'before':sorted(oldbad),'after':sorted(newbad)})
 if a.ids!=b.ids:changed.append({'file':str(rel),'added':sorted(b.ids-a.ids),'removed':sorted(a.ids-b.ids)})
 regress=[(h,r)for h,r in b.external if ('noopener'not in r.split() or 'noreferrer'not in r.split()) and(h,r)not in a.external]
 if regress:security.append({'file':str(rel),'links':regress})
o={'localFragmentTargetChanges':bad,'idChanges':changed,'newExternalBlankWithoutNoopenerNoreferrer':security}
p=Path('_temp-resource/4430-zfb3-migration/parity/4.2.1/static-analysis-anchors.json');p.write_text(json.dumps(o,indent=2)+'\n');print({k:len(v)for k,v in o.items()});print(json.dumps(bad)[:6000])
