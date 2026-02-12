/**
 * Validates that a Supabase Storage path contains no traversal or encoded-escape attacks.
 *
 * This is intentionally strict (deny-by-default) because these paths are used to access
 * user-owned storage objects.
 *
 * - Rejects `..`, backslashes, and absolute paths
 * - Rejects encoded slash/dot/backslash/null sequences
 * - Rejects invalid percent-encoding
 * - Decodes up to 2 times to catch double-encoding
 *
 * @param path - The storage file path to validate.
 * @returns `true` if the path is safe to use.
 */
export const isSafeStoragePath = (path: string) => {
  if (!path) return false

  let decodedPath = path

  try {
    for (let i = 0; i < 2; i += 1) {
      const next = decodeURIComponent(decodedPath)
      if (next === decodedPath) break
      decodedPath = next
    }
  } catch {
    return false
  }

  const lowerPath = path.toLowerCase()
  const decodedLowerPath = decodedPath.toLowerCase()

  // Block common encoded traversal sequences.
  const blockedSequences = ["%2e", "%2f", "%5c", "%00"]
  if (
    blockedSequences.some(
      (sequence) =>
        lowerPath.includes(sequence) || decodedLowerPath.includes(sequence)
    )
  ) {
    return false
  }

  // Block decoded traversal, absolute paths, and Windows separators.
  if (
    decodedPath.includes("..") ||
    decodedPath.includes("\\") ||
    decodedPath.startsWith("/") ||
    decodedPath.includes("\u0000")
  ) {
    return false
  }

  return true
}
