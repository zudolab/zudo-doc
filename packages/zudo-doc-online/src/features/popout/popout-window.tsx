/**
 * The pop-out preview window's mounted UI: a slim title bar + the shared
 * `PreviewPane`, no app chrome — mounted by `route.tsx` once it has
 * validated `pageId`.
 *
 * Per the recipe's core principle, this is a second, independent SPA
 * instance: it opens its own `ProjectStore` and its own `ProjectEventsClient`
 * and talks to the API directly. The opener window NEVER streams rendered
 * HTML or markdown to it — the only thing that ever crosses the
 * `BroadcastChannel` bus (`popout-bus.ts`) is the close announcement on
 * `pagehide`, which carries no content.
 *
 * On every `page-changed` SSE event for THIS pageId — own-origin or remote,
 * no filtering, since the main window's own ~500ms autosave cadence is what
 * is expected to drive this window's live updates — the page is re-fetched
 * and `PreviewPane` re-renders from the fresh markdown.
 *
 * `PreviewPane` reads its "live editor buffer" tick from
 * `editorContentTicker`, a module-level singleton (`use-editor-content.ts`).
 * A pop-out window is a SEPARATE JS realm from the opener (its own module
 * graph, its own singleton instance) with no `EditorPaneSlot` mounted in it
 * to ever publish a tick — so that singleton here is permanently idle, and
 * `PreviewPane` falls back to the `markdown` prop this component feeds it,
 * exactly as intended (see preview-pane.tsx's own header comment).
 *
 * `.zdo-editor` wraps the root: `PreviewPane`'s error strip reads the
 * `--zdo-wash-danger` token, which `editor-chrome.css` scopes to that class
 * (the token bag is feature-local to the editor workspace — see that file's
 * header for why). This is the cheapest correct fix for a pop-out window
 * that has no other reason to load the editor workspace's chrome; promoting
 * the wash tokens to `tokens.css` so every consumer of `PreviewPane` gets
 * them for free is a real option too, just not one this sub-issue makes
 * unilaterally.
 */

import { useEffect, useState } from "preact/hooks";
import { LEGACY_FALLBACK_SLUG } from "../../app/project";
import {
  ProjectEventsClient,
  StoreRequestError,
  createHttpProjectStore,
  getClientId,
  type PagePayload,
  type ProjectStore,
} from "../../store/index";
import PreviewPane from "../preview/preview-pane";
import { announcePopoutClose } from "./popout-bus";
import { subscribePopoutThemeSync } from "./popout-theme-sync";

export interface PopoutWindowProps {
  /** Defaults to `LEGACY_FALLBACK_SLUG` — a test seam, since a real popout is
   * always opened with a real project slug (`popout-registry.ts`). */
  projectSlug?: string;
  pageId: string;
  /** Test seam: defaults to a real HTTP store bound to `projectSlug`. */
  store?: ProjectStore;
  /** Test seam: defaults to a real `ProjectEventsClient` bound to `projectSlug`. `null` disables the SSE subscription entirely. */
  events?: ProjectEventsClient | null;
}

type LoadState =
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; page: PagePayload };

/**
 * `router.ts`'s `parseRoute` already drops an empty pageId segment before a
 * `popped-out-preview` route is ever produced (`segments.filter(Boolean)`),
 * so this rarely fires in practice — but the recipe is explicit that a
 * malformed popout URL must show a visible error page, never a silent
 * self-close, so this component owns that guard directly rather than
 * trusting every future caller to check first.
 */
function isValidPageId(pageId: string): boolean {
  return pageId.trim().length > 0;
}

export default function PopoutWindow({
  projectSlug = LEGACY_FALLBACK_SLUG,
  pageId,
  store: injectedStore,
  events: injectedEvents,
}: PopoutWindowProps) {
  const [state, setState] = useState<LoadState>(() =>
    isValidPageId(pageId)
      ? { status: "loading" }
      : { status: "invalid", message: "No page id was given." },
  );

  useEffect(() => subscribePopoutThemeSync(), []);

  useEffect(() => {
    const handlePageHide = (): void => announcePopoutClose(window.name);
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  useEffect(() => {
    if (!isValidPageId(pageId)) return;
    let cancelled = false;
    // `undefined` (the default) means "build a real one and own its
    // lifecycle"; an explicit `null` (test seam) means "no SSE at all" —
    // these are deliberately different from an injected instance, which is
    // still connected/closed by this effect same as the default.
    const events =
      injectedEvents === undefined
        ? new ProjectEventsClient({ projectSlug, clientId: getClientId() })
        : injectedEvents;

    async function boot(): Promise<void> {
      try {
        const store = injectedStore ?? createHttpProjectStore({ projectSlug });
        const page = await store.loadPage(pageId);
        if (cancelled) return;
        setState({ status: "ready", page });

        // Serialized the same way editor/route.tsx's own `refresh()` is: a
        // `page-changed` event that lands while a refetch is already in
        // flight is REMEMBERED, not dropped or run concurrently — two
        // concurrent `loadPage()` calls could settle out of order and let an
        // older response overwrite a newer one already on screen.
        let refreshing = false;
        let refreshQueued = false;
        const refetch = async (): Promise<void> => {
          if (refreshing) {
            refreshQueued = true;
            return;
          }
          refreshing = true;
          try {
            const next = await store.loadPage(pageId);
            if (!cancelled) setState({ status: "ready", page: next });
          } catch {
            // Keep showing the last good page — a transient refetch failure
            // is not worth replacing a working preview with an error screen.
          } finally {
            refreshing = false;
          }
          if (refreshQueued && !cancelled) {
            refreshQueued = false;
            await refetch();
          }
        };

        if (events === null) return;
        const unsubscribeEvent = events.onEvent(({ event }) => {
          if (event.type === "page-changed" && event.pageId === pageId) void refetch();
        });
        // `onOpen`, not `onReconnect`: it also fires on the FIRST connect,
        // which closes the gap between the `loadPage()` call above and the
        // SSE stream actually opening — an edit that committed in that
        // window would otherwise be silently missed (no event replay) until
        // some later, unrelated event happened to arrive.
        const unsubscribeOpen = events.onOpen(() => void refetch());
        events.connect();

        cleanup = () => {
          unsubscribeEvent();
          unsubscribeOpen();
        };
      } catch (caught) {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            caught instanceof StoreRequestError
              ? caught.message
              : "The editing server could not be reached.",
        });
      }
    }

    let cleanup: (() => void) | undefined;
    void boot();

    return () => {
      cancelled = true;
      cleanup?.();
      events?.close();
    };
  }, [projectSlug, pageId, injectedStore, injectedEvents]);

  if (state.status === "invalid") {
    return <PopoutStatus title="This pop-out link is invalid" message={state.message} />;
  }

  if (state.status === "error") {
    return (
      <PopoutStatus
        title="This preview window could not be opened"
        message={state.message}
      />
    );
  }

  if (state.status === "loading") {
    return <PopoutStatus title="Opening preview…" message="Loading the page." />;
  }

  const { page } = state;
  return (
    <div className="zdo-editor flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex flex-none items-center gap-hsp-sm border-b border-border px-hsp-lg py-vsp-xs">
        <span className="font-semibold text-fg-mild">{page.frontmatter.title}</span>
        <span className="text-caption text-muted">Live preview — pop-out window</span>
      </header>
      <PreviewPane
        pageId={page.id}
        title={page.frontmatter.title}
        // `categoryId`, not `categorySlug`: this window only ever fetches the
        // one page, never the full outline snapshot that resolves a
        // category's slug (see page-index.ts's `pagePath` for the slug-based
        // form the main window's own preview header shows). PreviewPane
        // never renders `path` as visible content — it only surfaces it as
        // `data-preview-path` — so this approximation costs nothing visible.
        path={`${page.categoryId}/${page.slug}`}
        markdown={page.markdown}
      />
    </div>
  );
}

function PopoutStatus({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-vsp-xs bg-bg p-hsp-xl text-center text-fg">
      <h1 className="text-title font-semibold">{title}</h1>
      <p className="text-body text-muted">{message}</p>
      <p className="text-small text-muted">You can close this window.</p>
    </div>
  );
}
