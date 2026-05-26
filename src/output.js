/** @param {string} text */
export function log(text) {
  console.log(text)
}

/** @param {string} text */
export function logSuccess(text) {
  console.log(`✓ ${text}`)
}

/** @param {string} text */
export function logError(text) {
  console.error(`✗ ${text}`)
}
