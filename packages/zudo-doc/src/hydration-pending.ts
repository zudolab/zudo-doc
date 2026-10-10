import { signal } from "@takazudo/zfb/zudo-react";
import type { ReadonlySignal, Scope } from "@takazudo/zfb/zudo-react";

/** Keep SSR and the first client render pending, then release on activation. */
export function hydrationPending(scope: Scope, enabled: boolean): ReadonlySignal<boolean> {
  const pending = signal(enabled);
  scope.onActivate(() => { pending.value = false; });
  return pending;
}
