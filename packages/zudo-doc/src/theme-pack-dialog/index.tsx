"use client";

/** @jsxRuntime automatic */
import { computed, For, getScope, Show, signal, type Ref } from "@takazudo/zfb/zudo-react";
import { Close } from "../icons/index.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import type { ThemePackMeta } from "../theme-packs-registry/index.js";
import { applyThemePack, DEFAULT_THEME_PACK_SLUG } from "../theme-pack-switcher/theme-pack-sync.js";
import { connectActivePackSync } from "../theme-pack-switcher/switcher-state.js";
import type { ThemePackDialogProps } from "../theme-pack-switcher/index.js";
import { modalDialog } from "../use-modal-dialog/index.js";
import { parseThemePackRegistryPayload, resolveDialogMode } from "./dialog-state.js";
import { ThemePackCard } from "./theme-pack-card.js";

type RegistryState = "idle" | "loading" | "loaded" | "error";
const COLOR_SCHEME_CHANGED_EVENT = "color-scheme-changed";
const LAUNCHER_SELECTOR = "[data-switcher-launcher]";

export function ThemePackDialog({ open, onClose, order, active, base }: ThemePackDialogProps) {
  const scope = getScope();
  const registryState = signal<RegistryState>("idle");
  const packs = signal<ThemePackMeta[] | null>(null);
  const mode = signal<"light" | "dark">("light");
  const activeSlug = signal(active);
  const retryToken = signal(0);
  const launcherFocusRef: Ref<HTMLElement> = { current: null };
  const hasBrowsablePacks = order.some((entry) => entry.slug !== DEFAULT_THEME_PACK_SLUG);

  scope.onActivate(() => connectActivePackSync((slug) => { activeSlug.value = slug; }));
  scope.onActivate(() => {
    const sync = () => { mode.value = resolveDialogMode(document.documentElement.getAttribute("data-theme")); };
    sync();
    window.addEventListener(COLOR_SCHEME_CHANGED_EVENT, sync);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED_EVENT, sync);
  });
  scope.effect(() => {
    if (open.value) launcherFocusRef.current = document.querySelector<HTMLElement>(LAUNCHER_SELECTOR);
  });

  // A close, retry, or island disposal aborts the request. An aborted first
  // load returns to idle so the next open can fetch again.
  scope.effect(() => {
    if (!open.value || !hasBrowsablePacks || packs.value !== null) return;
    retryToken.value;
    const controller = new AbortController();
    const abortFromScope = () => controller.abort();
    scope.abortSignal.addEventListener("abort", abortFromScope, { once: true });
    registryState.value = "loading";
    void fetch(`${base}theme-packs/index.json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`theme-packs/index.json responded ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (controller.signal.aborted || scope.abortSignal.aborted) return;
        const parsed = parseThemePackRegistryPayload(data);
        if (parsed === null) { registryState.value = "error"; return; }
        packs.value = parsed;
        registryState.value = "loaded";
      })
      .catch(() => {
        if (!controller.signal.aborted && !scope.abortSignal.aborted) registryState.value = "error";
      });
    return () => {
      controller.abort();
      scope.abortSignal.removeEventListener("abort", abortFromScope);
      if (registryState.value === "loading") registryState.value = "idle";
    };
  });
  const retry = () => { retryToken.value++; };
  const { dialogRef, handleBackdropClick } = modalDialog(scope, {
    isOpen: open,
    onClose,
    navigateEvent: AFTER_NAVIGATE_EVENT,
    backdropClickClose: true,
    manageFocus: true,
    returnFocusRef: launcherFocusRef,
  });

  return (
    <dialog
      ref={dialogRef}
      on:click={handleBackdropClick}
      aria-labelledby="zd-theme-pack-dialog-title"
      class="z-modal m-auto max-h-[85vh] w-[calc(100vw_-_2rem)] max-w-[64rem] rounded-lg border border-muted bg-surface p-0 text-fg backdrop:z-modal-backdrop backdrop:bg-bg/80"
    >
      <div class="flex max-h-[85vh] flex-col">
        <div class="flex shrink-0 items-center justify-between gap-hsp-sm border-b border-muted px-hsp-lg py-vsp-sm">
          <h2 id="zd-theme-pack-dialog-title" class="text-title font-bold text-fg">
            Preview theme
          </h2>
          <button
            type="button"
            on:click={() => dialogRef.current?.close()}
            aria-label="Close"
            class="flex items-center justify-center text-muted transition-colors hover:text-fg"
          >
            <Close class="h-icon-sm w-icon-sm" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-hsp-lg py-vsp-lg">
          {!hasBrowsablePacks ? (
            <p class="py-vsp-xl text-center text-small text-muted">
              No other theme packs are configured — only the default look is available.
            </p>
          ) : (
            <>
              <Show when={computed(() => registryState.value === "error")}>{() => (
                <div
                  role="alert"
                  class="mx-auto flex flex-col items-center gap-vsp-xs rounded-[0.75rem] border border-danger bg-bg px-hsp-lg py-vsp-lg text-center text-small text-danger"
                >
                  <p>Could not load theme previews.</p>
                  <button
                    type="button"
                    on:click={retry}
                    class="rounded border border-danger px-hsp-md py-hsp-2xs text-caption text-danger transition-colors hover:bg-danger/10"
                  >
                    Retry
                  </button>
                </div>
              )}</Show>
              <Show when={computed(() => registryState.value === "idle" || registryState.value === "loading")}>{() => (
                <>
                  <p role="status" class="sr-only">
                    Loading theme previews…
                  </p>
                  <div
                    aria-hidden="true"
                    class="grid grid-cols-1 gap-hsp-lg sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <For each={computed(() => order)} by={(entry) => entry.slug}>{() => (
                      <div class="h-[10rem] rounded-lg border border-muted bg-surface/50" />
                    )}</For>
                  </div>
                </>
              )}</Show>
              <Show when={computed(() => packs.value !== null)}>{() => (
                <div class="grid grid-cols-1 gap-hsp-lg sm:grid-cols-2 lg:grid-cols-3">
                  <For each={computed(() => (packs.value ?? []).map((meta) => ({ meta, key: `${meta.slug}:${mode.value}` })))} by={(item) => item.key}>{(item) => (
                    <ThemePackCard
                      meta={item.value.meta}
                      mode={mode.value}
                      isActive={computed(() => item.value.meta.slug === activeSlug.value)}
                      onSelect={() => {
                        void applyThemePack(item.value.meta.slug);
                      }}
                    />
                  )}</For>
                </div>
              )}</Show>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
ThemePackDialog.displayName = "ThemePackDialog";
