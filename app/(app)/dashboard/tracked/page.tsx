"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/format-date"
import { useLibrary } from "@/lib/hooks/use-library"
import { usePriceFormatter } from "@/lib/hooks/use-price-formatter"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"

export default function TrackedPage() {
  const { series, fetchSeries, isLoading } = useLibrary()
  const priceDisplayCurrency = useLibraryStore((s) => s.priceDisplayCurrency)
  const dateFormat = useSettingsStore((s) => s.dateFormat)
  const [tab, setTab] = useState<"priced" | "unpriced">("priced")

  useEffect(() => {
    if (series.length === 0) fetchSeries()
  }, [series.length, fetchSeries])

  const priceFormatter = usePriceFormatter(priceDisplayCurrency)

  const { priced, unpriced } = useMemo(() => {
    const owned = series.flatMap((s) =>
      s.volumes
        .filter((v) => v.ownership_status === "owned")
        .map((v) => ({ ...v, seriesTitle: s.title, seriesId: s.id }))
    )

    return {
      priced: owned
        .filter((v) => v.purchase_price != null && v.purchase_price > 0)
        .sort((a, b) => b.purchase_price! - a.purchase_price!),
      unpriced: owned
        .filter((v) => v.purchase_price == null || v.purchase_price <= 0)
        .sort(
          (a, b) =>
            a.seriesTitle.localeCompare(b.seriesTitle) ||
            a.volume_number - b.volume_number
        )
    }
  }, [series])

  const items = tab === "priced" ? priced : unpriced

  if (isLoading && series.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
        <Skeleton className="mb-1 h-4 w-32" />
        <Skeleton className="mb-6 h-10 w-64" />
        <Skeleton className="mb-6 h-9 w-48" />
        <div className="space-y-px overflow-hidden rounded-xl border">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-none" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
      {/* Header */}
      <section className="animate-fade-in-down mb-8">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-primary mb-3 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3.5 w-3.5"
          >
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Back to Dashboard
        </Link>
        <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
          Price Tracking
        </span>
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight md:text-4xl">
          <span className="text-gradient from-copper to-gold bg-linear-to-r">
            Tracked
          </span>{" "}
          Volumes
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {priced.length} priced · {unpriced.length} unpriced ·{" "}
          {priced.length + unpriced.length} total owned
        </p>
      </section>

      {/* Tab toggle */}
      <div className="animate-fade-in-up stagger-1 mb-6">
        <div className="bg-muted inline-flex rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setTab("priced")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "priced"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Priced ({priced.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("unpriced")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "unpriced"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unpriced ({unpriced.length})
          </button>
        </div>
      </div>

      {/* Volume list */}
      <div className="animate-fade-in-up stagger-2">
        {items.length === 0 ? (
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
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">
              {tab === "priced"
                ? "No volumes with prices tracked yet"
                : "All owned volumes have prices — nice!"}
            </p>
          </div>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-xl border">
            {items.map((v) => {
              const displayTitle = v.title
                ? normalizeVolumeTitle(v.title)
                : null
              return (
                <Link
                  key={v.id}
                  href={`/library/volume/${v.id}`}
                  className="bg-card group hover:bg-accent/60 flex items-center justify-between p-4 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                        {v.seriesTitle}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        Vol. {v.volume_number}
                      </span>
                      {v.format && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
                          {v.format}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {displayTitle && (
                        <span className="text-muted-foreground/80">
                          {displayTitle}
                          {" · "}
                        </span>
                      )}
                      {v.purchase_price != null && v.purchase_price > 0 && (
                        <span className="text-primary/80 font-medium">
                          {priceFormatter.format(v.purchase_price)}
                          {" · "}
                        </span>
                      )}
                      {v.purchase_date && (
                        <span className="text-muted-foreground/60">
                          {formatDate(v.purchase_date, dateFormat)}
                        </span>
                      )}
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
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
