import { select } from "@clack/prompts"
import chalk from "chalk"
import { colorizeAgent } from "#types/colors.js"
import type { Config } from "#types/config.js"
import { AGENT_REQUIREMENTS } from "#types/requirements.js"

export const DONE_ACTION = "__DONE__"

export async function selectAgent(
  config: Config,
  configuredAgents: string[],
): Promise<string | symbol | typeof DONE_ACTION> {
  const options = Object.keys(AGENT_REQUIREMENTS)
    .filter((agent) => !configuredAgents.includes(agent))
    .map((agent) => {
      const currentModel = config.agents?.[agent]?.model
      const label = colorizeAgent(agent)
      const hint = currentModel
        ? `Current: ${chalk.dim(currentModel)}`
        : chalk.yellow("Not configured")

      return {
        value: agent,
        label,
        hint,
      }
    })

  if (options.length === 0) {
    return DONE_ACTION
  }

  const doneOption =
    configuredAgents.length > 0
      ? [
          {
            value: DONE_ACTION,
            label: `${chalk.green("✓")} Done (save changes)`,
          },
        ]
      : []

  return select({
    message:
      configuredAgents.length > 0
        ? "Select another agent to configure (or Done to save)"
        : "Select an agent to configure",
    options: [...doneOption, ...options],
  })
}
