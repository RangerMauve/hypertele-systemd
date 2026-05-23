import os from 'node:os'

/**
 * Return the systemd directory to write .service files into.
 * @param {{ user?: boolean }} opts
 */
export function getSystemdPath({ user = false } = {}) {
  if (user) return `${os.homedir()}/.config/systemd/user`
  return '/etc/systemd/system'
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
