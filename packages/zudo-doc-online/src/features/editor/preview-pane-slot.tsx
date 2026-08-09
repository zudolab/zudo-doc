/**
 * SLOT FILE — the preview sub-issue (#3338) replaces this file and nothing
 * else, and the pop-out window sub-issue (#3339) renders the same component
 * in its own window. Treat `PreviewPaneSlotProps` as the contract.
 *
 * What the chrome guarantees:
 *
 * - The host is a `min-height: 0` flex column, so a scrolling preview body works
 *   without any further layout work.
 * - `markdown` is the LIVE editor buffer (not the last saved document), so the
 *   preview can update while a save is still pending. It is the caller's job
 *   to debounce rendering if the renderer is expensive — the chrome does not.
 * - `title`/`path` come from the composed snapshot, never from a frontmatter
 *   block inside `markdown` (there is none — epic #3327 contract 1).
 *
 * The placeholder deliberately renders the buffer's shape (a few statistics
 * and the raw head of the document) rather than a fake rendering: showing
 * unstyled markdown as though it were the real preview would misrepresent
 * what this pane will eventually do.
 */

export interface PreviewPaneSlotProps {
  pageId: string;
  title: string;
  /** `category-slug/page-slug`, as the pane header shows it. */
  path: string;
  /** The live editor buffer — body only, no frontmatter. */
  markdown: string;
}

const PREVIEW_HEAD_LINES = 12;

export default function PreviewPaneSlot({ title, path, markdown }: PreviewPaneSlotProps) {
  const lines = markdown.split("\n");
  const head = lines.slice(0, PREVIEW_HEAD_LINES).join("\n");

  return (
    <div className="min-h-[0] flex-1 overflow-y-auto px-hsp-xl py-vsp-md">
      <div className="mx-auto flex max-w-(--zdo-preview-measure) flex-col gap-vsp-sm">
        <div className="rounded-md border border-border bg-(--zdo-wash-info) px-hsp-lg py-vsp-sm">
          <p className="text-small font-semibold text-info">Preview placeholder</p>
          <p className="mt-vsp-2xs text-small text-fg-mild">
            The rendered zudo-doc preview lands in sub-issue #3338. Until then this
            pane reports what the editor buffer currently holds.
          </p>
        </div>

        <dl className="grid gap-vsp-xs text-small">
          <div className="flex gap-hsp-sm">
            <dt className="flex-none text-muted">Title</dt>
            <dd className="truncate font-medium">{title}</dd>
          </div>
          <div className="flex gap-hsp-sm">
            <dt className="flex-none text-muted">Path</dt>
            <dd className="truncate font-mono text-caption text-fg-mild">{path}</dd>
          </div>
          <div className="flex gap-hsp-sm">
            <dt className="flex-none text-muted">Buffer</dt>
            <dd className="text-fg-mild">
              {`${lines.length} lines · ${markdown.length} characters`}
            </dd>
          </div>
        </dl>

        <pre className="overflow-x-auto rounded-md border border-border bg-code-bg px-hsp-lg py-vsp-sm font-mono text-caption leading-(--zdo-editor-leading) text-code-fg">
          {head}
          {lines.length > PREVIEW_HEAD_LINES ? "\n…" : ""}
        </pre>
      </div>
    </div>
  );
}
