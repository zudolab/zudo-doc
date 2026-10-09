# Real-browser nested-island persistence control

Prepared for #4468; corrected manager browser run passes all four tests. This is a standalone authored zfb
consumer, separate from the already passed package-injected dev route control.
It uses installed published `@takazudo/zfb` and `@takazudo/zfb-runtime` 4.2.1,
the manager checkout's built public `@takazudo/zudo-doc/transitions` export,
`ClientRouter`, `Island`, and a fixture-owned CounterIsland. No dependency source
patch, private island marker fabrication, registry access, or storage persistence
is used. `data-zfb-transition-persist` and `data-zd-props-preserve` are authored
public router/host policy attributes; zfb emits all island identity metadata.

The local signal is incremented twice before navigation. The unchanged case
navigates same-a → same-b → same-a and checks the same Document, ancestor,
counter, and button references, unchanged performance.timeOrigin/document
request count, value 2, one activation, and zero cleanups. A subsequent click
must increment to 3. Activations and returned cleanup callbacks are counted
through public getScope().onActivate; this proves observable scope continuity,
not private mount-handle object identity.

Independent fresh-document cases check changed props (new counter/button,
value 0, two activations/one cleanup, same ancestor), host preserve (incoming
changed label is ignored, node/value retained, one activation/zero cleanup),
and an authored element added outside the island (ancestor and counter replaced,
value 0, two activations/one cleanup). All cases fail on browser errors or document
reload. No browser expectation was relaxed from an observed result.

## Recreate and run

Copy this directory's contents into `/tmp/zudo421-persistence-browser`, preserving
project/src and project/pages. The archived browser source is
`persistence.spec.ts.txt` because repository browser specs belong in e2e; restore
its execution filename before running: Do not copy a previous dist or generated .zfb.
Create dependency links (not tracked):

```sh
cp /tmp/zudo421-persistence-browser/persistence.spec.ts.txt /tmp/zudo421-persistence-browser/persistence.spec.ts
ln -s /workspace/zudo-doc/node_modules /tmp/zudo421-persistence-browser/node_modules
ln -s /workspace/zudo-doc/node_modules /tmp/zudo421-persistence-browser/project/node_modules
chmod +x /tmp/zudo421-persistence-browser/run.sh
```

The manager alone runs the browser under the shared heavy guard:

```sh
bash "$HOME/.codex/scripts/heavy-guard.sh" -- /tmp/zudo421-persistence-browser/run.sh
```

Port 44293 must be unused; Playwright refuses to reuse an existing server. The
scratch zfb dev server renders actual authored pages, with no route or runtime
stubs. It is stopped with SIGTERM by Playwright and the existing subreaper.
Four tests run serially, without retries. Report and lifecycle attachments land
in `/tmp/zudo421-persistence-browser/report.json` and `test-results/`.

Preparation checks passed: project TypeScript, spec TypeScript, shell syntax,
and config JavaScript syntax. The worker did not launch a browser/server/build.
Both initial failure and corrected manager run output/results are preserved here.

## First manager run

The first manager run failed all four tests at the final empty-console-error
assertion with one resource 404; every preceding lifecycle, node identity, signal,
and same-document assertion completed. See initial-failure.log and
initial-failure-report.json. The original capture did not record the failed URL.
The fixture omitted a favicon, so it now supplies and explicitly links a real
public/favicon.svg. This diagnosis is provisional until rerun: the spec now
records console locations and every HTTP error URL/status, preserves lifecycle
attachments before error assertions, and asserts no HTTP errors. No errors are
ignored or allowlisted. The corrected manager run passes all four tests (6.9s), with heavy-guard PASS (8s). The original failed URL was not captured, so the favicon cause remains inferred from the successful real-asset correction; no URL-level proof is claimed for the first run. The corrected report records zero console/HTTP errors and attaches measured lifecycle/navigation values. See passed-run.log and passed-report.json.
