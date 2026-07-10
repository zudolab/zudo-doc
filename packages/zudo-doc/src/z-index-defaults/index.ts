/**
 * Default z-index tiers — 13 tiers, `content` (0) through `drag` (90).
 *
 * Ported from the `create-zudo-doc` base template's
 * `src/config/z-index-tokens.ts` `Z_INDEX_TIERS` export (epic
 * zudolab/zudo-doc#2651, S4 #2654). Consumed by the theme-CSS default
 * (#2655) for the shipped `@theme` z-index block; a project's own
 * `gen-z-index` codegen (from `@takazudo/zudo-doc`'s `gen-z-index` bin)
 * becomes opt-in customization on top of this default rather than the only
 * source.
 *
 * Only `name`/`value` are carried in the exported shape — `purpose`/`kind`
 * were documentation-only in the template and are preserved below as source
 * comments instead.
 *
 * Strategy (from zudolab/zudo-css-wisdom z-index-strategy): semantic single-
 * namespace tokens — names describe ROLES, never magnitudes. One flat ordered
 * list. Values are deliberately gapped but otherwise arbitrary: renaming and
 * reordering is cheap, which is the whole point. Tailwind v4 reads the
 * `--z-index-<name>` theme key and generates a `z-<name>` utility, so e.g.
 * `@theme { --z-index-toolbar: 20 }` produces `.z-toolbar { z-index: 20 }`.
 *
 * `local-1`/`local-2`/`local-3` ("local" kind in the template) are anonymous
 * reusable helpers for promoting a child WITHIN a parent stacking context
 * (`isolation: isolate` / `position: relative`), not a position on the
 * global stacking scale. Every other tier is "global".
 *
 * Rationale for the two zudo-doc-specific additions (NOT in the generic
 * overlay-centric strategy scale):
 *   - `sidebar` — persistent layout chrome (desktop sidebar, TOC, sidebar-toggle
 *     handle, resizer handle). The strategy's scale has no persistent-sidebar/TOC
 *     tier. `toolbar` (the sticky header) is deliberately placed ABOVE `sidebar`
 *     to preserve the existing header-wins ordering; they do not overlap
 *     spatially, but the historical relationship is kept explicit.
 *   - `drag` — transient drag affordance (sidebar-resizer ghost line). Replaces
 *     the old `z-9999` anti-pattern with a named top-of-steady-UI tier.
 *
 * `popover`, `toast`, and `tooltip` are reserved canonical tiers from the
 * strategy's scale — kept for completeness (and so downstream `create-zudo-doc`
 * users inherit the full scale) even though zudo-doc does not use them yet.
 */

export const defaultZIndexTiers: ReadonlyArray<{ name: string; value: number }> = [
  // global — default in-flow content (implicit baseline)
  { name: "content", value: 0 },
  // local — child promotion inside an isolated parent stacking context
  { name: "local-1", value: 1 },
  // local — child promotion inside an isolated parent stacking context
  { name: "local-2", value: 2 },
  // local — child promotion inside an isolated parent stacking context
  { name: "local-3", value: 3 },
  // global — persistent layout chrome: desktop sidebar, TOC, sidebar-toggle
  // handle, resizer handle
  { name: "sidebar", value: 10 },
  // global — sticky top header (sits above sidebar chrome)
  { name: "toolbar", value: 20 },
  // global — header menus, version/language switchers
  { name: "dropdown", value: 30 },
  // global — reserved: inline popovers (canonical scale; not yet used)
  { name: "popover", value: 40 },
  // global — mobile drawer backdrop, <dialog> ::backdrop
  { name: "modal-backdrop", value: 50 },
  // global — mobile sidebar drawer panel, search <dialog>
  { name: "modal", value: 60 },
  // global — reserved: transient notifications (canonical scale; not yet used)
  { name: "toast", value: 70 },
  // global — reserved: highest steady UI layer, below only the transient drag
  // tier (canonical scale; not yet used)
  { name: "tooltip", value: 80 },
  // global — transient drag affordance: sidebar-resizer ghost line (replaces
  // the z-9999 anti-pattern)
  { name: "drag", value: 90 },
];
