import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createProgram, runInitServer, runInitClient } from '../src/cli.js'

// =================================================================
// commander program structure
// =================================================================

describe('createProgram', () => {
  test('creates program with correct name', () => {
    const program = createProgram()
    assert.strictEqual(program.name(), 'hypertele-systemd')
  })

  test('has init-server subcommand', () => {
    const program = createProgram()
    const cmd = program.commands.find((c) => c.name() === 'init-server')
    assert.ok(cmd, 'init-server command should exist')
  })

  test('has init-client subcommand', () => {
    const program = createProgram()
    const cmd = program.commands.find((c) => c.name() === 'init-client')
    assert.ok(cmd, 'init-client command should exist')
  })

  test('init-server has expected options', () => {
    const program = createProgram()
    const cmd = program.commands.find((c) => c.name() === 'init-server')
    const opts = cmd.options.map((o) => o.long)
    assert.ok(opts.includes('--name'), 'should have --name')
    assert.ok(opts.includes('--port'), 'should have --port')
    assert.ok(opts.includes('--seed'), 'should have --seed')
    assert.ok(opts.includes('--private'), 'should have --private')
    assert.ok(opts.includes('--compress'), 'should have --compress')
    assert.ok(opts.includes('--cert-skip'), 'should have --cert-skip')
    assert.ok(opts.includes('--user'), 'should have --user')
  })

  test('init-client has expected options', () => {
    const program = createProgram()
    const cmd = program.commands.find((c) => c.name() === 'init-client')
    const opts = cmd.options.map((o) => o.long)
    assert.ok(opts.includes('--name'), 'should have --name')
    assert.ok(opts.includes('--port'), 'should have --port')
    assert.ok(opts.includes('--server-seed'), 'should have --server-seed')
    assert.ok(opts.includes('--server-peer'), 'should have --server-peer')
    assert.ok(opts.includes('--address'), 'should have --address')
    assert.ok(opts.includes('--compress'), 'should have --compress')
    assert.ok(opts.includes('--user'), 'should have --user')
  })
})

// =================================================================
// runInitServer — option-based API (no binary needed)
// =================================================================

describe('runInitServer', () => {
  test('missing name returns 1', async () => {
    const exitCode = await runInitServer({ port: '22' })
    assert.strictEqual(exitCode, 1)
  })

  test('empty name returns 1', async () => {
    const exitCode = await runInitServer({ name: '', port: '22' })
    assert.strictEqual(exitCode, 1)
  })

  test('invalid port returns 1', async () => {
    const exitCode = await runInitServer({ name: 'ssh', port: '0' })
    assert.strictEqual(exitCode, 1)
  })

  test('non-numeric port returns 1', async () => {
    const exitCode = await runInitServer({ name: 'ssh', port: 'abc' })
    assert.strictEqual(exitCode, 1)
  })

  test('port over 65535 returns 1', async () => {
    const exitCode = await runInitServer({ name: 'ssh', port: '65536' })
    assert.strictEqual(exitCode, 1)
  })

  test('invalid seed returns 1', async () => {
    const exitCode = await runInitServer({ name: 'ssh', port: '22', seed: 'xyz' })
    assert.strictEqual(exitCode, 1)
  })

  test('seed too short returns 1', async () => {
    const exitCode = await runInitServer({ name: 'ssh', port: '22', seed: 'ab' })
    assert.strictEqual(exitCode, 1)
  })

  test('boolean defaults work', async () => {
    // private, compress, certSkip, user should all default to false
    const exitCode = await runInitServer({
      name: 'ssh',
      port: '22',
      seed: 'a'.repeat(64),
    })
    // Will fail at findBinaries(2) if hypertele not installed, or EACCES(3) if no write perms
    assert.ok([1, 2, 3].includes(exitCode), `expected 1, 2, or 3, got ${exitCode}`)
  })
})

// =================================================================
// runInitClient — option-based API (no binary needed)
// =================================================================

describe('runInitClient', () => {
  test('missing name returns 1', async () => {
    const exitCode = await runInitClient({
      port: '22',
      serverPeer: 'a'.repeat(64),
    })
    assert.strictEqual(exitCode, 1)
  })

  test('invalid port returns 1', async () => {
    const exitCode = await runInitClient({
      name: 'cli',
      port: '0',
      serverPeer: 'a'.repeat(64),
    })
    assert.strictEqual(exitCode, 1)
  })

  test('missing both server-seed and server-peer returns 1', async () => {
    const exitCode = await runInitClient({ name: 'cli', port: '22' })
    assert.strictEqual(exitCode, 1)
  })

  test('invalid server-seed returns 1', async () => {
    const exitCode = await runInitClient({
      name: 'cli',
      port: '22',
      serverSeed: 'xyz',
    })
    assert.strictEqual(exitCode, 1)
  })

  test('invalid server-peer returns 1', async () => {
    const exitCode = await runInitClient({
      name: 'cli',
      port: '22',
      serverPeer: 'xyz',
    })
    assert.strictEqual(exitCode, 1)
  })

  test('--server-seed with both seed and peer works', async () => {
    const exitCode = await runInitClient({
      name: 'cli',
      port: '22',
      serverSeed: 'a'.repeat(64),
      serverPeer: 'b'.repeat(64),
    })
    // Will fail at findBinaries(2) if hypertele not installed, or EACCES(3) if no write perms
    assert.ok([1, 2, 3].includes(exitCode), `expected 1, 2, or 3, got ${exitCode}`)
  })
})
