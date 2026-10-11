#!/usr/bin/env python3
"""Offline A2 evidence comparison; never accepts or writes fingerprint references.

Exit 0: exact normalized capture equality, 1: differences require review,
2: invalid evidence/unsupported contract. None certifies a build, CI or release.
"""
import argparse
import difflib
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys

COMPONENTS = {
    "404.html": ["SidebarToggle"],
    "docs/getting-started/index.html": ["SidebarToggle", "SidebarTree"],
    "docs/getting-started/coverage/index.html": ["SidebarToggle", "SidebarTree", "MobileToc", "Toc"],
}
REFERENCE = "scripts/__tests__/fixtures/a2-route-reference.json"
NORMALIZER = "scripts/parity-html-normalize.mjs"
PACK_ROOT = "packages/zudo-doc/src/theme-packs/"
MAX_BYTES = 2_000_000
PACK_MAP = re.compile(r"var packs=(\{[^\r\n]*?\});")
PAIR = re.compile(r'("(?:\\.|[^"\\])*")(\s*:\s*)("(?:\\.|[^"\\])*")')
ATTRIBUTE = re.compile(r'''\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?''')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data.encode("utf8") if isinstance(data, str) else data).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON key: " + key)
        result[key] = value
    return result


def parse_json(text):
    return json.loads(text, object_pairs_hook=unique_object)


def read_capture_file(root, name):
    path = root / name
    require(path.resolve().parent == root and path.is_file(), "Capture file missing or escapes directory: " + name)
    require(path.stat().st_size <= MAX_BYTES, "Capture file exceeds bound: " + name)
    return path.read_bytes()


class Islands(HTMLParser):
    """Inventory real start tags and retain exact identity-value source spans."""
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.offsets = [0]
        # HTMLParser's getpos counts LF only, unlike str.splitlines (which
        # also splits CR and Unicode separators occurring in fixture prose).
        self.offsets.extend(match.end() for match in re.finditer("\n", html))
        self.items = []
        self.spans = []
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attrs):
        names = [name for name, _ in attrs]
        # Persistence also belongs on ordinary header/footer elements. Only
        # identity/transport attributes identify an island for this inventory.
        native = any(name in {"data-zfb-island", "data-zfb-island-skip-ssr", "data-zfb-build",
                              "data-zfb-protocol", "data-zfb-transport"} for name in names)
        if not native:
            return
        require(len(names) == len(set(names)), "Duplicate native tag attribute")
        values = dict(attrs)
        require("data-zfb-island" in values and "data-zfb-island-skip-ssr" not in values,
                "Unexpected native marker/identity placement")
        token = values.get("data-zfb-build") or ""
        require(re.fullmatch(r"[a-f0-9]{16}", token), "Missing/malformed native identity")
        require(values.get("data-zfb-protocol") == "zudo-react/1" and values.get("data-zfb-transport") == "json/1",
                "Missing/wrong native protocol or transport")
        # Tokenize complete attributes so token-looking text inside another
        # quoted value cannot be mistaken for the identity's source span.
        raw = self.get_starttag_text()
        position = re.match(r"<[^\s/>]+", raw).end()
        identity = []
        while not re.fullmatch(r"\s*/?>", raw[position:]):
            match = ATTRIBUTE.match(raw, position)
            require(match is not None, "Unsupported native start-tag syntax")
            if match[1].lower() == "data-zfb-build":
                group = next((i for i in (2, 3, 4) if match[i] is not None), None)
                require(group is not None and match[group] == token,
                        "Unsupported encoded native identity value")
                identity.append((match.start(group), match.end(group)))
            position = match.end()
        require(len(identity) == 1, "Unsupported/duplicate native identity syntax")
        line, column = self.getpos()
        start = self.offsets[line - 1] + column
        self.spans.append((start + identity[0][0], start + identity[0][1]))
        self.items.append({"tag": tag, "component": values["data-zfb-island"], "observedBuild": token})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("repo", "baseline", "candidate", "output"):
        parser.add_argument("--" + flag, required=True, type=Path)
    for flag in ("baseline-source", "candidate-source", "reference-source"):
        parser.add_argument("--" + flag, required=True)
    args = parser.parse_args()
    repo = args.repo.resolve()
    roots = [args.baseline.resolve(), args.candidate.resolve()]
    output = args.output.resolve()
    package = (repo / "packages/zudo-doc").resolve()
    require(not output.exists(), "Output must be a new directory")
    require(not output.is_relative_to(repo), "Output must be outside the repository")
    for path in [*roots, output]:
        require(not path.is_relative_to(package), "Evidence must be outside the linked package")
    require(all(not output.is_relative_to(root) and not root.is_relative_to(output) for root in roots),
            "Output must not overlap captures")

    def git(*arguments):
        return subprocess.check_output(["git", "-C", str(repo), *arguments], stderr=subprocess.PIPE)

    require(Path(git("rev-parse", "--show-toplevel").decode().strip()).resolve() == repo,
            "--repo must name the Git working-tree root")
    for flag in ("--absolute-git-dir", "--git-common-dir"):
        metadata = (repo / git("rev-parse", flag).decode().strip()).resolve()
        require(not output.is_relative_to(metadata), "Output must be outside Git metadata")

    sources = [args.baseline_source, args.candidate_source, args.reference_source]
    trees = []
    for source in sources:
        require(re.fullmatch(r"[a-f0-9]{40}", source), "Expected a full immutable 40-character source SHA")
        require(git("rev-parse", "--verify", source + "^{commit}").decode().strip() == source, "Not a commit SHA")
        trees.append(git("rev-parse", source + "^{tree}").decode().strip())
    normalizer = Path(__file__).resolve().with_name("parity-html-normalize.mjs")
    normalizer_bytes = normalizer.read_bytes()
    for source in sources:
        require(git("show", source + ":" + NORMALIZER) == normalizer_bytes, "Normalizer contract changed; investigate separately")
    references = parse_json(git("show", sources[2] + ":" + REFERENCE))
    require(isinstance(references, dict) and set(references) == set(COMPONENTS), "Reference route set mismatch")

    def source_packs(source):
        files = git("ls-tree", "-r", "--name-only", source, PACK_ROOT).decode().splitlines()
        versions, css = {}, {}
        for path in files:
            if path.endswith("/meta.json"):
                slug = path[len(PACK_ROOT): -len("/meta.json")]
                meta = parse_json(git("show", source + ":" + path))
                require(isinstance(meta, dict), "Source pack metadata must be an object")
                require(re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug) and meta.get("slug") == slug,
                        "Source pack slug/directory mismatch")
                version = meta.get("version")
                require(isinstance(version, str) and re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", version),
                        "Invalid source pack version: " + slug)
                versions[slug] = version
            elif path.endswith("/pack.css"):
                css[path[len(PACK_ROOT): -len("/pack.css")]] = digest(git("show", source + ":" + path))
        require("default" in versions and set(css) == set(versions) - {"default"}, "Incomplete source pack metadata/CSS set")
        return versions, css

    maps, styles = zip(*(source_packs(source) for source in sources[:2]))
    css_changes = []
    for slug in sorted(set(styles[0]) | set(styles[1])):
        if styles[0].get(slug) != styles[1].get(slug):
            require(slug not in maps[0] or slug not in maps[1] or maps[0][slug] != maps[1][slug],
                    "Changed CSS without a cache-buster version change: " + slug)
            css_changes.append({"slug": slug, "before": styles[0].get(slug), "after": styles[1].get(slug)})

    captures = []
    for variant, root in enumerate(roots):
        manifest_bytes = read_capture_file(root, "manifest.json")
        manifest = parse_json(manifest_bytes)
        require(isinstance(manifest, dict), "Capture manifest must be an object")
        require(manifest.get("sourceHead") == sources[variant], "Capture sourceHead mismatch")
        rows = manifest.get("pages")
        require(isinstance(rows, list) and len(rows) == len(COMPONENTS)
                and all(isinstance(row, dict) and isinstance(row.get("page"), str) for row in rows)
                and {row["page"] for row in rows} == set(COMPONENTS), "Capture route set mismatch")
        raw = [read_capture_file(root, page.replace("/", "--")).decode("utf8") for page in COMPONENTS]
        # Execute only the checked repository normalizer, never captured scripts.
        code = "const {normalizeHtml}=await import(process.argv[1]);let s='';for await(const c of process.stdin)s+=c;process.stdout.write(JSON.stringify(JSON.parse(s).map(normalizeHtml)));"
        normalized = json.loads(subprocess.check_output(
            ["node", "--input-type=module", "-e", code, normalizer.as_uri()],
            input=json.dumps(raw).encode(), stderr=subprocess.PIPE))
        pages, tokens = {}, set()
        for page, original, html in zip(COMPONENTS, raw, normalized):
            row = next(row for row in rows if row["page"] == page)
            name = page.replace("/", "--")
            require(read_capture_file(root, name + ".normalized.html") == html.encode(), "Supplied normalized bytes mismatch: " + page)
            require(row["bytes"] == len(original.encode()) and row["sha256Html"] == digest(html), "Capture manifest byte/hash mismatch: " + page)
            if variant == 0:
                require(references[page] == digest(html), "Baseline reference mismatch: " + page)
            islands = Islands(html)
            require([i["component"] for i in islands.items] == COMPONENTS[page], "Native component order/multiplicity mismatch: " + page)
            page_tokens = {i["observedBuild"] for i in islands.items}
            require(len(page_tokens) == 1, "Mixed native identities: " + page)
            tokens.update(page_tokens)
            matches = list(PACK_MAP.finditer(html))
            require(len(matches) == 1, "Expected exactly one pack map: " + page)
            match = matches[0]
            require(parse_json(match[1]) == maps[variant], "HTML pack map differs from source: " + page)
            pairs = list(PAIR.finditer(match[1]))
            require(len(pairs) == len(maps[variant]), "Unsupported pack map syntax")
            version_spans = {json.loads(pair[1]): (match.start(1) + pair.start(3), match.start(1) + pair.end(3)) for pair in pairs}
            for slug, (start, end) in version_spans.items():
                if slug in maps[0] and slug in maps[1] and maps[0][slug] != maps[1][slug]:
                    require(html[start:end] == json.dumps(maps[variant][slug]), "Unsupported encoded changed pack version")
            pages[page] = {"raw": original, "normalized": html, "islands": islands.items,
                           "identitySpans": islands.spans, "versionSpans": version_spans}
        require(len(tokens) == 1, "Mixed native identities across pages")
        captures.append({"pages": pages, "observedBuild": next(iter(tokens)), "manifestSha256": digest(manifest_bytes)})

    # All validation precedes output creation. Inputs and references stay read-only.
    output.mkdir(parents=True)
    reports = []
    for page in COMPONENTS:
        old, new = [capture["pages"][page] for capture in captures]
        replacements = [(start, end, captures[0]["observedBuild"]) for start, end in new["identitySpans"]]
        for slug, (start, end) in new["versionSpans"].items():
            if slug in maps[0] and maps[0][slug] != maps[1][slug]:
                old_start, old_end = old["versionSpans"][slug]
                replacements.append((start, end, old["normalized"][old_start:old_end]))
        restored = new["normalized"]
        for start, end, value in sorted(replacements, reverse=True):
            restored = restored[:start] + value + restored[end:]
        name = page.replace("/", "--")
        for suffix, contents in [("baseline.raw", old["raw"]), ("candidate.raw", new["raw"]),
                                 ("baseline.normalized", old["normalized"]), ("candidate.normalized", new["normalized"]),
                                 ("candidate.forensic", restored)]:
            (output / (name + "." + suffix + ".html")).write_bytes(contents.encode())
        for kind, before, after in [("raw", old["raw"], new["raw"]), ("normalized", old["normalized"], new["normalized"]),
                                    ("residual", old["normalized"], restored)]:
            # Keep complete one-line HTML diffs; no snippets or truncation.
            diff = "".join(difflib.unified_diff(before.splitlines(keepends=True), after.splitlines(keepends=True),
                                             fromfile=page + ":baseline:" + kind, tofile=page + ":candidate:" + kind))
            (output / (name + "." + kind + ".diff")).write_bytes(diff.encode())
        reports.append({"page": page, "rawEqual": old["raw"] == new["raw"],
                        "normalizedEqual": old["normalized"] == new["normalized"],
                        "residualEqual": old["normalized"] == restored,
                        "baselineRawSha256": digest(old["raw"]), "candidateRawSha256": digest(new["raw"]),
                        "baselineFingerprint": digest(old["normalized"]), "candidateFingerprint": digest(new["normalized"]),
                        "baselineIslands": old["islands"], "candidateIslands": new["islands"]})
    equal = all(row["normalizedEqual"] for row in reports)
    report = {"status": "EXACT_NORMALIZED_CAPTURE_EQUALITY" if equal else "DIFFERENCES_REQUIRE_REVIEW",
              "identityVerification": "OBSERVED_ONLY_UNVERIFIED_FRESHNESS",
              "acceptance": "No build, CI, reference update or release approval; strict A2 remains authoritative.",
              "sources": {key: {"sha": source, "tree": tree} for key, source, tree in zip(
                  ["baseline", "candidate", "reference"], sources, trees)},
              "baselineReferenceTreeEqual": trees[0] == trees[2], "normalizerSha256": digest(normalizer_bytes),
              "captureManifestSha256": [capture["manifestSha256"] for capture in captures],
              "sourcePackVersions": {"baseline": maps[0], "candidate": maps[1]},
              "changedStylesheets": css_changes, "pages": reports}
    (output / "comparison.json").write_text(json.dumps(report, indent=2) + "\n")
    print(report["status"] + ": " + str(output / "comparison.json"))
    print(report["identityVerification"] + "; " + report["acceptance"])
    return 0 if equal else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as error:
        print("INVALID_EVIDENCE: " + str(error), file=sys.stderr)
        sys.exit(2)
