import DOMPurify from "isomorphic-dompurify"

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

const ALLOWED_ATTR = ["href", "title"] as const

export const sanitizeHtml = (value: string) =>
  DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR]
  })

export const sanitizeOptionalHtml = (value?: string | null): string | null => {
  if (!value) return null
  const sanitized = sanitizeHtml(value).trim()
  return sanitized.length > 0 ? sanitized : null
}

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

export const sanitizeOptionalPlainText = (
  value?: string | null,
  maxLength?: number
): string | null => {
  if (!value) return null
  const sanitized = sanitizePlainText(value, maxLength)
  return sanitized.length > 0 ? sanitized : null
}
