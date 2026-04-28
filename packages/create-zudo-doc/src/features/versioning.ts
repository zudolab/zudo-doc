import type { FeatureModule } from "../compose.js";

export const versioningFeature: FeatureModule = () => ({
  name: "versioning",
  injections: [
    // --- doc-layout imports ---
    {
      file: "src/layouts/doc-layout.tsx",
      anchor: "// @slot:doc-layout:imports",
      content: `import VersionSwitcher from "@/components/version-switcher";
import VersionBanner from "@/components/version-banner";
import { getVersionAvailability } from "@/utils/version-availability";`,
    },
    // --- doc-layout frontmatter (versionAvailability computation) ---
    {
      file: "src/layouts/doc-layout.tsx",
      anchor: "// @slot:doc-layout:frontmatter",
      content:
        "const versionAvailability = settings.versions ? await getVersionAvailability() : undefined;",
    },
    // --- Replace header call to add versionAvailability prop ---
    {
      file: "src/layouts/doc-layout.tsx",
      anchor: "{/* @slot:doc-layout:header-call:start */}",
      content: `    <Header lang={lang} currentPath={currentPath} currentVersion={currentVersion} currentSlug={currentSlug} versionAvailability={versionAvailability}>`,
      position: "replace",
    },
    // --- Replace breadcrumb area with version switcher ternary.
    //     In JSX layouts the breadcrumb content is passed as a `breadcrumb`
    //     prop (no Astro named-slot syntax) so <slot name="breadcrumb" />
    //     becomes {breadcrumb}. ---
    {
      file: "src/layouts/doc-layout.tsx",
      anchor: "{/* @slot:doc-layout:breadcrumb:start */}",
      content: `            {settings.versions && currentSlug ? (
              <div class="mb-vsp-sm flex flex-col items-start gap-vsp-xs sm:flex-row sm:items-center sm:justify-between [&_nav]:mb-0">
                {breadcrumb}
                <VersionSwitcher currentVersion={currentVersion} currentSlug={currentSlug} lang={lang} availability={versionAvailability} />
              </div>
            ) : (
              breadcrumb
            )}`,
      position: "replace",
    },
    // --- Version banner after breadcrumb ---
    {
      file: "src/layouts/doc-layout.tsx",
      anchor: "{/* @slot:doc-layout:after-breadcrumb */}",
      content: `            {versionBanner && latestUrl && (
              <VersionBanner type={versionBanner} latestUrl={latestUrl} lang={lang} />
            )}`,
      position: "after",
    },
    // --- Header imports ---
    {
      file: "src/components/header.tsx",
      anchor: "// @slot:header:imports",
      content: `import VersionSwitcher from "@/components/version-switcher";
import type { VersionAvailability } from "@/utils/version-availability";`,
    },
    // --- Header Props interface field ---
    {
      file: "src/components/header.tsx",
      anchor: "// @slot:header:props",
      content: `  versionAvailability?: VersionAvailability;`,
    },
    // --- Header Props destructure ---
    {
      file: "src/components/header.tsx",
      anchor: "// @slot:header:props-destructure",
      content: `  versionAvailability,`,
    },
    // --- Header version switcher in actions ---
    {
      file: "src/components/header.tsx",
      anchor: "{/* @slot:header:actions-start */}",
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
