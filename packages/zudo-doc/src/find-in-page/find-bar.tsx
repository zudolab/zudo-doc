/** @jsxRuntime automatic */
// FindBar UI — relocated from
// `create-zudo-doc/templates/features/tauri/files/src/components/find-bar.tsx`
// into the package as part of the `findInPage` package-owned island
// (zudolab/zudo-doc#2689).

import {
  computed,
  getScope,
  Show,
  signal,
  type ReadonlySignal,
  type Ref,
} from "@takazudo/zfb/zudo-react";
import type { FindResult, FindInPage } from "./find-in-page.js";

interface FindBarProps {
  visible: ReadonlySignal<boolean>;
  onClose: () => void;
  findInPage: FindInPage;
  containerSelector: string;
}

function toMatchInfo(result: FindResult): FindResult | null {
  return result.matches > 0 ? result : null;
}

export function FindBar({ visible, onClose, findInPage, containerSelector }: FindBarProps) {
  const query = signal("");
  const matchInfo = signal<FindResult | null>(null);
  const inputRef: Ref<HTMLInputElement> = { current: null };
  const scope = getScope();

  // modelValue owns the native input event and updates this writable signal
  // while the user types, including composition updates. Search from an effect
  // so the result follows the model before blur or a native change event.
  scope.effect(() => {
    if (!visible.value) {
      query.value = "";
      matchInfo.value = null;
      findInPage.stop();
      return;
    }

    const text = query.value;
    const container = document.querySelector(containerSelector);
    if (!text || !(container instanceof HTMLElement)) {
      matchInfo.value = null;
      findInPage.stop();
      return;
    }

    matchInfo.value = toMatchInfo(findInPage.find(container, text));
  });

  scope.effect(() => {
    if (!visible.value) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  // Search marks live outside this component's DOM subtree. Clear them even
  // when the island is disposed while the bar is open.
  scope.onCleanup(() => findInPage.stop());

  const handleKeyDown = (event: Event) => {
    const keyboard = event as KeyboardEvent;
    if (keyboard.isComposing || event.defaultPrevented) return;

    if (keyboard.key === "Escape") {
      onClose();
    } else if (keyboard.key === "Enter") {
      const result = keyboard.shiftKey ? findInPage.prev() : findInPage.next();
      matchInfo.value = toMatchInfo(result);
    }
  };

  return (
    <Show when={computed(() => visible.value)}>
      {() => (
        <div class="fixed top-[3.5rem] right-0 z-dropdown flex items-center gap-hsp-sm py-hsp-xs px-hsp-md bg-surface border-b border-l border-muted rounded-bl-lg">
          <input
            ref={inputRef}
            class="w-[12rem] py-[4px] px-hsp-sm rounded text-small bg-bg border border-muted text-fg outline-none focus:border-accent"
            type="text"
            modelValue={query}
            placeholder="Find in page..."
            aria-label="Find in page"
            on:keydown={handleKeyDown}
          />
          <span class="text-caption whitespace-nowrap min-w-[3rem] text-center text-fg/60">
            {computed(() => {
              const result = matchInfo.value;
              return result
                ? `${result.activeMatchOrdinal}/${result.matches}`
                : "";
            })}
          </span>
          <button
            type="button"
            class="py-hsp-2xs px-hsp-sm rounded text-caption bg-bg border border-muted text-fg hover:bg-surface"
            on:click={() => {
              matchInfo.value = toMatchInfo(findInPage.prev());
            }}
            title="Previous (Shift+Enter)"
          >
            Prev
          </button>
          <button
            type="button"
            class="py-hsp-2xs px-hsp-sm rounded text-caption bg-bg border border-muted text-fg hover:bg-surface"
            on:click={() => {
              matchInfo.value = toMatchInfo(findInPage.next());
            }}
            title="Next (Enter)"
          >
            Next
          </button>
          <button
            type="button"
            class="py-hsp-2xs px-hsp-sm rounded text-caption bg-bg border border-muted text-fg hover:bg-surface"
            on:click={onClose}
            title="Close (Esc)"
          >
            Close
          </button>
        </div>
      )}
    </Show>
  );
}
