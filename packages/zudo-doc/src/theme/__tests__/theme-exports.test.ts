import { describe, expect, it } from "vitest";
import * as theme from "../index.js";

describe("theme public exports", () => {
  it("contains only the current theme controls", () => {
    expect(Object.keys(theme).sort()).toEqual([
      "ColorSchemeProvider",
      "ThemeToggle",
      // Not a "control" like the other two — it is here because
      // `copy-routes-src.mjs` rewrites `src/routes/404.tsx`'s
      // `../theme/theme-pack-provider.js` import to the bare
      // `@takazudo/zudo-doc/theme` subpath, so the shipped routes-src copy can
      // only resolve it from this barrel. Keep the rest of the theme-pack
      // provider off this subpath (see ../index.ts).
      "resolveThemePackSsrSlug",
    ]);
  });
});
