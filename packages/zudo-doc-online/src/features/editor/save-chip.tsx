/**
 * The status bar's save chip (a3's `.save-chip`).
 *
 * `role="status"` rather than `role="alert"`: the label changes on every
 * keystroke's debounce cycle, and an assertive live region would interrupt a
 * screen-reader user mid-sentence for "Edited". The states that genuinely
 * demand attention — conflict and error — get the banner in `workspace.tsx`,
 * which is where the resolution controls live.
 *
 * `save-status.ts` owns the wording; this file owns only the colour, so the
 * two can never disagree about what a state means.
 */

import type { SaveStatusDescriptor, SaveTone } from "./save-status";

const TONE_CLASSES: Record<SaveTone, string> = {
  neutral: "bg-(--zdo-wash-hover) text-muted",
  warning: "bg-(--zdo-wash-warning) text-warning",
  success: "bg-(--zdo-wash-success) text-success",
  danger: "bg-(--zdo-wash-danger) text-danger",
};

const DOT_CLASSES: Record<SaveTone, string> = {
  neutral: "bg-muted",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
};

export interface SaveChipProps {
  descriptor: SaveStatusDescriptor;
}

export function SaveChip({ descriptor }: SaveChipProps) {
  return (
    <span
      role="status"
      data-save-state={descriptor.state}
      className={`inline-flex flex-none items-center gap-hsp-xs rounded-full px-hsp-sm text-caption font-semibold ${
        TONE_CLASSES[descriptor.tone]
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-(--zdo-dot) flex-none rounded-full ${DOT_CLASSES[descriptor.tone]}`}
      />
      {descriptor.label}
    </span>
  );
}
