import { describe, expect, it } from "vitest";
import { buildRootMenuItems } from "@takazudo/zudo-doc/nav-data-prep";
import { createRouteContext } from "@takazudo/zudo-doc/route-context";
import { settings } from "@/config/settings";
import { translations } from "@/config/i18n";

describe("showcase Assets header navigation", () => {
  it("has the unversioned shape and resolves its JA SSR link", () => {
    const item = settings.headerNav.find((entry) => entry.labelKey === "nav.assets");
    expect(item).toBeDefined();
    expect(item?.path).toBe("/files");
    expect(item?.versioned).toBe(false);
    expect(item).not.toHaveProperty("categoryMatch");

    // The showcase home-page context is deliberately lightweight and omits
    // the filesystem-backed manifest. The enabled viewer setting still makes
    // its route prefix default-locale-only, so the JA menu stays at /files/.
    const context = createRouteContext(
      {
        settings,
        translations,
        tagVocabulary: [],
        colorSchemes: null,
        assetManifest: null,
      },
      { stableDocs: () => [] },
    );
    const menu = buildRootMenuItems(
      "ja",
      "1.0",
      context.settings.headerNav,
      context.t,
      context.navHref,
    );
    expect(menu.find((entry) => entry.label === "アセット")).toEqual({
      label: "アセット",
      href: "/files/",
    });
  });
});
