/**
 * Logical content hashing for the outline.
 *
 * This is an *equality* aid, not a version counter: the API server owns the
 * authoritative integer revision that clients send as `expectedRevision`. The
 * hash answers a different question — "is this outline logically the same one
 * I already have?" — which the SPA needs when reconciling an SSE payload or a
 * 409 snapshot against its own draft.
 *
 * Not a cryptographic digest. FNV-1a is used because it is synchronous and
 * dependency-free; `crypto.subtle.digest` is async and would infect every
 * caller with a promise.
 */

import type { OutlineDoc } from "./types";

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

const encoder = new TextEncoder();

/**
 * JSON with object keys sorted at every depth, so two logically equal values
 * always produce the same text. Array order is preserved — in this model it is
 * meaningful data, not incidental ordering.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? JSON.stringify(value) : "null";
    case "boolean":
      return value ? "true" : "false";
    case "object":
      break;
    default:
      // undefined / function / symbol / bigint — mirrors how JSON.stringify
      // erases them rather than throwing.
      return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

/** 64-bit FNV-1a over the UTF-8 bytes, as 16 lowercase hex characters. */
export function stableHash(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of encoder.encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

export function outlineRevisionHash(doc: OutlineDoc): string {
  return stableHash(stableStringify(doc));
}

export function outlinesEqual(a: OutlineDoc, b: OutlineDoc): boolean {
  return stableStringify(a) === stableStringify(b);
}
