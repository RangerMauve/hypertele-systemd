import { execSync } from 'node:child_process'

/**
 * Find the absolute path to the hypertele CLI on PATH via `which`.
 * Throws if not found.
 */
function findHyperteleBin() {
  try {
    return execSync('which hypertele', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
  } catch {
    throw new Error(
      'hypertele not found on PATH. Install it globally with: npm install -g hypertele'
    )
  }
}

/**
 * Find the hypertele server entry point.
 * hypertele installs `server.js` next to its own bin, or we can resolve
 * from the hypertele package directory.
 */
function findServerBin() {
  const hypertelePath = findHyperteleBin()
  // hypertele bin is typically a symlink or wrapper; server.js lives in the package dir.
  // Try `which hypertele-server` first (some versions ship a separate bin).
  try {
    return (
      execSync('which hypertele-server', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        .trim() ||
      resolveHyperteleServer(hypertelePath)
    )
  } catch {
    return resolveHyperteleServer(hypertelePath)
  }
}

function resolveHyperteleServer(_hyperteleBinPath) {
  // Resolve package dir from hypertele bin path
  // Try running `hypertele --print-path` style heuristic:
  // The bin is typically in <prefix>/bin/hypertele, so <prefix>/lib/node_modules/hypertele/server.js
  // Alternatively require resolve:
  // We use a simple approach: find the hypertele package via node
  try {
    // This runs a small inline node script to require.resolve hypertele
    return execSync(
      `'${process.execPath}' -e "console.log(require.resolve('hypertele/server.js'))"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim()
  } catch {
    throw new Error(
      'Could not locate hypertele/server.js. Ensure hypertele is globally installed.'
    )
  }
}

/**
 * Find all required binaries.
 * @returns {{ node: string, hypertele: string, hyperteleServer: string }}
 */
export function findBinaries() {
  return {
    node: process.execPath,
    hypertele: findHyperteleBin(),
    hyperteleServer: findServerBin(),
  }
}
