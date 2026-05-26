import { Command } from 'commander'
import HyperDHT from 'hyperdht'
import { generateSeed } from './generate-seed.js'
import { findBinaries } from './find-hypertele.js'
import { generate, writeService } from './service.js'
import {
  getServiceName,
  runSystemctl,
  getReloadCommand,
  getStartCommand,
  getJournalCommand,
} from './system.js'
import { log, logSuccess, logError } from './output.js'
import {
  validateServiceName,
  validateSeed,
  validatePubKey,
  validatePort,
} from './validate.js'

// =================================================================
// Commander program factory
// =================================================================

/**
 * Create the hypertele-systemd CLI program with commander.
 * @returns {Command}
 */
export function createProgram() {
  const program = new Command()
    .name('hypertele-systemd')
    .description('Quickly set up hypertele clients and servers as systemd services')
    .exitOverride()

  program
    .command('init-server')
    .description('Create a hypertele server systemd service')
    .option('--name <name>', 'Service name (required)')
    .option('--port <port>', 'Local port to proxy (required)')
    .option('--seed <hex>', '64-char hex seed (generated if omitted)')
    .option('--private', 'Enable private mode')
    .option('--compress', 'Enable compression')
    .option('--cert-skip', 'Skip TLS cert validation')
    .option('--user', 'Install as user service (default: system)')
    .action(async (opts) => {
      const code = await runInitServer(opts)
      process.exitCode = code
    })

  program
    .command('init-client')
    .description('Create a hypertele client systemd service')
    .option('--name <name>', 'Service name (required)')
    .option('--port <port>', 'Local port to listen on (required)')
    .option('--server-seed <hex>', '64-char hex seed (private mode)')
    .option('--server-peer <hex>', '64-char hex public key (public mode)')
    .option('--address <addr>', 'Address to listen on (default: 127.0.0.1)')
    .option('--compress', 'Enable compression')
    .option('--user', 'Install as user service (default: system)')
    .action(async (opts) => {
      const code = await runInitClient(opts)
      process.exitCode = code
    })

  program
    .helpCommand('help')
    .description('Display help for hypertele-systemd or a subcommand')

  return program
}

// =================================================================
// Helpers
// =================================================================

/**
 * Derive the Ed25519 public key (hex) from a 64-char hex seed,
 * using the same key derivation that hypertele itself uses.
 * @param {string} seedHex - 64-character hex seed
 * @returns {string} 64-character hex public key
 */
function derivePublicKey(seedHex) {
  const seed = Buffer.from(seedHex, 'hex')
  const keyPair = HyperDHT.keyPair(seed)
  return keyPair.publicKey.toString('hex')
}

/**
 * Attempt to daemon-reload and start a service.
 * Logs failures but does not return an error code for this step.
 * @param {string} serviceName
 * @param {boolean} isUser
 */
async function startService(serviceName, isUser) {
  try {
    await runSystemctl(['daemon-reload'], isUser)
    logSuccess('daemon-reloaded')
  } catch (err) {
    log(`Warning: could not daemon-reload — start manually:\n  ${getReloadCommand(isUser)}`)
    return
  }

  try {
    await runSystemctl(['enable', '--now', serviceName], isUser)
    logSuccess(`Service "${serviceName}" started and enabled`)
  } catch (err) {
    log(`Warning: could not start service — start manually:\n  ${getStartCommand(isUser, serviceName)}`)
  }
}

// =================================================================
// Command handlers
// =================================================================

/**
 * Execute the init-server command with parsed options.
 * @param {{
 *   name?: string,
 *   port?: string,
 *   seed?: string,
 *   private?: boolean,
 *   compress?: boolean,
 *   certSkip?: boolean,
 *   user?: boolean
 * }} opts - parsed options from commander
 * @returns {Promise<number>} exit code
 */
export async function runInitServer(opts) {
  const { name, port, seed, private: privateMode = false, compress = false, certSkip = false, user = false } = opts

  try {
    validateServiceName(name)
  } catch (err) {
    logError(err.message)
    return 1
  }

  const portNum = Number(port)
  try {
    validatePort(portNum)
  } catch (err) {
    logError(err.message)
    return 1
  }

  let seedValue = seed
  if (seedValue) {
    try {
      validateSeed(seedValue)
    } catch (err) {
      logError(err.message)
      return 1
    }
  } else {
    seedValue = generateSeed()
  }

  let binaries
  try {
    binaries = findBinaries()
  } catch (err) {
    logError(err.message)
    return 2
  }

  const config = {
    type: 'server',
    name,
    port: portNum,
    seed: seedValue,
    serverBin: binaries.hyperteleServer,
    user: user ? (process.env.USER || process.env.LOGNAME || 'root') : 'root',
    private: privateMode,
    compress,
    certSkip,
  }

  const serviceName = getServiceName('server', name)
  const content = generate(config)

  let writtenPath
  try {
    writtenPath = await writeService({ content, serviceName, isUser: user })
  } catch (err) {
    if (err.code === 'EACCES') {
      logError('Permission denied writing to systemd path. Try running with sudo or use --user.')
      return 3
    }
    logError(err.message)
    return 1
  }

  logSuccess(`Service "${serviceName}" created at:`)
  log(`  ${writtenPath}`)
  log('')

  // Derive and display the public key
  const publicKey = derivePublicKey(seedValue)
  if (!seed) {
    log(`Seed:      ${seedValue}`)
    log('')
  }

  // Attempt to start the service automatically
  await startService(serviceName, user)

  log('')
  log('Check logs:')
  log(`  ${getJournalCommand(user, serviceName)}`)
  log('')

  // Show how to connect a client in both modes
  log('Public key (for --server-peer):')
  log(`  ${publicKey}`)
  log('')
  log('To connect a client:')
  log(`  hypertele-systemd init-client --name <name> --port <port> --server-seed ${seedValue}`)
  if (!privateMode) {
    log(`  hypertele-systemd init-client --name <name> --port <port> --server-peer ${publicKey}`)
  }

  return 0
}

/**
 * Execute the init-client command with parsed options.
 * @param {{
 *   name?: string,
 *   port?: string,
 *   serverSeed?: string,
 *   serverPeer?: string,
 *   address?: string,
 *   compress?: boolean,
 *   user?: boolean
 * }} opts - parsed options from commander
 * @returns {Promise<number>} exit code
 */
export async function runInitClient(opts) {
  const { name, port, serverSeed, serverPeer, address, compress = false, user = false } = opts

  try {
    validateServiceName(name)
  } catch (err) {
    logError(err.message)
    return 1
  }

  const portNum = Number(port)
  try {
    validatePort(portNum)
  } catch (err) {
    logError(err.message)
    return 1
  }

  if (!serverSeed && !serverPeer) {
    logError('--server-seed or --server-peer is required')
    return 1
  }

  if (serverSeed) {
    try {
      validateSeed(serverSeed)
    } catch (err) {
      logError(err.message)
      return 1
    }
  }

  if (serverPeer) {
    try {
      validatePubKey(serverPeer)
    } catch (err) {
      logError(err.message)
      return 1
    }
  }

  let binaries
  try {
    binaries = findBinaries()
  } catch (err) {
    logError(err.message)
    return 2
  }

  const config = {
    type: 'client',
    name,
    port: portNum,
    user: user ? (process.env.USER || process.env.LOGNAME || 'root') : 'root',
    hyperteleBin: binaries.hypertele,
    serverSeed,
    serverPeer,
    compress,
    address,
  }

  const serviceName = getServiceName('client', name)
  const content = generate(config)

  let writtenPath
  try {
    writtenPath = await writeService({ content, serviceName, isUser: user })
  } catch (err) {
    if (err.code === 'EACCES') {
      logError('Permission denied writing to systemd path. Try running with sudo or use --user.')
      return 3
    }
    logError(err.message)
    return 1
  }

  logSuccess(`Service "${serviceName}" created at:`)
  log(`  ${writtenPath}`)
  log('')

  // Attempt to start the service automatically
  await startService(serviceName, user)

  log('')
  log('Check logs:')
  log(`  ${getJournalCommand(user, serviceName)}`)
  log('')

  if (address) {
    log(`Connect your app to ${address}:${portNum}`)
  } else {
    log(`Connect your app to 127.0.0.1:${portNum} (e.g. telnet 127.0.0.1 ${portNum})`)
  }

  return 0
}
