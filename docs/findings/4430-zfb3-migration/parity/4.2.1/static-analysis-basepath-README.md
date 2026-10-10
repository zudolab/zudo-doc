# Published 4.2.1 non-root deployment control

Manager-only heavy/browser execution:

```sh
bash "$HOME/.codex/scripts/heavy-guard.sh" -- /tmp/zudo421-basepath-probe/run.sh
```

The runner creates a new disposable project from the preserved no-stub injected-route fixture, copies the real generated consumer stylesheet, sets `/nested/docs/`, enables SPA transitions and adds the existing Getting Started header entry. It uses `copyPublicWithBase: false`, the published whole-dist deployment relocation contract. No product source, emitted bytes, network response or asset URLs are patched. Reruns refuse to replace an existing project; preserve it before choosing a fresh directory.

The probe builds with installed 4.2.1, asserts actual HTML CSS/island URL prefixes and hashes emitted assets, and records native preview statuses separately. Native preview's documented lack of deploy-side relocation is not treated as a hydration pass or invented upstream defect. A filesystem-only HTTP mount serves the entire unchanged dist under the configured prefix, equivalent to the documented whole-dist deployment relocation; it does not mirror individual assets or rewrite content.

Browser checks require all emitted islands mounted plus actual desktop filter and mobile drawer events, prefixed CSS/island requests, desktop/mobile SPA swaps with stable timeOrigin and no new Document requests, and zero browser console/page/resource errors. Independent missing-path, unmounted root-route and root-asset requests must return 404. Report records the manager source head, engine/browser, URLs/hashes, route requests, statuses and strict failures. All server/browser teardown happens in finally; the existing subreaper owns process-tree cleanup.

The initial manager run built successfully at source 244df66de42179608c57d841c974e0a52404f734, then failed in the native-fetch diagnostic due to calling numeric Response.status as a method. That report/log is preserved separately. The corrected native-fetch read uses the numeric property; Playwright responses retain their status() method. Manager can run rerun-built.sh under the heavy guard against that exact unchanged build, without replacing or rebuilding the project. No browser pass was obtained from the initial failed diagnostic.

Final manager rerun passes the faithful deployment browser checks. Both initial diagnostic failures are retained. The native preview and deployment listeners independently reject connections after teardown; cleanup proofs are archived.
