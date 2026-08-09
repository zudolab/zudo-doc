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
 * WHY `min-h-[0px]` / `min-w-[0px]` AND NOT `min-h-0` / `min-w-0`: Tailwind
 * refuses to generate a rule for a UNITLESS arbitrary length on these two
 * properties — `min-h-[0]` and `min-w-[0]` produce no CSS at all, silently, so
 * the chain above reads as present in the source while being entirely inert in
 * the browser. (`inset-[0]` and `left-[0]` do compile, which is exactly what
 * makes the trap convincing: the same bracket form works for some properties
 * and not others.) The `[0px]` spelling is the one verified to emit
 * `min-height: 0` in this package's built stylesheet, and it is what the
 * outline surface uses too.
 *
 * Do not "simplify" these to the bare utilities without re-running
 * `pnpm --filter zudo-doc-online build` and grepping the emitted CSS for the
 * escaped selector. This whole comment exists because a hand-rolled regex
 * once reported `min-h-[0]` as present when it was not.
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
    <div ref={trackRef} className="flex min-h-[0px] min-w-[0px] flex-1">
      <section
        aria-label="Markdown editor"
        className="flex min-h-[0px] min-w-[0px] flex-none flex-col bg-bg"
        style={{ flexBasis: `${percent}%` }}
      >
        <PaneHead>{editorHeader}</PaneHead>
        <div className="relative min-h-[0px] flex-1">
          <div className="absolute inset-[0px]">{editor}</div>
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
        className="flex min-h-[0px] min-w-[0px] flex-1 flex-col bg-surface"
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
