// MathBlock's ONLY route to the optional `katex` peer (#4651, from #4648).
// `math-block` imports THIS subpath by its bare package name rather than
// `katex` directly, so that when `math` is off the preset's `katex-loader`
// plugin can shadow exactly this specifier with a throwing virtual module —
// the SSR bundle then never asks the bundler to resolve an absent `katex`,
// which Rolldown otherwise reports as an `UNRESOLVED_IMPORT` warning on every
// math-free build. Shadowing the bare `katex` instead would hijack a host's
// own katex imports.
//
// The load stays a rejection-handled DYNAMIC import, never a static
// `export … from "katex"`: with `math: true` and katex not installed, a static
// edge here would be a build-fatal unresolved dependency that no catch in the
// importer can intercept.

export type KatexLike = typeof import("katex").default;

// katex ships ESM (`default` export) and CJS builds; interop can surface the
// API on the namespace, on `default`, or doubly wrapped — take whichever has it.
function pickKatex(m: unknown): KatexLike | null {
  let cur: unknown = m;
  for (let i = 0; i < 3 && cur && typeof cur === "object"; i++) {
    if (typeof (cur as KatexLike).renderToString === "function") return cur as KatexLike;
    cur = (cur as { default?: unknown }).default;
  }
  return null;
}

/** katex's API, or `null` when the optional peer is not installed. */
export const katex: KatexLike | null = await import("katex").then(pickKatex, () => null);
