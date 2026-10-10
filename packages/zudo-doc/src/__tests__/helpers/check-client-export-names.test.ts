import { expect, test } from "vitest";
import { checkClientExportNames } from "../../../../../scripts/check-client-export-names.mjs";

// The package test lane enforces the same source graph audit as the CLI.
test("client entries have unique marker names and no callable helper exports", () => {
  expect(checkClientExportNames()).toEqual([]);
});
