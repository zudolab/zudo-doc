# Runtime control evidence

`sidebar-input-token-probe.spec.ts.txt` is the diagnostic source used for the
initial and hydration-gated token captures. It records the browser report
before its exploratory assertions. Those captures disproved the speculative
input/button identity-retention assertions; the archived probe is evidence,
not an acceptance test. The compact `sidebar-input-token-results.json`
preserves both report summaries and the source-log hashes.

The first injected-dev browser log, `dev-css-before-contract.log`, records the
temporary fixture's 0×0 mobile button when it had no consumer stylesheet. The
corrected log, `dev-css-with-contract.log`, records the same probe after
copying the generated scaffold CSS entrypoint into the disposable project. It
passed; this isolates a harness correction from runtime behavior.

The archived suffix keeps diagnostic source outside repository E2E discovery.
For an exploratory reproduction, copy it into a disposable directory and restore
the `sidebar-input-token-probe.spec.ts` execution filename there. Historical
reports retain the actual filename used for their captured run.
