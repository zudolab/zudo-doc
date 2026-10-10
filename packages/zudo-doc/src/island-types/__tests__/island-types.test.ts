import { expect, it } from "vitest";
import { ENLARGE_DIALOG_STYLE } from "../index.js";

it("shares a CSS style string between SSR fallback and hydrated dialog", () => {
  expect(ENLARGE_DIALOG_STYLE).toEqual({ position: "fixed", inset: 0, margin: "auto" });
});
