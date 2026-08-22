/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { remapVersionedHrefs } from "../nav-data-prep/index.js";
import {
  NoteTrayIndex,
  type NoteTrayIndexItem,
  type NoteTrayIndexStyle,
} from "../nav-indexing/index.js";
import { findContainingNoteTray, getNoteTrayItems } from "../note-tray-model/index.js";

export interface NoteTrayIndexNode extends NoteTrayIndexItem {
  shape?: "note-tray";
  sortOrder?: "asc" | "desc";
  noteTrayDated?: boolean;
  children: NoteTrayIndexNode[];
}

export interface NoteTrayIndexDoc {
  slug: string;
  data: {
    slug?: string;
    tags?: string[];
  };
}

export interface NoteTrayIndexSource {
  navDocs: NoteTrayIndexDoc[];
  categoryMeta: Map<string, unknown>;
}

export interface NoteTrayIndexWrapperProps {
  style?: NoteTrayIndexStyle;
  showDate?: boolean;
  category?: string;
  lang?: string;
  currentVersion?: string;
  currentSlug?: string;
}

export interface NoteTrayIndexDeps {
  defaultLocale: string;
  docTags: boolean;
  resolveNavSource: (
    lang: string,
    currentVersion: string | undefined,
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => NoteTrayIndexSource;
  buildNavTree: (
    docs: NoteTrayIndexDoc[],
    locale: string,
    categoryMeta: Map<string, unknown>,
  ) => NoteTrayIndexNode[];
  findNode: (tree: NoteTrayIndexNode[], slug: string) => NoteTrayIndexNode | undefined;
  toRouteSlug: (slug: string) => string;
  resolveTag: (raw: string) => string;
  tagHref: (tag: string, locale: string) => string;
  t: (key: string, locale: string) => string;
  versionedDocsUrl: (slug: string, versionSlug: string, lang: string) => string;
}

export function createNoteTrayIndexWrapper(
  deps: NoteTrayIndexDeps,
): (props: NoteTrayIndexWrapperProps) => JSX.Element | null {
  return function NoteTrayIndexWrapper({
    style = "index",
    showDate = false,
    category,
    lang = deps.defaultLocale,
    currentVersion,
    currentSlug,
  }: NoteTrayIndexWrapperProps): JSX.Element | null {
    const source = deps.resolveNavSource(lang, currentVersion, { keepUnlisted: true });
    const rawTree = deps.buildNavTree(source.navDocs, lang, source.categoryMeta);
    const tree = currentVersion
      ? remapVersionedHrefs(rawTree, currentVersion, lang, deps.versionedDocsUrl)
      : rawTree;
    const tray = category
      ? deps.findNode(tree, category)
      : currentSlug
        ? findContainingNoteTray(tree, currentSlug)
        : undefined;

    if (!tray || tray.shape !== "note-tray") return null;

    const docsBySlug = new Map(
      source.navDocs.map((doc) => [doc.data.slug ?? deps.toRouteSlug(doc.slug), doc]),
    );
    const items = getNoteTrayItems(tray).map((item): NoteTrayIndexItem => {
      const rawTags = docsBySlug.get(item.slug)?.data.tags ?? [];
      const tags = [...new Set(rawTags.map(deps.resolveTag))];
      return {
        ...item,
        tagLinks: deps.docTags
          ? tags.map((tag) => ({ tag, href: deps.tagHref(tag, lang) }))
          : undefined,
      };
    });

    return (
      <NoteTrayIndex
        items={items}
        style={style}
        showDate={showDate}
        locale={lang}
        updatedLabel={deps.t("doc.updated", lang)}
        dated={tray.noteTrayDated === true}
        order={tray.sortOrder ?? "asc"}
        tagLabels={{
          tags: deps.t("doc.tags", lang),
          taggedWith: deps.t("doc.taggedWith", lang),
        }}
      />
    );
  };
}
