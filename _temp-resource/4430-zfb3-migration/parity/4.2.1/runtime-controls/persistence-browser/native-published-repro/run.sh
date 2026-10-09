#!/usr/bin/env bash
set -euo pipefail
export PATH=/tmp/zudo-tools/node_modules/.bin:$PATH
export NODE_USE_ENV_PROXY=1 NODE_OPTIONS=--disable-warning=UNDICI-EHPA
cd /tmp/zudo421-pending-native
node --input-type=module - <<'JS'
import { readFileSync } from 'node:fs';
for (const name of ['@takazudo/zfb', '@takazudo/zfb-runtime']) {
  const version = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).version;
  if (version !== '4.2.1') throw Error(`${name}: expected4.2.1 got ${version}`);
  console.log(`${name}=${version}`);
}
JS
python3 /tmp/zudo-subreaper.py ./node_modules/.bin/playwright test --config ./playwright.config.mjs
