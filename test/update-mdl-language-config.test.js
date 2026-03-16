const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  parseValidationFile,
  updateGrammar
} = require("../scripts/update-mdl-language-config.js");

test("parseValidationFile extracts blocks, properties, and enum literals", () => {
  const sample = `
    Group MacroModule {
      allowChild = Window
      allow = Interface
      allow = _InternalOnly
      allowTags {
        title = TRANSLATEDSTRING
        status = ENUM { values = "stable,test,deprecated" }
      }
    }
    Group _HiddenGroup {
      allowChild = _InternalChild
    }
  `;

  const parsed = parseValidationFile(sample);

  assert.deepEqual(parsed.blockKeywords, ["Interface", "MacroModule", "Window"]);
  assert.deepEqual(parsed.propertyKeywords, ["allow", "allowChild", "status", "title"]);
  assert.deepEqual(parsed.enumLiterals, ["deprecated", "stable", "test"]);
});

test("updateGrammar writes generated repositories and metadata", () => {
  const grammar = {
    name: "MDL",
    patterns: [{ include: "#comments" }],
    repository: {
      comments: {
        patterns: [{ name: "comment.line.double-slash.mdl", begin: "//", end: "\\n" }]
      }
    },
    scopeName: "source.mdl"
  };

  const parsed = {
    blockKeywords: ["MacroModule", "Window"],
    propertyKeywords: ["title", "status"],
    enumLiterals: ["stable", "test"]
  };

  const updated = updateGrammar(grammar, parsed, "C:/tmp/MDLValidation.def");

  assert.ok(updated.repository.blockKeywords);
  assert.ok(updated.repository.propertyKeywords);
  assert.ok(updated.repository.enumLiterals);
  assert.equal(updated.generatedFrom.blockKeywordCount, 2);
  assert.equal(updated.generatedFrom.propertyKeywordCount, 2);
  assert.equal(updated.generatedFrom.enumLiteralCount, 2);
  assert.equal(updated.generatedFrom.source, "C:/tmp/MDLValidation.def");
  assert.equal(updated.patterns[0].include, "#comments");
  assert.equal(updated.patterns[4].include, "#directives");
});

test("CLI updates grammar file from validation source", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdl-config-test-"));
  const validationPath = path.join(tempDir, "MDLValidation.def");
  const grammarPath = path.join(tempDir, "mdl.tmLanguage.json");
  const scriptPath = path.resolve(__dirname, "..", "scripts", "update-mdl-language-config.js");

  fs.writeFileSync(
    validationPath,
    [
      "Group Window {",
      "  allowTags {",
      "    title = STRING",
      "    status = ENUM { values = \"stable,test\" }",
      "  }",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );

  fs.writeFileSync(
    grammarPath,
    JSON.stringify(
      {
        name: "MDL",
        patterns: [],
        repository: {},
        scopeName: "source.mdl"
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  execFileSync(process.execPath, [scriptPath, validationPath, grammarPath], {
    stdio: "pipe"
  });

  const updated = JSON.parse(fs.readFileSync(grammarPath, "utf8"));

  assert.equal(updated.generatedFrom.blockKeywordCount, 1);
  assert.equal(updated.generatedFrom.propertyKeywordCount, 2);
  assert.equal(updated.generatedFrom.enumLiteralCount, 2);
  assert.ok(updated.repository.blockKeywords.patterns.length > 0);
  assert.ok(updated.repository.propertyKeywords.patterns.length > 0);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
