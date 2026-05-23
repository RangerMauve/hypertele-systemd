# hypertele-systemd — Implementation Plan

## Overview

A zero-dependency Node.js CLI tool that generates systemd `.service` files for
[hypertele](https://github.com/bitfinexcom/hypertele) server and client proxies.

**No external dependencies needed.** The tool generates service files and ANSI
colored output. All logic uses only `node:` builtins.

## Useful Links

| Resource | Path |
| --- | --- |
| hypertele package | `node_modules/hypertele/` |
| hypertele server CLI | `node_modules/hypertele/server.js` |
| hypertele client CLI | `node_modules/hypertele/client.js` |
| hypertele package.json (bin entries) | `node_modules/hypertele/package.json` |

## hypertele Implementation Reference

**Critical CLI flags to memorize for tests + service generation:**

### Server (`hypertele -l PORT`)
**`server.js`
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
├── lib/
│   ├── cli.js                    # argument parsing & dispatch
│   ├── service.js                # systemd unit generation
│   ├── system.js                 # systemctl helpers (reload prompt, etc.)
│   └── output.js                 # ANSI/ANSI colored messages
│   ├── find-hypertele.js          # locate hypertele & node binaries
│   ├── generate-seed.js           # cryptographically secure seed generation
│   └── validate.js               # input validation helpers
├── test/
│   ├── find-hypertele.discover.test.js
│   ├── seed.test.js
│   ├── validate.test.js
│   ├── service.test.js
│   ├── output.test.js
│   ├── cli.parseArgs.test.js
│   ├── service.init-server.test.js
│   ├── service.init-client.test.js
│   └── cli.help.test.js
├── index.js                      # re-export everything for programmatic use
```

## Implementation Approach

### 7. Install dependencies

None. Pure `node:` only.

```javascript
// nothing to install
```

### 2. `lib/find-hypertele.js` — Locate Binaries

Rely on PATH. Uses synchronous commands to find binaries on PATH.

```javascript
import which from 'node:child_process' // no, use `command -v` or `execFile`

// Sync lookup:
function findNodeBin() {
  return process.execPath // Node's own binary path (works even under nvm)
}

function findHyperteleBin() {
  // execSync `which hypertele` → get path to hypertele CLI
  if (not found → throw 'hypertele not

function findServerBin() {
  // execSync `which hypertele-server` or `npx which hypertele-server`
  // hypertele-server is a separate binary separate
}
```

**Return shape:**
```javascript
/// /lib/find-hypertele.js
export function findBinaries() {
  return {
    node: process.execPath,       // absolute path to node
    hypertele: '/home/user/.nvm/versions/node/v20/bin/hypertele',
    hyperteleServer: '/home/user/.nvm/versions/node/v20/node_modules/hypertele/server.js',
  }
}
```

### 3. `lib/generate-seed.js` — Seed Generation

Generate a **32-byte (256-bit) NaCl seed**, output as **64-char hex**.

```javascript
// lib/generate-seed.js
import { webcrypto } from 'node:crypto'

export function generateSeed() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### 4. `lib/service.js` — Systemd Unit Generation

Generate valid systemd unit files (INI-style, `[Unit]`, `[Service]`, `[Install]` sections).

```ini
[Unit]
Description=hypertele [name]
After=network.target

[Service]
ExecStart=/path/to/node /path/to/server.js -l 1234 --seed <SEED>
User=<user>
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**For client:**
```ini
[Unit]
Description=hypertele-[name]
After=network.target

[Service]
ExecStart=/path/to/node /path/to/hypertele -p 5678 -s <PEER_KEY>
User=<user>
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Key logic:**
- Write to `/etc/systemd/system/` (default, needs root) or `~/.config/systemd/user/` (user services)
- Prompt user to run `sudo systemctl daemon-reload` or `systemctl --user daemon-reload` (no auto-reload)

**File location rules:**
| `--system` flag | Path |
| --- | --- |
| `--system` (default) | `/etc/systemd/system/` |
| `--user` | `~/.config/systemd/user/` |

### 5. `lib/output.js` — ANSI/Colored Messages

ANSI color **no deps.** Colors.

```javascript
export function cyan(text) { ... }
export function green(text) { ... }
export function yellow(text) { ... }
export function red(text) { ... }
```

**Output messages:**

**Server init success:**
```
✓ Service "hypertele-[name]-server" created at:
  /etc/systemd/system/hypertele-[name]-server.service

Seed:    <SEED_HEX>
Pub key:  <to be printed by hypertele on service startup>
Check service logs after starting:
  sudo journalctl -u hypertele-[name]-server.service -f

To start:
  sudo systemctl daemon-reload
  sudo systemctl start hypertele-[name]-server.service

To connect a client:
  hypertele-systemd init-client --name myclient --server-seed <SEED_HEX> -p 1337
```

**Client init success:**
```
✓ Service "hypertele-[name]-client" created at:
  /etc/systemd/hypertele-[name]-client.service

Peer key: <PEER_KEY_HEX>
Local port: <PORT>
Check service logs after starting:
  sudo journalctl -u hypertele-[name]-client.service -f

To start:
  sudo systemctl daemon-reload
  sudo systemctl enable hypertele-[name]-client.service
  sudo systemctl start hypertele-[name]-client.service

📡 To use this proxy, connect your app to localhost:<PORT> (e.g. telnet localhost <PORT>)
```

### 6. `lib/validate.js` — Input Validation

```javascript
export function validateServiceName(name) {
  // Must match: hypertele-.* (alphanumeric, hyphens)
  // Reject if name doesn't start with 'hypertele-'
}

export function validateSeed(seed) {
  // Must be valid hex, 64-chars (32 bytes)
}

export function validatePubKey(key) {
  // Must be valid hex, 64-chars (32 bytes)
}

export function validatePort(port) {
  // Number between 1-65535
}

export function validateUsername(user) {
  // Non-empty string (let OS validate
}
```

### 7. `bin/hypertele-systemd.js` — CLI Entry Point

```
bin/hypertele-systemd.js
```

**Commands & flags:**

```
bin/hypertele-systemd server <name> [flags]

Create a hypertele server systemd service.

Examples:
  hypertele-systemd init-server --name ssh -l 22 --system
  hypertele-systemd init-server --name ollama -l 11434 --user
  hypertele-systemd init-server --name my-ssh -l 22 --seed DEADBEEF...

Flags: --name  `<service-name>`             (req)
       --port  `<port>`                     (req) local port to proxy
       --seed  `<hex>`                      (opt) 32 byte hex seed (generated if omitted)
       --private                             (opt) enable private mode
       --user  `<user>`                     (opt) user to run as (default: current user)
       --system                              (opt) install as system service (default)
       --user                                (opt) install as user service
       --help                                (opt) show help
       --compress                            (opt) enable compression
       --cert-skip                           (opt) skip TLS cert check

bin/hypertele-systemd init-client <name>

Create a hypertele client systemd service.

Examples:
  hypertele-systemd init-client --name ssh -p 1337 --server-seed DEADBEEF...
  hypertele-systemd init-client --name ollama-server-seed DEADBEEF...
  hypertele-systemd init-client --name myclient -p 9090 --server-peer ABC123... --user

Flags: --name  `<service-name>`             (req)
       --port  `<port>`                     (req) local port to listen on
       --server-seed  `<hex>`               (req) server 32-byte hex seed to PRIVATE mode -- note!)
       --server-peer  `<hex>`               (opt) server 32-byte hex public key (for public mode!)
       --user    `<user>`                   (opt) user to run as (default: current user)
       --system                             (opt) install as system service (default)
       --user                               (opt) install as user service
       --help                               (opt) show help
       --compress                           (opt) enable compression
       --cert-skip                          (opt) skip TLS cert check
```

**Validation rules:**
- `init-client`: **Errors and exits** if neither `--server-seed` nor `--server-peer` is provided
- `init-server`: auto-generates seed if `--seed` not provided
- `--private` on server: requires `--seed` (no auto-gen recommended for private mode)

**CLI argument parsing:** Manual (no minimist or yargs.)
**ANSI colors:** Use `lib/output.js` (no dep).

### 8. `lib/system.js` — Systemctl Helpers

```javascript
export function getSystemdPath({ user = false }) {
  if (user) return `${os.homedir()}/.config/systemd/user`
  return '/etc/systemd/system'
}

export function getServiceName(type, name) {
  return `hypertele-${name}-${type}.service`
}

export function getReloadCommand(user) {
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

### 9. `index.js` — Programmatic API

Re-export for library use:

```javascript
// index.js
export { initServer }      from './lib/cli.js'
export { initClient }      from './lib/cli.js'
export { generateSeed }    from './lib/generate-seed.js'
export { findBinaries }    from './lib/find-hypertele.js'
export { generate }        from './lib/service.js'
export { validateName }    from './lib/validate.js'
```

## Testing Plan (`node:test`)

```
test/
├── find-hypertele.test.js
│   ├── findBinaries returns shape { node, hypertele, hyperteleServer }
│   ├── node === process.execPath
│   ├── hypertele Server is absolute path when found
│   └── throws when hypertele not found
│   ├── throws when hypertele-server not found
│   └── Resolves both hypertele and hypertele-server if found
│   └── Works with nvm-managed node ✅
├── seed.test.js
│   ├── generatesSeed returns length
│   ├── generatesSeed is hexadecimal ✅
│   ├── generateSeed is valid hex
│   ├── generateSeed is 64 chars
│   └── generateSeed produces different values each call ✅
├── validate.test.js
│   ├── validateServiceName(name) rejects empty string
│   ├── validateServiceName('ssh') ✅
│   ├── validateServiceName('my-service') ✅
│   ├── validateServiceName('telp-..') ✅
│   ├── validateSeed('DEADBEEF...64hex') ✅
│   ├── validateSeed rejects non-hex
│   ├── validateSeed rejects wrong length
│   ├── validatePort(80) ✅
│   ├── validatePort(0) rejects
│   ├── validatePort(65536) rejects
│   ├── validatePort('abc') rejects
│   ├── validateUsername('root') ✅
│   └── validateUsername('') rejects
├── service.test.js
│   ├── generateServer(config) returns valid systemd [Unit] section
│   ├── generateServer(config) has [Service] with ExecStart with node + hypertele-server -l PORT --seed
│   ├── generateServer(config) has [Install] with WantedBy=multi-user.target
│   ├── generateServer(config with --private) includes --private in ExecStart
│   ├── generateServer(config) with --compress includes --compress in ExecStart
│   ├── generateServer(config) with --cert-skip includes --cert-skip in ExecStart
│   ├── generateServer(config) with --cert-skip includes --cert-skip in ExecStart
│   ├── generateClient(config) has ExecStart with -p PORT -s PEER_KEY
│   ├── generateClient(config) has [Install]
│   ├── generateClient(config) with --server-seed uses --private
│   └── generateClient(config) with --server-peer uses -s PEER_KEY (no --private)
├── system.test.js
│   ├── getSystemdPath() defaults to /etc/systemd/system
│   ├── getSystemdPath({ user: true }) returns ~/..../user
│   ├── getServiceName() returns correct format
│   ├── getReloadCommand(user) returns expected string
│   ├── getStartCommand(style, user) returns correct format
│   └── getJournalCommand(user) returns expected string
├── output.test.js
│   ├── cyan(text) wraps with CSI codes
│   ├── green(text) wraps with CSI codes
│   ├── red(text) wraps with CSI codes
│   ├── yellow(text) wraps with CSI codes
│   └── Plain text passthroughs
├── cli.help.test.js (integration-style)
│   ├── --help flag shows help
│   ├── init-server --help shows server help
│   ├── init-client --help shows client help
│   └── init-client without --server-seed or --server-peer → error
```

**Test assertions use `node:test` `assert` (assert.+):
```javascript
import { test, describe } from 'node:test'
import assert from 'node:assert/strict`
// ❌ no `node:test`
```

## Implementation Order (TODO)

- [ ] **Phase 1: Core libraries (no CLI)**
  - [ ] `lib/generate-seed.js` + tests
  - [ ] `lib/validate.js` + tests
  - [ ] `lib/system.js` + tests
  - [ ] `lib/find-hypertele.js` + tests
  - [ ] `lib/output.js` + tests

- [ ] **Phase 2: Service generation**
  - [ ] `lib/service.js` + tests
  - [ ] Full integration: `generateServer(config)`, `generateClient(config)` pass validation

- [ ] **Phase 3: CLI**
  - [ ] `lib/cli.js` — manual `process.argv` parser
  - [ ] `bin/hypertele-systemd.js` — entry point (shebang, `#!/usr/bin/env node`)
  - [ ] Handle `init-server` and `init-client` commands
  - [ ] `--help` flag everywhere
  - [ ] Error handling & exiting cleanly

- [ ] **Phase 4: Tie-up**
  - [ ] Update `package.json`: add `bin` entries, update `main` to `index.js`
  - [ ] Update `README.md` with usage examples
  - [ ] Make sure `node:test` runs all `test/*.test.js`
  - [ ] Final review: zero external deps, all tests pass, README accurate

## Notes for Implementation Agents

1. **ANSI colors:** Use `node:util` `util.format` or manual hex → `node:util` `hexEscape` (Node 20+)? No, just use `\x1b` codes directly in `lib/output.js`.

2. **Systemd file validation:** The tool generates the file, systemd validates it when you `systemctl daemon-reload` and try to `start`. Don't try to re-implement systemd parsing.

3. **Seed generation:** Must be **32 bytes** = **64 hex chars**. This is NaCl secretbox seed size. `crypto.getRandomValues(new Uint8Array(32))` is the way.

4. **Binary discovery:** `process.execPath` for node. `which hypertele` for hypertele. `which hypertele-server` for server. Both are npm global installs or nvm-managed. Use `shellSandbox ('which hypertele')` to find absolute paths.

5. **No auto`systemctl` calls:** The tool **never** runs `systemctl` commands. It **only writes service files and tells the user what to run.**

6. **User services vs system services:** User services go to `~/.config/systemd/user/`, all other paths relative to user's home. System services go to `/etc/systemd/system/`. Both require `sudo` for `systemctl`. Both require `sudo` for `enable —-now`

7. **hypertele's printing:** The server prints its pubkey to stdout *after startup*. The tool **cannot** intercept that. It only writes the service file and tells the user how to check logs for the pubkey (journalctl). The output tells the user to check `journalctl` for the pubkey.

8. **Private mode:**
   - Server: `--private` flag
   - Client: `--private` flag, and `-s <SEED>` (seed, not pubkey)
   - The tool generates the seed for you. Output the seed so you can pass it to the client command.

9. **Public mode (default):**
   - Server: normal, prints pubkey on start
   - Client: `-s <PUBKEY>`, uses pubkey directly
   - The tool outputs the pubkey from `journalctl` command so user can grab it.

10. **File permissions:** `chmod 644` the generated `.service` files explicitly (good practice for systemd).

11. **Error exit codes:**
    - 0: success
    - 1: invalid input (validation failure)
    - 2: not found (hypertele binary missing)
    - 3: permission denied (writing to systemd path)

12. **Test patterns:** Use `describe/`blocks for grouping, `assert.strictEqual` (not `===`), `assert.throws()` for errors, `match()` for service file content checks. No mocks needed — everything is pure/functions.

**Testing `node:test` usage:**
```json
// package.json
{
  "scripts": {
    "test": "node --test 'test/*.test.js'
```
