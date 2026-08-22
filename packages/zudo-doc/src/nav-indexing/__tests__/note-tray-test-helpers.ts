/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { NoteTrayIndexItem } from "../note-tray-index.js";

export const item = (
  slug: string,
  overrides: Partial<NoteTrayIndexItem> = {},
): NoteTrayIndexItem => ({
  slug,
  label: slug,
  description: `About ${slug}`,
  href: `/docs/${slug}`,
  hasPage: true,
  children: [],
  rank: 1,
  ...overrides,
});

export const base = {
  locale: "en",
  updatedLabel: "Updated",
  dated: true,
  tagLabels: { tags: "Tags", taggedWith: "Pages tagged with" },
};
