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
    Group _colors {
      name = colors
    }
    Group _editFont {
      name = editFont
    }
    Group _style {
      name = style
    }
    Group _Control {
      allowTags {
        expandX = ENUM { values = "Auto,Yes,No" }
        expandY = ENUM { values = "Auto,Yes,No" }
      }
    }
  `;

  const parsed = parseValidationFile(sample);

  // Check block keywords
  assert(parsed.blockKeywords.includes("Interface"));
  assert(parsed.blockKeywords.includes("MacroModule"));
  assert(parsed.blockKeywords.includes("Window"));

  // Check property keywords
  assert(parsed.propertyKeywords.includes("allow"));
  assert(parsed.propertyKeywords.includes("allowChild"));
  assert(parsed.propertyKeywords.includes("status"));
  assert(parsed.propertyKeywords.includes("title"));
  // Check for missing property keywords
  assert(parsed.propertyKeywords.includes("colors"), "Should include 'colors'");
  assert(parsed.propertyKeywords.includes("editFont"), "Should include 'editFont'");
  assert(parsed.propertyKeywords.includes("expandX"), "Should include 'expandX'");
  assert(parsed.propertyKeywords.includes("expandY"), "Should include 'expandY'");
  assert(parsed.propertyKeywords.includes("style"), "Should include 'style'");

  // Check enum literals
  assert(parsed.enumLiterals.includes("deprecated"));
  assert(parsed.enumLiterals.includes("stable"));
  assert(parsed.enumLiterals.includes("test"));
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

  const commentNames = updated.repository.comments.patterns.map((p) => p.name);
  assert(commentNames.includes("comment.block.mdl"));
  assert(commentNames.includes("comment.line.double-slash.mdl"));
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
