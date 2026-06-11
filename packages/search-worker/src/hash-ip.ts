function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derive a stable key from a client IP for rate-limit KV keys.
 *
 * When `secret` is provided (the optional `IP_HASH_SECRET` Workers secret),
 * the IP is hashed with HMAC-SHA-256 so stored hashes cannot be reversed by
 * brute-forcing the enumerable IPv4 space (zudolab/zudo-doc#2038). When the
 * secret is absent, falls back to plain unsalted SHA-256 — byte-for-byte
 * identical to the pre-#2038 behaviour, so deployments without the secret are
 * unaffected.
 *
 * Both branches emit a 64-char hex SHA-256 digest, so KV key shapes are
 * unchanged. Setting or rotating the secret changes every derived key, so
 * in-flight rate-limit buckets reset (60s windows, negligible).
 */
export async function hashIp(ip: string, secret?: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  if (secret) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return toHex(await crypto.subtle.sign("HMAC", key, data));
  }
  return toHex(await crypto.subtle.digest("SHA-256", data));
}
