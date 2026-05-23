import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateServiceName,
  validateSeed,
  validatePubKey,
  validatePort,
  validateUsername,
} from '../lib/validate.js'

describe('validateServiceName', () => {
  it('rejects empty string', () => {
    assert.throws(() => validateServiceName(''), /non-empty/)
  })

  it('accepts simple name "ssh"', () => {
    validateServiceName('ssh')
  })

  it('accepts name with hyphen', () => {
    validateServiceName('my-service')
  })

  it('accepts name with underscore', () => {
    validateServiceName('my_service')
  })

  it('rejects name starting with hyphen', () => {
    assert.throws(() => validateServiceName('-bad'))
  })

  it('rejects name starting with underscore', () => {
    assert.throws(() => validateServiceName('_bad'))
  })
})

describe('validateSeed', () => {
  const validSeed = 'a'.repeat(64)

  it('accepts valid 64-char hex', () => {
    validateSeed(validSeed)
  })

  it('rejects non-hex characters', () => {
    assert.throws(() => validateSeed('g'.repeat(64)), /hex/)
  })

  it('rejects wrong length', () => {
    assert.throws(() => validateSeed('ab'), /64/)
  })

  it('rejects non-string', () => {
    assert.throws(() => validateSeed(123), /string/)
  })
})

describe('validatePubKey', () => {
  const validKey = 'f'.repeat(64)

  it('accepts valid 64-char hex', () => {
    validatePubKey(validKey)
  })

  it('rejects non-hex characters', () => {
    assert.throws(() => validatePubKey('g'.repeat(64)), /hex/)
  })

  it('rejects wrong length', () => {
    assert.throws(() => validatePubKey('ab'), /64/)
  })
})

describe('validatePort', () => {
  it('accepts valid ports', () => {
    validatePort(80)
    validatePort(1)
    validatePort(65535)
    validatePort('1234')
  })

  it('rejects 0', () => {
    assert.throws(() => validatePort(0), /1/)
  })

  it('rejects 65536', () => {
    assert.throws(() => validatePort(65536), /65535/)
  })

  it('rejects non-numeric', () => {
    assert.throws(() => validatePort('abc'))
  })
})

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    validateUsername('root')
    validateUsername('deploy')
  })

  it('rejects empty string', () => {
    assert.throws(() => validateUsername(''), /non-empty/)
  })
})
