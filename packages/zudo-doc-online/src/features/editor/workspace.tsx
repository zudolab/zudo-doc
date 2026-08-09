/**
 * The editor workspace chrome: rail + tab strip + metadata row + split +
 * status bar, wired to the SPA store.
 *
 * This component owns the wiring and nothing else — every piece of logic it
 * depends on lives in a pure module beside it (`tabs-state`, `rail-state`,
 * `page-index`, `save-status`) or in the merged store (`PageSaveMachine`,
 * `RevisionCoordinator`). That split is deliberate: it is what lets the
 * chrome be tested without a browser, and it is why replacing the two slot
 * files (`editor-pane-slot`, `preview-pane-slot`) in later sub-issues touches
 * nothing here.
 *
 * Three seams are worth knowing before changing anything:
 *
 * 1. **The route is the source of truth for the active tab.** Every path that
 *    changes which page is on screen calls `onNavigate`, and the sync effect
 *    then reconciles tab state with the new route. Setting `activeId` without
 *    navigating would make the hash and the strip disagree, and a reload
 *    would resurrect the disagreement.
 * 2. **One save machine per OPEN TAB, not per visible pane** (see
 *    `page-sessions.ts`), which is what keeps a background tab's dirty dot
 *    honest and its draft intact across tab switches.
 * 3. **Nothing here retries a conflict on its own** (epic #3327 contract 2).
 *    A 409 on a page write surfaces the machine's own conflict banner; a 409
 *    on a Position move adopts the server's snapshot and offers an explicit
 *    retry, because a move has no draft to protect but silently discarding
 *    the user's intent would still be a lie.
 */

import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { useSyncExternalStore } from "preact/compat";
import type { ComponentChildren } from "preact";
import {
  RevisionConflictError,
  StoreRequestError,
  type PageFrontmatter,
  type ProjectEventsClient,
  type ProjectSnapshot,
  type ProjectStore,
} from "../../store/index";
import "./editor-chrome.css";
import EditorPaneSlot, { type EditorPaneStatus } from "./editor-pane-slot";
import { MetadataRow } from "./metadata-row";
import {
  buildEditorTree,
  buildMovePageCommand,
  countTreePages,
  findTreePage,
  knownPageIds,
  overlayPageMeta,
  pageFileName,
  pagePath,
  type EditorTreePage,
} from "./page-index";
import { PageSessionRegistry, type PageSession } from "./page-sessions";
import type { KeyValueStorage } from "./persistence";
import PreviewPaneSlot from "./preview-pane-slot";
import { EditorRail } from "./rail";
import {
  readRailMode,
  readSplitPercent,
  toggleRailMode,
  writeRailMode,
  writeSplitPercent,
  type RailMode,
} from "./rail-state";
import { SaveChip } from "./save-chip";
import { describeSaveStatus, isDirtySave, needsResolution } from "./save-status";
import { EditorSplit } from "./split";
import { TabStrip, type EditorTabDescriptor } from "./tab-strip";
import {
  closeTab,
  pruneTabs,
  readOpenTabIds,
  restoreTabs,
  syncTabsToRoute,
  writeOpenTabIds,
  type TabsState,
} from "./tabs-state";

/** How long the transient "Saved" chip stays up before the machine idles. */
const SAVED_CHIP_MS = 1500;

const BUTTON_CLASSES =
  "rounded-sm border border-border-strong px-hsp-sm py-vsp-2xs text-caption font-semibold text-fg-mild hover:bg-(--zdo-wash-hover) focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export interface EditorWorkspaceProps {
  snapshot: ProjectSnapshot;
  store: ProjectStore;
  /** Omitted when the SSE stream is not connected (specs, offline). */
  events?: ProjectEventsClient | null;
  /** The page id the route currently addresses. */
  routePageId: string;
  /** `null` means "no page left to show" — the caller leaves the editor. */
  onNavigate: (pageId: string | null) => void;
  /** A newer snapshot produced by an outline command issued here. */
  onSnapshotChanged: (snapshot: ProjectSnapshot) => void;
  /** Test seam: `null` disables persistence entirely. */
  storage?: KeyValueStorage | null;
  /** Test seam: forwarded to every page save machine. */
  saveDebounceMs?: number;
}

interface OutlineNotice {
  message: string;
  /** The position the user asked for, so the banner can offer a real retry. */
  retryPosition?: number;
}

export function EditorWorkspace({
  snapshot,
  store,
  events,
  routePageId,
  onNavigate,
  onSnapshotChanged,
  storage,
  saveDebounceMs,
}: EditorWorkspaceProps) {
  const registry = useMemo(
    () =>
      new PageSessionRegistry({
        store,
        events: events ?? null,
        ...(saveDebounceMs === undefined ? {} : { debounceMs: saveDebounceMs }),
      }),
    [store, events, saveDebounceMs],
  );
  useEffect(() => () => registry.dispose(), [registry]);

  const subscribeSessions = useCallback(
    (listener: () => void) => registry.subscribe(listener),
    [registry],
  );
  const readSessions = useCallback(() => registry.getSnapshot(), [registry]);
  const sessions = useSyncExternalStore(subscribeSessions, readSessions);

  const baseTree = useMemo(() => buildEditorTree(snapshot), [snapshot]);
  const liveFrontmatter = useMemo(() => collectLiveFrontmatter(sessions), [sessions]);
  const tree = useMemo(
    () => overlayPageMeta(baseTree, liveFrontmatter),
    [baseTree, liveFrontmatter],
  );
  const pageIds = useMemo(() => knownPageIds(baseTree), [baseTree]);

  const [tabs, setTabs] = useState<TabsState>(() =>
    restoreTabs(readOpenTabIds(storage), routePageId, knownPageIds(buildEditorTree(snapshot))),
  );
  const [railMode, setRailMode] = useState<RailMode>(() => readRailMode(storage));
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [splitPercent, setSplitPercent] = useState(() => readSplitPercent(storage));
  const [editorStatus, setEditorStatus] = useState<EditorPaneStatus | undefined>();
  const [outlineNotice, setOutlineNotice] = useState<OutlineNotice | null>(null);

  // Route → tabs. A route pointing at a page the snapshot does not have is
  // left alone by `syncTabsToRoute`; the "page not found" pane below reports
  // it rather than opening a phantom tab that `pruneTabs` would immediately
  // remove again.
  useEffect(() => {
    const next = syncTabsToRoute(tabs, routePageId, pageIds);
    if (next !== tabs) setTabs(next);
  }, [routePageId, tabs, pageIds]);

  // Snapshot → tabs: a page deleted here or by another client loses its tab.
  useEffect(() => {
    const next = pruneTabs(tabs, pageIds);
    if (next === tabs) return;
    setTabs(next);
    if (next.activeId !== tabs.activeId) onNavigate(next.activeId);
  }, [tabs, pageIds, onNavigate]);

  useEffect(() => {
    writeOpenTabIds(tabs.openIds, storage);
  }, [tabs.openIds, storage]);

  // Tabs → sessions. `open` is idempotent, so this converges after one pass.
  useEffect(() => {
    for (const pageId of tabs.openIds) registry.open(pageId);
    for (const pageId of sessions.keys()) {
      if (!tabs.openIds.includes(pageId)) registry.close(pageId);
    }
  }, [tabs.openIds, sessions, registry]);

  const activePageId = tabs.activeId;
  const activeSession = activePageId === null ? undefined : sessions.get(activePageId);
  const activePage = activePageId === null ? undefined : findTreePage(tree, activePageId);
  const activeSave = activeSession?.save;
  const activeMachine = activeSession?.machine;

  // The machine parks in `saved` until acknowledged, so the chip can show a
  // real "Saved" moment instead of blinking through it.
  useEffect(() => {
    if (activeSave?.status !== "saved" || !activeMachine) return;
    const timer = setTimeout(() => activeMachine.acknowledgeSaved(), SAVED_CHIP_MS);
    return () => clearTimeout(timer);
  }, [activeSave?.status, activeMachine]);

  // A stale Ln/Col from the previous tab would be a small lie in the status
  // bar; clearing it is cheaper than teaching the footer to distrust it.
  useEffect(() => {
    if (activePageId === null) setEditorStatus(undefined);
  }, [activePageId]);

  const openPage = useCallback(
    (pageId: string) => {
      setFlyoutOpen(false);
      onNavigate(pageId);
    },
    [onNavigate],
  );

  const handleCloseTab = useCallback(
    (pageId: string) => {
      const next = closeTab(tabs, pageId);
      if (next === tabs) return;

      // A pending autosave survives the close on its own (see
      // `PageSessionRegistry.close`). An UNRESOLVED save is different: only an
      // explicit retry or discard can move it, so closing the tab really does
      // throw the draft away — and that is the user's decision to make, not a
      // side effect of clicking an ✕.
      if (needsResolution(sessions.get(pageId)?.save) && !confirmDiscard()) return;

      setTabs(next);
      if (next.activeId !== tabs.activeId) onNavigate(next.activeId);
    },
    [tabs, sessions, onNavigate],
  );

  const handleToggleRail = useCallback(() => {
    setRailMode((mode) => {
      const next = toggleRailMode(mode);
      writeRailMode(next, storage);
      return next;
    });
    setFlyoutOpen(false);
  }, [storage]);

  const commitSplit = useCallback(
    (percent: number) => {
      setSplitPercent(percent);
      writeSplitPercent(percent, storage);
    },
    [storage],
  );

  const movePage = useCallback(
    async (page: EditorTreePage, position: number) => {
      const command = buildMovePageCommand(page, position);
      if (command === null) {
        setOutlineNotice(null);
        return;
      }
      try {
        const result = await store.applyOutlineCommand(snapshot.revision, command);
        setOutlineNotice(null);
        onSnapshotChanged(result.snapshot);
      } catch (error) {
        if (error instanceof RevisionConflictError) {
          // Adopt-latest: a move has no draft to protect, so the honest move
          // is to show the structure that actually exists and let the user
          // decide whether the reorder still makes sense.
          onSnapshotChanged(error.snapshot);
          setOutlineNotice({
            message:
              "The outline changed elsewhere, so this page was not moved. The current structure is shown below.",
            retryPosition: position,
          });
          return;
        }
        setOutlineNotice({
          message:
            error instanceof StoreRequestError
              ? `The page could not be moved: ${error.message}`
              : "The page could not be moved.",
          retryPosition: position,
        });
      }
    },
    [store, snapshot.revision, onSnapshotChanged],
  );

  const retryPosition = outlineNotice?.retryPosition;

  const tabDescriptors: EditorTabDescriptor[] = tabs.openIds.map((pageId) => {
    const page = findTreePage(tree, pageId);
    const session = sessions.get(pageId);
    return {
      pageId,
      title: page?.title ?? pageId,
      draft: page?.draft ?? false,
      dirty: isDirtySave(session?.save?.status),
    };
  });
  const dirtyPageIds = new Set(
    tabDescriptors.filter((tab) => tab.dirty).map((tab) => tab.pageId),
  );

  return (
    <div className="zdo-editor flex h-full min-h-[0] flex-col overflow-hidden bg-bg text-fg">
      <div className="flex min-h-[0] flex-1">
        <EditorRail
          mode={railMode}
          onToggleMode={handleToggleRail}
          projectTitle={snapshot.title}
          tree={tree}
          pageCount={countTreePages(tree)}
          activePageId={activePageId}
          dirtyPageIds={dirtyPageIds}
          onOpenPage={openPage}
          flyoutOpen={flyoutOpen}
          onFlyoutOpenChange={setFlyoutOpen}
        />

        <div className="flex min-h-[0] min-w-[0] flex-1 flex-col">
          <TabStrip
            tabs={tabDescriptors}
            activePageId={activePageId}
            onActivate={openPage}
            onClose={handleCloseTab}
          />

          {activePage && activeSave ? (
            <MetadataRow
              page={activePage}
              frontmatter={activeSave.content.frontmatter}
              onFrontmatterChange={(next: PageFrontmatter) =>
                activeMachine?.edit({ frontmatter: next })
              }
              onPositionCommit={(position) => void movePage(activePage, position)}
              disabled={activeSave.status === "conflict"}
            />
          ) : null}

          {outlineNotice ? (
            <Banner tone="warning" message={outlineNotice.message}>
              {retryPosition !== undefined && activePage ? (
                <button
                  type="button"
                  className={BUTTON_CLASSES}
                  onClick={() => void movePage(activePage, retryPosition)}
                >
                  Try the move again
                </button>
              ) : null}
              <button
                type="button"
                className={BUTTON_CLASSES}
                onClick={() => setOutlineNotice(null)}
              >
                Dismiss
              </button>
            </Banner>
          ) : null}

          {needsResolution(activeSave) && activeMachine ? (
            <Banner
              tone="danger"
              message={
                activeSave?.status === "conflict"
                  ? "This page changed elsewhere while you had unsaved edits. Your draft is still here — retry to keep it, or discard it to load the latest version."
                  : `The last save failed: ${activeSave?.error?.message ?? "unknown error"}. Your edits are still here.`
              }
            >
              <button
                type="button"
                className={BUTTON_CLASSES}
                onClick={() => activeMachine.retry()}
              >
                Retry save
              </button>
              {activeSave?.status === "conflict" ? (
                <button
                  type="button"
                  className={BUTTON_CLASSES}
                  onClick={() => activeMachine.discard()}
                >
                  Discard my draft
                </button>
              ) : null}
            </Banner>
          ) : null}

          <EditorSplit
            percent={splitPercent}
            onPercentChange={setSplitPercent}
            onPercentCommit={commitSplit}
            editorHeader={
              <>
                <span className="font-mono text-caption text-fg-mild">
                  {activePage ? pageFileName(activePage) : "—"}
                </span>
                <span className="rounded-full border border-border-strong px-hsp-xs text-caption font-semibold">
                  MDX
                </span>
              </>
            }
            editor={
              <EditorBody
                pageId={activePageId}
                routePageId={routePageId}
                known={pageIds.has(routePageId)}
                session={activeSession}
                onChange={(markdown) => activeMachine?.edit({ markdown })}
                onStatusChange={setEditorStatus}
                onRequestSave={() => activeMachine?.flush()}
                onReload={() => activePageId && registry.reload(activePageId)}
              />
            }
            previewHeader={
              <>
                <span className="font-semibold text-fg-mild">Preview</span>
                <span className="ml-auto font-mono text-caption">
                  {activePage ? pagePath(activePage) : ""}
                </span>
              </>
            }
            preview={
              activePage && activeSave ? (
                <PreviewPaneSlot
                  pageId={activePage.id}
                  title={activePage.title}
                  path={pagePath(activePage)}
                  markdown={activeSave.content.markdown}
                />
              ) : (
                <EmptyPane message="Open a page to see its preview." />
              )
            }
          />
        </div>
      </div>

      <footer className="flex flex-none items-center gap-hsp-md border-t border-border bg-surface px-hsp-md py-vsp-2xs text-caption text-muted">
        {/* The editor reports its vim mode through `EditorPaneStatus.mode`,
            and offers `onToggleVim` whenever it is CAPABLE of vim. The two are
            separate because `mode` is absent while vim is off — were the chip
            keyed on `mode` alone, turning vim off would take away the only
            affordance for turning it back on. An editor with no vim at all
            provides neither, and the chip disappears entirely. */}
        <VimChip status={editorStatus} />
        <span className="font-mono">{activePage ? pageFileName(activePage) : "no page"}</span>
        <span className="flex-1" />
        {editorStatus ? (
          <>
            <span className="font-mono tabular-nums">
              {`Ln ${editorStatus.line}, Col ${editorStatus.column}`}
            </span>
            <span className="tabular-nums">{`${editorStatus.words} words`}</span>
          </>
        ) : null}
        {activePageId === null ? null : (
          <SaveChip descriptor={describeSaveStatus(activeSave)} />
        )}
      </footer>
    </div>
  );
}

/**
 * The vim mode indicator, and the only control that turns vim on or off.
 *
 * It is a button rather than the a3 prototype's static chip because the
 * editor has no other affordance for the toggle, and a status bar is where a
 * vim user looks for the mode anyway.
 */
function VimChip({ status }: { status: EditorPaneStatus | undefined }) {
  const toggle = status?.onToggleVim;
  if (!toggle) {
    return status?.mode ? (
      <span className="rounded-sm bg-(--zdo-wash-active) px-hsp-sm font-mono font-semibold text-accent">
        {status.mode}
      </span>
    ) : null;
  }
  const enabled = status?.mode !== undefined;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={
        enabled ? "Vim mode is on — click to turn it off" : "Vim mode is off — click to turn it on"
      }
      className={`rounded-sm px-hsp-sm font-mono font-semibold focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
        enabled
          ? "bg-(--zdo-wash-active) text-accent"
          : "bg-(--zdo-wash-hover) text-muted hover:text-fg-mild"
      }`}
    >
      {enabled ? status?.mode : "vim off"}
    </button>
  );
}

interface EditorBodyProps {
  pageId: string | null;
  routePageId: string;
  known: boolean;
  session: PageSession | undefined;
  onChange: (markdown: string) => void;
  onStatusChange: (status: EditorPaneStatus) => void;
  onRequestSave: () => void;
  onReload: () => void;
}

function EditorBody({
  pageId,
  routePageId,
  known,
  session,
  onChange,
  onStatusChange,
  onRequestSave,
  onReload,
}: EditorBodyProps) {
  if (pageId === null) {
    return (
      <EmptyPane
        message={
          known
            ? "No page is open. Pick one from the rail to start editing."
            : `No page with id "${routePageId}" exists in this project.`
        }
      />
    );
  }
  if (!session || session.status === "loading") {
    return <EmptyPane message="Loading this page…" />;
  }
  if (session.status === "error" || !session.save) {
    return (
      <EmptyPane message={session.error?.message ?? "This page could not be loaded."}>
        <button type="button" className={BUTTON_CLASSES} onClick={onReload}>
          Try again
        </button>
      </EmptyPane>
    );
  }
  return (
    <EditorPaneSlot
      pageId={pageId}
      value={session.save.content.markdown}
      onChange={onChange}
      readOnly={session.save.status === "conflict"}
      onStatusChange={onStatusChange}
      onRequestSave={onRequestSave}
    />
  );
}

function EmptyPane({
  message,
  children,
}: {
  message: string;
  children?: ComponentChildren;
}) {
  return (
    <div className="flex size-full min-h-[0] flex-col items-center justify-center gap-vsp-xs px-hsp-xl text-center">
      <p className="text-small text-muted">{message}</p>
      {children}
    </div>
  );
}

function Banner({
  tone,
  message,
  children,
}: {
  tone: "warning" | "danger";
  message: string;
  children?: ComponentChildren;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-none items-center gap-hsp-md border-b border-border px-hsp-lg py-vsp-xs text-small text-fg ${
        tone === "danger" ? "bg-(--zdo-wash-danger)" : "bg-(--zdo-wash-warning)"
      }`}
    >
      <span className="min-w-[0] flex-1">{message}</span>
      {children}
    </div>
  );
}

/**
 * The one native dialog in the workspace. It guards a genuinely destructive,
 * irreversible action (dropping a draft the machine is still holding), which
 * is exactly the case `confirm` is for — and building a bespoke modal for it
 * would add focus-trap and stacking concerns for no gain.
 */
function confirmDiscard(): boolean {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  return window.confirm(
    "This page has unsaved edits that still need to be resolved. Closing the tab discards them. Close anyway?",
  );
}

function collectLiveFrontmatter(
  sessions: ReadonlyMap<string, PageSession>,
): ReadonlyMap<string, PageFrontmatter> {
  const overrides = new Map<string, PageFrontmatter>();
  for (const [pageId, session] of sessions) {
    if (session.save) overrides.set(pageId, session.save.content.frontmatter);
  }
  return overrides;
}
