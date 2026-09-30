import assert from "assert"
import { parsePathSegmentAtCursor } from "../../src/path-completion-item-provider"

function parse(lineWithCursor: string) {
  const cursor = lineWithCursor.indexOf("|")
  return parsePathSegmentAtCursor(lineWithCursor.replace("|", ""), cursor)
}

suite("parsePathSegmentAtCursor", () => {
  test("completes a new segment at the end of a path", () => {
    assert.deepStrictEqual(parse("/src/|"), {
      directory: "/src/",
      segmentStart: 5,
      segmentEnd: 5,
      followedBySlash: false,
    })
  })
  test("replaces the rest of an existing segment", () => {
    assert.deepStrictEqual(parse("/src/comp|onents @owner"), {
      directory: "/src/",
      segmentStart: 5,
      segmentEnd: 15,
      followedBySlash: false,
    })
  })
  test("replaces a segment in the middle of a path", () => {
    assert.deepStrictEqual(parse("  /src/co|mponents/Button.tsx @owner"), {
      directory: "/src/",
      segmentStart: 7,
      segmentEnd: 17,
      followedBySlash: true,
    })
  })
  test("includes dots and dashes in the segment", () => {
    assert.deepStrictEqual(parse("/src/my-fi|le.test.ts"), {
      directory: "/src/",
      segmentStart: 5,
      segmentEnd: 20,
      followedBySlash: false,
    })
  })
  test("ignores non-absolute patterns", () => {
    assert.strictEqual(parse("src/|"), undefined)
    assert.strictEqual(parse("*.js|"), undefined)
  })
  test("ignores the cursor outside the pattern", () => {
    assert.strictEqual(parse("/src/ @own|er"), undefined)
    assert.strictEqual(parse("# /src/|"), undefined)
    assert.strictEqual(parse("|/src/"), undefined)
  })
})
