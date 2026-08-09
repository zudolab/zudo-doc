/**
 * The CodeMirror 6 configuration for the markdown buffer: theme, syntax
 * colours, compartments, and the vim integration.
 *
 * Four decisions here are load-bearing.
 *
 * **Every colour is a `var(--zdo-*)` reference, never a literal.** That is
 * what makes a light↔dark flip cost ZERO editor reconfiguration: the theme is
 * injected once as a stylesheet whose declarations point at custom
 * properties, and `tokens.css` resolves those through `light-dark()` off
 * `documentElement.style.colorScheme`. Hardcode one hex here and the editor
 * becomes the single surface in the app that needs to be rebuilt on a theme
 * change — see the design-system skill, which mandates the var-only rule for
 * exactly this reason. `editor-theme.test.ts` enforces it.
 *
 * **`basicSetup` ships `defaultHighlightStyle`, whose token colours are fixed
 * light-mode hexes** (`#708`, `#219`, …). Left alone they are unreadable on
 * the dark palette. `syntaxHighlighting(defaultHighlightStyle, {fallback:
 * true})` yields to any non-fallback highlighter, so defining our own
 * token-backed `HighlightStyle` displaces it wholesale rather than fighting
 * it with specificity.
 *
 * **`vim()` is the FIRST extension in the array.** CodeMirror resolves
 * same-precedence extensions in array order, so anything ahead of vim would
 * see keys first — and `basicSetup`'s `defaultKeymap` binding plain letters
 * to nothing in particular is precisely what normal-mode navigation must
 * outrank. The compartment holding it keeps that position when vim is
 * toggled, which a bare conditional in the array would not.
 *
 * **Compartments are the only way to change a running editor's config.**
 * There is no add/removeExtension API; a compartment is a placeholder whose
 * contents a transaction can swap without touching document, selection,
 * scroll position or undo history. `theme` and `wrap` are compartmented even
 * though nothing reconfigures them today — see `createEditorCompartments`.
 */

import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting, type TagStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { Vim, getCM, vim } from "@replit/codemirror-vim";
import { basicSetup } from "codemirror";
import {
  VIM_MODE_STORAGE_KEY,
  readStoredValue,
  writeStoredValue,
  type KeyValueStorage,
} from "./persistence";

/**
 * Geometry and type sizing. Colours go through `--zdo-*` role tokens, which
 * are declared in `tokens.css`'s bare `:root` and are therefore always
 * present. The spacing/typography tokens live in Tailwind's `@theme` block,
 * which prunes unused keys, so each reference carries the same value as a
 * fallback rather than relying on some unrelated utility keeping it alive.
 */
export const editorThemeSpec = {
  "&": {
    height: "100%",
    // The pane's own token background shows through — the editor must not
    // paint a second, subtly different one over it.
    backgroundColor: "transparent",
    color: "var(--zdo-fg)",
    fontSize: "var(--text-scale-sm, 0.875rem)",
  },
  "&.cm-focused": {
    outline: "2px solid var(--zdo-accent)",
    outlineOffset: "-2px",
  },
  ".cm-scroller": {
    fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace)',
    lineHeight: "var(--zdo-editor-leading, 1.6)",
  },
  ".cm-content": {
    padding: "var(--spacing-vsp-sm, 0.75rem) 0",
    caretColor: "var(--zdo-accent)",
  },
  ".cm-line": {
    padding: "0 var(--spacing-hsp-lg, 1rem)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--zdo-muted)",
    border: "none",
    paddingRight: "var(--spacing-hsp-xs, 0.25rem)",
  },
  ".cm-foldGutter .cm-gutterElement": {
    color: "var(--zdo-muted)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklch, var(--zdo-accent) 6%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklch, var(--zdo-accent) 6%, transparent)",
    color: "var(--zdo-fg-mild)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--zdo-accent)",
    borderLeftWidth: "2px",
  },
  // Vim's block cursor. Unfocused it becomes an outline so two panes are
  // never both claiming to hold the caret.
  ".cm-fat-cursor": {
    backgroundColor: "color-mix(in oklch, var(--zdo-accent) 50%, transparent)",
    outline: "none",
  },
  "&:not(.cm-focused) .cm-fat-cursor": {
    backgroundColor: "transparent",
    outline: "1px solid var(--zdo-accent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor: "color-mix(in oklch, var(--zdo-accent) 24%, transparent)",
    },
  ".cm-selectionMatch": {
    backgroundColor: "color-mix(in oklch, var(--zdo-info) 20%, transparent)",
  },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in oklch, var(--zdo-warning) 26%, transparent)",
    outline: "1px solid color-mix(in oklch, var(--zdo-warning) 55%, transparent)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in oklch, var(--zdo-accent) 34%, transparent)",
  },
  "&.cm-focused .cm-matchingBracket": {
    backgroundColor: "color-mix(in oklch, var(--zdo-accent) 18%, transparent)",
    outline: "none",
  },
  "&.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "color-mix(in oklch, var(--zdo-danger) 18%, transparent)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--zdo-surface-2)",
    color: "var(--zdo-fg-mild)",
    border: "1px solid var(--zdo-border-strong)",
  },
  // The `:` command line and the search panel vim opens.
  ".cm-panels": {
    backgroundColor: "var(--zdo-surface)",
    color: "var(--zdo-fg)",
    fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace)',
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid var(--zdo-border)",
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid var(--zdo-border)",
  },
  ".cm-panel input, .cm-panel button": {
    backgroundColor: "var(--zdo-bg)",
    color: "var(--zdo-fg)",
    border: "1px solid var(--zdo-border-strong)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--zdo-surface)",
    color: "var(--zdo-fg)",
    border: "1px solid var(--zdo-border-strong)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "color-mix(in oklch, var(--zdo-accent) 16%, transparent)",
    color: "var(--zdo-fg)",
  },
};

export const editorTheme: Extension = EditorView.theme(editorThemeSpec);

/**
 * Markdown structure first, then the tags the fenced-code grammars
 * (`codeLanguages: languages`) emit inside a code block. Weight and style
 * carry as much of the structure as colour does — a heading reads as a
 * heading in a monochrome buffer too.
 */
export const editorHighlightSpec: TagStyle[] = [
  { tag: tags.heading, color: "var(--zdo-fg)", fontWeight: "600" },
  { tag: tags.heading1, fontSize: "1.25em" },
  { tag: tags.heading2, fontSize: "1.15em" },
  { tag: tags.heading3, fontSize: "1.07em" },
  { tag: tags.strong, color: "var(--zdo-fg)", fontWeight: "700" },
  { tag: tags.emphasis, color: "var(--zdo-fg)", fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--zdo-accent)" },
  { tag: tags.url, color: "var(--zdo-accent)", textDecoration: "underline" },
  {
    tag: [tags.monospace, tags.literal],
    color: "var(--zdo-code-fg)",
    backgroundColor: "var(--zdo-code-bg)",
  },
  { tag: tags.quote, color: "var(--zdo-fg-mild)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--zdo-accent-hover)" },
  { tag: tags.contentSeparator, color: "var(--zdo-border-strong)" },
  // `#`, `*`, ``` ``` ``` and friends: present, but never louder than the
  // content they mark up.
  { tag: [tags.processingInstruction, tags.meta], color: "var(--zdo-muted)" },
  { tag: tags.keyword, color: "var(--zdo-accent-hover)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--zdo-success)" },
  { tag: [tags.number, tags.bool, tags.atom], color: "var(--zdo-info)" },
  { tag: tags.comment, color: "var(--zdo-muted)", fontStyle: "italic" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "var(--zdo-warning)" },
  { tag: [tags.variableName, tags.propertyName], color: "var(--zdo-fg)" },
  { tag: [tags.operator, tags.punctuation], color: "var(--zdo-fg-mild)" },
  { tag: tags.invalid, color: "var(--zdo-danger)" },
];

export const editorHighlighting: Extension = syntaxHighlighting(
  HighlightStyle.define(editorHighlightSpec),
);

export interface EditorCompartments {
  /**
   * Never reconfigured today: the theme is pure CSS-variable references, so a
   * light/dark flip restyles the editor with no transaction at all. It is
   * compartmented anyway because that is the ONLY seam a future theme that
   * cannot be expressed in custom properties could use, and adding it later
   * would mean rebuilding the extension array of a live editor.
   */
  theme: Compartment;
  /** Same: line wrapping is always on for prose, but the seam is free. */
  wrap: Compartment;
  vim: Compartment;
  readOnly: Compartment;
}

export function createEditorCompartments(): EditorCompartments {
  return {
    theme: new Compartment(),
    wrap: new Compartment(),
    vim: new Compartment(),
    readOnly: new Compartment(),
  };
}

/** Contents of the `vim` compartment for a given toggle state. */
export function vimExtension(enabled: boolean): Extension {
  return enabled ? vim() : [];
}

/**
 * Contents of the `readOnly` compartment. Both facets are needed: `readOnly`
 * refuses document changes, `editable` also drops `contenteditable`, which is
 * what stops a caret appearing in a buffer the user cannot actually change
 * (the chrome sets this while a conflict is unresolved).
 */
export function readOnlyExtension(readOnly: boolean): Extension {
  return readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];
}

export interface EditorExtensionOptions {
  compartments: EditorCompartments;
  vimEnabled: boolean;
  readOnly: boolean;
  onUpdate: (update: ViewUpdate) => void;
}

export function buildEditorExtensions({
  compartments,
  vimEnabled,
  readOnly,
  onUpdate,
}: EditorExtensionOptions): Extension[] {
  return [
    // FIRST — see the module comment. Nothing may be inserted above this.
    compartments.vim.of(vimExtension(vimEnabled)),
    basicSetup,
    markdown({ codeLanguages: languages }),
    compartments.theme.of(editorTheme),
    editorHighlighting,
    compartments.wrap.of(EditorView.lineWrapping),
    compartments.readOnly.of(readOnlyExtension(readOnly)),
    // The buffer is markdown source, not prose the platform should improve:
    // an autocorrected `--` or a capitalised fence language is a corrupted
    // document, and the red squiggles under every directive name are noise.
    EditorView.contentAttributes.of({
      "aria-label": EDITOR_ARIA_LABEL,
      autocorrect: "off",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
    }),
    EditorView.updateListener.of(onUpdate),
  ];
}

export const EDITOR_ARIA_LABEL = "Page markdown";

// ---------------------------------------------------------------------- vim

export interface VimModeEvent {
  mode: string;
  subMode?: string;
}

/**
 * `-- NORMAL --` / `-- INSERT --` / `-- VISUAL LINE --`, matching both vim's
 * own echo line and the a3 prototype's status chip. A missing event means the
 * editor has only just entered vim mode, which always starts in normal.
 */
export function vimModeLabel(event: VimModeEvent | null | undefined): string {
  const mode = event?.mode ?? "normal";
  const subMode =
    event?.subMode === "linewise"
      ? " line"
      : event?.subMode === "blockwise"
        ? " block"
        : "";
  return `-- ${`${mode}${subMode}`.toUpperCase()} --`;
}

/** Reads the mode the vim plugin is currently in, for the initial label. */
export function currentVimMode(view: EditorView): VimModeEvent | null {
  const cm = getCM(view);
  const mode = cm?.state.vim?.mode;
  return typeof mode === "string" ? { mode } : null;
}

type VimModeHandler = (event: VimModeEvent) => void;

/**
 * Subscribes to the vim plugin's mode changes. Returns a detach function, or
 * `null` when vim is not active on this view.
 *
 * The adapter object is recreated whenever the vim compartment is
 * reconfigured or the view's state is replaced, so every call site that does
 * either must re-subscribe — a handler bound to a discarded adapter goes
 * silent without erroring, leaving a status chip frozen on a stale mode.
 */
export function observeVimMode(
  view: EditorView,
  onModeChange: VimModeHandler,
): (() => void) | null {
  const cm = getCM(view);
  if (!cm) return null;
  const handler = (event: VimModeEvent) => onModeChange(event);
  cm.on("vim-mode-change", handler);
  return () => cm.off("vim-mode-change", handler);
}

const saveHandlers = new WeakMap<EditorView, () => void>();
let writeCommandDefined = false;

/**
 * Points `:w` (and `:write`) at a view's save handler.
 *
 * `Vim.defineEx` registers globally rather than per editor, so the command is
 * defined once and dispatches through the view the invoking adapter belongs
 * to. A WeakMap rather than a module variable because a pop-out preview or a
 * future second pane would otherwise silently steal the binding — and because
 * it lets a destroyed view's handler be collected.
 */
export function registerWriteExCommand(view: EditorView, save: () => void): () => void {
  saveHandlers.set(view, save);
  if (!writeCommandDefined) {
    writeCommandDefined = true;
    Vim.defineEx("write", "w", (cm) => {
      saveHandlers.get(cm.cm6)?.();
    });
  }
  return () => {
    saveHandlers.delete(view);
  };
}

// ------------------------------------------------------------- vim preference

const VIM_ON = "on";
const VIM_OFF = "off";

/**
 * Vim is OFF by default. It is the right default for a documentation authoring
 * app whose users are mostly writers: someone who wants vim will find the
 * chip, whereas someone who does not would simply find the editor broken.
 */
export const DEFAULT_VIM_ENABLED = false;

export function readVimEnabled(storage?: KeyValueStorage | null): boolean {
  const raw = readStoredValue(VIM_MODE_STORAGE_KEY, storage);
  if (raw === VIM_ON) return true;
  if (raw === VIM_OFF) return false;
  return DEFAULT_VIM_ENABLED;
}

export function writeVimEnabled(
  enabled: boolean,
  storage?: KeyValueStorage | null,
): void {
  writeStoredValue(VIM_MODE_STORAGE_KEY, enabled ? VIM_ON : VIM_OFF, storage);
}
