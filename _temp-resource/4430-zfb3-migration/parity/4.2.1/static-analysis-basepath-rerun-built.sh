#!/usr/bin/env bash
set -euo pipefail
export PATH=/tmp/zudo-tools/node_modules/.bin:/workspace/zudo-doc/node_modules/.bin:$PATH
export npm_config_store_dir=/tmp/zudo-pnpm-store
export NODE_USE_ENV_PROXY=1
export NODE_OPTIONS=--disable-warning=UNDICI-EHPA
python3 - <<'PORTCHECK'
import socket
s=socket.socket()
s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
try:s.bind(('127.0.0.1',44292))
finally:s.close()
PORTCHECK
cd /workspace/zudo-doc
set +e
python3 /tmp/zudo-subreaper.py node /tmp/zudo421-basepath-probe/probe.mjs --reuse-build
result=$?
set -e
python3 - <<'CLEANUPCHECK'
import errno,json,socket
from pathlib import Path
s=socket.socket();s.settimeout(1)
try:
 result=s.connect_ex(('127.0.0.1',44292))
 Path('/tmp/zudo421-basepath-probe/cleanup-port.json').write_text(json.dumps({'nativePreviewPort':44292,'connectEx':result,'expectedConnectionRefused':errno.ECONNREFUSED,'noActiveListener':result==errno.ECONNREFUSED},indent=2)+'\n')
 if result!=errno.ECONNREFUSED:raise SystemExit('Native preview listener cleanup not established: '+str(result))
finally:s.close()
CLEANUPCHECK
exit "$result"
