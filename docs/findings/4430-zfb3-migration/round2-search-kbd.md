# Search shortcut placeholder regression (#4482 / #4478)

## Finding and fix

The generated search script originally serialized the results placeholder before
writing the platform shortcut into `[data-kbd-shortcut]`. Clearing a query restores
that earlier snapshot, so the shortcut badge comes back empty. The generator now
sets the platform label before capturing the placeholder; the committed generated
script is regenerated from that source.

This is an `intentional-fix` for #4478 and ships in zudo-doc 6.0.0. The platform
check also matches the documented `navigator.userAgentData.platform`
value `"macOS"` case-insensitively. Chrome's [User-Agent Client Hints guide](https://developer.chrome.com/docs/privacy-security/user-agent-client-hints)
uses that exact spelling. The prior case-sensitive `Mac` check missed it when the
client-hints platform value was present, even though the fallback user-agent string worked.

## Behavioral matrix

| Platform / transition | Expected | Evidence |
| --- | --- | --- |
| macOS (`userAgentData.platform = "macOS"`), first open | `⌘K` | `packages/zudo-doc/src/search-widget-script/__tests__/runtime.test.ts` |
| macOS, type a matching query then delete it | Placeholder returns with `⌘K` | Pre-fix test failed with an empty badge; post-fix test passes |
| macOS, shipped `type=text` input with Escape | Dialog closes and query remains; delete-clear restores placeholder with `⌘K` | Browser case in `e2e/smoke-search-shortcut.spec.ts` |
| Windows, first open and delete-clear | `Ctrl+K` survives placeholder restore | Unit and browser cases |
| Either platform, close/reopen and `zfb:after-swap` | Badge remains correct | Unit and browser cases |
| Either platform, disconnect/reconnect while results are populated, then clear | Original placeholder and platform badge return | Pre-fix runtime regression fails; post-fix unit and browser cases pass |
| Either platform, result activation | Dialog closes, SPA navigation completes without a main-frame document request | Strict browser case and navigation-request assertion |
| Loading, unavailable, and no-results states | Existing messages and retry behavior remain intact | Runtime unit compatibility test; existing smoke search coverage remains in place |

`e2e/smoke-search-shortcut.spec.ts` is the strict browser case for #4475 to run.
It covers the complete open → type → delete-clear → Escape-close-preserving-query →
reopen → populated disconnect/reconnect → clear → SPA result navigation path under
both Mac and Windows platform strings. It asserts that SPA result navigation does
not issue a main-frame document request. The regular smoke search specs continue to
cover no-results, unavailable, and result navigation behavior.

## Reproduction and verification

With documented macOS platform detection enabled but before the placeholder-order
fix, the focused runtime test failed after the first query was deleted on both
platform cases. The observed text was `""`; expected values were `"⌘K"` and
`"Ctrl+K"`. First-open checks passed, and the loading, unavailable, and no-results
compatibility test passed. This isolates the original failure to restoration of
the pre-shortcut placeholder snapshot.

The reconnect regression was added while the generator still recaptured results;
the focused runtime test failed for both macOS and Windows because clearing after
reconnect could not restore the placeholder. The one-time snapshot fix preserves
the original platform-populated HTML across reconnects. The focused generated-script
and runtime tests and E2E spec typecheck are recorded with the follow-up commit.
The strict browser run is delegated to #4475; no browser suite was run in this
worktree.
