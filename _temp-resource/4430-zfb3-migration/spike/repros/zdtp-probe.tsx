"use client";
import { getScope } from '@takazudo/zfb/zudo-react';
export default function ZdtpProbe() {
  getScope().onActivate(() => {
    let active = true;
    void import('@takazudo/zdtp').then((panel) => {
      if (!active) return;
      panel.configurePanel({
        storagePrefix: 'zfb-spike', consoleNamespace: 'zfb-spike',
        modalClassPrefix: 'zfb-spike-modal', schemaId: 'zfb-spike/v1',
        exportFilenameBase: 'zfb-spike',
        tabs: [{ id: 'palette', label: 'Palette', tiers: [{ id: 'base', label: 'Base', items: [
          { id: 'b0', cssVar: '--probe-b0', label: 'B0', default: 'oklch(98% .003 264)', type: { kind: 'color', format: 'oklch' } },
        ] }] }],
      });
      panel.showDesignTokenPanel();
      document.documentElement.dataset['zdtpLoaded'] = 'yes';
    });
    return () => { active = false; };
  });
  return <span id="zdtp-probe">zdtp probe</span>;
}
ZdtpProbe.displayName = 'ZdtpProbe';
