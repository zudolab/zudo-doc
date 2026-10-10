import sys, re, collections, json, os
out, root = sys.argv[1], sys.argv[2]
lines = open(out, encoding='utf-8').read().split('\n')
sec=None; secs=collections.defaultdict(list)
for l in lines:
    m=re.match(r'^([a-z][a-z ]*):\s*(.*)$', l)
    if m and not l.startswith(' '):
        sec=m.group(1); 
        if m.group(2): secs[sec].append(m.group(2))
        continue
    if l.startswith('  - '): secs[sec].append(l[4:])
labelmap={'default/src:':'src/','default/pages:':'pages/','default/components:':'components/'}
def resolve(loc):
    for k,v in labelmap.items():
        if loc.startswith(k): return os.path.join(root, v+loc[len(k):])
    return None
cache={}
def tok_at(path, off):
    if path not in cache:
        try: cache[path]=open(path,'rb').read()
        except: cache[path]=b''
    b=cache[path]; e=off
    while e<len(b) and b[e:e+1] not in b' \t\n\r"\'`{}': e+=1
    return b[off:e].decode('utf-8','replace')
def lineof(path, off):
    b=cache.get(path) or open(path,'rb').read(); return b[:off].count(b'\n')+1
diags=[]
for d in secs['diagnostics']:
    m=re.match(r'(ZW\d+) (\w+) at (\S+?):(\d+): (.*)$', d)
    if not m: print('UNPARSED', d, file=sys.stderr); continue
    code,sev,f,off,msg=m.groups(); off=int(off); p=resolve(f)
    t=tok_at(p,off) if p else ''
    diags.append(dict(code=code,sev=sev,file=f.split(':',1)[1] if ':' in f else f,label=f.split(':')[0],off=off,line=lineof(p,off) if p else None,msg=msg,cand=t))
json.dump(dict(sections={k:len(v) for k,v in secs.items()}, diags=diags, raw=secs), open(out+'.json','w'), indent=1)
print('sections:', {k:len(v) for k,v in secs.items()})
c=collections.Counter((d['code'],d['sev']) for d in diags)
for k,v in sorted(c.items()): print(k,v)
