# Extract class-list-like tokens from string/template literals in TSX/TS sources and explain each distinct one.
import os, re, sys, subprocess, collections, json
root, zfb, out = sys.argv[1], sys.argv[2], sys.argv[3]
lit = re.compile(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'|`((?:[^`\\]|\\.)*)`', re.S)
shape = re.compile(r'^!?-?[a-z0-9\[@][a-zA-Z0-9\-\[\]:/.%(),_&>=#*+!\'"]*$')
occ = collections.Counter(); files = collections.defaultdict(set)
for d in ['src','pages','components']:
    for dp,_,fs in os.walk(os.path.join(root,d)):
        for f in fs:
            if not f.endswith(('.tsx','.ts')): continue
            p=os.path.join(dp,f); rel=os.path.relpath(p,root)
            s=open(p,encoding='utf-8',errors='replace').read()
            for m in lit.finditer(s):
                body = next(g for g in m.groups() if g is not None)
                body = re.sub(r'\$\{[^}]*\}', ' ', body)
                toks = body.split()
                if not toks: continue
                # heuristic: literal must look like a class list: every token class-shaped
                if not all(shape.match(t) for t in toks): continue
                for t in toks:
                    occ[t]+=1; files[t].add(rel)
res={}
for t in sorted(occ):
    r=subprocess.run([zfb,'wind','explain','--',t],cwd=root,capture_output=True,text=True)
    o=re.search(r'^outcome: (.*)$',r.stdout,re.M); dg=re.search(r'^diagnostic: (ZW\d+) \w+ at [^:]+://[^:]+:\d+: (.*)$',r.stdout,re.M)
    res[t]=dict(outcome=o.group(1) if o else 'ERR:'+r.stderr[:80], code=dg.group(1) if dg else None, msg=dg.group(2) if dg else None, occ=occ[t], files=sorted(files[t]))
json.dump(res,open(out,'w'),indent=1)
