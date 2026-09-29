import { definePlugin } from '@takazudo/zfb/plugins';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export default definePlugin({
  name: '@zfb-spike/pkg/plugin',
  setup(ctx) {
    ctx.injectRoute('/pkg', require.resolve('@zfb-spike/pkg/route'));
    ctx.injectRoute('/pkg2', require.resolve('@zfb-spike/pkg/route2'));
  },
});
