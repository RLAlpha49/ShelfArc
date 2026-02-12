"use client"

import { useCallback, useState } from "react"
import type { PriceHistory, PriceAlert } from "@/lib/types/database"

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
      return res.json()
    },
    [volumeId]
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
    },
    [volumeId]
  )

  const removeAlert = useCallback(async () => {
    if (!activeAlert) return
    const res = await fetch(
      "/api/books/price/alerts?id=" + encodeURIComponent(activeAlert.id),
      { method: "DELETE" }
    )
    if (!res.ok) throw new Error("Failed to delete alert")
    setActiveAlert(null)
  }, [activeAlert])

  return {
    history,
    alert: activeAlert,
    isLoading,
    latestPrice,
    priceDelta,
    fetchHistory,
    fetchAlert,
    persistPrice,
    upsertAlert,
    removeAlert
  }
}
