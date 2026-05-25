import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateServerUnit, generateClientUnit, generate, writeService } from '../lib/service.js'
import { getServiceName } from '../lib/system.js'

// --- helpers ---

// Check if systemd-analyze is available on this system
let SYSTEMD_ANALYZE = null
try {
  const path = execSync('which systemd-analyze', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore'],
  }).trim()
  SYSTEMD_ANALYZE = path
} catch {
  // skip systemd-analyze tests
}

/**
 * Run `systemd-analyze verify` against a unit string.
 * Returns `{ ok: true }` or `{ ok: false, stderr }`.
 * Skips entirely when systemd-analyze is not installed.
 */
function verifyUnit(content) {
  if (!SYSTEMD_ANALYZE) return { ok: true, skipped: true }

  const dir = mkdtempSync(join(tmpdir(), 'hypertele-systemd-test-'))
  const filePath = join(dir, 'test.service')
  try {
    writeFileSync(filePath, content, 'utf8')
    const proc = spawnSync(SYSTEMD_ANALYZE, ['verify', filePath], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return proc.status === 0
      ? { ok: true }
      : { ok: false, stderr: proc.stderr || proc.stdout }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Assertion helper: verify a unit string and assert it passes.
 */
function assertValidUnit(content, msg) {
  const result = verifyUnit(content)
  if (result.skipped) return
  assert.ok(result.ok, msg || 'systemd-analyze verify should pass')
}

// --- shared fixtures ---
const BASE_SERVER_CONFIG = {
  name: 'myserver',
  port: 22,
  seed: 'a'.repeat(64),
  serverBin: '/usr/bin/hypertele-server',
  user: 'root',
}

const BASE_CLIENT_CONFIG = {
  name: 'myclient',
  port: 1337,
  user: 'root',
  hyperteleBin: '/usr/bin/hypertele',
}

// =====================================================================
// Server unit generation
// =====================================================================
describe('generateServerUnit', () => {
  test('returns valid systemd [Unit] section', () => {
    const content = generateServerUnit(BASE_SERVER_CONFIG)
    assert.ok(content.includes('[Unit]'), 'should contain [Unit] section')
    assert.ok(content.includes('Description='), 'should contain Description=')
    assert.ok(content.includes('After=network.target'), 'should contain After=network.target')
  })

  test('has [Service] with ExecStart containing node + serverBin -l PORT --seed', () => {
    const content = generateServerUnit(BASE_SERVER_CONFIG)
    const serviceName = getServiceName('server', 'myserver')
    assert.ok(content.includes('[Service]'), 'should contain [Service] section')
    assert.ok(content.includes('ExecStart='), 'should contain ExecStart=')
    assert.ok(content.includes(BASE_SERVER_CONFIG.serverBin), 'should contain serverBin path')
    assert.ok(content.includes('-l 22'), 'should contain -l PORT')
    assert.ok(
      content.includes(`--seed ${BASE_SERVER_CONFIG.seed}`),
      'should contain --seed'
    )
    assert.ok(content.includes(`User=${BASE_SERVER_CONFIG.user}`), 'should contain User=')
    assert.ok(content.includes('Restart=always'), 'should contain Restart=always')
    assert.ok(content.includes('RestartSec=5'), 'should contain RestartSec=5')
    assert.ok(content.includes('NODE_ENV=production'), 'should contain NODE_ENV=production')
  })

  test('has [Install] with WantedBy=multi-user.target', () => {
    const content = generateServerUnit(BASE_SERVER_CONFIG)
    assert.ok(content.includes('[Install]'), 'should contain [Install] section')
    assert.ok(
      content.includes('WantedBy=multi-user.target'),
      'should contain WantedBy=multi-user.target'
    )
  })

  test('with --private includes --private in ExecStart', () => {
    const content = generateServerUnit({ ...BASE_SERVER_CONFIG, private: true })
    assert.ok(content.includes('--private'), 'should contain --private')
  })

  test('with --compress includes --compress in ExecStart', () => {
    const content = generateServerUnit({ ...BASE_SERVER_CONFIG, compress: true })
    assert.ok(content.includes('--compress'), 'should contain --compress')
  })

  test('with --cert-skip includes --cert-skip in ExecStart', () => {
    const content = generateServerUnit({ ...BASE_SERVER_CONFIG, certSkip: true })
    assert.ok(content.includes('--cert-skip'), 'should contain --cert-skip')
  })
})

// =====================================================================
// Client unit generation
// =====================================================================
describe('generateClientUnit', () => {
  test('has ExecStart with -p PORT -s PEER_KEY (public mode)', () => {
    const content = generateClientUnit({
      ...BASE_CLIENT_CONFIG,
      serverPeer: 'b'.repeat(64),
    })
    assert.ok(content.includes('ExecStart='), 'should contain ExecStart=')
    assert.ok(content.includes('-p 1337'), 'should contain -p PORT')
    assert.ok(
      content.includes(`-s ${'b'.repeat(64)}`),
      'should contain -s PEER_KEY'
    )
  })

  test('has [Install] section', () => {
    const content = generateClientUnit({
      ...BASE_CLIENT_CONFIG,
      serverPeer: 'b'.repeat(64),
    })
    assert.ok(content.includes('[Install]'), 'should contain [Install] section')
    assert.ok(
      content.includes('WantedBy=multi-user.target'),
      'should contain WantedBy=multi-user.target'
    )
  })

  test('with --serverSeed uses --private mode', () => {
    const content = generateClientUnit({
      ...BASE_CLIENT_CONFIG,
      serverSeed: 'c'.repeat(64),
    })
    assert.ok(content.includes('--private'), 'should contain --private flag')
  })

  test('with --serverPeer uses -s PEER_KEY without --private', () => {
    const content = generateClientUnit({
      ...BASE_CLIENT_CONFIG,
      serverPeer: 'd'.repeat(64),
    })
    assert.ok(
      !content.includes('--private'),
      'should NOT contain --private flag'
    )
  })

  test('with --compress includes --compress in ExecStart', () => {
    const content = generateClientUnit({
      ...BASE_CLIENT_CONFIG,
      serverPeer: 'b'.repeat(64),
      compress: true,
    })
    assert.ok(content.includes('--compress'), 'should contain --compress')
  })

  test('with --address includes --address in ExecStart', () => {
    const content = generateClientUnit({
      ...BASE_CLIENT_CONFIG,
      serverPeer: 'b'.repeat(64),
      address: '0.0.0.0',
    })
    assert.ok(content.includes('--address 0.0.0.0'), 'should contain --address')
  })
})

// =====================================================================
// generate() dispatcher
// =====================================================================
describe('generate dispatcher', () => {
  test('delegates to generateServerUnit for type "server"', () => {
    const content = generate({ ...BASE_SERVER_CONFIG, type: 'server' })
    assert.ok(content.includes('hypertele-myserver-server'))
  })

  test('delegates to generateClientUnit for type "client"', () => {
    const content = generate({
      ...BASE_CLIENT_CONFIG,
      type: 'client',
      serverPeer: 'e'.repeat(64),
    })
    assert.ok(content.includes('hypertele-myclient-client'))
  })
})

// =====================================================================
// systemd-analyze verify integration
// =====================================================================
describe('systemd-analyze verify', () => {
  test('basic server unit passes verification', { skip: !SYSTEMD_ANALYZE }, () => {
    const content = generateServerUnit(BASE_SERVER_CONFIG)
    assertValidUnit(content, 'basic server unit should be valid')
  })

  test('server unit with all optional flags passes verification', { skip: !SYSTEMD_ANALYZE }, () => {
    const content = generateServerUnit({
      ...BASE_SERVER_CONFIG,
      private: true,
      compress: true,
      certSkip: true,
    })
    assertValidUnit(content, 'server with --private --compress --cert-skip should be valid')
  })

  test('client unit in public mode passes verification', { skip: !SYSTEMD_ANALYZE }, () => {
    const content = generateClientUnit({
      ...BASE_CLIENT_CONFIG,
      serverPeer: 'b'.repeat(64),
    })
    assertValidUnit(content, 'client public mode should be valid')
  })

  test('client unit in private mode passes verification', { skip: !SYSTEMD_ANALYZE }, () => {
    const content = generateClientUnit({
      ...BASE_CLIENT_CONFIG,
      serverSeed: 'c'.repeat(64),
    })
    assertValidUnit(content, 'client private mode should be valid')
  })

  test('client unit with --address passes verification', { skip: !SYSTEMD_ANALYZE }, () => {
    const content = generateClientUnit({
      ...BASE_CLIENT_CONFIG,
      serverPeer: 'd'.repeat(64),
      address: '0.0.0.0',
    })
    assertValidUnit(content, 'client with --address should be valid')
  })

  test('generate() dispatcher output passes verification (server)', { skip: !SYSTEMD_ANALYZE }, () => {
    const content = generate({ ...BASE_SERVER_CONFIG, type: 'server' })
    assertValidUnit(content, 'generate() server should be valid')
  })

  test('generate() dispatcher output passes verification (client)', { skip: !SYSTEMD_ANALYZE }, () => {
    const content = generate({
      ...BASE_CLIENT_CONFIG,
      type: 'client',
      serverPeer: 'e'.repeat(64),
    })
    assertValidUnit(content, 'generate() client should be valid')
  })
})

// =====================================================================
// writeService()
// =====================================================================
describe('writeService', () => {
  test('returns the absolute path written', async () => {
    const path = await writeService({
      content: '[Unit]\nDescription=test\n',
      serviceName: 'hypertele-test.service',
      isUser: true,
    })
    assert.ok(path.endsWith('/hypertele-test.service'), 'should end with .service filename')
    assert.ok(path.includes('.config/systemd/user'), 'should be in user systemd dir')
  })
})
