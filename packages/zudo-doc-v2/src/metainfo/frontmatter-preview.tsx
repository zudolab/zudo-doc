/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentChildren, VNode } from "preact";

/**
 * Props passed to a per-key custom renderer component.
 *
 * The caller is responsible for filtering entries and skipping ignored keys
 * before invoking `FrontmatterPreview`. Renderers are therefore guaranteed
 * to receive only non-null, non-ignored values.
 */
export interface FrontmatterCellRendererProps {
  /** The frontmatter value (null/undefined values are never passed). */
  value: NonNullable<unknown>;
  /** The frontmatter key name. */
  entryKey: string;
  /** Full frontmatter of the current page — for cross-field dependencies. */
  data: Record<string, unknown>;
  /** Active locale string — forwarded from the page context. */
  locale?: string;
}

/**
 * A custom renderer for a single frontmatter value cell.
 *
 * Return `null` or `undefined` to fall through to the built-in
 * `renderValue()` plain-text path.
 */
export type FrontmatterCellRenderer = (
  props: FrontmatterCellRendererProps,
) => ComponentChildren;

export interface FrontmatterPreviewProps {
  /**
   * Pre-filtered `[key, value]` pairs to display. The legacy component
   * owned the filtering logic (ignore-keys, null/undefined removal,
   * `settings.frontmatterPreview` gating, `frontmatterRenderers`
   * dispatch). v2 delegates all of that to the caller and accepts only
   * the final entries to render.
   *
   * Pass an empty array (or omit) to suppress rendering.
   */
  entries?: Array<[string, unknown]>;
  /**
   * Section heading above the table. Defaults to `"Frontmatter"`.
   * Pass the i18n-resolved `t("frontmatter.preview.title", locale)`
   * string from upstream.
   */
  title?: string;
  /**
   * Column header for the key column. Defaults to `"Key"`.
   */
  keyColLabel?: string;
  /**
   * Column header for the value column. Defaults to `"Value"`.
   */
  valueColLabel?: string;
  /**
   * Optional per-key custom renderer map. When a renderer is registered for
   * a key, its return value replaces the built-in plain-text cell. A
   * renderer that returns `null` or `undefined` falls through to the
   * built-in path.
   *
   * Keyed by frontmatter field name (case-sensitive). The caller is
   * responsible for ensuring the map does not contain entries for
   * ignored keys (ignored keys are never in `entries`, so their
   * renderers are never called anyway).
   */
  renderers?: Record<string, FrontmatterCellRenderer>;
  /**
   * Full frontmatter data of the current page. Forwarded to each renderer
   * via `FrontmatterCellRendererProps.data` so renderers can read
   * cross-field context. Defaults to `{}`.
   */
  data?: Record<string, unknown>;
  /**
   * Active locale string. Forwarded to each renderer via
   * `FrontmatterCellRendererProps.locale`.
   */
  locale?: string;
}

export const DEFAULT_FRONTMATTER_PREVIEW_TITLE = "Frontmatter";
export const DEFAULT_KEY_COL_LABEL = "Key";
export const DEFAULT_VALUE_COL_LABEL = "Value";

/**
 * Render a scalar/array value as a plain string suitable for display.
 *
 * - Strings, numbers, booleans → string representation
 * - String arrays → comma-joined
 * - Anything else → JSON.stringify (displayed in a `<code>` block)
 *
 * The legacy `frontmatter-preview.astro` additionally ran
 * `smartBreakToHtml` on strings and delegated to per-key
 * `frontmatterRenderers`. v2 keeps only the simple text path so the
 * component has no upward dependency on project utilities.
 */
function renderValue(v: unknown): { text?: string; code?: string } {
  if (typeof v === "string") return { text: v };
  if (typeof v === "number") return { text: String(v) };
  if (typeof v === "boolean") return { text: v ? "true" : "false" };
  if (Array.isArray(v) && v.every((item) => typeof item === "string")) {
    return { text: (v as string[]).join(", ") };
  }
  return { code: JSON.stringify(v) };
}

/**
 * Frontmatter data table — JSX port of
 * `src/components/frontmatter-preview.astro`.
 *
 * Returns `null` when `entries` is empty, mirroring the original
 * `entries.length > 0` guard.
 *
 * When `renderers` is provided, each entry's value cell is first offered to
 * the matching renderer. A renderer that returns `null` or `undefined` falls
 * through to the built-in `renderValue()` plain-text path.
 */
export function FrontmatterPreview(
  props: FrontmatterPreviewProps,
): VNode | null {
  const {
    entries = [],
    title = DEFAULT_FRONTMATTER_PREVIEW_TITLE,
    keyColLabel = DEFAULT_KEY_COL_LABEL,
    valueColLabel = DEFAULT_VALUE_COL_LABEL,
    renderers,
    data = {},
    locale,
  } = props;

  if (entries.length === 0) return null;

  return (
    <div data-testid="frontmatter-preview" class="my-vsp-lg">
      <p class="text-caption text-muted mb-vsp-2xs">{title}</p>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-caption">
          <thead>
            <tr>
              <th class="text-left font-semibold px-hsp-md py-vsp-2xs border-b-2 border-muted text-fg">
                {keyColLabel}
              </th>
              <th class="text-left font-semibold px-hsp-md py-vsp-2xs border-b-2 border-muted text-fg">
                {valueColLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, value]) => {
              // Try custom renderer first; fall through to plain text on null/undefined return.
              const rendererFn = renderers?.[key];
              const customCell =
                rendererFn != null && value != null
                  ? rendererFn({
                      value: value as NonNullable<unknown>,
                      entryKey: key,
                      data,
                      locale,
                    })
                  : undefined;

              const useCustom =
                customCell !== null && customCell !== undefined;

              const rendered = useCustom ? null : renderValue(value);

              return (
                <tr key={key} class="border-b border-muted">
                  <td class="px-hsp-md py-vsp-2xs text-muted font-mono align-top">
                    {key}
                  </td>
                  <td class="px-hsp-md py-vsp-2xs text-fg break-words align-top">
                    {useCustom ? (
                      customCell
                    ) : rendered!.code !== undefined ? (
                      <code class="bg-code-bg text-code-fg px-hsp-xs py-0 rounded text-micro font-mono">
                        {rendered!.code}
                      </code>
                    ) : (
                      rendered!.text
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
