import DOMPurify from "isomorphic-dompurify"

/** HTML tags permitted through the sanitizer. @source */
const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "s",
  "span",
  "ul"
] as const

/** HTML attributes permitted through the sanitizer. @source */
const ALLOWED_ATTR = ["href", "title"] as const

/**
 * Sanitizes an HTML string, keeping only safe tags and attributes.
 * @param value - The raw HTML string.
 * @returns The sanitized HTML string.
 * @source
 */
export const sanitizeHtml = (value: string) =>
  DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR]
  })

/**
 * Sanitizes an optional HTML string, returning `null` for empty or missing input.
 * @param value - The raw HTML string or nullish value.
 * @returns The sanitized HTML string, or `null`.
 * @source
 */
export const sanitizeOptionalHtml = (value?: string | null): string | null => {
  if (!value) return null
  const sanitized = sanitizeHtml(value).trim()
  return sanitized.length > 0 ? sanitized : null
}

/**
 * Strips all HTML tags from a string and optionally truncates it.
 * @param value - The raw input string.
 * @param maxLength - Optional maximum character length.
 * @returns The plain-text result.
 * @source
 */
export const sanitizePlainText = (
  value: string,
  maxLength?: number
): string => {
  const stripped = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  }).trim()
  if (maxLength !== undefined && stripped.length > maxLength) {
    return stripped.slice(0, maxLength)
  }
  return stripped
}

/**
 * Strips HTML from an optional string, returning `null` for empty or missing input.
 * @param value - The raw input string or nullish value.
 * @param maxLength - Optional maximum character length.
 * @returns The plain-text result, or `null`.
 * @source
 */
export const sanitizeOptionalPlainText = (
  value?: string | null,
  maxLength?: number
): string | null => {
  if (!value) return null
  const sanitized = sanitizePlainText(value, maxLength)
  return sanitized.length > 0 ? sanitized : null
}
