#!/usr/bin/env node

import { createProgram } from '../src/cli.js'

// Create and parse with commander (async for command actions)
const program = createProgram()

program.parseAsync(process.argv).catch((err) => {
  // commander with exitOverride() throws on parse errors; handle gracefully
  if (err.exitCode) {
    process.exitCode = err.exitCode
  } else {
    console.error(err.message)
    process.exitCode = 1
  }
})
