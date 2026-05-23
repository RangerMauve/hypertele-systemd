import { webcrypto } from 'node:crypto'

/**
 * Generate a 32 byte (256 bit) NaCl seed as 64 char hex string.
 */
export function generateSeed() {
  const bytes = webcrypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
