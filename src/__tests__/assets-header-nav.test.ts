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

    // The real route payload carries the scanned asset manifest. Its route
    // context adds the asset prefix to default-locale-only paths, so the
    // versioned JA mobile menu keeps this link at /files/.
    const context = createRouteContext(
      {
        settings,
        translations,
        tagVocabulary: [],
        colorSchemes: null,
        assetManifest: { dir: "assets", routePrefix: "files", entries: [], excerpts: {} },
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
