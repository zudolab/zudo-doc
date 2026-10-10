# Closeout manual acceptance: macOS IME procedure, combined visual smoke, machine results (2026-10-10)

Owner: #4475 (human/platform evidence), topic #4506 under epic #4502. Upstream gate: Takazudo/zudo-front-builder#3330.

## Status at a glance

- **Real macOS Japanese IME check: PENDING (human, macOS).** It cannot run on this Linux/WSL host. No IME pass is claimed anywhere in this file.
- **Machine smoke on the PR preview: 12/12 pass** (headless Chromium 145.0.7632.6, Linux). Not an IME result and not a macOS/Safari/WebKit result.
- **Synthetic composition tests: 5/5 pass** (jsdom). Labelled **synthetic**; they do not establish real input-method behaviour.
- PR #4477 stays draft and unmerged until the IME item below is recorded as PASS by a human.

## Candidate under test

- PR #4477 head: `fd0764fbcba9a9a1059fbf142fbeac85b0a0c16b` (head when this file was written; no later commit on the PR).
- Preview: https://pr-4477-zudo-doc-preview.takazudo.workers.dev
- The preview serves no SHA in its HTML or headers. The binding is: the `Preview Deploy` check run on `fd0764f` completed `success` at 2026-10-10T06:29:09Z, and the PR head had not moved when the machine smoke ran (2026-10-10 ~07:50 UTC). If the PR head differs from the SHA above when you test, re-run against the new head's `Preview Deploy` completion and record that SHA instead.
- AI chat on the preview is the demo build: `POST /api/ai-chat` answers `{"response":"This feature is disabled on this demo..."}` with HTTP 200. That is enough to observe submission count; it is not a model reply.

## Part A: macOS Japanese IME procedure (human, PENDING)

Environment: macOS arm64, built-in Japanese input source set to Hiragana (Romaji typing), headed Chrome or Chrome for Testing. A second run on Windows 11 with Microsoft Japanese IME is useful but never replaces the macOS run. Test word is fixed: type `nihongo`, convert to `日本語`.

Open the preview with DevTools open (Console and Network tabs, "Preserve log" on). Record any console error.

### A1. Site search input

1. Open `/docs/getting-started/`. Press `Cmd+K`; the search dialog opens and `[data-search-input]` is focused.
2. Switch to the Japanese input source. Type `nihongo`; the underlined preedit stays visible and is not replaced mid-composition.
3. Press `Space` to convert to `日本語`, then `Enter` to commit. The dialog must stay open (the committing Enter is not a navigation or close). The input reads exactly `日本語`, focus is still in the input, the caret is at the end, and results update for `日本語`.
4. Select all and delete. Type `nihongo` again, press `Escape` while composing: the preedit is cancelled. Expected: the dialog stays open (Escape during composition belongs to the IME); record what actually happens. Then type `nihongo`, convert, commit again. The final value is `日本語` with no duplicate, lost, or premature characters.
5. Press `Escape` once (not composing) and confirm the dialog closes.

### A2. AI chat input (Enter rule)

1. Click the header AI chat button (`#ai-chat-trigger`). The dialog opens with "Type your message" focused. In DevTools Network, filter `ai-chat`.
2. Type `nihongo`, press `Space` to convert to `日本語`. Do not commit yet.
3. Press `Enter` to **confirm the conversion**. **Rule: this Enter must not submit.** Network shows no `ai-chat` request, the log has no new message, and the input still contains `日本語`.
4. Press `Enter` again (ordinary Enter, no composition). **The message is submitted exactly once**: exactly one `POST /api/ai-chat`, one user bubble `日本語`, one reply, input cleared.
5. Repeat with a cancelled conversion: type `nihongo`, press `Escape` (cancel), type `nihongo`, convert, confirm with `Enter` (no request), then `Enter` (exactly one request).
6. Quick double check: after step 4, type `a`, press `Enter` once. Exactly one more request (the composing flag is not stuck on).

### A3. State checks for both inputs

For A1 and A2 confirm each of: input DOM value equals the visible text; the component model agrees (A2: the Send button enables after commit and disables on an empty input; A1: results reflect the committed text); focus stays in the input until the product moves it; caret/selection is not reset to the start; no console error.

### A4. Optional supplementary (from #3330)

Second composition while the control stays focused; blur during composition; delayed hydration (hard reload, type immediately). For any failure capture a short trace (`compositionstart/end`, `isComposing`, blur, selection) using only the fixed test word, plus video and console, then reproduce it as a synthetic regression test and rerun the real IME.

### A5. Upstream packed-SDK fixture (#3330 R-A06 evidence)

This is the zudo-react form-contract check and lives in the upstream repo, not this one. From a zudo-front-builder checkout: `pnpm install --frozen-lockfile`, `node tests/zudo-react-browser/build-fixture.mjs`, `node tests/zudo-react-browser/serve-fixture.mjs 4342`, open `http://localhost:4342/r-a06-composition-synthetic.html`, and focus `#composition-input`. Type `nihongo`, convert, commit: the preedit stays visible, input and `#composition-value` both end at `日本語`, focus stays, caret not reset. Repeat with `Escape` then recompose. Record the upstream source SHA and packed SDK version. Without this, #3330 stays open; the preview checks in A1-A3 cover this repo's two consumers only.

## Part B: combined visual smoke checklist (same sitting)

Run on the preview at desktop width (about 1280px) and a phone-width window (about 390px) where noted. Mark each line pass or fail.

| # | Line | How |
| --- | --- | --- |
| B1 | Theme toggle | Header Appearance button: Dark then Light then System. Page colors flip, label updates, no flash on reload, choice persists after reload |
| B2 | Mobile menu / drawer | 390px: hamburger opens the drawer, content scrolls inside, Appearance menu opens inside the drawer fully within the viewport, backdrop click closes |
| B3 | Search | `Cmd+K` opens, typing returns results, a result navigates, `Escape` closes |
| B4 | Code highlighting | `/docs/markdown-features/syntax-highlighting/`: fences are multi-coloured in light and dark, no unstyled blocks |
| B5 | Mermaid render + enlarge | `/docs/markdown-features/mermaid/`: diagrams render, enlarge button opens the zoom dialog with the diagram, `Escape` closes |
| B6 | Image enlarge | `/docs/markdown-features/image-enlarge/`: enlarge button opens the dialog with the image, `Escape` closes |
| B7 | Doc history dropdown | `/docs/getting-started/`: History button opens the revision dialog and lists revisions; select two and compare |
| B8 | 06R toolbar: Broaden | `/docs/guides/`: Broaden widens the tree to the highest root and disables itself; Restore appears |
| B9 | 06R toolbar: Restore | Restore returns to the configured tree; URL and article unchanged |
| B10 | 06R toolbar: branch focus | A "Show only this branch" button narrows the sidebar to that branch and shows Restore; keyboard Enter/Space work; URL and article unchanged |
| B11 | Safari / macOS-only look | Optional: repeat B1-B7 in Safari and note differences |

## Part C: tester record

Fill in and paste (see template below).

- macOS version:
- Hardware (arm64 model):
- IME / input source (name, version) and keyboard type:
- Browser and exact version (headed Chrome / Chrome for Testing / Safari):
- Candidate SHA (PR #4477 head under test) and preview URL:
- Date and tester:
- Pass/fail for A1, A2, A3 and B1-B11, with notes on every failure (exact input sequence, observed vs expected, console errors).

## Part D: ready-to-paste PR #4477 comment template

```md
### Manual acceptance: macOS Japanese IME + combined visual smoke

- Candidate SHA: `<sha>` (Preview Deploy check completed <time>)
- Preview: https://pr-4477-zudo-doc-preview.takazudo.workers.dev
- macOS: <version> (<arm64 model>)
- Input source: <name/version>, keyboard: <type>
- Browser: <name + version>
- Tester / date: <name> / <date>

| Item | Result | Notes |
| --- | --- | --- |
| A1 search: compose, convert, commit 日本語; cancel and recompose | PASS / FAIL | |
| A2 AI chat: conversion-confirming Enter does not submit | PASS / FAIL | requests seen: 0 |
| A2 AI chat: next ordinary Enter submits exactly once | PASS / FAIL | requests seen: 1 |
| A2 AI chat: cancel and recompose | PASS / FAIL | |
| A3 value / model / focus / caret correct (both inputs) | PASS / FAIL | |
| A5 upstream packed-SDK fixture (zudo-front-builder#3330) | PASS / FAIL / NOT RUN | upstream SHA: |
| B1 theme toggle | PASS / FAIL | |
| B2 mobile menu / drawer | PASS / FAIL | |
| B3 search | PASS / FAIL | |
| B4 code highlighting | PASS / FAIL | |
| B5 Mermaid render + enlarge | PASS / FAIL | |
| B6 image enlarge | PASS / FAIL | |
| B7 doc history dropdown | PASS / FAIL | |
| B8-B10 06R toolbar (Broaden / Restore / branch focus) | PASS / FAIL | |

Console errors: <none / list>. Failures reproduced and filed as: <issue links>.
This is a real IME run on the stated platform. (Delete this line if it is not.)
```

## Part E: machine results (this Linux host, 2026-10-10)

### E1. Preview smoke (real headless Chromium, not IME)

Script: `scripts/zfb3-parity/closeout-preview-smoke.mjs`. Run: `bash $HOME/.claude/scripts/heavy-guard.sh --wait 540 -- node scripts/zfb3-parity/closeout-preview-smoke.mjs https://pr-4477-zudo-doc-preview.takazudo.workers.dev <out.json>`. Candidate `fd0764f`, Chromium 145.0.7632.6 (Playwright), guard verdict PASS, zero console or page errors across all pages. One early run failed three lines because of selector mistakes in the script (duplicate hidden header triggers; the 06R toolbar acts only on pages with a multi-branch tree); the script was fixed, the final run below is the committed script.

| Line | Result | Detail |
| --- | --- | --- |
| Theme toggle (Dark then Light) | PASS | body background changed oklch(0.185 0.005 65) to oklch(0.965 0.004 65) |
| Search (Ctrl+K, query, results, Escape) | PASS | 10 results |
| Code highlighting (`pre.hi-root`) | PASS | token spans with more than one computed color |
| Mermaid render | PASS | svg rendered |
| Mermaid enlarge (open, svg clone, Escape) | PASS | |
| Image enlarge (open, img, Escape) | PASS | |
| Doc history dropdown | PASS | dialog opened, 4 revision controls |
| Mobile drawer opens (390px) | PASS | |
| Appearance menu inside drawer within viewport | PASS | |
| 06R Broaden then Restore | PASS | 2 focus targets, 21 after Broaden (Broaden disabled), restored to 2 |
| 06R branch focus then Restore | PASS | 2 to 1 to 2; URL and article heading unchanged |
| AI chat composing Enter (**synthetic**) | PASS | request intercepted by the script; 0 requests while composing, exactly 1 after |

Not machine-covered: Safari/WebKit, macOS rendering, keyboard-driven 06R (covered in hosted e2e), real IME.

### E2. Existing synthetic composition tests (**synthetic**, jsdom, no browser)

`cd packages/zudo-doc && npx vitest run src/ai-chat-modal/__tests__/ai-chat-modal-interaction.test.tsx src/find-in-page/__tests__/find-in-page-interaction.test.tsx`: 2 files, **5 tests passed**. These dispatch `CompositionEvent` and `KeyboardEvent({isComposing: true})` by hand. The e2e counterpart is `e2e/smoke-migration-parity-runtime.spec.ts` ("AI chat ignores Enter during IME composition, then submits normally"); it runs in hosted PR Checks and was not re-run here. Synthetic dispatch is not real IME evidence.

### E3. Scope notes

- Site search is the only search input a browser user reaches on the preview; the find-in-page composition handling (`Cmd/Ctrl+F`) is Tauri-only, so it is not part of A1.
- The AI chat guards both `KeyboardEvent.isComposing` and its own `compositionstart/end` flag (`packages/zudo-doc/src/ai-chat-modal/index.tsx`); browsers differ in whether the keydown that confirms a conversion arrives before or after `compositionend`, so A2 step 3 on the real macOS stack is the line synthetic tests cannot replace.
- Out of scope: the real ChatGPT/MCP connection (#4485).
