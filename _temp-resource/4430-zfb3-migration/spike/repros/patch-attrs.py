"""Use only inside pnpm patch --edit-dir output, never in live node_modules."""
from pathlib import Path
import sys

root = Path(sys.argv[1]) / "dist" / "zudo-react"
for name in ("render-html.js", "hydrate.js"):
    path = root / name
    source = path.read_text()
    source = source.replace("translate onclick onload onerror", "translate onclick onload onerror popover")
    source = source.replace("sandbox allow allowfullscreen", "sandbox allow allowfullscreen property as integrity hreflang start srcdoc")
    source = source.replace("transform opacity offset", "transform opacity offset xmlns")
    path.write_text(source)
