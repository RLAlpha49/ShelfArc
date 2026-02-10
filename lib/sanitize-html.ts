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
