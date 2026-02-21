"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { RecommendationsCard } from "@/components/library/recommendations-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePriceFormatter } from "@/lib/hooks/use-price-formatter"
import type { SuggestedBuy, SuggestionCategory } from "@/lib/library/analytics"
import {
  computeSuggestedBuys,
  computeSuggestionCounts
} from "@/lib/library/analytics"
import { selectAllSeries, useLibraryStore } from "@/lib/store/library-store"

type FormatFilter = "all" | "light_novel" | "manga" | "other"
type WishlistFilter = "all" | "wishlisted" | "not_wishlisted"
type CategoryTab = "all" | SuggestionCategory

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  gap_fill: "Gap Fills",
  continue: "Continue",
  complete_series: "Complete Series",
  continue_reading: "Continue Reading"
}

export function RecommendationsClient({
  initialSuggestions
}: {
  readonly initialSuggestions: SuggestedBuy[]
}) {
  const series = useLibraryStore(selectAllSeries)
  const isLoaded = useLibraryStore((s) => s.lastFetchedAt !== null)
  const priceDisplayCurrency = useLibraryStore((s) => s.priceDisplayCurrency)
  const dismissedSuggestions = useLibraryStore((s) => s.dismissedSuggestions)

  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all")
  const [wishlistFilter, setWishlistFilter] = useState<WishlistFilter>("all")
  const [activeTab, setActiveTab] = useState<CategoryTab>("all")

  const priceFormatter = usePriceFormatter(priceDisplayCurrency)

  const dismissedSet = useMemo(
    () => new Set(dismissedSuggestions),
    [dismissedSuggestions]
  )

  const allSuggestions = useMemo(() => {
    if (isLoaded) return computeSuggestedBuys(series, undefined, dismissedSet)
    return initialSuggestions.filter((s) => !dismissedSet.has(s.seriesId))
  }, [isLoaded, series, initialSuggestions, dismissedSet])

  // Filtered by format/wishlist only (not by active tab) — used for tab badge counts
  // so that selecting a tab doesn't zero out the other tab badges.
  const filteredByFilters = useMemo(() => {
    return allSuggestions.filter((buy) => {
      if (formatFilter !== "all" && buy.seriesType !== formatFilter)
        return false
      if (wishlistFilter === "wishlisted" && !buy.isWishlisted) return false
      if (wishlistFilter === "not_wishlisted" && buy.isWishlisted) return false
      return true
    })
  }, [allSuggestions, formatFilter, wishlistFilter])

  const categoryCounts = useMemo(
    () => computeSuggestionCounts(filteredByFilters),
    [filteredByFilters]
  )

  const filtered = useMemo(() => {
    if (activeTab === "all") return filteredByFilters
    return filteredByFilters.filter((buy) => buy.category === activeTab)
  }, [filteredByFilters, activeTab])

  const stats = useMemo(() => {
    const totalCost = filteredByFilters.reduce(
      (acc, b) => acc + (b.estimatedPrice ?? 0),
      0
    )
    return { total: filteredByFilters.length, totalCost }
  }, [filteredByFilters])

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
          Recommendations
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

      {/* Summary stats */}
      <div className="animate-fade-in-up stagger-1 mb-6 grid grid-cols-2 gap-3">
        <div className="from-primary/12 to-primary/4 rounded-xl border bg-linear-to-br p-4">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Total Suggestions
          </span>
          <div className="text-primary font-display mt-0.5 text-2xl font-bold">
            {stats.total}
          </div>
        </div>
        <div className="from-copper/12 to-copper/4 rounded-xl border bg-linear-to-br p-4">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Est. Total Cost
          </span>
          <div className="text-copper font-display mt-0.5 text-2xl font-bold">
            {priceFormatter.format(stats.totalCost)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="animate-fade-in-up stagger-2 mb-6 flex flex-wrap gap-3">
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

      {/* Category tabs */}
      <div className="animate-fade-in-up stagger-3">
        <Tabs
          defaultValue="all"
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as CategoryTab)}
        >
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="gap_fill">
              Gaps ({categoryCounts.gap_fill})
            </TabsTrigger>
            <TabsTrigger value="continue_reading">
              Reading ({categoryCounts.continue_reading})
            </TabsTrigger>
            <TabsTrigger value="complete_series">
              Complete ({categoryCounts.complete_series})
            </TabsTrigger>
            <TabsTrigger value="continue">
              Continue ({categoryCounts.continue})
            </TabsTrigger>
          </TabsList>

          {(
            [
              "all",
              "gap_fill",
              "continue_reading",
              "complete_series",
              "continue"
            ] as const
          ).map((tab) => (
            <TabsContent key={tab} value={tab}>
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
                    {tab === "all"
                      ? "No suggestions match your filters"
                      : `No ${CATEGORY_LABELS[tab as SuggestionCategory].toLowerCase()} suggestions`}
                  </p>
                  <p className="text-muted-foreground/60 mt-1 text-xs">
                    Try adjusting the filters above
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((buy) => (
                    <RecommendationsCard
                      key={`${buy.seriesId}-${buy.volumeNumber}`}
                      suggestion={buy}
                      currencyFormatter={priceFormatter}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
