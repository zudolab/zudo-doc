# Minimal sidebar client transport (#4536)

The published 6.0.0 scaffold serializes sibling page descriptions through
`SidebarToggle` and `SidebarTree`, including `navigation.roots` outside the local
forest. These are public descriptions, not a privacy-boundary failure. Neither
island needs them for rendering or filtering; server category/navigation views do.

## Reviewed design

Project data at the two native factory island boundaries, after transport
validation and before constructing the SSR/hydration descriptions. The public
`toSidebarClientData(nodes, navigation?)` helper in `@takazudo/zudo-doc/sidebar`
also supports custom hosts. It recursively selects all current `SidebarNavNode`
fields except `description`, for both visible nodes and broader roots. An
exhaustive type-checked field policy forces future fields to receive a decision.
Unknown fields are omitted after validation; getters, cycles, malformed arrays
and non-JSON values cannot hide in discarded fields.

Retain occurrence IDs, authored order, labels, URLs, note-tray/date/rank metadata,
parents, local parent and expansion defaults. Preserve the context ID exactly:
`buildSidebarNavigation` fingerprints full server roots, including descriptions.
Changing that hash would change scope persistence, outside this task. This means
description changes may still invalidate persisted scope. Server builders and
public `SidebarNavNode.description` remain unchanged.

The independent design review required projecting both forests, preserving the
opaque ID, validating before projection, using the same normalized SSR/client
props, and retaining lazy custom builders. Custom mobile arrays/callback results
are now copied rather than passed by object identity; retained values and URLs
are unchanged. Hidden mobile toggles do not validate unused custom trees.

Rejected alternatives: deleting descriptions in server builders loses category
content; only minimizing visible nodes leaves sibling prose in broader roots;
removing full roots or reconstructing occurrence IDs breaks scope/duplicate
navigation; a JSON round trip can conceal invalid values. No upstream zfb change,
A2 normalization change, reference regeneration or release-policy change belongs
in this fix.

## Regression coverage and evidence

- `sidebar/__tests__/client-data.test.ts`: recursive allowlist, all current client
  fields, duplicate occurrences, topology, immutable source, independent output,
  optional/unknown fields, malformed discarded values in either forest.
- `chrome/__tests__/sidebar-client-data.test.tsx`: actual native SSR `data-props`
  from both factories omit `PUBLIC_SIBLING_DESCRIPTION_SENTINEL_155`, including
  the broader sibling root; server descriptions remain. Custom array/callback
  forests retain versioned URLs and note metadata. Hidden-toggle behavior remains.
- Existing desktop/mobile hydrated interaction suites run projected props through
  native SSR/hydration and retain their focus, scope, restore, filter, expansion
  and cleanup assertions. Existing factory tests retain lazy-builder checks,
  replacing array identity with copied value equality.

Initial focused run: **43 tests passed across five files**. Package typecheck
passed. These are local source-level results, not accepted-main or packed/browser
proof. Final-head CI, A2 and exact-main deployment evidence must be recorded before
closing #4536. No measured production byte saving is claimed yet.

This task does not solve A2 baseline churn. A2 remains strict; separate maintenance
work is gated on #4535 delivery. Retained manual/account statuses remain Apple IME
**NOT RUN / OWNER WAIVED**, A3 **PARTIAL / UNVERIFIED**, A5 **NOT RUN**.
