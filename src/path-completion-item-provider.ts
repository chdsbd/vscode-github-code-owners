import vscode from "vscode"
import path from "path"
import fs from "fs"
import child_process from "child_process"
import util from "util"
const execFile = util.promisify(child_process.execFile)

/**
 * Locate the path segment under the cursor for an absolute pattern like
 * `/src/comp|onents/foo.ts`.
 *
 * Returns the directory to list (`/src/`) along with the start and end
 * character offsets of the segment being completed (`components`), so the
 * completion replaces the segment instead of being inserted into it.
 */
export function parsePathSegmentAtCursor(
  lineText: string,
  cursorCharacter: number,
):
  | {
      directory: string
      segmentStart: number
      segmentEnd: number
      followedBySlash: boolean
    }
  | undefined {
  const patternStart = lineText.search(/\S/)
  if (patternStart === -1 || lineText[patternStart] !== "/") {
    return undefined
  }
  const beforeCursor = lineText.slice(patternStart, cursorCharacter)
  // cursor must be inside the pattern (the first whitespace-delimited token).
  if (beforeCursor.length === 0 || /[\s#]/.test(beforeCursor)) {
    return undefined
  }
  const lastSlash = beforeCursor.lastIndexOf("/")
  const directory = beforeCursor.slice(0, lastSlash + 1)
  const segmentStart = patternStart + lastSlash + 1
  const rest = lineText.slice(cursorCharacter)
  const segmentLength = rest.search(/[\s#/]|$/)
  const segmentEnd = cursorCharacter + segmentLength
  return {
    directory,
    segmentStart,
    segmentEnd,
    followedBySlash: lineText[segmentEnd] === "/",
  }
}

function findRepositoryRoot(startPath: string) {
  let directory = startPath
  while (true) {
    // parent folder will have git directory
    const newPath = path.resolve(directory, ".git/index")
    if (fs.existsSync(newPath)) {
      return directory
    }
    const newParentDir = path.dirname(directory)
    if (newParentDir === directory) {
      return null
    }
    directory = newParentDir
  }
}

async function findIgnoredPaths(
  repositoryRoot: string,
  paths: string[],
): Promise<Set<string>> {
  // ignore git directory explicitly because git check-ignore won't.
  const ignoredPaths = new Set<string>([path.join(repositoryRoot, ".git")])
  if (paths.length === 0) {
    return ignoredPaths
  }
  const stdout = await execFile("git", ["check-ignore", "--", ...paths], {
    cwd: repositoryRoot,
  }).then(
    (result) => result.stdout,
    // git-check-ignore exits 1 when there are no matching ignored files, so
    // we'll get an exception in our common flow.
    (e: { stdout?: string }) => e.stdout ?? "",
  )
  for (const ignoredPath of stdout.split("\n")) {
    if (ignoredPath !== "") {
      ignoredPaths.add(ignoredPath)
    }
  }
  return ignoredPaths
}

export class PathCompletionItemProvider
  implements vscode.CompletionItemProvider
{
  outputChannel: vscode.OutputChannel
  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
  }
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[]> {
    const line = document.lineAt(position.line)
    const segment = parsePathSegmentAtCursor(line.text, position.character)
    if (segment == null) {
      return []
    }

    const repositoryRoot = findRepositoryRoot(document.uri.fsPath)
    if (repositoryRoot == null) {
      this.outputChannel.appendLine("Could not find repository root from file")
      return []
    }

    const directoryPath = path.join(repositoryRoot, segment.directory)
    const files = await fs.promises
      .readdir(directoryPath, { withFileTypes: true })
      .catch(() => null)
    if (files == null) {
      return []
    }

    const ignoredPaths = await findIgnoredPaths(
      repositoryRoot,
      files.map((x) => path.join(directoryPath, x.name)),
    )

    // Replace the whole segment under the cursor so selecting a completion
    // updates an existing path rather than inserting into the middle of it.
    const range = new vscode.Range(
      position.line,
      segment.segmentStart,
      position.line,
      segment.segmentEnd,
    )

    return files
      .filter((x) => !ignoredPaths.has(path.join(directoryPath, x.name)))
      .map((x): vscode.CompletionItem => {
        const isDirectory = x.isDirectory()
        const item = new vscode.CompletionItem(
          x.name,
          isDirectory
            ? vscode.CompletionItemKind.Folder
            : vscode.CompletionItemKind.File,
        )
        item.range = range
        item.sortText = `${isDirectory ? "a" : "b"}:${x.name}`
        if (isDirectory && !segment.followedBySlash) {
          // add the trailing slash and keep completing into the directory.
          item.insertText = `${x.name}/`
          item.command = {
            title: "Trigger suggest",
            command: "editor.action.triggerSuggest",
          }
        }
        return item
      })
  }
}
