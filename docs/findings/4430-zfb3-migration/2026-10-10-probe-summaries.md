# #4482 search and #4483 heading-id probe summaries

Permanent summary of the temporary evidence directories `_temp-resource/4430-zfb3-migration/4482-search/` and `4483-heading-ids/` (raw logs are not preserved after #4476). Durable write-ups: [round2-search-kbd.md](round2-search-kbd.md) and [round2-heading-ids.md](round2-heading-ids.md).

## #4482 search shortcut (zudo-doc follow-up of #4478)

- Review commits: search `f7ef485dd69e246e7de6934cfa1d9a921a7cc117`, follow-up `f8326b54a3310ba94bbf9e99dbfce230e2af7a81`, reviewed against manager `363c6e3f`.
- Independent review found two P2 issues in the first implementation: `connectedCallback` re-captured the live results HTML as the placeholder on reconnect, and the browser case mutated the shipped `type=text` input into `type=search` to prove Escape clearing, which was not production behavior.
- Follow-up fix: the generator captures the shortcut-populated placeholder exactly once; the browser case uses the shipped `type=text` input (Escape closes the dialog and keeps the query). The CSP pin became `sha256-zrm1SXKXHE5cZoETiYV+zyWOBhIjBNDI31NxMPKvINU=`.
- Pre-fix browser harness: the macOS and Windows shortcut cases (`e2e/smoke-search-shortcut.spec.ts`) failed on the empty badge; after the fix the smoke search run passed 12/12 under the shared heavy guard.
- The review stated that no existing assertion, snapshot, normalizer or gate configuration was weakened.

## #4483 heading ids

- Pre-fix regression run: 3 failures / 87 passes (helper returned nine IDs including `gt-1000ms`, `lt-2mm` and the false `code-block-target`); post-fix focused suite 90/90.
- Independent review of heading commits `90fad5165eb5d480f92fe09008a9d21999b1edef` and `e61fafca8b7410602f756135b2627fa920fe44cb`: no substantive finding. parse5 is a declared runtime dependency; fence state requires valid homogeneous openers and whitespace-only same-character closers of sufficient length.
- Packed proof: frozen install and build of the packed candidate with the strict proof and guard passed; the packed build verification log ended with 46 TOC targets, 27 valid anchors and 2 planted failures that the proof correctly detected.
- Reproduction tooling preserved in [4483-heading-ids/](4483-heading-ids/): `setup-packed-probe.mjs`, `verify-built-packed.mjs`, `native-probe.mjs` and the `project-template/` consumer they copy. Commands in [round2-heading-ids.md](round2-heading-ids.md) point at these paths.
