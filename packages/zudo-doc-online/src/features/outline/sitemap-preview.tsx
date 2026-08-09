/**
 * "What this structure produces" — the consequence preview.
 *
 * The outline is an abstraction, and its consequences (which categories
 * become header navigation, which pages fill a sidebar, what the generated
 * top page lists) are what the author actually cares about. This pane renders
 * exactly the projection the core `site-map.ts` computes, so it can never
 * describe a site the build would not produce, and it re-renders from the
 * same snapshot the tree does, so it is live by construction.
 *
 * Drafts are shown and flagged rather than dropped: `buildSiteMap` keeps them
 * on purpose (it is a preview, not the published site), and hiding them here
 * would make a page the author is actively writing vanish from its own
 * preview.
 *
 * Styling note: the site mock is a *drawing* of a page, not UI, so its bars,
 * cards and hairlines carry their geometry as inline styles instead of
 * inventing spacing tokens for one decorative widget. Every color still goes
 * through a `--zdo-*` role var (or a `color-mix` wash of one), never a
 * literal — that is the rule the design system actually cares about.
 */

import type { JSX } from "preact";
import type {
  SiteMapCategory,
  SiteMapModel,
  SiteMapPage,
} from "../../core/outline/site-map.js";

export interface SitemapPreviewProps {
  siteMap: SiteMapModel;
  selectedCategoryId: string | null;
}

/** A translucent tint of a role token — never a raw alpha color literal. */
function wash(role: string, percent: number): string {
  return `color-mix(in oklch, var(${role}) ${percent}%, transparent)`;
}

const HAIRLINE = "1px solid var(--zdo-border)";

export function SitemapPreview({
  siteMap,
  selectedCategoryId,
}: SitemapPreviewProps) {
  const selected =
    siteMap.categories.find((category) => category.id === selectedCategoryId) ??
    null;
  const drafts = (selected?.pages ?? siteMap.categories.flatMap((c) => c.pages))
    .filter((page) => page.draft);

  return (
    <div className="flex flex-col gap-vsp-lg">
      <div className="flex items-baseline justify-between gap-hsp-md">
        <h2 className="text-title font-semibold text-fg">
          What this structure produces
        </h2>
        <span className="flex shrink-0 items-center gap-hsp-xs text-caption font-semibold text-muted uppercase">
          <span
            aria-hidden="true"
            className="block rounded-full bg-accent"
            style={{ width: "7px", height: "7px" }}
          />
          Live
        </span>
      </div>

      <p className="text-caption text-muted">
        {selected === null ? (
          <>Select a category in the outline to scope the sidebar preview.</>
        ) : (
          <>
            Sidebar scoped to{" "}
            <span className="rounded-full bg-accent-soft px-hsp-sm py-vsp-2xs font-semibold text-accent">
              {selected.title}
            </span>
          </>
        )}
      </p>

      <section className="flex flex-col gap-vsp-xs">
        <PreviewLabel label="Top page" detail="generated category grid" />
        <Mini>
          <MiniHeader siteMap={siteMap} activeCategoryId={null} />
          <div
            className="text-center"
            style={{ padding: "16px 16px 13px" }}
            aria-hidden="true"
          >
            <div
              style={{
                height: "9px",
                width: "116px",
                margin: "4px auto 7px",
                borderRadius: "4px",
                background: wash("--zdo-fg", 55),
              }}
            />
            <div
              style={{
                height: "6px",
                width: "168px",
                margin: "0 auto",
                borderRadius: "3px",
                background: wash("--zdo-fg", 12),
              }}
            />
          </div>
          {siteMap.topPage.cards.length === 0 ? (
            <p
              className="text-center text-caption text-muted"
              style={{ padding: "0 14px 16px" }}
            >
              No categories yet — the top page would be empty.
            </p>
          ) : (
            <ul
              className="grid grid-cols-3"
              style={{ gap: "8px", padding: "4px 14px 16px" }}
            >
              {siteMap.topPage.cards.map((card) => {
                const active = card.categoryId === selectedCategoryId;
                return (
                  <li
                    key={card.categoryId}
                    style={{
                      border: active
                        ? `1px solid ${wash("--zdo-accent", 45)}`
                        : HAIRLINE,
                      borderRadius: "6px",
                      background: active
                        ? `color-mix(in oklch, var(--zdo-accent) 6%, var(--zdo-bg))`
                        : "var(--zdo-surface)",
                      padding: "9px 10px 8px",
                    }}
                  >
                    <div
                      className={`truncate font-semibold ${active ? "text-accent" : "text-fg"}`}
                      style={{ fontSize: "9.5px" }}
                    >
                      {card.title}
                    </div>
                    <div className="text-muted" style={{ fontSize: "8.5px" }}>
                      {card.pageCount === 1 ? "1 page" : `${card.pageCount} pages`}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Mini>
      </section>

      {selected === null ? null : (
        <section className="flex flex-col gap-vsp-xs">
          <PreviewLabel label="Category view" detail={selected.path} />
          <Mini>
            <MiniHeader siteMap={siteMap} activeCategoryId={selected.id} />
            <div className="flex" style={{ minHeight: "216px" }}>
              <MiniSidebar category={selected} />
              <div
                className="flex-1"
                style={{ padding: "16px 18px", minWidth: 0 }}
                aria-hidden="true"
              >
                <Bar width="46%" height="11px" tone={40} gap="12px" />
                <Bar width="100%" />
                <Bar width="90%" />
                <Bar width="75%" />
                <div
                  style={{
                    height: "42px",
                    width: "84%",
                    marginTop: "14px",
                    marginBottom: "8px",
                    borderRadius: "5px",
                    border: HAIRLINE,
                    background: wash("--zdo-fg", 5.5),
                  }}
                />
                <Bar width="90%" />
                <Bar width="60%" />
              </div>
            </div>
          </Mini>
        </section>
      )}

      {drafts.length === 0 ? null : (
        <p className="flex items-start gap-hsp-sm text-caption text-muted">
          <span
            aria-hidden="true"
            className="block shrink-0 rounded-full bg-warning"
            style={{ width: "7px", height: "7px", marginTop: "5px" }}
          />
          <span>
            {listDraftTitles(drafts)}{" "}
            {drafts.length === 1 ? "has" : "have"} unpublished edits — visitors
            still see the last published version.
          </span>
        </p>
      )}
    </div>
  );
}

function listDraftTitles(pages: SiteMapPage[]): string {
  const titles = pages.map((page) => `“${page.title}”`);
  if (titles.length <= 2) return titles.join(" and ");
  return `${titles.slice(0, 2).join(", ")} and ${titles.length - 2} more`;
}

function PreviewLabel({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-baseline gap-hsp-sm text-caption font-semibold text-fg-mild uppercase">
      {label}
      <span className="font-mono font-normal normal-case text-muted">
        {detail}
      </span>
    </div>
  );
}

function Mini({ children }: { children: JSX.Element | JSX.Element[] | null }) {
  return (
    <div
      className="overflow-hidden bg-bg shadow-1"
      style={{ border: HAIRLINE, borderRadius: "8px" }}
    >
      {children}
    </div>
  );
}

function MiniHeader({
  siteMap,
  activeCategoryId,
}: {
  siteMap: SiteMapModel;
  activeCategoryId: string | null;
}) {
  return (
    <div
      className="flex items-center gap-hsp-sm"
      style={{ height: "32px", padding: "0 14px", borderBottom: HAIRLINE }}
    >
      <span
        aria-hidden="true"
        className="block shrink-0 bg-accent"
        style={{ width: "12px", height: "12px", borderRadius: "3.5px" }}
      />
      <span
        className="truncate font-semibold text-fg"
        style={{ fontSize: "10.5px" }}
      >
        {siteMap.projectTitle}
      </span>
      <nav
        aria-label="Preview navigation"
        className="ml-auto flex items-center gap-hsp-md"
        style={{ minWidth: 0 }}
      >
        {siteMap.nav.map((item) => (
          <span
            key={item.categoryId}
            className={`truncate ${
              item.categoryId === activeCategoryId
                ? "font-semibold text-accent"
                : "text-muted"
            }`}
            style={{ fontSize: "10px" }}
          >
            {item.title}
          </span>
        ))}
      </nav>
    </div>
  );
}

function MiniSidebar({ category }: { category: SiteMapCategory }) {
  const items = category.pages.filter((page) => !page.isIndex);
  return (
    <div
      className="shrink-0"
      style={{
        width: "132px",
        borderRight: HAIRLINE,
        padding: "12px 0",
        background: `color-mix(in oklch, var(--zdo-surface) 50%, var(--zdo-bg))`,
      }}
    >
      <div
        className="truncate font-semibold text-muted uppercase"
        style={{ fontSize: "9px", padding: "0 14px", marginBottom: "7px" }}
      >
        {category.title}
      </div>
      {items.length === 0 ? (
        <div
          className="text-muted"
          style={{ fontSize: "10.5px", padding: "0 14px" }}
        >
          No pages yet
        </div>
      ) : (
        items.map((page) => (
          <div
            key={page.id}
            className="flex items-center gap-hsp-xs text-fg-mild"
            style={{ fontSize: "10.5px", padding: "4.5px 14px" }}
          >
            <span className="truncate">{page.title}</span>
            {page.draft ? (
              <span
                aria-hidden="true"
                className="block shrink-0 rounded-full bg-warning"
                style={{ width: "5px", height: "5px" }}
              />
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

function Bar({
  width,
  height = "7px",
  tone = 9,
  gap = "8px",
}: {
  width: string;
  height?: string;
  tone?: number;
  gap?: string;
}) {
  return (
    <div
      style={{
        width,
        height,
        marginBottom: gap,
        borderRadius: "3px",
        background: wash("--zdo-fg", tone),
      }}
    />
  );
}
