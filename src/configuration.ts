import vscode from "vscode"

export function getGitHubUrl(): string {
  /*
   * When using GitHub Enterprise Server, you should have a 'github-enterprise.uri'
   * configuration setting.
   *
   * This configuration option is provided by built in "GitHub Authentication" extension
   * https://github.com/microsoft/vscode/blob/ccb95fd921349023027a0df25ed291b0992b9a18/extensions/github-authentication/src/extension.ts#L10
   */
  const setting = vscode.workspace
    .getConfiguration()
    .get<string>("github-enterprise.uri")
  if (!setting) {
    return "https://github.com"
  }
  return setting
}

export type SlackMappingConfigurationItem = {
  domain: string
  channel: string
  username: string
}

export function getTeamMappingSlack(): Array<SlackMappingConfigurationItem> {
  const setting = vscode.workspace
    .getConfiguration()
    .get<Array<SlackMappingConfigurationItem>>(
      "githubCodeOwners.teamMapping.slack",
    )
  if (setting != null) {
    return setting
  }
  return (
    vscode.workspace
      .getConfiguration()
      .get<Array<SlackMappingConfigurationItem>>(
        "github-code-owners.team-mapping.slack",
      ) ?? []
  )
}

export function getLanguageServerPath(): string | null {
  const setting = vscode.workspace
    .getConfiguration()
    .get<string>(`${LANGUAGE_SERVER}.path`)
  return setting || null
}

export const FILE_COUNTS_ENABLED = "githubCodeOwners.fileCounts.enabled"

export function isFileCountsEnabled(): boolean {
  return vscode.workspace.getConfiguration().get(FILE_COUNTS_ENABLED) !== false
}

export const LANGUAGE_SERVER = "githubCodeOwners.languageServer"

export function isLanguageServerEnabled(): boolean {
  return (
    vscode.workspace.getConfiguration().get(`${LANGUAGE_SERVER}.enabled`) !==
    false
  )
}

export const FORMAT = "githubCodeOwners.format"

/** Settings for the language server, from the extension's settings. */
export type ServerSettings = {
  format: { style: "default" | "legacy"; alignmentOffset: number }
}

export function getServerSettings(): ServerSettings {
  const config = vscode.workspace.getConfiguration(FORMAT)
  const alignmentOffset = config.get("alignmentOffset")
  return {
    format: {
      style: config.get("style") === "legacy" ? "legacy" : "default",
      alignmentOffset:
        typeof alignmentOffset === "number" &&
        Number.isInteger(alignmentOffset) &&
        alignmentOffset >= 0
          ? alignmentOffset
          : 4,
    },
  }
}
