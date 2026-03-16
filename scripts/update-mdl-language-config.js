#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_GRAMMAR_PATH = path.resolve(__dirname, "..", "syntaxes", "mdl.tmLanguage.json");

function printUsage() {
  console.log("Usage: node scripts/update-mdl-language-config.js <path-to-MDLValidation.def> [path-to-grammar-json]");
  console.log("Example: node scripts/update-mdl-language-config.js C:/path/to/MDLValidation.def");
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function isIdentifier(token) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
}

function chunkWords(words, maxPatternLength) {
  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const word of words) {
    const escaped = escapeRegex(word);
    const nextLength = currentLength === 0 ? escaped.length : currentLength + 1 + escaped.length;

    if (nextLength > maxPatternLength && current.length > 0) {
      chunks.push(current);
      current = [word];
      currentLength = escaped.length;
    } else {
      current.push(word);
      currentLength = nextLength;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function toPatterns(words, name, prefix, suffix) {
  const result = [];
  const chunks = chunkWords(words, 1600);

  for (const chunk of chunks) {
    result.push({
      name,
      match: `${prefix}(?:${chunk.map(escapeRegex).join("|")})${suffix}`
    });
  }

  return result;
}

function stripLineComment(line) {
  const idx = line.indexOf("//");
  return idx >= 0 ? line.slice(0, idx) : line;
}

function collectEnumLiterals(line, enumLiterals) {
  const regex = /\bvalues\s*=\s*"([^"]*)"/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    const items = match[1].split(",");
    for (const item of items) {
      const normalized = item.trim();
      if (isIdentifier(normalized) && normalized.length > 1) {
        enumLiterals.add(normalized);
      }
    }
  }
}

function parseValidationFile(content) {
  const blockKeywords = new Set();
  const propertyKeywords = new Set();
  const enumLiterals = new Set();

  const lines = content.split(/\r?\n/);
  let braceDepth = 0;
  const allowTagsDepths = [];

  for (const rawLine of lines) {
    const line = stripLineComment(rawLine);

    collectEnumLiterals(line, enumLiterals);

    const groupMatch = line.match(/^\s*Group\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (groupMatch && !groupMatch[1].startsWith("_")) {
      blockKeywords.add(groupMatch[1]);
    }

    const nameAssignMatch = line.match(/^\s*name\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (nameAssignMatch) {
      const namedGroup = nameAssignMatch[1];
      propertyKeywords.add(namedGroup);
      if (!namedGroup.startsWith("_")) {
        blockKeywords.add(namedGroup);
      }
    }

    const allowChildMatch = line.match(/^\s*allowChild\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (allowChildMatch && !allowChildMatch[1].startsWith("_")) {
      blockKeywords.add(allowChildMatch[1]);
    }

    const allowMatch = line.match(/^\s*allow\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (allowMatch && !allowMatch[1].startsWith("_")) {
      blockKeywords.add(allowMatch[1]);
    }

    const assignmentMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (assignmentMatch) {
      propertyKeywords.add(assignmentMatch[1]);
    }

    const isInAllowTagsBlock = allowTagsDepths.length > 0;
    if (isInAllowTagsBlock) {
      const tagDefinitionMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\b\s*(?:=|[A-Za-z_][A-Za-z0-9_]*)/);
      if (tagDefinitionMatch) {
        propertyKeywords.add(tagDefinitionMatch[1]);
      }
    }

    if (/^\s*allowTags(?:InChildren)?(?:\s+[A-Za-z_][A-Za-z0-9_]*)?\s*\{/.test(line)) {
      allowTagsDepths.push(braceDepth + 1);
    }

    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    const nextDepth = braceDepth + openBraces - closeBraces;

    while (allowTagsDepths.length > 0 && nextDepth < allowTagsDepths[allowTagsDepths.length - 1]) {
      allowTagsDepths.pop();
    }

    braceDepth = nextDepth;
  }

  const sortedBlocks = Array.from(blockKeywords).sort((a, b) => a.localeCompare(b));
  const sortedProperties = Array.from(propertyKeywords).sort((a, b) => a.localeCompare(b));
  const sortedEnums = Array.from(enumLiterals).sort((a, b) => a.localeCompare(b));

  return {
    blockKeywords: sortedBlocks,
    propertyKeywords: sortedProperties,
    enumLiterals: sortedEnums
  };
}

function updateGrammar(grammar, parsed, sourcePath) {
  if (!grammar.repository) {
    grammar.repository = {};
  }

  grammar.repository.comments = {
    patterns: [
      {
        name: "comment.block.mdl",
        begin: "/\\*",
        beginCaptures: {
          "0": { name: "punctuation.definition.comment.begin.mdl" }
        },
        end: "\\*/",
        endCaptures: {
          "0": { name: "punctuation.definition.comment.end.mdl" }
        }
      },
      {
        name: "comment.line.double-slash.mdl",
        begin: "//",
        beginCaptures: {
          "0": { name: "punctuation.definition.comment.mdl" }
        },
        end: "\\n"
      }
    ]
  };

  grammar.repository.directives = {
    patterns: [
      {
        name: "keyword.control.directive.mdl",
        match: "^\\s*#(?:ifset|ifnset|include)\\b"
      }
    ]
  };

  grammar.repository.keywords = {
    patterns: [
      {
        name: "keyword.control.mdl",
        match: "(?i)\\b(true|false|on|off|yes|no)\\b"
      }
    ]
  };

  grammar.repository.blockKeywords = {
    patterns: toPatterns(
      parsed.blockKeywords,
      "entity.name.type.block.mdl",
      "^\\s*",
      "\\b"
    )
  };

  grammar.repository.propertyKeywords = {
    patterns: toPatterns(
      parsed.propertyKeywords,
      "support.type.property-name.mdl",
      "\\b",
      "\\b(?=\\s*=)"
    )
  };

  grammar.repository.enumLiterals = {
    patterns: toPatterns(
      parsed.enumLiterals,
      "constant.language.enum.mdl",
      "\\b",
      "\\b"
    )
  };

  grammar.patterns = [
    { include: "#comments" },
    { include: "#strings" },
    { include: "#starstrings" },
    { include: "#atstrings" },
    { include: "#directives" },
    { include: "#blockKeywords" },
    { include: "#propertyKeywords" },
    { include: "#enumLiterals" },
    { include: "#keywords" }
  ];

  grammar.generatedFrom = {
    source: sourcePath,
    generatedAt: new Date().toISOString(),
    blockKeywordCount: parsed.blockKeywords.length,
    propertyKeywordCount: parsed.propertyKeywords.length,
    enumLiteralCount: parsed.enumLiterals.length
  };

  return grammar;
}

function main() {
  const inputPath = process.argv[2];
  const grammarPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_GRAMMAR_PATH;

  if (!inputPath) {
    printUsage();
    process.exit(1);
  }

  const resolvedInputPath = path.resolve(inputPath);

  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`MDLValidation file not found: ${resolvedInputPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(grammarPath)) {
    console.error(`Grammar file not found: ${grammarPath}`);
    process.exit(1);
  }

  const validationContent = fs.readFileSync(resolvedInputPath, "utf8");
  const grammarContent = fs.readFileSync(grammarPath, "utf8");

  let grammarJson;
  try {
    grammarJson = JSON.parse(grammarContent);
  } catch (error) {
    console.error(`Cannot parse grammar JSON at ${grammarPath}: ${error.message}`);
    process.exit(1);
  }

  const parsed = parseValidationFile(validationContent);
  const updated = updateGrammar(grammarJson, parsed, resolvedInputPath);

  fs.writeFileSync(grammarPath, JSON.stringify(updated, null, 2) + "\n", "utf8");

  console.log(`Updated grammar: ${grammarPath}`);
  console.log(`Block keywords: ${parsed.blockKeywords.length}`);
  console.log(`Property keywords: ${parsed.propertyKeywords.length}`);
  console.log(`Enum literals: ${parsed.enumLiterals.length}`);
}

module.exports = {
  parseValidationFile,
  updateGrammar,
  toPatterns,
  stripLineComment,
  collectEnumLiterals,
  escapeRegex,
  isIdentifier
};

if (require.main === module) {
  main();
}
