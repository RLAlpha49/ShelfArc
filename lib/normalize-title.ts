/** Regex matching common volume/book number tokens (e.g. "Vol. 3", "Book 1"). */
const VOLUME_TOKEN_PATTERN =
  /\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*\d+(?:\.\d+)?\b/gi

/** Regex matching format suffixes in parentheses (e.g. "(Light Novel)", "(manga)"). */
const FORMAT_SUFFIX_PATTERN =
  /\s*\((?:light\s+novel|manga(?:\s+edition)?|ln|novel|omnibus|digital)\)\s*/gi

/** Regex matching a bare trailing number (e.g. "Attack on Titan 1"). */
const BARE_TRAILING_NUMBER_PATTERN = /\s+\d+(?:\.\d+)?\s*$/

/**
 * Strips volume-number tokens, format suffixes, and trailing noise from a
 * title for cleaner display.
 * @param title - The raw volume title.
 * @returns The cleaned title string.
 */
export const normalizeVolumeTitle = (title: string) => {
  const withoutToken = title.replaceAll(VOLUME_TOKEN_PATTERN, " ")
  const withoutFormat = withoutToken.replaceAll(FORMAT_SUFFIX_PATTERN, " ")
  const cleaned = withoutFormat
    .replaceAll(/\s*[-–—:,]\s*$/g, "")
    .replace(BARE_TRAILING_NUMBER_PATTERN, "")
    .replaceAll(/\s+/g, " ")
    .trim()
  return cleaned || title.trim()
}
