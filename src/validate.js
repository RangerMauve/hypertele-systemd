/**
 * Validate a hypertele service name (used as the <name> portion).
 * Accepts: alphanumeric characters, hyphens, underscores.
 * Must not be empty.
 */
export function validateServiceName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`Service name must be a non-empty string, got: ${JSON.stringify(name)}`)
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-_]*$/.test(name)) {
    throw new Error(
      `Service name must start with a letter/digit and contain only alphanumerics, hyphens, underscores: ${JSON.stringify(name)}`
    )
  }
}

/**
 * Validate a seed: 64 hex-characters (NaCl seed).
 */
export function validateSeed(seed) {
  if (typeof seed !== 'string') {
    throw new Error(`Seed must be a string, got: ${typeof seed}`)
  }
  if (!/^[0-9a-fA-F]+$/.test(seed)) {
    throw new Error(`Seed must be hex characters only, got: ${JSON.stringify(seed)}`)
  }
  if (seed.length !== 64) {
    throw new Error(`Seed must be exactly 64 hex chars (32 bytes), got ${seed.length}`)
  }
}

/**
 * Validate a public key: 64 hex-characters (NaCl public key).
 */
export function validatePubKey(key) {
  if (typeof key !== 'string') {
    throw new Error(`Public key must be a string, got: ${typeof key}`)
  }
  if (!/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error(`Public key must be hex characters only, got: ${JSON.stringify(key)}`)
  }
  if (key.length !== 64) {
    throw new Error(`Public key must be exactly 64 hex chars (32 bytes), got ${key.length}`)
  }
}

/**
 * Validate a port number: integer between 1 and 65535.
 */
export function validatePort(port) {
  const n = Number(port)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Port must be an integer between 1 and 65535, got: ${JSON.stringify(port)}`)
  }
}

/**
 * Validate a username: non-empty string.
 */
export function validateUsername(user) {
  if (typeof user !== 'string' || user.length === 0) {
    throw new Error(`Username must be a non-empty string, got: ${JSON.stringify(user)}`)
  }
}
