# Migration Check Report

**Generated**: 2026-04-29T20:35:02.329Z
**Findings files**: 5 batch file(s), 234 route(s) total

---

## Summary

| Category | Routes |
| --- | --- |
| content-loss | 121 |
| asset-loss | 17 |
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

### 1. `asset-loss` — Asset removed or path changed (pattern: 81722c326440f6fc…) — 1 route(s)

**Signature**: `81722c326440f6fc1c4ea6696990884a84288ba15a13641f5e60a599e8e0694c`

**Sample routes**:

- `/`

---

### 2. `asset-loss` — Asset removed or path changed (pattern: afaf06672cc54c89…) — 1 route(s)

**Signature**: `afaf06672cc54c89e48beeeaf119604bb7a0dcddd472666a47760cc530241f31`

**Sample routes**:

- `/docs/claude-skills/l-generator-cli-tester`

---

### 3. `asset-loss` — Asset removed or path changed (pattern: 19af6ece20df3fd3…) — 1 route(s)

**Signature**: `19af6ece20df3fd3417c9f4593df6a90726a46d5195ac52772d73d7b7866d58b`

**Sample routes**:

- `/docs/claude-skills/l-update-generator`

---

### 4. `asset-loss` — Asset removed or path changed (pattern: ef48e43b0f847b3b…) — 1 route(s)

**Signature**: `ef48e43b0f847b3b2a22194c786b5e0564c79df0118b7e89a7468cbdd44a5755`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-navigation-design`

---

### 5. `asset-loss` — Asset removed or path changed (pattern: 9910c8d17cc32858…) — 1 route(s)

**Signature**: `9910c8d17cc32858a7f3838ee348afb38fb8975727efe7387a2b0f4c656664f0`

**Sample routes**:

- `/docs/components/html-preview`

---

### 6. `asset-loss` — Asset removed or path changed (pattern: 7de7ec5efb3b5eb5…) — 1 route(s)

**Signature**: `7de7ec5efb3b5eb56760f80d46179b8ebac4c691e99b95e5edaf54790e8e9e62`

**Sample routes**:

- `/docs/develop/generator-cli-testing`

---

### 7. `asset-loss` — Asset removed or path changed (pattern: 74934dc4764f6969…) — 1 route(s)

**Signature**: `74934dc4764f696964730c022c1822c52a912df84a562eb4ed410e8ea164c713`

**Sample routes**:

- `/docs/guides/configuration`

---

### 8. `asset-loss` — Asset removed or path changed (pattern: 149f501e32c0bd22…) — 1 route(s)

**Signature**: `149f501e32c0bd2252b3333bcbc9b4a61e5324d6891197d295ddcd1bf5e1070a`

**Sample routes**:

- `/docs/reference/create-zudo-doc`

---

### 9. `asset-loss` — Asset removed or path changed (pattern: 173068bd798d4ef5…) — 1 route(s)

**Signature**: `173068bd798d4ef5a1b3be9ab8b105e1dc6fef0602a2c13de66469349bc6a55e`

**Sample routes**:

- `/docs/reference/search-worker`

---

### 10. `asset-loss` — Asset removed or path changed (pattern: b06772f21bd17a42…) — 1 route(s)

**Signature**: `b06772f21bd17a42abc2cf7cd3f703b827543abec00b525566271b5d92f069f4`

**Sample routes**:

- `/ja`

---

### 11. `asset-loss` — Asset removed or path changed (pattern: ce35bf2830316d9a…) — 1 route(s)

**Signature**: `ce35bf2830316d9a20248abd1a08a96be39872b5fd5e9da3beb0c8a3783a7a95`

**Sample routes**:

- `/ja/docs/components/html-preview`

---

### 12. `asset-loss` — Asset removed or path changed (pattern: b2db663d01712328…) — 1 route(s)

**Signature**: `b2db663d01712328ad6451f1c04d4ad0cb5503ef73acf160cdb6201b8fd83943`

**Sample routes**:

- `/ja/docs/develop/generator-cli-testing`

---

### 13. `asset-loss` — Asset removed or path changed (pattern: eafc53041550d183…) — 1 route(s)

**Signature**: `eafc53041550d1834b14bf06bf2144356a547e7babde734bfb6c85217c3ed449`

**Sample routes**:

- `/ja/docs/guides/configuration`

---

### 14. `asset-loss` — Asset removed or path changed (pattern: 35eee9323fbad25e…) — 1 route(s)

**Signature**: `35eee9323fbad25ee4168f5351c45fc2f25822ef6c58569cd145da24daf83c14`

**Sample routes**:

- `/ja/docs/guides/layout-demos/hide-both`

---

### 15. `asset-loss` — Asset removed or path changed (pattern: cdca5e3728e74121…) — 1 route(s)

**Signature**: `cdca5e3728e74121e98b20a2e1ae9360966de64b24980db1ff8e0aa1f1ce8c1c`

**Sample routes**:

- `/ja/docs/guides/layout-demos/hide-sidebar`

---

### 16. `asset-loss` — Asset removed or path changed (pattern: 9ea491de84533234…) — 1 route(s)

**Signature**: `9ea491de84533234575c7f668c032d7a2b0e2786649e54c34c185c4f75b39e0c`

**Sample routes**:

- `/ja/docs/reference/create-zudo-doc`

---

### 17. `asset-loss` — Asset removed or path changed (pattern: 2d9d861bbaeeeff6…) — 1 route(s)

**Signature**: `2d9d861bbaeeeff67b039481e66e99377d948bcd2f154779773b9ac2cb0d277c`

**Sample routes**:

- `/ja/docs/reference/search-worker`

---

### 18. `content-loss` — Content loss (pattern: 3fb37d9af6509d57…) — 1 route(s)

**Signature**: `3fb37d9af6509d5785c595d0e2be56a9df96027544a3aec4cf3f519482b1c0e8`

**Sample routes**:

- `/docs/claude-agents/doc-reviewer`

---

### 19. `content-loss` — Content loss (pattern: ecd2235cc61f0567…) — 1 route(s)

**Signature**: `ecd2235cc61f0567dddc469343900caf3186b8c1dabdfd4e6983acaf1009552d`

**Sample routes**:

- `/docs/claude-md/e2e`

---

### 20. `content-loss` — Content loss (pattern: 7665379b52a04556…) — 1 route(s)

**Signature**: `7665379b52a045568250536a872b3df1f594c557bc9bd6259b310b661acd47b3`

**Sample routes**:

- `/docs/claude-md/packages--create-zudo-doc`

---

---

## Suggested Issues

One entry per non-cosmetic cluster. Copy the `gh issue create` command to file a tracking issue.

### 1. [migration-check] asset-loss: Asset removed or path changed (pattern: 81722c326440f6fc…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 81722c326440f6fc…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `81722c326440f6fc1c4ea6696990884a84288ba15a13641f5e60a599e8e0694c`
**Description**: Asset removed or path changed (pattern: 81722c326440f6fc…)

**Sample routes**: `/`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `81722c326440f6fc1c4ea6696990884a84288ba15a13641f5e60a599e8e0694c`
**Description**: Asset removed or path changed (pattern: 81722c326440f6fc…)

**Sample routes**: `/`

_Generated by migration-check harness. Review the full report before filing._

---

### 2. [migration-check] asset-loss: Asset removed or path changed (pattern: afaf06672cc54c89…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: afaf06672cc54c89…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `afaf06672cc54c89e48beeeaf119604bb7a0dcddd472666a47760cc530241f31`
**Description**: Asset removed or path changed (pattern: afaf06672cc54c89…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `afaf06672cc54c89e48beeeaf119604bb7a0dcddd472666a47760cc530241f31`
**Description**: Asset removed or path changed (pattern: afaf06672cc54c89…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._

---

### 3. [migration-check] asset-loss: Asset removed or path changed (pattern: 19af6ece20df3fd3…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 19af6ece20df3fd3…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `19af6ece20df3fd3417c9f4593df6a90726a46d5195ac52772d73d7b7866d58b`
**Description**: Asset removed or path changed (pattern: 19af6ece20df3fd3…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `19af6ece20df3fd3417c9f4593df6a90726a46d5195ac52772d73d7b7866d58b`
**Description**: Asset removed or path changed (pattern: 19af6ece20df3fd3…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._

---

### 4. [migration-check] asset-loss: Asset removed or path changed (pattern: ef48e43b0f847b3b…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: ef48e43b0f847b3b…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `ef48e43b0f847b3b2a22194c786b5e0564c79df0118b7e89a7468cbdd44a5755`
**Description**: Asset removed or path changed (pattern: ef48e43b0f847b3b…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `ef48e43b0f847b3b2a22194c786b5e0564c79df0118b7e89a7468cbdd44a5755`
**Description**: Asset removed or path changed (pattern: ef48e43b0f847b3b…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._

---

### 5. [migration-check] asset-loss: Asset removed or path changed (pattern: 9910c8d17cc32858…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 9910c8d17cc32858…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9910c8d17cc32858a7f3838ee348afb38fb8975727efe7387a2b0f4c656664f0`
**Description**: Asset removed or path changed (pattern: 9910c8d17cc32858…)

**Sample routes**: `/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9910c8d17cc32858a7f3838ee348afb38fb8975727efe7387a2b0f4c656664f0`
**Description**: Asset removed or path changed (pattern: 9910c8d17cc32858…)

**Sample routes**: `/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._

---

### 6. [migration-check] asset-loss: Asset removed or path changed (pattern: 7de7ec5efb3b5eb5…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 7de7ec5efb3b5eb5…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `7de7ec5efb3b5eb56760f80d46179b8ebac4c691e99b95e5edaf54790e8e9e62`
**Description**: Asset removed or path changed (pattern: 7de7ec5efb3b5eb5…)

**Sample routes**: `/docs/develop/generator-cli-testing`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `7de7ec5efb3b5eb56760f80d46179b8ebac4c691e99b95e5edaf54790e8e9e62`
**Description**: Asset removed or path changed (pattern: 7de7ec5efb3b5eb5…)

**Sample routes**: `/docs/develop/generator-cli-testing`

_Generated by migration-check harness. Review the full report before filing._

---

### 7. [migration-check] asset-loss: Asset removed or path changed (pattern: 74934dc4764f6969…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 74934dc4764f6969…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `74934dc4764f696964730c022c1822c52a912df84a562eb4ed410e8ea164c713`
**Description**: Asset removed or path changed (pattern: 74934dc4764f6969…)

**Sample routes**: `/docs/guides/configuration`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `74934dc4764f696964730c022c1822c52a912df84a562eb4ed410e8ea164c713`
**Description**: Asset removed or path changed (pattern: 74934dc4764f6969…)

**Sample routes**: `/docs/guides/configuration`

_Generated by migration-check harness. Review the full report before filing._

---

### 8. [migration-check] asset-loss: Asset removed or path changed (pattern: 149f501e32c0bd22…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 149f501e32c0bd22…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `149f501e32c0bd2252b3333bcbc9b4a61e5324d6891197d295ddcd1bf5e1070a`
**Description**: Asset removed or path changed (pattern: 149f501e32c0bd22…)

**Sample routes**: `/docs/reference/create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `149f501e32c0bd2252b3333bcbc9b4a61e5324d6891197d295ddcd1bf5e1070a`
**Description**: Asset removed or path changed (pattern: 149f501e32c0bd22…)

**Sample routes**: `/docs/reference/create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._

---

### 9. [migration-check] asset-loss: Asset removed or path changed (pattern: 173068bd798d4ef5…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 173068bd798d4ef5…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `173068bd798d4ef5a1b3be9ab8b105e1dc6fef0602a2c13de66469349bc6a55e`
**Description**: Asset removed or path changed (pattern: 173068bd798d4ef5…)

**Sample routes**: `/docs/reference/search-worker`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `173068bd798d4ef5a1b3be9ab8b105e1dc6fef0602a2c13de66469349bc6a55e`
**Description**: Asset removed or path changed (pattern: 173068bd798d4ef5…)

**Sample routes**: `/docs/reference/search-worker`

_Generated by migration-check harness. Review the full report before filing._

---

### 10. [migration-check] asset-loss: Asset removed or path changed (pattern: b06772f21bd17a42…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: b06772f21bd17a42…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `b06772f21bd17a42abc2cf7cd3f703b827543abec00b525566271b5d92f069f4`
**Description**: Asset removed or path changed (pattern: b06772f21bd17a42…)

**Sample routes**: `/ja`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `b06772f21bd17a42abc2cf7cd3f703b827543abec00b525566271b5d92f069f4`
**Description**: Asset removed or path changed (pattern: b06772f21bd17a42…)

**Sample routes**: `/ja`

_Generated by migration-check harness. Review the full report before filing._

---

### 11. [migration-check] asset-loss: Asset removed or path changed (pattern: ce35bf2830316d9a…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: ce35bf2830316d9a…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `ce35bf2830316d9a20248abd1a08a96be39872b5fd5e9da3beb0c8a3783a7a95`
**Description**: Asset removed or path changed (pattern: ce35bf2830316d9a…)

**Sample routes**: `/ja/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `ce35bf2830316d9a20248abd1a08a96be39872b5fd5e9da3beb0c8a3783a7a95`
**Description**: Asset removed or path changed (pattern: ce35bf2830316d9a…)

**Sample routes**: `/ja/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._

---

### 12. [migration-check] asset-loss: Asset removed or path changed (pattern: b2db663d01712328…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: b2db663d01712328…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `b2db663d01712328ad6451f1c04d4ad0cb5503ef73acf160cdb6201b8fd83943`
**Description**: Asset removed or path changed (pattern: b2db663d01712328…)

**Sample routes**: `/ja/docs/develop/generator-cli-testing`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `b2db663d01712328ad6451f1c04d4ad0cb5503ef73acf160cdb6201b8fd83943`
**Description**: Asset removed or path changed (pattern: b2db663d01712328…)

**Sample routes**: `/ja/docs/develop/generator-cli-testing`

_Generated by migration-check harness. Review the full report before filing._

---

### 13. [migration-check] asset-loss: Asset removed or path changed (pattern: eafc53041550d183…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: eafc53041550d183…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `eafc53041550d1834b14bf06bf2144356a547e7babde734bfb6c85217c3ed449`
**Description**: Asset removed or path changed (pattern: eafc53041550d183…)

**Sample routes**: `/ja/docs/guides/configuration`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `eafc53041550d1834b14bf06bf2144356a547e7babde734bfb6c85217c3ed449`
**Description**: Asset removed or path changed (pattern: eafc53041550d183…)

**Sample routes**: `/ja/docs/guides/configuration`

_Generated by migration-check harness. Review the full report before filing._

---

### 14. [migration-check] asset-loss: Asset removed or path changed (pattern: 35eee9323fbad25e…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 35eee9323fbad25e…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `35eee9323fbad25ee4168f5351c45fc2f25822ef6c58569cd145da24daf83c14`
**Description**: Asset removed or path changed (pattern: 35eee9323fbad25e…)

**Sample routes**: `/ja/docs/guides/layout-demos/hide-both`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `35eee9323fbad25ee4168f5351c45fc2f25822ef6c58569cd145da24daf83c14`
**Description**: Asset removed or path changed (pattern: 35eee9323fbad25e…)

**Sample routes**: `/ja/docs/guides/layout-demos/hide-both`

_Generated by migration-check harness. Review the full report before filing._

---

### 15. [migration-check] asset-loss: Asset removed or path changed (pattern: cdca5e3728e74121…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: cdca5e3728e74121…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `cdca5e3728e74121e98b20a2e1ae9360966de64b24980db1ff8e0aa1f1ce8c1c`
**Description**: Asset removed or path changed (pattern: cdca5e3728e74121…)

**Sample routes**: `/ja/docs/guides/layout-demos/hide-sidebar`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `cdca5e3728e74121e98b20a2e1ae9360966de64b24980db1ff8e0aa1f1ce8c1c`
**Description**: Asset removed or path changed (pattern: cdca5e3728e74121…)

**Sample routes**: `/ja/docs/guides/layout-demos/hide-sidebar`

_Generated by migration-check harness. Review the full report before filing._

---

### 16. [migration-check] asset-loss: Asset removed or path changed (pattern: 9ea491de84533234…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 9ea491de84533234…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9ea491de84533234575c7f668c032d7a2b0e2786649e54c34c185c4f75b39e0c`
**Description**: Asset removed or path changed (pattern: 9ea491de84533234…)

**Sample routes**: `/ja/docs/reference/create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9ea491de84533234575c7f668c032d7a2b0e2786649e54c34c185c4f75b39e0c`
**Description**: Asset removed or path changed (pattern: 9ea491de84533234…)

**Sample routes**: `/ja/docs/reference/create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._

---

### 17. [migration-check] asset-loss: Asset removed or path changed (pattern: 2d9d861bbaeeeff6…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 2d9d861bbaeeeff6…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `2d9d861bbaeeeff67b039481e66e99377d948bcd2f154779773b9ac2cb0d277c`
**Description**: Asset removed or path changed (pattern: 2d9d861bbaeeeff6…)

**Sample routes**: `/ja/docs/reference/search-worker`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `2d9d861bbaeeeff67b039481e66e99377d948bcd2f154779773b9ac2cb0d277c`
**Description**: Asset removed or path changed (pattern: 2d9d861bbaeeeff6…)

**Sample routes**: `/ja/docs/reference/search-worker`

_Generated by migration-check harness. Review the full report before filing._

---

### 18. [migration-check] content-loss: Content loss (pattern: 3fb37d9af6509d57…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 3fb37d9af6509d57…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `3fb37d9af6509d5785c595d0e2be56a9df96027544a3aec4cf3f519482b1c0e8`
**Description**: Content loss (pattern: 3fb37d9af6509d57…)

**Sample routes**: `/docs/claude-agents/doc-reviewer`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `3fb37d9af6509d5785c595d0e2be56a9df96027544a3aec4cf3f519482b1c0e8`
**Description**: Content loss (pattern: 3fb37d9af6509d57…)

**Sample routes**: `/docs/claude-agents/doc-reviewer`

_Generated by migration-check harness. Review the full report before filing._

---

### 19. [migration-check] content-loss: Content loss (pattern: ecd2235cc61f0567…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: ecd2235cc61f0567…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `ecd2235cc61f0567dddc469343900caf3186b8c1dabdfd4e6983acaf1009552d`
**Description**: Content loss (pattern: ecd2235cc61f0567…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `ecd2235cc61f0567dddc469343900caf3186b8c1dabdfd4e6983acaf1009552d`
**Description**: Content loss (pattern: ecd2235cc61f0567…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._

---

### 20. [migration-check] content-loss: Content loss (pattern: 7665379b52a04556…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] content-loss: Content loss (pattern: 7665379b52a04556…) (1 route(s))" --body $'**Category**: content-loss
**Routes affected**: 1
**Signature**: `7665379b52a045568250536a872b3df1f594c557bc9bd6259b310b661acd47b3`
**Description**: Content loss (pattern: 7665379b52a04556…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: content-loss
**Routes affected**: 1
**Signature**: `7665379b52a045568250536a872b3df1f594c557bc9bd6259b310b661acd47b3`
**Description**: Content loss (pattern: 7665379b52a04556…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._

---
