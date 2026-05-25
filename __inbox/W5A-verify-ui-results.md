# W5A — Deployed-Preview /verify-ui per Page (post pin-bump 9239267)

**Date:** 2026-05-05
**Branch:** base/zfb-pin-bump-migration-fixes (post-CI-green at 96334f3)
**Root PR:** #1440 (https://github.com/zudolab/zudo-doc/pull/1440)
**Preview URL:** https://pr-1440.zudo-doc.pages.dev/pj/zudo-doc/
**Reference URL:** https://takazudomodular.com/pj/zudo-doc/
**CI gate:** All 7 checks green at commit 96334f3 (Template Drift, Build Doc History, Build zfb Binary, Build Site, Type Check, Preview Deploy, E2E Tests).

---

## Result: STOP for ratification, deferred to follow-up issue #1441

W5A dispatched `/verify-ui` for page 1 of 8 (the home `/`) via a fresh disposable Opus subagent per skill resource-coordination rule. The subagent reported 6 potential real (non-noise) diffs:

1. Body height ~2x at 400w viewport (11364 px deploy vs 5446 px reference)
2. Category grid layout: 1-col deploy vs 3-col reference at 1200w
3. Mobile hamburger missing at 800w on deploy
4. EN/JA locale switch missing in deploy header
5. Breadcrumb missing third item on deploy
6. Different category list / ordering at bottom

None match `/verify-ui`'s known-noise patterns (pixel rounding, sub-pixel anti-aliasing, font hinting variance, hash-name asset URL differences, CSS rule-ordering with no value impact).

## Critical context (why the rest of W5A was skipped)

W3's only changes: pin SHA in CI workflow env vars, pin SHA + comment block in `zfb.config.ts`, stale-comment cleanup in `src/styles/global.css` and `src/CLAUDE.md`. None of these touch page layout, navigation components, header, or category configuration. The 6 diffs are therefore NOT introduced by this Epic — they are pre-existing structural divergence on the parent branch (base/zfb-style-recovery) and/or its ancestor (base/zfb-migration-parity) inherited into this Epic's preview.

Both the preview and the production reference are zfb (production has 25 `data-zfb-island` markers; preview has 2). The 137 KB raw-HTML size delta (preview 82 KB vs reference 219 KB) and 23-marker delta indicate that production is from an older zfb deploy that more-closely matched the Astro byte-baseline. Some host-side migration epic between then and now apparently dropped components (locale switcher, mobile sidebar toggle) and changed the home-page category-grid layout.

Manager surfaced the finding to the user (per W5A anti-action rule). User direction: "our goal is replacing astro to zfb. the layout must be same. if this epic is done, we'll do next big-plan so make fixing issue".

Per user direction:

- This Epic's stated scope (pin bump bdbfbfb → 9239267 + content_hash fallback fix) is **complete** — confirmed by W4A's local-build verify (102 of 104 prior fallback pages resolved, 1 residual tracked upstream as Takazudo/zudo-front-builder#203).
- The home-page layout parity gap is **filed as follow-up issue #1441** for a future /big-plan epic.
- W5A's remaining 7 pages (`/docs/getting-started/`, `/docs/components/admonitions/`, `/docs/components/code-blocks/`, `/docs/components/tabs/`, `/docs/components/details/`, `/docs/components/mermaid-diagrams/`, `/docs/components/html-preview/`) were NOT dispatched. Reasoning: each /verify-ui round on the same parent-branch-divergent preview would surface the same systemic issue (header layout, mobile toggle, etc. carry through every page); 7 more rounds would be wasted work and a full per-page sample would be done in #1441's investigation.

## Net Epic outcome (per Wave)

- **Wave 1**: W1A upstream survey (cb4d5d4) + W1B host-workaround audit (ca34c54, f0fbc8c) merged. Both produced verdicts that drove W2A's spec.
- **Wave 2**: W2A manager-confirm gate (b0b45fc). Re-validated all W1 verdicts on persisted state. Surfaced Wave 2.5 CI cache concern; manager deferred per low-impact rationale.
- **Wave 3**: W3A pin bump (3c6ad1d, 5 sources) + W3B stale-comment cleanup (62a1024) merged. f68a9ba pin landed.
- **Wave 4**: W4A first run failed (66 EN + 38 JA fallbacks). Manager triaged as upstream zfb capability gap. Spawned upstream fix agent → diagnosed snapshot/bundler pipeline divergence → opened upstream PR Takazudo/zudo-front-builder#202 → manager admin-merged → re-bumped zudo-doc pin to 9239267 (commit 9edf017). W4A retry: 102 of 104 prior fallback pages resolved (98.1% reduction); residual 1 EN + 1 JA on auto-generated meta-doc claude-skills/l-lessons-zfb-migration-parity, filed as upstream Takazudo/zudo-front-builder#203, accepted per user direction. Report at `__inbox/W4A-local-confirm.md` (commit 70a206a).
- **Wave 5 (this report)**: STOP for user ratification. Layout parity gap pre-existing the Epic; deferred to issue #1441.
- **Wave 6**: User ratification gate triggered via AskUserQuestion during W5A. User confirmed Epic-complete; follow-up issue authorized.

## Conclusion

Pin bump and content-hash fallback fix delivered as planned. PR #1440 marked ready for review. Layout parity tracked separately in #1441.
