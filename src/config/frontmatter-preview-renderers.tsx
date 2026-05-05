import type { ReactNode } from "react";
import type { FrontmatterCellRenderer, FrontmatterCellRendererProps } from "@zudo-doc/zudo-doc-v2/metainfo";

/**
 * Props passed to every custom frontmatter renderer component.
 *
 * Lookup rule: `frontmatterRenderers[key]` is checked after the ignore-list
 * filter and after null/undefined skipping, so renderers only receive defined
 * values and are never invoked for ignored keys.
 *
 * Ignore-list precedence: if a key appears in `settings.frontmatterPreview.ignoreKeys`
 * (or the default ignore list), the row is suppressed entirely — even if a renderer
 * is registered for that key. To reveal a framework-managed key with a custom
 * renderer, first remove the key from the ignore list in settings.
 *
 * Fallback behavior: if no renderer is registered for a key, the built-in
 * `renderValue()` path is used (string/number/boolean as text, other types as
 * JSON in a `<code>` element).
 *
 * Null/undefined skipping: values of `null` or `undefined` are filtered out
 * before renderer lookup. Renderers can assume `value` is defined.
 */
// Re-export the canonical props type from the package so project code has a
// single import path. The locale field is typed as string (the package uses
// string rather than the project-specific Locale union to avoid a circular
// dependency); the runtime values are identical.
export type { FrontmatterCellRendererProps as FrontmatterRendererProps };

type PillColor = "danger" | "success" | "warning" | "info" | "muted";

const pillColorClass: Record<PillColor, string> = {
  danger: "bg-danger text-fg",
  success: "bg-success text-fg",
  warning: "bg-warning text-fg",
  info: "bg-info text-fg",
  muted: "bg-surface text-muted border border-muted",
};

function Pill({ children, color }: { children: ReactNode; color: PillColor }) {
  return (
    <span
      className={`inline-block px-hsp-sm py-vsp-2xs text-caption rounded-full ${pillColorClass[color]}`}
    >
      {children}
    </span>
  );
}

/**
 * Per-key custom renderer map for the frontmatter-preview component.
 *
 * Add entries here to override how specific frontmatter fields are displayed.
 * Keys must match frontmatter field names exactly (case-sensitive).
 *
 * Example (add a renderer for a `discount` field):
 * ```tsx
 * discount: ({ value }) => <strong>{String(value)}</strong>,
 * ```
 */
export const frontmatterRenderers: Record<string, FrontmatterCellRenderer> = {
  discount: ({ value }) => {
    if (value !== true) return null;
    return <Pill color="danger">ON SALE</Pill>;
  },

  status: ({ value }) => {
    if (typeof value !== "string") return <span>{String(value)}</span>;
    if (value === "stable") return <Pill color="success">{value}</Pill>;
    if (value === "beta") return <Pill color="warning">{value}</Pill>;
    if (value === "draft") return <Pill color="muted">{value}</Pill>;
    return <span>{value}</span>;
  },

  difficulty: ({ value }) => {
    if (typeof value !== "string") return <span>{String(value)}</span>;
    if (value === "beginner") return <Pill color="success">{value}</Pill>;
    if (value === "intermediate") return <Pill color="info">{value}</Pill>;
    if (value === "advanced") return <Pill color="warning">{value}</Pill>;
    return <span>{value}</span>;
  },
};
