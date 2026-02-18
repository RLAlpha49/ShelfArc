"use client"

import { useMemo } from "react"

/**
 * Returns a memoized Intl.NumberFormat instance for the given currency code.
 * Falls back to USD if the currency code is invalid.
 *
 * Centralizes price formatting, replacing repeated useMemo-based Intl.NumberFormat
 * constructions across dashboard pages and components.
 *
 * @param currency - ISO 4217 currency code, e.g. "USD", "EUR".
 * @source
 */
export function usePriceFormatter(currency: string): Intl.NumberFormat {
  return useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency
      })
    } catch {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD"
      })
    }
  }, [currency])
}
