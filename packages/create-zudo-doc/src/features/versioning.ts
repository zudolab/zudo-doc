import type { FeatureModule } from "../compose.js";

export const versioningFeature: FeatureModule = () => ({
  name: "versioning",
  files: [
    "src/components/version-switcher.astro",
    "src/components/version-banner.astro",
    "src/components/versions-page-content.astro",
    "src/utils/version-availability.ts",
    "src/pages/docs/versions.astro",
    "src/pages/v",
  ],
  injections: [
    // --- doc-layout imports ---
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "// @slot:doc-layout:imports",
      content: `import VersionSwitcher from "@/components/version-switcher.astro";
import VersionBanner from "@/components/version-banner.astro";
import { getVersionAvailability } from "@/utils/version-availability";`,
    },
    // --- doc-layout frontmatter (versionAvailability computation) ---
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "// @slot:doc-layout:frontmatter",
      content:
        "const versionAvailability = settings.versions ? await getVersionAvailability() : undefined;",
    },
    // --- Replace header call to add versionAvailability prop ---
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:header-call:start -->",
      content: `    <Header lang={lang} currentPath={currentPath} currentVersion={currentVersion} currentSlug={currentSlug} versionAvailability={versionAvailability}>`,
      position: "replace",
    },
    // --- Replace breadcrumb area with version switcher ternary ---
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:breadcrumb:start -->",
      content: `            {settings.versions && currentSlug ? (
              <div class="mb-vsp-sm flex flex-col items-start gap-vsp-xs sm:flex-row sm:items-center sm:justify-between [&_nav]:mb-0">
                <slot name="breadcrumb" />
                <VersionSwitcher currentVersion={currentVersion} currentSlug={currentSlug} lang={lang} availability={versionAvailability} />
              </div>
            ) : (
              <slot name="breadcrumb" />
            )}`,
      position: "replace",
    },
    // --- Version banner after breadcrumb ---
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:after-breadcrumb -->",
      content: `            {versionBanner && latestUrl && (
              <VersionBanner type={versionBanner} latestUrl={latestUrl} lang={lang} />
            )}`,
      position: "after",
    },
    // --- Header imports ---
    {
      file: "src/components/header.astro",
      anchor: "// @slot:header:imports",
      content: `import VersionSwitcher from "@/components/version-switcher.astro";
import type { VersionAvailability } from "@/utils/version-availability";`,
    },
    // --- Header version switcher in actions ---
    {
      file: "src/components/header.astro",
      anchor: "<!-- @slot:header:actions-start -->",
      content: `    {
      settings.versions && (
        <div class="hidden lg:block">
          <VersionSwitcher
            currentVersion={currentVersion}
            currentSlug={currentSlug}
            lang={lang}
            availability={versionAvailability}
            idSuffix="header"
          />
        </div>
      )
    }`,
      position: "after",
    },
  ],
});
