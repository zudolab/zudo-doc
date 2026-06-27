/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /404 — package-owned equivalent of pages/404.tsx
// (A1 #2361). Static route; emitted as dist/404.html.

import type { JSX } from "preact";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import { settings, defaultLocale, withBase } from "./_context.js";
import {
  HeadWithDefaults,
  HeaderWithDefaults,
  FooterWithDefaults,
  BodyEndIslands,
  composeMetaTitle,
} from "./_chrome.js";

export const frontmatter = { title: "404" };

export default function NotFoundPage(): JSX.Element {
  const locale = defaultLocale;
  const title = "Page Not Found";

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(title)}
      head={<HeadWithDefaults title={title} />}
      lang={locale}
      noindex={true}
      hideSidebar={true}
      hideToc={true}
      sidebarOverride={<></>}
      headerOverride={<HeaderWithDefaults lang={locale} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
      enableClientRouter={settings.dynamicPageTransition}
    >
      <div class="min-h-[60vh] flex flex-col items-center justify-center px-hsp-2xl py-vsp-xl">
        <h1 class="text-display font-bold mb-vsp-md">404</h1>
        <p class="text-title text-muted mb-vsp-xl">Page not found.</p>
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
