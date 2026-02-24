"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { CoverImage } from "@/components/library/cover-image"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useEnsureLibraryLoaded } from "@/lib/hooks/use-ensure-library-loaded"
import { usePriceFormatter } from "@/lib/hooks/use-price-formatter"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
import { useLibraryStore } from "@/lib/store/library-store"
import type { SeriesWithVolumes } from "@/lib/types/database"

type SortKey = "az" | "price-asc" | "price-desc" | "recent"

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "az", label: "A–Z" },
  { key: "price-asc", label: "Price ↑" },
  { key: "price-desc", label: "Price ↓" }
]

export function WishlistClient({
  initialSeries
}: {
  readonly initialSeries: SeriesWithVolumes[]
}) {
  const { series: storeSeries, isLoading } = useEnsureLibraryLoaded()
  const hasFetchedOnce = useLibraryStore((s) => s.hasFetchedOnce)
  // Use server-prefetched data for the first paint; switch to the reactive
  // store once the client has completed its first fetch.
  const series = hasFetchedOnce ? storeSeries : initialSeries

  const priceDisplayCurrency = useLibraryStore((s) => s.priceDisplayCurrency)
  const [tab, setTab] = useState<"wishlist" | "owned">("wishlist")
  const [sortBy, setSortBy] = useState<SortKey>("recent")

  const priceFormatter = usePriceFormatter(priceDisplayCurrency)
  const [removedIds, setRemovedIds] = useState(new Set<string>())

  const handleMarkOwned = async (volumeId: string, seriesId: string) => {
    setRemovedIds((prev) => new Set(prev).add(volumeId))
    try {
      const res = await fetch(`/api/library/volumes/${volumeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownership_status: "owned" })
      })
      if (!res.ok) throw new Error("Failed to update volume")
      useLibraryStore.getState().updateVolume(seriesId, volumeId, {
        ownership_status: "owned"
      })
    } catch {
      setRemovedIds((prev) => {
        const next = new Set(prev)
        next.delete(volumeId)
        return next
      })
      toast.error("Failed to mark as owned. Please try again.")
    }
  }

  const { wishlist, owned } = useMemo(() => {
    const all = series.flatMap((s) =>
      s.volumes.map((v) => ({ ...v, seriesTitle: s.title, seriesId: s.id }))
    )

    return {
      wishlist: all.filter((v) => v.ownership_status === "wishlist"),
      owned: all.filter((v) => v.ownership_status === "owned")
    }
  }, [series])

  const items = useMemo(() => {
    const base = (tab === "wishlist" ? wishlist : owned).filter(
      (v) => !removedIds.has(v.id)
    )
    return [...base].sort((a, b) => {
      if (sortBy === "price-asc")
        return (a.purchase_price ?? 0) - (b.purchase_price ?? 0)
      if (sortBy === "price-desc")
        return (b.purchase_price ?? 0) - (a.purchase_price ?? 0)
      if (sortBy === "recent") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }
      return (
        a.seriesTitle.localeCompare(b.seriesTitle) ||
        a.volume_number - b.volume_number
      )
    })
  }, [wishlist, owned, tab, sortBy, removedIds])

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
          Collection
        </span>
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight md:text-4xl">
          <span className="text-gradient from-copper to-gold bg-linear-to-r">
            Wishlist
          </span>{" "}
          &amp; Owned
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {wishlist.length} wishlisted · {owned.length} owned
        </p>
      </section>

      {/* Tab toggle + sort controls */}
      <div className="animate-fade-in-up stagger-1 mb-6 space-y-3">
        <div className="bg-muted inline-flex rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setTab("wishlist")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "wishlist"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Wishlist ({wishlist.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("owned")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "owned"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Owned ({owned.length})
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground mr-1 text-[11px] font-medium">
            Sort:
          </span>
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={
                sortBy === key
                  ? "bg-primary/10 text-primary rounded-md px-2.5 py-1 text-xs font-medium"
                  : "text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Volume list */}
      <div className="animate-fade-in-up stagger-2">
        {items.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
            <div className="text-gold bg-gold/10 mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">
              {tab === "wishlist"
                ? "No wishlisted volumes yet"
                : "No owned volumes yet"}
            </p>
          </div>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-xl border">
            {items.map((v) => {
              const displayTitle = v.title
                ? normalizeVolumeTitle(v.title)
                : null
              return (
                <div
                  key={v.id}
                  className="bg-card group hover:bg-accent/60 flex items-center gap-3 p-4 transition-colors"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded">
                    <CoverImage
                      isbn={v.isbn}
                      coverImageUrl={v.cover_image_url}
                      alt={`${v.seriesTitle} Vol. ${v.volume_number}`}
                      className="h-14 w-10 rounded object-cover"
                    />
                  </div>
                  <Link
                    href={`/library/volume/${v.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2"
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
                          </span>
                        )}
                        {v.purchase_price != null && v.purchase_price > 0 && (
                          <span className="text-primary/80 font-medium">
                            {displayTitle && " · "}
                            {priceFormatter.format(v.purchase_price)}
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
                  {tab === "wishlist" && (
                    <button
                      type="button"
                      onClick={() => handleMarkOwned(v.id, v.seriesId)}
                      className="bg-primary/10 text-primary hover:bg-primary/20 shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                      aria-label={`Mark ${v.seriesTitle} Vol. ${v.volume_number} as owned`}
                    >
                      Mark Owned
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
