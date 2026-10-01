import { definePreset } from "@takazudo/zfb/config";
import type { WindConfig, ZfbConfig } from "@takazudo/zfb/config";

/** Package defaults are var-backed so live theme changes reach every utility. */
export const packageWindConfig: WindConfig = {
  spec: 1,
  reset: "owned-v1",
  dark: false,
  manifests: { "zudo-doc": { path: "@takazudo/zudo-doc/wind.json" } },
  tokens: {
    "colors": {
      "bg": "var(--color-bg)",
      "zd-bg": "var(--color-zd-bg)",
      "fg": "var(--color-fg)",
      "zd-fg": "var(--color-zd-fg)",
      "sel-bg": "var(--color-sel-bg)",
      "zd-sel-bg": "var(--color-zd-sel-bg)",
      "sel-fg": "var(--color-sel-fg)",
      "zd-sel-fg": "var(--color-zd-sel-fg)",
      "surface": "var(--color-surface)",
      "zd-surface": "var(--color-zd-surface)",
      "muted": "var(--color-muted)",
      "zd-muted": "var(--color-zd-muted)",
      "accent": "var(--color-accent)",
      "zd-accent": "var(--color-zd-accent)",
      "accent-hover": "var(--color-accent-hover)",
      "zd-accent-hover": "var(--color-zd-accent-hover)",
      "code-bg": "var(--color-code-bg)",
      "zd-code-bg": "var(--color-zd-code-bg)",
      "code-fg": "var(--color-code-fg)",
      "zd-code-fg": "var(--color-zd-code-fg)",
      "success": "var(--color-success)",
      "zd-success": "var(--color-zd-success)",
      "danger": "var(--color-danger)",
      "zd-danger": "var(--color-zd-danger)",
      "warning": "var(--color-warning)",
      "zd-warning": "var(--color-zd-warning)",
      "info": "var(--color-info)",
      "zd-info": "var(--color-zd-info)",
      "overlay": "var(--color-overlay)",
      "zd-overlay": "var(--color-zd-overlay)",
      "image-overlay-bg": "var(--color-image-overlay-bg)",
      "zd-image-overlay-bg": "var(--color-zd-image-overlay-bg)",
      "image-overlay-fg": "var(--color-image-overlay-fg)",
      "zd-image-overlay-fg": "var(--color-zd-image-overlay-fg)",
      "chat-user-bg": "var(--color-chat-user-bg)",
      "zd-chat-user-bg": "var(--color-zd-chat-user-bg)",
      "chat-user-text": "var(--color-chat-user-text)",
      "zd-chat-user-text": "var(--color-zd-chat-user-text)",
      "chat-assistant-bg": "var(--color-chat-assistant-bg)",
      "zd-chat-assistant-bg": "var(--color-zd-chat-assistant-bg)",
      "chat-assistant-text": "var(--color-chat-assistant-text)",
      "zd-chat-assistant-text": "var(--color-zd-chat-assistant-text)",
      "matched-keyword-bg": "var(--color-matched-keyword-bg)",
      "zd-matched-keyword-bg": "var(--color-zd-matched-keyword-bg)",
      "matched-keyword-fg": "var(--color-matched-keyword-fg)",
      "zd-matched-keyword-fg": "var(--color-zd-matched-keyword-fg)"
    },
    "spacing": {
      "hsp-2xs": "var(--spacing-hsp-2xs)",
      "hsp-xs": "var(--spacing-hsp-xs)",
      "hsp-sm": "var(--spacing-hsp-sm)",
      "hsp-md": "var(--spacing-hsp-md)",
      "hsp-lg": "var(--spacing-hsp-lg)",
      "hsp-xl": "var(--spacing-hsp-xl)",
      "hsp-2xl": "var(--spacing-hsp-2xl)",
      "vsp-3xs": "var(--spacing-vsp-3xs)",
      "vsp-2xs": "var(--spacing-vsp-2xs)",
      "vsp-xs": "var(--spacing-vsp-xs)",
      "vsp-sm": "var(--spacing-vsp-sm)",
      "vsp-md": "var(--spacing-vsp-md)",
      "vsp-lg": "var(--spacing-vsp-lg)",
      "vsp-xl": "var(--spacing-vsp-xl)",
      "vsp-2xl": "var(--spacing-vsp-2xl)",
      "icon-xs": "var(--spacing-icon-xs)",
      "icon-sm": "var(--spacing-icon-sm)",
      "icon-md": "var(--spacing-icon-md)",
      "icon-lg": "var(--spacing-icon-lg)",
      "image-overlay-inset": "var(--spacing-image-overlay-inset)"
    },
    "fontSizes": {
      "micro": {
        "size": "var(--text-micro)"
      },
      "caption": {
        "size": "var(--text-caption)"
      },
      "small": {
        "size": "var(--text-small)"
      },
      "body": {
        "size": "var(--text-body)"
      },
      "title": {
        "size": "var(--text-title)"
      },
      "heading": {
        "size": "var(--text-heading)"
      },
      "display": {
        "size": "var(--text-display)"
      }
    },
    "fontFamilies": {
      "sans": "var(--font-sans)",
      "mono": "var(--font-mono)"
    },
    "fontWeights": {
      "normal": "var(--font-weight-normal)",
      "medium": "var(--font-weight-medium)",
      "semibold": "var(--font-weight-semibold)",
      "bold": "var(--font-weight-bold)"
    },
    "lineHeights": {
      "tight": "var(--leading-tight)",
      "snug": "var(--leading-snug)",
      "normal": "var(--leading-normal)",
      "relaxed": "var(--leading-relaxed)",
      "none": "var(--leading-none)"
    },
    "letterSpacings": {
      "tight": "var(--tracking-tight)",
      "normal": "var(--tracking-normal)",
      "wide": "var(--tracking-wide)",
      "wider": "var(--tracking-wider)"
    },
    "radii": {
      "default": "var(--radius-DEFAULT)",
      "lg": "var(--radius-lg)"
    },
    "shadows": {
      "lg": "var(--shadow-lg)"
    },
    "zIndices": {
      "content": "var(--z-index-content)",
      "local-1": "var(--z-index-local-1)",
      "local-2": "var(--z-index-local-2)",
      "local-3": "var(--z-index-local-3)",
      "sidebar": "var(--z-index-sidebar)",
      "toolbar": "var(--z-index-toolbar)",
      "dropdown": "var(--z-index-dropdown)",
      "popover": "var(--z-index-popover)",
      "modal-backdrop": "var(--z-index-modal-backdrop)",
      "modal": "var(--z-index-modal)",
      "toast": "var(--z-index-toast)",
      "tooltip": "var(--z-index-tooltip)",
      "drag": "var(--z-index-drag)"
    },
    "easings": {
      "in-out": "var(--ease-in-out)"
    }
  },
  breakpoints: {
    "sm": {
      "minWidthPx": 640
    },
    "lg": {
      "minWidthPx": 1024
    },
    "xl": {
      "minWidthPx": 1280
    }
  }
};

/** The preset boundary lets zfb deep-merge user wind overrides over defaults. */
export const zudoDocWindPreset: Partial<ZfbConfig> = definePreset(
  "@takazudo/zudo-doc",
  { wind: packageWindConfig },
);
