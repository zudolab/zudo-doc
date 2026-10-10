#!/usr/bin/env bash
set -euo pipefail
repo=/workspace/zudo-doc
probe=/tmp/zudo421-basepath-probe
project="$probe/project"
export PATH=/tmp/zudo-tools/node_modules/.bin:/workspace/zudo-doc/node_modules/.bin:$PATH
export npm_config_store_dir=/tmp/zudo-pnpm-store
export NODE_USE_ENV_PROXY=1
export NODE_OPTIONS=--disable-warning=UNDICI-EHPA
python3 - <<'PORTCHECK'
import socket
s=socket.socket()
s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
try:
 s.bind(('127.0.0.1',44292))
finally:
 s.close()
PORTCHECK
if [ -e "$project" ]; then
  echo "Refusing to replace existing disposable project: $project; preserve it and choose a new probe directory" >&2
  exit 2
fi
cp -a /tmp/zudo421-base-probe/root-project "$project"
rm -rf "$project/dist" "$project/.zfb" "$project/.zfb-build"
mkdir -p "$project/src/styles"
cp "$repo/packages/create-zudo-doc/templates/base/src/styles/global.css" "$project/src/styles/global.css"
python3 - "$project" <<'PY'
from pathlib import Path
import sys
root=Path(sys.argv[1]);p=root/'src/config/settings.ts';s=p.read_text()
for old,new in [('base: "/",','base: "/nested/docs/",'),('dynamicPageTransition: false,','dynamicPageTransition: true,'),('headerNav: [],','headerNav: [{ label: "Getting Started", path: "/docs/getting-started/", categoryMatch: "getting-started" }],')]:
 if s.count(old)!=1:raise SystemExit('Unexpected fixture setting: '+old)
 s=s.replace(old,new,1)
p.write_text(s)
p=root/'zfb.config.ts';s=p.read_text();old='  ...preset,\n';assert s.count(old)==1;s=s.replace(old,old+'  // Published whole-dist deployment relocation contract; no double nesting.\n  copyPublicWithBase: false,\n',1);p.write_text(s)
assert not list((root/'pages').rglob('*.*')), 'Route stubs forbidden'
PY
cd "$repo"
git rev-parse HEAD > "$probe/head.txt"
sha256sum "$repo/packages/create-zudo-doc/templates/base/src/styles/global.css" > "$probe/template-css.sha256"
python3 /tmp/zudo-subreaper.py node "$probe/probe.mjs"
