import { useEffect, useState } from "preact/hooks";

/**
 * Keep an interactive control pending until its first successful client mount.
 * Initializing from `enabled` preserves server/client-first-render parity.
 */
export function useHydrationPending(enabled: boolean): boolean {
  const [pending, setPending] = useState(enabled);

  useEffect(() => setPending(false), []);

  return pending;
}
