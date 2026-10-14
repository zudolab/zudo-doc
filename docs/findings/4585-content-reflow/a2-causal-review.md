# Content reflow A2 causal review — 2026-10-15

Issue #4585; PR #4587. This is a reviewed identity-only reference refresh,
not a change to A2 normalization or a waiver of functional/browser acceptance.
The dated evidence is external to the linked package, like the reference JSON,
so recording the review does not itself churn native source identity. Existing
in-test historical logs, `approvedBaseline`, normalization, transport metadata
and all semantic assertions remain unchanged.

## Immutable inputs and actual execution

Accepted main: `454958d85c260a9af7b599c94e97bede921346c1`.
Candidate: `648e38da8ad73936ab02ea77e443da0adab6327d`.
The candidate's only production change is three added lines in canonical
`packages/zudo-doc/src/content.css`: a two-line comment and the inherited
`overflow-wrap: anywhere` declaration. The other changed file is an external
E2E spec. There is no dependency, runtime, SSR, normalizer or theme-version edit.

The baseline captures are the successful final-head A2 artifact from merged
PR #4576, run [38625509173](https://github.com/zudolab/zudo-doc/actions/runs/38625509173),
artifact [11923722431](https://github.com/zudolab/zudo-doc/actions/runs/38625509173/artifacts/11923722431).
Its manifest records test-merge source `7fa969444f9706c426e03e57adb89eca5868bde2`;
GitHub's comparison with accepted main reports zero changed files. All three
capture hashes exactly equal the accepted main reference JSON, independently
verified after download rather than inferred from the passing job label.

The candidate captures are from run
[38633342323](https://github.com/zudolab/zudo-doc/actions/runs/38633342323), artifact
[11926443525](https://github.com/zudolab/zudo-doc/actions/runs/38633342323/artifacts/11926443525).
Its manifest records test-merge source `48b5dbfdee8a73c382349a6581e02331ee6fbc59`.
The A2 job actually built the workspace and ran its selected tests: 17 semantic
and transport assertions passed; only the three old fingerprints failed.
All 27 other jobs in that candidate run passed, including E2E, typechecks,
publish-contract gates, full theme accessibility, HTML validation and Worker
Contract Proof. These are candidate-head results, not a claim that later-head
CI has already passed. Fresh required checks must pass before merge.

Downloaded ZIP SHA-256 values:

- Baseline: `744a74122b8f8796c3fd9bff348373975399db494a1a1c13aecd3fb3b7b0ea72`.
- Candidate: `dae440a7d4383cebf3fc735e417ffd7cf413dcc02aa6923ecae47e68cf6f87fe`.

Both ZIP digests and every normalized capture hash were checked locally.
Raw HTML, normalized HTML, source manifests and build logs are retained in the
linked CI artifacts, subject to their retention period.

## Per-page causal comparison

Observed native identity changes from `289d56e8b474e70b` to `dffe263641269362`.
An offline diagnostic copy restored **only** the observed `data-zfb-build`
attribute value. The result equaled the entire baseline normalized page
byte-for-byte in every case, not merely selected elements or a DOM projection.
This diagnostic restoration is not installed as a normalization rule.

| Page | Identity occurrences | Normalized bytes, both captures | Old strict SHA-256 | Reviewed strict SHA-256 |
| --- | ---: | ---: | --- | --- |
| `404.html` | 1 | 57031 | `a3892790041324cb3c8eb8aca1f8f4d4513a3e05ada8a024b30892ad67c40dc2` | `e291219449a755a7bd0df9db82baa973704bba0dda0837c99f412867eadf3169` |
| `docs/getting-started/index.html` | 2 | 67463 | `1bbd8d3e06900f43e026428e84bd0ea94bd0bcb58f66bb012c1cd69f58e710b1` | `7a1f9a94fcc42d6e115a8bbec167b7c5cf4977d7592e77dc2db95b3e189b7d1a` |
| `docs/getting-started/coverage/index.html` | 4 | 78915 | `b4c48d86ea8eff4e64fdd02d1b5ad56785da0e9a41d393887df14e173d40900a` | `d04536ef6d7df739acb9ef02e34bb137526c9c248453f0d50d5757681b6f1903` |

Residual differences: **zero bytes on each page**. Markup, text, URLs, props,
protocol, transport and runtime markers remain byte-identical after this
bounded forensic restoration. Existing asset-filename normalization is
unchanged. Native identity is observed; this comparison does not independently
prove freshness or substitute for current-head runtime/browser checks.

To repeat the byte comparison with the two downloaded ZIPs:

```python
import hashlib
import re
import zipfile

with zipfile.ZipFile("baseline.zip") as baseline, zipfile.ZipFile("candidate.zip") as candidate:
    for name, count in [
        ("404.html.normalized.html", 1),
        ("docs--getting-started--index.html.normalized.html", 2),
        ("docs--getting-started--coverage--index.html.normalized.html", 4),
    ]:
        before, after = baseline.read(name), candidate.read(name)
        old = b"data-zfb-build=289d56e8b474e70b"
        new = b"data-zfb-build=dffe263641269362"
        assert set(re.findall(rb"data-zfb-build=([a-f0-9]{16})", before)) == {old[-16:]}
        assert set(re.findall(rb"data-zfb-build=([a-f0-9]{16})", after)) == {new[-16:]}
        assert before.count(old) == after.count(new) == count
        assert len(before) == len(after)
        assert after.replace(new, old) == before
        print(name, hashlib.sha256(before).hexdigest(), hashlib.sha256(after).hexdigest())
```

## Browser and release scope

The new six-test smoke spec loads the built public content CSS export. Separate
local Chromium before/after execution at 195/320/390/640/1280px found 2119px
original document width in each stress case, versus exactly the requested
viewport width after the fix. Actual text fragments fit, prose is not clipped,
text is preserved and preformatted code scrolls locally without wrapping.
Fault injection restores the prior failure. The full candidate E2E job also
passed in hosted CI.

This is not a replay of the downstream 108-case installed-consumer matrix and
makes no Safari/iOS claim. The complete source CSS has the same pre-fix blob
(`8a9bd975ca5160dbf2def39733f30b7daedf3daa`) at v6.0.0, v6.2.0 and accepted main;
that is source parity, not npm tarball identity. No publication or version bump
is included, and #4585 remains open for explicit broader acceptance disposition.
