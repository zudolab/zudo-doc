# Migration Check Report

**Generated**: 2026-04-29T18:23:57.505Z
**Findings files**: 5 batch file(s), 234 route(s) total

---

## Summary

| Category | Routes |
| --- | --- |
| content-loss | 133 |
| asset-loss | 5 |
| route-only-in-a | 68 |
| route-only-in-b | 28 |
| **Total** | **234** |

---

## Symmetric-Difference Routes

Routes present in one site but not the other (likely added or removed pages).

### Routes only in A (removed in B) — 68 route(s)

- `/docs/changelog`
- `/docs/changelog/010`
- `/docs/claude-md/packages--ai-chat-worker`
- `/docs/claude`
- `/docs/components`
- `/docs/develop`
- `/docs/getting-started`
- `/docs/guides`
- `/docs/guides/layout-demos`
- `/docs/reference`
- `/docs/reference/ai-chat-worker`
- `/docs/tags`
- `/docs/tags/ai`
- `/docs/tags/cloudflare-worker`
- `/docs/tags/content`
- `/docs/tags/customization`
- `/docs/tags/design-system`
- `/docs/tags/doc-history`
- `/docs/tags/i18n`
- `/docs/tags/search`
- `/docs/tags/type:guide`
- `/docs/versions`
- `/ja/docs/changelog`
- `/ja/docs/changelog/010`
- `/ja/docs/claude-agents`
- `/ja/docs/claude-commands`
- `/ja/docs/claude-md`
- `/ja/docs/claude-md/e2e`
- `/ja/docs/claude-md/packages--ai-chat-worker`
- `/ja/docs/claude-md/packages--create-zudo-doc`
- `/ja/docs/claude-md/packages--doc-history-server`
- `/ja/docs/claude-md/packages--search-worker`
- `/ja/docs/claude-md/src--config`
- `/ja/docs/claude-md/src`
- `/ja/docs/claude-md/vendor--design-token-lint`
- `/ja/docs/claude-skills`
- `/ja/docs/claude-skills/l-generator-cli-tester`
- `/ja/docs/claude-skills/l-run-generator-cli-whole-test`
- `/ja/docs/claude-skills/l-update-generator`
- `/ja/docs/claude-skills/zudo-doc-design-system`
- `/ja/docs/claude-skills/zudo-doc-navigation-design`
- `/ja/docs/claude-skills/zudo-doc-translate`
- `/ja/docs/claude-skills/zudo-doc-version-bump`
- `/ja/docs/claude-skills/zudo-doc-writing-rules`
- `/ja/docs/claude`
- `/ja/docs/components`
- `/ja/docs/develop`
- `/ja/docs/getting-started`
- `/ja/docs/guides`
- `/ja/docs/guides/ai-assistant`
- `/ja/docs/guides/layout-demos`
- `/ja/docs/reference`
- `/ja/docs/reference/ai-assistant-api`
- `/ja/docs/reference/ai-chat-worker`
- `/ja/docs/tags`
- `/ja/docs/tags/ai`
- `/ja/docs/tags/cloudflare-worker`
- `/ja/docs/tags/content`
- `/ja/docs/tags/customization`
- `/ja/docs/tags/design-system`
- `/ja/docs/tags/doc-history`
- `/ja/docs/tags/i18n`
- `/ja/docs/tags/search`
- `/ja/docs/tags/type:guide`
- `/ja/docs/versions`
- `/v/1.0/docs/getting-started`
- `/v/1.0/ja/docs/getting-started`
- `/v/1.0/ja/docs/getting-started/installation`

### Routes only in B (added in B) — 28 route(s)

- `/docs/changelog/0.1.0`
- `/docs/changelog/index`
- `/docs/claude-skills/l-zfb-migration-check`
- `/docs/claude/index`
- `/docs/components/index`
- `/docs/concepts/routing-conventions`
- `/docs/concepts/trailing-slash-policy`
- `/docs/develop/index`
- `/docs/getting-started/index`
- `/docs/guides/index`
- `/docs/guides/layout-demos/index`
- `/docs/reference/index`
- `/ja/docs/changelog/0.1.0`
- `/ja/docs/changelog/index`
- `/ja/docs/claude-agents/index`
- `/ja/docs/claude-commands/index`
- `/ja/docs/claude-md/index`
- `/ja/docs/claude-skills/index`
- `/ja/docs/claude/index`
- `/ja/docs/components/index`
- `/ja/docs/concepts/routing-conventions`
- `/ja/docs/concepts/trailing-slash-policy`
- `/ja/docs/develop/index`
- `/ja/docs/getting-started/index`
- `/ja/docs/guides/index`
- `/ja/docs/guides/layout-demos/index`
- `/ja/docs/reference/index`
- `/v/1.0/docs/getting-started/index`

---

## Non-HTML Artifact Diffs

**Stats**: 4 artifact(s) — 0 identical, 4 changed, 0 only-in-A, 0 only-in-B

- **`llms-full.txt`** (text) — 154 line(s) removed, 281 line(s) added
- **`llms.txt`** (text) — 2 line(s) removed, 3 line(s) added
- **`search-index.json`** (JSON) — entry count delta: +3
- **`sitemap.xml`** (text) — 68 line(s) removed, 28 line(s) added

---

## Top Clusters (top 20 by route count)

Routes with identical diff signatures are grouped together.
Cluster sample size is capped at 5 representative routes.

### 1. `asset-loss` — Asset removed or path changed (pattern: 65be7136676d54e3…) — 1 route(s)

**Signature**: `65be7136676d54e3e7f3607fd0625367fd73b6b421eb129938edb418ca7563f9`

**Sample routes**:

- `/`

---

### 2. `asset-loss` — Asset removed or path changed (pattern: c565851a8bb5036a…) — 1 route(s)

**Signature**: `c565851a8bb5036a273cf5f58ddde26e23f2bc2a14f717b074fe1903b76e5ab7`

**Sample routes**:

- `/docs/components/html-preview`

---

### 3. `asset-loss` — Asset removed or path changed (pattern: e51b34bc66474e63…) — 1 route(s)

**Signature**: `e51b34bc66474e63a45d2dd139d519afdf5969968ae22a24a157df6397226ddc`

**Sample routes**:

- `/ja`

---

### 4. `asset-loss` — Asset removed or path changed (pattern: 0fd70bad0ffe1091…) — 1 route(s)

**Signature**: `0fd70bad0ffe10916abdeaeec0f20dedd831a1434ae7791e4064417510880c4c`

**Sample routes**:

- `/ja/docs/components/html-preview`

---

### 5. `asset-loss` — Asset removed or path changed (pattern: 56b2fbcb19770e47…) — 1 route(s)

**Signature**: `56b2fbcb19770e478652642053195b0e831221d1f43db5c8effc65a78747a223`

**Sample routes**:

- `/ja/docs/develop/generator-cli-testing`

---

### 6. `content-loss` — Content loss (pattern: 79916fe22bbd6bfa…) — 1 route(s)

**Signature**: `79916fe22bbd6bfa4c029485080192c277adc4f1f7e9d2869d7d6171a25f2c7e`

**Sample routes**:

- `/docs/claude-agents/doc-reviewer`

---

### 7. `content-loss` — Content loss (pattern: 0d7437605b952068…) — 1 route(s)

**Signature**: `0d7437605b952068920406371b9dbfbc7e4616764dabb78d4644d8577d254ff9`

**Sample routes**:

- `/docs/claude-md/e2e`

---

### 8. `content-loss` — Content loss (pattern: 62666c7a8a63966d…) — 1 route(s)

**Signature**: `62666c7a8a63966db1f1f5da407c782cb5b4f4bec96bf9940cde267a7e27a898`

**Sample routes**:

- `/docs/claude-md/packages--create-zudo-doc`

---

### 9. `content-loss` — Content loss (pattern: 1ff11d565e870d7b…) — 1 route(s)

**Signature**: `1ff11d565e870d7ba453e77c17592ef98485148d951ac7b69817b9db578c2490`

**Sample routes**:

- `/docs/claude-md/packages--doc-history-server`

---

### 10. `content-loss` — Content loss (pattern: 40705370f9b1a08a…) — 1 route(s)

**Signature**: `40705370f9b1a08a7e08517801e900ebfd1d52510b39f374355ccc176d3e0a13`

**Sample routes**:

- `/docs/claude-md/packages--search-worker`

---

### 11. `content-loss` — Content loss (pattern: 8c3ad7edfc7e3834…) — 1 route(s)

**Signature**: `8c3ad7edfc7e38344bd6c934b5084a6b0dc164553042069d780869c261491424`

**Sample routes**:

- `/docs/claude-md/root`

---

### 12. `content-loss` — Content loss (pattern: d5e44c375f19d00c…) — 1 route(s)

**Signature**: `d5e44c375f19d00cb7ac275458f51827298209b2d54e1b87567e791150e2cf3b`

**Sample routes**:

- `/docs/claude-md/src--config`

---

### 13. `content-loss` — Content loss (pattern: deabd6b3c7e3dff0…) — 1 route(s)

**Signature**: `deabd6b3c7e3dff01751fb691a1b06506820f5264cfec5d4a15ba2c2e044cf98`

**Sample routes**:

- `/docs/claude-md/src`

---

### 14. `content-loss` — Content loss (pattern: ef9f38d5a9ffceb9…) — 1 route(s)

**Signature**: `ef9f38d5a9ffceb9de8d5d277099a992f97bd3c111fae2b5db74d74d6baaef84`

**Sample routes**:

- `/docs/claude-md/vendor--design-token-lint`

---

### 15. `content-loss` — Content loss (pattern: 43dc75f9db28f280…) — 1 route(s)

**Signature**: `43dc75f9db28f2808b0f0abfe4814b8c964f7cb7bac865aa2cbc43b6a73c7d3f`

**Sample routes**:

- `/docs/claude-skills/check-docs`

---

### 16. `content-loss` — Content loss (pattern: 710bde7009560fda…) — 1 route(s)

**Signature**: `710bde7009560fdab1e795695b0ae073c123c8e12c05f83c49f47c9639f35714`

**Sample routes**:

- `/docs/claude-skills/l-generator-cli-tester`

---

### 17. `content-loss` — Content loss (pattern: ef873ae7c5098026…) — 1 route(s)

**Signature**: `ef873ae7c5098026bf8713f691b8b91a5b1816c65303f96124c96e804acf16a3`

**Sample routes**:

- `/docs/claude-skills/l-run-generator-cli-whole-test`

---

### 18. `content-loss` — Content loss (pattern: 3a8478b67a313d0e…) — 1 route(s)

**Signature**: `3a8478b67a313d0e6466724295a0322723c90409531e17cb0d282f6264c21c08`

**Sample routes**:

- `/docs/claude-skills/l-update-generator`

---

### 19. `content-loss` — Content loss (pattern: 05bf3a9f46d26962…) — 1 route(s)

**Signature**: `05bf3a9f46d269621cc1fa1b7a20b7201b72e218621dd2ccf4154a0b93049b75`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-design-system`

---

### 20. `content-loss` — Content loss (pattern: 862c608c013472af…) — 1 route(s)

**Signature**: `862c608c013472af8370f975624fd3e5e11be6c468400bb146ca4c3c2e2d83cf`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-navigation-design`

---

---

## Suggested Issues

One entry per non-cosmetic cluster. Copy the `gh issue create` command to file a tracking issue.

### 1. [migration-check] asset-loss: Asset removed or path changed (pattern: 65be7136676d54e3…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 65be7136676d54e3…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `65be7136676d54e3e7f3607fd0625367fd73b6b421eb129938edb418ca7563f9`
**Description**: Asset removed or path changed (pattern: 65be7136676d54e3…)

**Sample routes**: `/`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `65be7136676d54e3e7f3607fd0625367fd73b6b421eb129938edb418ca7563f9`
**Description**: Asset removed or path changed (pattern: 65be7136676d54e3…)

**Sample routes**: `/`

_Generated by migration-check harness. Review the full report before filing._

---

### 2. [migration-check] asset-loss: Asset removed or path changed (pattern: c565851a8bb5036a…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: c565851a8bb5036a…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `c565851a8bb5036a273cf5f58ddde26e23f2bc2a14f717b074fe1903b76e5ab7`
**Description**: Asset removed or path changed (pattern: c565851a8bb5036a…)

**Sample routes**: `/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `c565851a8bb5036a273cf5f58ddde26e23f2bc2a14f717b074fe1903b76e5ab7`
**Description**: Asset removed or path changed (pattern: c565851a8bb5036a…)

**Sample routes**: `/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._

---

### 3. [migration-check] asset-loss: Asset removed or path changed (pattern: e51b34bc66474e63…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: e51b34bc66474e63…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `e51b34bc66474e63a45d2dd139d519afdf5969968ae22a24a157df6397226ddc`
**Description**: Asset removed or path changed (pattern: e51b34bc66474e63…)

**Sample routes**: `/ja`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `e51b34bc66474e63a45d2dd139d519afdf5969968ae22a24a157df6397226ddc`
**Description**: Asset removed or path changed (pattern: e51b34bc66474e63…)

**Sample routes**: `/ja`

_Generated by migration-check harness. Review the full report before filing._

---

### 4. [migration-check] asset-loss: Asset removed or path changed (pattern: 0fd70bad0ffe1091…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 0fd70bad0ffe1091…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `0fd70bad0ffe10916abdeaeec0f20dedd831a1434ae7791e4064417510880c4c`
**Description**: Asset removed or path changed (pattern: 0fd70bad0ffe1091…)

**Sample routes**: `/ja/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `0fd70bad0ffe10916abdeaeec0f20dedd831a1434ae7791e4064417510880c4c`
**Description**: Asset removed or path changed (pattern: 0fd70bad0ffe1091…)

**Sample routes**: `/ja/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._

---

### 5. [migration-check] asset-loss: Asset removed or path changed (pattern: 56b2fbcb19770e47…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 56b2fbcb19770e47…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `56b2fbcb19770e478652642053195b0e831221d1f43db5c8effc65a78747a223`
**Description**: Asset removed or path changed (pattern: 56b2fbcb19770e47…)

**Sample routes**: `/ja/docs/develop/generator-cli-testing`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `56b2fbcb19770e478652642053195b0e831221d1f43db5c8effc65a78747a223`
**Description**: Asset removed or path changed (pattern: 56b2fbcb19770e47…)

**Sample routes**: `/ja/docs/develop/generator-cli-testing`

_Generated by migration-check harness. Review the full report before filing._

---

### 6. [migration-check] content-loss: Content loss (pattern: 79916fe22bbd6bfa…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 79916fe22bbd6bfa…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `79916fe22bbd6bfa4c029485080192c277adc4f1f7e9d2869d7d6171a25f2c7e`
**Description**: Content loss (pattern: 79916fe22bbd6bfa…)

**Sample routes**: `/docs/claude-agents/doc-reviewer`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `79916fe22bbd6bfa4c029485080192c277adc4f1f7e9d2869d7d6171a25f2c7e`
**Description**: Content loss (pattern: 79916fe22bbd6bfa…)

**Sample routes**: `/docs/claude-agents/doc-reviewer`

_Generated by migration-check harness. Review the full report before filing._

---

### 7. [migration-check] content-loss: Content loss (pattern: 0d7437605b952068…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 0d7437605b952068…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `0d7437605b952068920406371b9dbfbc7e4616764dabb78d4644d8577d254ff9`
**Description**: Content loss (pattern: 0d7437605b952068…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `0d7437605b952068920406371b9dbfbc7e4616764dabb78d4644d8577d254ff9`
**Description**: Content loss (pattern: 0d7437605b952068…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._

---

### 8. [migration-check] content-loss: Content loss (pattern: 62666c7a8a63966d…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 62666c7a8a63966d…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `62666c7a8a63966db1f1f5da407c782cb5b4f4bec96bf9940cde267a7e27a898`
**Description**: Content loss (pattern: 62666c7a8a63966d…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `62666c7a8a63966db1f1f5da407c782cb5b4f4bec96bf9940cde267a7e27a898`
**Description**: Content loss (pattern: 62666c7a8a63966d…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._

---

### 9. [migration-check] content-loss: Content loss (pattern: 1ff11d565e870d7b…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 1ff11d565e870d7b…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `1ff11d565e870d7ba453e77c17592ef98485148d951ac7b69817b9db578c2490`
**Description**: Content loss (pattern: 1ff11d565e870d7b…)

**Sample routes**: `/docs/claude-md/packages--doc-history-server`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `1ff11d565e870d7ba453e77c17592ef98485148d951ac7b69817b9db578c2490`
**Description**: Content loss (pattern: 1ff11d565e870d7b…)

**Sample routes**: `/docs/claude-md/packages--doc-history-server`

_Generated by migration-check harness. Review the full report before filing._

---

### 10. [migration-check] content-loss: Content loss (pattern: 40705370f9b1a08a…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 40705370f9b1a08a…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `40705370f9b1a08a7e08517801e900ebfd1d52510b39f374355ccc176d3e0a13`
**Description**: Content loss (pattern: 40705370f9b1a08a…)

**Sample routes**: `/docs/claude-md/packages--search-worker`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `40705370f9b1a08a7e08517801e900ebfd1d52510b39f374355ccc176d3e0a13`
**Description**: Content loss (pattern: 40705370f9b1a08a…)

**Sample routes**: `/docs/claude-md/packages--search-worker`

_Generated by migration-check harness. Review the full report before filing._

---

### 11. [migration-check] content-loss: Content loss (pattern: 8c3ad7edfc7e3834…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 8c3ad7edfc7e3834…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `8c3ad7edfc7e38344bd6c934b5084a6b0dc164553042069d780869c261491424`
**Description**: Content loss (pattern: 8c3ad7edfc7e3834…)

**Sample routes**: `/docs/claude-md/root`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `8c3ad7edfc7e38344bd6c934b5084a6b0dc164553042069d780869c261491424`
**Description**: Content loss (pattern: 8c3ad7edfc7e3834…)

**Sample routes**: `/docs/claude-md/root`

_Generated by migration-check harness. Review the full report before filing._

---

### 12. [migration-check] content-loss: Content loss (pattern: d5e44c375f19d00c…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: d5e44c375f19d00c…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `d5e44c375f19d00cb7ac275458f51827298209b2d54e1b87567e791150e2cf3b`
**Description**: Content loss (pattern: d5e44c375f19d00c…)

**Sample routes**: `/docs/claude-md/src--config`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `d5e44c375f19d00cb7ac275458f51827298209b2d54e1b87567e791150e2cf3b`
**Description**: Content loss (pattern: d5e44c375f19d00c…)

**Sample routes**: `/docs/claude-md/src--config`

_Generated by migration-check harness. Review the full report before filing._

---

### 13. [migration-check] content-loss: Content loss (pattern: deabd6b3c7e3dff0…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: deabd6b3c7e3dff0…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `deabd6b3c7e3dff01751fb691a1b06506820f5264cfec5d4a15ba2c2e044cf98`
**Description**: Content loss (pattern: deabd6b3c7e3dff0…)

**Sample routes**: `/docs/claude-md/src`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `deabd6b3c7e3dff01751fb691a1b06506820f5264cfec5d4a15ba2c2e044cf98`
**Description**: Content loss (pattern: deabd6b3c7e3dff0…)

**Sample routes**: `/docs/claude-md/src`

_Generated by migration-check harness. Review the full report before filing._

---

### 14. [migration-check] content-loss: Content loss (pattern: ef9f38d5a9ffceb9…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: ef9f38d5a9ffceb9…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `ef9f38d5a9ffceb9de8d5d277099a992f97bd3c111fae2b5db74d74d6baaef84`
**Description**: Content loss (pattern: ef9f38d5a9ffceb9…)

**Sample routes**: `/docs/claude-md/vendor--design-token-lint`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `ef9f38d5a9ffceb9de8d5d277099a992f97bd3c111fae2b5db74d74d6baaef84`
**Description**: Content loss (pattern: ef9f38d5a9ffceb9…)

**Sample routes**: `/docs/claude-md/vendor--design-token-lint`

_Generated by migration-check harness. Review the full report before filing._

---

### 15. [migration-check] content-loss: Content loss (pattern: 43dc75f9db28f280…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 43dc75f9db28f280…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `43dc75f9db28f2808b0f0abfe4814b8c964f7cb7bac865aa2cbc43b6a73c7d3f`
**Description**: Content loss (pattern: 43dc75f9db28f280…)

**Sample routes**: `/docs/claude-skills/check-docs`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `43dc75f9db28f2808b0f0abfe4814b8c964f7cb7bac865aa2cbc43b6a73c7d3f`
**Description**: Content loss (pattern: 43dc75f9db28f280…)

**Sample routes**: `/docs/claude-skills/check-docs`

_Generated by migration-check harness. Review the full report before filing._

---

### 16. [migration-check] content-loss: Content loss (pattern: 710bde7009560fda…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 710bde7009560fda…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `710bde7009560fdab1e795695b0ae073c123c8e12c05f83c49f47c9639f35714`
**Description**: Content loss (pattern: 710bde7009560fda…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `710bde7009560fdab1e795695b0ae073c123c8e12c05f83c49f47c9639f35714`
**Description**: Content loss (pattern: 710bde7009560fda…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._

---

### 17. [migration-check] content-loss: Content loss (pattern: ef873ae7c5098026…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: ef873ae7c5098026…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `ef873ae7c5098026bf8713f691b8b91a5b1816c65303f96124c96e804acf16a3`
**Description**: Content loss (pattern: ef873ae7c5098026…)

**Sample routes**: `/docs/claude-skills/l-run-generator-cli-whole-test`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `ef873ae7c5098026bf8713f691b8b91a5b1816c65303f96124c96e804acf16a3`
**Description**: Content loss (pattern: ef873ae7c5098026…)

**Sample routes**: `/docs/claude-skills/l-run-generator-cli-whole-test`

_Generated by migration-check harness. Review the full report before filing._

---

### 18. [migration-check] content-loss: Content loss (pattern: 3a8478b67a313d0e…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 3a8478b67a313d0e…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `3a8478b67a313d0e6466724295a0322723c90409531e17cb0d282f6264c21c08`
**Description**: Content loss (pattern: 3a8478b67a313d0e…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `3a8478b67a313d0e6466724295a0322723c90409531e17cb0d282f6264c21c08`
**Description**: Content loss (pattern: 3a8478b67a313d0e…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._

---

### 19. [migration-check] content-loss: Content loss (pattern: 05bf3a9f46d26962…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 05bf3a9f46d26962…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `05bf3a9f46d269621cc1fa1b7a20b7201b72e218621dd2ccf4154a0b93049b75`
**Description**: Content loss (pattern: 05bf3a9f46d26962…)

**Sample routes**: `/docs/claude-skills/zudo-doc-design-system`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `05bf3a9f46d269621cc1fa1b7a20b7201b72e218621dd2ccf4154a0b93049b75`
**Description**: Content loss (pattern: 05bf3a9f46d26962…)

**Sample routes**: `/docs/claude-skills/zudo-doc-design-system`

_Generated by migration-check harness. Review the full report before filing._

---

### 20. [migration-check] content-loss: Content loss (pattern: 862c608c013472af…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 862c608c013472af…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `862c608c013472af8370f975624fd3e5e11be6c468400bb146ca4c3c2e2d83cf`
**Description**: Content loss (pattern: 862c608c013472af…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `862c608c013472af8370f975624fd3e5e11be6c468400bb146ca4c3c2e2d83cf`
**Description**: Content loss (pattern: 862c608c013472af…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._

---
