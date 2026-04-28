/**
 * Tiny `clsx`-style class name joiner. Accepts strings, falsy values,
 * and arrays/objects of the same — only truthy strings survive.
 *
 * The host project depends on `clsx`, but framework primitives keep
 * their dependency surface minimal so that a downstream consumer of
 * `@zudo-doc/zudo-doc-v2/toc` does not need an extra runtime dep just
 * for class name composition. The behavior here is the subset the TOC
 * primitives use; see clsx for the full feature set.
 */
type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: unknown };

export function cx(...args: ClassValue[]): string {
  const out: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === "string") {
      out.push(arg);
    } else if (typeof arg === "number" || typeof arg === "bigint") {
      out.push(String(arg));
    } else if (Array.isArray(arg)) {
      const inner = cx(...arg);
      if (inner) out.push(inner);
    } else if (typeof arg === "object") {
      for (const key of Object.keys(arg)) {
        if ((arg as Record<string, unknown>)[key]) out.push(key);
      }
    }
  }
  return out.join(" ");
}
