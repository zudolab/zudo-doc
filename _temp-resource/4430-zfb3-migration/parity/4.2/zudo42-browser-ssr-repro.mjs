import { Island } from '@takazudo/zfb';
import { h } from '@takazudo/zfb/zudo-react';
import { renderToString } from '@takazudo/zfb/zudo-react/server';
function Counter() { return h('button', null, 'Counter'); }
for (const [name, value] of [['ordinary component', h(Counter, null)], ['owned Island without build metadata', h(Island, null, h(Counter, null))]]) {
  try { console.log(name, 'PASS', renderToString(value)); }
  catch (error) { console.log(name, 'FAIL', String(error)); }
}
