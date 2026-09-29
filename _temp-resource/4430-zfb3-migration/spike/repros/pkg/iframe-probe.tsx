"use client";
import { getScope } from '@takazudo/zfb/zudo-react';
export default function IframeProbe() {
  const scope = getScope();
  const hostRef: { current: HTMLDivElement | null } = { current: null };
  scope.onActivate(() => {
    const host = hostRef.current;
    if (!host) return;
    const dynamic = document.createElement('iframe');
    dynamic.id = 'iframe-imperative';
    dynamic.srcdoc = '<p style="height: 42px">imperative</p>';
    host.append(dynamic);
    const resize = () => {
      const height = dynamic.contentDocument?.documentElement.scrollHeight ?? 0;
      dynamic.style.height = `${height}px`;
      dynamic.dataset['measuredHeight'] = String(height);
    };
    dynamic.addEventListener('load', resize);
    return () => { dynamic.removeEventListener('load', resize); dynamic.remove(); };
  });
  return <div id="iframe-probe" ref={hostRef} rawHtml={'<iframe id="iframe-raw" srcdoc="<p>raw</p>"></iframe>'}/>;
}
IframeProbe.displayName = 'IframeProbe';
