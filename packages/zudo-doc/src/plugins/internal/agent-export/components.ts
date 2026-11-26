import { isCanonicalDocSlug } from "../../../doc-card-nav/slug.js";
import { assertValidCategoryListOptions, resolveCategoryList, resolveCategoryListLead, type CategoryListLead, type CategoryListNode, type CategoryListScope } from "../../../category-list/model.js";
import {
  ADMONITION_COMPONENTS,
  admonitionComponentName,
  DETAILS_COMPONENT,
  TAB_GROUP_COMPONENTS,
  TAB_ITEM_COMPONENT,
} from "../../../mdx-components/vocabulary.js";
import type { MdDocFrontmatter } from "../../../md-utils/index.js";
import { orderSiteTreeNavRoots } from "../../../nav-scope/index.js";
import { findContainingNoteTray, findNoteTray, getNoteTrayItems } from "../../../note-tray-model/index.js";
import { buildSidebarTree, findSidebarNode } from "../../../sidebar-tree/build-tree.js";
import type { CategoryMeta, SidebarFrontmatter, SidebarNode } from "../../../sidebar-tree/types.js";
import { groupSatelliteNodes } from "../../../site-schema/nav-tree.js";
import { wrapperLabel, type AgentComponentRenderer, type AgentComponentTag } from "./normalize.js";

interface PublishedPage {
  url: string;
  title: string;
  description?: string;
}

/** One locale's docs as the export sees them, before export exclusions. */
export interface AgentNavLocale {
  locale: string;
  /** Every parsed file of the locale: `slug` is the filesystem route slug. */
  entries: Array<{ slug: string; data: MdDocFrontmatter }>;
  categoryMeta?: Map<string, CategoryMeta>;
  /** Effective route slug → published page URL, for documents in the export only. */
  published: Map<string, PublishedPage>;
  siteTreeNavIgnore?: readonly string[];
  siteTreeNavCategoryOrder?: readonly string[];
  getSiteTreeNavPage?: (slug: string) => PublishedPage | undefined;
}

/** A nav node reduced to published documents; `url` is absent for an unlinked group header. */
interface PublishedNode {
  slug: string;
  label: string;
  description?: string;
  url?: string;
  date?: string;
  shape?: "note-tray";
  hasPage: boolean;
  children: PublishedNode[];
}

const isoDate = (value: unknown): unknown => value instanceof Date ? value.toISOString().slice(0, 10) : value;

/** Escape characters that would end a Markdown link label early. */
const linkLabel = (label: string): string => label.replace(/[\\[\]]/g, (ch) => `\\${ch}`);

function line(node: { label: string; url?: string; description?: string }, depth: number, withDescription: boolean, suffix = ""): string {
  const label = node.url === undefined ? node.label : `[${linkLabel(node.label)}](${node.url})`;
  const description = withDescription && node.description ? `: ${node.description}` : "";
  return `${"  ".repeat(depth)}- ${label}${suffix}${description}`;
}

function nestedList(nodes: PublishedNode[], withDescription: boolean, depth = 0): string[] {
  return nodes.flatMap((node) => [line(node, depth, withDescription), ...nestedList(node.children, withDescription, depth + 1)]);
}

const asString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;

function renderWrapperLabel(kind: string, title: unknown, props: AgentComponentTag["props"]): { text: string; unsupported?: boolean } {
  if (props === undefined || (title !== undefined && typeof title !== "string")) {
    return { text: wrapperLabel(kind, undefined), unsupported: true };
  }
  return { text: wrapperLabel(kind, title) };
}

/**
 * Build the per-locale renderer for content wrappers and navigation tags. Nav
 * output lists only documents in the published export, so draft, unlisted and
 * search-excluded pages never appear; a group whose own page is excluded is
 * dissolved and its published descendants move up a level.
 */
export function createAgentComponentRenderer(source: AgentNavLocale): (currentSlug: string) => AgentComponentRenderer {
  const entries = source.entries.map(({ slug, data }) => ({
    slug,
    data: { ...data, date: isoDate(data.date), updated: isoDate(data.updated) } as unknown as SidebarFrontmatter,
  }));
  const hidden = new Set(entries
    .filter(({ data }) => (data as MdDocFrontmatter).search_exclude)
    .map(({ slug, data }) => data.slug ?? slug));
  const tree = buildSidebarTree(entries, source.locale, {
    ...(source.categoryMeta ? { categoryMeta: source.categoryMeta } : {}),
    buildHref: (slug) => slug,
    isNavVisible: ({ data }) => !data.draft && !data.unlisted && !data.standalone,
  });

  const publish = (nodes: SidebarNode[], getPage: (slug: string) => PublishedPage | undefined): PublishedNode[] => nodes.flatMap((node): PublishedNode[] => {
    const children = publish(node.children, getPage);
    const page = getPage(node.id);
    if (!page && (hidden.has(node.id) || children.length === 0)) return children;
    return [{
      slug: node.id,
      label: node.label,
      ...(node.description !== undefined ? { description: node.description } : {}),
      ...(page ? { url: page.url } : {}),
      ...(node.date !== undefined ? { date: node.date } : {}),
      ...(node.shape !== undefined ? { shape: node.shape } : {}),
      hasPage: page !== undefined,
      children,
    }];
  });
  const published = publish(tree, (slug) => source.published.get(slug));
  const siteTreePages = source.getSiteTreeNavPage ? publish(tree, source.getSiteTreeNavPage) : published;
  const siteTree = orderSiteTreeNavRoots(
    groupSatelliteNodes(siteTreePages, source.siteTreeNavCategoryOrder ?? []),
    source.siteTreeNavCategoryOrder,
    source.siteTreeNavIgnore,
  );
  const findPublished = (nodes: PublishedNode[], slug: string): PublishedNode | undefined => {
    for (const node of nodes) {
      if (node.slug === slug) return node;
      const found = findPublished(node.children, slug);
      if (found) return found;
    }
    return undefined;
  };
  const firstUrl = (node: PublishedNode): string | undefined =>
    node.url ?? node.children.map(firstUrl).find((url) => url !== undefined);
  const list = (lines: string[]): string => lines.join("\n");
  // CategoryList mirrors the HTML tree (no group dissolving); only pages in
  // the export are listable, so hidden pages drop out exactly as in the HTML.
  const toListNode = (node: SidebarNode): CategoryListNode => {
    const page = source.published.get(node.id);
    return {
      slug: node.id,
      label: node.label,
      ...(node.description !== undefined ? { description: node.description } : {}),
      ...(page ? { href: page.url } : {}),
      hasPage: page !== undefined && !hidden.has(node.id),
      ...(node.shape !== undefined ? { shape: node.shape } : {}),
      ...(node.noteTrayDated !== undefined ? { noteTrayDated: node.noteTrayDated } : {}),
      ...(node.date !== undefined ? { date: node.date } : {}),
      ...(node.updated !== undefined ? { updated: node.updated } : {}),
      ...(node.rank !== undefined ? { rank: node.rank } : {}),
      children: node.children.map(toListNode),
    };
  };
  const listTree = tree.map(toListNode);

  const nav = (name: string, props: NonNullable<AgentComponentTag["props"]>, currentSlug: string): string | undefined => {
    switch (name) {
      case "CategoryNav": {
        if (props.categories !== undefined) {
          if (!Array.isArray(props.categories) || !props.categories.every((slug) => typeof slug === "string")) return undefined;
          return list((props.categories as string[]).flatMap((slug) => {
            const node = findSidebarNode(tree, slug);
            const target = findPublished(published, slug);
            const url = target && firstUrl(target);
            if (!node || hidden.has(slug) || url === undefined) return [];
            return [line({ label: node.label, url, ...(node.description !== undefined ? { description: node.description } : {}) }, 0, true)];
          }));
        }
        if (props.category === undefined) return "";
        const category = asString(props.category);
        if (category === undefined) return undefined;
        return list((findPublished(published, category)?.children ?? []).filter((node) => node.hasPage).map((node) => line(node, 0, true)));
      }
      case "CategoryTreeNav": {
        const category = asString(props.category);
        if (category === undefined) return undefined;
        return list(nestedList(findPublished(published, category)?.children ?? [], false));
      }
      case "SiteTreeNav":
      case "SiteTreeNavDemo": {
        if (props.variant !== undefined && props.variant !== "default" && props.variant !== "described") return undefined;
        return list(nestedList(siteTree, props.variant === "described"));
      }
      case "NoteTrayIndex": {
        if (props.category !== undefined && typeof props.category !== "string") return undefined;
        const tray = typeof props.category === "string" ? findNoteTray(published, props.category) : findContainingNoteTray(published, currentSlug);
        if (!tray) return "";
        return list(getNoteTrayItems(tray).filter((item) => item.url !== undefined).map((item) =>
          line(item, 0, true, props.showDate === true && item.date ? ` (${item.date})` : "")));
      }
      case "CategoryList": {
        // Same membership and limit as the HTML component; metadata is reduced
        // to title, description and (for dated items) the date.
        try {
          assertValidCategoryListOptions(props as Record<string, unknown>, "<CategoryList>", ["titleLevel"]);
        } catch {
          return undefined;
        }
        const indexIds = new Set(source.entries
          .filter(({ slug }) => slug === "index" || slug.endsWith("/index"))
          .map(({ slug, data }) => (data as MdDocFrontmatter).slug ?? slug.replace(/\/?index$/, "")));
        const resolution = resolveCategoryList(listTree, props.category as string, {
          ...(typeof props.scope === "string" ? { scope: props.scope as CategoryListScope } : {}),
          limit: props.limit as number,
          isCategoryIndex: (slug) => indexIds.has(slug) || !source.published.has(slug),
        });
        if (resolution.status !== "ok" || resolution.items.length === 0) return "";
        const lead = resolveCategoryListLead(
          typeof props.lead === "string" ? (props.lead as CategoryListLead) : "auto",
          resolution.category,
        );
        const withDescription = props.showDescription !== false;
        const width = resolution.rankWidth ?? 2;
        const lines = resolution.items.map((item) => {
          const rank = lead === "rank" && item.rank !== undefined ? `${String(item.rank).padStart(width, "0")}. ` : "";
          const date = item.date && (lead === "date" || props.showDate === true) ? ` (${item.date})` : "";
          return line({ label: `${rank}${item.title}`, url: item.href, ...(item.description ? { description: item.description } : {}) }, 0, withDescription, date);
        });
        if (props.showArchive !== false && resolution.category.href) {
          lines.push(line({ label: asString(props.archiveLabel)?.trim() || resolution.category.label, url: resolution.category.href }, 0, false));
        }
        return list(lines);
      }
      case "DocCardNav": {
        if (!Array.isArray(props.docs)) return undefined;
        const seen = new Set<string>();
        return list(props.docs.flatMap((slug) => {
          if (!isCanonicalDocSlug(slug) || seen.has(slug)) return [];
          seen.add(slug);
          const page = source.published.get(slug);
          return page ? [line({ label: page.title, url: page.url, ...(page.description ? { description: page.description } : {}) }, 0, true)] : [];
        }));
      }
      default:
        return undefined;
    }
  };

  return (currentSlug) => (tag) => {
    const variant = ADMONITION_COMPONENTS.get(tag.name);
    if (variant) return renderWrapperLabel(admonitionComponentName(variant), tag.props?.title, tag.props);
    if (tag.name === DETAILS_COMPONENT) return renderWrapperLabel(DETAILS_COMPONENT, tag.props?.title, tag.props);
    if (tag.name === TAB_ITEM_COMPONENT) return renderWrapperLabel("Tab", tag.props?.label, tag.props);
    if ((TAB_GROUP_COMPONENTS as readonly string[]).includes(tag.name)) return { text: "" };
    if (!tag.props) return undefined;
    const text = nav(tag.name, tag.props, currentSlug);
    return text === undefined ? undefined : { text };
  };
}
