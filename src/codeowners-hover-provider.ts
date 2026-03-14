import vscode from "vscode"

export class CodeownersHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const line = document.lineAt(position.line)
    const m = line.text.match(/^\s*(\S+)/)?.[1]
    if (m == null) {
      return { contents: [] }
    }
    const idx = line.text.indexOf(m)

    const x = new vscode.MarkdownString()
    x.appendCodeblock(m)

    const hasLeadingSlash = m.startsWith("/")
    const hasTrailingSlash = m.endsWith("/")
    const hasTrailingGlob = m.endsWith("/*")

    const range = new vscode.Range(
      new vscode.Position(position.line, idx),
      new vscode.Position(position.line, idx + m.length),
    )
    if (!range.contains(position)) {
      return { contents: [] }
    }

    const lines: string[] = []

    if (hasLeadingSlash) {
      lines.push("**Anchored to repo root** — only matches at the top level")
    } else {
      lines.push(
        "**Matches at any depth** — applies to this path anywhere in the repository)",
      )
    }

    if (hasTrailingGlob) {
      lines.push(
        "**Shallow match** — covers only direct children, not subdirectories",
      )
    } else if (hasTrailingSlash) {
      lines.push(
        "**Recursive directory match** — covers the directory and all its contents at any depth",
      )
    }

    return {
      range,
      contents: [x, lines.join("\n\n")],
    }
  }
}
