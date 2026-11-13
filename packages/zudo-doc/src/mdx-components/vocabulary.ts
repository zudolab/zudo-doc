// Node-free, JSX-free component vocabulary shared by the MDX component map and
// the agent text export, so both agree on which tags wrap ordinary Markdown.

import { defaultDirectiveVocabulary } from "../directive-vocabulary-defaults/index.js";

/** Admonition variants, in registration order. */
export const ADMONITION_VARIANTS = ["note", "tip", "info", "warning", "danger", "important", "caution"] as const;

export type AdmonitionVariant = (typeof ADMONITION_VARIANTS)[number];

/** `"note"` → `"Note"`: both the MDX tag name and the default visible title. */
export function admonitionComponentName(variant: AdmonitionVariant): string {
  return variant.charAt(0).toUpperCase() + variant.slice(1);
}

/** MDX tag name → admonition variant. */
export const ADMONITION_COMPONENTS: ReadonlyMap<string, AdmonitionVariant> = new Map(
  ADMONITION_VARIANTS.map((variant) => [admonitionComponentName(variant), variant]),
);

/** The collapsible the `:::details` directive resolves to. Its default title is "Details". */
export const DETAILS_COMPONENT = defaultDirectiveVocabulary.details ?? "Details";

/** Tab containers whose body is ordinary Markdown. */
export const TAB_GROUP_COMPONENTS = ["Tabs", "CodeGroup"] as const;

/** One labelled tab inside a tab container (`label` prop). */
export const TAB_ITEM_COMPONENT = "TabItem";

/** Navigation tags that list documents from the docs collection. */
export const NAV_COMPONENTS = [
  "CategoryNav",
  "CategoryTreeNav",
  "SiteTreeNav",
  "SiteTreeNavDemo",
  "DocCardNav",
  "NoteTrayIndex",
] as const;

export type NavComponentName = (typeof NAV_COMPONENTS)[number];
