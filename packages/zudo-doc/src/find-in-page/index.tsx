"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// FindInPageInit — the package-owned find-in-page island (zudolab/zudo-doc#2689).
//
// Relocated from
// `create-zudo-doc/templates/features/tauri/files/src/components/find-in-page-init.tsx`
// into the package as part of the `findInPage` settings census field. Unlike
// its pre-#2689 tauri-template home (which shipped as inert reference
// material — no host ever imported it), this island is now statically
// imported and mounted by `../doc-body-end-islands/index.tsx`, gated on
// `settings.findInPage` (default `false`), mirroring how AiChatModal /
// ImageEnlarge / MermaidEnlarge are wired there.
//
// Behavior is unchanged: it self-gates on `window.__TAURI_INTERNALS__` so it
// stays a no-op outside a Tauri shell even when `findInPage` is on — Cmd/Ctrl+F
// interception only makes sense where the OS/browser doesn't already own that
// shortcut. A non-Tauri host that sets `findInPage: true` ships the island's
// (tiny) code with no visible effect.
import { useState, useEffect, useRef } from "preact/compat";
import type { JSX } from "preact";
import { FindBar } from "./find-bar.js";
import { createFindInPage } from "./find-in-page.js";

const CONTENT_SELECTOR = "article.zd-content";

/**
 * `displayName` pinned explicitly (matching
 * `AiChatModal`/`ImageEnlarge`/`MermaidEnlarge`/`DesignTokenPanelBootstrap`)
 * so zfb's `captureComponentName` emits a stable
 * `data-zfb-island="FindInPageInit"` marker independent of minification.
 */
export function FindInPageInit(): JSX.Element | null {
  const [isTauri, setIsTauri] = useState(false);
  const [visible, setVisible] = useState(false);
  const findInPageRef = useRef(createFindInPage());

  // Detect Tauri environment
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      setIsTauri(true);
    }
  }, []);

  // Intercept Cmd/Ctrl+F only in Tauri
  useEffect(() => {
    if (!isTauri) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setVisible((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isTauri]);

  // Clear search on zfb page navigation. zfb navigates via SPA body swap and
  // fires "zfb:before-preparation" on document before nav — it never fires the
  // native "pagehide" (full-unload) event. The literal is inlined because
  // downstream scaffolds do not depend on @takazudo/zudo-doc as a runtime dep
  // (same reason as the designTokenPanel bootstrap).
  useEffect(() => {
    const handler = () => {
      findInPageRef.current.stop();
      setVisible(false);
    };
    document.addEventListener("zfb:before-preparation", handler);
    return () => document.removeEventListener("zfb:before-preparation", handler);
  }, []);

  if (!isTauri) return null;

  return (
    <FindBar
      visible={visible}
      onClose={() => setVisible(false)}
      findInPage={findInPageRef.current}
      containerSelector={CONTENT_SELECTOR}
    />
  );
}
FindInPageInit.displayName = "FindInPageInit";
