const FNV_OFFSET = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const FNV_MASK = (1n << 64n) - 1n;

/** Stable filename-safe key for the actual locale and effective route slug. */
export function agentPageKey(locale: string, effectiveRouteSlug: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify([locale, effectiveRouteSlug]));
  let hash = FNV_OFFSET;
  for (const byte of bytes) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & FNV_MASK;
  }
  return `p-${hash.toString(16).padStart(16, "0")}`;
}

/** One-based part key. The exporter checks duplicate keys and validates part counts. */
export function agentItemKey(pageId: string, oneBasedPart: number): string {
  if (!/^p-[0-9a-f]{16}$/.test(pageId)) {
    throw new Error("Invalid agent page ID.");
  }
  if (!Number.isSafeInteger(oneBasedPart) || oneBasedPart < 1 || oneBasedPart > 999_999) {
    throw new Error("Agent item part must be between 1 and 999999.");
  }
  return `${pageId}-${String(oneBasedPart).padStart(6, "0")}`;
}
