# target-manifest-confirm

Confirm-gate fixture (epic zudolab/zudo-doc#2651, #2659) proving the locked
12-file minimal-scaffold manifest builds, dev-serves, hydrates, and
typechecks from the npm-packed `@takazudo/zudo-doc` package. Not a real
project — do not scaffold from this directory.

The document stub deliberately consumes `virtual:zudo-doc-chrome-bindings`,
matching fresh scaffolds. The virtual fallback is `{}` in this fixture, while
real projects can configure one typed module with six primary replacements or
named `headerRightComponents`; omitted slots keep package defaults. Ejection
only copies source and must follow the CLI's primary/nested/content remediation.
