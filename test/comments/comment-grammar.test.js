const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function findPatternByName(patterns, name) {
  return patterns.find((pattern) => pattern.name === name);
}

function collectBlockComments(text, beginRegex, endRegex) {
  const spans = [];
  let cursor = 0;

  while (cursor < text.length) {
    beginRegex.lastIndex = cursor;
    const begin = beginRegex.exec(text);
    if (!begin) {
      break;
    }

    const from = begin.index;
    cursor = from + begin[0].length;

    endRegex.lastIndex = cursor;
    const end = endRegex.exec(text);
    assert.ok(end, "Unterminated block comment in fixture");

    const to = end.index + end[0].length;
    spans.push(text.slice(from, to));
    cursor = to;
  }

  return spans;
}

test("MDL grammar defines both block and line comment patterns", () => {
  const grammarPath = path.resolve(__dirname, "..", "..", "syntaxes", "mdl.tmLanguage.json");
  const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf8"));

  assert.ok(grammar.repository?.comments?.patterns, "Missing repository.comments.patterns");

  const patterns = grammar.repository.comments.patterns;
  const block = findPatternByName(patterns, "comment.block.mdl");
  const line = findPatternByName(patterns, "comment.line.double-slash.mdl");

  assert.ok(block, "Missing comment.block.mdl");
  assert.ok(line, "Missing comment.line.double-slash.mdl");
  assert.equal(block.begin, "/\\*");
  assert.equal(block.end, "\\*/");
  assert.equal(line.begin, "//");
});

test("MDL block-comment regex handles nested-looking fixture content", () => {
  const grammarPath = path.resolve(__dirname, "..", "..", "syntaxes", "mdl.tmLanguage.json");
  const fixturePath = path.resolve(__dirname, "fixtures.mdl");

  const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
  const fixture = fs.readFileSync(fixturePath, "utf8");

  const patterns = grammar.repository.comments.patterns;
  const block = findPatternByName(patterns, "comment.block.mdl");

  const beginRegex = new RegExp(block.begin, "g");
  const endRegex = new RegExp(block.end, "g");
  const blocks = collectBlockComments(fixture, beginRegex, endRegex);

  assert.equal(blocks.length, 2, "Fixture should contain exactly two block comments");
  assert.match(blocks[0], /contains \/\/ line-comment-looking text/);
  assert.match(blocks[1], /nested-looking opener: \/\*/);
});
