import { h } from '@takazudo/zfb/zudo-react';
import { renderToString } from '@takazudo/zfb/zudo-react/server';
function Row() { return h('tr', {}, h('td', {}, 'x')); }
try { console.log(renderToString(h('table', {}, h('tbody', {}, h(Row, {}))))); }
catch (error) { console.log(error.message); }
