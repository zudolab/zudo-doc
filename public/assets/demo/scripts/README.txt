Demo scripts
============

This folder holds small, dependency-free scripts used by the asset viewer
showcase. They are ordinary public files, so each one can be opened as source
or downloaded from its raw URL.

check-frontmatter.mjs is a runnable Node.js example. Give it a Markdown file
and it checks that the YAML frontmatter contains both title and description.
It intentionally keeps the parser small so the example is easy to read.

The neighboring diagrams/ folder contains a visual map of the same asset-link
flow: a document reference, its raw public URL, and the generated viewer page.
