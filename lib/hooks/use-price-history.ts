"use client"

import { useCallback, useState } from "react"
import type { PriceHistory, PriceAlert } from "@/lib/types/database"

/** Persist a price entry via the API (standalone, no hook needed). */
export async function persistPriceEntry(
  volumeId: string,
  price: number,
  currency = "USD",
  source = "amazon"
) {
  const res = await fetch("/api/books/price/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volumeId, price, currency, source })
  })
  if (!res.ok) throw new Error("Failed to save price")
  return res.json()
}

/** Fetch active alert for a volume and trigger it if the price qualifies. */
export async function checkPriceAlert(
  volumeId: string,
  price: number
): Promise<boolean> {
  try {
    const alertRes = await fetch(
      "/api/books/price/alerts?volumeId=" + encodeURIComponent(volumeId)
    )
    if (!alertRes.ok) return false
    const { data } = await alertRes.json()
    const alert =
      Array.isArray(data) && data.length > 0 ? data[0] : null
    if (!alert?.enabled || price > alert.target_price) return false
    const triggerRes = await fetch("/api/books/price/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: alert.id })
    })
    return triggerRes.ok
  } catch {
    return false
  }
}

export function usePriceHistory(volumeId: string) {
  const [history, setHistory] = useState<PriceHistory[]>([])
  const [activeAlert, setActiveAlert] = useState<PriceAlert | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        "/api/books/price/history?volumeId=" + encodeURIComponent(volumeId)
      )
      if (!res.ok) return
      const { data } = await res.json()
      setHistory(data ?? [])
    } finally {
      setIsLoading(false)
    }
  }, [volumeId])

  const fetchAlert = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/books/price/alerts?volumeId=" + encodeURIComponent(volumeId)
      )
      if (!res.ok) return
      const { data } = await res.json()
      setActiveAlert(Array.isArray(data) && data.length > 0 ? data[0] : null)
    } catch {
      // Ignore
    }
  }, [volumeId])

  const latestPrice = history.length > 0 ? history[0].price : null
  const previousPrice = history.length > 1 ? history[1].price : null
  const priceDelta =
    latestPrice !== null && previousPrice !== null
      ? latestPrice - previousPrice
      : null

  const checkAlert = useCallback(
    async (price: number): Promise<boolean> => {
      if (
        !activeAlert?.enabled ||
        price > activeAlert.target_price
      ) {
        return false
      }
      try {
        const res = await fetch("/api/books/price/alerts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: activeAlert.id })
        })
        if (!res.ok) return false
        const { data } = await res.json()
        setActiveAlert(data ?? null)
        return true
      } catch {
        return false
      }
    },
    [activeAlert]
  )

  const persistPrice = useCallback(
    async (price: number, currency?: string, source?: string) => {
      const res = await fetch("/api/books/price/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volumeId,
          price,
          currency: currency ?? "USD",
          source: source ?? "amazon"
        })
      })
      if (!res.ok) throw new Error("Failed to save price")
      const result = await res.json()
      const alertTriggered = await checkAlert(price)
      await fetchHistory()
      return { ...result, alertTriggered }
    },
    [volumeId, checkAlert, fetchHistory]
  )

  const upsertAlert = useCallback(
    async (targetPrice: number, currency?: string) => {
      const res = await fetch("/api/books/price/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volumeId,
          targetPrice,
          currency: currency ?? "USD"
        })
      })
      if (!res.ok) throw new Error("Failed to save alert")
      const { data } = await res.json()
      setActiveAlert(data ?? null)
      await fetchAlert()
    },
    [volumeId, fetchAlert]
  )

  const removeAlert = useCallback(async () => {
    if (!activeAlert) return
    const res = await fetch(
      "/api/books/price/alerts?id=" + encodeURIComponent(activeAlert.id),
      { method: "DELETE" }
    )
    if (!res.ok) throw new Error("Failed to delete alert")
    setActiveAlert(null)
    await fetchAlert()
  }, [activeAlert, fetchAlert])

  return {
    history,
    alert: activeAlert,
    isLoading,
    latestPrice,
    priceDelta,
    fetchHistory,
    fetchAlert,
    persistPrice,
    checkAlert,
    upsertAlert,
    removeAlert
  }
}
