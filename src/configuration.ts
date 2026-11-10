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
const DEPRECATED_ALIGNMENT_OFFSETS = [
  "githubCodeOwners.format.alignmentOffset",
  "github-code-owners.format.alignment-offset",
]

/** Settings for the language server, from the extension's settings. */
export type ServerSettings = {
  format: { align: "group" | "file"; spacing: number }
}

/** The setting's value, if the user set it anywhere. */
function userValue(key: string): unknown {
  const value = vscode.workspace.getConfiguration().inspect(key)
  return (
    value?.workspaceFolderValue ?? value?.workspaceValue ?? value?.globalValue
  )
}

function isSpacing(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
}

function getSpacing(): number {
  const spacing = userValue(`${FORMAT}.spacing`)
  if (isSpacing(spacing)) {
    return spacing
  }
  // The deprecated offset was one less than the spaces it made.
  for (const key of DEPRECATED_ALIGNMENT_OFFSETS) {
    const offset = userValue(key)
    if (isSpacing(offset)) {
      return offset + 1
    }
  }
  return 1
}

export function getServerSettings(): ServerSettings {
  const align = vscode.workspace.getConfiguration(FORMAT).get("align")
  return {
    format: {
      align: align === "file" ? "file" : "group",
      spacing: getSpacing(),
    },
  }
}

export function affectsServerSettings(
  e: vscode.ConfigurationChangeEvent,
): boolean {
  return (
    e.affectsConfiguration(FORMAT) ||
    DEPRECATED_ALIGNMENT_OFFSETS.some((key) => e.affectsConfiguration(key))
  )
}
