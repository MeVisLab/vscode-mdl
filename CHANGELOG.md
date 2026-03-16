# Change Log

## v0.0.2 - 2026-03-16

Added keywords and multi-line comment support to the MDL grammar.

Detailed Changes:

- Added `scripts/update-mdl-language-config.js` to regenerate MDL grammar keyword sets from `MDLValidation.def`.
- Updated `syntaxes/mdl.tmLanguage.json` using the new updater output.
- Added automated tests in `test/update-mdl-language-config.test.js` for parser extraction, grammar patching, and CLI integration.
- Expanded `README.md` with updater usage, workflow guidance, and testing instructions.

## v0.0.1 - 2019-12-08

Initial version.
