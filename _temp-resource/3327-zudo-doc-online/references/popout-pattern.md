# Pop-out preview window recipe (distilled from an internal reference implementation)

Pattern reference for zudo-doc-online's pop-out preview. The source is a production
multi-window editor; this is the browser-port recipe.

## Core principle

The popout is a SECOND FULL SPA INSTANCE on a dedicated route — the main window never
streams rendered HTML to it. Both windows are peers over the same backend (here: the
local API server + SSE); a small message bus carries only control-plane traffic.

## Recipe

1. **Route**: reserve `#/popped-out/preview/<pageId>`. The app entry branches on this
   hash prefix BEFORE rendering: popout mode mounts only the preview component + a slim
   bar, applies theme synchronously pre-mount, skips all app chrome. Malformed popout
   URL → visible error page telling the user to close the window; never a silent
   self-close (debuggability).
2. **Open**: synchronously in the click handler (popup blockers):
   `window.open(url, "zdo-popout-" + pageId, "width=900,height=600,popup")`.
   The NAMED window makes re-clicks focus the existing window (idempotent open).
   Record `{windowName, pageId}` in a module-level in-memory registry (survives route
   changes; deliberately does NOT survive app restart). Swap the in-pane preview to a
   placeholder: "Previewing in another window · [Focus] · [Bring back]".
3. **Content**: never push keystrokes over messages. The popout loads the page from the
   API itself and subscribes to the same SSE stream; on `page-changed {pageId}` it
   re-fetches and re-renders. (Autosave in the main window is what makes edits reach it
   — an acceptable ~500ms cadence for a preview in another window.)
4. **Theme**: popout applies theme synchronously pre-mount by reading the SAME
   localStorage key; live propagation via the window `storage` event (fires in other
   windows on the same origin when the key changes). Fail-open to defaults.
5. **Close detection**: browsers give no reliable external destroy event — poll
   `winRef.closed` (~1s) in the opener AND have the popout send a best-effort message
   on `pagehide` over `BroadcastChannel("zdo-popout")`; either path unregisters and
   restores the in-pane preview.
6. **Bus discipline** (if more message kinds are added later): every payload is a
   pre-serialized JSON string in a small envelope `{event, windowName?, payload}`;
   everything is broadcast and the RECEIVER filters by its own name (a popout only
   knows its own); parsers never throw — malformed input → null → dropped. Requests
   are idempotent with mount-time retry backoff `[0, 300, 1000, 3000, 10000]ms`
   (subscription registration is async; a reply can be broadcast before the popout is
   actually listening).
7. **Scroll sync across windows: out of scope** — the reference explicitly excludes it;
   editor↔preview sync stays per-window.
8. **Serialization discipline**: functions/vnodes never cross; state that crosses is a
   JSON-safe subset; if a payload might exceed a few KB, send an id and let the
   receiver re-read from the backend instead (measure JSON-ESCAPED size — nesting a
   JSON string in an envelope doubles every quote/backslash).

## Main-window UX details

- While popped out, the in-pane preview placeholder offers Focus (re-`window.open` with
  the same name — focuses) and Bring back (close the popout via the registry ref +
  restore the pane).
- Main window closing simply orphans the popout — it keeps rendering from the API.
  Acceptable; do not build a restore handshake for v1.
