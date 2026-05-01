import { useState, useEffect, useCallback, useRef } from "react";
import DesignTokenExportModal from "./export-modal";
import DesignTokenImportModal from "./import-modal";
import ColorTab from "./tabs/color-tab";
import FontTab from "./tabs/font-tab";
import SizeTab from "./tabs/size-tab";
import SpacingTab from "./tabs/spacing-tab";
import { usePersist } from "./state/persist";
// After zudolab/zudo-doc#1335 (E2 task 2 half B) the host components
// pull lifecycle event names from the v2 transitions module rather
// than hard-coding `astro:*` literals.
import { AFTER_NAVIGATE_EVENT } from "@zudo-doc/zudo-doc-v2/transitions";
import {
  type TweakState,
  type PanelPosition,
  DEFAULT_POSITION,
  OPEN_KEY,
  applyFullState,
  clampPosition,
  clearAppliedStyles,
  clearPersistedState,
  emptyOverrides,
  initColorFromScheme,
  loadPersistedState,
  loadPosition,
  savePersistedState,
  savePosition,
} from "./state/tweak-state";

// --- Tab configuration ---

type TabId = "spacing" | "font" | "size" | "color";

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: readonly TabDef[] = [
  { id: "spacing", label: "Spacing" },
  { id: "font", label: "Font" },
  { id: "size", label: "Size" },
  { id: "color", label: "Color" },
] as const;

const DEFAULT_TAB: TabId = "color";

// --- Panel sizing ---

/** Below this width the panel switches to narrow mode (non-draggable, centered, capped width). */
const NARROW_BREAKPOINT = 900;

function computePanelSize(viewportW: number, viewportH: number): {
  width: string;
  height: string;
  narrow: boolean;
} {
  const narrow = viewportW < NARROW_BREAKPOINT;
  if (narrow) {
    return {
      width: `min(calc(100vw - 16px), 500px)`,
      height: `min(800px, calc(100vh - 32px))`,
      narrow,
    };
  }
  return {
    width: `min(1200px, 80vw)`,
    height: `min(800px, 80vh)`,
    narrow,
  };
}

// --- Main Component ---

export default function DesignTokenTweakPanel() {
  const [open, setOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [state, setState] = useState<TweakState | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);
  const [position, setPosition] = useState<PanelPosition>(DEFAULT_POSITION);
  const [isNarrow, setIsNarrow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    spacing: null,
    font: null,
    size: null,
    color: null,
  });
  const positionRef = useRef<PanelPosition>(DEFAULT_POSITION);
  // Keep ref in sync with state for use in drag handlers (avoids stale closure)
  positionRef.current = position;
  // Track active drag listeners for cleanup on unmount
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const { persistColor, persistSpacing, persistFont, persistSize } = usePersist(setState);

  // Restore open state and position from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === "1") setOpen(true);
    } catch { /* ignore */ }
    const loaded = loadPosition();
    setPosition(loaded);
    positionRef.current = loaded;
    // Initial narrow-check
    setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
  }, []);

  // Persist open state
  useEffect(() => {
    try {
      if (open) localStorage.setItem(OPEN_KEY, "1");
      else localStorage.removeItem(OPEN_KEY);
    } catch { /* ignore */ }
  }, [open]);

  // Toggle panel via custom event from header icon (new name + deprecated alias)
  useEffect(() => {
    function handleToggle() {
      setOpen((prev) => !prev);
    }
    window.addEventListener("toggle-design-token-panel", handleToggle);
    window.addEventListener("toggle-color-tweak-panel", handleToggle);
    return () => {
      window.removeEventListener("toggle-design-token-panel", handleToggle);
      window.removeEventListener("toggle-color-tweak-panel", handleToggle);
    };
  }, []);

  // Re-initialize when the color scheme or light/dark mode changes
  useEffect(() => {
    function handleSchemeChange() {
      // Clear all inline style overrides so the new scheme's <style> tag takes effect
      clearAppliedStyles();
      setState({
        color: initColorFromScheme(),
        spacing: emptyOverrides(),
        font: emptyOverrides(),
        size: emptyOverrides(),
      });
    }
    window.addEventListener("color-scheme-changed", handleSchemeChange);
    return () =>
      window.removeEventListener("color-scheme-changed", handleSchemeChange);
  }, []);

  // Initialize state on first open
  useEffect(() => {
    if (!open || state) return;
    const persisted = loadPersistedState();
    if (persisted) {
      applyFullState(persisted);
      setState(persisted);
      return;
    }
    // No saved state — page already has correct colors from ColorSchemeProvider.
    // Just read scheme data for panel display; don't apply (avoids oklch->hex lossy conversion).
    setState({
      color: initColorFromScheme(),
      spacing: emptyOverrides(),
      font: emptyOverrides(),
      size: emptyOverrides(),
    });
  }, [open, state]);

  // Drag handler for panel header (stable — reads position from ref)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Drag disabled on narrow viewports.
    if (window.innerWidth < NARROW_BREAKPOINT) return;
    // Skip if target is a button, select, or inside one
    const target = e.target as HTMLElement;
    if (target.closest("button, select, option, [role='tab']")) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startRight = positionRef.current.right;
    const startTop = positionRef.current.top;
    const panelWidth = panelRef.current?.offsetWidth ?? 600;
    const panelHeight = panelRef.current?.offsetHeight ?? 600;

    function onMouseMove(ev: MouseEvent) {
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;
      const clamped = clampPosition(startTop + deltaY, startRight - deltaX, panelWidth, panelHeight);
      setPosition(clamped);
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      dragCleanupRef.current = null;
      savePosition(positionRef.current);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    dragCleanupRef.current = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Clean up drag listeners on unmount
  useEffect(() => {
    return () => { dragCleanupRef.current?.(); };
  }, []);

  // Re-clamp position on window resize + update narrow-mode flag
  useEffect(() => {
    function handleResize() {
      setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
      const panelWidth = panelRef.current?.offsetWidth ?? 600;
      const panelHeight = panelRef.current?.offsetHeight ?? 600;
      setPosition((prev) => {
        const clamped = clampPosition(prev.top, prev.right, panelWidth, panelHeight);
        savePosition(clamped);
        return clamped;
      });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Re-apply tweak state after View Transition page swaps
  useEffect(() => {
    function handleSwap() {
      const persisted = loadPersistedState();
      if (persisted) {
        applyFullState(persisted);
        if (state) setState(persisted);
      }
    }
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleSwap);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handleSwap);
  }, [state]);

  const handleLoadFromJson = useCallback((loaded: TweakState) => {
    // Replace the panel state with the loaded tweak, apply CSS vars, persist
    // to localStorage (v2). Unknown tokens have already been filtered out by
    // deserialize().
    applyFullState(loaded);
    savePersistedState(loaded);
    setState(loaded);
  }, []);

  const handleResetAll = useCallback(() => {
    clearPersistedState();
    clearAppliedStyles();
    setState({
      color: initColorFromScheme(),
      spacing: emptyOverrides(),
      font: emptyOverrides(),
      size: emptyOverrides(),
    });
  }, []);

  // --- Tab keyboard navigation (WAI-ARIA tablist pattern) ---
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    if (idx === -1) return;
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = TABS.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    const next = TABS[nextIdx];
    setActiveTab(next.id);
    // Move focus to the newly selected tab so SR announces it
    window.requestAnimationFrame(() => {
      tabRefs.current[next.id]?.focus();
    });
  }, [activeTab]);

  if (!open) return null;

  const { width: panelW, height: panelH, narrow } = computePanelSize(
    typeof window !== "undefined" ? window.innerWidth : 1024,
    typeof window !== "undefined" ? window.innerHeight : 768,
  );

  // In narrow mode, ignore saved position — center safely near the top.
  const panelPos = narrow || isNarrow
    ? { position: "fixed" as const, top: 16, left: "50%", transform: "translateX(-50%)", right: "auto" as const }
    : { position: "fixed" as const, top: position.top, right: position.right };

  return (
    <>
      <div
        ref={panelRef}
        className="z-50 flex flex-col border border-muted bg-surface"
        style={{
          ...panelPos,
          width: panelW,
          height: panelH,
          maxHeight: "calc(100vh - 32px)",
          borderRadius: "var(--radius-DEFAULT)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header row (expert/reset) — draggable on desktop only */}
        <div
          className="flex items-center gap-hsp-md px-hsp-xl py-vsp-xs border-b border-muted shrink-0"
          style={{ cursor: narrow || isNarrow ? "default" : "move" }}
          onMouseDown={handleDragStart}
        >
          <span className="text-fg font-semibold shrink-0" style={{ fontSize: "0.875rem" }}>
            Design Tokens
          </span>
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="text-accent hover:text-accent-hover transition-colors"
            style={{ fontSize: "0.75rem" }}
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="text-accent hover:text-accent-hover transition-colors"
            style={{ fontSize: "0.75rem" }}
          >
            Load from JSON…
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            className="text-accent hover:text-accent-hover transition-colors"
            style={{ fontSize: "0.75rem" }}
          >
            Reset
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted hover:text-fg transition-colors shrink-0"
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Design token categories"
          className="flex items-center gap-[2px] border-b border-muted px-hsp-xl shrink-0"
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[tab.id] = el; }}
                type="button"
                role="tab"
                id={`dtp-tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`dtp-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={handleTabKeyDown}
                className={`border-b-2 px-hsp-md py-vsp-xs transition-colors ${
                  isSelected
                    ? "border-accent text-fg"
                    : "border-transparent text-muted hover:text-fg hover:underline focus-visible:underline"
                }`}
                style={{ fontSize: "0.875rem" }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab panels */}
        <div className="flex-1 min-h-0 overflow-y-auto px-hsp-xl py-vsp-sm">
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                role="tabpanel"
                id={`dtp-panel-${tab.id}`}
                aria-labelledby={`dtp-tab-${tab.id}`}
                tabIndex={0}
                hidden={!isSelected}
              >
                {tab.id === "color" && state && (
                  <ColorTab state={state.color} persistColor={persistColor} />
                )}
                {tab.id === "spacing" && state && (
                  <SpacingTab state={state.spacing} persistSpacing={persistSpacing} />
                )}
                {tab.id === "font" && state && (
                  <FontTab state={state.font} persistFont={persistFont} />
                )}
                {tab.id === "size" && state && (
                  <SizeTab state={state.size} persistSize={persistSize} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showExport && state && (
        <DesignTokenExportModal
          onClose={() => setShowExport(false)}
          state={state}
          colorDefaults={initColorFromScheme()}
        />
      )}

      {showImport && state && (
        <DesignTokenImportModal
          onClose={() => setShowImport(false)}
          onLoad={handleLoadFromJson}
          colorDefaults={initColorFromScheme()}
        />
      )}
    </>
  );
}

export type { TweakState } from "./state/tweak-state";
