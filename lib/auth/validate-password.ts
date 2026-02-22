import zxcvbn from "zxcvbn"

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

/**
 * Checks password strength using zxcvbn. Rejects passwords that are too
 * predictable (score < 2 on a 0–4 scale) and surfaces actionable feedback.
 *
 * Returns an error message string if the password is too weak, or `null` if
 * the password passes the strength threshold.
 * @source
 */
export function checkPasswordStrength(password: string): string | null {
  const result = zxcvbn(password)
  if (result.score < 2) {
    const warning = result.feedback.warning
    const suggestion = result.feedback.suggestions[0]
    if (warning) return warning
    if (suggestion) return suggestion
    return "Password is too weak. Please choose a stronger password."
  }
  return null
}
