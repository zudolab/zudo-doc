import { Island } from '@takazudo/zfb';
import { ClientRouter } from '@takazudo/zfb-runtime';
import PackageCounter from './island';
import RouterBootstrap from './router-bootstrap';
export default function PackageLayout({ children }: { children: any }) {
  return <html lang="en"><head><meta charset="utf-8"/><title>package probe</title><ClientRouter/></head>
    <body><header data-zfb-transition-persist="header"><a href="/pkg">package</a> <a href="/pkg2">package two</a> <a href="/about">about</a>
      <Island when="load"><PackageCounter/></Island></header><main>{children}</main><Island when="load"><RouterBootstrap/></Island></body></html>;
}
