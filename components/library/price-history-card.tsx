"use client"

import { useEffect, useMemo, useState } from "react"
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

/** Available time range options for chart filtering. @source */
type TimeRange = "30d" | "90d" | "1y" | "all"

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
  { value: "all", label: "All" }
]

/** Returns a cutoff Date for filtering history entries by time range. @source */
function getCutoff(range: TimeRange): Date | null {
  if (range === "all") return null
  const now = new Date()
  if (range === "30d") return new Date(now.getTime() - 30 * 86_400_000)
  if (range === "90d") return new Date(now.getTime() - 90 * 86_400_000)
  return new Date(now.getTime() - 365 * 86_400_000)
}

/**
 * Builds an SVG polyline points string from price entries.
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

/** Maps a price value to a Y coordinate in the SVG viewBox. @source */
function priceToY(
  price: number,
  min: number,
  max: number,
  height: number,
  padding = 4
): number {
  const range = max - min || 1
  const usableH = height - padding * 2
  return padding + usableH - ((price - min) / range) * usableH
}

/**
 * Card displaying price history sparkline with min/max/avg annotations,
 * time range selector, alert threshold overlay, and recent price entries.
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

  const percentChange = useMemo(() => {
    if (priceDelta === null || latestPrice === null || priceDelta === 0)
      return null
    const previousPrice = latestPrice - priceDelta
    if (previousPrice === 0) return null
    return (Math.abs(priceDelta) / previousPrice) * 100
  }, [priceDelta, latestPrice])

  const dateFormat = useSettingsStore((s) => s.dateFormat)

  const [alertInput, setAlertInput] = useState("")
  const [alertPending, setAlertPending] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>("all")

  useEffect(() => {
    fetchHistory()
    fetchAlert()
  }, [fetchHistory, fetchAlert])

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

  // Filter history by time range, then take most recent entries in chronological order
  const filteredHistory = useMemo(() => {
    const cutoff = getCutoff(timeRange)
    if (!cutoff) return history
    return history.filter(
      (e) => new Date(e.scraped_at).getTime() >= cutoff.getTime()
    )
  }, [history, timeRange])

  const sparkPrices = useMemo(
    () => filteredHistory.map((e) => e.price).reverse(),
    [filteredHistory]
  )

  const stats = useMemo(() => {
    if (sparkPrices.length === 0) return null
    const min = Math.min(...sparkPrices)
    const max = Math.max(...sparkPrices)
    const avg = sparkPrices.reduce((s, p) => s + p, 0) / sparkPrices.length
    return { min, max, avg }
  }, [sparkPrices])

  const recentEntries = filteredHistory.slice(0, 5)
  const svgW = 240
  const svgH = 80

  if (isLoading) {
    return (
      <div className="glass-card animate-fade-in-down space-y-4 rounded-xl p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  const alertTargetPrice = alert?.enabled ? alert.target_price : null
  const pad = 4

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
            {percentChange !== null && ` (${percentChange.toFixed(1)}%)`}
          </Badge>
        )}
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setTimeRange(r.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              timeRange === r.value
                ? "bg-copper/15 text-copper"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Sparkline with annotations */}
      {sparkPrices.length >= 2 && stats ? (
        <div className="bg-primary/5 dark:bg-primary/10 relative overflow-hidden rounded-lg">
          {/* Stat labels */}
          <div className="text-muted-foreground pointer-events-none absolute top-1 right-2 flex gap-3 text-[9px]">
            <span>
              Min{" "}
              <span className="text-foreground font-medium tabular-nums">
                {stats.min.toLocaleString(undefined, {
                  style: "currency",
                  currency
                })}
              </span>
            </span>
            <span>
              Avg{" "}
              <span className="text-copper font-medium tabular-nums">
                {stats.avg.toLocaleString(undefined, {
                  style: "currency",
                  currency,
                  maximumFractionDigits: 2
                })}
              </span>
            </span>
            <span>
              Max{" "}
              <span className="text-foreground font-medium tabular-nums">
                {stats.max.toLocaleString(undefined, {
                  style: "currency",
                  currency
                })}
              </span>
            </span>
          </div>

          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="h-20 w-full"
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
                  className="text-copper"
                  stopColor="currentColor"
                  stopOpacity="0.2"
                />
                <stop
                  offset="100%"
                  className="text-copper"
                  stopColor="currentColor"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {/* Average reference line */}
            <line
              x1={pad}
              x2={svgW - pad}
              y1={priceToY(stats.avg, stats.min, stats.max, svgH, pad)}
              y2={priceToY(stats.avg, stats.min, stats.max, svgH, pad)}
              className="text-copper"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeDasharray="4 3"
              opacity="0.5"
            />

            {/* Min reference line */}
            <line
              x1={pad}
              x2={svgW - pad}
              y1={priceToY(stats.min, stats.min, stats.max, svgH, pad)}
              y2={priceToY(stats.min, stats.min, stats.max, svgH, pad)}
              className="text-muted-foreground"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2 4"
              opacity="0.35"
            />

            {/* Max reference line */}
            <line
              x1={pad}
              x2={svgW - pad}
              y1={priceToY(stats.max, stats.min, stats.max, svgH, pad)}
              y2={priceToY(stats.max, stats.min, stats.max, svgH, pad)}
              className="text-muted-foreground"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2 4"
              opacity="0.35"
            />

            {/* Alert threshold line */}
            {alertTargetPrice !== null &&
              alertTargetPrice >= stats.min &&
              alertTargetPrice <= stats.max && (
                <line
                  x1={pad}
                  x2={svgW - pad}
                  y1={priceToY(
                    alertTargetPrice,
                    stats.min,
                    stats.max,
                    svgH,
                    pad
                  )}
                  y2={priceToY(
                    alertTargetPrice,
                    stats.min,
                    stats.max,
                    svgH,
                    pad
                  )}
                  className="text-gold"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  opacity="0.7"
                />
              )}

            {/* Fill area */}
            <polygon
              points={`${buildSparklinePath(sparkPrices, svgW, svgH)} ${svgW - pad},${svgH - pad} ${pad},${svgH - pad}`}
              fill={`url(#spark-fill-${volumeId})`}
            />

            {/* Line */}
            <polyline
              points={buildSparklinePath(sparkPrices, svgW, svgH)}
              fill="none"
              className="text-copper"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : (
        <div className="text-muted-foreground bg-primary/5 dark:bg-primary/10 flex h-20 items-center justify-center rounded-lg text-xs">
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
