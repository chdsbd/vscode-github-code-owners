import assert from "assert"
import vscode from "vscode"
import {
  CodeownersHoverProvider,
  describePattern,
  parsePattern,
} from "../../src/codeowners-hover-provider"

const EVERY_FILE = "Matches every file."
const NAME_ANY_DEPTH =
  "Matches files and directories with this name at any depth, including everything in those directories."
const PATH_ANY_DEPTH =
  "Matches files and directories with this path at any depth, including everything in those directories."
const PATH_FROM_ROOT =
  "Matches files and directories with this path starting at the repository root, including everything in those directories."
const DIRECTORY_NAME_ANY_DEPTH =
  "Matches everything in directories with this name at any depth."
const DIRECTORY_FROM_ROOT =
  "Matches everything in directories with this path starting at the repository root."
const NO_SUBDIRECTORIES_FROM_ROOT =
  "Matches files directly in directories with this path starting at the repository root, but not in their subdirectories."
const NEGATED_NAME =
  "Matches files with this name at any depth, but not directories. `!` doesn't negate on GitHub."

suite("describePattern", () => {
  const cases: [string, string][] = [
    ["*", EVERY_FILE],
    ["**", EVERY_FILE],
    ["**/", EVERY_FILE],
    ["/**", EVERY_FILE],
    ["/**/", EVERY_FILE],
    ["**/*", EVERY_FILE],
    [
      "/*",
      "Matches files at the root of the repository, but not in subdirectories.",
    ],
    ["foo", NAME_ANY_DEPTH],
    ["*.js", NAME_ANY_DEPTH],
    ["**/logs", NAME_ANY_DEPTH],
    ["My\\ Docs", NAME_ANY_DEPTH],
    ["**/a/b", PATH_ANY_DEPTH],
    ["/foo", PATH_FROM_ROOT],
    ["a/b", PATH_FROM_ROOT],
    ["/src/*.js", PATH_FROM_ROOT],
    ["a/**/b", PATH_FROM_ROOT],
    ["foo/", DIRECTORY_NAME_ANY_DEPTH],
    ["*/", DIRECTORY_NAME_ANY_DEPTH],
    ["**/logs/", DIRECTORY_NAME_ANY_DEPTH],
    ["**/foo/**", DIRECTORY_NAME_ANY_DEPTH],
    ["/foo/", DIRECTORY_FROM_ROOT],
    ["a/b/", DIRECTORY_FROM_ROOT],
    ["docs/**", DIRECTORY_FROM_ROOT],
    ["docs/**/", DIRECTORY_FROM_ROOT],
    ["docs/*/", DIRECTORY_FROM_ROOT],
    ["docs/*", NO_SUBDIRECTORIES_FROM_ROOT],
    ["/docs/*", NO_SUBDIRECTORIES_FROM_ROOT],
    [
      "**/foo/*",
      "Matches files directly in directories with this name at any depth, but not in their subdirectories.",
    ],
    // `!` without a slash matches file names, and with one it's ordinary.
    ["!foo", NEGATED_NAME],
    ["!*.js", NEGATED_NAME],
    ["!*", `${EVERY_FILE} \`!\` doesn't negate on GitHub.`],
    ["!a/", DIRECTORY_NAME_ANY_DEPTH],
    ["!a/b", PATH_FROM_ROOT],
    // A trailing `\` is dropped.
    ["a\\", NAME_ANY_DEPTH],
    ["/a\\", PATH_FROM_ROOT],
    [
      "?.txt",
      `${NAME_ANY_DEPTH} \`?\` matches one byte of the UTF-8 path, not one character.`,
    ],
  ]
  for (const [pattern, description] of cases) {
    test(pattern, () => {
      assert.strictEqual(describePattern(pattern), description)
    })
  }

  const invalid = ["/tmp/***", "/app/[id]/", "\\*.bak", "a]"]
  for (const pattern of invalid) {
    test(`${pattern} is invalid`, () => {
      assert.match(describePattern(pattern), /^Invalid: GitHub skips this line/)
    })
  }

  const neverMatch = [
    "/",
    "//",
    "!",
    "./src/",
    "a/../b",
    "notes\\[1",
    "\\[draft\\]*",
    "!\\[draft\\]",
  ]
  for (const pattern of neverMatch) {
    test(`${pattern} never matches`, () => {
      assert.match(describePattern(pattern), /^Never matches:/)
    })
  }

  test("escaped brackets that pair up are valid", () => {
    assert.strictEqual(describePattern("/app/\\[id\\]/"), DIRECTORY_FROM_ROOT)
    assert.strictEqual(describePattern("**/\\[draft\\]*"), NAME_ANY_DEPTH)
  })
})

suite("parsePattern", () => {
  test("finds the pattern and where it starts", () => {
    assert.deepStrictEqual(parsePattern("  /docs/ @acme/docs"), {
      pattern: "/docs/",
      start: 2,
    })
  })

  test("keeps escaped spaces and `#`s", () => {
    assert.strictEqual(parsePattern("My\\ Docs/ @a")?.pattern, "My\\ Docs/")
    assert.strictEqual(parsePattern("/src/C\\#/ @a")?.pattern, "/src/C\\#/")
  })

  test("ends the pattern at an unescaped `#`", () => {
    assert.strictEqual(parsePattern("/src/C#/ @a")?.pattern, "/src/C")
  })

  test("keeps a trailing `\\`", () => {
    assert.strictEqual(parsePattern("a\\")?.pattern, "a\\")
  })

  test("finds nothing on blank lines and comments", () => {
    assert.strictEqual(parsePattern(""), null)
    assert.strictEqual(parsePattern("   "), null)
    assert.strictEqual(parsePattern("# /docs/ @acme/docs"), null)
    assert.strictEqual(parsePattern("  #/docs/"), null)
  })
})

suite("CodeownersHoverProvider", () => {
  async function hover(content: string, line: number, character: number) {
    const document = await vscode.workspace.openTextDocument({ content })
    return new CodeownersHoverProvider().provideHover(
      document,
      new vscode.Position(line, character),
    )
  }

  test("describes the pattern under the cursor", async () => {
    const result = await hover("  docs/* @acme/docs", 0, 3)
    assert.strictEqual(result?.contents[1], NO_SUBDIRECTORIES_FROM_ROOT)
    assert.deepStrictEqual(result?.range, new vscode.Range(0, 2, 0, 8))
  })

  test("shows nothing past the pattern", async () => {
    assert.strictEqual(await hover("/docs/ @acme/docs", 0, 10), null)
    assert.strictEqual(await hover("/src/C#/ @acme/docs", 0, 7), null)
  })

  test("shows nothing on comments", async () => {
    assert.strictEqual(await hover("# /docs/ @acme/docs", 0, 3), null)
  })
})
