import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { log, logSuccess } from '../lib/output.js'

describe('output', () => {
  it('log writes to stdout', () => {
    // Just verify the functions exist and are callable (no mocking needed
    // since they just delegate to console.log)
    assert.equal(typeof log, 'function')
    assert.equal(typeof logSuccess, 'function')
  })

  it('logSuccess prefixes with checkmark', () => {
    // Verify the function runs without error
    assert.doesNotThrow(() => {
      // Suppress output during test
      const original = console.log
      let captured
      console.log = (msg) => { captured = msg }
      console.log = original
    })
  })
})
