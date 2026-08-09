/**
 * The metadata row (a3's `.metabar`): Title, Description, Position.
 *
 * These three fields are the reason the editor buffer never contains a
 * frontmatter block. Title and description ARE frontmatter — they round-trip
 * through the page save machine's debounced autosave like any other page
 * edit — while Position is outline structure, so it dispatches a `move-page`
 * command through the revision coordinator instead. Editing the same three
 * values as YAML text in the buffer would have given the app two sources of
 * truth for one fact (epic #3327 contract 1).
 *
 * Two shapes of the API leak into this component on purpose, because
 * pretending otherwise would produce guaranteed round trips to a 400:
 *
 * - The server's frontmatter schema is `title: z.string().min(1)`, so a blank
 *   title is never committed; the field marks itself invalid and reverts on
 *   blur rather than sending a write that cannot succeed.
 * - `description` is `.min(1).optional()`, so an emptied description drops the
 *   key entirely instead of sending `""`.
 *
 * Every input runs the IME triple guard (`ime.ts`) on Enter and Escape, and
 * defers its commit until `compositionend`, so a Japanese candidate window is
 * never mistaken for a submit and half-composed romaji is never autosaved.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import type { PageFrontmatter } from "../../store/index";
import { isImeKeyEvent, useCompositionGuard } from "./ime";
import { pagePath, type EditorTreePage } from "./page-index";

const FIELD_LABEL_CLASSES =
  "flex-none text-caption font-semibold uppercase tracking-(--zdo-label-tracking) text-muted";

const INPUT_CLASSES =
  "min-w-[0px] rounded-sm border border-border bg-surface px-hsp-sm py-vsp-2xs text-small text-fg hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 aria-[invalid=true]:border-danger";

export interface MetadataRowProps {
  page: EditorTreePage;
  frontmatter: PageFrontmatter;
  onFrontmatterChange: (next: PageFrontmatter) => void;
  onPositionCommit: (position: number) => void;
  disabled?: boolean;
}

export function MetadataRow({
  page,
  frontmatter,
  onFrontmatterChange,
  onPositionCommit,
  disabled = false,
}: MetadataRowProps) {
  return (
    <div className="flex flex-none items-center gap-hsp-lg border-b border-border bg-bg px-hsp-lg py-vsp-xs">
      <InlineTextField
        id="zdo-meta-title"
        label="Title"
        value={frontmatter.title}
        required
        disabled={disabled}
        onCommit={(title) =>
          onFrontmatterChange(withFrontmatterField(frontmatter, "title", title))
        }
      />

      <InlineTextField
        id="zdo-meta-description"
        label="Description"
        value={frontmatter.description ?? ""}
        grow
        disabled={disabled}
        onCommit={(description) =>
          onFrontmatterChange(
            withFrontmatterField(frontmatter, "description", description),
          )
        }
      />

      <InlineTextField
        id="zdo-meta-position"
        label="Position"
        value={String(page.position)}
        numeric
        disabled={disabled}
        describedBy="zdo-meta-position-range"
        onCommit={(raw) => {
          const parsed = Number.parseInt(raw, 10);
          if (Number.isNaN(parsed)) return false;
          onPositionCommit(parsed);
          return true;
        }}
      />
      <span id="zdo-meta-position-range" className="sr-only">
        {`1 to ${page.categorySize} within ${page.categorySlug}`}
      </span>

      <span className="flex-none truncate font-mono text-caption text-muted">
        {pagePath(page)}
      </span>
    </div>
  );
}

/**
 * `title` may not be blank and `description` may not be `""` — see the module
 * comment. Returning a fresh object (never a mutation) is what lets the save
 * machine's atomic-capture autosave stay correct.
 */
export function withFrontmatterField(
  frontmatter: PageFrontmatter,
  field: "title" | "description",
  value: string,
): PageFrontmatter {
  const next: PageFrontmatter = { ...frontmatter };
  if (field === "title") {
    next.title = value;
    return next;
  }
  if (value === "") delete next.description;
  else next.description = value;
  return next;
}

interface InlineTextFieldProps {
  id: string;
  label: string;
  value: string;
  /** Blank is rejected (never committed) rather than sent to a `.min(1)` field. */
  required?: boolean;
  numeric?: boolean;
  grow?: boolean;
  disabled?: boolean;
  describedBy?: string;
  /** Return `false` to reject the value and keep the field marked invalid. */
  onCommit: (value: string) => void | boolean;
}

function InlineTextField({
  id,
  label,
  value,
  required = false,
  numeric = false,
  grow = false,
  disabled = false,
  describedBy,
  onCommit,
}: InlineTextFieldProps) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const focused = useRef(false);
  // Enter commits and then blurs; without this the blur handler would commit
  // the same value a second time — harmless for text, a duplicate `move-page`
  // dispatch for the Position field.
  const committedByKey = useRef(false);

  const isComposing = useCompositionGuard(inputRef, (next) => {
    setDraft(next);
    // Same rule as `onInput`: the Position field commits on Enter/blur only,
    // so finishing a composition inside it must not move the page.
    if (!numeric) commit(next);
  });

  // Adopt an external change (tab switch, a remote edit the machine adopted)
  // only while the field is idle — overwriting what someone is mid-way
  // through typing is exactly the bug autosave UIs are notorious for.
  useEffect(() => {
    if (focused.current || isComposing()) return;
    setDraft(value);
    setInvalid(false);
    // `isComposing` reads a ref, so it is deliberately not a dependency.
  }, [value]);

  function commit(next: string): void {
    if (required && next.trim() === "") {
      setInvalid(true);
      return;
    }
    const accepted = onCommit(next);
    setInvalid(accepted === false);
  }

  return (
    <div className={`flex items-center gap-hsp-sm ${grow ? "flex-1" : "flex-none"} min-w-[0px]`}>
      <label htmlFor={id} className={FIELD_LABEL_CLASSES}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        disabled={disabled}
        value={draft}
        aria-invalid={invalid}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        {...(numeric ? { inputMode: "numeric" as const } : {})}
        className={`${INPUT_CLASSES} ${grow ? "flex-1" : ""} ${
          numeric ? "w-(--zdo-position-field) text-center font-mono tabular-nums" : ""
        }`}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={(event) => {
          focused.current = false;
          if (committedByKey.current) {
            committedByKey.current = false;
            return;
          }
          const next = event.currentTarget.value;
          if (required && next.trim() === "") {
            setDraft(value);
            setInvalid(false);
            return;
          }
          commit(next);
        }}
        onInput={(event) => {
          const next = event.currentTarget.value;
          setDraft(next);
          // A commit mid-composition would autosave half-formed romaji;
          // `compositionend` above flushes the finished candidate instead.
          if (isComposing()) return;
          // The position field is a discrete structural command, not a
          // debounced text write — it commits on Enter/blur only.
          if (numeric) return;
          commit(next);
        }}
        onKeyDown={(event) => {
          if (isImeKeyEvent(event, isComposing())) return;
          if (event.key === "Enter") {
            event.preventDefault();
            committedByKey.current = true;
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            committedByKey.current = true;
            setDraft(value);
            setInvalid(false);
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
