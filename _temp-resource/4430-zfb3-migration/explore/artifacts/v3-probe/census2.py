import os, re, sys, collections, json
root, resf = sys.argv[1], sys.argv[2]
res=json.load(open(resf))
lit = re.compile(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'|`((?:[^`\\]|\\.)*)`', re.S)
shape = re.compile(r'^!?-?[a-z0-9\[@][a-zA-Z0-9\-\[\]:/.%(),_&>=#*+!\'"]*$')
occ=collections.Counter(); files=collections.defaultdict(set); nlit=0; litfiles=set()
for d in ['src','pages','components']:
    for dp,_,fs in os.walk(os.path.join(root,d)):
        for f in fs:
            if not f.endswith(('.tsx','.ts')): continue
            p=os.path.join(dp,f); rel=os.path.relpath(p,root)
            s=open(p,encoding='utf-8',errors='replace').read()
            for m in lit.finditer(s):
                body=next(g for g in m.groups() if g is not None)
                body=re.sub(r'\$\{[^}]*\}',' ',body); toks=body.split()
                if not toks or not all(shape.match(t) for t in toks): continue
                if not any(res.get(t,{}).get('outcome')=='resolved utility' for t in toks): continue
                # skip literals that are a single token unless it has a dash/colon (reduce 'hidden','block' noise? keep)
                nlit+=1; litfiles.add(rel)
                for t in toks: occ[t]+=1; files[t].add(rel)
sub={t:dict(res[t],occ=occ[t],files=sorted(files[t])) for t in occ}
json.dump(sub,open(resf.replace('.json','-classlits.json'),'w'),indent=1)
print('utility-bearing literals',nlit,'files',len(litfiles))
print('distinct tokens',len(sub),'occurrences',sum(occ.values()))
c=collections.Counter(v['outcome'] for v in sub.values())
for k in c: print(' ',k,'distinct',c[k],'occ',sum(v['occ'] for v in sub.values() if v['outcome']==k))
print('invalid by code/msg (distinct, occ):')
g=collections.defaultdict(list)
for t,v in sub.items():
    if v['code']: g[(v['code'],v['msg'])].append(t)
for k,ts in sorted(g.items(),key=lambda kv:-len(kv[1])):
    print(' ',k,len(ts),sum(sub[t]['occ'] for t in ts),'e.g.',ts[:12])
