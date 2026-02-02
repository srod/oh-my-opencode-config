#!/usr/bin/env bun
import { run } from "./cli/index.js"
import { handleError } from "./errors/handlers.js"

const verbose = process.argv.includes("--verbose")

run().catch(async (error) => {
  await handleError(error, { verbose })
})
