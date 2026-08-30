#!/usr/bin/env python3
"""Prototype builder for the assets-index UI (zudolab/zudo-doc#3775).

Regenerates the committed prototype pages by wrapping each candidate index UI in the
REAL built asset-page shell taken from `dist/`. Requires a prior `pnpm build` of the
showcase (it reads dist/files/demo/parse-frontmatter.js/index.html and dist/docs/...).
The committed a-tree*.html were produced this way and then had the islands <script>
stripped, so they open directly from disk.

Variant A (the tree) is the approved design; B and C are kept for reference only and
are not regenerated into the repo."""
import os, re, struct, html as H
# Repo root: default to four levels up from this file (_temp-resource/<n>-<slug>/build.py),
# override with ZUDO_DOC_ROOT when running the script from elsewhere.
ROOT = os.environ.get("ZUDO_DOC_ROOT") or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.dirname(os.path.abspath(__file__))
shell = open(f"{ROOT}/dist/files/demo/parse-frontmatter.js/index.html", encoding="utf-8").read()
docs = open(f"{ROOT}/dist/docs/guides/asset-viewer/index.html", encoding="utf-8").read()
css = open(f"{OUT}/styles.css", encoding="utf-8").read()

# --- active nav link classes (copied from a docs page's aria-current item) ---
m = re.search(r'<a class="([^"]*)"[^>]*href=/docs/guides/>Learn', docs)
learn_cls = m.group(1) if m else ''
print("LEARN (active) CLASS on docs page:", learn_cls)
m2 = re.search(r'<a class="([^"]*)"[^>]*href=/docs/reference/>Reference', docs)
print("REFERENCE (inactive) CLASS:", m2.group(1) if m2 else '')
ACTIVE_CLASS = "px-hsp-md py-vsp-2xs text-small font-medium transition-colors shrink-0 " + " ".join(c for c in learn_cls.split() if c not in ("flex","items-center","gap-x-hsp-xs","px-hsp-md","py-vsp-2xs","text-small","font-medium","transition-colors"))
print("ACTIVE_CLASS used:", ACTIVE_CLASS)

# --- real demo corpus ---
def png_dims(p):
    with open(p, 'rb') as f:
        f.seek(16); w, h = struct.unpack('>II', f.read(8)); return w, h
demo = f"{ROOT}/public/assets/demo"
def sz(p): return os.path.getsize(p)
real = [
  dict(path="demo/architecture.png", kind="image", label="PNG", bytes=sz(f"{demo}/architecture.png"), dims=png_dims(f"{demo}/architecture.png"), title="Asset viewer architecture", desc="How document references become raw-file and viewer-page links.", updated="2026-08-30"),
  dict(path="demo/demo-project.zip", kind="other", label="ZIP", bytes=sz(f"{demo}/demo-project.zip"), updated="2026-08-30"),
  dict(path="demo/hmr-demo.mp4", kind="video", label="MP4", bytes=sz(f"{demo}/hmr-demo.mp4"), dur="0:42", updated="2026-08-30"),
  dict(path="demo/parse-frontmatter.js", kind="code", label="JavaScript", bytes=sz(f"{demo}/parse-frontmatter.js"), lines=sum(1 for _ in open(f"{demo}/parse-frontmatter.js")), updated="2026-08-31"),
  dict(path="demo/spec.pdf", kind="pdf", label="PDF", bytes=sz(f"{demo}/spec.pdf"), updated="2026-08-30"),
]
fake = [
  dict(path="diagrams/build-flow.png", kind="image", label="PNG", bytes=143_212, dims=(1400, 820), updated="2026-08-12"),
  dict(path="diagrams/route-injection.png", kind="image", label="PNG", bytes=98_004, dims=(1200, 700), title="Route injection seam", updated="2026-08-12"),
  dict(path="recordings/sidebar-resize.mp4", kind="video", label="MP4", bytes=2_811_000, dur="0:18", updated="2026-07-30"),
  dict(path="scripts/check-links.mjs", kind="code", label="JavaScript", bytes=4_120, lines=131, updated="2026-08-20"),
  dict(path="scripts/setup/install-hooks.sh", kind="code", label="Shell", bytes=1_020, lines=38, updated="2026-08-02"),
  dict(path="scripts/setup/README.txt", kind="text", label="Text", bytes=612, lines=21, updated="2026-08-02"),
  dict(path="specs/v1/api.pdf", kind="pdf", label="PDF", bytes=388_120, updated="2026-05-11"),
  dict(path="specs/v2/api.pdf", kind="pdf", label="PDF", bytes=402_776, updated="2026-08-15"),
  dict(path="specs/v2/changes.md", kind="text", label="Markdown", bytes=2_230, lines=64, desc="What changed between v1 and v2 of the spec.", updated="2026-08-15"),
]
for e in fake: e["fake"] = True
entries = sorted(real + fake, key=lambda e: e["path"])

def fmt_bytes(n):
    if n < 1024: return f"{n} B"
    if n < 1024**2: return f"{n/1024:.1f} KB".replace(".0 KB", " KB")
    return f"{n/1024**2:.1f} MB"
def facet(e):
    if "lines" in e: return f"{e['lines']} lines"
    if "dur" in e: return e["dur"]
    if "dims" in e: return f"{e['dims'][0]} × {e['dims'][1]}"
    return None
def name(e): return e["path"].rsplit("/", 1)[-1]
def viewer(e): return f"/files/{e['path']}/"

# --- icons (24x24 stroke, matches header chevron style) ---
P = {
 "folder": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 "folder-open": '<path d="M3 18V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1"/><path d="M3 18l2.4-6.4A1 1 0 0 1 6.3 11H22l-2.4 6.4a1 1 0 0 1-.9.6H3z"/>',
 "file": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
 "code": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="m10 13-2 2 2 2"/><path d="m14 13 2 2-2 2"/>',
 "text": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
 "image": '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-5-5L6 21"/>',
 "video": '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
 "pdf": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 17v-5h1.75a1.5 1.5 0 0 1 0 3H8.5"/><path d="M13 12v5h1.2a2.5 2.5 0 0 0 0-5z"/>',
 "archive": '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
 "chevron": '<path d="M9 5l7 7-7 7"/>',
}
def icon(k, cls="h-icon-xs w-icon-xs shrink-0"):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{P[k]}</svg>'
def file_icon_key(e):
    if e["kind"] == "other" and name(e).rsplit(".",1)[-1] in ("zip","tar","gz","tgz","7z","rar"): return "archive"
    return {"code":"code","text":"text","image":"image","video":"video","pdf":"pdf"}.get(e["kind"], "file")

# --- tree model ---
def build_tree(entries):
    root = {"dirs": {}, "files": []}
    for e in entries:
        parts = e["path"].split("/"); node = root
        for d in parts[:-1]: node = node["dirs"].setdefault(d, {"dirs": {}, "files": []})
        node["files"].append(e)
    return root
def count(node):
    n = len(node["files"]); b = sum(e["bytes"] for e in node["files"])
    for c in node["dirs"].values():
        cn, cb = count(c); n += cn; b += cb
    return n, b
tree = build_tree(entries)
total_n, total_b = count(tree)
def n_dirs(node): return sum(1 + n_dirs(c) for c in node["dirs"].values())
total_d = n_dirs(tree)

STYLE = """
<style>
.zd-asset-index { --idx-line: color-mix(in srgb, currentColor 18%, transparent); --idx-hover: color-mix(in srgb, currentColor 6%, transparent); }
.zd-asset-index a { text-decoration: none; }
.zd-asset-index a:hover .idx-name, .zd-asset-index a:focus-visible .idx-name { text-decoration: underline; }
.zd-asset-index [hidden] { display: none !important; }
.zd-asset-index { line-height: 1.45; }
.zd-asset-index li { margin: 0 !important; padding: 0 !important; }
.zd-asset-index ul { margin-top: 0 !important; margin-bottom: 0 !important; list-style: none !important; }
/* A: tree */
.idx-tree, .idx-tree ul { list-style: none; margin: 0; padding: 0; }
.idx-tree ul { margin-left: 0.75rem; padding-left: 0.85rem; border-left: 1px solid var(--idx-line); }
.idx-tree summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0.4rem; border-radius: 0.25rem; }
.idx-tree summary::-webkit-details-marker { display: none; }
.idx-tree summary:hover { background: var(--idx-hover); }
.idx-tree summary .idx-chev { transition: transform .15s ease; }
.idx-tree details[open] > summary .idx-chev { transform: rotate(90deg); }
.idx-tree details:not([open]) > summary .idx-ico-open { display: none; }
.idx-tree details[open] > summary .idx-ico-closed { display: none; }
.idx-row { display: flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0.4rem; border-radius: 0.25rem; min-width: 0; }
.idx-row:hover { background: var(--idx-hover); }
.idx-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.idx-meta { margin-left: auto; padding-left: 1rem; white-space: nowrap; }
@media (max-width: 40rem) { .idx-meta { display: none; } }
/* B: list */
.idx-group { border: 1px solid var(--idx-line); border-radius: 0.375rem; overflow: hidden; }
.idx-group + .idx-group { margin-top: 1rem; }
.idx-group-head { display: flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.75rem; background: var(--idx-hover); border-bottom: 1px solid var(--idx-line); }
.idx-group .idx-line { display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; align-items: center; gap: 0.6rem; padding: 0.45rem 0.75rem; border-top: 1px solid var(--idx-line); }
.idx-group .idx-line:first-of-type { border-top: 0; }
.idx-group .idx-line:hover { background: var(--idx-hover); }
.idx-line .idx-desc { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 40rem) { .idx-group .idx-line { grid-template-columns: auto minmax(0,1fr) auto; } .idx-line .idx-date { display: none; } }
/* C: compact mono */
.idx-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.idx-mono .idx-row { padding: 0.15rem 0.3rem; gap: 0.35rem; }
.idx-mono .idx-conn { color: var(--idx-line); color: color-mix(in srgb, currentColor 40%, transparent); white-space: pre; }
.idx-mono ul { margin: 0; padding: 0; list-style: none; }
</style>
"""

def page_header(title, sub):
    return f"""
<header>
  <div class="mb-vsp-xs flex flex-wrap items-center gap-hsp-xs text-micro tracking-wide uppercase">
    <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-fg">Assets</span>
    <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-muted">Index</span>
  </div>
  <h1 class="mb-vsp-xs border-b border-fg pb-vsp-xs font-mono text-heading font-bold leading-tight">{title}</h1>
  <div data-doc-metainfo class="mb-vsp-md flex flex-wrap items-center gap-x-hsp-md gap-y-vsp-2xs text-caption text-fg">
    <span>{total_n} files</span><span>{total_d} folders</span><span>{fmt_bytes(total_b)}</span>
  </div>
  <p class="mb-vsp-lg text-title text-muted">{sub}</p>
</header>"""

NOTE = '<p class="mt-vsp-lg text-caption text-muted">Prototype note: only <code>demo/</code> exists in the showcase today; the other folders are sample data so nesting can be judged.</p>'

# ---- Variant A ----
def render_tree_a(node, depth=0):
    out = ["<ul>" if depth else '<ul class="idx-tree" role="tree">']
    for d, child in sorted(node["dirs"].items()):
        n, b = count(child)
        out.append(f'<li><details open><summary class="text-small">{icon("chevron","idx-chev h-icon-xs w-icon-xs shrink-0 text-muted")}{icon("folder","idx-ico-closed h-icon-sm w-icon-sm shrink-0 text-muted")}{icon("folder-open","idx-ico-open h-icon-sm w-icon-sm shrink-0 text-muted")}<span class="font-mono text-fg">{d}/</span><span class="idx-meta text-caption text-muted">{n} files · {fmt_bytes(b)}</span></summary>')
        out.append(render_tree_a(child, depth + 1)); out.append("</details></li>")
    for e in node["files"]:
        meta = " · ".join(x for x in [e["label"], facet(e), fmt_bytes(e["bytes"])] if x)
        out.append(f'<li role="treeitem"><a class="idx-row text-small" href="{viewer(e)}">{icon("chevron","h-icon-xs w-icon-xs shrink-0 invisible")}{icon(file_icon_key(e),"h-icon-sm w-icon-sm shrink-0 text-muted")}<span class="idx-name font-mono text-fg">{name(e)}</span><span class="idx-meta text-caption text-muted">{meta}</span></a></li>')
    out.append("</ul>"); return "\n".join(out)
VARIANT_A = page_header("Assets", "Every file managed by the asset viewer. Open a file to see its viewer page, metadata, and the documents that reference it.") + f"""
<div class="zd-asset-index">
  <div class="mb-vsp-sm flex flex-wrap items-center justify-between gap-hsp-sm text-caption">
    <span class="font-mono text-muted">public/assets/</span>
    <span class="flex gap-hsp-sm"><button type="button" data-idx="expand" class="text-fg hover:text-accent hover:underline">Expand all</button><button type="button" data-idx="collapse" class="text-fg hover:text-accent hover:underline">Collapse all</button></span>
  </div>
  {render_tree_a(tree)}
  {NOTE}
</div>
<script>document.querySelectorAll('[data-idx]').forEach(b=>b.addEventListener('click',()=>{{const open=b.dataset.idx==='expand';document.querySelectorAll('.idx-tree details').forEach(d=>d.open=open);}}));</script>
"""

# ---- Variant B ----
def groups(node, prefix=""):
    if node["files"]: yield prefix, node["files"]
    for d, child in sorted(node["dirs"].items()): yield from groups(child, f"{prefix}{d}/")
rows_b = []
for prefix, files in groups(tree):
    n = len(files); b = sum(e["bytes"] for e in files)
    rows_b.append(f'<section class="idx-group"><div class="idx-group-head text-small">{icon("folder","h-icon-sm w-icon-sm shrink-0 text-muted")}<span class="font-mono text-fg">{prefix}</span><span class="idx-meta text-caption text-muted">{n} files · {fmt_bytes(b)}</span></div>')
    for e in files:
        desc = e.get("desc") or e.get("title") or ""
        rows_b.append(f'<a class="idx-line text-small" href="{viewer(e)}">{icon(file_icon_key(e),"h-icon-sm w-icon-sm shrink-0 text-muted")}<span class="min-w-0"><span class="idx-name font-mono text-fg">{name(e)}</span>{f"<span class=\"idx-desc text-caption text-muted\">{H.escape(desc)}</span>" if desc else ""}</span><span class="text-caption text-muted whitespace-nowrap">{" · ".join(x for x in [e["label"], facet(e), fmt_bytes(e["bytes"])] if x)}</span><span class="idx-date text-caption text-muted whitespace-nowrap">{e["updated"]}</span></a>')
    rows_b.append("</section>")
VARIANT_B = page_header("Files", "Every file managed by the asset viewer, grouped by folder.") + f'<div class="zd-asset-index">{"".join(rows_b)}{NOTE}</div>'

# ---- Variant C ----
def render_tree_c(node, prefix=""):
    out = ["<ul>"]
    items = [("d", d, c) for d, c in sorted(node["dirs"].items())] + [("f", None, e) for e in node["files"]]
    for i, (t, d, x) in enumerate(items):
        last = i == len(items) - 1
        conn = "└── " if last else "├── "
        nxt = prefix + ("    " if last else "│   ")
        if t == "d":
            n, b = count(x)
            out.append(f'<li><div class="idx-row text-small"><span class="idx-conn">{prefix}{conn}</span>{icon("folder","h-icon-xs w-icon-xs shrink-0 text-muted")}<span class="text-fg">{d}/</span><span class="idx-meta text-caption text-muted">{n} files</span></div>{render_tree_c(x, nxt)}</li>')
        else:
            e = x; meta = " · ".join(v for v in [e["label"], facet(e), fmt_bytes(e["bytes"])] if v)
            out.append(f'<li><a class="idx-row text-small" href="{viewer(e)}"><span class="idx-conn">{prefix}{conn}</span>{icon(file_icon_key(e),"h-icon-xs w-icon-xs shrink-0 text-muted")}<span class="idx-name text-fg">{name(e)}</span><span class="idx-meta text-caption text-muted">{meta}</span></a></li>')
    out.append("</ul>"); return "".join(out)
VARIANT_C = page_header("Files", "Every file managed by the asset viewer.") + f'<div class="zd-asset-index idx-mono"><div class="idx-row text-small">{icon("folder-open","h-icon-xs w-icon-xs shrink-0 text-muted")}<span class="text-fg">assets/</span><span class="idx-meta text-caption text-muted">{total_n} files · {fmt_bytes(total_b)}</span></div>{render_tree_c(tree)}{NOTE}</div>'

# ---- shell assembly ----
def wrap(title, body, filename):
    h = shell
    h = h.replace("/assets/styles-910ffd9d.css", "./styles.css")
    islands = open(f"{OUT}/islands.js", encoding="utf-8").read()
    h = re.sub(r'<script src=/assets/islands-[a-z0-9]+\.js type=module></script>', lambda m: "<script type=module>" + islands.replace("</script>", "<\\/script>") + "</script>", h, count=1)
    h = re.sub(r"<title>.*?</title>", f"<title>{title} — proto</title>", h, count=1, flags=re.S)
    # header nav: add Assets after Develop (active)
    h = h.replace("href=/docs/develop/>Develop</a>", f'href=/docs/develop/>Develop</a><a class="{ACTIVE_CLASS}" data-nav-item=true aria-current=page href=/files/>Assets</a>', 1)
    # breadcrumb: keep first li (Home), replace the rest
    def bc(m):
        nav = m.group(0)
        first = re.search(r"<li.*?</li>", nav, re.S).group(0)
        tail = f'<li class="flex items-center gap-x-hsp-xs">{icon("chevron","h-icon-xs w-icon-xs text-muted shrink-0")}<span class=text-fg>Assets</span></li>'
        return re.sub(r"(<ol[^>]*>).*?(</ol>)", lambda mm: mm.group(1) + first + tail + mm.group(2), nav, flags=re.S)
    h = re.sub(r"<nav[^>]*aria-label=Breadcrumb[^>]*>.*?</nav>", bc, h, count=1, flags=re.S)
    # main article
    start = h.index('<article class="zd-content max-w-none">'); end = h.index("</article>", start) + len("</article>")
    h = h[:start] + '<article class="zd-content max-w-none">' + STYLE + f'<div class="zd-asset-page" data-zd-asset-page=true>{body}</div></article>' + h[end:]
    open(f"{OUT}/{filename}", "w", encoding="utf-8").write(h)
    return filename

files = [wrap("A · Tree", VARIANT_A, "a-tree.html"), wrap("B · Grouped list", VARIANT_B, "b-list.html"), wrap("C · Compact mono tree", VARIANT_C, "c-compact.html")]
hub = f"""<!doctype html><meta charset=utf-8><title>assets-index prototypes</title>
<body style="font:15px/1.5 system-ui;max-width:48rem;margin:3rem auto;padding:0 1rem">
<h1>Assets index — UI prototypes</h1>
<p>Each page is the real built asset-page shell (header with a new <b>Assets</b> item marked active, breadcrumb, footer) with the index UI swapped in. Theme toggle in the header works.</p>
<ol>
<li><a href="a-tree.html">A · Tree</a> — collapsible folders (native &lt;details&gt;), file icons, meta on the right, expand/collapse all. <b>Recommended.</b></li>
<li><a href="b-list.html">B · Grouped list</a> — one bordered block per folder, GitHub-style rows with description + updated date.</li>
<li><a href="c-compact.html">C · Compact mono tree</a> — box-drawing connectors, monospace, densest.</li>
</ol>
<p style="color:#666">Only <code>demo/</code> exists in the showcase today; other folders are sample data.</p>
"""
open(f"{OUT}/index.html", "w", encoding="utf-8").write(hub)
a=open(f"{OUT}/a-tree.html", encoding="utf-8").read()
open(f"{OUT}/a-tree-dark.html", "w", encoding="utf-8").write(a.replace("applyTheme(getEffectiveMode(stored));", "applyTheme(\"dark\");", 1))

# --- sanity: report Tailwind classes used that the built CSS lacks ---
used = set()
for f in files:
    for m in re.finditer(r'class="([^"]*)"', open(f"{OUT}/{f}", encoding="utf-8").read()): used.update(m.group(1).split())
missing = sorted(c for c in used if not c.startswith("idx-") and not c.startswith("zd-") and ("." + c.replace(":", "\\:").replace("/", "\\/").replace("[", "\\[").replace("]", "\\]")) not in css)
print("MISSING CLASSES:", missing)
print("WROTE:", files, "index.html")
