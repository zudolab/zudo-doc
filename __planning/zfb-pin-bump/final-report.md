# Wave 4 — Final verification report

- **Date**: 2026-05-05
- **Epic**: zudolab/zudo-doc#1407
- **Root PR**: zudolab/zudo-doc#1416 (`base/zfb-pin-bump-embed-v8` → `base/zfb-migration-parity`)
- **Final SHA**: `bdbfbfb80d57f86de2485100af380b4b8c82c8f7` (shifted twice from spec target during execution)

## SHA evolution

| Step | SHA | Reason |
|---|---|---|
| Plan target | `e550167` | Original upstream main HEAD when /big-plan ran |
| W2 spec target | `0549132` | After W1B's autonomous fix (PR #170: cold-start rebuild + PageCache disk fallback) |
| W3 final | `bdbfbfb` | After W3's discovery + autonomous fix of `node:async_hooks` stub gap (`AsyncLocalStorage` import in `@takazudo/zfb-adapter-cloudflare`) |

W1B and W3 both exercised the autonomous upstream fix authority granted by the user for this epic.

## CI verification (PR #1416)

All 7 checks GREEN:

| Check | Result |
|---|---|
| Type Check | pass |
| Build Site | pass |
| Build zfb Binary | pass (deno_core cold compile cached) |
| Build Doc History | pass |
| Template Drift | pass |
| **E2E Tests** | **pass** — W1D `domcontentloaded` swap + smoke fixture build green |
| **Preview Deploy** | **pass** — comment-posting transient 502 from earlier run did not recur |

Final CI run: 2026-05-05 02:49 (durations consistent with cached deno_core artifacts).

## Manager-side independent re-grep on persisted state

```
$ pnpm install   # 24.9s
$ pnpm build     # 247 pages in 179.89s
$ grep -c '/pj/zudo-doc/assets/' dist/index.html       # 1
$ grep -c '/pj/zudo-doc/img/' dist/index.html          # 1
$ grep -c 'type="module"' dist/index.html              # 2
```

Sample URLs in `dist/index.html`:

- `/pj/zudo-doc/assets/islands-ce0a5b92.js`
- `/pj/zudo-doc/assets/styles-303abaff.css`
- `/pj/zudo-doc/img/logo.svg`

Prefixed-asset regression guard (epic #1386) holds with the new pin.

## Deployed-preview curl smoke

Preview URL: `https://pr-1416.zudo-doc.pages.dev`

```
$ curl -sf "https://pr-1416.zudo-doc.pages.dev/pj/zudo-doc/" -o /tmp/preview.html
$ wc -l /tmp/preview.html                              # 1040
$ grep -c '/pj/zudo-doc/' /tmp/preview.html            # 2 (in style+script tags + many docs links)
```

Sample refs:

- `href="/pj/zudo-doc/assets/styles-ea3fb6dc.css"`
- `href="/pj/zudo-doc/docs/changelog/"` (and many sibling doc paths)

Cloudflare Pages serves the prefixed deployment correctly.

## Wave 1–4 commit summary

```
6a7e77c Merge W1A: upstream survey
86d8e4f Merge W1B: upstream smoke + PR #170 fix
bef5623 Merge W1C: cache strategy decision
bfd5b4c Merge W1D: e2e smoke-search domcontentloaded fix
e92482e Merge W2: pin-bump implementation spec
a4df3c9 Merge W3: atomic pin bump 88cec07 → bdbfbfb (embed-v8 + async_hooks + consumer page fixes)
```

## Hand-off to Wave 5 (#1415)

W5 should:

1. Append `l-lessons-zfb-migration-parity` retro entry capturing:
   - Two consecutive autonomous upstream fixes were needed (cold-start rebuild + async_hooks stub) — the embed-v8 architecture has more deferred edges than ADR-007 enumerated
   - Consumer-side audit (W1A) missed the router-props signature change from upstream PR #157; future audits should grep for the page-handler call shape, not just keywords
   - SHA target shifted twice during execution; the wave plan's "manager-confirm gate" (W2) successfully caught the first shift but the second only surfaced via build verification
2. Delete `__planning/zfb-pin-bump/` (or move its contents into the lessons file)
3. Close any remaining open Wave issues (#1414, #1413 will be closed automatically; #1415 closes itself)
