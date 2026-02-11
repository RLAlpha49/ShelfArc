"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryStore } from "@/lib/store/library-store"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

interface SuggestedBuy {
  seriesId: string
  seriesTitle: string
  seriesType: string
  volumeNumber: number
  isGap: boolean
  isWishlisted: boolean
  estimatedPrice: number | null
  score: number
  isReading: boolean
}

type FormatFilter = "all" | "light_novel" | "manga" | "other"
type PriorityFilter = "all" | "gaps" | "next" | "reading"
type WishlistFilter = "all" | "wishlisted" | "not_wishlisted"

export default function SuggestionsPage() {
  const { series, fetchSeries, isLoading } = useLibrary()
  const priceDisplayCurrency = useLibraryStore((s) => s.priceDisplayCurrency)

  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all")
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [wishlistFilter, setWishlistFilter] = useState<WishlistFilter>("all")

  useEffect(() => {
    if (series.length === 0) fetchSeries()
  }, [series.length, fetchSeries])

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

  const allSuggestions = useMemo(() => {
    const suggestions: SuggestedBuy[] = []

    const computeScore = (
      isGap: boolean,
      isReading: boolean,
      ownedCount: number,
      hasPrice: boolean
    ) => {
      let score = isGap ? 20 : 10
      if (isReading) score += 30
      score += ownedCount
      if (hasPrice) score += 5
      return score
    }

    const makeSuggestion = (
      s: SeriesWithVolumes,
      volumeNumber: number,
      isGap: boolean,
      wishlistMap: Map<number, Volume>,
      isReading: boolean,
      ownedCount: number
    ): SuggestedBuy => {
      const wishlistVol = wishlistMap.get(volumeNumber)
      return {
        seriesId: s.id,
        seriesTitle: s.title,
        seriesType: s.type,
        volumeNumber,
        isGap,
        isWishlisted: wishlistMap.has(volumeNumber),
        estimatedPrice: wishlistVol?.purchase_price ?? null,
        score: computeScore(
          isGap,
          isReading,
          ownedCount,
          !!wishlistVol?.purchase_price
        ),
        isReading
      }
    }

    for (const s of series) {
      const ownedVolumes = s.volumes.filter(
        (v) => v.ownership_status === "owned"
      )
      if (ownedVolumes.length === 0) continue

      const ownedNumbers = new Set(ownedVolumes.map((v) => v.volume_number))
      const wishlistMap = new Map(
        s.volumes
          .filter((v) => v.ownership_status === "wishlist")
          .map((v) => [v.volume_number, v] as const)
      )
      const isReading = s.volumes.some((v) => v.reading_status === "reading")
      const maxOwned = Math.max(...ownedNumbers)

      for (let i = 1; i < maxOwned; i++) {
        if (!ownedNumbers.has(i)) {
          suggestions.push(
            makeSuggestion(
              s,
              i,
              true,
              wishlistMap,
              isReading,
              ownedVolumes.length
            )
          )
        }
      }

      const nextNum = maxOwned + 1
      const isInRange = !s.total_volumes || nextNum <= s.total_volumes
      if (!ownedNumbers.has(nextNum) && isInRange) {
        suggestions.push(
          makeSuggestion(
            s,
            nextNum,
            false,
            wishlistMap,
            isReading,
            ownedVolumes.length
          )
        )
      }
    }

    return suggestions.toSorted((a, b) => b.score - a.score)
  }, [series])

  const filtered = useMemo(() => {
    return allSuggestions.filter((buy) => {
      if (formatFilter !== "all" && buy.seriesType !== formatFilter)
        return false
      if (priorityFilter === "gaps" && !buy.isGap) return false
      if (priorityFilter === "next" && buy.isGap) return false
      if (priorityFilter === "reading" && !buy.isReading) return false
      if (wishlistFilter === "wishlisted" && !buy.isWishlisted) return false
      if (wishlistFilter === "not_wishlisted" && buy.isWishlisted) return false
      return true
    })
  }, [allSuggestions, formatFilter, priorityFilter, wishlistFilter])

  const stats = useMemo(() => {
    const gapsCount = filtered.filter((b) => b.isGap).length
    const totalCost = filtered.reduce(
      (acc, b) => acc + (b.estimatedPrice ?? 0),
      0
    )
    return { total: filtered.length, gapsCount, totalCost }
  }, [filtered])

  if (isLoading && series.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
        <Skeleton className="mb-1 h-4 w-32" />
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="mb-6 flex gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="space-y-px overflow-hidden rounded-xl border">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-none" />
          ))}
        </div>
      </div>
    )
  }

  const formatLabel = (type: string) => {
    if (type === "light_novel") return "Light Novel"
    if (type === "manga") return "Manga"
    return "Other"
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
          Suggestions
        </span>
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight md:text-4xl">
          What to{" "}
          <span className="text-gradient from-copper to-gold bg-linear-to-r">
            Buy Next
          </span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Personalized purchase suggestions based on your collection
        </p>
      </section>

      {/* Filters */}
      <div className="animate-fade-in-up stagger-1 mb-6 flex flex-wrap gap-3">
        <div className="space-y-1">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Format
          </span>
          <Select
            value={formatFilter}
            onValueChange={(v) => setFormatFilter(v as FormatFilter)}
          >
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              <SelectItem value="light_novel">Light Novel</SelectItem>
              <SelectItem value="manga">Manga</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Priority
          </span>
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="gaps">Gaps Only</SelectItem>
              <SelectItem value="next">Next Volume</SelectItem>
              <SelectItem value="reading">Currently Reading</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Wishlist
          </span>
          <Select
            value={wishlistFilter}
            onValueChange={(v) => setWishlistFilter(v as WishlistFilter)}
          >
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="wishlisted">Wishlisted</SelectItem>
              <SelectItem value="not_wishlisted">Not Wishlisted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary stats */}
      <div className="animate-fade-in-up stagger-2 mb-6 grid grid-cols-3 gap-3">
        <div className="from-primary/12 to-primary/4 rounded-xl border bg-linear-to-br p-4">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Suggestions
          </span>
          <div className="text-primary font-display mt-0.5 text-2xl font-bold">
            {stats.total}
          </div>
        </div>
        <div className="from-copper/12 to-copper/4 rounded-xl border bg-linear-to-br p-4">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Est. Cost
          </span>
          <div className="text-copper font-display mt-0.5 text-2xl font-bold">
            {priceFormatter.format(stats.totalCost)}
          </div>
        </div>
        <div className="rounded-xl border bg-linear-to-br from-amber-500/12 to-amber-500/4 p-4">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Gaps
          </span>
          <div className="font-display mt-0.5 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.gapsCount}
          </div>
        </div>
      </div>

      {/* Suggestions list */}
      <div className="animate-fade-in-up stagger-3">
        {filtered.length === 0 ? (
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
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <line x1="3" x2="21" y1="6" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">
              No suggestions match your filters
            </p>
            <p className="text-muted-foreground/60 mt-1 text-xs">
              Try adjusting the filters above
            </p>
          </div>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-xl border">
            {filtered.map((buy) => (
              <Link
                key={`${buy.seriesId}-${buy.volumeNumber}`}
                href={`/library/series/${buy.seriesId}`}
                className="bg-card group hover:bg-accent/60 flex items-center justify-between p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                      {buy.seriesTitle}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      Vol. {buy.volumeNumber}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {formatLabel(buy.seriesType)}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                    {buy.isGap && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Gap
                      </span>
                    )}
                    {buy.isWishlisted && (
                      <span className="bg-gold/10 text-gold rounded px-1.5 py-0.5 text-[10px] font-medium">
                        Wishlisted
                      </span>
                    )}
                    {buy.isReading && (
                      <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                        Reading
                      </span>
                    )}
                    {buy.estimatedPrice != null && buy.estimatedPrice > 0 && (
                      <span className="text-muted-foreground/60">
                        {priceFormatter.format(buy.estimatedPrice)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
