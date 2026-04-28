import type { JSX } from "preact";
import type { HeadProps } from "./types";
import { OgTags } from "./og-tags";
import { TwitterCard } from "./twitter-card";

/**
 * Framework head tag emission. Renders only the meta-tag layer of <head>;
 * provider components such as ColorSchemeProvider or astro:transitions'
 * ClientRouter and any inline boot scripts (sidebar toggle, design token
 * panel, etc.) are owned by other topic folders and composed by the host
 * layout alongside this primitive.
 *
 * Output order is fixed and matches the existing src/layouts/doc-layout.astro
 * emission so head HTML stays byte-identical (modulo asset hashes) to the
 * pre-migration build for any fixture page:
 *
 *   1. <meta charset>
 *   2. <meta name="viewport">
 *   3. <title>
 *   4. <meta name="description">          (if description)
 *   5. <meta name="robots">                (noindex sitewide OR unlisted page)
 *   6. <link rel="canonical">              (if canonical)
 *   7. <meta name="theme-color">           (if themeColor)
 *   8. og:* tags                           (og:title always; rest conditional)
 *   9. twitter:* tags                      (only when twitterCard set)
 *  10. <link rel="stylesheet"> ...         (in supplied order — e.g. KaTeX)
 *  11. <link rel="alternate"> ...          (in supplied order — e.g. llms.txt)
 *  12. <link rel="preload"> ...            (in supplied order)
 *
 * Never reorder existing slots; append new tag families at the end so
 * downstream byte-diffs remain stable.
 */
export function DocHead(props: HeadProps): JSX.Element {
  const {
    title,
    description,
    noindex,
    unlisted,
    canonical,
    themeColor,
    twitterCard,
    twitterSite,
    twitterCreator,
    twitterTitle,
    twitterDescription,
    twitterImage,
    stylesheets,
    alternateLinks,
    preload,
  } = props;

  return (
    <>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      {description !== undefined && (
        <meta name="description" content={description} />
      )}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && unlisted && <meta name="robots" content="noindex" />}
      {canonical !== undefined && <link rel="canonical" href={canonical} />}
      {themeColor !== undefined && (
        <meta name="theme-color" content={themeColor} />
      )}
      <OgTags
        title={title}
        description={description}
        ogTitle={props.ogTitle}
        ogDescription={props.ogDescription}
        ogType={props.ogType}
        ogUrl={props.ogUrl}
        ogImage={props.ogImage}
        ogSiteName={props.ogSiteName}
      />
      {twitterCard !== undefined && (
        <TwitterCard
          card={twitterCard}
          site={twitterSite}
          creator={twitterCreator}
          title={twitterTitle}
          description={twitterDescription}
          image={twitterImage}
        />
      )}
      {stylesheets?.map((s) => (
        <link
          key={`stylesheet:${s.href}`}
          rel="stylesheet"
          href={s.href}
          {...(s.integrity !== undefined ? { integrity: s.integrity } : {})}
          {...(s.crossorigin !== undefined ? { crossorigin: s.crossorigin } : {})}
        />
      ))}
      {alternateLinks?.map((l) => (
        <link
          key={`${l.rel}:${l.type ?? ""}:${l.href}`}
          rel={l.rel}
          {...(l.type !== undefined ? { type: l.type } : {})}
          href={l.href}
          {...(l.title !== undefined ? { title: l.title } : {})}
        />
      ))}
      {preload?.map((p) => (
        <link
          key={`preload:${p.as}:${p.href}`}
          rel="preload"
          as={p.as}
          href={p.href}
          {...(p.type !== undefined ? { type: p.type } : {})}
          {...(p.crossorigin !== undefined ? { crossorigin: p.crossorigin } : {})}
        />
      ))}
    </>
  );
}
