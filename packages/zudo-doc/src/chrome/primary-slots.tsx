/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Primary chrome replacement seam (#2775).
//
// Package-owned routes, self-contained scaffold routes, and the shared page
// factories all arrive here with the same ChromeContext. This is the only
// place that widens the structural ChromeHostBindings component values back to
// their exact call-site contracts. Every absent slot keeps its statically
// imported package implementation, preserving both default output and island
// scanner reachability.

import type { ComponentChildren } from "preact";
import type { ChromeContext, FactoryComponent } from "../factory-context/index.js";
import type {
  BreadcrumbSlotProps,
  DocPagerSlotProps,
  FooterSlotProps,
  HeaderSlotProps,
  SidebarSlotProps,
  TocSlotProps,
} from "../chrome-bindings.js";
import type { Settings } from "../settings.js";

import { createHeaderWithDefaults } from "../header-with-defaults/index.js";
import { createFooterWithDefaults } from "../footer-with-defaults/index.js";
import { createSidebarWithDefaults } from "../sidebar-with-defaults/index.js";
import { Toc } from "../toc/index.js";
import { Breadcrumb } from "../breadcrumb/index.js";
import { createDocPager } from "../doc-pager/index.js";

type PrimarySlot<P> = (props: P) => ComponentChildren;

/**
 * Recover one exact call-site component type from the deliberately wide
 * `FactoryComponent` storage boundary. Hosts built with `defineChromeBindings`
 * have already proved this assignment safe; keeping the cast here prevents
 * route factories from inventing their own override logic.
 */
function resolvePrimarySlot<P>(
  slot: "Header" | "Footer" | "Sidebar" | "Toc" | "Breadcrumb" | "DocPager",
  replacement: FactoryComponent | undefined,
  createPackageDefault: () => PrimarySlot<P>,
): PrimarySlot<P> {
  if (replacement !== undefined && typeof replacement !== "function") {
    throw new TypeError(
      `Invalid primary chrome replacement at chromeBindings.${slot}: expected a callable component. ` +
        `Export ${slot} from the object built with defineChromeBindings() and point ` +
        `settings.chromeBindingsModule at that module.`,
    );
  }
  return replacement
    ? (replacement as unknown as PrimarySlot<P>)
    : createPackageDefault();
}

/**
 * Resolve all six primary chrome components through one binding object.
 * Accessors keep package defaults lazy: a home view that only reads Header and
 * Footer does not construct the doc-only Sidebar or DocPager factories.
 */
export function derivePrimaryChromeSlots<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
) {
  return {
    get Header() {
      return resolvePrimarySlot<HeaderSlotProps>("Header", ctx.hostBindings.Header, () =>
        createHeaderWithDefaults(ctx),
      );
    },
    get Footer() {
      return resolvePrimarySlot<FooterSlotProps>("Footer", ctx.hostBindings.Footer, () =>
        createFooterWithDefaults(ctx),
      );
    },
    get Sidebar() {
      return resolvePrimarySlot<SidebarSlotProps>("Sidebar", ctx.hostBindings.Sidebar, () =>
        createSidebarWithDefaults(ctx),
      );
    },
    get Toc() {
      return resolvePrimarySlot<TocSlotProps>("Toc", ctx.hostBindings.Toc, () => Toc);
    },
    get Breadcrumb() {
      return resolvePrimarySlot<BreadcrumbSlotProps>(
        "Breadcrumb",
        ctx.hostBindings.Breadcrumb,
        () => Breadcrumb,
      );
    },
    get DocPager() {
      return resolvePrimarySlot<DocPagerSlotProps>(
        "DocPager",
        ctx.hostBindings.DocPager,
        () => createDocPager(ctx),
      );
    },
  };
}
