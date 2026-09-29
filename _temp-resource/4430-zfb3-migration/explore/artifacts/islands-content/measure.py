import re, sys, os
ROOT='$HOME/repos/myoss/zudo-doc/'
P='packages/zudo-doc/src/'
FILES=[
 P+'html-preview-wrapper/html-preview-wrapper.tsx', P+'html-preview-wrapper/html-preview.tsx',
 P+'html-preview-wrapper/preview-base.tsx', P+'html-preview-wrapper/highlighted-code.tsx',
 P+'html-preview-wrapper/highlight-runtime.ts', P+'html-preview-wrapper/preview-auto-height.ts',
 P+'image-enlarge/index.tsx', P+'mermaid-enlarge/index.tsx', P+'doc-history/index.tsx',
 P+'ai-chat-modal/index.tsx', P+'design-token-panel-bootstrap.tsx', P+'routes/_design-token-panel-bootstrap.tsx',
 P+'use-modal-dialog/index.ts', 'src/components/preset-generator.tsx',
 P+'doc-history-area/index.tsx', P+'doc-body-end-islands/index.tsx', P+'doc-body-end-islands/design-token-panel-island.tsx',
 P+'doc-body-end/index.tsx', P+'body-foot-util/body-foot-util-area.tsx', P+'body-foot-util/edit-link.tsx',
 P+'search-widget/index.tsx', P+'code-group/index.tsx', P+'tab-item/tab-item.tsx', P+'code-syntax/tabs.tsx',
 P+'details/details.tsx', P+'math-block/index.tsx', P+'note-tray-index/index.tsx',
 P+'design-token-panel-config/index.ts', P+'design-token-panel-config/manifest.ts',
 'pages/lib/_search-widget.tsx','pages/lib/_preset-generator.tsx','pages/lib/_details.tsx','pages/lib/_body-end-islands.tsx',
 'src/chrome-bindings.tsx','src/lib/preset-generator-logic.ts',
]
def strip_comments(s):
    s=re.sub(r'/\*.*?\*/', lambda m: '\n'*m.group(0).count('\n'), s, flags=re.S)
    s=re.sub(r'(?m)(^|[^:"\'`])//[^\n]*', r'\1', s)
    return s
def match_paren(s,i):
    depth=0
    for j in range(i,len(s)):
        c=s[j]
        if c in '([{': depth+=1
        elif c in ')]}':
            depth-=1
            if depth==0: return j
    return -1
def effects(s):
    out=[]
    for m in re.finditer(r'\buse(Layout)?Effect\(', s):
        start=m.end()-1; end=match_paren(s,start)
        body=s[start+1:end]
        # deps = last top-level arg
        depth=0; last=None
        for k,c in enumerate(body):
            if c in '([{': depth+=1
            elif c in ')]}': depth-=1
            elif c==',' and depth==0: last=k
        deps = body[last+1:].strip() if last is not None else None
        if deps=='' : deps=None
        kind = 'every-render' if deps is None else ('mount-only' if re.fullmatch(r'\[\s*\]',deps) else 'rerun')
        cleanup = bool(re.search(r'return\s*(\(\)\s*=>|\(\s*\)\s*=>|function|\(\)|[A-Za-z_]+\s*;|startHighlightRequest)', body)) or 'return () =>' in body
        line=s[:m.start()].count('\n')+1
        out.append((line,kind,deps if deps else '-',cleanup))
    return out
rows=[]
for f in FILES:
    raw=open(ROOT+f).read(); s=strip_comments(raw)
    c=lambda pat: len(re.findall(pat,s))
    d=dict(file=f, lines=raw.count('\n')+1,
      useState=c(r'\buseState\b\s*[<(]'), useEffect=c(r'\buseEffect\b\s*[<(]'), useLayoutEffect=c(r'\buseLayoutEffect\b\s*[<(]'),
      useRef=c(r'\buseRef\b\s*[<(]'), useMemo=c(r'\buseMemo\b\s*[<(]'), useCallback=c(r'\buseCallback\b\s*[<(]'), memo=c(r'\bmemo\b\s*[<(]'),
      customHooks=c(r'\buse(ModalDialog|HydrationPending)\('),
      className=c(r'\bclassName='), class_=c(r'\bclass='), dSIH=c(r'dangerouslySetInnerHTML'),
      reactEvents=c(r'\bon[A-Z][A-Za-z]*='), camelSvg=c(r'\b(strokeWidth|strokeLinecap|strokeLinejoin|fillRule|clipRule|stopColor|tabIndex|srcSet|srcDoc|htmlFor|readOnly|autoFocus|maxLength)='),
      focusable=c(r'\bfocusable='), xmlns=c(r'\bxmlns='), key=c(r'\bkey=\{'), map_=c(r'\.map\('),
      ref=c(r'\bref=\{'), dynImport=c(r'\bimport\('), fetch_=c(r'\bfetch\('), addEL=c(r'addEventListener\('),
      observers=c(r'new\s+\w*(IntersectionObserver|ResizeObserver|MutationObserver|Observer)\('),
      iframe=c(r'<iframe'), displayName=c(r'\.displayName\s*='), islandCall=c(r'\bIsland\('),
      styleObj=c(r'style=\{\{'), styleCamel=len(re.findall(r'style=\{\{[^}]*\b[a-z]+[A-Z]\w*\s*:',s,re.S)),
      innerHTML=c(r'\.innerHTML\s*='), inputs=c(r'<input\b'), selects=c(r'<select\b'), textareas=c(r'<textarea\b'),
      toChildArray=c(r'toChildArray\('), cloneElement=c(r'cloneElement\('),
    )
    d['effects']=effects(s)
    rows.append(d)
import json
keys=['lines','useState','useEffect','useLayoutEffect','useRef','useMemo','useCallback','memo','customHooks','className','class_','dSIH','reactEvents','camelSvg','focusable','xmlns','key','map_','ref','dynImport','fetch_','addEL','observers','iframe','displayName','islandCall','styleObj','innerHTML','inputs','selects','textareas','toChildArray','cloneElement']
print('file|'+'|'.join(keys))
tot={k:0 for k in keys}
for d in rows:
    print(d['file']+'|'+'|'.join(str(d[k]) for k in keys))
    for k in keys: tot[k]+=d[k]
print('TOTAL|'+'|'.join(str(tot[k]) for k in keys))
print()
for d in rows:
    for e in d['effects']:
        print('EFFECT',d['file'],'L%d'%e[0],e[1],'deps=%s'%re.sub(r'\s+',' ',e[2]),'cleanup=%s'%e[3])
