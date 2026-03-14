import vscode from "vscode"
import { OwnershipEngine } from "@snyk/github-codeowners/dist/lib/ownership"

function updateDiagnostics(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
): void {
  if (document.languageId !== "codeowners") {
    return
  }

  const engine = OwnershipEngine.FromCodeownersFile(document.uri.fsPath)

  const diagnostics = engine.errors.map((err) => {
    const line = document.lineAt(err.lineno)
    return new vscode.Diagnostic(line.range, err.message, vscode.DiagnosticSeverity.Error)
  })

  collection.set(document.uri, diagnostics)
}

export function registerCodeownersDiagnostics(
  context: vscode.ExtensionContext,
): void {
  const collection = vscode.languages.createDiagnosticCollection("codeowners")
  context.subscriptions.push(collection)

  vscode.workspace.textDocuments.forEach((doc) =>
    updateDiagnostics(doc, collection),
  )

  vscode.workspace.onDidOpenTextDocument(
    (doc) => updateDiagnostics(doc, collection),
    null,
    context.subscriptions,
  )

  vscode.workspace.onDidChangeTextDocument(
    (e) => updateDiagnostics(e.document, collection),
    null,
    context.subscriptions,
  )

  vscode.workspace.onDidCloseTextDocument(
    (doc) => collection.delete(doc.uri),
    null,
    context.subscriptions,
  )
}
