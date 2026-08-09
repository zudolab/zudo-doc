/**
 * The editor | preview split, and the one layout invariant the CodeMirror
 * sub-issue (#3336) depends on.
 *
 * THE FLEX CHAIN IS LOAD-BEARING. Every ancestor from the workspace root down
 * to the editor host sets `min-height: 0` (and `min-width: 0` across), because
 * a flex item's default `min-height: auto` refuses to shrink below its content
 * — which in a full-height app means the chain silently stops resolving to a
 * pixel height. An embedded editor asking for `height: 100%` against a chain
 * with one link missing collapses to 0px, and the symptom (an invisible
 * editor, no error anywhere) is nearly impossible to trace back here. The
 * `inset: 0` wrapper is the second half of the same guarantee: it gives the
 * editor a box whose size comes purely from the positioned parent, so the
 * editor's own content can never feed back into the layout and push the pane
 * open.
 *
 * WHY THE ARBITRARY-VALUE FORM (`min-h-[0]`, `min-w-[0]`, `inset-[0]`) rather
 * than the plain `min-h-0` / `inset-0` utilities: this app loads Tailwind in
 * "approach B" (preflight + utilities, no default theme — see the
 * design-system skill), so the bare `--spacing` multiplier every numeric
 * spacing utility computes from is never defined, and Tailwind emits NO RULE
 * AT ALL for `min-h-0`, `min-w-0`, `inset-0` or `left-0`. Confirmed against
 * this package's own `vite build` output: the classes are simply absent from
 * the stylesheet, so the chain above would be silently inert. The bracket
 * form compiles to the exact same declarations without consulting the
 * spacing scale. Once `tokens.css` defines `--spacing`, these can go back to
 * the plain utilities — nothing else about the layout changes.
 *
 * The divider is a real `role="separator"` with `aria-valuenow/min/max` and
 * keyboard resizing (`rail-state.ts` owns the arithmetic), so the split is
 * operable without a pointer — a drag handle that is mouse-only is a
 * keyboard user's dead end.
 */

import { useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import {
  MAX_SPLIT_PERCENT,
  MIN_SPLIT_PERCENT,
  splitPercentForKey,
  splitPercentFromPointer,
} from "./rail-state";

export interface EditorSplitProps {
  /** Percent of the width given to the editor pane. */
  percent: number;
  /** Fired continuously while dragging or on each key press. */
  onPercentChange: (percent: number) => void;
  /** Fired once a gesture ends — the point at which the value is persisted. */
  onPercentCommit: (percent: number) => void;
  editorHeader: ComponentChildren;
  editor: ComponentChildren;
  previewHeader: ComponentChildren;
  preview: ComponentChildren;
}

export function EditorSplit({
  percent,
  onPercentChange,
  onPercentCommit,
  editorHeader,
  editor,
  previewHeader,
  preview,
}: EditorSplitProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  function percentAt(clientX: number): number | null {
    const track = trackRef.current;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    return splitPercentFromPointer(clientX, { left: rect.left, width: rect.width });
  }

  return (
    <div ref={trackRef} className="flex min-h-[0] min-w-[0] flex-1">
      <section
        aria-label="Markdown editor"
        className="flex min-h-[0] min-w-[0] flex-none flex-col bg-bg"
        style={{ flexBasis: `${percent}%` }}
      >
        <PaneHead>{editorHeader}</PaneHead>
        <div className="relative min-h-[0] flex-1">
          <div className="absolute inset-[0]">{editor}</div>
        </div>
      </section>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the editor and preview panes"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={MIN_SPLIT_PERCENT}
        aria-valuemax={MAX_SPLIT_PERCENT}
        tabIndex={0}
        className="group relative w-(--zdo-split-divider) flex-none cursor-col-resize border-x border-border bg-surface focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2"
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return;
          const next = percentAt(event.clientX);
          if (next !== null) onPercentChange(next);
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return;
          dragging.current = false;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          const next = percentAt(event.clientX);
          onPercentCommit(next ?? percent);
        }}
        onKeyDown={(event) => {
          const next = splitPercentForKey(percent, event.key);
          if (next === null) return;
          event.preventDefault();
          onPercentChange(next);
          onPercentCommit(next);
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-(--zdo-split-grip) w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong group-hover:bg-accent"
        />
      </div>

      <section
        aria-label="Preview"
        className="flex min-h-[0] min-w-[0] flex-1 flex-col bg-surface"
      >
        <PaneHead>{previewHeader}</PaneHead>
        {preview}
      </section>
    </div>
  );
}

function PaneHead({ children }: { children: ComponentChildren }) {
  return (
    <div className="flex flex-none items-center gap-hsp-sm border-b border-border px-hsp-lg py-vsp-2xs text-caption text-muted">
      {children}
    </div>
  );
}
