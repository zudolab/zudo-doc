"use client";

/** @jsxRuntime automatic */
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
// interception only makes sense where the OS/browser doesn't already own
// that shortcut.
import { computed, getScope, Show, signal } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { FindBar } from "./find-bar.js";
import { createFindInPage } from "./find-in-page.js";

const CONTENT_SELECTOR = "article.zd-content";
const BEFORE_PREPARATION_EVENT = "zfb:before-preparation";

export function FindInPageInit(): JSX.Element {
  const isTauri = signal(false);
  const visible = signal(false);
  const findInPage = createFindInPage();
  const scope = getScope();

  // Browser globals and document listeners belong to the activated island,
  // never to setup/SSR. The activation cleanup owns both Tauri's shortcut and
  // zfb's SPA-navigation event listener.
  scope.onActivate(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return;
    }

    isTauri.value = true;

    const handleKeyDown = (event: Event) => {
      const keyboard = event as KeyboardEvent;
      if (
        keyboard.isComposing ||
        event.defaultPrevented ||
        !(keyboard.metaKey || keyboard.ctrlKey) ||
        keyboard.key !== "f"
      ) {
        return;
      }

      event.preventDefault();
      visible.value = !visible.value;
    };

    const handleBeforePreparation = () => {
      findInPage.stop();
      visible.value = false;
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener(BEFORE_PREPARATION_EVENT, handleBeforePreparation);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener(BEFORE_PREPARATION_EVENT, handleBeforePreparation);
    };
  });

  return (
    <Show when={computed(() => isTauri.value)}>
      {() => (
        <FindBar
          visible={visible}
          onClose={() => {
            visible.value = false;
          }}
          findInPage={findInPage}
          containerSelector={CONTENT_SELECTOR}
        />
      )}
    </Show>
  );
}
FindInPageInit.displayName = "FindInPageInit";
