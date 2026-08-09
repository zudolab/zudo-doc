/**
 * The save chip's vocabulary — one honest label per state the save machine
 * can actually be in.
 *
 * "Honest" is the whole point of this module (epic #3327 sub-issue #3334): the
 * chip never says "Saved" while a request is in flight, never says "Saved" for
 * a page that has simply not been touched, and never hides a conflict behind a
 * reassuring color. `idle` therefore reads "No unsaved changes" rather than
 * "Saved", and `saved` — the transient post-commit state the machine leaves
 * via `acknowledgeSaved()` — is the ONLY state allowed to claim a save just
 * happened.
 *
 * `remoteChanged` outranks `dirty` because it changes what the user should do
 * next (resolve, not keep typing), but loses to `conflict`/`error`, which are
 * the states that already carry a resolution UI.
 */

import type { SaveMachineSnapshot, SaveMachineStatus } from "../../store/index";

export type SaveTone = "neutral" | "warning" | "success" | "danger";

export type SaveChipState =
  | "loading"
  | "conflict"
  | "error"
  | "saving"
  | "remote"
  | "dirty"
  | "saved"
  | "idle";

export interface SaveStatusDescriptor {
  state: SaveChipState;
  label: string;
  tone: SaveTone;
}

const LOADING: SaveStatusDescriptor = {
  state: "loading",
  label: "Loading…",
  tone: "neutral",
};

export function describeSaveStatus(
  snapshot: SaveMachineSnapshot | undefined,
): SaveStatusDescriptor {
  if (!snapshot) return LOADING;

  switch (snapshot.status) {
    case "conflict":
      return { state: "conflict", label: "Conflict", tone: "danger" };
    case "error":
      return { state: "error", label: "Save failed", tone: "danger" };
    case "saving":
      return { state: "saving", label: "Saving…", tone: "neutral" };
    default:
      break;
  }

  if (snapshot.remoteChanged) {
    return { state: "remote", label: "Changed elsewhere", tone: "warning" };
  }

  switch (snapshot.status) {
    case "dirty":
      return { state: "dirty", label: "Edited", tone: "warning" };
    case "saved":
      return { state: "saved", label: "Saved", tone: "success" };
    default:
      return { state: "idle", label: "No unsaved changes", tone: "neutral" };
  }
}

/** Drives the tab's dirty dot: anything the user could still lose. */
export function isDirtySave(status: SaveMachineStatus | undefined): boolean {
  return (
    status === "dirty" || status === "saving" || status === "error" || status === "conflict"
  );
}

/**
 * Whether the machine is in a state the user must resolve by hand. The
 * workspace renders its banner (retry / discard) exactly when this is true —
 * epic #3327 contract 2 forbids resolving either one automatically.
 */
export function needsResolution(snapshot: SaveMachineSnapshot | undefined): boolean {
  return snapshot?.status === "conflict" || snapshot?.status === "error";
}
