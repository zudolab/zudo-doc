"use client";
import { getScope, signal } from '@takazudo/zfb/zudo-react';
export default function PackageCounter() {
  const count = signal(0);
  getScope().onActivate(() => { document.documentElement.dataset['packageActivated'] = 'yes'; });
  return <button id="package-counter" on:click={() => { count.value++; }}>count:{count}</button>;
}
PackageCounter.displayName = 'PackageCounter';
