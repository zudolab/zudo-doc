# Migration Check Report

**Generated**: 2026-04-30T06:12:35.158Z
**Findings files**: 7 batch file(s), 219 route(s) total

---

## Summary

| Category | Routes |
| --- | --- |
| content-loss | 100 |
| asset-loss | 100 |
| route-only-in-a | 6 |
| route-only-in-b | 13 |
| **Total** | **219** |

---

## Symmetric-Difference Routes

Routes present in one site but not the other (likely added or removed pages).

### Routes only in A (removed in B) — 6 route(s)

- `/docs/changelog/010`
- `/docs/claude-md/packages--ai-chat-worker`
- `/docs/reference/ai-chat-worker`
- `/ja/docs/changelog/010`
- `/ja/docs/claude-md/packages--ai-chat-worker`
- `/ja/docs/reference/ai-chat-worker`

### Routes only in B (added in B) — 13 route(s)

- `/docs/changelog/0.1.0`
- `/docs/claude-agents`
- `/docs/claude-md`
- `/docs/claude-skills`
- `/docs/claude-skills/l-zfb-migration-check`
- `/docs/concepts`
- `/docs/concepts/routing-conventions`
- `/docs/concepts/trailing-slash-policy`
- `/ja/docs/changelog/0.1.0`
- `/ja/docs/claude-skills/l-zfb-migration-check`
- `/ja/docs/concepts`
- `/ja/docs/concepts/routing-conventions`
- `/ja/docs/concepts/trailing-slash-policy`

---

## Non-HTML Artifact Diffs

**Stats**: 4 artifact(s) — 0 identical, 4 changed, 0 only-in-A, 0 only-in-B

- **`llms-full.txt`** (text) — 154 line(s) removed, 306 line(s) added
- **`llms.txt`** (text) — 2 line(s) removed, 3 line(s) added
- **`search-index.json`** (JSON) — entry count delta: +3
- **`sitemap.xml`** (text) — 7 line(s) removed, 14 line(s) added

---

## Top Clusters (top 20 by route count)

Routes with identical diff signatures are grouped together.
Cluster sample size is capped at 5 representative routes.

### 1. `asset-loss` — Asset removed or path changed (pattern: 8560b36d8119326d…) — 1 route(s)

**Signature**: `8560b36d8119326d283fc4b96e17e389f8b284015db7222abc06fd890f084aee`

**Sample routes**:

- `/`

---

### 2. `asset-loss` — Asset removed or path changed (pattern: f0f97bd7a5703b20…) — 1 route(s)

**Signature**: `f0f97bd7a5703b206b28d74b7670bd74510deba5004616920ead865fcc2a2efc`

**Sample routes**:

- `/docs/claude-md/e2e`

---

### 3. `asset-loss` — Asset removed or path changed (pattern: 98571444425af6e6…) — 1 route(s)

**Signature**: `98571444425af6e6b2f7c285e6ae54770c4c41163c02bd0f3684a9078a7f4b69`

**Sample routes**:

- `/docs/claude-md/packages--create-zudo-doc`

---

### 4. `asset-loss` — Asset removed or path changed (pattern: 0c9de3089f053286…) — 1 route(s)

**Signature**: `0c9de3089f0532862fd92b51f6bde1174a819b4d1fdadc70b695795c92ac0c15`

**Sample routes**:

- `/docs/claude-md/packages--doc-history-server`

---

### 5. `asset-loss` — Asset removed or path changed (pattern: 9eb2d03e181bf24d…) — 1 route(s)

**Signature**: `9eb2d03e181bf24dc0b8e1215e5421d0c47062ef07c6536a6b49cdcb07ac8a68`

**Sample routes**:

- `/docs/claude-md/packages--search-worker`

---

### 6. `asset-loss` — Asset removed or path changed (pattern: 9b495c4a2504eef0…) — 1 route(s)

**Signature**: `9b495c4a2504eef07d1866984f19493f71493a76e6f6453eef6e95680726cb54`

**Sample routes**:

- `/docs/claude-md/src--config`

---

### 7. `asset-loss` — Asset removed or path changed (pattern: b816529bfa7a2abd…) — 1 route(s)

**Signature**: `b816529bfa7a2abd35f151f248a0fc0abd0a69f4a5cf9f255eaa0e3849d3790e`

**Sample routes**:

- `/docs/claude-md/src`

---

### 8. `asset-loss` — Asset removed or path changed (pattern: 1bed81b852aeadbc…) — 1 route(s)

**Signature**: `1bed81b852aeadbc5ac8e99acd4996ed7fc21a861458eafc169d0151d633aac6`

**Sample routes**:

- `/docs/claude-md/vendor--design-token-lint`

---

### 9. `asset-loss` — Asset removed or path changed (pattern: 177fb80ca538543c…) — 1 route(s)

**Signature**: `177fb80ca538543c87e430f3ba3b2a25e2cbb25b47d8d21d397836b3e1b95ffe`

**Sample routes**:

- `/docs/claude-skills/check-docs`

---

### 10. `asset-loss` — Asset removed or path changed (pattern: 704fe3d77a1f128c…) — 1 route(s)

**Signature**: `704fe3d77a1f128c668427b04b90d67b0983e2396ed1a667043f253fd557b633`

**Sample routes**:

- `/docs/claude-skills/l-generator-cli-tester`

---

### 11. `asset-loss` — Asset removed or path changed (pattern: df295af572be9d80…) — 1 route(s)

**Signature**: `df295af572be9d806ac7b082224b9835d92b5070c502e21410e49a5d2116fad8`

**Sample routes**:

- `/docs/claude-skills/l-run-generator-cli-whole-test`

---

### 12. `asset-loss` — Asset removed or path changed (pattern: 3bbfbf95a9b26c9b…) — 1 route(s)

**Signature**: `3bbfbf95a9b26c9b9510ebe3721aa76eae24a5d84e7f5bce1826e4d7c7d70e0e`

**Sample routes**:

- `/docs/claude-skills/l-update-generator`

---

### 13. `asset-loss` — Asset removed or path changed (pattern: 40b0069b42febb23…) — 1 route(s)

**Signature**: `40b0069b42febb23d8f07282719fdce25f52d3b973917f49c4eaf258070adf84`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-navigation-design`

---

### 14. `asset-loss` — Asset removed or path changed (pattern: e6494e1bffdb632c…) — 1 route(s)

**Signature**: `e6494e1bffdb632c661044e9782ecaf6225a57fd0ed7d4d31d8f74623686eff8`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-translate`

---

### 15. `asset-loss` — Asset removed or path changed (pattern: be8ec0687988cecf…) — 1 route(s)

**Signature**: `be8ec0687988cecf05859feb1f1e87cbf5c57039e4d070ef200a8cd885d479fe`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-version-bump`

---

### 16. `asset-loss` — Asset removed or path changed (pattern: 8a57c5d7c2e04fdd…) — 1 route(s)

**Signature**: `8a57c5d7c2e04fdd113b7a564328ac96a966d91994ce418f14807537e0bc1fb9`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-writing-rules`

---

### 17. `asset-loss` — Asset removed or path changed (pattern: d864ce10da7f12ca…) — 1 route(s)

**Signature**: `d864ce10da7f12ca9a102f55fb6c434912ac63ad61d41eaa60f5a4831facf6e8`

**Sample routes**:

- `/docs/components/admonitions`

---

### 18. `asset-loss` — Asset removed or path changed (pattern: 9468ade238a1e6ff…) — 1 route(s)

**Signature**: `9468ade238a1e6ffece10a87d59d476d48c8c305772eb325d38efc0f00b3bd82`

**Sample routes**:

- `/docs/components/basic-components`

---

### 19. `asset-loss` — Asset removed or path changed (pattern: 35c8a669d903a20e…) — 1 route(s)

**Signature**: `35c8a669d903a20ead19c296acefe4d3c2efcfa2dcc2b2a2837f759926ab414d`

**Sample routes**:

- `/docs/components/html-preview`

---

### 20. `asset-loss` — Asset removed or path changed (pattern: 57f9a1bac66138a0…) — 1 route(s)

**Signature**: `57f9a1bac66138a01066e7b1e96d319dbc9f41e13455ef6a3ecb118a7fada72a`

**Sample routes**:

- `/docs/components/image-enlarge`

---

---

## Suggested Issues

One entry per non-cosmetic cluster. Copy the `gh issue create` command to file a tracking issue.

### 1. [migration-check] asset-loss: Asset removed or path changed (pattern: 8560b36d8119326d…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 8560b36d8119326d…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `8560b36d8119326d283fc4b96e17e389f8b284015db7222abc06fd890f084aee`
**Description**: Asset removed or path changed (pattern: 8560b36d8119326d…)

**Sample routes**: `/`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `8560b36d8119326d283fc4b96e17e389f8b284015db7222abc06fd890f084aee`
**Description**: Asset removed or path changed (pattern: 8560b36d8119326d…)

**Sample routes**: `/`

_Generated by migration-check harness. Review the full report before filing._

---

### 2. [migration-check] asset-loss: Asset removed or path changed (pattern: f0f97bd7a5703b20…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: f0f97bd7a5703b20…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `f0f97bd7a5703b206b28d74b7670bd74510deba5004616920ead865fcc2a2efc`
**Description**: Asset removed or path changed (pattern: f0f97bd7a5703b20…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `f0f97bd7a5703b206b28d74b7670bd74510deba5004616920ead865fcc2a2efc`
**Description**: Asset removed or path changed (pattern: f0f97bd7a5703b20…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._

---

### 3. [migration-check] asset-loss: Asset removed or path changed (pattern: 98571444425af6e6…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 98571444425af6e6…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `98571444425af6e6b2f7c285e6ae54770c4c41163c02bd0f3684a9078a7f4b69`
**Description**: Asset removed or path changed (pattern: 98571444425af6e6…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `98571444425af6e6b2f7c285e6ae54770c4c41163c02bd0f3684a9078a7f4b69`
**Description**: Asset removed or path changed (pattern: 98571444425af6e6…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._

---

### 4. [migration-check] asset-loss: Asset removed or path changed (pattern: 0c9de3089f053286…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 0c9de3089f053286…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `0c9de3089f0532862fd92b51f6bde1174a819b4d1fdadc70b695795c92ac0c15`
**Description**: Asset removed or path changed (pattern: 0c9de3089f053286…)

**Sample routes**: `/docs/claude-md/packages--doc-history-server`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `0c9de3089f0532862fd92b51f6bde1174a819b4d1fdadc70b695795c92ac0c15`
**Description**: Asset removed or path changed (pattern: 0c9de3089f053286…)

**Sample routes**: `/docs/claude-md/packages--doc-history-server`

_Generated by migration-check harness. Review the full report before filing._

---

### 5. [migration-check] asset-loss: Asset removed or path changed (pattern: 9eb2d03e181bf24d…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 9eb2d03e181bf24d…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9eb2d03e181bf24dc0b8e1215e5421d0c47062ef07c6536a6b49cdcb07ac8a68`
**Description**: Asset removed or path changed (pattern: 9eb2d03e181bf24d…)

**Sample routes**: `/docs/claude-md/packages--search-worker`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9eb2d03e181bf24dc0b8e1215e5421d0c47062ef07c6536a6b49cdcb07ac8a68`
**Description**: Asset removed or path changed (pattern: 9eb2d03e181bf24d…)

**Sample routes**: `/docs/claude-md/packages--search-worker`

_Generated by migration-check harness. Review the full report before filing._

---

### 6. [migration-check] asset-loss: Asset removed or path changed (pattern: 9b495c4a2504eef0…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 9b495c4a2504eef0…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9b495c4a2504eef07d1866984f19493f71493a76e6f6453eef6e95680726cb54`
**Description**: Asset removed or path changed (pattern: 9b495c4a2504eef0…)

**Sample routes**: `/docs/claude-md/src--config`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9b495c4a2504eef07d1866984f19493f71493a76e6f6453eef6e95680726cb54`
**Description**: Asset removed or path changed (pattern: 9b495c4a2504eef0…)

**Sample routes**: `/docs/claude-md/src--config`

_Generated by migration-check harness. Review the full report before filing._

---

### 7. [migration-check] asset-loss: Asset removed or path changed (pattern: b816529bfa7a2abd…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: b816529bfa7a2abd…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `b816529bfa7a2abd35f151f248a0fc0abd0a69f4a5cf9f255eaa0e3849d3790e`
**Description**: Asset removed or path changed (pattern: b816529bfa7a2abd…)

**Sample routes**: `/docs/claude-md/src`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `b816529bfa7a2abd35f151f248a0fc0abd0a69f4a5cf9f255eaa0e3849d3790e`
**Description**: Asset removed or path changed (pattern: b816529bfa7a2abd…)

**Sample routes**: `/docs/claude-md/src`

_Generated by migration-check harness. Review the full report before filing._

---

### 8. [migration-check] asset-loss: Asset removed or path changed (pattern: 1bed81b852aeadbc…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 1bed81b852aeadbc…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `1bed81b852aeadbc5ac8e99acd4996ed7fc21a861458eafc169d0151d633aac6`
**Description**: Asset removed or path changed (pattern: 1bed81b852aeadbc…)

**Sample routes**: `/docs/claude-md/vendor--design-token-lint`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `1bed81b852aeadbc5ac8e99acd4996ed7fc21a861458eafc169d0151d633aac6`
**Description**: Asset removed or path changed (pattern: 1bed81b852aeadbc…)

**Sample routes**: `/docs/claude-md/vendor--design-token-lint`

_Generated by migration-check harness. Review the full report before filing._

---

### 9. [migration-check] asset-loss: Asset removed or path changed (pattern: 177fb80ca538543c…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 177fb80ca538543c…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `177fb80ca538543c87e430f3ba3b2a25e2cbb25b47d8d21d397836b3e1b95ffe`
**Description**: Asset removed or path changed (pattern: 177fb80ca538543c…)

**Sample routes**: `/docs/claude-skills/check-docs`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `177fb80ca538543c87e430f3ba3b2a25e2cbb25b47d8d21d397836b3e1b95ffe`
**Description**: Asset removed or path changed (pattern: 177fb80ca538543c…)

**Sample routes**: `/docs/claude-skills/check-docs`

_Generated by migration-check harness. Review the full report before filing._

---

### 10. [migration-check] asset-loss: Asset removed or path changed (pattern: 704fe3d77a1f128c…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 704fe3d77a1f128c…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `704fe3d77a1f128c668427b04b90d67b0983e2396ed1a667043f253fd557b633`
**Description**: Asset removed or path changed (pattern: 704fe3d77a1f128c…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `704fe3d77a1f128c668427b04b90d67b0983e2396ed1a667043f253fd557b633`
**Description**: Asset removed or path changed (pattern: 704fe3d77a1f128c…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._

---

### 11. [migration-check] asset-loss: Asset removed or path changed (pattern: df295af572be9d80…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: df295af572be9d80…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `df295af572be9d806ac7b082224b9835d92b5070c502e21410e49a5d2116fad8`
**Description**: Asset removed or path changed (pattern: df295af572be9d80…)

**Sample routes**: `/docs/claude-skills/l-run-generator-cli-whole-test`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `df295af572be9d806ac7b082224b9835d92b5070c502e21410e49a5d2116fad8`
**Description**: Asset removed or path changed (pattern: df295af572be9d80…)

**Sample routes**: `/docs/claude-skills/l-run-generator-cli-whole-test`

_Generated by migration-check harness. Review the full report before filing._

---

### 12. [migration-check] asset-loss: Asset removed or path changed (pattern: 3bbfbf95a9b26c9b…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 3bbfbf95a9b26c9b…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `3bbfbf95a9b26c9b9510ebe3721aa76eae24a5d84e7f5bce1826e4d7c7d70e0e`
**Description**: Asset removed or path changed (pattern: 3bbfbf95a9b26c9b…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `3bbfbf95a9b26c9b9510ebe3721aa76eae24a5d84e7f5bce1826e4d7c7d70e0e`
**Description**: Asset removed or path changed (pattern: 3bbfbf95a9b26c9b…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._

---

### 13. [migration-check] asset-loss: Asset removed or path changed (pattern: 40b0069b42febb23…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 40b0069b42febb23…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `40b0069b42febb23d8f07282719fdce25f52d3b973917f49c4eaf258070adf84`
**Description**: Asset removed or path changed (pattern: 40b0069b42febb23…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `40b0069b42febb23d8f07282719fdce25f52d3b973917f49c4eaf258070adf84`
**Description**: Asset removed or path changed (pattern: 40b0069b42febb23…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._

---

### 14. [migration-check] asset-loss: Asset removed or path changed (pattern: e6494e1bffdb632c…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: e6494e1bffdb632c…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `e6494e1bffdb632c661044e9782ecaf6225a57fd0ed7d4d31d8f74623686eff8`
**Description**: Asset removed or path changed (pattern: e6494e1bffdb632c…)

**Sample routes**: `/docs/claude-skills/zudo-doc-translate`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `e6494e1bffdb632c661044e9782ecaf6225a57fd0ed7d4d31d8f74623686eff8`
**Description**: Asset removed or path changed (pattern: e6494e1bffdb632c…)

**Sample routes**: `/docs/claude-skills/zudo-doc-translate`

_Generated by migration-check harness. Review the full report before filing._

---

### 15. [migration-check] asset-loss: Asset removed or path changed (pattern: be8ec0687988cecf…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: be8ec0687988cecf…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `be8ec0687988cecf05859feb1f1e87cbf5c57039e4d070ef200a8cd885d479fe`
**Description**: Asset removed or path changed (pattern: be8ec0687988cecf…)

**Sample routes**: `/docs/claude-skills/zudo-doc-version-bump`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `be8ec0687988cecf05859feb1f1e87cbf5c57039e4d070ef200a8cd885d479fe`
**Description**: Asset removed or path changed (pattern: be8ec0687988cecf…)

**Sample routes**: `/docs/claude-skills/zudo-doc-version-bump`

_Generated by migration-check harness. Review the full report before filing._

---

### 16. [migration-check] asset-loss: Asset removed or path changed (pattern: 8a57c5d7c2e04fdd…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 8a57c5d7c2e04fdd…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `8a57c5d7c2e04fdd113b7a564328ac96a966d91994ce418f14807537e0bc1fb9`
**Description**: Asset removed or path changed (pattern: 8a57c5d7c2e04fdd…)

**Sample routes**: `/docs/claude-skills/zudo-doc-writing-rules`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `8a57c5d7c2e04fdd113b7a564328ac96a966d91994ce418f14807537e0bc1fb9`
**Description**: Asset removed or path changed (pattern: 8a57c5d7c2e04fdd…)

**Sample routes**: `/docs/claude-skills/zudo-doc-writing-rules`

_Generated by migration-check harness. Review the full report before filing._

---

### 17. [migration-check] asset-loss: Asset removed or path changed (pattern: d864ce10da7f12ca…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: d864ce10da7f12ca…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `d864ce10da7f12ca9a102f55fb6c434912ac63ad61d41eaa60f5a4831facf6e8`
**Description**: Asset removed or path changed (pattern: d864ce10da7f12ca…)

**Sample routes**: `/docs/components/admonitions`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `d864ce10da7f12ca9a102f55fb6c434912ac63ad61d41eaa60f5a4831facf6e8`
**Description**: Asset removed or path changed (pattern: d864ce10da7f12ca…)

**Sample routes**: `/docs/components/admonitions`

_Generated by migration-check harness. Review the full report before filing._

---

### 18. [migration-check] asset-loss: Asset removed or path changed (pattern: 9468ade238a1e6ff…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 9468ade238a1e6ff…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9468ade238a1e6ffece10a87d59d476d48c8c305772eb325d38efc0f00b3bd82`
**Description**: Asset removed or path changed (pattern: 9468ade238a1e6ff…)

**Sample routes**: `/docs/components/basic-components`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9468ade238a1e6ffece10a87d59d476d48c8c305772eb325d38efc0f00b3bd82`
**Description**: Asset removed or path changed (pattern: 9468ade238a1e6ff…)

**Sample routes**: `/docs/components/basic-components`

_Generated by migration-check harness. Review the full report before filing._

---

### 19. [migration-check] asset-loss: Asset removed or path changed (pattern: 35c8a669d903a20e…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 35c8a669d903a20e…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `35c8a669d903a20ead19c296acefe4d3c2efcfa2dcc2b2a2837f759926ab414d`
**Description**: Asset removed or path changed (pattern: 35c8a669d903a20e…)

**Sample routes**: `/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `35c8a669d903a20ead19c296acefe4d3c2efcfa2dcc2b2a2837f759926ab414d`
**Description**: Asset removed or path changed (pattern: 35c8a669d903a20e…)

**Sample routes**: `/docs/components/html-preview`

_Generated by migration-check harness. Review the full report before filing._

---

### 20. [migration-check] asset-loss: Asset removed or path changed (pattern: 57f9a1bac66138a0…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 57f9a1bac66138a0…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `57f9a1bac66138a01066e7b1e96d319dbc9f41e13455ef6a3ecb118a7fada72a`
**Description**: Asset removed or path changed (pattern: 57f9a1bac66138a0…)

**Sample routes**: `/docs/components/image-enlarge`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `57f9a1bac66138a01066e7b1e96d319dbc9f41e13455ef6a3ecb118a7fada72a`
**Description**: Asset removed or path changed (pattern: 57f9a1bac66138a0…)

**Sample routes**: `/docs/components/image-enlarge`

_Generated by migration-check harness. Review the full report before filing._

---
