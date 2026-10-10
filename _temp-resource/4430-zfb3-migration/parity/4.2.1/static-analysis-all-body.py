from html.parser import HTMLParser
from pathlib import Path
import json,difflib,collections,hashlib
class P(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.inbody=False;self.raw=None;self.rawparts=[];self.scripts=[];self.styles=[];self.events=[];self.comments=[];self.elements=[]
 def handle_starttag(self,t,a):
  if t=='body':self.inbody=True
  if not self.inbody:return
  if t in ['script','style']:
   self.raw=t;self.rawparts=[];self.elements.append((t,dict(a)));return
  self.events.append(('start',t));self.elements.append((t,dict(a)))
 def handle_endtag(self,t):
  if self.raw==t:
   (self.scripts if t=='script'else self.styles).append(''.join(self.rawparts));self.raw=None;return
  if not self.inbody:return
  self.events.append(('end',t))
  if t=='body':self.inbody=False
 def handle_data(self,t):
  if self.raw:self.rawparts.append(t)
  elif self.inbody:self.events.append(('text',t))
 def handle_entityref(self,t):
  if self.inbody:self.events.append(('entity',t))
 def handle_charref(self,t):
  if self.inbody:self.events.append(('charref',t))
 def handle_comment(self,t):
  if self.inbody:self.comments.append(t)
output=Path('/tmp/zudo421-parity');output.mkdir(parents=True,exist_ok=True)
roots=[Path('/workspace/zudo-v2-baseline/dist'),Path('/workspace/zudo-doc/dist')];rows=[];rawrows=[];sc=collections.Counter();patterns={};script_pairs={}
for f in sorted(roots[0].rglob('*.html')):
 rel=str(f.relative_to(roots[0]));g=roots[1]/rel
 if not g.exists():continue
 a,b=P(),P();a.feed(f.read_text());b.feed(g.read_text())
 spans=[]
 if a.events!=b.events:
  for op,i,j,k,l in difflib.SequenceMatcher(a=a.events,b=b.events,autojunk=False).get_opcodes():
   if op=='equal':continue
   old,new=a.events[i:j],b.events[k:l];spans.append({'op':op,'before':old,'after':new})
 signatures=[]
 for s in spans:
  signature=json.dumps(s,ensure_ascii=False);key=hashlib.sha256(signature.encode()).hexdigest()[:16]
  if key not in patterns:patterns[key]={'routes':[],'change':s}
  patterns[key]['routes'].append(rel);signatures.append(key)
 row={'file':rel,'bodyEventCountBefore':len(a.events),'bodyEventCountAfter':len(b.events),'bodyEventSequenceEqual':a.events==b.events,'bodyChangePatterns':signatures,'scriptsEqual':a.scripts==b.scripts,'scriptCounts':[len(a.scripts),len(b.scripts)],'stylesEqual':a.styles==b.styles,'styleCounts':[len(a.styles),len(b.styles)],'commentCounts':[len(a.comments),len(b.comments)]}
 if a.scripts!=b.scripts:
  for i in range(max(len(a.scripts),len(b.scripts))):
   x=a.scripts[i]if i<len(a.scripts)else'';y=b.scripts[i]if i<len(b.scripts)else''
   if x!=y:
    sig=hashlib.sha256((x+'\0'+y).encode()).hexdigest()[:16];sc[sig]+=1
    if i in script_pairs:
     assert script_pairs[i]==(x,y),f'Additional script pattern at index {i}: {rel}; classify separately'
    else:
     script_pairs[i]=(x,y)
     (output/f'body-script-{i}-v2.js').write_text(x)
     (output/f'body-script-{i}-current.js').write_text(y)
 row['attributeElementCounts']=[len(a.elements),len(b.elements)]
 rows.append(row)
 if len(rows)%100==0:print('parsed',len(rows),flush=True)
raw={'routes':rows,'bodyPatterns':patterns,'scriptChangePatterns':dict(sc)}
Path('/tmp/zudo421-parity/all-body-raw.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2)+'\n')
print('SUMMARY',len(rows),'bodydifferent',sum(not r['bodyEventSequenceEqual']for r in rows),'patterns',len(patterns),'scriptroutes',sum(not r['scriptsEqual']for r in rows),'scriptpatterns',len(sc),'styleroutes',sum(not r['stylesEqual']for r in rows),flush=True)
