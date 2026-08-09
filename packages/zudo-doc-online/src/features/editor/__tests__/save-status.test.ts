import { describe, expect, it } from "vitest";
import type { SaveMachineSnapshot, SaveMachineStatus } from "../../../store/index";
import { describeSaveStatus, isDirtySave, needsResolution } from "../save-status";

function snapshot(
  status: SaveMachineStatus,
  extra: Partial<SaveMachineSnapshot> = {},
): SaveMachineSnapshot {
  return {
    status,
    content: { frontmatter: { title: "Installation" }, markdown: "" },
    warnings: [],
    remoteChanged: false,
    ...extra,
  };
}

describe("describeSaveStatus", () => {
  it("reports loading before a session exists", () => {
    expect(describeSaveStatus(undefined)).toMatchObject({
      state: "loading",
      tone: "neutral",
    });
  });

  it("never claims a save happened for an untouched page", () => {
    const idle = describeSaveStatus(snapshot("idle"));
    expect(idle.state).toBe("idle");
    expect(idle.label).toBe("No unsaved changes");
    expect(describeSaveStatus(snapshot("saved")).label).toBe("Saved");
  });

  it("shows the in-flight and edited states honestly", () => {
    expect(describeSaveStatus(snapshot("dirty"))).toMatchObject({
      state: "dirty",
      tone: "warning",
    });
    expect(describeSaveStatus(snapshot("saving"))).toMatchObject({
      state: "saving",
      label: "Saving…",
    });
  });

  it("ranks conflict and error above a flagged remote change", () => {
    expect(
      describeSaveStatus(snapshot("conflict", { remoteChanged: true })).state,
    ).toBe("conflict");
    expect(describeSaveStatus(snapshot("error", { remoteChanged: true })).state).toBe(
      "error",
    );
  });

  it("surfaces a remote change that outranks a plain dirty draft", () => {
    expect(describeSaveStatus(snapshot("dirty", { remoteChanged: true }))).toMatchObject({
      state: "remote",
      label: "Changed elsewhere",
      tone: "warning",
    });
  });
});

describe("isDirtySave", () => {
  it("counts every state holding work the user could lose", () => {
    const dirtyStates: SaveMachineStatus[] = ["dirty", "saving", "error", "conflict"];
    expect(dirtyStates.map((status) => isDirtySave(status))).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("excludes settled states and an absent session", () => {
    expect(isDirtySave("idle")).toBe(false);
    expect(isDirtySave("saved")).toBe(false);
    expect(isDirtySave(undefined)).toBe(false);
  });
});

describe("needsResolution", () => {
  it("is true only for the states with a resolution UI", () => {
    expect(needsResolution(snapshot("conflict"))).toBe(true);
    expect(needsResolution(snapshot("error"))).toBe(true);
    expect(needsResolution(snapshot("dirty", { remoteChanged: true }))).toBe(false);
    expect(needsResolution(undefined)).toBe(false);
  });
});
