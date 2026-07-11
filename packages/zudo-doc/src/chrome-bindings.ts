// chrome-bindings — `defineChromeBindings`, the compile-time-checked widening
// adapter for a host's `ChromeHostBindings` object (zudolab/zudo-doc#2694, part
// of #2674).
//
// ## Why this exists
//
// `ChromeHostBindings` (in `./factory-context`) types every host slot with the
// WIDE structural shapes the chrome's own call sites need to compile:
// `FactoryComponent = (props: Record<string, unknown>) => unknown`,
// `(...args: unknown[]) => unknown[]`, `Record<string, unknown>`. Those wide
// types make a plain assignment of a REAL host binding fail under
// `strictFunctionTypes`: a concrete `DocHistory` component is
// `(props: { slug: string; … }) => VNode`, and by parameter contravariance a
// function requiring `{ slug }` is NOT assignable to one that will be called
// with an arbitrary `Record<string, unknown>`. The showcase absorbed that today
// with a wall of `as` / `as unknown as` casts (`src/chrome-bindings.tsx`) —
// which ALSO erases the one check that matters: whether each provided value
// actually accepts the props the chrome passes it (#2674).
//
// `defineChromeBindings` restores that check. Its input type declares, per slot,
// the EXACT call-side contract the package uses (sourced from the real chrome
// call sites — see each `*SlotProps` doc). A provided value must ACCEPT those
// props, so a component that REQUIRES a prop the chrome never passes is a
// COMPILE ERROR — the drift-detection goal of #2674. The unsafe widening to the
// structural `ChromeHostBindings` happens exactly ONCE, internally and audited
// (see the return statement), and runtime is pure pass-through.
//
// ## Placement (types-only import of factory-context)
//
// `factory-context` is TYPES-ONLY (enforced by `foundation-eval-graph.test.ts`).
// This runtime helper therefore does NOT live there — it lives here and imports
// the types with `import type`. Shipped as its own subpath
// `@takazudo/zudo-doc/chrome-bindings` (NOT folded into `./chrome`, which would
// drag the whole `createChrome` tree into hosts that only want the helper).

import type { ChromeHostBindings } from "./factory-context/index.js";

// ===========================================================================
// Per-slot CALL-SIDE prop/arg contracts.
//
// Each type below is the props/args object the PACKAGE actually constructs at
// the slot's real call site — the narrow contract the wide `ChromeHostBindings`
// slot type erases. A provided value's parameter must be a SUPERTYPE of this
// (i.e. it may read a subset, but must not REQUIRE anything not listed here).
// ===========================================================================

/**
 * Props the header passes to the `SearchWidget` slot — the 7 locale-aware
 * strings from `header-with-defaults`'s `<SearchWidget … />` render (via
 * `deriveSearchWidgetSlot`'s `SearchWidgetBound`, `chrome/derive.tsx`). NOTE
 * the package's own `SearchWidget` also takes `base`, but the chrome binds that
 * internally — a host-supplied widget is called with these 7 props ONLY, so
 * requiring `base` here would (correctly) be drift.
 */
export interface SearchWidgetSlotProps {
  placeholderText: string;
  shortcutHint: string;
  resultCountTemplate: string;
  searchLabel: string;
  searchUnavailableText: string;
  loadingIndexText: string;
  noResultsText: string;
}

/**
 * Props the chrome passes to the `BodyEndIslands` slot — matches
 * `BodyEndIslandsProps` (`doc-body-end-islands`); called as
 * `<BodyEndIslands basePath={…} />` in `home-page` / `doc-body-end`.
 */
export interface BodyEndIslandsSlotProps {
  basePath: string;
  aiChatBodyLabel?: string;
}

/**
 * Props the chrome passes to the `DocHistory` island slot — matches
 * `DocHistoryProps` (`doc-history/index.tsx`) / `DocHistoryComponent`
 * (`doc-history-area`), rendered as
 * `<DocHistory slug=… locale=… basePath=… />`.
 */
export interface DocHistorySlotProps {
  slug: string;
  locale?: string;
  basePath?: string;
}

/**
 * Props the chrome passes to the `DesignTokenPanelBootstrap` slot — NONE. It is
 * rendered as `<DesignTokenPanelBootstrap />` (zero props) inside
 * `createBodyEndIslands`. An empty object type (no index signature) so a
 * zero-prop or all-optional-prop component is accepted while a component that
 * REQUIRES any prop is drift.
 */
export type DesignTokenPanelBootstrapSlotProps = Record<never, never>;

/**
 * One footer tag entry the `loadTagsForLocale` result is read for —
 * `footer-with-defaults` maps over the array reading `{ tag, count }`. The
 * return contract is a `readonly` array of these (extra per-entry fields, e.g.
 * the `docs` on `collectTags`' `TagInfo`, are allowed — a supertype element).
 */
export interface FooterTagEntry {
  tag: string;
  count: number;
}

/**
 * Props the chrome passes to each `frontmatterRenderers[key]` renderer —
 * mirrors `FrontmatterCellRendererProps` at the real call site
 * (`metainfo/frontmatter-preview.tsx`: `rendererFn({ value, entryKey, data,
 * locale })`). A provided renderer's parameter must be a SUPERTYPE of this (it
 * may read a subset), so a renderer REQUIRING a prop the chrome never passes is
 * a compile error — the #2674 drift check this slot would otherwise erase.
 */
export interface FrontmatterRendererSlotProps {
  value: NonNullable<unknown>;
  entryKey: string;
  data: Record<string, unknown>;
  locale?: string;
}

// ===========================================================================
// ChromeBindingsInput — the compile-time-checked input surface.
//
// Every one of the 13 `ChromeHostBindings` slots appears here, optional, typed
// to its call-side contract above. Component slots are `(props: Expected) =>
// unknown` (accept the chrome's props, return anything renderable). Function
// slots carry their real param + return contract. Data/record slots use the
// LOOSE shapes the chrome treats them as — and deliberately do NOT force a
// `Record`-shaped object on `sidebarsConfig` (a concrete interface-typed
// sidebars object has no index signature; requiring one is the exact cast the
// showcase needs today). The two arg-object RENDERER slots
// (`docContentHeaderExtras` / `homeExtras`) reuse the `ChromeHostBindings`
// types verbatim — those are already call-side-precise there (not widened to
// `FactoryComponent`), so they need no narrowing and carry no widening friction.
// ===========================================================================

/**
 * The compile-time-checked input for {@link defineChromeBindings}. See the
 * module header for the drift-detection rationale.
 */
export interface ChromeBindingsInput {
  /** Header search widget — see {@link SearchWidgetSlotProps}. */
  SearchWidget?: (props: SearchWidgetSlotProps) => unknown;
  /** Body-end bootstrap islands — see {@link BodyEndIslandsSlotProps}. */
  BodyEndIslands?: (props: BodyEndIslandsSlotProps) => unknown;
  /** DocHistory island — see {@link DocHistorySlotProps}. */
  DocHistory?: (props: DocHistorySlotProps) => unknown;
  /** Design-token-panel bootstrap island — see {@link DesignTokenPanelBootstrapSlotProps}. */
  DesignTokenPanelBootstrap?: (props: DesignTokenPanelBootstrapSlotProps) => unknown;
  /**
   * Per-page git-history meta manifest (data slot). Read as
   * `Record<string, DocHistoryMetaEntry>` inside `doc-metainfo-area` /
   * `doc-history-area`; the loose `Record<string, unknown>` is the boundary shape.
   */
  docHistoryMeta?: Record<string, unknown>;
  /**
   * Sidebar section config (opaque data blob — the chrome casts it to `never`
   * before handing it to `buildSidebarForSection`). Typed `object` NOT
   * `Record<string, unknown>` on purpose: a concrete interface-typed sidebars
   * object (no index signature) must be accepted WITHOUT a cast.
   */
  sidebarsConfig?: object;
  /** Footer tag vocabulary (data slot); read structurally by `footer-with-defaults`. */
  tagVocabulary?: readonly unknown[];
  /**
   * Frontmatter preview renderers keyed by field (renderer record). Each value
   * must be callable with {@link FrontmatterRendererSlotProps} (the fixed
   * package call-side contract), so a non-function or a renderer requiring an
   * unpassed prop is a compile error. Narrow-props renderers still work
   * (parameter contravariance). Unlike `mdxExtras`, this slot has a fixed call
   * site, so it carries the real contract rather than a loose `Record`.
   */
  frontmatterRenderers?: Record<
    string,
    (props: FrontmatterRendererSlotProps) => unknown
  >;
  /**
   * MDX content-component overrides (renderer record). Same loose value type as
   * `frontmatterRenderers`; the showcase's `MdxStub = (_props: unknown) => null`
   * is accepted deliberately (`unknown` props are a safe supertype).
   */
  mdxExtras?: Record<string, unknown>;
  /**
   * Frontmatter preview entry builder. `doc-content-header` calls it with the
   * page `data` (`Record<string, unknown>`) and spreads the result into
   * `<FrontmatterPreview entries={…} />`, which destructures each entry as
   * `[key, value]` — so the return must be an array of `[string, unknown]`
   * tuples, not merely an array.
   */
  buildFrontmatterPreviewEntries?: (
    data: Record<string, unknown>,
  ) => readonly (readonly [string, unknown])[];
  /**
   * Footer tag-list loader. `footer-with-defaults` calls it with the locale and
   * maps the result reading `{ tag, count }` — see {@link FooterTagEntry}.
   * A wrong return type (e.g. a non-array) is a compile error.
   */
  loadTagsForLocale?: (lang: string) => readonly FooterTagEntry[];
  /**
   * Extra content rendered inside the doc content header. An arg-object
   * RENDERER — the `ChromeHostBindings` type is already call-side-precise, so
   * reuse it verbatim (no widening friction).
   */
  docContentHeaderExtras?: ChromeHostBindings["docContentHeaderExtras"];
  /**
   * Extra content rendered in the home hero. An arg-object RENDERER — reuse the
   * already call-side-precise `ChromeHostBindings` type verbatim.
   */
  homeExtras?: ChromeHostBindings["homeExtras"];
}

/**
 * Reject unknown slot names. Generic inference (below) turns OFF the
 * excess-property check that a plain `input: ChromeBindingsInput` parameter
 * would get for an object literal, so re-impose it explicitly: any key of `T`
 * that is NOT a `ChromeBindingsInput` slot is mapped to `never`, making a real
 * value for it fail to assign.
 */
type NoExtraKeys<T> = ChromeBindingsInput &
  Record<Exclude<keyof T, keyof ChromeBindingsInput>, never>;

/**
 * Widen a compile-time-checked host bindings object to `ChromeHostBindings`.
 *
 * The generic `T` captures the caller's exact object so {@link NoExtraKeys}
 * can reject unknown slot names; `T extends ChromeBindingsInput` enforces every
 * slot's per-call-site contract (a component requiring a prop the chrome never
 * passes, or a function slot with an incompatible return type, is a COMPILE
 * ERROR). Runtime behaviour is pure PASS-THROUGH — the returned object IS the
 * input.
 */
export function defineChromeBindings<T extends ChromeBindingsInput>(
  input: T & NoExtraKeys<T>,
): ChromeHostBindings {
  // The SINGLE, audited widening cast. It is SOUND because `ChromeBindingsInput`
  // has already proven each provided value ACCEPTS the props the chrome passes
  // it: every component slot's parameter is a supertype of the exact
  // `*SlotProps` the call site constructs. `ChromeHostBindings` merely re-types
  // those same values with the WIDE structural shapes (`FactoryComponent`,
  // `(...args: unknown[]) => unknown[]`, `Record<string, unknown>`) its own call
  // sites need — a claim strictly weaker than what we verified, but not
  // directly assignable under `strictFunctionTypes` (parameter contravariance).
  // Since the chrome only ever invokes each value with the `*SlotProps` we
  // checked against, no widened call can reach a prop the value did not accept,
  // so bridging the structural gap through `unknown` here introduces no runtime
  // risk. Do NOT weaken any input slot type to avoid this cast (that would
  // re-erase the #2674 check); do NOT scatter more casts — this is the only one.
  return input as unknown as ChromeHostBindings;
}
