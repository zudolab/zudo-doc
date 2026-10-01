"use client";

/** @jsxRuntime automatic */
// DocHistory island — relocated from src/components/doc-history.tsx (epic #2344, S4).
// Uses the shared modal helper and types instead of re-inlining them:
//   - modalDialog from @takazudo/zudo-doc/use-modal-dialog (open/close sync, focus management)
//   - DocHistoryData / DocHistoryEntry from @takazudo/zudo-doc/island-types
//   - SmartBreak from @takazudo/zudo-doc/smart-break
//
// CSS: island-coupled .diff-* rules are now in packages/zudo-doc/src/features.css
// (moved from src/styles/global.css in this same commit).

import { computed, For, getScope, Show, signal } from "@takazudo/zfb/zudo-react";
import type { Ref } from "@takazudo/zfb/zudo-react";
import type { DocHistoryData, DocHistoryEntry } from "../island-types/index.js";
import { SmartBreak } from "../smart-break/index.js";
import { History, Close, ArrowLeft } from "../icons/index.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import { modalDialog } from "../use-modal-dialog/index.js";
import { formatDate } from "../format-date/index.js";
import type { ResolvedDateFormats } from "../settings.js";

interface DocHistoryProps {
  slug: string;
  locale?: string;
  /**
   * Display locale for revision dates, e.g. "en", "ja". Distinct from
   * `locale` above, which is a storage-path parameter used only to build
   * the fetch URL (see doc-history-area's `effectiveHistoryLocale` /
   * "omitted for the default locale" comment — do not conflate the two).
   * Populated from the page locale by doc-history-area (#4073).
   */
  displayLocale?: string;
  /**
   * Per-role date patterns already resolved for `displayLocale` by
   * `doc-history-area`. Serialized into the island's `data-props` — this
   * island has no ambient access to settings. Optional and absent-safe:
   * omitted means every role behaves as `"locale"` (#4075).
   */
  dateFormats?: ResolvedDateFormats;
  basePath?: string;
}

type PanelView = "closed" | "revisions" | "diff";

interface DiffSelection {
  older: DocHistoryEntry;
  newer: DocHistoryEntry;
}

/* ────────────────────────────────────────────
 * Spinner (matches page-loading-overlay style)
 * ──────────────────────────────────────────── */

function Spinner() {
  return (
    <div class="flex items-center justify-center py-vsp-xl">
      <span
        class="inline-block box-border rounded-full page-loading-spinner"
        style={{
          width: "48px",
          height: "48px",
          border: "5px solid var(--color-fg, #fff)",
          "border-bottom-color": "transparent",
        }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────
 * Side-by-side diff row types and builder
 * ──────────────────────────────────────────── */

interface DiffRow {
  leftLine: string | null; // null = empty (added-only row)
  rightLine: string | null; // null = empty (removed-only row)
  leftNum: number | null;
  rightNum: number | null;
  type: "context" | "removed" | "added" | "changed";
}

function buildSideBySideRows(
  changes: DiffChanges,
): DiffRow[] {
  const rows: DiffRow[] = [];
  let leftNum = 0;
  let rightNum = 0;

  let i = 0;
  while (i < changes.length) {
    const change = changes[i];
    if (!change) { i++; continue; }

    if (!change.added && !change.removed) {
      // Context lines — show on both sides
      const lines = change.value.replace(/\n$/, "").split("\n");
      for (const line of lines) {
        leftNum++;
        rightNum++;
        rows.push({ leftLine: line, rightLine: line, leftNum, rightNum, type: "context" });
      }
      i++;
    } else if (change.removed && i + 1 < changes.length) {
      const nextChange = changes[i + 1];
      if (nextChange?.added) {
        // Paired remove+add — show side by side
        const removedLines = change.value.replace(/\n$/, "").split("\n");
        const addedLines = nextChange.value.replace(/\n$/, "").split("\n");
        const maxLen = Math.max(removedLines.length, addedLines.length);
        for (let j = 0; j < maxLen; j++) {
          const left = j < removedLines.length ? (removedLines[j] ?? null) : null;
          const right = j < addedLines.length ? (addedLines[j] ?? null) : null;
          if (left !== null) leftNum++;
          if (right !== null) rightNum++;
          rows.push({
            leftLine: left,
            rightLine: right,
            leftNum: left !== null ? leftNum : null,
            rightNum: right !== null ? rightNum : null,
            type: "changed",
          });
        }
        i += 2;
      } else {
        const lines = change.value.replace(/\n$/, "").split("\n");
        for (const line of lines) {
          leftNum++;
          rows.push({ leftLine: line, rightLine: null, leftNum, rightNum: null, type: "removed" });
        }
        i++;
      }
    } else if (change.removed) {
      const lines = change.value.replace(/\n$/, "").split("\n");
      for (const line of lines) {
        leftNum++;
        rows.push({ leftLine: line, rightLine: null, leftNum, rightNum: null, type: "removed" });
      }
      i++;
    } else {
      // added
      const lines = change.value.replace(/\n$/, "").split("\n");
      for (const line of lines) {
        rightNum++;
        rows.push({ leftLine: null, rightLine: line, leftNum: null, rightNum, type: "added" });
      }
      i++;
    }
  }

  return rows;
}

/* ────────────────────────────────────────────
 * DiffViewer sub-component (side-by-side)
 * ──────────────────────────────────────────── */

// Hashes — not full file content — are the cache key so the keys stay
// short regardless of doc size. Map insertion order is the LRU.
// The diff module is lazy-imported (only loaded when the user opens the Compare
// view) to avoid eagerly bundling it into the per-page islands chunk.
import type { Change } from "diff";
type DiffChanges = Change[];
const DIFF_CACHE_LIMIT = 32;
const diffCache = new Map<string, DiffChanges>();

async function getCachedDiff(
  olderHash: string,
  newerHash: string,
  olderContent: string,
  newerContent: string,
  isCurrent: () => boolean,
): Promise<DiffChanges> {
  const key = `${olderHash}::${newerHash}`;
  const hit = diffCache.get(key);
  if (hit) {
    // Refresh recency by re-inserting at the end of the iteration order.
    diffCache.delete(key);
    diffCache.set(key, hit);
    return hit;
  }
  // Lazy-load diff — only needed after History → Compare. This keeps the
  // module out of the eager islands bundle. `diff` is an optional peer: the
  // literal `import("diff").then(onFulfilled, onRejected)` shape is what lets
  // esbuild leave it unresolved when absent instead of failing the build
  // (#4209). The rejection surfaces through DiffViewer's `.catch()` → diffError.
  const { diffLines } = await import("diff").then(
    (m) => m,
    () => {
      throw new Error('Compare requires the optional peer "diff": install it to use docHistory');
    },
  );
  // The module import cannot be aborted; a replaced comparison must not do
  // work or populate the cache after its owning scope has been disposed.
  if (!isCurrent()) throw new Error("Comparison cancelled");
  const changes = diffLines(olderContent, newerContent);
  diffCache.set(key, changes);
  if (diffCache.size > DIFF_CACHE_LIMIT) {
    const oldest = diffCache.keys().next().value;
    if (oldest !== undefined) diffCache.delete(oldest);
  }
  return changes;
}

function DiffViewer({
  selection,
  onBack,
  showBackButton,
}: {
  selection: DiffSelection;
  onBack: () => void;
  showBackButton: boolean;
}) {
  const scope = getScope();
  const changes = signal<DiffChanges | null>(null);
  const diffError = signal<string | null>(null);
  const tableRevision = signal(0);
  scope.onActivate(() => {
    let cancelled = false;
    getCachedDiff(
      selection.older.hash,
      selection.newer.hash,
      selection.older.content,
      selection.newer.content,
      () => !cancelled && !scope.abortSignal.aborted,
    ).then((result) => {
      if (!cancelled && !scope.abortSignal.aborted) {
        changes.value = result;
        tableRevision.value++;
      }
    }).catch((e: unknown) => {
      if (!cancelled && !scope.abortSignal.aborted) {
        diffError.value = e instanceof Error ? e.message : "Failed to compute diff";
      }
    });
    return () => { cancelled = true; };
  });
  const tableSnapshots = computed(() => changes.value
    ? [{ revision: tableRevision.value, rows: buildSideBySideRows(changes.value) }]
    : []);

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center gap-hsp-sm px-hsp-lg py-vsp-xs border-b border-muted">
        {showBackButton && (
          <button
            type="button"
            on:click={onBack}
            class="text-muted hover:text-fg lg:hidden"
            aria-label="Back to revisions"
          >
            <ArrowLeft class="h-icon-sm w-icon-sm" />
          </button>
        )}
        <div class="flex-1 min-w-0 flex">
          <div class="w-1/2 text-small text-muted font-mono truncate pr-hsp-sm">
            {selection.older.hash.slice(0, 7)}
          </div>
          <div class="w-1/2 text-small text-muted font-mono truncate pl-hsp-sm">
            {selection.newer.hash.slice(0, 7)}
          </div>
        </div>
      </div>

      {/* Side-by-side diff — shows a spinner while the diff module lazy-loads */}
      <Show when={computed(() => diffError.value !== null)}>
        {() => <div class="px-hsp-lg py-vsp-lg text-danger text-small">{diffError}</div>}
      </Show>
      <Show when={computed(() => !changes.value && !diffError.value)}>{() => <Spinner />}</Show>
      <div class={computed(() => `flex-1 overflow-auto${!changes.value ? " hidden" : ""}`)}>
        <For each={tableSnapshots} by={(snapshot) => snapshot.revision}>
          {(snapshot) => (
        <table class="w-full border-collapse" style={{ "table-layout": "fixed" }}>
          <colgroup>
            <col style={{ width: "2.5rem" }} />
            <col />
            <col style={{ width: "2.5rem" }} />
            <col />
          </colgroup>
          <tbody>
            {snapshot.value.rows.map((row) => {
              const leftBg =
                row.type === "removed" || row.type === "changed"
                  ? "diff-line-removed"
                  : "";
              const rightBg =
                row.type === "added" || row.type === "changed"
                  ? "diff-line-added"
                  : "";
              const leftEmpty = row.leftLine === null;
              const rightEmpty = row.rightLine === null;

              return (
                <tr class="diff-row">
                  {/* Left line number */}
                  <td class={`diff-line-num ${leftBg}`}>
                    {row.leftNum ?? ""}
                  </td>
                  {/* Left content */}
                  <td class={`diff-line-content ${leftBg}${leftEmpty ? " diff-line-empty" : ""}`}>
                    {row.leftLine ?? ""}
                  </td>
                  {/* Right line number */}
                  <td class={`diff-line-num ${rightBg}`}>
                    {row.rightNum ?? ""}
                  </td>
                  {/* Right content */}
                  <td class={`diff-line-content ${rightBg}${rightEmpty ? " diff-line-empty" : ""}`}>
                    {row.rightLine ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
          )}
        </For>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
 * RevisionList sub-component
 * ──────────────────────────────────────────── */

function RevisionList({
  entries,
  onSelectDiff,
  displayLocale,
  dateFormats,
}: {
  entries: DocHistoryEntry[];
  onSelectDiff: (selection: DiffSelection) => void;
  displayLocale?: string;
  dateFormats?: ResolvedDateFormats;
}) {
  const revisionEntries = signal(entries);
  const selectedA = signal(1); // older (default: second entry)
  const selectedB = signal(0); // newer (default: first entry)

  if (entries.length === 0) {
    return (
      <div class="px-hsp-lg py-vsp-lg text-muted text-small">
        No revision history available.
      </div>
    );
  }

  const canCompare = computed(() =>
    selectedA.value !== selectedB.value &&
    selectedA.value >= 0 &&
    selectedB.value >= 0 &&
    selectedA.value < entries.length &&
    selectedB.value < entries.length);

  function handleCompare() {
    if (!canCompare.value) return;
    const idxOlder = Math.max(selectedA.value, selectedB.value);
    const idxNewer = Math.min(selectedA.value, selectedB.value);
    const olderEntry = entries[idxOlder];
    const newerEntry = entries[idxNewer];
    if (!olderEntry || !newerEntry) return;
    onSelectDiff({
      older: olderEntry,
      newer: newerEntry,
    });
  }

  return (
    <div class="flex flex-col h-full">
      {/* Compare bar */}
      {entries.length >= 2 && (
        <div class="px-hsp-lg py-vsp-xs border-b border-muted flex items-center gap-hsp-sm">
          <button
            type="button"
            disabled={computed(() => !canCompare.value)}
            on:click={handleCompare}
            class={computed(() =>
              canCompare.value
                ? "px-hsp-md py-vsp-2xs text-small rounded bg-accent text-bg hover:bg-accent-hover"
                : "px-hsp-md py-vsp-2xs text-small rounded bg-surface text-muted cursor-not-allowed"
            )}
          >
            Compare
          </button>
          <span class="text-caption text-muted">
            Select two revisions (A / B)
          </span>
        </div>
      )}

      {/* Revision entries */}
      <div class="flex-1 overflow-auto">
        <For each={revisionEntries} by={(entry) => entry.hash}>{(entry, idx) => {
          const isA = computed(() => selectedA.value === idx.value);
          const isB = computed(() => selectedB.value === idx.value);
          // Renders in UTC (via the shared formatter) rather than the
          // visitor's local time zone — a deliberate correction over the
          // previous ambient-browser-locale-dependent formatting, not a
          // regression. A visitor at a negative UTC offset may see the date
          // shift by one day versus the prior behavior; the wave-6
          // default-parity gate exempts doc-history on this basis (#4073).
          const dateStr = formatDate(
            entry.value.date,
            displayLocale ?? "en",
            dateFormats?.full,
          );

          return (
            <div
              class={computed(() =>
                isA.value || isB.value
                  ? "px-hsp-lg py-vsp-xs border-b border-muted bg-surface"
                  : "px-hsp-lg py-vsp-xs border-b border-muted hover:bg-surface"
              )}
            >
              <div class="flex items-start gap-hsp-sm">
                {/* Selection badges */}
                {entries.length >= 2 && (
                  <div class="flex flex-col gap-vsp-2xs pt-[2px] shrink-0">
                    <button
                      type="button"
                      on:click={() => { selectedA.value = idx.value; }}
                      class={computed(() =>
                        isA.value
                          ? "w-[1.5rem] h-[1.25rem] text-caption rounded flex items-center justify-center bg-accent text-bg"
                          : "w-[1.5rem] h-[1.25rem] text-caption rounded flex items-center justify-center border border-muted text-muted hover:border-fg hover:text-fg"
                      )}
                      aria-label={`Select revision ${entry.value.hash.slice(0, 7)} as A`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      on:click={() => { selectedB.value = idx.value; }}
                      class={computed(() =>
                        isB.value
                          ? "w-[1.5rem] h-[1.25rem] text-caption rounded flex items-center justify-center bg-accent text-bg"
                          : "w-[1.5rem] h-[1.25rem] text-caption rounded flex items-center justify-center border border-muted text-muted hover:border-fg hover:text-fg"
                      )}
                      aria-label={`Select revision ${entry.value.hash.slice(0, 7)} as B`}
                    >
                      B
                    </button>
                  </div>
                )}

                {/* Revision info */}
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-hsp-sm">
                    <code class="text-caption text-accent font-mono">
                      {entry.value.hash.slice(0, 7)}
                    </code>
                    <span class="text-caption text-muted">{dateStr}</span>
                  </div>
                  <div class="text-small text-fg mt-vsp-2xs truncate">
                    <SmartBreak>{entry.value.message}</SmartBreak>
                  </div>
                  <div class="text-caption text-muted">{entry.value.author}</div>
                </div>
              </div>
            </div>
          );
        }}</For>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
 * Main DocHistory component
 * ──────────────────────────────────────────── */

export function DocHistory({
  slug,
  locale,
  basePath = "/",
  displayLocale,
  dateFormats,
}: DocHistoryProps) {
  const scope = getScope();
  const view = signal<PanelView>("closed");
  const data = signal<DocHistoryData | null>(null);
  const loading = signal(false);
  const error = signal<string | null>(null);
  const diffSelection = signal<DiffSelection | null>(null);
  // Holds the history trigger button element captured in handleOpen() so the
  // helper can restore focus to it when the dialog closes. Capture it in the
  // click handler so the connected trigger remains the return target (#2295).
  const returnFocusRef: Ref<HTMLElement> = { current: null };

  const base = basePath.replace(/\/+$/, "");
  // Doc-history storage sentinel ("" -> "index"): a root index page has the
  // canonical route slug "" (→ /docs/), but the per-page JSON is stored/served
  // under "index" (an empty path segment is unroutable — the server regex
  // /^\/doc-history\/(.+)\.json$/ rejects ""). The host wrapper already passes
  // the sentineled slug, but defend the boundary so the component is correct
  // for any caller. Mirrors `toHistorySlug` in @takazudo/zudo-doc/slug (inlined here
  // rather than imported to keep this bundled island free of host-util
  // coupling — see .template-drift-allowlist). (#1891)
  const historySlug = slug === "" ? "index" : slug;
  const fetchPath = locale
    ? `${base}/doc-history/${locale}/${historySlug}.json`
    : `${base}/doc-history/${historySlug}.json`;

  let fetchController: AbortController | null = null;
  let fetchRun = 0;
  const fetchHistory = async () => {
    if (data.value || loading.value) return;
    fetchController?.abort();
    const controller = new AbortController();
    fetchController = controller;
    const run = ++fetchRun;
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(fetchPath, { signal: controller.signal });
      if (controller.signal.aborted || scope.abortSignal.aborted || run !== fetchRun) return;
      if (!res.ok) {
        throw new Error(`Failed to load history (${res.status})`);
      }
      const json: DocHistoryData = await res.json();
      if (controller.signal.aborted || scope.abortSignal.aborted || run !== fetchRun) return;
      if (!json || !Array.isArray(json.entries)) {
        throw new Error("Malformed history response");
      }
      data.value = json;
    } catch (e) {
      if (!controller.signal.aborted && !scope.abortSignal.aborted && run === fetchRun)
        error.value = e instanceof Error ? e.message : "Failed to load history";
    } finally {
      if (!scope.abortSignal.aborted && run === fetchRun) loading.value = false;
    }
  };
  scope.onActivate(() => () => { fetchController?.abort(); fetchRun++; });

  function handleOpen(e: Event) {
    // Capture the trigger so the dialog hook can restore focus to it on close
    // (a11y #2295). The button now stays mounted while the panel is open (see
    // the render below), so this ref stays a *connected* node — required for
    // .focus() to actually land on close (zudolab/zudo-doc#2303).
    returnFocusRef.current = e.currentTarget as HTMLButtonElement;
    view.value = "revisions";
    void fetchHistory();
  }

  const handleClose = () => {
    view.value = "closed";
    diffSelection.value = null;
    fetchController?.abort();
    fetchRun++;
    loading.value = false;
  };

  function handleSelectDiff(selection: DiffSelection) {
    diffSelection.value = selection;
    view.value = "diff";
  }

  function handleBackToRevisions() {
    diffSelection.value = null;
    view.value = "revisions";
  }

  // Lock body scroll when panel is open
  scope.effect(() => {
    if (view.value === "closed") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  });

  const isOpen = computed(() => view.value !== "closed");
  const hasDiff = computed(() => view.value === "diff" && diffSelection.value !== null);
  const diffPairs = computed(() => diffSelection.value && view.value === "diff"
    ? [{ key: `${diffSelection.value.older.hash}:${diffSelection.value.newer.hash}`, selection: diffSelection.value }]
    : []);

  // Shared dialog lifecycle: showModal/close sync, native-close callback,
  // and navigation-close — delegated to modalDialog.
  // manageFocus: move focus to the close button on open, restore to the
  // history trigger button on close (a11y interaction #2295).
  // returnFocusRef: pre-captured, still-connected trigger element.
  const { dialogRef } = modalDialog(scope, {
    isOpen,
    onClose: handleClose,
    navigateEvent: AFTER_NAVIGATE_EVENT,
    manageFocus: true,
    returnFocusRef,
  });

  return (
    <>
      {/* History button. Kept mounted even while the panel is open: it sits
          behind the full-screen showModal() dialog, which renders the rest of
          the document inert, so the button is neither visible nor tabbable
          while open. It must stay mounted so `returnFocusRef` (captured in
          handleOpen) remains a *connected* node — the dialog hook restores
          focus to it on close (a11y #2295). Conditionally unmounting it
          (the old `{!isOpen && …}`) left the ref pointing at a detached node,
          so `.focus()` no-op'd and focus fell to <body> on close
          (zudolab/zudo-doc#2303). */}
      <div class="flex justify-end mt-vsp-xl">
        <button
          type="button"
          on:click={handleOpen}
          data-doc-history-trigger=""
          class="flex items-center gap-hsp-xs px-hsp-md py-vsp-xs rounded-lg bg-surface border border-muted text-muted hover:text-accent hover:border-accent focus-visible:text-accent focus-visible:border-accent transition-colors"
          aria-label="View document history"
        >
          <History class="h-icon-md w-icon-md" />
          <span class="text-small">History</span>
        </button>
      </div>

      {/* Full-screen dialog — renders in top layer, above all stacking contexts */}
      {/* z-modal / backdrop:z-modal-backdrop are defense-in-depth for the
          SPA-swap window (zfb Strategy-B `zfb:after-swap`): clicking a history
          entry link swaps the page body while this dialog is still open, and a
          native showModal() dialog can momentarily lose top-layer promotion and
          fall back to z-index:auto, flashing behind the header/sidebar. The
          explicit modal-tier z-index keeps it above all chrome during that
          window. Intentionally redundant in the normal (top-layer) case — do
          not remove as "redundant" (epic #2148 / issue #2157). */}
      <dialog
        ref={dialogRef}
        aria-label="Document revision history"
        data-doc-history-panel=""
        class="z-modal fixed inset-0 m-0 h-full w-full max-h-full max-w-full bg-bg border-none p-0 backdrop:z-modal-backdrop backdrop:bg-bg/30"
        style={{ color: "var(--color-fg)" }}
      >
        {/* Panel header */}
        <div class="flex items-center justify-between px-hsp-lg py-vsp-xs border-b border-muted">
          <h2 class="text-body font-semibold text-fg">
            {computed(() => view.value === "diff" ? "Diff" : "Revision History")}
          </h2>
          <button
            type="button"
            on:click={handleClose}
            class="text-muted hover:text-fg"
            aria-label="Close history panel"
          >
            <Close class="h-icon-md w-icon-md" />
          </button>
        </div>

        {/* Panel body */}
        <div class="h-[calc(100%_-_3rem)] overflow-hidden">
          <Show when={loading}>{() => <Spinner />}</Show>

          <Show when={computed(() => error.value !== null)}>
            {() => <div class="px-hsp-lg py-vsp-lg text-danger text-small">{error}</div>}
          </Show>

          {/* Difit-style LR split: revision sidebar | diff area */}
          <Show when={computed(() => !loading.value && !error.value && data.value !== null)}>{() => (
            <div class="flex h-full">
              {/* Left sidebar: revision list — always visible on lg */}
              <div
                class={computed(() =>
                  hasDiff.value
                    ? "hidden lg:flex lg:flex-col lg:w-[clamp(16rem,25%,22rem)] shrink-0 border-r border-muted h-full"
                    : "flex flex-col w-full h-full"
                )}
              >
                <RevisionList
                  entries={data.value!.entries}
                  onSelectDiff={handleSelectDiff}
                  displayLocale={displayLocale}
                  dateFormats={dateFormats}
                />
              </div>

              {/* Right: diff viewer (on mobile, replaces the sidebar) */}
              <Show when={hasDiff}>{() => (
                <div class="flex-1 min-w-0 h-full">
                  {/* Key on the compared pair forces a fresh mount whenever the
                      selection changes, so the previous pair's diff rows can
                      never render under the new header hashes while the lazy
                      diff recompute is in flight (#2068). */}
                  <For each={diffPairs} by={(pair) => pair.key}>{(pair) => (
                    <DiffViewer selection={pair.value.selection} onBack={handleBackToRevisions} showBackButton={true} />
                  )}</For>
                </div>
              )}</Show>
            </div>
          )}</Show>
        </div>
      </dialog>
    </>
  );
}

DocHistory.displayName = "DocHistory";
