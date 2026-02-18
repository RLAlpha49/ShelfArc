/**
 * Validates password strength against security requirements.
 * @param password - The password to validate.
 * @returns An error message string if invalid, or `null` if valid.
 * @source
 */
export function validatePassword(password: string): string | null {
  if (!password) return "Password is required"
  if (password.length < 8) return "Password must be at least 8 characters"
  if (password.length > 128) return "Password must be 128 characters or fewer"
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter"
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter"
  }
  if (!/\d/.test(password)) {
    return "Password must include a number"
  }
  return null
}
