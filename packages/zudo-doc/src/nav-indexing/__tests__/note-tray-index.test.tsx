/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { NoteTrayIndex } from "../note-tray-index.js";
import { base } from "./note-tray-test-helpers.js";

describe("NoteTrayIndex", () => {
  it("renders nothing for an empty tray", () => {
    expect(NoteTrayIndex({ ...base, items: [] })).toBeNull();
  });
});
