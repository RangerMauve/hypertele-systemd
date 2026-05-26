# hypertele-systemd

Quickly set up hypertele clients and servers as systemd services.

Generates valid systemd `.service` files, auto-daemon-reloads, and starts the service — all in one command.

## Install

```
npm install -g hypertele-systemd hypertele
```

## Usage

### Server

```
hypertele-systemd init-server --name ssh --port 22
```

With `--user` for a user-level service (no root needed):

```
hypertele-systemd init-server --name ssh --port 22 --user
```

Options:

| Flag | Description |
| --- | --- |
| `--name <name>` | Service name (required) |
| `--port <port>` | Local port to proxy (required) |
| `--seed <hex>` | 64-char hex seed (auto-generated if omitted) |
| `--private` | Enable private mode |
| `--compress` | Enable compression |
| `--cert-skip` | Skip TLS cert validation |
| `--user` | Install as user service (default: system) |

### Client

Private mode (uses server seed):

```
hypertele-systemd init-client --name ssh --port 2222 --server-seed <64-char-hex-seed>
```

Public mode (uses server public key):

```
hypertele-systemd init-client --name ssh --port 2222 --server-peer <64-char-hex-pubkey>
```

Options:

| Flag | Description |
| --- | --- |
| `--name <name>` | Service name (required) |
| `--port <port>` | Local port to listen on (required) |
| `--server-seed <hex>` | Server's 64-char hex seed (private mode) |
| `--server-peer <hex>` | Server's 64-char hex public key (public mode) |
| `--address <addr>` | Address to listen on (default: `127.0.0.1`) |
| `--compress` | Enable compression |
| `--user` | Install as user service (default: system) |

One of `--server-seed` or `--server-peer` is required.

### Help

```
hypertele-systemd --help
hypertele-systemd init-server --help
hypertele-systemd init-client --help
```

## How It Works

1. Validates inputs (name, port, seed/key)
2. Locates the `hypertele` and `hypertele-server` binaries
3. Generates a systemd unit file
4. Writes it to `/etc/systemd/system/` or `~/.config/systemd/user/`
5. Runs `systemctl daemon-reload` + `systemctl enable --now <service>`
6. Prints the seed, public key, and journal/log commands

## Programmatic API

```js
import { runInitServer, runInitClient, generateSeed, findBinaries } from 'hypertele-systemd'

// Use the CLI helpers directly
const code = await runInitServer({ name: 'ssh', port: '22', user: true })
```

See `index.js` for the full export list.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Invalid input (validation failure) |
| 2 | Binary not found (hypertele missing) |
| 3 | Permission denied (writing to systemd path) |

## License

MIT
