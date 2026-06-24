// Project MDX-components assembly — thin wrapper over the package factory.
//
// The bulk of the components bag (htmlOverrides, admonitions, CodeGroup,
// Tabs/TabItem, MathBlock, the img base-rewrite, the enlargeable-`p` override)
// now ships from `@takazudo/zudo-doc/mdx-components` (package-first migration,
// epic #2321, S8 #2332). This file keeps ONLY what is genuinely project-bound:
//
//   - the 4 locale-bound nav wrappers (CategoryNav / CategoryTreeNav /
//     SiteTreeNav / SiteTreeNavDemo) — they depend on the project's content
//     collections + nav-tree utilities, so they cannot live in the package.
//     They are passed into the factory as `navData`; the factory injects the
//     active `locale` so `/ja` resolves the JA collection (the load-bearing
//     locale thread — a static global mdx-components slot would render the EN
//     tree on every `/ja` page, which is why this stays a per-call factory).
//   - project `extras` spread last: HtmlPreview (with the host's global
//     config), Details, the Island SSR pass-through, the PresetGenerator SSR
//     shell, and the pure-showcase stubs (Avatar/Button/Card/MyComponent/
//     PageLayout) that appear only as illustrative MDX prose.

import type { ComponentChildren } from "preact";
import { createMdxComponents as createMdxComponentsBase } from "@takazudo/zudo-doc/mdx-components";
import { HtmlPreviewWrapper, type HtmlPreviewWrapperProps } from "@takazudo/zudo-doc/html-preview-wrapper";
import { defaultLocale, type Locale } from "@/config/i18n";
import { settings } from "@/config/settings";
import { CategoryNavWrapper } from "./lib/_category-nav";
import { CategoryTreeNavWrapper } from "./lib/_category-tree-nav";
import { SiteTreeNavWrapper } from "./lib/_site-tree-nav";
import { DetailsWrapper } from "./lib/_details";
import { PresetGeneratorFallback } from "./lib/_preset-generator";

const HtmlPreviewWithGlobalConfig = (props: HtmlPreviewWrapperProps) =>
  HtmlPreviewWrapper({ globalConfig: settings.htmlPreview ?? null, ...props });

/**
 * MDX-tag stub: renders nothing. Returning `null` keeps the rendered tree
 * intact (Preact's null-vnode path) without leaking placeholder markup into
 * the SSR output.
 */
const MdxStub = (_props: unknown) => null;

/**
 * SSR-pass-through wrapper for `<Island when="load|idle|visible">`.
 *
 * In the zfb build the zfb `<Island>` component is unavailable here, so the
 * MDX corpus tag resolves to this binding instead. Rendering the children
 * directly ensures server-renderable content nested inside `<Island>`
 * (headings, paragraphs, etc.) appears in the SSR HTML. The `when` prop is
 * ignored at render time — it is only meaningful to the zfb hydration runtime
 * on the client, which reads `data-when` on the inner SSR-skip placeholder.
 */
function IslandWrapper(props: {
  when?: "load" | "idle" | "visible" | "media";
  children?: ComponentChildren;
}): ComponentChildren {
  return props.children ?? null;
}

/**
 * Build a locale-aware MDX components map for the given locale.
 *
 * Delegates the package-resident components to the `@takazudo/zudo-doc`
 * factory and supplies the project-bound pieces:
 *   - `navData`: the 4 locale-aware nav wrappers (the factory injects `lang`).
 *   - `extras`: HtmlPreview (host-configured), Details, Island pass-through,
 *     PresetGenerator SSR shell, and the showcase stubs.
 *
 * Page modules should call createMdxComponents(locale) — not the static
 * mdxComponents export — so each render gets the locale-correct map.
 */
export function createMdxComponents(lang: Locale | string = defaultLocale) {
  return createMdxComponentsBase({
    settings,
    locale: lang,
    navData: {
      CategoryNav: CategoryNavWrapper as unknown as (props: Record<string, unknown>) => unknown,
      CategoryTreeNav: CategoryTreeNavWrapper as unknown as (props: Record<string, unknown>) => unknown,
      SiteTreeNav: SiteTreeNavWrapper as unknown as (props: Record<string, unknown>) => unknown,
    },
    extras: {
      HtmlPreview: HtmlPreviewWithGlobalConfig,
      Details: DetailsWrapper,
      // SmartBreak: corpus tag with no visual rendering — render nothing.
      SmartBreak: MdxStub,
      // Island: pass children through so server-renderable content nested
      // inside <Island> appears in SSR HTML. See IslandWrapper comment above.
      Island: IslandWrapper,
      // PresetGenerator: SSR fallback shell that renders the 8 section headings;
      // the interactive form hydrates client-side via the SSR-skip placeholder
      // inside PresetGeneratorFallback (see pages/lib/_preset-generator.tsx).
      PresetGenerator: PresetGeneratorFallback,
      // Pure showcase placeholders — appear only inside MDX prose as
      // illustrative examples, never implemented as real components.
      Avatar: MdxStub,
      Button: MdxStub,
      Card: MdxStub,
      MyComponent: MdxStub,
      PageLayout: MdxStub,
    },
  });
}

/**
 * Static default-locale components map for backward compatibility.
 * New page modules should call createMdxComponents(locale) instead.
 */
export const mdxComponents = createMdxComponents(defaultLocale);
