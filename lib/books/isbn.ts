export const normalizeIsbn = (value: string) =>
  value.toUpperCase().replaceAll(/[^0-9X]/g, "")

const isDigit = (value: string) => value >= "0" && value <= "9"

const getIsbn10CheckValue = (value: string) => {
  if (value === "X") return 10
  if (isDigit(value)) return Number(value)
  return null
}

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
