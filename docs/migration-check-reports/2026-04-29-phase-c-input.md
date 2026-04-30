# Migration Check Report

**Generated**: 2026-04-29T16:16:34.278Z
**Findings files**: 5 batch file(s), 234 route(s) total

---

## Summary

| Category | Routes |
| --- | --- |
| content-loss | 134 |
| asset-loss | 4 |
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

### 2. `asset-loss` — Asset removed or path changed (pattern: 7727fbba06dae061…) — 1 route(s)

**Signature**: `7727fbba06dae061017c1ec05d669bf430baa3872c3515ea476d0616e67154dc`

**Sample routes**:

- `/docs/components/html-preview`

---

### 3. `asset-loss` — Asset removed or path changed (pattern: e51b34bc66474e63…) — 1 route(s)

**Signature**: `e51b34bc66474e63a45d2dd139d519afdf5969968ae22a24a157df6397226ddc`

**Sample routes**:

- `/ja`

---

### 4. `asset-loss` — Asset removed or path changed (pattern: e85446905b8df230…) — 1 route(s)

**Signature**: `e85446905b8df230998058d329c99c51f8f9e6543fe96fc16f5a0177dcd7c9ea`

**Sample routes**:

- `/ja/docs/components/html-preview`

---

### 5. `content-loss` — Content loss (pattern: e8c412fca3916fba…) — 1 route(s)

**Signature**: `e8c412fca3916fba8e3dd4eb1bdae111f1501bcf50a6f1236e506621bb7c4e06`

**Sample routes**:

- `/docs/claude-agents/doc-reviewer`

---

### 6. `content-loss` — Content loss (pattern: 2dd63aff363c152a…) — 1 route(s)

**Signature**: `2dd63aff363c152a708a803f8ecee905e9a5b6fdc40e1c01077973fbf48795aa`

**Sample routes**:

- `/docs/claude-md/e2e`

---

### 7. `content-loss` — Content loss (pattern: e426748a1959ceff…) — 1 route(s)

**Signature**: `e426748a1959ceffa057eefa45730e372bf6ae857fbb15e5461549f3ef98a732`

**Sample routes**:

- `/docs/claude-md/packages--create-zudo-doc`

---

### 8. `content-loss` — Content loss (pattern: 40542d31c51e270d…) — 1 route(s)

**Signature**: `40542d31c51e270d83b3b6e263b03afa9d7847be445f5c1be5422e6b480967ab`

**Sample routes**:

- `/docs/claude-md/packages--doc-history-server`

---

### 9. `content-loss` — Content loss (pattern: 67f13ed65bb07819…) — 1 route(s)

**Signature**: `67f13ed65bb07819a16b926d7e1e769cbd948274e1479854c9229006194ed17c`

**Sample routes**:

- `/docs/claude-md/packages--search-worker`

---

### 10. `content-loss` — Content loss (pattern: f600d1afa13cd95e…) — 1 route(s)

**Signature**: `f600d1afa13cd95e2c19ab534416ef84d8cc57635655d12c6de02e52937e51ab`

**Sample routes**:

- `/docs/claude-md/root`

---

### 11. `content-loss` — Content loss (pattern: 409ff870e67d2b59…) — 1 route(s)

**Signature**: `409ff870e67d2b596b0392caf7cd8ed6078802b84fe4f1fea073c642ef7f8df2`

**Sample routes**:

- `/docs/claude-md/src--config`

---

### 12. `content-loss` — Content loss (pattern: e26433c2e9b4b34e…) — 1 route(s)

**Signature**: `e26433c2e9b4b34e3aee437225977601a2feb357d58e20f99e3372c3ee6d59b7`

**Sample routes**:

- `/docs/claude-md/src`

---

### 13. `content-loss` — Content loss (pattern: 325c0730c0134dea…) — 1 route(s)

**Signature**: `325c0730c0134deafb541cdb37628c3796b1d152c5c13732fb982ded4dd99206`

**Sample routes**:

- `/docs/claude-md/vendor--design-token-lint`

---

### 14. `content-loss` — Content loss (pattern: f05c17633348b855…) — 1 route(s)

**Signature**: `f05c17633348b855f1469b30b804570d345d7d52796e761d4e7726c9c0543d9c`

**Sample routes**:

- `/docs/claude-skills/check-docs`

---

### 15. `content-loss` — Content loss (pattern: c6920c0f3ec7dc46…) — 1 route(s)

**Signature**: `c6920c0f3ec7dc46b5472612cd62cc22680a6df5e2c2dfe2c4fd94428d262ac1`

**Sample routes**:

- `/docs/claude-skills/l-generator-cli-tester`

---

### 16. `content-loss` — Content loss (pattern: adb88874553036e0…) — 1 route(s)

**Signature**: `adb88874553036e0b0e04280ff7cfa3738cf478c3fb888906b25c9b88ffe1d26`

**Sample routes**:

- `/docs/claude-skills/l-run-generator-cli-whole-test`

---

### 17. `content-loss` — Content loss (pattern: 9939305928c168b6…) — 1 route(s)

**Signature**: `9939305928c168b6e050c2e57256981cfffadb86b4b0b574aa7160773b1e2025`

**Sample routes**:

- `/docs/claude-skills/l-update-generator`

---

### 18. `content-loss` — Content loss (pattern: c2187dbd7f6b038e…) — 1 route(s)

**Signature**: `c2187dbd7f6b038e8e3c6ba52f3c6770b44e058e40822f57f850abb93175e261`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-design-system`

---

### 19. `content-loss` — Content loss (pattern: 851aca29c7fad421…) — 1 route(s)

**Signature**: `851aca29c7fad421fadf1171a8d12e0bffbd59b37fb5490dd083c2e5a405e9a4`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-navigation-design`

---

### 20. `content-loss` — Content loss (pattern: ea02201ac9dca0de…) — 1 route(s)

**Signature**: `ea02201ac9dca0def989b6e4d88f12f5a51018ca88c9f3a7e4ea96ca4c2e712f`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-translate`

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

### 2. [migration-check] asset-loss: Asset removed or path changed (pattern: 7727fbba06dae061…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 7727fbba06dae061…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `7727fbba06dae061017c1ec05d669bf430baa3872c3515ea476d0616e67154dc`
**Description**: Asset removed or path changed (pattern: 7727fbba06dae061…)

**Sample routes**: `/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `7727fbba06dae061017c1ec05d669bf430baa3872c3515ea476d0616e67154dc`
**Description**: Asset removed or path changed (pattern: 7727fbba06dae061…)

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

### 4. [migration-check] asset-loss: Asset removed or path changed (pattern: e85446905b8df230…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: e85446905b8df230…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `e85446905b8df230998058d329c99c51f8f9e6543fe96fc16f5a0177dcd7c9ea`
**Description**: Asset removed or path changed (pattern: e85446905b8df230…)

**Sample routes**: `/ja/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `e85446905b8df230998058d329c99c51f8f9e6543fe96fc16f5a0177dcd7c9ea`
**Description**: Asset removed or path changed (pattern: e85446905b8df230…)

**Sample routes**: `/ja/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._

---

### 5. [migration-check] content-loss: Content loss (pattern: e8c412fca3916fba…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: e8c412fca3916fba…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `e8c412fca3916fba8e3dd4eb1bdae111f1501bcf50a6f1236e506621bb7c4e06`
**Description**: Content loss (pattern: e8c412fca3916fba…)

**Sample routes**: `/docs/claude-agents/doc-reviewer`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `e8c412fca3916fba8e3dd4eb1bdae111f1501bcf50a6f1236e506621bb7c4e06`
**Description**: Content loss (pattern: e8c412fca3916fba…)

**Sample routes**: `/docs/claude-agents/doc-reviewer`

_Generated by migration-check harness. Review the full report before filing._

---

### 6. [migration-check] content-loss: Content loss (pattern: 2dd63aff363c152a…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 2dd63aff363c152a…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `2dd63aff363c152a708a803f8ecee905e9a5b6fdc40e1c01077973fbf48795aa`
**Description**: Content loss (pattern: 2dd63aff363c152a…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `2dd63aff363c152a708a803f8ecee905e9a5b6fdc40e1c01077973fbf48795aa`
**Description**: Content loss (pattern: 2dd63aff363c152a…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._

---

### 7. [migration-check] content-loss: Content loss (pattern: e426748a1959ceff…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: e426748a1959ceff…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `e426748a1959ceffa057eefa45730e372bf6ae857fbb15e5461549f3ef98a732`
**Description**: Content loss (pattern: e426748a1959ceff…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `e426748a1959ceffa057eefa45730e372bf6ae857fbb15e5461549f3ef98a732`
**Description**: Content loss (pattern: e426748a1959ceff…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._

---

### 8. [migration-check] content-loss: Content loss (pattern: 40542d31c51e270d…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 40542d31c51e270d…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `40542d31c51e270d83b3b6e263b03afa9d7847be445f5c1be5422e6b480967ab`
**Description**: Content loss (pattern: 40542d31c51e270d…)

**Sample routes**: `/docs/claude-md/packages--doc-history-server`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `40542d31c51e270d83b3b6e263b03afa9d7847be445f5c1be5422e6b480967ab`
**Description**: Content loss (pattern: 40542d31c51e270d…)

**Sample routes**: `/docs/claude-md/packages--doc-history-server`

_Generated by migration-check harness. Review the full report before filing._

---

### 9. [migration-check] content-loss: Content loss (pattern: 67f13ed65bb07819…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 67f13ed65bb07819…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `67f13ed65bb07819a16b926d7e1e769cbd948274e1479854c9229006194ed17c`
**Description**: Content loss (pattern: 67f13ed65bb07819…)

**Sample routes**: `/docs/claude-md/packages--search-worker`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `67f13ed65bb07819a16b926d7e1e769cbd948274e1479854c9229006194ed17c`
**Description**: Content loss (pattern: 67f13ed65bb07819…)

**Sample routes**: `/docs/claude-md/packages--search-worker`

_Generated by migration-check harness. Review the full report before filing._

---

### 10. [migration-check] content-loss: Content loss (pattern: f600d1afa13cd95e…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: f600d1afa13cd95e…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `f600d1afa13cd95e2c19ab534416ef84d8cc57635655d12c6de02e52937e51ab`
**Description**: Content loss (pattern: f600d1afa13cd95e…)

**Sample routes**: `/docs/claude-md/root`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `f600d1afa13cd95e2c19ab534416ef84d8cc57635655d12c6de02e52937e51ab`
**Description**: Content loss (pattern: f600d1afa13cd95e…)

**Sample routes**: `/docs/claude-md/root`

_Generated by migration-check harness. Review the full report before filing._

---

### 11. [migration-check] content-loss: Content loss (pattern: 409ff870e67d2b59…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 409ff870e67d2b59…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `409ff870e67d2b596b0392caf7cd8ed6078802b84fe4f1fea073c642ef7f8df2`
**Description**: Content loss (pattern: 409ff870e67d2b59…)

**Sample routes**: `/docs/claude-md/src--config`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `409ff870e67d2b596b0392caf7cd8ed6078802b84fe4f1fea073c642ef7f8df2`
**Description**: Content loss (pattern: 409ff870e67d2b59…)

**Sample routes**: `/docs/claude-md/src--config`

_Generated by migration-check harness. Review the full report before filing._

---

### 12. [migration-check] content-loss: Content loss (pattern: e26433c2e9b4b34e…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: e26433c2e9b4b34e…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `e26433c2e9b4b34e3aee437225977601a2feb357d58e20f99e3372c3ee6d59b7`
**Description**: Content loss (pattern: e26433c2e9b4b34e…)

**Sample routes**: `/docs/claude-md/src`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `e26433c2e9b4b34e3aee437225977601a2feb357d58e20f99e3372c3ee6d59b7`
**Description**: Content loss (pattern: e26433c2e9b4b34e…)

**Sample routes**: `/docs/claude-md/src`

_Generated by migration-check harness. Review the full report before filing._

---

### 13. [migration-check] content-loss: Content loss (pattern: 325c0730c0134dea…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 325c0730c0134dea…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `325c0730c0134deafb541cdb37628c3796b1d152c5c13732fb982ded4dd99206`
**Description**: Content loss (pattern: 325c0730c0134dea…)

**Sample routes**: `/docs/claude-md/vendor--design-token-lint`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `325c0730c0134deafb541cdb37628c3796b1d152c5c13732fb982ded4dd99206`
**Description**: Content loss (pattern: 325c0730c0134dea…)

**Sample routes**: `/docs/claude-md/vendor--design-token-lint`

_Generated by migration-check harness. Review the full report before filing._

---

### 14. [migration-check] content-loss: Content loss (pattern: f05c17633348b855…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: f05c17633348b855…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `f05c17633348b855f1469b30b804570d345d7d52796e761d4e7726c9c0543d9c`
**Description**: Content loss (pattern: f05c17633348b855…)

**Sample routes**: `/docs/claude-skills/check-docs`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `f05c17633348b855f1469b30b804570d345d7d52796e761d4e7726c9c0543d9c`
**Description**: Content loss (pattern: f05c17633348b855…)

**Sample routes**: `/docs/claude-skills/check-docs`

_Generated by migration-check harness. Review the full report before filing._

---

### 15. [migration-check] content-loss: Content loss (pattern: c6920c0f3ec7dc46…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: c6920c0f3ec7dc46…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `c6920c0f3ec7dc46b5472612cd62cc22680a6df5e2c2dfe2c4fd94428d262ac1`
**Description**: Content loss (pattern: c6920c0f3ec7dc46…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `c6920c0f3ec7dc46b5472612cd62cc22680a6df5e2c2dfe2c4fd94428d262ac1`
**Description**: Content loss (pattern: c6920c0f3ec7dc46…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._

---

### 16. [migration-check] content-loss: Content loss (pattern: adb88874553036e0…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: adb88874553036e0…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `adb88874553036e0b0e04280ff7cfa3738cf478c3fb888906b25c9b88ffe1d26`
**Description**: Content loss (pattern: adb88874553036e0…)

**Sample routes**: `/docs/claude-skills/l-run-generator-cli-whole-test`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `adb88874553036e0b0e04280ff7cfa3738cf478c3fb888906b25c9b88ffe1d26`
**Description**: Content loss (pattern: adb88874553036e0…)

**Sample routes**: `/docs/claude-skills/l-run-generator-cli-whole-test`

_Generated by migration-check harness. Review the full report before filing._

---

### 17. [migration-check] content-loss: Content loss (pattern: 9939305928c168b6…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 9939305928c168b6…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `9939305928c168b6e050c2e57256981cfffadb86b4b0b574aa7160773b1e2025`
**Description**: Content loss (pattern: 9939305928c168b6…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `9939305928c168b6e050c2e57256981cfffadb86b4b0b574aa7160773b1e2025`
**Description**: Content loss (pattern: 9939305928c168b6…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._

---

### 18. [migration-check] content-loss: Content loss (pattern: c2187dbd7f6b038e…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: c2187dbd7f6b038e…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `c2187dbd7f6b038e8e3c6ba52f3c6770b44e058e40822f57f850abb93175e261`
**Description**: Content loss (pattern: c2187dbd7f6b038e…)

**Sample routes**: `/docs/claude-skills/zudo-doc-design-system`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `c2187dbd7f6b038e8e3c6ba52f3c6770b44e058e40822f57f850abb93175e261`
**Description**: Content loss (pattern: c2187dbd7f6b038e…)

**Sample routes**: `/docs/claude-skills/zudo-doc-design-system`

_Generated by migration-check harness. Review the full report before filing._

---

### 19. [migration-check] content-loss: Content loss (pattern: 851aca29c7fad421…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 851aca29c7fad421…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `851aca29c7fad421fadf1171a8d12e0bffbd59b37fb5490dd083c2e5a405e9a4`
**Description**: Content loss (pattern: 851aca29c7fad421…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `851aca29c7fad421fadf1171a8d12e0bffbd59b37fb5490dd083c2e5a405e9a4`
**Description**: Content loss (pattern: 851aca29c7fad421…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._

---

### 20. [migration-check] content-loss: Content loss (pattern: ea02201ac9dca0de…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: ea02201ac9dca0de…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `ea02201ac9dca0def989b6e4d88f12f5a51018ca88c9f3a7e4ea96ca4c2e712f`
**Description**: Content loss (pattern: ea02201ac9dca0de…)

**Sample routes**: `/docs/claude-skills/zudo-doc-translate`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `ea02201ac9dca0def989b6e4d88f12f5a51018ca88c9f3a7e4ea96ca4c2e712f`
**Description**: Content loss (pattern: ea02201ac9dca0de…)

**Sample routes**: `/docs/claude-skills/zudo-doc-translate`

_Generated by migration-check harness. Review the full report before filing._

---
