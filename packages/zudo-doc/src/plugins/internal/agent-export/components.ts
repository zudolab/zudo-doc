import { isCanonicalDocSlug } from "../../../doc-card-nav/slug.js";
import {
  ADMONITION_COMPONENTS,
  admonitionComponentName,
  DETAILS_COMPONENT,
  TAB_GROUP_COMPONENTS,
  TAB_ITEM_COMPONENT,
} from "../../../mdx-components/vocabulary.js";
import type { MdDocFrontmatter } from "../../../md-utils/index.js";
import { findContainingNoteTray, findNoteTray, getNoteTrayItems } from "../../../note-tray-model/index.js";
import { buildSidebarTree, findSidebarNode } from "../../../sidebar-tree/build-tree.js";
import type { CategoryMeta, SidebarFrontmatter, SidebarNode } from "../../../sidebar-tree/types.js";
import type { AgentComponentRenderer, AgentComponentTag } from "./normalize.js";

/** One locale's docs as the export sees them, before export exclusions. */
export interface AgentNavLocale {
  locale: string;
  /** Every parsed file of the locale: `slug` is the filesystem route slug. */
  entries: Array<{ slug: string; data: MdDocFrontmatter }>;
  categoryMeta?: Map<string, CategoryMeta>;
  /** Effective route slug → published page URL, for documents in the export only. */
  published: Map<string, { url: string; title: string; description?: string }>;
  siteTreeNavIgnore?: readonly string[];
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

function wrapperLabel(kind: string, title: unknown, props: AgentComponentTag["props"]): { text: string; unsupported?: boolean } {
  if (props === undefined || (title !== undefined && typeof title !== "string")) return { text: `**${kind}**`, unsupported: true };
  return { text: title ? `**${kind}: ${title}**` : `**${kind}**` };
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

  const publish = (nodes: SidebarNode[]): PublishedNode[] => nodes.flatMap((node): PublishedNode[] => {
    const children = publish(node.children);
    const page = source.published.get(node.id);
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
  const published = publish(tree);
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
        const ignore = new Set(source.siteTreeNavIgnore ?? []);
        return list(nestedList(published.filter((node) => !ignore.has(node.slug)), props.variant === "described"));
      }
      case "NoteTrayIndex": {
        if (props.category !== undefined && typeof props.category !== "string") return undefined;
        const tray = typeof props.category === "string" ? findNoteTray(published, props.category) : findContainingNoteTray(published, currentSlug);
        if (!tray) return "";
        return list(getNoteTrayItems(tray).filter((item) => item.url !== undefined).map((item) =>
          line(item, 0, true, props.showDate === true && item.date ? ` (${item.date})` : "")));
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
    if (variant) return wrapperLabel(admonitionComponentName(variant), tag.props?.title, tag.props);
    if (tag.name === DETAILS_COMPONENT) return wrapperLabel(DETAILS_COMPONENT, tag.props?.title, tag.props);
    if (tag.name === TAB_ITEM_COMPONENT) return wrapperLabel("Tab", tag.props?.label, tag.props);
    if ((TAB_GROUP_COMPONENTS as readonly string[]).includes(tag.name)) return { text: "" };
    if (!tag.props) return undefined;
    const text = nav(tag.name, tag.props, currentSlug);
    return text === undefined ? undefined : { text };
  };
}
