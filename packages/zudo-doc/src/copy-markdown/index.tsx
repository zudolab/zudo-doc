"use client";

import { computed, getScope, signal, type Ref } from "@takazudo/zfb/zudo-react";
import { hydrationPending } from "../hydration-pending.js";
import { BEFORE_SWAP_EVENT } from "../transitions/page-events.js";

export interface CopyMarkdownSource {
  artifactUrl: string;
  pageUrl: string;
}

interface CopyMarkdownProps extends CopyMarkdownSource {
  title: string;
  description?: string;
  labels: {
    copyMarkdown: string;
    copying: string;
    copied: string;
    loadError: string;
    manualTitle: string;
    manualHint: string;
    manualError: string;
    payload: string;
    selectAll: string;
    copy: string;
    close: string;
  };
}

const outline = "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";
const button = "min-h-[44px] sm:min-h-[40px] rounded border border-muted px-hsp-md text-caption font-semibold text-fg hover:border-accent hover:bg-accent/5";

async function loadMarkdown(
  { artifactUrl, pageUrl, title, description }: CopyMarkdownProps,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(artifactUrl, { signal });
  if (!response.ok || response.headers.get("content-type")?.startsWith("text/html")) {
    throw new Error("Markdown artifact unavailable");
  }
  const body = await response.text();
  signal.throwIfAborted();
  const source = new URL(pageUrl, document.location.origin).href;
  return [`# ${title}`, `Source: ${source}`, ...(description ? [description] : []), body].join("\n\n");
}

async function writeMarkdown(
  text: string | undefined,
  loading: Promise<string>,
  isCurrent: () => boolean,
): Promise<boolean> {
  try {
    const clipboard = navigator.clipboard;
    if (!clipboard) return false;
    if (text === undefined && clipboard.write && typeof ClipboardItem === "function") {
      // WebKit requires starting the write within the click, even while the bytes are loading.
      const blob = loading.then((value) => {
        if (!isCurrent()) throw new Error("Document changed");
        return new Blob([value], { type: "text/plain" });
      });
      // The browser may reject the write before consuming the deferred blob.
      void blob.catch(() => {});
      await clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    } else {
      const value = text ?? await loading;
      if (!isCurrent()) return false;
      await clipboard.writeText(value);
    }
    return true;
  } catch {
    return false;
  }
}

export function CopyMarkdown(props: CopyMarkdownProps) {
  const { labels } = props;
  const scope = getScope();
  const pending = hydrationPending(scope, true);
  const trigger: Ref<HTMLButtonElement> = { current: null };
  const dialog: Ref<HTMLDialogElement> = { current: null };
  const textarea: Ref<HTMLTextAreaElement> = { current: null };
  const closeButton: Ref<HTMLButtonElement> = { current: null };
  const state = signal<"idle" | "copying" | "copied" | "error">("idle");
  const manualStatus = signal("");
  let payload: string | undefined;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  let activeRequest: AbortController | undefined;

  const isMounted = () => !scope.abortSignal.aborted && trigger.current?.isConnected === true;
  const selectAll = () => {
    const field = textarea.current;
    field?.focus({ preventScroll: true });
    field?.select();
  };
  const showFallback = (markdown: string) => {
    if (!dialog.current || !textarea.current) return;
    textarea.current.value = markdown;
    manualStatus.value = "";
    dialog.current.showModal();
    selectAll();
  };

  const clearPageState = () => {
    activeRequest?.abort();
    activeRequest = undefined;
    clearTimeout(resetTimer);
    dialog.current?.close();
  };

  scope.onActivate(() => {
    const onPageLeave = () => {
      clearPageState();
      state.value = "idle";
    };
    document.addEventListener(BEFORE_SWAP_EVENT, onPageLeave);
    window.addEventListener("pagehide", onPageLeave);
    return () => {
      document.removeEventListener(BEFORE_SWAP_EVENT, onPageLeave);
      window.removeEventListener("pagehide", onPageLeave);
      clearPageState();
    };
  });

  const copy = async () => {
    if (pending.value || activeRequest) return;
    const retryDialog = dialog.current?.open === true;
    const request = new AbortController();
    activeRequest = request;
    const isCurrent = () => !request.signal.aborted && isMounted();
    clearTimeout(resetTimer);
    state.value = "copying";
    if (retryDialog) manualStatus.value = labels.copying;
    const loading = payload === undefined ? loadMarkdown(props, request.signal) : Promise.resolve(payload);
    try {
      const [markdown, copied] = await Promise.all([loading, writeMarkdown(payload, loading, isCurrent)]);
      if (!isCurrent()) return;
      payload = markdown;
      if (retryDialog && !dialog.current?.open) {
        state.value = "idle";
      } else if (copied) {
        state.value = "copied";
        if (retryDialog) manualStatus.value = labels.copied;
        resetTimer = setTimeout(() => { state.value = "idle"; }, 2000);
      } else {
        state.value = "idle";
        if (retryDialog) manualStatus.value = labels.manualError;
        else showFallback(markdown);
      }
    } catch {
      if (isCurrent()) state.value = "error";
    } finally {
      if (activeRequest === request) activeRequest = undefined;
    }
  };

  const label = computed(() => state.value === "copying" ? labels.copying :
    state.value === "copied" ? labels.copied : labels.copyMarkdown);
  const busy = computed(() => state.value === "copying" ? "true" : undefined);

  return (
    <div data-zd-copy-markdown="" hidden={pending} class="mb-vsp-lg">
      <button ref={trigger} type="button" aria-disabled={busy} on:click={copy}
        class={`inline-flex max-w-full items-center gap-hsp-sm ${button} ${outline}`}>
        <svg class="h-icon-sm w-icon-sm shrink-0" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d={computed(() => state.value === "copied" ? "m5 12 4 4L19 6" :
            "M8 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3m-6 0h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z")} />
        </svg>
        <span class="inline-grid">
          {[labels.copyMarkdown, labels.copying, labels.copied].map((text) => (
            <span aria-hidden="true" class="invisible col-start-1 row-start-1">{text}</span>
          ))}
          <span class="col-start-1 row-start-1">{label}</span>
        </span>
      </button>
      <p role="status" class={computed(() => state.value === "error" ? "mt-vsp-3xs text-caption text-danger" : "sr-only")}>
        {computed(() => state.value === "error" ? labels.loadError :
          state.value === "copying" || state.value === "copied" ? label.value : "")}
      </p>
      <dialog ref={dialog} aria-label={labels.manualTitle}
        class="zd-copy-markdown-dialog m-auto overflow-auto rounded-lg border border-muted bg-surface px-hsp-lg py-vsp-xs text-fg shadow-lg"
        on:close={() => {
          if (isMounted() && !dialog.current?.open) trigger.current?.focus({ preventScroll: true });
        }}
        on:keydown={(event: KeyboardEvent) => {
          if (event.key !== "Tab") return;
          if (event.shiftKey && event.target === textarea.current) {
            event.preventDefault();
            closeButton.current?.focus();
          } else if (!event.shiftKey && event.target === closeButton.current) {
            event.preventDefault();
            textarea.current?.focus();
          }
        }}>
        <h2 class="mb-vsp-3xs text-title font-semibold">{labels.manualTitle}</h2>
        <p class="mb-vsp-xs text-small">{labels.manualHint}</p>
        <textarea ref={textarea} readonly spellcheck={false} aria-label={labels.payload}
          class={`block h-[min(42vh,20rem)] w-full resize-none rounded border border-muted bg-bg p-hsp-md font-mono text-caption ${outline}`} />
        <div class="mt-vsp-xs flex flex-wrap gap-hsp-sm">
          <button type="button" class={`${button} ${outline}`} on:click={selectAll}>{labels.selectAll}</button>
          <button type="button" class={`${button} ${outline}`} aria-disabled={busy} on:click={copy}>{labels.copy}</button>
          <button ref={closeButton} type="button" class={`${button} ${outline}`} on:click={() => dialog.current?.close()}>{labels.close}</button>
        </div>
        <p role="status" class={computed(() => manualStatus.value ? "mt-vsp-3xs text-caption" : "sr-only")}>{manualStatus}</p>
      </dialog>
    </div>
  );
}
