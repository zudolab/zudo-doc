"""Check the fixed historical bookmark inventory against actual built HTML."""
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import sys

# Source aliases added at 1373b8c801641e4025d2888ab7caa458a23b2a47.
# Fixed public inventory: 26 source spans -> 30 targets on 12 EN/JA routes.
# These IDs must never be inferred from current source (which could lose them).
EXPECTED = {
    "docs/guides/custom-components": ["classname-not-class"],
    "docs/guides/development-workflow": ["component-development-server-rendered-preact-components"],
    "docs/reference/component-first": ["the-problem", "in-zudo-doc-anti-pattern"],
    "docs/reference/design-system": ["what-tailwind-vocabulary-you-have"],
    "ja/docs/guides/custom-components": ["ファイル単位のインポート", "組み込みコンポーネントのオーバーライド", "class-ではなく-classname", "関連項目"],
    "ja/docs/guides/development-workflow": ["コンポーネント開発-サーバーレンダリングpreactコンポーネント"],
    "ja/docs/reference/component-first": ["問題", "zudo-docでの実践", "zudo-docでの実践-サーバーレンダリングコンポーネント", "zudo-docでの実践-クライアントでハイドレートされるアイランド", "バリアントはpropsで", "コンポーネントの組み合わせ", "デザイントークンを使用", "zudo-docでの実践-アンチパターン", "カスタムcssが許容される場合", "ルールのまとめ"],
    "ja/docs/reference/design-system": ["タイトトークン戦略", "利用できるtailwindの語彙"],
    "docs/claude-md/packages--zudo-doc": ["shipped-css-artifacts-six-static-one-compiled", "shipped-ambient-type-shims-tsconfig-base-2656-minimal-scaffold-epic-2651-gotcha-—-preact-compat-paths-stay-in-the-project-tsconfig-not-the-base"],
    "ja/docs/claude-md/packages--zudo-doc": ["shipped-css-artifacts-six-static-one-compiled", "shipped-ambient-type-shims-tsconfig-base-2656-minimal-scaffold-epic-2651-gotcha-—-preact-compat-paths-stay-in-the-project-tsconfig-not-the-base"],
    "docs/claude-skills/zudo-doc-design-system": ["quick-rules-always-apply-component-first-no-custom-css-classes", "quick-rules-always-apply-server-rendered-preact-vs-client-islands"],
    "ja/docs/claude-skills/zudo-doc-design-system": ["quick-rules-always-apply-component-first-no-custom-css-classes", "quick-rules-always-apply-server-rendered-preact-vs-client-islands"],
}


class IDs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = Counter()

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key == "id":
                self.ids[value] += 1


def main():
    dist = Path(sys.argv[1])
    assert len(EXPECTED) == 12
    assert sum(len(ids) for ids in EXPECTED.values()) == 30
    rows, errors = [], []
    for route, expected in EXPECTED.items():
        assert len(set(expected)) == len(expected)
        file = dist / route / "index.html"
        parser = IDs()
        if not file.is_file():
            errors.append({"route": "/" + route + "/", "error": "missing-built-route"})
        else:
            parser.feed(file.read_text(encoding="utf-8"))
            parser.close()
        targets = [{"id": target, "count": parser.ids[target]} for target in expected]
        for target in targets:
            if target["count"] != 1:
                errors.append({"route": "/" + route + "/", **target, "error": "expected-exactly-once"})
        rows.append({"route": "/" + route + "/", "file": str(file), "targets": targets})
    report = {"sourceInventoryCommit": "1373b8c801641e4025d2888ab7caa458a23b2a47",
              "expectedRouteCount": 12, "expectedTargetCount": 30,
              "verifiedRouteCount": sum(all(target["count"] == 1 for target in row["targets"]) for row in rows),
              "verifiedTargetCount": sum(target["count"] == 1 for row in rows for target in row["targets"]),
              "status": "FAIL" if errors else "PASS", "routes": rows, "errors": errors}
    print(json.dumps(report, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
