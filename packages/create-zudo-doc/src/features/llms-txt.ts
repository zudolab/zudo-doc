import type { FeatureModule } from "../compose.js";

export const llmsTxtFeature: FeatureModule = () => ({
  name: "llmsTxt",
  injections: [
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:head-links -->",
      content: `    {settings.llmsTxt && (
      <>
        <link rel="alternate" type="text/plain" href={withBase(lang === defaultLocale ? "/llms.txt" : \`/\${lang}/llms.txt\`)} title="llms.txt" />
        <link rel="alternate" type="text/plain" href={withBase(lang === defaultLocale ? "/llms-full.txt" : \`/\${lang}/llms-full.txt\`)} title="llms-full.txt" />
      </>
    )}`,
    },
  ],
});
