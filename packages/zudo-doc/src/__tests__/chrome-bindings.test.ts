// Type-level + runtime contract for `defineChromeBindings` (zudolab/zudo-doc#2694).
//
// The COMPILE assertions below (positive + `@ts-expect-error` negative) are the
// heart of this suite. Vitest does NOT typecheck, so they are validated by the
// package `typecheck` gate (`tsc --noEmit`, which — unlike `tsconfig.build.json`
// — includes `__tests__`). The two exported `_*CompileAssertions` functions are
// never called at runtime; their mere presence in a typechecked file is the
// assertion. The one `it(...)` block below is the runtime pass-through proof.

import { describe, it, expect } from "vitest";
import { defineChromeBindings } from "../chrome-bindings.js";

// A concrete, interface-typed sidebars object — crucially WITHOUT an index
// signature. It must be accepted by `sidebarsConfig` with NO caller-side cast
// (the friction the showcase's `sidebars as unknown as Record<…>` cast reveals:
// requiring a `Record`-shaped input would reject this).
interface ShowcaseSidebars {
  "!": unknown[];
  guides: unknown[];
}
const concreteSidebars: ShowcaseSidebars = { "!": [], guides: [] };

/**
 * POSITIVE compile assertions — every value below is provided WITHOUT a
 * caller-side cast. If any stops compiling, the adapter has over-tightened.
 */
export function _positiveCompileAssertions(): void {
  // All slots at once, with narrow/concrete real-world values.
  defineChromeBindings({
    Header: (props) => props.lang,
    Footer: (props) => props.lang,
    Sidebar: (props) => props.currentSlug,
    Toc: (props) => props.headings.length,
    Breadcrumb: (props) => props.items.length,
    DocPager: (props) => props.locale,
    SearchWidget: (props) => props.searchLabel,
    headerRightComponents: {
      "release-badge": ({ item, index, lang }) =>
        `${item.component}:${index}:${lang ?? "default"}`,
    },
    BodyEndIslands: (props) => props.basePath,
    DocHistory: (props: { slug: string }) => props.slug, // reads a SUBSET of the passed props
    DesignTokenPanelBootstrap: () => null, // zero-prop component
    docHistoryMeta: {} as Record<string, unknown>,
    sidebarsConfig: concreteSidebars, // concrete object, no index signature — no cast
    tagVocabulary: [{ id: "topic" }],
    frontmatterRenderers: { badge: (props) => props.value }, // reads a SUBSET of the renderer props
    mdxExtras: { Stub: (_p: unknown) => null }, // MdxStub edge — `unknown` props accepted
    buildFrontmatterPreviewEntries: (data) => Object.entries(data),
    loadTagsForLocale: (lang) => [{ tag: lang, count: 1 }], // (lang: string) => Tag[]
    docContentHeaderExtras: ({ locale }) => locale,
    homeExtras: ({ locale }) => locale,
  });

  // Focused restatements of the task's required positive cases (each isolated,
  // still cast-free).

  // A `(props: { slug: string }) => unknown` component in `DocHistory`.
  defineChromeBindings({ DocHistory: (props: { slug: string }) => props.slug });

  // A `(lang: string) => Tag[]` callable in `loadTagsForLocale`. Extra per-entry
  // fields (here `docs`, mirroring `collectTags`' `TagInfo`) are allowed.
  defineChromeBindings({
    loadTagsForLocale: (lang: string) => [{ tag: lang, count: 2, docs: [] }],
  });

  // A concrete typed sidebars object in `sidebarsConfig`.
  defineChromeBindings({ sidebarsConfig: concreteSidebars });

  // Header-right registry values receive the exact renderer context and must
  // remain callable. Project-owned names are intentionally open strings.
  defineChromeBindings({
    headerRightComponents: {
      status: ({ item, index, githubLabel }) =>
        `${item.component}:${index}:${githubLabel}`,
    },
  });

  // Primary replacements may require every prop that the real call site
  // always supplies, while reading only a subset is also safe.
  defineChromeBindings({
    Header: ({ lang }: { lang: string }) => lang,
    Footer: ({ lang }: { lang: string }) => lang,
    Sidebar: ({ currentSlug }: { currentSlug: string }) => currentSlug,
    Toc: ({ title }: { title: string }) => title,
    Breadcrumb: ({ items }: { items: unknown[] }) => items.length,
    DocPager: ({ locale }: { locale: string }) => locale,
  });

  // A real renderer in `frontmatterRenderers` (typed by its call-side contract),
  // and a loose `Record<string, unknown>` in `mdxExtras` (legitimately loose —
  // author-controlled MDX has no fixed prop contract).
  defineChromeBindings({
    frontmatterRenderers: {
      badge: ({ value, entryKey }) => `${entryKey}:${String(value)}`,
    },
    mdxExtras: {} as Record<string, unknown>,
  });
}

/**
 * NEGATIVE compile assertions — each MUST error (guarded by `@ts-expect-error`;
 * an unused directive would itself fail the typecheck gate).
 */
export function _negativeCompileAssertions(): void {
  defineChromeBindings({
    // @ts-expect-error headerRightComponents values must be callable renderers
    headerRightComponents: { status: "not-callable" },
  });

  defineChromeBindings({
    headerRightComponents: {
      // @ts-expect-error renderer requires `accountId`, which Header never passes
      status: (props: { index: number; accountId: string }) => props.accountId,
    },
  });

  // (1) prop-drift: a component REQUIRING a prop the chrome never passes for
  //     that slot. The chrome renders `<DocHistory slug locale basePath />` —
  //     `revision` is not among them, so requiring it is drift, not a mere
  //     non-callable.
  defineChromeBindings({
    // @ts-expect-error DocHistory requires `revision`, which the chrome never passes
    DocHistory: (props: { slug: string; revision: string }) => props.revision,
  });

  // (2) an unknown slot name.
  defineChromeBindings({
    // @ts-expect-error `notASlot` is not a ChromeHostBindings slot
    notASlot: () => null,
  });

  // (3) a function slot with an incompatible RETURN type.
  defineChromeBindings({
    // @ts-expect-error loadTagsForLocale must return a tag array, not a number
    loadTagsForLocale: (_lang: string) => 123,
  });

  // (4) a record-slot with a NON-callable value — `frontmatterRenderers` has a
  //     fixed call-side contract, so a non-function is drift (unlike `mdxExtras`).
  defineChromeBindings({
    // @ts-expect-error a frontmatter renderer must be callable, not a number
    frontmatterRenderers: { foo: 42 },
  });

  // (5) a `frontmatterRenderers` entry REQUIRING a prop the chrome never passes.
  defineChromeBindings({
    frontmatterRenderers: {
      // @ts-expect-error renderer requires `extra`, which the chrome never passes
      foo: (props: { value: unknown; extra: string }) => props.extra,
    },
  });

  // (6) each primary component rejects a required prop its call site never
  // supplies. These guard the exact contracts independently so widening one
  // slot cannot silently weaken the rest.
  defineChromeBindings({
    // @ts-expect-error Header never supplies `accountId`
    Header: (props: { lang: string; accountId: string }) => props.accountId,
  });
  defineChromeBindings({
    // @ts-expect-error Footer never supplies `legalNotice`
    Footer: (props: { lang: string; legalNotice: string }) => props.legalNotice,
  });
  defineChromeBindings({
    // @ts-expect-error Sidebar never supplies `expandedDepth`
    Sidebar: (props: { currentSlug: string; expandedDepth: number }) =>
      props.expandedDepth,
  });
  defineChromeBindings({
    // @ts-expect-error Toc never supplies `activeSlug`
    Toc: (props: { headings: unknown[]; title: string; activeSlug: string }) =>
      props.activeSlug,
  });
  defineChromeBindings({
    // @ts-expect-error Breadcrumb never supplies `homeLabel`
    Breadcrumb: (props: { items: unknown[]; homeLabel: string }) => props.homeLabel,
  });
  defineChromeBindings({
    // @ts-expect-error DocPager never supplies `pageCount`
    DocPager: (props: { locale: string; pageCount: number }) => props.pageCount,
  });
}

describe("defineChromeBindings", () => {
  it("is a pass-through: returns the exact input object (runtime identity)", () => {
    const input = { DocHistory: (props: { slug: string }) => props.slug };
    const result = defineChromeBindings(input);
    // Runtime behaviour is PASS-THROUGH — the returned value IS the input.
    expect(result).toBe(input);
  });
});
