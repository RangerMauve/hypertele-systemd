# hypertele-systemd — Implementation Plan

## Overview

A Node.js CLI tool that generates systemd `.service` files for
[hypertele](https://github.com/bitfinexcom/hypertele) server and client proxies,
then auto-starts them.

**Dependencies:** `commander` (CLI framework), `hyperdht` (public key derivation).

## Useful Links

| Resource | Path |
| --- | --- |
| hypertele package | `node_modules/hypertele/` |
| hypertele server CLI | `node_modules/hypertele/server.js` |
| hypertele client CLI | `node_modules/hypertele/client.js` |
| hypertele package.json (bin entries) | `node_modules/hypertele/package.json` |

## hypertele Implementation Reference

**Critical CLI flags to memorize for tests + service generation:**

### Server (`hypertele-server -l PORT`)
| Flag | Required | Description |
| --- | --- | --- |
| `-l PORT` | ⚡ Yes | TCP port of the **local service to proxy**. Default `127.0.0.1` |
| `--seed SEED` | ⚡ Required. Hex-encoded NaCl seed |
| `-c conf.json` | Optional | Config file with `seed`; optional `allow` array |
| `--compress` | Optional | Enable compression |
| `--cert-skip` | Optional | Skip TLS cert validation for the local service |
| `--private` | Optional | Private mode — identity derived from seed, no allow-list |
| `--debug` | Optional | Debug stats to stdout every 5s |

**Server runtime output (to stdout):**
```
hypertele: <pubkey-hex>           # normal mode
hypertele (private): connect with seed <seed-hex> (listening on <pubkey-hex>)  # --private
```

### Client (`hypertele -p PORT`)
| Flag | Required | Description |
| --- | --- | --- |
| `-p PORT` | ⚡ Required | **Local port to listen on** (proxy entry point) |
| `-s PEER_KEY` | ⚡ Required | Server's public/peer key (hex) |
| `-c conf.json` | Optional | Config file with `peer` key |
| `-i keypair.json` | Optional | Identity keypair file |
| `--private` | Optional | Private mode — derives keypair from seed (note: `-s` is the seed) |
| `--address ADDRESS` | Optional | Address for the proxy to listen on (default `127.0.0.1`) |
| `--compress` | Optional | Enable compression |
| `--debug` | Optional | Debug stats to stdout every 5s |

**Client runtime output (to stdout):**
```
Server ready @<address>:<port>
```

## Project Structure

```
hypertele-systemd/
├── bin/
│   └── hypertele-systemd.js      # CLI entry point (shebang)
├── src/
│   ├── cli.js                    # commander program + command handlers
│   ├── service.js                # systemd unit generation
│   ├── system.js                 # systemctl helpers (runSystemctl, reload/start commands)
│   ├── output.js                 # log/logSuccess/logError helpers
│   ├── find-hypertele.js         # locate hypertele & node binaries
│   ├── generate-seed.js          # cryptographically secure seed generation
│   └── validate.js               # input validation helpers
├── test/
│   ├── cli.test.js               # commander program + runInit* error paths
│   ├── find-hypertele.test.js
│   ├── output.test.js
│   ├── seed.test.js
│   ├── service.test.js           # unit gen + systemd-analyze verify
│   ├── system.test.js
│   └── validate.test.js
├── package.json
└── node_modules/
```

## Implementation Approach

### 1. `src/cli.js` — Commander-based CLI

Uses `commander` for argument parsing, subcommand dispatch, and auto-generated `--help`.

```javascript
import { Command } from 'commander'
import HyperDHT from 'hyperdht'

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
    .action(async (opts) => { ... })

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
    .action(async (opts) => { ... })

  return program
}
```

### 2. `src/system.js` — Systemctl Helpers

```javascript
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const runExecFile = promisify(execFile)

export function getSystemdPath({ user = false } = {}) {
  if (user) return `${os.homedir()}/.config/systemd/user`
  return '/etc/systemd/system'
}

export function getServiceName(type, name) {
  return `hypertele-${name}-${type}.service`
}

// Auto daemon-reload + start the service
export async function runSystemctl(args, user = false) {
  const fullArgs = user ? ['--user', ...args] : args
  const { stdout } = await runExecFile('systemctl', fullArgs)
  return stdout
}

export function getReloadCommand(user = false) {
  return user ? 'systemctl --user daemon-reload' : 'sudo systemctl daemon-reload'
}

export function getStartCommand(user, serviceName) {
  return user
    ? `systemctl --user enable --now ${serviceName}`
    : `sudo systemctl enable --now ${serviceName}`
}

export function getJournalCommand(user, serviceName) {
  return user
    ? `journalctl --user -u ${serviceName} -f`
    : `sudo journalctl -u ${serviceName} -f`
}
```

### 3. Public Key Derivation

Uses `HyperDHT.keyPair(seed)` (the same function hypertele itself uses) to derive
the Ed25519 public key from the seed at creation time. This lets the CLI print the
public key immediately and suggest the `--server-peer` client command without requiring
the user to read journal logs first.

```javascript
function derivePublicKey(seedHex) {
  const seed = Buffer.from(seedHex, 'hex')
  const keyPair = HyperDHT.keyPair(seed)
  return keyPair.publicKey.toString('hex')
}
```

### 4. Auto Service Start

After writing the service file, the CLI attempts to:
1. `systemctl daemon-reload` (or `--user` variant)
2. `systemctl enable --now <service>` (or `--user` variant)

Failures are logged as warnings with the manual commands to run. The service init
does not fail if systemctl calls fail — it only warns.

## Testing Plan (`node:test`)

```
test/
├── cli.test.js
│   ├── createProgram has correct name
│   ├── createProgram has init-server/init-client subcommands
│   ├── init-server has expected options (--name, --port, --seed, --private, --compress, --cert-skip, --user)
│   ├── init-client has expected options (--name, --port, --server-seed, --server-peer, --address, --compress, --user)
│   ├── runInitServer error paths (missing name, invalid port, invalid seed, etc.)
│   └── runInitClient error paths (missing server-seed/peer, invalid seed, etc.)
├── find-hypertele.test.js
│   ├── findBinaries returns shape { node, hypertele, hyperteleServer }
│   ├── node === process.execPath
│   └── throws when hypertele not found
├── seed.test.js
│   ├── generateSeed returns 64-char hex string ✅
│   └── generateSeed produces different values each call ✅
├── validate.test.js
│   ├── validateServiceName rejects empty string, accepts valid names ✅
│   ├── validateSeed accepts 64-char hex, rejects wrong length/non-hex ✅
│   ├── validatePubKey same as validateSeed ✅
│   ├── validatePort accepts 1-65535, rejects 0/65536/non-numeric ✅
│   └── validateUsername accepts non-empty strings ✅
├── service.test.js
│   ├── generateServerUnit valid systemd sections ✅
│   ├── generateClientUnit valid systemd sections ✅
│   └── systemd-analyze verify passes for both ✅
├── output.test.js
│   ├── log writes to stdout ✅
│   └── logSuccess/logError prefix correctly ✅
├── system.test.js
│   ├── getSystemdPath defaults/returns user path ✅
│   ├── getServiceName correct format ✅
│   ├── getReloadCommand/getStartCommand/getJournalCommand correct format ✅
└── (all run via `node --test 'test/*.test.js'`)
```

## Implementation Order (TODO)

- [x] **Phase 1: Core libraries**
  - [x] `src/generate-seed.js` + tests
  - [x] `src/validate.js` + tests
  - [x] `src/system.js` + tests (incl. `runSystemctl`)
  - [x] `src/find-hypertele.js` + tests
  - [x] `src/output.js` + tests

- [x] **Phase 2: Service generation**
  - [x] `src/service.js` (+ tests with `systemd-analyze verify`)

- [x] **Phase 3: CLI**
  - [x] `src/cli.js` — commander-based CLI with `init-server` / `init-client` subcommands
  - [x] `bin/hypertele-systemd.js` — entry point
  - [x] Auto-generated `--help` via commander
  - [x] Public key derivation via `HyperDHT.keyPair(seed)`
  - [x] Auto daemon-reload + start (`runSystemctl`)
  - [x] Error handling & exit codes (0/1/2/3)
  - [x] `test/cli.test.js`

- [ ] **Phase 4: Tie-up**
  - [ ] `index.js` — programmatic API re-exports
  - [ ] Update `package.json`: add `bin` entries, update `main` to `index.js`
  - [ ] Update `README.md` with usage examples
  - [ ] Make sure `node:test` runs all `test/*.test.js`
  - [ ] Final review: all tests pass, README accurate

## Notes for Implementation Agents

1. **CLI framework:** Uses `commander` (installed, not zero-dep). Commander handles `--help`, subcommand dispatch, option parsing, and `exitOverride()` for graceful exit code control.

2. **Public key derivation:** `HyperDHT.keyPair(seed)` — same function hypertele uses internally. Derives the Ed25519 public key from the seed deterministically.

3. **Auto-start:** `runSystemctl()` uses `promisify(execFile)` from `node:child_process`. Failures warn but don't abort. Manual fallback commands printed.

4. **No `node:child_process/promises`:** Not available in all Node versions; use `promisify(execFile)` instead.

5. **Seed generation:** Must be **32 bytes** = **64 hex chars**. NaCl secretbox seed. `crypto.getRandomValues(new Uint8Array(32))`.

6. **Binary discovery:** `process.execPath` for node. `which hypertele` for hypertele. `which hypertele-server` for server. Both are npm global / nvm-managed.

7. **User vs system services:** User → `~/.config/systemd/user/`, system → `/etc/systemd/system/`.

8. **Private mode:** Server `--private` flag. Client `--server-seed` (seed not pubkey).

9. **Public mode (default):** Server prints pubkey on start; we derive it via `HyperDHT.keyPair`. Client uses `--server-peer` with the pubkey.

10. **File permissions:** `chmod 644` the generated `.service` files explicitly.

11. **Error exit codes:**
    - 0: success
    - 1: invalid input (validation failure)
    - 2: binary not found (hypertele missing)
    - 3: permission denied (writing to systemd path)

12. **Test patterns:** `describe/test` blocks, `assert.strictEqual`, `assert.throws()`. No mocks needed — pure functions.
