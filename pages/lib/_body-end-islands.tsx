/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side body-end islands helper.
//
// Wave 8 (Path A — super-epic #1333 / child epic #1355) drops the local
// SSR-skip wrapper functions in `@zudo-doc/zudo-doc-v2/ssr-skip` and uses
// zfb's native `<Island ssrFallback={...}>` API directly with the real
// component constructors imported by the host.
//
// The previous indirection (page → wrapper → placeholder div) created an
// orphan-component bug: the real components were `"use client"` modules
// that no page module ever imported transitively, so zfb's island scanner
// never walked page → real-component, the manifest never bound the marker
// to the real constructor, and the bundle never contained the real
// component body. PR #150 to zfb fixed the marker-name alignment but the
// orphan problem stayed — see issue zudolab/zudo-doc#1355 Wave 7 report.
//
// This helper is the page → real-component import chain the scanner
// needs. Each island below is composed with zfb's `<Island>` wrapper,
// which emits `<div data-zfb-island-skip-ssr="<ComponentName>">…</div>`
// at SSR (zfb's `captureComponentName` derives the marker from
// `child.displayName ?? child.name`). Because the page imports this
// file, and this file imports the real components, the scanner walks
// page → helper → real component and registers the constructor under
// the SSR marker name.
//
// Pattern mirrors `_header-with-defaults.tsx`: the JSX-shim widens
// `Island`'s return type to `unknown`, so call-sites cast through
// `as unknown as VNode` at the boundary.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";

import AiChatModal from "@/components/ai-chat-modal";
import DesignTokenTweakPanel from "@/components/design-token-tweak";
import ImageEnlarge from "@/components/image-enlarge";

// Set explicit `displayName` on each default-exported island so zfb's
// `captureComponentName` produces a stable marker even after the SSR
// pipeline runs the components through a function-name-rewriting layer.
// The marker must match the third-arg literal that zfb's scanner records
// for the same source-level identifier (zfb PR #150). esbuild preserves
// function names by default, but the explicit assignment is a
// belt-and-braces guard for production minification regressions.
(AiChatModal as { displayName?: string }).displayName = "AiChatModal";
(DesignTokenTweakPanel as { displayName?: string }).displayName =
  "DesignTokenTweakPanel";
(ImageEnlarge as { displayName?: string }).displayName = "ImageEnlarge";

/**
 * Default sr-only label rendered as the AiChatModal SSR fallback. This
 * mirrors the body-label string the deleted `AiChatModalIsland` wrapper
 * produced verbatim, so the migration-check parity harness still finds
 * the literal text in SSG output and assistive tech can discover the
 * chat entrypoint before JS hydration. English-only for now — the
 * previous default was also English-only; pass `aiChatBodyLabel` to
 * localise.
 */
const DEFAULT_AI_CHAT_BODY_LABEL = "Ask a question about the documentation.";

/** Props for {@link BodyEndIslands}. */
export interface BodyEndIslandsProps {
  /** Base path the AI chat modal uses to construct API URLs. */
  basePath: string;
  /**
   * Sr-only label rendered as the AiChatModal SSR fallback. Defaults to
   * the English string. Pass a locale-translated string for non-default
   * locales so screen readers announce the chat entrypoint correctly
   * before hydration.
   */
  aiChatBodyLabel?: string;
}

/**
 * The three default body-end islands every doc page mounts: the
 * design-token tweak panel (overlay, fixed-position), the AI chat
 * modal (`<dialog>` overlay), and the image-enlarge dialog (mounted
 * lazily based on viewport scan).
 *
 * Each island is wrapped in `<Island ssrFallback>` so the heavy
 * component is NOT evaluated server-side — they depend on
 * `dialog.showModal()`, `localStorage`, `ResizeObserver`, runtime
 * fetch, etc. The hydration runtime swaps each placeholder on the
 * client.
 *
 * The `<h2 class="sr-only">AI Assistant</h2>` heading is preserved
 * verbatim from the previous v2-default fallback because the
 * migration-check parity harness greps the literal heading text in
 * SSG output.
 */
export function BodyEndIslands({
  basePath,
  aiChatBodyLabel = DEFAULT_AI_CHAT_BODY_LABEL,
}: BodyEndIslandsProps): JSX.Element {
  const designToken = Island({
    ssrFallback: null,
    children: <DesignTokenTweakPanel />,
  }) as unknown as VNode;

  // Use a visually-hidden paragraph as the AiChatModal SSR fallback so
  // the body label is present in static HTML for screen readers and
  // migration-check parity. sr-only keeps it invisible to sighted users.
  const aiChat = Island({
    ssrFallback: <p class="sr-only">{aiChatBodyLabel}</p>,
    children: <AiChatModal basePath={basePath} />,
  }) as unknown as VNode;

  const imageEnlarge = Island({
    when: "idle",
    ssrFallback: null,
    children: <ImageEnlarge />,
  }) as unknown as VNode;

  return (
    <>
      {designToken}
      {/* Preserves migration-check parity: the Astro build SSR-rendered
          <h2>AI Assistant</h2> inside the chat modal markup; the checker
          matches the literal heading text. */}
      <h2 class="sr-only">AI Assistant</h2>
      {aiChat}
      {imageEnlarge}
    </>
  );
}
