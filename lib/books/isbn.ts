/**
 * Strips non-ISBN characters and uppercases the result.
 * @param value - The raw ISBN string.
 * @returns The normalized ISBN string containing only digits and 'X'.
 * @source
 */
export const normalizeIsbn = (value: string) =>
  value.toUpperCase().replaceAll(/[^0-9X]/g, "")

/**
 * Checks whether a character is an ASCII digit.
 * @param value - Single character to test.
 * @source
 */
const isDigit = (value: string) => value >= "0" && value <= "9"

/**
 * Converts the ISBN-10 check character to its numeric value.
 * @param value - The character at position 9 of an ISBN-10.
 * @returns The numeric check value, or `null` if invalid.
 * @source
 */
const getIsbn10CheckValue = (value: string) => {
  if (value === "X") return 10
  if (isDigit(value)) return Number(value)
  return null
}

/**
 * Validates a normalized ISBN-10 string using the check-digit algorithm.
 * @param normalized - A 10-character normalized ISBN string.
 * @source
 */
const isValidIsbn10 = (normalized: string) => {
  if (normalized.length !== 10) return false

  let sum = 0
  for (let index = 0; index < 9; index += 1) {
    const digit = normalized[index]
    if (!isDigit(digit)) return false
    sum += Number(digit) * (10 - index)
  }

  const checkValue = getIsbn10CheckValue(normalized[9])
  if (checkValue === null) return false
  return (sum + checkValue) % 11 === 0
}

/**
 * Validates a normalized ISBN-13 string using the check-digit algorithm.
 * @param normalized - A 13-character normalized ISBN string.
 * @source
 */
const isValidIsbn13 = (normalized: string) => {
  if (!/^\d{13}$/.test(normalized)) return false

  const sum = normalized
    .slice(0, 12)
    .split("")
    .reduce(
      (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
      0
    )

  const checkValue = (10 - (sum % 10)) % 10
  return checkValue === Number(normalized[12])
}

/**
 * Validates a raw ISBN string (ISBN-10 or ISBN-13).
 * @param value - The raw ISBN string to validate.
 * @returns `true` if the ISBN is valid.
 * @source
 */
export const isValidIsbn = (value: string) => {
  const normalized = normalizeIsbn(value)

  if (normalized.length === 10) {
    return isValidIsbn10(normalized)
  }

  if (normalized.length === 13) {
    return isValidIsbn13(normalized)
  }

  return false
}
