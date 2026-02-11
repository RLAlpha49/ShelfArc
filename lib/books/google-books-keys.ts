/**
 * Returns a deduplicated list of Google Books API keys from environment variables.
 * @returns An array of unique API key strings.
 * @source
 */
export const getGoogleBooksApiKeys = () => {
  const rawKeys = process.env.GOOGLE_BOOKS_API_KEYS ?? ""
  const listKeys = rawKeys
    .split(/[\s,;]+/)
    .map((key) => key.trim())
    .filter(Boolean)

  const fallbackKey = process.env.GOOGLE_BOOKS_API_KEY?.trim()
  const mergedKeys = fallbackKey ? [...listKeys, fallbackKey] : listKeys

  return Array.from(new Set(mergedKeys))
}
