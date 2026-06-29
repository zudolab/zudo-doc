// assert-chrome-context — narrow runtime guard for the 2.0 ChromeContext
// parameter contract (epic Collapse Wiring Shells #2420, guard #2455).
//
// The 2.0 factories take a single unified ChromeContext whose `hostBindings`
// field is REQUIRED. A consumer still passing the pre-2.0 per-factory deps-bag
// compiles fine under tsc but crashes at runtime when the factory dereferences
// `ctx.hostBindings.tagVocabulary` (or similar). This helper surfaces a clear
// actionable error instead of an opaque TypeError.
//
// IMPORTANT: this file must remain pure and node-free. It is imported by the
// page-chrome factories (footer-with-defaults, header-with-defaults, etc.) which
// are NOT in the preset eval graph — but they must not pull in node builtins
// either. No imports here; all logic is inline.

/**
 * Assert that `ctx` is a fully-wired 2.0 ChromeContext (i.e. has `hostBindings`).
 *
 * Throws an actionable Error when the caller passes a bare pre-2.0 deps-bag
 * instead of the unified ChromeContext the 2.0 factories require. This catches
 * runtime crashes (`Cannot read properties of undefined (reading 'tagVocabulary')`)
 * at the factory boundary instead of deep inside the component render.
 *
 * See packages/zudo-doc/API.md — "Migration Notes" for upgrade instructions.
 */
// `ctx` is typed `unknown` on purpose: this is a runtime validator of
// *untrusted* input (a consumer may pass the pre-2.0 deps-bag, which TS cannot
// reject at the call site — that is exactly the failure mode this guard exists
// to catch). The production factory call sites pass a `ChromeContext`, which is
// assignable to `unknown`; the narrowing happens inside.
export function assertChromeContext(ctx: unknown, factoryName: string): void {
  if (ctx == null || (ctx as Record<string, unknown>).hostBindings == null) {
    throw new Error(
      `\`${factoryName}\` received a context without \`hostBindings\` — the 2.0 factories take a single ChromeContext, not the pre-2.0 deps-bag. See packages/zudo-doc/API.md.`,
    );
  }
}
