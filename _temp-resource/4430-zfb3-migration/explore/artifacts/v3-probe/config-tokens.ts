import { defineConfig } from "zfb/config";
export default defineConfig({ wind: {
 "spec": 1,
 "reset": "none",
 "tokens": {
  "colors": {
   "bg": "var(--color-bg)",
   "fg": "var(--color-fg)",
   "sel-bg": "var(--color-sel-bg)",
   "sel-fg": "var(--color-sel-fg)",
   "surface": "var(--color-surface)",
   "muted": "var(--color-muted)",
   "accent": "var(--color-accent)",
   "accent-hover": "var(--color-accent-hover)",
   "code-bg": "var(--color-code-bg)",
   "code-fg": "var(--color-code-fg)",
   "success": "var(--color-success)",
   "danger": "var(--color-danger)",
   "warning": "var(--color-warning)",
   "info": "var(--color-info)",
   "overlay": "var(--color-overlay)",
   "image-overlay-bg": "var(--color-image-overlay-bg)",
   "image-overlay-fg": "var(--color-image-overlay-fg)",
   "chat-user-bg": "var(--color-chat-user-bg)",
   "chat-user-text": "var(--color-chat-user-text)",
   "chat-assistant-bg": "var(--color-chat-assistant-bg)",
   "chat-assistant-text": "var(--color-chat-assistant-text)",
   "matched-keyword-bg": "var(--color-matched-keyword-bg)",
   "matched-keyword-fg": "var(--color-matched-keyword-fg)",
   "zd-bg": "var(--color-zd-bg)",
   "zd-fg": "var(--color-zd-fg)",
   "zd-sel-bg": "var(--color-zd-sel-bg)",
   "zd-sel-fg": "var(--color-zd-sel-fg)",
   "zd-surface": "var(--color-zd-surface)",
   "zd-muted": "var(--color-zd-muted)",
   "zd-accent": "var(--color-zd-accent)",
   "zd-accent-hover": "var(--color-zd-accent-hover)",
   "zd-code-bg": "var(--color-zd-code-bg)",
   "zd-code-fg": "var(--color-zd-code-fg)",
   "zd-success": "var(--color-zd-success)",
   "zd-danger": "var(--color-zd-danger)",
   "zd-warning": "var(--color-zd-warning)",
   "zd-info": "var(--color-zd-info)",
   "zd-overlay": "var(--color-zd-overlay)",
   "zd-image-overlay-bg": "var(--color-zd-image-overlay-bg)",
   "zd-image-overlay-fg": "var(--color-zd-image-overlay-fg)",
   "zd-chat-user-bg": "var(--color-zd-chat-user-bg)",
   "zd-chat-user-text": "var(--color-zd-chat-user-text)",
   "zd-chat-assistant-bg": "var(--color-zd-chat-assistant-bg)",
   "zd-chat-assistant-text": "var(--color-zd-chat-assistant-text)",
   "zd-matched-keyword-bg": "var(--color-zd-matched-keyword-bg)",
   "zd-matched-keyword-fg": "var(--color-zd-matched-keyword-fg)",
   "page-loading-overlay": "var(--color-page-loading-overlay)"
  },
  "spacing": {
   "hsp-2xs": "0.125rem",
   "hsp-xs": "0.375rem",
   "hsp-sm": "0.5rem",
   "hsp-md": "0.75rem",
   "hsp-lg": "1rem",
   "hsp-xl": "1.5rem",
   "hsp-2xl": "2rem",
   "vsp-3xs": "0.25rem",
   "vsp-2xs": "0.4375rem",
   "vsp-xs": "0.875rem",
   "vsp-sm": "1.25rem",
   "vsp-md": "1.5rem",
   "vsp-lg": "1.75rem",
   "vsp-xl": "2.5rem",
   "vsp-2xl": "3.5rem",
   "icon-xs": "0.75rem",
   "icon-sm": "1rem",
   "icon-md": "1.25rem",
   "icon-lg": "1.5rem",
   "image-overlay-inset": "0.5rem"
  },
  "fontSizes": {
   "micro": {
    "size": "var(--text-scale-2xs)"
   },
   "caption": {
    "size": "var(--text-scale-xs)"
   },
   "small": {
    "size": "var(--text-scale-sm)"
   },
   "body": {
    "size": "var(--text-scale-md)"
   },
   "title": {
    "size": "var(--text-scale-lg)"
   },
   "heading": {
    "size": "var(--text-scale-xl)"
   },
   "display": {
    "size": "var(--text-scale-2xl)"
   }
  },
  "fontFamilies": {
   "sans": "system-ui, sans-serif",
   "mono": "ui-monospace, monospace"
  },
  "fontWeights": {
   "normal": "400",
   "medium": "500",
   "semibold": "600",
   "bold": "700"
  },
  "lineHeights": {
   "tight": "1.25",
   "snug": "1.375",
   "normal": "1.5",
   "relaxed": "1.625"
  },
  "letterSpacings": {
   "tight": "-0.025em",
   "normal": "normal",
   "wide": "0.05em",
   "wider": "0.1em"
  },
  "radii": {
   "default": "0.25rem",
   "lg": "0.5rem"
  },
  "shadows": {
   "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
  },
  "zIndices": {
   "content": "0",
   "local-1": "1",
   "local-2": "2",
   "local-3": "3",
   "sidebar": "10",
   "toolbar": "20",
   "dropdown": "30",
   "popover": "40",
   "modal-backdrop": "50",
   "modal": "60",
   "toast": "70",
   "tooltip": "80",
   "drag": "90"
  }
 },
 "breakpoints": {
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
} });
