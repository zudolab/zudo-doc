# zudo-doc theme prototypes (issue #2811)

50 standalone theme-design prototypes for the zudo-doc theme-pack feature, generated
2026-07-16 by the `/big-plan -po -br` planning session (50 parallel Fable agents).

- `index.html` — gallery of all 50 (open in a browser; iframes lazy-load)
- `themes/NN-<slug>.html` — one self-contained prototype per theme; the ◐ button in
  the header toggles light/dark (every theme defines BOTH modes via `light-dark()`)
- `themes.json` — machine-readable metadata (name, mode, description, fonts, highlights)
- `briefs.json` — the 50 input design briefs
- `_template.html` — the shared base template (structural CSS mirrors the real zudo-doc
  page; token names match the real `--zd-*` / `--zdc-*` / `--font-*` contract)
- `tokens-dump.md` — full reference dump of the real token system + DOM structure the
  template was built from

Implementation note: each prototype's THEME LAYER (bottom of its `<style>`) is the spec
for the corresponding real theme pack — tokens both modes, font imports, free-form extras.
