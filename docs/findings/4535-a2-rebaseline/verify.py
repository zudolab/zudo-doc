#!/usr/bin/env python3
"""Offline forensic comparison; never modifies A2 references or normalizes gate values away.

Reconstruct accepted #4537 control from digest-verified original capture and the
accepted source projection, require current-main fingerprints, then reverse only
native identity and independently source-backed cache-buster values in candidate
copies. Uses the actual repository JS normalizer. A local capture is not hosted CI.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

OLD_MAIN = '694ccdd33d630c25dbc4230f11c50ecc02384122'
MAIN = '1640ec683808119293fb05a2c2bb241446b9dbff'
FEATURE = '69a4c8d6352ed8ce6a608d8d22ee4e282757fc7c'
ARCHIVES = {
    'accepted-main-a2-diagnostics.zip': '857f47c4016b2b4b922034f1264a9ea1946b75822f8cb726c8d9a6315f52aa9a',
    'pr4535-a2-diagnostics.zip': '42369a85fb38c7c4be438b737ba3cf41c6023728db1089dcfa944927bd84d2dd',
}
COMPONENTS = {
    '404.html': ['SidebarToggle'],
    'docs/getting-started/index.html': ['SidebarToggle', 'SidebarTree'],
    'docs/getting-started/coverage/index.html': ['SidebarToggle', 'SidebarTree', 'MobileToc', 'Toc'],
}
PACKS = re.compile(r'var packs=(\{[^\r\n]*\});')
BUILD = re.compile(r'data-zfb-build=([a-f0-9]{16})(?=[\s>])')
SIDEBAR = re.compile(r"data-props='([^']*)'([^>]*data-zfb-island=SidebarTree\b)")

def require(ok, message):
    if not ok:
        raise ValueError(message)

def digest(data):
    return hashlib.sha256(data.encode() if isinstance(data, str) else data).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--archives', type=Path, required=True)
    parser.add_argument('--capture', type=Path, required=True)
    parser.add_argument('--source', required=True, help='Independently recorded expected actual checkout SHA')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    def git(*params):
        return subprocess.check_output(['git', '-C', str(args.repo), *params], text=True).strip()
    def show(ref, path):
        return subprocess.check_output(['git', '-C', str(args.repo), 'show', ref + ':' + path], text=True)
    def metadata(ref):
        paths = git('ls-tree', '-r', '--name-only', ref, 'packages/zudo-doc/src/theme-packs').splitlines()
        entries = [json.loads(show(ref, p)) for p in paths if p.endswith('/meta.json')]
        return {p['slug']: p['version'] for p in entries}
    def normalize(raw):
        code = "import {normalizeHtml} from './scripts/parity-html-normalize.mjs';let s='';for await (const c of process.stdin)s+=c;process.stdout.write(normalizeHtml(s));"
        return subprocess.check_output(['node', '--input-type=module', '-e', code], input=raw, text=True, cwd=args.repo)
    def pack_map(html, expected, label):
        matches = PACKS.findall(html)
        require(len(matches) == 1, label + ': expected one pack map')
        require(json.loads(matches[0]) == expected, label + ': map differs from independent git metadata')
        return matches[0]
    def tokens(html, route):
        tags = re.findall(r'<[^>]*\bdata-zfb-island=[^>]+>', html)
        actual_components = [re.search(r'\bdata-zfb-island=([^\s>]+)', t)[1] for t in tags]
        require(actual_components == COMPONENTS[route], route + ': island order/placement changed')
        per_tag = [BUILD.findall(t) for t in tags]
        require(all(len(t) == 1 for t in per_tag), route + ': absent/malformed/duplicate native identity')
        values = BUILD.findall(html)
        require(html.count('data-zfb-build') == len(values) == len(tags), route + ': extra/malformed identity')
        require(len(set(values)) == 1, route + ': inconsistent identities')
        return values[0], len(values)

    refs = json.loads(show(MAIN, 'scripts/__tests__/fixtures/a2-route-reference.json'))
    old_refs = json.loads(show(OLD_MAIN, 'scripts/__tests__/fixtures/a2-route-reference.json'))
    for path in ['scripts/parity-html-normalize.mjs', 'pnpm-lock.yaml', 'package.json',
                 'packages/zudo-doc/src/__tests__/route-injection-build.slow.test.ts']:
        require(show(OLD_MAIN, path) == show(MAIN, path) == show(args.source, path), 'Changed build contract requires new investigation: ' + path)
    old_meta, main_meta, feature_meta, new_meta = [metadata(ref) for ref in [OLD_MAIN, MAIN, FEATURE, args.source]]
    require(old_meta == main_meta, 'Accepted sidebar source changed pack metadata')
    require(new_meta == feature_meta, 'Integrated pack versions differ from reviewed feature')
    require(set(old_meta) == set(new_meta) and len(new_meta) == 31, 'Pack set changed')
    changes = {k: {'old': old_meta[k], 'new': new_meta[k]} for k in old_meta if old_meta[k] != new_meta[k]}
    require(len(changes) == 24, 'Expected 24 source-backed increments')
    changed_paths = git('diff', '--name-only', MAIN, args.source).splitlines()
    for slug, pair in changes.items():
        path = 'packages/zudo-doc/src/theme-packs/' + slug + '/'
        require(path + 'meta.json' in changed_paths and path + 'pack.css' in changed_paths, 'Missing CSS+metadata change: ' + slug)
        before, after = [json.loads(show(ref, path + 'meta.json')) for ref in [MAIN, args.source]]
        after['version'] = before['version']
        require(before == after, 'Unexpected non-version metadata change: ' + slug)
        old = [int(v) for v in pair['old'].split('.')]
        require([int(v) for v in pair['new'].split('.')] == old[:2] + [old[2] + 1], 'Not a patch increment: ' + slug)
    projection_path = 'packages/zudo-doc/src/sidebar/client-data.ts'
    projection = show(MAIN, projection_path)
    require(projection == show(args.source, projection_path), 'Integrated sidebar projection changed')
    policy = re.search(r'const nodeFields = \{(.*?)\} as const', projection, re.S)
    require(policy is not None, 'Missing source field policy')
    fields = re.findall(r'(\w+): (true|false)', policy[1])
    require([k for k, enabled in fields if enabled == 'false'] == ['description'], 'Unexpected discarded source fields')
    def project(node):
        result = {key: node[key] for key, enabled in fields if enabled == 'true' and key != 'children' and key in node}
        result['children'] = [project(child) for child in node['children']]
        return result
    def project_sidebar(match):
        props = json.loads(match[1])
        props['nodes'] = [project(node) for node in props['nodes']]
        nav = props['navigation']
        props['navigation'] = {'id': nav['id'], 'roots': [project(n) for n in nav['roots']], 'parents': nav['parents'],
                               **{k: nav[k] for k in ['initialExpansion', 'localParentId'] if k in nav}}
        return "data-props='" + json.dumps(props, ensure_ascii=False, separators=(',', ':')) + "'" + match[2]

    archives = {}
    for name, expected in ARCHIVES.items():
        data = (args.archives / name).read_bytes()
        require(digest(data) == expected, 'Archive digest mismatch: ' + name)
        with zipfile.ZipFile(args.archives / name) as archive:
            archives[name] = {p: archive.read(p).decode('utf8') for p in archive.namelist()}
    baseline = archives['accepted-main-a2-diagnostics.zip']
    require(json.loads(baseline['manifest.json'])['sourceHead'] == '17418db87c5aa95cedca4f2e41d242f43ea055db', 'Unexpected historical accepted checkout')
    for name, content in archives.items():
        manifest = json.loads(content['manifest.json'])
        for row in manifest['pages']:
            stem = row['page'].replace('/', '--')
            normalized = normalize(content[stem])
            require(normalized == content[stem + '.normalized.html'], 'Archive normalizer mismatch: ' + name + '/' + stem)
            require(digest(normalized) == row['sha256Html'] and len(content[stem].encode()) == row['bytes'], 'Archive manifest mismatch')

    captured = json.loads((args.capture / 'manifest.json').read_text())
    require(captured['sourceHead'] == args.source, 'Fresh capture checkout does not equal independently specified source')
    require({r['page'] for r in captured['pages']} == set(refs) and len(captured['pages']) == 3, 'Unexpected capture route set')
    sidebar_evidence = json.loads(show(MAIN, 'docs/findings/4536-sidebar-a2/a2-comparison.json'))
    rows = []
    for route in refs:
        stem = route.replace('/', '--')
        old = baseline[stem + '.normalized.html']
        require(digest(old) == old_refs[route], 'Historical reference mismatch')
        evidence = next(row for row in sidebar_evidence if row['page'] == route)
        control, projected_count = SIDEBAR.subn(project_sidebar, old)
        require(projected_count == (0 if route == '404.html' else 1), 'Unexpected sidebar projection count')
        old_token, _ = tokens(old, route)
        control = control.replace('data-zfb-build=' + old_token, 'data-zfb-build=' + evidence['nativeBuildAfter'])
        require(digest(control) == refs[route] == evidence['candidateHostedFingerprint'], 'Reconstructed main does not match accepted hash')
        raw = (args.capture / stem).read_text()
        new = normalize(raw)
        require(new == (args.capture / (stem + '.normalized.html')).read_text(), 'Fresh capture normalizer mismatch')
        recorded = next(r for r in captured['pages'] if r['page'] == route)
        require(digest(new) == recorded['sha256Html'] and len(raw.encode()) == recorded['bytes'], 'Fresh capture manifest mismatch')
        old_map, new_map = pack_map(control, main_meta, 'accepted'), pack_map(new, new_meta, 'integrated')
        old_token, old_count = tokens(control, route)
        new_token, new_count = tokens(new, route)
        require(old_count == new_count, 'Identity multiplicity changed')
        token_only = new.replace('data-zfb-build=' + new_token, 'data-zfb-build=' + old_token)
        packs_only = new.replace('var packs=' + new_map + ';', 'var packs=' + old_map + ';', 1)
        reversed_html = token_only.replace('var packs=' + new_map + ';', 'var packs=' + old_map + ';', 1)
        require(reversed_html == control, 'UNEXPLAINED NORMALIZED BYTES: ' + route)
        rows.append({'route': route, 'accepted_sha256': refs[route], 'candidate_sha256': digest(new),
                     'accepted_normalized_bytes': len(control.encode()), 'candidate_normalized_bytes': len(new.encode()),
                     'accepted_build': old_token, 'candidate_build': new_token, 'build_occurrences': new_count,
                     'pack_entries': len(new_meta), 'pack_changes': changes,
                     'token_only_restores': token_only == control, 'packs_only_restores': packs_only == control,
                     'both_restore_every_byte': True, 'reverse_sha256': digest(reversed_html)})
        print('PASS', route, new_count, 'native identities;', len(changes), 'source-backed versions; every other byte identical')
    report = {'scope': 'Offline forensic comparison only; capture origin/hosted CI execution verified separately by manager',
              'accepted_main': MAIN, 'accepted_tree': git('rev-parse', MAIN + '^{tree}'),
              'capture_source': args.source, 'capture_tree': git('rev-parse', args.source + '^{tree}'),
              'source_parents': git('show', '-s', '--format=%P', args.source).split(),
              'original_archives_sha256': ARCHIVES,
              'normalizer_sha256': digest((args.repo / 'scripts/parity-html-normalize.mjs').read_bytes()),
              'projection_source_sha256': digest(projection), 'pages': rows}
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print('Report:', args.output)

if __name__ == '__main__':
    main()
