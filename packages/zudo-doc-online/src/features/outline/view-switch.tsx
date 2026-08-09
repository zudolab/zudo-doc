/**
 * The segmented `[ Outline | Board ]` control in the surface header.
 *
 * Both entries are always selectable — picking Board before the board view
 * (#3337) exists mounts a labeled placeholder rather than disabling the
 * option, so the switch and its persistence can be exercised (and reviewed)
 * before the view behind it lands.
 *
 * `aria-pressed` rather than a tablist: these buttons swap the whole surface
 * for a different editor, not a panel within one, and a two-state toggle pair
 * is what assistive tech reads most predictably here.
 */

import type { OutlineViewMode } from "./view-preference.js";

export interface ViewSwitchProps {
  value: OutlineViewMode;
  onChange(next: OutlineViewMode): void;
}

const OPTIONS: ReadonlyArray<{ mode: OutlineViewMode; label: string }> = [
  { mode: "outline", label: "Outline" },
  { mode: "board", label: "Board" },
];

export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  return (
    <div
      role="group"
      aria-label="Outline view"
      className="inline-flex items-center gap-hsp-2xs rounded-md bg-surface-2 p-hsp-2xs"
    >
      {OPTIONS.map((option) => {
        const active = option.mode === value;
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.mode)}
            className={`rounded-sm px-hsp-md py-vsp-2xs text-caption focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
              active
                ? "bg-bg font-semibold text-fg shadow-1"
                : "text-muted hover:text-fg"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
