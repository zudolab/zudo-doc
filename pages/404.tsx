/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/404.astro → zfb page module.
//
// The 404 page is a static route with no dynamic params. zfb emits it as
// dist/404.html so the host platform (Cloudflare Pages, Netlify, etc.) can
// serve it for unmatched requests. No paths() export needed.
//
// The original Astro page rendered the full html/head/body inline without
// DocLayout because the 404 page intentionally has no sidebar/TOC/header.
// This port wraps via DocLayoutWithDefaults with hideSidebar/hideToc plus
// a noindex meta so search engines do not index it.

import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import type { JSX } from "preact";
import { FooterWithDefaults } from "./lib/_footer-with-defaults";

export const frontmatter = { title: "404" };

export default function NotFoundPage(): JSX.Element {
  const locale = defaultLocale;

  return (
    <DocLayoutWithDefaults
      title={`Page Not Found | ${settings.siteName}`}
      lang={locale}
      noindex={true}
      hideSidebar={true}
      hideToc={true}
      footerOverride={<FooterWithDefaults lang={locale} />}
    >
      <div class="min-h-[60vh] flex flex-col items-center justify-center px-hsp-2xl py-vsp-xl">
        <h1 class="text-display font-bold mb-vsp-md">404</h1>
        <p class="text-subheading text-muted mb-vsp-xl">Page not found.</p>
        <a
          href={withBase("/")}
          class="bg-accent px-hsp-lg py-vsp-xs font-medium text-bg hover:bg-accent-hover"
        >
          Back to Home
        </a>
      </div>
    </DocLayoutWithDefaults>
  );
}
