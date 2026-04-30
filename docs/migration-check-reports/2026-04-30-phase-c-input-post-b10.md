# Migration Check Report

**Generated**: 2026-04-30T08:21:04.849Z
**Findings files**: 7 batch file(s), 219 route(s) total

---

## Summary

| Category | Routes |
| --- | --- |
| content-loss | 83 |
| asset-loss | 117 |
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
- **`sitemap.xml`** (text) — 6 line(s) removed, 13 line(s) added

---

## Top Clusters (top 20 by route count)

Routes with identical diff signatures are grouped together.
Cluster sample size is capped at 5 representative routes.

### 1. `asset-loss` — Asset removed or path changed (pattern: 4695d69569cf0834…) — 1 route(s)

**Signature**: `4695d69569cf08341d8d232b67edf6fe2204055f0db5c7f598ffaa7dbb507cc0`

**Sample routes**:

- `/`

---

### 2. `asset-loss` — Asset removed or path changed (pattern: 49210076844d7560…) — 1 route(s)

**Signature**: `49210076844d7560478a04526db803f5a393b3d87bde9268745d7b14766b4ee3`

**Sample routes**:

- `/docs/claude-agents/doc-reviewer`

---

### 3. `asset-loss` — Asset removed or path changed (pattern: f9372bc4f720b48e…) — 1 route(s)

**Signature**: `f9372bc4f720b48eaa7a4b44144b16d6ecbc62a1185298118c43990701fb15a2`

**Sample routes**:

- `/docs/claude-md/e2e`

---

### 4. `asset-loss` — Asset removed or path changed (pattern: b205c3f38cf6b048…) — 1 route(s)

**Signature**: `b205c3f38cf6b04849a0385953f82f014384886232d402b3ecab8b0aad1c1b3c`

**Sample routes**:

- `/docs/claude-md/packages--create-zudo-doc`

---

### 5. `asset-loss` — Asset removed or path changed (pattern: 788aa35167e6d4bd…) — 1 route(s)

**Signature**: `788aa35167e6d4bd8ad8c37891de6a9f7d3df3065a1a563861e0ea21408e2003`

**Sample routes**:

- `/docs/claude-md/packages--doc-history-server`

---

### 6. `asset-loss` — Asset removed or path changed (pattern: 980b78269fa038bb…) — 1 route(s)

**Signature**: `980b78269fa038bbd6ee9f2115e80bed520166a3b1bb667cb28349f663c8532a`

**Sample routes**:

- `/docs/claude-md/packages--search-worker`

---

### 7. `asset-loss` — Asset removed or path changed (pattern: ed1e1a54a6c5338f…) — 1 route(s)

**Signature**: `ed1e1a54a6c5338f3ce8209b65704192b80c5f009d9250e163f92482a7f9b53d`

**Sample routes**:

- `/docs/claude-md/src--config`

---

### 8. `asset-loss` — Asset removed or path changed (pattern: 79938f998c05fc0b…) — 1 route(s)

**Signature**: `79938f998c05fc0b3f861e16c0872d8080ca97f0cb3544173e20517e0711047e`

**Sample routes**:

- `/docs/claude-md/src`

---

### 9. `asset-loss` — Asset removed or path changed (pattern: fe51d98debf23ee1…) — 1 route(s)

**Signature**: `fe51d98debf23ee1af868080e57d9dc306bb6d09cf1d03fe8a0ab66447943b1f`

**Sample routes**:

- `/docs/claude-md/vendor--design-token-lint`

---

### 10. `asset-loss` — Asset removed or path changed (pattern: 9b53bd13e2ef888f…) — 1 route(s)

**Signature**: `9b53bd13e2ef888f2287bb5418a3b34a566491981d239be8e28d7f8ffee693f1`

**Sample routes**:

- `/docs/claude-skills/check-docs`

---

### 11. `asset-loss` — Asset removed or path changed (pattern: 8ae239c6c2b2ae45…) — 1 route(s)

**Signature**: `8ae239c6c2b2ae45ca1c0b788fa93d491b46c8ac3a4c18c7ad43784b8ef28663`

**Sample routes**:

- `/docs/claude-skills/l-generator-cli-tester`

---

### 12. `asset-loss` — Asset removed or path changed (pattern: 1390f6deb78f53e4…) — 1 route(s)

**Signature**: `1390f6deb78f53e4e2dfac61a142b155332cbcec69db7c0148b5e97e6b435a10`

**Sample routes**:

- `/docs/claude-skills/l-run-generator-cli-whole-test`

---

### 13. `asset-loss` — Asset removed or path changed (pattern: be8b6d2423cf79ed…) — 1 route(s)

**Signature**: `be8b6d2423cf79ed7a9b4e445d9e09edc5f29355b073b52b7a308573228fc5e6`

**Sample routes**:

- `/docs/claude-skills/l-update-generator`

---

### 14. `asset-loss` — Asset removed or path changed (pattern: f15d2197e01dd29b…) — 1 route(s)

**Signature**: `f15d2197e01dd29b949f3eb0341c98cc12b6f2670345ad74e0e019ed351b4407`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-navigation-design`

---

### 15. `asset-loss` — Asset removed or path changed (pattern: 3a087adec383efc9…) — 1 route(s)

**Signature**: `3a087adec383efc97e1cd7767b5d00dc230065c8573ee87eb46baf50f3014b62`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-translate`

---

### 16. `asset-loss` — Asset removed or path changed (pattern: 6722994f6898daba…) — 1 route(s)

**Signature**: `6722994f6898daba7cdb4cf7ad7934e4906418813754d09f93f5c69d1fa549b0`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-version-bump`

---

### 17. `asset-loss` — Asset removed or path changed (pattern: 3356e90dd9bff846…) — 1 route(s)

**Signature**: `3356e90dd9bff846eda8f967a0531a3146490b215a1c09a92583b1dbda679007`

**Sample routes**:

- `/docs/claude-skills/zudo-doc-writing-rules`

---

### 18. `asset-loss` — Asset removed or path changed (pattern: a20515440e7c38e5…) — 1 route(s)

**Signature**: `a20515440e7c38e5542def0cb4921972ab335b3624fa9bdfb81de2194eff052b`

**Sample routes**:

- `/docs/components/admonitions`

---

### 19. `asset-loss` — Asset removed or path changed (pattern: e7710dc1592b6275…) — 1 route(s)

**Signature**: `e7710dc1592b6275dc0fe1a89102cb705ffd3aa44f4a20974f9ecf60cc50c8d5`

**Sample routes**:

- `/docs/components/basic-components`

---

### 20. `asset-loss` — Asset removed or path changed (pattern: cf98df86683805e9…) — 1 route(s)

**Signature**: `cf98df86683805e98e99bf9c8ed0b30cccd14ffb8b37e79dc7d26959e7dbd241`

**Sample routes**:

- `/docs/components/details`

---

---

## Suggested Issues

One entry per non-cosmetic cluster. Copy the `gh issue create` command to file a tracking issue.

### 1. [migration-check] asset-loss: Asset removed or path changed (pattern: 4695d69569cf0834…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 4695d69569cf0834…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `4695d69569cf08341d8d232b67edf6fe2204055f0db5c7f598ffaa7dbb507cc0`
**Description**: Asset removed or path changed (pattern: 4695d69569cf0834…)

**Sample routes**: `/`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `4695d69569cf08341d8d232b67edf6fe2204055f0db5c7f598ffaa7dbb507cc0`
**Description**: Asset removed or path changed (pattern: 4695d69569cf0834…)

**Sample routes**: `/`

_Generated by migration-check harness. Review the full report before filing._

---

### 2. [migration-check] asset-loss: Asset removed or path changed (pattern: 49210076844d7560…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 49210076844d7560…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `49210076844d7560478a04526db803f5a393b3d87bde9268745d7b14766b4ee3`
**Description**: Asset removed or path changed (pattern: 49210076844d7560…)

**Sample routes**: `/docs/claude-agents/doc-reviewer`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `49210076844d7560478a04526db803f5a393b3d87bde9268745d7b14766b4ee3`
**Description**: Asset removed or path changed (pattern: 49210076844d7560…)

**Sample routes**: `/docs/claude-agents/doc-reviewer`

_Generated by migration-check harness. Review the full report before filing._

---

### 3. [migration-check] asset-loss: Asset removed or path changed (pattern: f9372bc4f720b48e…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: f9372bc4f720b48e…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `f9372bc4f720b48eaa7a4b44144b16d6ecbc62a1185298118c43990701fb15a2`
**Description**: Asset removed or path changed (pattern: f9372bc4f720b48e…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `f9372bc4f720b48eaa7a4b44144b16d6ecbc62a1185298118c43990701fb15a2`
**Description**: Asset removed or path changed (pattern: f9372bc4f720b48e…)

**Sample routes**: `/docs/claude-md/e2e`

_Generated by migration-check harness. Review the full report before filing._

---

### 4. [migration-check] asset-loss: Asset removed or path changed (pattern: b205c3f38cf6b048…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: b205c3f38cf6b048…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `b205c3f38cf6b04849a0385953f82f014384886232d402b3ecab8b0aad1c1b3c`
**Description**: Asset removed or path changed (pattern: b205c3f38cf6b048…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `b205c3f38cf6b04849a0385953f82f014384886232d402b3ecab8b0aad1c1b3c`
**Description**: Asset removed or path changed (pattern: b205c3f38cf6b048…)

**Sample routes**: `/docs/claude-md/packages--create-zudo-doc`

_Generated by migration-check harness. Review the full report before filing._

---

### 5. [migration-check] asset-loss: Asset removed or path changed (pattern: 788aa35167e6d4bd…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 788aa35167e6d4bd…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `788aa35167e6d4bd8ad8c37891de6a9f7d3df3065a1a563861e0ea21408e2003`
**Description**: Asset removed or path changed (pattern: 788aa35167e6d4bd…)

**Sample routes**: `/docs/claude-md/packages--doc-history-server`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `788aa35167e6d4bd8ad8c37891de6a9f7d3df3065a1a563861e0ea21408e2003`
**Description**: Asset removed or path changed (pattern: 788aa35167e6d4bd…)

**Sample routes**: `/docs/claude-md/packages--doc-history-server`

_Generated by migration-check harness. Review the full report before filing._

---

### 6. [migration-check] asset-loss: Asset removed or path changed (pattern: 980b78269fa038bb…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 980b78269fa038bb…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `980b78269fa038bbd6ee9f2115e80bed520166a3b1bb667cb28349f663c8532a`
**Description**: Asset removed or path changed (pattern: 980b78269fa038bb…)

**Sample routes**: `/docs/claude-md/packages--search-worker`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `980b78269fa038bbd6ee9f2115e80bed520166a3b1bb667cb28349f663c8532a`
**Description**: Asset removed or path changed (pattern: 980b78269fa038bb…)

**Sample routes**: `/docs/claude-md/packages--search-worker`

_Generated by migration-check harness. Review the full report before filing._

---

### 7. [migration-check] asset-loss: Asset removed or path changed (pattern: ed1e1a54a6c5338f…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: ed1e1a54a6c5338f…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `ed1e1a54a6c5338f3ce8209b65704192b80c5f009d9250e163f92482a7f9b53d`
**Description**: Asset removed or path changed (pattern: ed1e1a54a6c5338f…)

**Sample routes**: `/docs/claude-md/src--config`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `ed1e1a54a6c5338f3ce8209b65704192b80c5f009d9250e163f92482a7f9b53d`
**Description**: Asset removed or path changed (pattern: ed1e1a54a6c5338f…)

**Sample routes**: `/docs/claude-md/src--config`

_Generated by migration-check harness. Review the full report before filing._

---

### 8. [migration-check] asset-loss: Asset removed or path changed (pattern: 79938f998c05fc0b…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 79938f998c05fc0b…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `79938f998c05fc0b3f861e16c0872d8080ca97f0cb3544173e20517e0711047e`
**Description**: Asset removed or path changed (pattern: 79938f998c05fc0b…)

**Sample routes**: `/docs/claude-md/src`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `79938f998c05fc0b3f861e16c0872d8080ca97f0cb3544173e20517e0711047e`
**Description**: Asset removed or path changed (pattern: 79938f998c05fc0b…)

**Sample routes**: `/docs/claude-md/src`

_Generated by migration-check harness. Review the full report before filing._

---

### 9. [migration-check] asset-loss: Asset removed or path changed (pattern: fe51d98debf23ee1…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: fe51d98debf23ee1…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `fe51d98debf23ee1af868080e57d9dc306bb6d09cf1d03fe8a0ab66447943b1f`
**Description**: Asset removed or path changed (pattern: fe51d98debf23ee1…)

**Sample routes**: `/docs/claude-md/vendor--design-token-lint`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `fe51d98debf23ee1af868080e57d9dc306bb6d09cf1d03fe8a0ab66447943b1f`
**Description**: Asset removed or path changed (pattern: fe51d98debf23ee1…)

**Sample routes**: `/docs/claude-md/vendor--design-token-lint`

_Generated by migration-check harness. Review the full report before filing._

---

### 10. [migration-check] asset-loss: Asset removed or path changed (pattern: 9b53bd13e2ef888f…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 9b53bd13e2ef888f…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9b53bd13e2ef888f2287bb5418a3b34a566491981d239be8e28d7f8ffee693f1`
**Description**: Asset removed or path changed (pattern: 9b53bd13e2ef888f…)

**Sample routes**: `/docs/claude-skills/check-docs`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `9b53bd13e2ef888f2287bb5418a3b34a566491981d239be8e28d7f8ffee693f1`
**Description**: Asset removed or path changed (pattern: 9b53bd13e2ef888f…)

**Sample routes**: `/docs/claude-skills/check-docs`

_Generated by migration-check harness. Review the full report before filing._

---

### 11. [migration-check] asset-loss: Asset removed or path changed (pattern: 8ae239c6c2b2ae45…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 8ae239c6c2b2ae45…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `8ae239c6c2b2ae45ca1c0b788fa93d491b46c8ac3a4c18c7ad43784b8ef28663`
**Description**: Asset removed or path changed (pattern: 8ae239c6c2b2ae45…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `8ae239c6c2b2ae45ca1c0b788fa93d491b46c8ac3a4c18c7ad43784b8ef28663`
**Description**: Asset removed or path changed (pattern: 8ae239c6c2b2ae45…)

**Sample routes**: `/docs/claude-skills/l-generator-cli-tester`

_Generated by migration-check harness. Review the full report before filing._

---

### 12. [migration-check] asset-loss: Asset removed or path changed (pattern: 1390f6deb78f53e4…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 1390f6deb78f53e4…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `1390f6deb78f53e4e2dfac61a142b155332cbcec69db7c0148b5e97e6b435a10`
**Description**: Asset removed or path changed (pattern: 1390f6deb78f53e4…)

**Sample routes**: `/docs/claude-skills/l-run-generator-cli-whole-test`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `1390f6deb78f53e4e2dfac61a142b155332cbcec69db7c0148b5e97e6b435a10`
**Description**: Asset removed or path changed (pattern: 1390f6deb78f53e4…)

**Sample routes**: `/docs/claude-skills/l-run-generator-cli-whole-test`

_Generated by migration-check harness. Review the full report before filing._

---

### 13. [migration-check] asset-loss: Asset removed or path changed (pattern: be8b6d2423cf79ed…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: be8b6d2423cf79ed…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `be8b6d2423cf79ed7a9b4e445d9e09edc5f29355b073b52b7a308573228fc5e6`
**Description**: Asset removed or path changed (pattern: be8b6d2423cf79ed…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `be8b6d2423cf79ed7a9b4e445d9e09edc5f29355b073b52b7a308573228fc5e6`
**Description**: Asset removed or path changed (pattern: be8b6d2423cf79ed…)

**Sample routes**: `/docs/claude-skills/l-update-generator`

_Generated by migration-check harness. Review the full report before filing._

---

### 14. [migration-check] asset-loss: Asset removed or path changed (pattern: f15d2197e01dd29b…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: f15d2197e01dd29b…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `f15d2197e01dd29b949f3eb0341c98cc12b6f2670345ad74e0e019ed351b4407`
**Description**: Asset removed or path changed (pattern: f15d2197e01dd29b…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `f15d2197e01dd29b949f3eb0341c98cc12b6f2670345ad74e0e019ed351b4407`
**Description**: Asset removed or path changed (pattern: f15d2197e01dd29b…)

**Sample routes**: `/docs/claude-skills/zudo-doc-navigation-design`

_Generated by migration-check harness. Review the full report before filing._

---

### 15. [migration-check] asset-loss: Asset removed or path changed (pattern: 3a087adec383efc9…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 3a087adec383efc9…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `3a087adec383efc97e1cd7767b5d00dc230065c8573ee87eb46baf50f3014b62`
**Description**: Asset removed or path changed (pattern: 3a087adec383efc9…)

**Sample routes**: `/docs/claude-skills/zudo-doc-translate`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `3a087adec383efc97e1cd7767b5d00dc230065c8573ee87eb46baf50f3014b62`
**Description**: Asset removed or path changed (pattern: 3a087adec383efc9…)

**Sample routes**: `/docs/claude-skills/zudo-doc-translate`

_Generated by migration-check harness. Review the full report before filing._

---

### 16. [migration-check] asset-loss: Asset removed or path changed (pattern: 6722994f6898daba…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 6722994f6898daba…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `6722994f6898daba7cdb4cf7ad7934e4906418813754d09f93f5c69d1fa549b0`
**Description**: Asset removed or path changed (pattern: 6722994f6898daba…)

**Sample routes**: `/docs/claude-skills/zudo-doc-version-bump`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `6722994f6898daba7cdb4cf7ad7934e4906418813754d09f93f5c69d1fa549b0`
**Description**: Asset removed or path changed (pattern: 6722994f6898daba…)

**Sample routes**: `/docs/claude-skills/zudo-doc-version-bump`

_Generated by migration-check harness. Review the full report before filing._

---

### 17. [migration-check] asset-loss: Asset removed or path changed (pattern: 3356e90dd9bff846…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: 3356e90dd9bff846…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `3356e90dd9bff846eda8f967a0531a3146490b215a1c09a92583b1dbda679007`
**Description**: Asset removed or path changed (pattern: 3356e90dd9bff846…)

**Sample routes**: `/docs/claude-skills/zudo-doc-writing-rules`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `3356e90dd9bff846eda8f967a0531a3146490b215a1c09a92583b1dbda679007`
**Description**: Asset removed or path changed (pattern: 3356e90dd9bff846…)

**Sample routes**: `/docs/claude-skills/zudo-doc-writing-rules`

_Generated by migration-check harness. Review the full report before filing._

---

### 18. [migration-check] asset-loss: Asset removed or path changed (pattern: a20515440e7c38e5…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: a20515440e7c38e5…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `a20515440e7c38e5542def0cb4921972ab335b3624fa9bdfb81de2194eff052b`
**Description**: Asset removed or path changed (pattern: a20515440e7c38e5…)

**Sample routes**: `/docs/components/admonitions`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `a20515440e7c38e5542def0cb4921972ab335b3624fa9bdfb81de2194eff052b`
**Description**: Asset removed or path changed (pattern: a20515440e7c38e5…)

**Sample routes**: `/docs/components/admonitions`

_Generated by migration-check harness. Review the full report before filing._

---

### 19. [migration-check] asset-loss: Asset removed or path changed (pattern: e7710dc1592b6275…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: e7710dc1592b6275…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `e7710dc1592b6275dc0fe1a89102cb705ffd3aa44f4a20974f9ecf60cc50c8d5`
**Description**: Asset removed or path changed (pattern: e7710dc1592b6275…)

**Sample routes**: `/docs/components/basic-components`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `e7710dc1592b6275dc0fe1a89102cb705ffd3aa44f4a20974f9ecf60cc50c8d5`
**Description**: Asset removed or path changed (pattern: e7710dc1592b6275…)

**Sample routes**: `/docs/components/basic-components`

_Generated by migration-check harness. Review the full report before filing._

---

### 20. [migration-check] asset-loss: Asset removed or path changed (pattern: cf98df86683805e9…) (1 route(s))

**gh issue create command:**

```
gh issue create --title "[migration-check] asset-loss: Asset removed or path changed (pattern: cf98df86683805e9…) (1 route(s))" --body $'**Category**: asset-loss
**Routes affected**: 1
**Signature**: `cf98df86683805e98e99bf9c8ed0b30cccd14ffb8b37e79dc7d26959e7dbd241`
**Description**: Asset removed or path changed (pattern: cf98df86683805e9…)

**Sample routes**: `/docs/components/details`

_Generated by migration-check harness. Review the full report before filing._'
```

**Body preview:**

**Category**: asset-loss
**Routes affected**: 1
**Signature**: `cf98df86683805e98e99bf9c8ed0b30cccd14ffb8b37e79dc7d26959e7dbd241`
**Description**: Asset removed or path changed (pattern: cf98df86683805e9…)

**Sample routes**: `/docs/components/details`

_Generated by migration-check harness. Review the full report before filing._

---
