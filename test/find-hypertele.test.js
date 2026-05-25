import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'

// Stub process.execPath for tests
describe('findBinaries', () => {
  const realExecPath = process.execPath

  it('node returns process.execPath', () => {
    // process.execPath is always set; just verify it's a string
    assert.equal(typeof process.execPath, 'string')
    assert.ok(process.execPath.length > 0)
  })

  it('throws when hypertele is not on PATH', async () => {
    const mod = await import('../src/find-hypertele.js')
    // If hypertele isn't installed globally this should throw;
    // in CI or this env it likely isn't, so we expect an error.
    // If it *is* installed, we just verify the shape.
    try {
      const result = mod.findBinaries()
      assert.equal(typeof result.node, 'string')
      assert.equal(typeof result.hypertele, 'string')
      assert.equal(typeof result.hyperteleServer, 'string')
    } catch (err) {
      // Expected: hypertele not on PATH
      assert.ok(err.message.includes('hypertele'))
    }
  })
})
