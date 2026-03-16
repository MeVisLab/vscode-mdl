# MeVisLab Description Language (MDL) Support

VS Code language support for MeVisLab MDL files, including syntax highlighting for core MDL structures and validator-derived keywords.

## What This Extension Supports

- MDL-related file extensions:
  - `.def`
  - `.script`
  - `.mdl`
  - `.mlab`
- Single-line comments (`// ...`)
- String forms:
  - `"..."`
  - `"* ... *"`
  - `@@ ... @@`
- Syntax categories generated from `MDLValidation.def`:
  - Block/group keywords (for example `MacroModule`, `Window`, `Interface`)
  - Property/tag names (for example `title`, `dependsOn`, `allowChild`)
  - Enum literals (for example `stable`, `deprecated`, `Top`)
  - MDL preprocessor-like directives (`#include`, `#ifset`, `#ifnset`)

## Installation

### Option 1: Install From VSIX

If you already have a `.vsix` package, install it with:

```powershell
code --install-extension .\mdl-0.0.1.vsix --force
```

### Option 2: Build And Install Locally

From this repository root:

```powershell
npm install
npx @vscode/vsce package
code --install-extension .\mdl-0.0.1.vsix --force
```

## Development Setup

- Install dependencies:

```powershell
npm install
```

- Open this folder in VS Code.
- Press `F5` in VS Code to launch an Extension Development Host.
- Open a `.def` or `.script` file in the dev host and verify highlighting.

## Updating Language Keywords From MDLValidation.def

The grammar is generated/updated by:

- Script: `scripts/update-mdl-language-config.js`
- Output grammar: `syntaxes/mdl.tmLanguage.json`

### Run The Updater

```powershell
npm run update-language-config -- "C:/path/to/MDLValidation.def"
```

Optional second argument for custom grammar output path:

```powershell
node scripts/update-mdl-language-config.js "C:/path/to/MDLValidation.def" "./syntaxes/mdl.tmLanguage.json"
```

### What The Updater Does

- Parses `Group`, `allow`, and `allowChild` declarations for block keyword candidates.
- Parses assignment keys (`key = value`) for property keyword candidates.
- Parses enum `values = "..."` literals for enum keyword candidates.
- Rewrites repository sections in the grammar (`blockKeywords`, `propertyKeywords`, `enumLiterals`, `directives`).
- Writes metadata under `generatedFrom` with source path, generation timestamp, and keyword counts.

### Recommended Updater Workflow

1. Run the updater against the desired `MDLValidation.def`.
2. Review grammar changes in `syntaxes/mdl.tmLanguage.json`.
3. Run tests.
4. Validate visually in VS Code with representative `.def` and `.script` files.
5. Commit both updater and grammar changes together.

## Testing

Run all tests:

```powershell
npm test
```

Current updater tests include:

- Parser behavior (block/property/enum extraction)
- Grammar patching behavior
- CLI integration behavior with temporary files

Test file location:

- `test/update-mdl-language-config.test.js`

## Project Structure

- `package.json`: Extension manifest and npm scripts
- `language-configuration.json`: Brackets, comments, and auto-closing pairs
- `syntaxes/mdl.tmLanguage.json`: TextMate grammar used for highlighting
- `scripts/update-mdl-language-config.js`: Grammar updater from validator input
- `test/update-mdl-language-config.test.js`: Updater test suite
- `CHANGELOG.md`: Version history

## Packaging For Distribution

```powershell
npx @vscode/vsce package
```

This creates a `.vsix` package in the repository root.

## Troubleshooting

- No highlighting updates after grammar changes:
  - Reload VS Code window (`Developer: Reload Window`).
  - Ensure the correct extension instance is installed (local VSIX vs published).
- Updater reports missing file:
  - Verify the full path to `MDLValidation.def`.
- Tests fail unexpectedly:
  - Reinstall dependencies with `npm install`.
  - Re-run `npm test` and inspect failing case output.

## Notes

- The repository currently has no license file; `vsce` will warn during packaging.
- See `vsc-extension-quickstart.md` for baseline VS Code extension development notes.
