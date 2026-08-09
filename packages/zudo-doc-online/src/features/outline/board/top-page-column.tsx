/**
 * The leading, fixed pseudo-column: the site's top page, derived from the
 * category order (recipe §1) — never an outline node, never draggable,
 * never droppable. Renders the SAME `siteMap.topPage` projection the tree
 * view's consequence preview uses, so this thumbnail can never disagree
 * with what the site actually generates.
 */

import type { SiteMapTopCard, SiteMapTopPage } from "../../../core/outline/site-map.js";
import { BOARD_COLUMN_WIDTH } from "./tokens.js";

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className="shrink-0 text-muted"
      style={{ width: "0.75rem", height: "0.75rem" }}
    >
      <rect x="2.2" y="5.2" width="7.6" height="5" rx="1.2" />
      <path d="M4 5V3.8a2 2 0 0 1 4 0V5" />
    </svg>
  );
}

export interface TopPageColumnProps {
  topPage: SiteMapTopPage;
}

export function TopPageColumn({ topPage }: TopPageColumnProps) {
  return (
    <section
      aria-label="Top page (derived)"
      className="flex min-h-0 shrink-0 flex-col gap-vsp-sm self-stretch rounded-[var(--zdo-kb-column-radius,var(--radius-md))] border p-hsp-sm"
      style={{
        width: BOARD_COLUMN_WIDTH,
        minWidth: BOARD_COLUMN_WIDTH,
        backgroundColor:
          "color-mix(in oklch, var(--zdo-accent) 4%, var(--zdo-kb-column-bg, var(--zdo-surface-2)))",
        borderColor: "color-mix(in oklch, var(--zdo-accent) 18%, var(--zdo-border))",
      }}
    >
      <header className="flex items-center gap-hsp-xs">
        <LockIcon />
        <span className="text-small font-semibold text-fg">Top page</span>
        <span className="ml-auto shrink-0 rounded-sm bg-accent-soft px-hsp-sm py-vsp-2xs text-caption font-semibold text-accent uppercase">
          derived
        </span>
      </header>

      <div
        className="rounded-[var(--zdo-kb-card-radius,var(--radius-sm))] border p-hsp-sm"
        style={{
          backgroundColor: "var(--zdo-kb-card-bg, var(--zdo-surface))",
          borderColor: "var(--zdo-kb-card-border, var(--zdo-border))",
          boxShadow: "var(--zdo-kb-card-shadow, var(--shadow-1))",
        }}
      >
        {topPage.cards.length === 0 ? (
          <p className="text-caption text-muted">No categories yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-hsp-xs">
            {topPage.cards.map((card) => (
              <ThumbCell key={card.categoryId} card={card} />
            ))}
          </div>
        )}
      </div>

      <p className="text-caption text-muted">
        Generated from your categories — column order is the site&rsquo;s header
        navigation.
      </p>
    </section>
  );
}

function ThumbCell({ card }: { card: SiteMapTopCard }) {
  return (
    <div
      className="rounded-sm border p-hsp-xs"
      style={{
        borderColor: "var(--zdo-kb-card-border, var(--zdo-border))",
        backgroundColor: "color-mix(in oklch, var(--zdo-surface) 55%, transparent)",
      }}
    >
      <p className="truncate text-caption font-medium text-fg-mild">{card.title}</p>
      <p className="mt-vsp-2xs text-caption text-muted">
        {card.pageCount === 1 ? "1 page" : `${card.pageCount} pages`}
      </p>
    </div>
  );
}
