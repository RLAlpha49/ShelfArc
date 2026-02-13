"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useLibraryStore } from "@/lib/store/library-store"
import { formatDate } from "@/lib/format-date"
import { useSettingsStore } from "@/lib/store/settings-store"
import type { PriceAlert } from "@/lib/types/database"
import { Skeleton } from "@/components/ui/skeleton"

interface AlertWithInfo extends PriceAlert {
  volumeTitle: string
  seriesTitle: string
}

export function PriceAlertsDashboardCard() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const series = useLibraryStore((s) => s.series)
  const priceDisplayCurrency = useLibraryStore(
    (s) => s.priceDisplayCurrency
  )
  const dateFormat = useSettingsStore((s) => s.dateFormat)

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/books/price/alerts")
      if (!res.ok) return
      const { data } = await res.json()
      setAlerts(data ?? [])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const priceFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: priceDisplayCurrency
      })
    } catch {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD"
      })
    }
  }, [priceDisplayCurrency])

  const volumeMap = useMemo(() => {
    const map = new Map<
      string,
      { volumeTitle: string; seriesTitle: string }
    >()
    for (const s of series) {
      for (const v of s.volumes) {
        map.set(v.id, {
          volumeTitle: v.title || `Volume ${v.volume_number}`,
          seriesTitle: s.title
        })
      }
    }
    return map
  }, [series])

  const enrichAlert = useCallback(
    (alert: PriceAlert): AlertWithInfo => {
      const info = volumeMap.get(alert.volume_id)
      return {
        ...alert,
        volumeTitle: info?.volumeTitle ?? "Unknown volume",
        seriesTitle: info?.seriesTitle ?? ""
      }
    },
    [volumeMap]
  )

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.enabled).map(enrichAlert),
    [alerts, enrichAlert]
  )

  const recentTriggers = useMemo(
    () =>
      alerts
        .filter((a) => a.triggered_at !== null)
        .sort(
          (a, b) =>
            new Date(b.triggered_at!).getTime() -
            new Date(a.triggered_at!).getTime()
        )
        .slice(0, 5)
        .map(enrichAlert),
    [alerts, enrichAlert]
  )

  if (isLoading) {
    return (
      <div className="glass-card space-y-3 rounded-xl p-5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
        <div className="text-primary bg-primary/8 mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">No price alerts set</p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          Set alerts on volume pages to get notified of price drops
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div>
          <span className="text-muted-foreground mb-2 block text-[10px] font-medium tracking-wider uppercase">
            Active Alerts
          </span>
          <div className="grid gap-px overflow-hidden rounded-xl border">
            {activeAlerts.map((a) => (
              <Link
                key={a.id}
                href={`/library/volume/${a.volume_id}`}
                className="bg-card group hover:bg-accent/60 flex items-center justify-between p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                    {a.volumeTitle}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {a.seriesTitle}
                    <span className="text-muted-foreground/60">
                      {" "}
                      · Target {priceFormatter.format(a.target_price)}
                    </span>
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground/40 group-hover:text-primary ml-3 h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5"
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Triggers */}
      {recentTriggers.length > 0 && (
        <div>
          <span className="text-muted-foreground mb-2 block text-[10px] font-medium tracking-wider uppercase">
            Recent Triggers
          </span>
          <div className="grid gap-px overflow-hidden rounded-xl border">
            {recentTriggers.map((a) => (
              <Link
                key={a.id}
                href={`/library/volume/${a.volume_id}`}
                className="bg-card group hover:bg-accent/60 flex items-center justify-between p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                    {a.volumeTitle}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {a.seriesTitle}
                    <span className="text-muted-foreground/60">
                      {" "}
                      · {priceFormatter.format(a.target_price)}
                      {" · "}
                      {formatDate(a.triggered_at, dateFormat)}
                    </span>
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground/40 group-hover:text-primary ml-3 h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5"
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Summary when both sections empty but alerts exist (all disabled, none triggered) */}
      {activeAlerts.length === 0 && recentTriggers.length === 0 && (
        <div className="text-muted-foreground py-6 text-center text-sm">
          {alerts.length} alert{alerts.length === 1 ? "" : "s"} — none active
        </div>
      )}
    </div>
  )
}
