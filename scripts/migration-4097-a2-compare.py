"""Preserve complete A2 bytes/diffs and fail closed on unreviewed differences."""
import difflib
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import sys


class Inventory(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.data = {"title": [], "headings": [], "urls": [], "islands": []}
        self.active = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.data["htmlAttributes"] = attrs
        if tag == "title" or tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            item = {"tag": tag, "attributes": attrs, "text": ""}
            self.data["title" if tag == "title" else "headings"].append(item)
            self.active.append(item)
        for key in ("href", "src"):
            if key in attrs:
                self.data["urls"].append({"tag": tag, "attribute": key, "value": attrs[key]})
        if any(key.startswith("data-zfb-") for key in attrs):
            item = {"tag": tag, "attributes": attrs}
            if "data-props" in attrs:
                try:
                    item["decodedProps"] = json.loads(attrs["data-props"])
                except (ValueError, TypeError):
                    item["decodedProps"] = None
            self.data["islands"].append(item)

    def handle_endtag(self, tag):
        self.active = [item for item in self.active if item["tag"] != tag]

    def handle_data(self, data):
        for item in self.active:
            item["text"] += data


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    baseline, current, references_path, output, current_head = sys.argv[1:]
    baseline, current, output = Path(baseline), Path(current), Path(output)
    output.mkdir()
    manifests = [json.loads((root / "manifest.json").read_text()) for root in (baseline, current)]
    assert manifests[0]["sourceHead"] == "8e70ab58222296bc1d2e241e18438bab5651d530"
    assert manifests[1]["sourceHead"] == current_head
    pages = ["404.html", "docs/getting-started/index.html", "docs/getting-started/coverage/index.html"]
    references = json.loads(Path(references_path).read_text())
    assert sorted(references) == sorted(pages)
    for manifest in manifests:
        assert sorted(item["page"] for item in manifest["pages"]) == sorted(pages)
    reports = []
    differs = False
    for page in pages:
        name = page.replace("/", "--")
        raw = [(root / name).read_bytes() for root in (baseline, current)]
        html = [content.decode("utf-8") for content in raw]
        helper = Path(__file__).with_name("parity-html-normalize.mjs").resolve().as_uri()
        # Reuse the unchanged production normalizer; no new marker exclusions.
        normalization = subprocess.run([
            "node", "--input-type=module", "-e",
            "const {normalizeHtml}=await import(process.argv[1]); let data=''; for await (const chunk of process.stdin) data+=chunk; process.stdout.write(JSON.stringify(JSON.parse(data).map(normalizeHtml)));",
            helper,
        ], input=json.dumps(html), text=True, capture_output=True, check=True)
        normalized = [content.encode("utf-8") for content in json.loads(normalization.stdout)]
        for variant, root in enumerate((baseline, current)):
            assert (root / (name + ".normalized.html")).read_bytes() == normalized[variant]
            entry = next(item for item in manifests[variant]["pages"] if item["page"] == page)
            assert entry["bytes"] == len(raw[variant])
            assert entry["sha256Html"] == digest(normalized[variant])
        assert digest(normalized[0]) == references[page], f"Baseline reference mismatch: {page}"
        raw_equal, normalized_equal = raw[0] == raw[1], normalized[0] == normalized[1]
        differs |= not raw_equal or not normalized_equal
        inventories = []
        for text in html:
            parser = Inventory()
            parser.feed(text)
            parser.close()
            inventories.append(parser.data)
        for kind, contents in (("raw", raw), ("normalized", normalized)):
            for variant, content in zip(("baseline", "current"), contents):
                (output / f"{name}.{variant}.{kind}.html").write_bytes(content)
            # Complete byte-preserving unified diff. Large one-line HTML stays
            # complete in artifacts; only compact per-page summaries go to logs.
            diff = difflib.diff_bytes(difflib.unified_diff,
                contents[0].splitlines(keepends=True), contents[1].splitlines(keepends=True),
                fromfile=f"{page}:baseline:{kind}".encode(), tofile=f"{page}:current:{kind}".encode())
            (output / f"{name}.{kind}.diff").write_bytes(b"".join(diff))
        changed_metadata = [key for key in sorted(set(inventories[0]) | set(inventories[1]))
                            if inventories[0].get(key) != inventories[1].get(key)]
        report = {"page": page, "rawEqual": raw_equal, "normalizedEqual": normalized_equal,
                  "baselineRawSha256": digest(raw[0]), "currentRawSha256": digest(raw[1]),
                  "baselineNormalizedSha256": digest(normalized[0]), "currentNormalizedSha256": digest(normalized[1]),
                  "changedMetadata": changed_metadata,
                  "baselineMetadata": inventories[0], "currentMetadata": inventories[1]}
        reports.append(report)
        print(json.dumps({key: report[key] for key in ("page", "rawEqual", "normalizedEqual", "changedMetadata", "baselineNormalizedSha256", "currentNormalizedSha256")}))
    report = {"baselineHead": manifests[0]["sourceHead"], "currentHead": current_head,
              "status": "FAIL_DIFFERENCES_REQUIRE_REVIEW" if differs else "PASS_EXACT_HTML_PARITY", "pages": reports}
    (output / "comparison.json").write_text(json.dumps(report, indent=2) + "\n")
    return 1 if differs else 0


if __name__ == "__main__":
    sys.exit(main())
