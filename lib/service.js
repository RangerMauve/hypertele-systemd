import { mkdir, chmod, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { getServiceName, getSystemdPath } from './system.js'

/**
 * Generate a systemd [Unit] section.
 */
function unitSection(serviceName) {
  return [
    '[Unit]',
    `Description=${serviceName}`,
    'After=network.target',
    '',
  ].join('\n')
}

/**
 * Generate a systemd [Service] section.
 */
function serviceSection(execStart, user) {
  const lines = [
    '[Service]',
    `ExecStart=${execStart}`,
    `User=${user}`,
    'Restart=always',
    'RestartSec=5',
    'Environment=NODE_ENV=production',
    '',
  ]
  return lines.join('\n')
}

/**
 * Generate a systemd [Install] section.
 */
function installSection() {
  return '[Install]\nWantedBy=multi-user.target\n'
}

/**
 * Build the full systemd unit file string for a hypertele server.
 *
 * @param {{
 *   name: string,
 *   port: number,
 *   seed: string,
 *   serverBin: string,
 *   user: string,
 *   private?: boolean,
 *   compress?: boolean,
 *   certSkip?: boolean,
 * }} config
 * @returns {string}
 */
export function generateServerUnit(config) {
  const { name, port, seed, serverBin, user, private: privateMode, compress, certSkip } = config

  const serviceName = getServiceName('server', name)

  // Build ExecStart arguments
  const args = [
    serverBin,
    `-l ${port}`,
    `--seed ${seed}`,
  ]

  if (privateMode) args.push('--private')
  if (compress) args.push('--compress')
  if (certSkip) args.push('--cert-skip')

  const execStart = `${process.execPath} ${args.join(' ')}`

  return (
    unitSection(serviceName) +
    serviceSection(execStart, user) +
    installSection()
  )
}

/**
 * Build the full systemd unit file string for a hypertele client.
 *
 * Uses `hypertele -p PORT -s <KEY>` by default.
 * If `serverSeed` is provided instead of `serverPeer`, uses `--private -s <SEED>`.
 *
 * @param {{
 *   name: string,
 *   port: number,
 *   user: string,
 *   hyperteleBin: string,
 *   serverPeer?: string,
 *   serverSeed?: string,
 *   compress?: boolean,
 *   address?: string,
 * }} config
 * @returns {string}
 */
export function generateClientUnit(config) {
  const {
    name,
    port,
    user,
    hyperteleBin,
    serverPeer,
    serverSeed,
    compress,
    address,
  } = config

  const serviceName = getServiceName('client', name)

  const isPrivate = !!serverSeed && !serverPeer
  const key = serverSeed ?? serverPeer

  const args = [
    hyperteleBin,
    `-p ${port}`,
    `-s ${key}`,
  ]

  if (isPrivate) args.push('--private')
  if (compress) args.push('--compress')
  if (address) args.push(`--address ${address}`)

  const execStart = `${process.execPath} ${args.join(' ')}`

  return (
    unitSection(serviceName) +
    serviceSection(execStart, user) +
    installSection()
  )
}

/**
 * Generate a systemd unit file string for either server or client.
 *
 * @param {{
 *   type: 'server' | 'client',
 *   name: string,
 *   port: number,
 *   user: string,
 *   serverBin?: string,
 *   hyperteleBin?: string,
 *   seed?: string,
 *   serverPeer?: string,
 *   serverSeed?: string,
 *   private?: boolean,
 *   compress?: boolean,
 *   certSkip?: boolean,
 *   address?: string,
 * }} config
 * @returns {string}
 */
export function generate(config) {
  if (config.type === 'server') {
    return generateServerUnit(config)
  }
  return generateClientUnit(config)
}

/**
 * Write the generated unit content to disk and chmod 644.
 *
 * @param {{ content: string, serviceName: string, isUser: boolean }} opts
 * @returns {Promise<string>} absolute path written
 */
export async function writeService({ content, serviceName, isUser }) {
  const targetDir = getSystemdPath({ user: isUser })
  const targetPath = `${targetDir}/${serviceName}`

  // Ensure directory exists (especially for user services)
  await mkdir(dirname(targetPath), { recursive: true })

  await writeFile(targetPath, content, 'utf8')
  await chmod(targetPath, 0o644)

  return targetPath
}
