"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/format-date"
import { usePriceHistory } from "@/lib/hooks/use-price-history"
import { useSettingsStore } from "@/lib/store/settings-store"
import { cn } from "@/lib/utils"

/** Props for the {@link PriceHistoryCard} component. @source */
interface PriceHistoryCardProps {
  readonly volumeId: string
  readonly currency?: string
}

/**
 * Builds an SVG polyline points string from price history entries.
 * Takes the most recent 20 entries (reversed to chronological order)
 * and maps them into a viewBox-relative coordinate string.
 * @source
 */
function buildSparklinePath(
  prices: number[],
  width: number,
  height: number,
  padding = 4
): string {
  if (prices.length < 2) return ""
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const usableW = width - padding * 2
  const usableH = height - padding * 2

  return prices
    .map((p, i) => {
      const x = padding + (i / (prices.length - 1)) * usableW
      const y = padding + usableH - ((p - min) / range) * usableH
      return `${x},${y}`
    })
    .join(" ")
}

/**
 * Card displaying price history sparkline, current alert, and recent price entries
 * for a single volume. Uses the {@link usePriceHistory} hook for data fetching.
 * @param props - {@link PriceHistoryCardProps}
 * @source
 */
export function PriceHistoryCard({
  volumeId,
  currency = "USD"
}: PriceHistoryCardProps) {
  const {
    history,
    alert,
    isLoading,
    latestPrice,
    priceDelta,
    fetchHistory,
    fetchAlert,
    upsertAlert,
    removeAlert
  } = usePriceHistory(volumeId)

  const dateFormat = useSettingsStore((s) => s.dateFormat)

  const [alertInput, setAlertInput] = useState("")
  const [alertPending, setAlertPending] = useState(false)

  useEffect(() => {
    fetchHistory()
    fetchAlert()
  }, [fetchHistory, fetchAlert])

  // Seed alert input when an existing alert loads
  useEffect(() => {
    if (alert) setAlertInput(String(alert.target_price))
  }, [alert])

  const handleSetAlert = async () => {
    const target = Number.parseFloat(alertInput)
    if (!Number.isFinite(target) || target <= 0) {
      toast.error("Enter a valid target price")
      return
    }
    setAlertPending(true)
    try {
      await upsertAlert(target, currency)
      toast.success("Price alert saved")
    } catch {
      toast.error("Failed to save price alert")
    } finally {
      setAlertPending(false)
    }
  }

  const handleRemoveAlert = async () => {
    setAlertPending(true)
    try {
      await removeAlert()
      setAlertInput("")
      toast.success("Price alert removed")
    } catch {
      toast.error("Failed to remove price alert")
    } finally {
      setAlertPending(false)
    }
  }

  // Sparkline data — most recent 20 entries in chronological order
  const sparkPrices = history
    .slice(0, 20)
    .map((e) => e.price)
    .reverse()

  const recentEntries = history.slice(0, 5)
  const svgW = 240
  const svgH = 56

  if (isLoading) {
    return (
      <div className="glass-card animate-fade-in-down space-y-4 rounded-xl p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card animate-fade-in-down space-y-4 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold">Price History</h3>
          {latestPrice !== null && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Latest{" "}
              <span className="text-foreground font-medium">
                {latestPrice.toLocaleString(undefined, {
                  style: "currency",
                  currency
                })}
              </span>
            </p>
          )}
        </div>

        {priceDelta !== null && priceDelta !== 0 && (
          <Badge
            variant="secondary"
            className={cn(
              "rounded-lg text-xs",
              priceDelta > 0
                ? "bg-green-600/10 text-green-600"
                : "bg-red-500/10 text-red-500"
            )}
          >
            {priceDelta > 0 ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-0.5 h-3 w-3"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-0.5 h-3 w-3"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
            {Math.abs(priceDelta).toLocaleString(undefined, {
              style: "currency",
              currency
            })}
          </Badge>
        )}
      </div>

      {/* Sparkline */}
      {sparkPrices.length >= 2 && (
        <div className="bg-primary/5 overflow-hidden rounded-lg">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="h-14 w-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id={`spark-fill-${volumeId}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  className="text-primary"
                  stopColor="currentColor"
                  stopOpacity="0.2"
                />
                <stop
                  offset="100%"
                  className="text-primary"
                  stopColor="currentColor"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {/* Fill area */}
            <polygon
              points={`${buildSparklinePath(sparkPrices, svgW, svgH)} ${svgW - 4},${svgH - 4} 4,${svgH - 4}`}
              fill={`url(#spark-fill-${volumeId})`}
            />
            {/* Line */}
            <polyline
              points={buildSparklinePath(sparkPrices, svgW, svgH)}
              fill="none"
              className="text-primary"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {sparkPrices.length < 2 && (
        <div className="text-muted-foreground bg-primary/5 flex h-14 items-center justify-center rounded-lg text-xs">
          Not enough data for trend
        </div>
      )}

      {/* Alert Section */}
      <div className="from-gold/10 to-gold/5 space-y-2.5 rounded-lg bg-linear-to-r p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">
            {alert ? "Price Alert Active" : "Set Price Alert"}
          </span>
          {alert?.enabled && (
            <Badge
              variant="secondary"
              className="bg-gold/15 text-gold rounded-lg text-[10px]"
            >
              {alert.target_price.toLocaleString(undefined, {
                style: "currency",
                currency: alert.currency
              })}
            </Badge>
          )}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            handleSetAlert()
          }}
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Target price"
            value={alertInput}
            onChange={(e) => setAlertInput(e.target.value)}
            className="h-7 flex-1 text-xs"
            aria-label="Target price"
          />
          <Button
            type="submit"
            size="sm"
            className="h-7 px-2.5 text-xs"
            disabled={alertPending}
          >
            {alert ? "Update" : "Set"}
          </Button>
          {alert && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive h-7 px-2 text-xs"
              disabled={alertPending}
              onClick={handleRemoveAlert}
            >
              Remove
            </Button>
          )}
        </form>
      </div>

      {/* Recent History */}
      {recentEntries.length > 0 && (
        <div className="space-y-1">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Recent
          </span>
          <ul className="divide-border divide-y">
            {recentEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between py-1.5 text-xs"
              >
                <span className="text-muted-foreground">
                  {formatDate(entry.scraped_at, dateFormat)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground max-w-20 truncate text-[10px]">
                    {entry.source}
                  </span>
                  <span className="font-medium tabular-nums">
                    {entry.price.toLocaleString(undefined, {
                      style: "currency",
                      currency: entry.currency
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
