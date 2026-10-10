# Remaining transition-colors duration candidates

Read-only source inventory, not regression verdicts. Under the currently measured old distributions, baseline utility defaults to0s and native4.2.1 utility defaults to150ms. Component/authored rules can override that; actual controls require measurement. No broad class replacements authorized here.

`duration-candidates-probe.mjs` captures default/hover/focus of visible real controls, waits finite animations, and records raw transition properties/duration/timing plus endpoint colors and background-image. Same viewport1600 and light/dark for each build; no asset/network stubs. It remains red on missing controls and reports absent branches. Manager runs with shared heavy guard; results go to `/tmp/zudo421-parity/duration-candidates/report.json`.

| Source | Actual route / selector or public UI |
| --- | --- |
| `i18n-version/language-switcher.tsx:118` | getting-started, `[data-language-toggle]` |
| `i18n-version/version-switcher.tsx:240` | getting-started, `[data-version-toggle]` |
| `search-widget/index.tsx:74` | getting-started, `[data-open-search]` |
| `header/header.tsx:520,582` | getting-started, plain `a[data-nav-item]` and `[data-nav-item-dropdown] > a` |
| `header/header.tsx:648` | getting-started, `#ai-chat-trigger` and `#design-token-trigger` |
| `header/header.tsx:756,809–810` | getting-started, visible external GitHub anchor; custom-link branches remain config-dependent |
| `doc-history/index.tsx:610` | getting-started, `[data-doc-history-trigger]` |
| `toc/toc.tsx:82` | html-preview, visible `[data-zd-toc] a` |
| `code-syntax/tabs.tsx:28` | tabs, inactive `[data-tab-btn][aria-selected=false]` |
| `ai-chat-modal/index.tsx:255` | open actual AI dialog, Close |
| `theme-pack-switcher/index.tsx:135,138,282` | home, launcher; open flyout Previous/Next/Browse/Close |
| `theme-pack-dialog/index.tsx:96` | home, Browse all theme packs → Preview theme dialog Close |
| `theme-pack-dialog/theme-pack-card.tsx:51` | same dialog, first Apply card |
| `theme-pack-dialog/index.tsx:118` | Retry only appears after registry error; no failure injection. Unverified until a real supported reproduction exercises it. |

Reuse existing measurements: AI Send duration0→150ms and asset-toggle200ms/easing were directly measured in `focus-timing/report.json`; not rerun by this candidate probe. Earlier locked CSS captures measure language menu descendants, not toggle buttons, so they cannot discharge trigger timing. General65-state browser comparison excludes transition duration from its property list. Existing header/sidebar/TOC motion with explicit durations has its separate retained evidence.
