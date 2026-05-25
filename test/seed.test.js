import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateSeed } from '../src/generate-seed.js'

describe('generateSeed', () => {
  it('returns a 64 character string', () => {
    const seed = generateSeed()
    assert.equal(seed.length, 64)
  })

  it('returns a valid hex string', () => {
    const seed = generateSeed()
    assert.match(seed, /^[0-9a-f]{64}$/)
  })

  it('produces different values on each call', () => {
    const a = generateSeed()
    const b = generateSeed()
    assert.notEqual(a, b)
  })
})
