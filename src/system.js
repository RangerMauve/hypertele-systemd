import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const runExecFile = promisify(execFile)

/**
 * Return the systemd directory to write .service files into.
 * @param {{ user?: boolean }} opts
 */
export function getSystemdPath({ user = false } = {}) {
  if (user) return `${os.homedir()}/.config/systemd/user`
  return '/etc/systemd/system'
}

/**
 * Run a systemctl command. Returns stdout on success, throws on failure.
 * @param {string[]} args - command-line args after "systemctl"
 * @param {boolean} [user=false] - use --user flag
 * @returns {Promise<string>}
 */
export async function runSystemctl(args, user = false) {
  const fullArgs = user
    ? ['--user', ...args]
    : args
  try {
    const { stdout } = await runExecFile('systemctl', fullArgs, {
      windowsHide: true,
    })
    return stdout
  } catch (err) {
    // Re-throw with a clearer message
    throw new Error(`systemctl ${fullArgs.join(' ')} failed: ${err.message}`)
  }
}

/**
 * Build a systemd service file name: ``hypertele-<name>-<type>.service``
 * @param {'server' | 'client'} type
 * @param {string} name
 */
export function getServiceName(type, name) {
  return `hypertele-${name}-${type}.service`
}

/**
 * Return the daemon-reload command string for the user to run.
 * @param {boolean} [user=false]
 */
export function getReloadCommand(user = false) {
  return user ? 'systemctl --user daemon-reload' : 'sudo systemctl daemon-reload'
}

/**
 * Return the enable+start command string.
 * @param {boolean} user
 * @param {string} serviceName
 */
export function getStartCommand(user, serviceName) {
  return user
    ? `systemctl --user enable --now ${serviceName}`
    : `sudo systemctl enable --now ${serviceName}`
}

/**
 * Return the journalctl command string for logs of the service.
 * @param {boolean} user
 * @param {string} serviceName
 */
export function getJournalCommand(user, serviceName) {
  return user
    ? `journalctl --user -u ${serviceName} -f`
    : `sudo journalctl -u ${serviceName} -f`
}
