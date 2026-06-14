"use client";

// preact/compat shim — see src/components/ai-chat-modal.tsx for rationale.
import { useState, useEffect, useCallback, useMemo, useRef } from "preact/compat";
import type { DocHistoryData, DocHistoryEntry } from "@/types/doc-history";
import { SmartBreak } from "@/utils/smart-break";
import { History, Close, ArrowLeft } from "@takazudo/zudo-doc/icons";
// After zudolab/zudo-doc#1335 (E2 task 2 half B) the host components
// pull lifecycle event names from the v2 transitions module rather
// than hard-coding `astro:*` literals.
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import { useModalDialog } from "@/hooks/use-modal-dialog";

interface DocHistoryProps {
  slug: string;
  locale?: string;
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
    <div className="flex items-center justify-center py-vsp-xl">
      <span
        className="inline-block box-border rounded-full animate-spin"
        style={{
          width: 48,
          height: 48,
          border: "5px solid var(--color-fg, #fff)",
          borderBottomColor: "transparent",
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
  // module out of the eager islands bundle.
  const { diffLines } = await import("diff");
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
  const [changes, setChanges] = useState<DiffChanges | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCachedDiff(
      selection.older.hash,
      selection.newer.hash,
      selection.older.content,
      selection.newer.content,
    ).then((result) => {
      if (!cancelled) setChanges(result);
    });
    return () => { cancelled = true; };
  }, [selection.older.hash, selection.newer.hash]);

  const rows = useMemo(
    () => (changes ? buildSideBySideRows(changes) : []),
    [changes],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-hsp-sm px-hsp-lg py-vsp-xs border-b border-muted">
        {showBackButton && (
          <button
            type="button"
            onClick={onBack}
            className="text-muted hover:text-fg lg:hidden"
            aria-label="Back to revisions"
          >
            <ArrowLeft className="h-icon-sm w-icon-sm" />
          </button>
        )}
        <div className="flex-1 min-w-0 flex">
          <div className="w-1/2 text-small text-muted font-mono truncate pr-hsp-sm">
            {selection.older.hash.slice(0, 7)}
          </div>
          <div className="w-1/2 text-small text-muted font-mono truncate pl-hsp-sm">
            {selection.newer.hash.slice(0, 7)}
          </div>
        </div>
      </div>

      {/* Side-by-side diff — shows a spinner while the diff module lazy-loads */}
      {!changes && <Spinner />}
      <div className={`flex-1 overflow-auto${!changes ? " hidden" : ""}`}>
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "2.5rem" }} />
            <col />
            <col style={{ width: "2.5rem" }} />
            <col />
          </colgroup>
          <tbody>
            {rows.map((row, idx) => {
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
                <tr key={idx} className="diff-row">
                  {/* Left line number */}
                  <td className={`diff-line-num ${leftBg}`}>
                    {row.leftNum ?? ""}
                  </td>
                  {/* Left content */}
                  <td className={`diff-line-content ${leftBg}${leftEmpty ? " diff-line-empty" : ""}`}>
                    {row.leftLine ?? ""}
                  </td>
                  {/* Right line number */}
                  <td className={`diff-line-num ${rightBg}`}>
                    {row.rightNum ?? ""}
                  </td>
                  {/* Right content */}
                  <td className={`diff-line-content ${rightBg}${rightEmpty ? " diff-line-empty" : ""}`}>
                    {row.rightLine ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
}: {
  entries: DocHistoryEntry[];
  onSelectDiff: (selection: DiffSelection) => void;
}) {
  const [selectedA, setSelectedA] = useState<number>(1); // older (default: second entry)
  const [selectedB, setSelectedB] = useState<number>(0); // newer (default: first entry)

  if (entries.length === 0) {
    return (
      <div className="px-hsp-lg py-vsp-lg text-muted text-small">
        No revision history available.
      </div>
    );
  }

  const canCompare =
    selectedA !== selectedB &&
    selectedA >= 0 &&
    selectedB >= 0 &&
    selectedA < entries.length &&
    selectedB < entries.length;

  function handleCompare() {
    if (!canCompare) return;
    const idxOlder = Math.max(selectedA, selectedB);
    const idxNewer = Math.min(selectedA, selectedB);
    const olderEntry = entries[idxOlder];
    const newerEntry = entries[idxNewer];
    if (!olderEntry || !newerEntry) return;
    onSelectDiff({
      older: olderEntry,
      newer: newerEntry,
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compare bar */}
      {entries.length >= 2 && (
        <div className="px-hsp-lg py-vsp-xs border-b border-muted flex items-center gap-hsp-sm">
          <button
            type="button"
            disabled={!canCompare}
            onClick={handleCompare}
            className={
              canCompare
                ? "px-hsp-md py-vsp-2xs text-small rounded bg-accent text-bg hover:bg-accent-hover"
                : "px-hsp-md py-vsp-2xs text-small rounded bg-surface text-muted cursor-not-allowed"
            }
          >
            Compare
          </button>
          <span className="text-caption text-muted">
            Select two revisions (A / B)
          </span>
        </div>
      )}

      {/* Revision entries */}
      <div className="flex-1 overflow-auto">
        {entries.map((entry, idx) => {
          const isA = selectedA === idx;
          const isB = selectedB === idx;
          const dateStr = formatDate(entry.date);

          return (
            <div
              key={entry.hash}
              className={
                isA || isB
                  ? "px-hsp-lg py-vsp-xs border-b border-muted bg-surface"
                  : "px-hsp-lg py-vsp-xs border-b border-muted hover:bg-surface"
              }
            >
              <div className="flex items-start gap-hsp-sm">
                {/* Selection badges */}
                {entries.length >= 2 && (
                  <div className="flex flex-col gap-vsp-2xs pt-[2px] shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedA(idx)}
                      className={
                        isA
                          ? "w-[1.5rem] h-[1.25rem] text-caption rounded flex items-center justify-center bg-accent text-bg"
                          : "w-[1.5rem] h-[1.25rem] text-caption rounded flex items-center justify-center border border-muted text-muted hover:border-fg hover:text-fg"
                      }
                      aria-label={`Select revision ${entry.hash.slice(0, 7)} as A`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedB(idx)}
                      className={
                        isB
                          ? "w-[1.5rem] h-[1.25rem] text-caption rounded flex items-center justify-center bg-accent text-bg"
                          : "w-[1.5rem] h-[1.25rem] text-caption rounded flex items-center justify-center border border-muted text-muted hover:border-fg hover:text-fg"
                      }
                      aria-label={`Select revision ${entry.hash.slice(0, 7)} as B`}
                    >
                      B
                    </button>
                  </div>
                )}

                {/* Revision info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-hsp-sm">
                    <code className="text-caption text-accent font-mono">
                      {entry.hash.slice(0, 7)}
                    </code>
                    <span className="text-caption text-muted">{dateStr}</span>
                  </div>
                  <div className="text-small text-fg mt-vsp-2xs truncate">
                    <SmartBreak>{entry.message}</SmartBreak>
                  </div>
                  <div className="text-caption text-muted">{entry.author}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
 * Date formatter
 * ──────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ────────────────────────────────────────────
 * Main DocHistory component
 * ──────────────────────────────────────────── */

export function DocHistory({ slug, locale, basePath = "/" }: DocHistoryProps) {
  const [view, setView] = useState<PanelView>("closed");
  const [data, setData] = useState<DocHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffSelection, setDiffSelection] = useState<DiffSelection | null>(
    null,
  );

  const base = basePath.replace(/\/+$/, "");
  // Doc-history storage sentinel ("" -> "index"): a root index page has the
  // canonical route slug "" (→ /docs/), but the per-page JSON is stored/served
  // under "index" (an empty path segment is unroutable — the server regex
  // /^\/doc-history\/(.+)\.json$/ rejects ""). The host wrapper already passes
  // the sentineled slug, but defend the boundary so the component is correct
  // for any caller. Mirrors `toHistorySlug` in @/utils/slug (inlined here
  // rather than imported to keep this bundled island free of host-util
  // coupling — see .template-drift-allowlist). (#1891)
  const historySlug = slug === "" ? "index" : slug;
  const fetchPath = locale
    ? `${base}/doc-history/${locale}/${historySlug}.json`
    : `${base}/doc-history/${historySlug}.json`;

  const fetchHistory = useCallback(async () => {
    if (data) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(fetchPath);
      if (!res.ok) {
        throw new Error(`Failed to load history (${res.status})`);
      }
      const json: DocHistoryData = await res.json();
      if (!json || !Array.isArray(json.entries)) {
        throw new Error("Malformed history response");
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [data, fetchPath]);

  function handleOpen() {
    setView("revisions");
    fetchHistory();
  }

  const handleClose = useCallback(() => {
    setView("closed");
    setDiffSelection(null);
  }, []);

  function handleSelectDiff(selection: DiffSelection) {
    setDiffSelection(selection);
    setView("diff");
  }

  function handleBackToRevisions() {
    setDiffSelection(null);
    setView("revisions");
  }

  // Lock body scroll when panel is open
  useEffect(() => {
    if (view !== "closed") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [view]);

  const isOpen = view !== "closed";
  const hasDiff = view === "diff" && diffSelection;

  // Shared dialog lifecycle: showModal/close sync, native-close callback,
  // and navigation-close — delegated to useModalDialog.
  const { dialogRef } = useModalDialog({
    isOpen,
    onClose: handleClose,
    navigateEvent: AFTER_NAVIGATE_EVENT,
  });

  return (
    <>
      {/* History button */}
      {!isOpen && (
        <div className="flex justify-end mt-vsp-xl">
          <button
            type="button"
            onClick={handleOpen}
            className="doc-history-trigger flex items-center gap-hsp-xs px-hsp-md py-vsp-xs rounded-lg bg-surface border border-muted text-muted hover:text-fg hover:border-fg transition-colors"
            aria-label="View document history"
          >
            <History className="h-icon-md w-icon-md" />
            <span className="text-small">History</span>
          </button>
        </div>
      )}

      {/* Full-screen dialog — renders in top layer, above all stacking contexts */}
      <dialog
        ref={dialogRef}
        aria-label="Document revision history"
        className="doc-history-panel fixed inset-0 m-0 h-full w-full max-h-full max-w-full bg-bg border-none p-0 backdrop:bg-bg/30"
        style={{ color: "var(--color-fg)" }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-hsp-lg py-vsp-xs border-b border-muted">
          <h2 className="text-body font-semibold text-fg">
            {view === "diff" ? "Diff" : "Revision History"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted hover:text-fg"
            aria-label="Close history panel"
          >
            <Close className="h-icon-md w-icon-md" />
          </button>
        </div>

        {/* Panel body */}
        <div className="h-[calc(100%-3rem)] overflow-hidden">
          {loading && <Spinner />}

          {error && (
            <div className="px-hsp-lg py-vsp-lg text-danger text-small">
              {error}
            </div>
          )}

          {/* Difit-style LR split: revision sidebar | diff area */}
          {!loading && !error && data && (
            <div className="flex h-full">
              {/* Left sidebar: revision list — always visible on lg */}
              <div
                className={
                  hasDiff
                    ? "hidden lg:flex lg:flex-col lg:w-[clamp(16rem,25%,22rem)] shrink-0 border-r border-muted h-full"
                    : "flex flex-col w-full h-full"
                }
              >
                <RevisionList
                  entries={data.entries}
                  onSelectDiff={handleSelectDiff}
                />
              </div>

              {/* Right: diff viewer (on mobile, replaces the sidebar) */}
              {hasDiff && (
                <div className="flex-1 min-w-0 h-full">
                  {/* Key on the compared pair forces a fresh mount whenever the
                      selection changes, so the previous pair's diff rows can
                      never render under the new header hashes while the lazy
                      diff recompute is in flight (#2068). */}
                  <DiffViewer
                    key={`${diffSelection.older.hash}:${diffSelection.newer.hash}`}
                    selection={diffSelection}
                    onBack={handleBackToRevisions}
                    showBackButton={true}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
