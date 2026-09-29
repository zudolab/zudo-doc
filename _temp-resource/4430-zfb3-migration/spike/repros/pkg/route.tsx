import PackageLayout from './layout';
import { Island } from '@takazudo/zfb';
import IframeProbe from './iframe-probe';
export default function PackageRoute() { return <PackageLayout><h1>injected package route</h1><Island when="load"><IframeProbe/></Island></PackageLayout>; }
