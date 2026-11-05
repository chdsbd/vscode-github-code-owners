import vscode from "vscode"

/**
 * The pattern on a CODEOWNERS line, ending at the first unescaped whitespace
 * or `#`. Null for blank lines and comments.
 */
export function parsePattern(
  line: string,
): { pattern: string; start: number } | null {
  const start = line.search(/\S/)
  if (start === -1) {
    return null
  }
  let end = start
  while (end < line.length && !/[\s#]/.test(line.charAt(end))) {
    end += line.charAt(end) === "\\" ? 2 : 1
  }
  end = Math.min(end, line.length)
  return end === start ? null : { pattern: line.slice(start, end), start }
}

function invalidReason(pattern: string): string | null {
  const escapes = pattern.match(/\\./g) ?? []
  if (escapes.some((escape) => !" \t#[]\\".includes(escape.charAt(1)))) {
    return "A `\\` can only escape a space, a tab, `#`, `[`, `]` or `\\`."
  }
  if (/[[\]]/.test(pattern.replace(/\\./g, ""))) {
    return "`[` and `]` must be escaped as `\\[` and `\\]`."
  }
  if (pattern.includes("***")) {
    return "A pattern can't have three or more `*`s in a row."
  }
  return null
}

function neverMatchesReason(pattern: string): string | null {
  if (/^\/*$/.test(dropTrailingEscape(pattern))) {
    return "The pattern has no path to match."
  }
  const escapes = pattern.match(/\\./g) ?? []
  const opening = escapes.filter((escape) => escape === "\\[").length
  const closing = escapes.filter((escape) => escape === "\\]").length
  if (opening !== closing) {
    return "It has a different number of `\\[`s and `\\]`s."
  }
  if (pattern.split("/").some((part) => part === "." || part === "..")) {
    return "Paths in git never have `.` or `..` segments."
  }
  if (pattern.startsWith("\\[") && !pattern.includes("/")) {
    return "It starts with `\\[` and has no slash. Start it with `**/` instead."
  }
  return null
}

/** Drops a `\` at the end of a pattern, which escapes nothing. */
function dropTrailingEscape(pattern: string): string {
  return pattern.replace(/\\.?/g, (m) => (m === "\\" ? "" : m))
}

function describePath(path: string): string {
  const anchored = path.replace(/\/$/, "").includes("/")
  const relative = path.replace(/^\//, "")
  // `/**` and `/**/` at the end both mean everything in the directory.
  const body = relative
    .replace(/^(\*\*\/)+/, "")
    .replace(/(^|\/)\*\*\/?$/, "$1")
  const anyDepth = !anchored || relative.startsWith("**/")

  if (body === "" || (body === "*" && anyDepth)) {
    return "Matches every file."
  }
  if (body === "*") {
    return "Matches files at the root of the repository, but not in subdirectories."
  }

  const where = anyDepth ? "at any depth" : "starting at the repository root"
  const noun = (name: string) =>
    anyDepth && !name.replace(/\/$/, "").includes("/") ? "name" : "path"

  if (body.endsWith("/*")) {
    const directory = body.slice(0, -"/*".length)
    return `Matches files directly in directories with this ${noun(
      directory,
    )} ${where}, but not in their subdirectories.`
  }
  if (body.endsWith("/")) {
    return `Matches everything in directories with this ${noun(body)} ${where}.`
  }
  return `Matches files and directories with this ${noun(
    body,
  )} ${where}, including everything in those directories.`
}

/** What a pattern matches on GitHub, following gh-codeowners' SPECIFICATION.md. */
export function describePattern(pattern: string): string {
  const invalid = invalidReason(pattern)
  if (invalid != null) {
    return `Invalid: GitHub skips this line. ${invalid}`
  }
  // `!` is an ordinary character in a pattern with a slash.
  const negated = pattern.startsWith("!") && !pattern.includes("/")
  const name = negated ? pattern.slice(1) : pattern
  const neverMatches = neverMatchesReason(name)
  if (neverMatches != null) {
    return `Never matches: GitHub accepts this line, but it owns nothing. ${neverMatches}`
  }

  const path = dropTrailingEscape(name)
  const notes = [negated ? describeNegated(path) : describePath(path)]
  if (path.replace(/\\./g, "").includes("?")) {
    notes.push("`?` matches one byte of the UTF-8 path, not one character.")
  }
  return notes.join(" ")
}

function describeNegated(name: string): string {
  const matches = /^\*+$/.test(name)
    ? "Matches every file."
    : "Matches files with this name at any depth, but not directories."
  return `${matches} \`!\` doesn't negate on GitHub.`
}

export class CodeownersHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const parsed = parsePattern(document.lineAt(position.line).text)
    if (parsed == null) {
      return null
    }
    const { pattern, start } = parsed
    const range = new vscode.Range(
      new vscode.Position(position.line, start),
      new vscode.Position(position.line, start + pattern.length),
    )
    if (!range.contains(position)) {
      return null
    }
    const code = new vscode.MarkdownString()
    code.appendCodeblock(pattern)
    return { range, contents: [code, describePattern(pattern)] }
  }
}
