// island-types — shared prop/type contracts (and the small shared constants)
// that the structural islands relocated by epic #2344 import instead of
// inlining their own copies.
//
// Shipped from the package (S1a) so S3/S4's relocated islands
// (ai-chat-modal / doc-history / image-enlarge / mermaid-enlarge) share ONE
// definition of these shapes rather than each re-declaring them:
//   - ai-chat-modal  → ChatMessage
//   - doc-history    → DocHistoryData (+ DocHistoryEntry)
//   - image-enlarge  → EnlargeDialogProps (DIALOG_CLASS / DIALOG_STYLE)
//   - mermaid-enlarge→ MERMAID_ENLARGE_DIALOG_CLASS (+ the shared inline style)
//
// Types only + a couple of frozen constants — no node builtins, no Preact
// runtime import — so it stays importable from client islands and SSR alike.

// ── ai-chat ────────────────────────────────────────────────────────────────

/** A single turn in the AI-chat conversation. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── doc-history ──────────────────────────────────────────────────────────────

/** A single git revision entry for a document. */
export interface DocHistoryEntry {
  /** Full commit hash (use .slice(0, 7) for display). */
  hash: string;
  /** ISO 8601 date string. */
  date: string;
  /** Commit author name. */
  author: string;
  /** First line of commit message. */
  message: string;
  /** Full file content at this revision. */
  content: string;
}

/** Complete history data for a single document. */
export interface DocHistoryData {
  /** Document slug (route path). */
  slug: string;
  /** Relative file path in the repository. */
  filePath: string;
  /** Git revision entries, newest first. */
  entries: DocHistoryEntry[];
}

// ── enlarge dialogs (image + mermaid) ────────────────────────────────────────
//
// The hydrated island and its SSR fallback render into the SAME Island
// container, so they MUST agree on class string and inline style — otherwise
// the dist HTML and the post-hydration DOM disagree on size/position and the
// first interaction flashes. Sourcing both from these shared constants closes
// that drift gap.
//
// The dialog is intentionally transform-FREE (centered via position:fixed;
// inset:0; margin:auto). A `transform` on the `<dialog>` would establish a
// containing block for its `position: fixed` descendants, re-anchoring the fixed
// close button to the dialog corner instead of the viewport.
//
// `z-modal` / `backdrop:z-modal-backdrop` are defense-in-depth for the SPA-swap
// window: a still-open showModal() dialog can lose top-layer promotion when the
// page body is swapped, so the explicit modal-tier z-index keeps it above all
// chrome. Intentionally redundant in the normal top-layer case (epic #2148 /
// issue #2157).

/** Shared inline style centering an enlarge `<dialog>` transform-free. */
export const ENLARGE_DIALOG_STYLE = {
  position: "fixed",
  inset: "0",
  margin: "auto",
} as const;

/** Class string for the image-enlarge `<dialog>` (hydrated + SSR fallback). */
export const IMAGE_ENLARGE_DIALOG_CLASS =
  "zd-enlarge-dialog z-modal mx-auto max-h-[90vh] max-w-[90vw] overflow-hidden border border-muted bg-surface p-0 backdrop:z-modal-backdrop";

/** Class string for the mermaid-enlarge `<dialog>` (hydrated + SSR fallback). */
export const MERMAID_ENLARGE_DIALOG_CLASS =
  "zd-mermaid-dialog z-modal mx-auto h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] overflow-hidden border border-muted bg-surface p-0 backdrop:z-modal-backdrop";

/** Shared shape an enlarge `<dialog>` is rendered with. */
export interface EnlargeDialogProps {
  /** Tailwind class string for the `<dialog>`. */
  className: string;
  /** Inline style centering the dialog transform-free. */
  style: typeof ENLARGE_DIALOG_STYLE;
}
