"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type { DateFormat } from "@/lib/store/settings-store"
import { formatDate } from "@/lib/format-date"
import { Skeleton } from "@/components/ui/skeleton"
import { PriceAlertsDashboardCard } from "@/components/library/price-alerts-dashboard-card"
import type { SeriesWithVolumes } from "@/lib/types/database"
import type { AugmentedVolume } from "@/lib/library/analytics"
import {
  computeCollectionStats,
  computePriceBreakdown,
  computeWishlistStats,
  computeSuggestedBuys,
  getRecentSeries,
  getRecentVolumes,
  getCurrentlyReading
} from "@/lib/library/analytics"

/** Empty state shown when the user has no series yet. @source */
function RecentSeriesEmpty() {
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
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      </div>
      <p className="text-muted-foreground text-sm">No series added yet</p>
      <Link
        href="/library"
        className="text-primary hover:text-primary/80 mt-2 inline-flex items-center gap-1 text-sm font-medium transition-colors"
      >
        Add your first series
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-3.5 w-3.5"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}

/**
 * Renders a list of recently added series.
 * @param items - Series entries to display.
 * @param dateFormat - User's preferred date format.
 * @source
 */
function RecentSeriesList({
  items,
  dateFormat
}: {
  readonly items: readonly SeriesWithVolumes[]
  readonly dateFormat: DateFormat
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border">
      {items.map((s) => (
        <Link
          key={s.id}
          href={`/library/series/${s.id}`}
          className="bg-card group hover:bg-accent/60 flex items-center justify-between p-4 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
              {s.title}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {s.type === "light_novel" ? "Light Novel" : "Manga"} ·{" "}
              {s.volumes.length} vol
              {s.author && (
                <span className="text-muted-foreground/60"> · {s.author}</span>
              )}
              <span className="text-muted-foreground/60">
                {" "}
                · {formatDate(s.created_at, dateFormat)}
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
  )
}

/** Empty state shown when the user has no volumes yet. @source */
function RecentVolumesEmpty() {
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
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      </div>
      <p className="text-muted-foreground text-sm">No volumes added yet</p>
    </div>
  )
}

/**
 * Renders a list of recently added volumes.
 * @param items - Volume entries to display.
 * @param priceFormatter - Intl formatter for currency values.
 * @param dateFormat - User's preferred date format.
 * @source
 */
function RecentVolumesList({
  items,
  priceFormatter,
  dateFormat
}: {
  readonly items: readonly AugmentedVolume[]
  readonly priceFormatter: Intl.NumberFormat
  readonly dateFormat: DateFormat
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border">
      {items.map((v) => (
        <Link
          key={v.id}
          href={`/library/volume/${v.id}`}
          className="bg-card group hover:bg-accent/60 flex items-center justify-between p-4 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
              {v.title || `Volume ${v.volume_number}`}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {v.seriesTitle} · Vol. {v.volume_number}
              {v.purchase_price != null && v.purchase_price > 0 && (
                <span className="text-muted-foreground/60">
                  {" "}
                  · {priceFormatter.format(v.purchase_price)}
                </span>
              )}
              <span className="text-muted-foreground/60">
                {" "}
                · {formatDate(v.created_at, dateFormat)}
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
  )
}

/**
 * Switches between the recent series and recent volumes lists.
 * @param tab - Active tab identifier.
 * @param recentSeries - Series items for the "series" tab.
 * @param recentVolumes - Volume items for the "volumes" tab.
 * @param priceFormatter - Intl formatter for currency values.
 * @param dateFormat - User's preferred date format.
 * @source
 */
function RecentlyAddedContent({
  tab,
  recentSeries,
  recentVolumes,
  priceFormatter,
  dateFormat
}: {
  readonly tab: "series" | "volumes"
  readonly recentSeries: readonly SeriesWithVolumes[]
  readonly recentVolumes: readonly AugmentedVolume[]
  readonly priceFormatter: Intl.NumberFormat
  readonly dateFormat: DateFormat
}) {
  if (tab === "series") {
    if (recentSeries.length === 0) return <RecentSeriesEmpty />
    return <RecentSeriesList items={recentSeries} dateFormat={dateFormat} />
  }
  if (recentVolumes.length === 0) return <RecentVolumesEmpty />
  return (
    <RecentVolumesList
      items={recentVolumes}
      priceFormatter={priceFormatter}
      dateFormat={dateFormat}
    />
  )
}

/**
 * Dashboard page displaying collection stats, reading progress, price tracking, and suggested purchases.
 * @source
 */
export default function DashboardPage() {
  const { series, fetchSeries, isLoading } = useLibrary()
  const priceDisplayCurrency = useLibraryStore(
    (state) => state.priceDisplayCurrency
  )
  const dateFormat = useSettingsStore((s) => s.dateFormat)

  useEffect(() => {
    if (series.length === 0) {
      fetchSeries()
    }
  }, [series.length, fetchSeries])

  const stats = useMemo(() => computeCollectionStats(series), [series])

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

  const recentSeries = useMemo(() => getRecentSeries(series), [series])

  const currentlyReading = useMemo(
    () => getCurrentlyReading(series),
    [series]
  )

  // Recently added volumes (across all series)
  const recentVolumes = useMemo(() => getRecentVolumes(series), [series])

  // Recently added tab state
  const [recentTab, setRecentTab] = useState<"series" | "volumes">("series")

  // Price tracking breakdown
  const priceBreakdown = useMemo(
    () => computePriceBreakdown(series),
    [series]
  )

  // Wishlist stats
  const wishlistStats = useMemo(
    () => computeWishlistStats(series),
    [series]
  )

  // What to buy next suggestions
  const suggestedNextBuys = useMemo(
    () => computeSuggestedBuys(series, 8),
    [series]
  )

  // Reading completion percentage
  const readPercentage =
    stats.totalVolumes > 0
      ? Math.round((stats.readVolumes / stats.totalVolumes) * 100)
      : 0
  const ownedPercentage =
    stats.totalVolumes > 0
      ? Math.round((stats.ownedVolumes / stats.totalVolumes) * 100)
      : 0

  if (isLoading && series.length === 0) {
    return (
      <div className="dashboard-container mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <Skeleton className="mb-1 h-8 w-36" />
        <Skeleton className="mb-10 h-12 w-80" />
        <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-none" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <Skeleton className="h-96 rounded-xl lg:col-span-7" />
          <Skeleton className="h-96 rounded-xl lg:col-span-5" />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container mx-auto max-w-7xl px-6 py-10 lg:px-10">
      {/* ── Welcome header ── */}
      <section className="animate-fade-in-down mb-10">
        <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
          Dashboard
        </span>
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight md:text-5xl">
          Your{" "}
          <span className="text-gradient from-copper to-gold bg-linear-to-r">
            collection
          </span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg text-base leading-relaxed">
          {stats.totalSeries > 0
            ? `${stats.totalSeries} series · ${stats.totalVolumes} volumes · ${stats.readingVolumes} in progress`
            : "Start building your library to see your collection stats here."}
        </p>
      </section>

      {/* ── Stats strip ── */}
      <section className="animate-fade-in-up stagger-1 mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border md:grid-cols-4">
        {[
          {
            id: "series",
            label: "Series",
            value: stats.totalSeries,
            detail: `${stats.lightNovelSeries} LN · ${stats.mangaSeries} Manga`,
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            )
          },
          {
            id: "volumes",
            label: "Volumes",
            value: stats.totalVolumes,
            detail: `${stats.ownedVolumes} owned · ${ownedPercentage}%`,
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            )
          },
          {
            id: "read",
            label: "Read",
            value: stats.readVolumes,
            detail: `${readPercentage}% complete`,
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )
          },
          {
            id: "spent",
            label: "Invested",
            value: priceFormatter.format(stats.totalSpent),
            detail: `${priceFormatter.format(stats.averagePricePerTrackedVolume)}/priced vol`,
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            )
          }
        ].map((stat) => (
          <div
            key={stat.id}
            className="bg-card group hover:bg-accent/60 flex flex-col gap-1 p-5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="text-primary bg-primary/8 flex h-6 w-6 items-center justify-center rounded-md">
                {stat.icon}
              </div>
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                {stat.label}
              </span>
            </div>
            <div className="font-display text-2xl font-bold tracking-tight">
              {stat.value}
            </div>
            <div className="text-muted-foreground text-xs">{stat.detail}</div>
          </div>
        ))}
      </section>

      {/* ── Quick navigation ── */}
      <nav className="animate-fade-in-up stagger-2 mb-10 flex flex-wrap gap-2">
        {[
          {
            href: "/dashboard/recent",
            label: "Recently Added",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            )
          },
          {
            href: "/dashboard/suggestions",
            label: "Suggestions",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <line x1="3" x2="21" y1="6" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            )
          },
          {
            href: "/dashboard/tracked",
            label: "Price Tracking",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            )
          },
          {
            href: "/dashboard/wishlist",
            label: "Wishlist",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            )
          }
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="glass-card hover:bg-accent/70 group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all hover:shadow-sm"
          >
            <span className="text-primary">{item.icon}</span>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              {item.label}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground/40 group-hover:text-primary h-3.5 w-3.5 transition-all group-hover:translate-x-0.5"
            >
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </Link>
        ))}
      </nav>

      {/* ── Main content: asymmetric 7/5 grid ── */}
      <section className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left column — primary content */}
        <div className="space-y-8 lg:col-span-7">
          {/* Currently Reading */}
          <div className="animate-fade-in-up stagger-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Currently Reading
                </h2>
                <p className="text-muted-foreground text-xs">
                  Continue where you left off
                </p>
              </div>
              {currentlyReading.length > 0 && (
                <Link
                  href="/library"
                  className="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
                >
                  View all
                </Link>
              )}
            </div>

            {currentlyReading.length === 0 ? (
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
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm">
                  Nothing in progress yet
                </p>
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  Mark a volume as &quot;reading&quot; to see it here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentlyReading.map((v) => {
                  const progress =
                    v.page_count && v.current_page
                      ? Math.round((v.current_page / v.page_count) * 100)
                      : null
                  return (
                    <Link
                      key={v.id}
                      href={`/library/volume/${v.id}`}
                      className="glass-card group block rounded-xl p-4 transition-all hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                            {v.seriesTitle}
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-xs">
                            Volume {v.volume_number}
                            {progress !== null && (
                              <span className="text-primary/80 ml-2 font-medium">
                                {progress}%
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
                      </div>
                      {progress !== null && (
                        <div className="bg-primary/8 mt-3 h-1.5 overflow-hidden rounded-full">
                          <div
                            className="progress-animate from-primary to-gold h-full rounded-full bg-linear-to-r"
                            style={
                              {
                                "--target-width": `${progress}%`
                              } as React.CSSProperties
                            }
                          />
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recently Added */}
          <div className="animate-fade-in-up stagger-3">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Recently Added
                </h2>
                <p className="text-muted-foreground text-xs">
                  Latest additions to your collection
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-muted flex rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setRecentTab("series")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      recentTab === "series"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Series
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentTab("volumes")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      recentTab === "volumes"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Volumes
                  </button>
                </div>
                {(recentTab === "series"
                  ? recentSeries.length > 0
                  : recentVolumes.length > 0) && (
                  <Link
                    href="/dashboard/recent"
                    className="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
                  >
                    View all
                  </Link>
                )}
              </div>
            </div>

            <RecentlyAddedContent
              tab={recentTab}
              recentSeries={recentSeries}
              recentVolumes={recentVolumes}
              priceFormatter={priceFormatter}
              dateFormat={dateFormat}
            />
          </div>

          {/* What to Buy Next */}
          <div className="animate-fade-in-up stagger-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  What to Buy Next
                </h2>
                <p className="text-muted-foreground text-xs">
                  Continue your collection
                </p>
              </div>
              {suggestedNextBuys.length > 0 && (
                <Link
                  href="/dashboard/suggestions"
                  className="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
                >
                  View all
                </Link>
              )}
            </div>

            {suggestedNextBuys.length === 0 ? (
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
                  No suggestions yet
                </p>
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  Start collecting volumes to get personalized picks
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {suggestedNextBuys.map((buy) => (
                  <Link
                    key={`${buy.seriesId}-${buy.volumeNumber}`}
                    href={`/library/series/${buy.seriesId}`}
                    className="glass-card group block rounded-xl p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                            {buy.seriesTitle}
                          </span>
                          {buy.isReading && (
                            <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                              Reading
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                          <span>Volume {buy.volumeNumber}</span>
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
                          {buy.estimatedPrice != null &&
                            buy.estimatedPrice > 0 && (
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
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — sidebar content */}
        <div className="space-y-8 lg:col-span-5">
          {/* Collection Breakdown */}
          <div className="animate-fade-in-up stagger-5">
            <div className="mb-4">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Breakdown
              </h2>
              <p className="text-muted-foreground text-xs">
                Collection composition
              </p>
            </div>

            <div className="grid-stagger grid grid-cols-2 gap-3">
              {[
                {
                  id: "ln",
                  label: "Light Novels",
                  value: stats.lightNovelSeries,
                  unit: "series",
                  gradient: "from-primary/15 to-primary/5",
                  textColor: "text-primary",
                  iconBg: "bg-primary/12",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  )
                },
                {
                  id: "manga",
                  label: "Manga",
                  value: stats.mangaSeries,
                  unit: "series",
                  gradient: "from-copper/15 to-copper/5",
                  textColor: "text-copper",
                  iconBg: "bg-copper/12",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-3.5 w-3.5"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <line x1="3" x2="21" y1="9" y2="9" />
                      <line x1="9" x2="9" y1="3" y2="21" />
                    </svg>
                  )
                },
                {
                  id: "complete",
                  label: "Complete series",
                  value: stats.completeSets,
                  unit: "series",
                  gradient: "from-green-500/12 to-green-500/4",
                  textColor: "text-green-600 dark:text-green-400",
                  iconBg: "bg-green-500/12",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )
                },
                {
                  id: "wishlist",
                  label: "Wishlisted volumes",
                  value: stats.wishlistCount,
                  unit: "volumes",
                  gradient: "from-gold/15 to-gold/5",
                  textColor: "text-gold",
                  iconBg: "bg-gold/12",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                  )
                }
              ].map((card) => (
                <div
                  key={card.id}
                  className={`bg-linear-to-br ${card.gradient} rounded-xl border p-4 transition-transform hover:scale-[1.02]`}
                >
                  <div className="mb-2 flex items-center gap-1.5">
                    <div
                      className={`${card.iconBg} ${card.textColor} flex h-5 w-5 items-center justify-center rounded`}
                    >
                      {card.icon}
                    </div>
                    <span className="text-muted-foreground text-[11px] font-medium uppercase">
                      {card.label}
                    </span>
                  </div>
                  <div
                    className={`font-display text-2xl font-bold ${card.textColor}`}
                  >
                    {card.value}
                  </div>
                  <div className="text-muted-foreground text-[10px] uppercase">
                    {card.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reading progress ring */}
          <div className="animate-fade-in-up stagger-6">
            <div className="mb-4">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Progress
              </h2>
              <p className="text-muted-foreground text-xs">
                Overall reading completion
              </p>
            </div>

            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-6">
                {/* SVG ring */}
                <div className="relative h-24 w-24 shrink-0">
                  <svg
                    viewBox="0 0 100 100"
                    className="h-full w-full -rotate-90"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      className="stroke-primary/10"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      className="stroke-primary"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${readPercentage * 2.64} ${264 - readPercentage * 2.64}`}
                      style={{
                        transition: "stroke-dasharray 1s ease-out"
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display text-xl font-bold">
                      {readPercentage}%
                    </span>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Read</span>
                      <span className="font-medium">
                        {stats.readVolumes}/{stats.totalVolumes}
                      </span>
                    </div>
                    <div className="bg-primary/8 mt-1 h-1.5 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-700"
                        style={{ width: `${readPercentage}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">In progress</span>
                      <span className="font-medium">
                        {stats.readingVolumes}
                      </span>
                    </div>
                    <div className="bg-gold/10 mt-1 h-1.5 overflow-hidden rounded-full">
                      <div
                        className="bg-gold h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${stats.totalVolumes > 0 ? Math.round((stats.readingVolumes / stats.totalVolumes) * 100) : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Price Tracking */}
          <div className="animate-fade-in-up stagger-7">
            <div className="mb-4">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Price Tracking
              </h2>
              <p className="text-muted-foreground text-xs">
                Investment breakdown
              </p>
            </div>

            {priceBreakdown.trackedCount === 0 ? (
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
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm">
                  No prices tracked yet
                </p>
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  Add purchase prices to volumes to see insights
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Category split */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="from-primary/12 to-primary/4 rounded-lg border bg-linear-to-br p-3">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Light Novels
                    </span>
                    <div className="text-primary font-display mt-0.5 text-lg font-bold">
                      {priceFormatter.format(priceBreakdown.lnSpent)}
                    </div>
                  </div>
                  <div className="from-copper/12 to-copper/4 rounded-lg border bg-linear-to-br p-3">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Manga
                    </span>
                    <div className="text-copper font-display mt-0.5 text-lg font-bold">
                      {priceFormatter.format(priceBreakdown.mangaSpent)}
                    </div>
                  </div>
                </div>

                {/* Price range stats */}
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border">
                  <div className="bg-card p-3 text-center">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Min
                    </span>
                    <div className="font-display mt-0.5 text-sm font-semibold">
                      {priceFormatter.format(priceBreakdown.minPrice)}
                    </div>
                  </div>
                  <div className="bg-card p-3 text-center">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Median
                    </span>
                    <div className="font-display mt-0.5 text-sm font-semibold">
                      {priceFormatter.format(priceBreakdown.medianPrice)}
                    </div>
                  </div>
                  <div className="bg-card p-3 text-center">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Max
                    </span>
                    <div className="font-display mt-0.5 text-sm font-semibold">
                      {priceFormatter.format(priceBreakdown.maxPrice)}
                    </div>
                  </div>
                </div>

                {/* Top spending by series */}
                {priceBreakdown.spendingBySeries.length > 0 && (
                  <div>
                    <span className="text-muted-foreground mb-2 block text-[10px] font-medium tracking-wider uppercase">
                      Top series by spend
                    </span>
                    <div className="space-y-2">
                      {priceBreakdown.spendingBySeries.map((s) => (
                        <Link
                          key={s.id}
                          href={`/library/series/${s.id}`}
                          className="group block"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="group-hover:text-primary min-w-0 flex-1 truncate font-medium transition-colors">
                              {s.title}
                            </span>
                            <span className="text-muted-foreground ml-2 shrink-0">
                              {priceFormatter.format(s.total)}
                            </span>
                          </div>
                          <div className="bg-primary/8 mt-1 h-1.5 overflow-hidden rounded-full">
                            <div
                              className="progress-animate from-copper to-gold h-full rounded-full bg-linear-to-r"
                              style={
                                {
                                  "--target-width": `${priceBreakdown.maxSeriesSpent > 0 ? Math.round((s.total / priceBreakdown.maxSeriesSpent) * 100) : 0}%`
                                } as React.CSSProperties
                              }
                            />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <Link
                  href="/dashboard/tracked"
                  className="text-primary hover:text-primary/80 block pt-1 text-center text-xs font-medium transition-colors"
                >
                  {priceBreakdown.trackedCount} of {stats.ownedVolumes} owned
                  volumes priced
                </Link>
              </div>
            )}
          </div>

          {/* Wishlist Overview */}
          <div className="animate-fade-in-up stagger-8">
            <div className="mb-4">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Wishlist
              </h2>
              <p className="text-muted-foreground text-xs">Your want list</p>
            </div>

            {stats.wishlistCount === 0 ? (
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
                  No wishlisted volumes
                </p>
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  Add volumes to your wishlist to track what you want
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Stats cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="from-gold/15 to-gold/5 rounded-lg border bg-linear-to-br p-3">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Volumes
                    </span>
                    <div className="text-gold font-display mt-0.5 text-lg font-bold">
                      {stats.wishlistCount}
                    </div>
                  </div>
                  <div className="from-copper/12 to-copper/4 rounded-lg border bg-linear-to-br p-3">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Est. Cost
                    </span>
                    <div className="text-copper font-display mt-0.5 text-lg font-bold">
                      {priceFormatter.format(wishlistStats.totalWishlistCost)}
                    </div>
                  </div>
                </div>

                {/* Average price */}
                {wishlistStats.wishlistPricedCount > 0 && (
                  <div className="bg-card rounded-lg border p-3 text-center">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Avg. Price
                    </span>
                    <div className="font-display mt-0.5 text-sm font-semibold">
                      {priceFormatter.format(
                        wishlistStats.averageWishlistPrice
                      )}
                    </div>
                  </div>
                )}

                {/* Top wishlisted series */}
                {wishlistStats.topWishlistedSeries.length > 0 && (
                  <div>
                    <span className="text-muted-foreground mb-2 block text-[10px] font-medium tracking-wider uppercase">
                      Top wishlisted series
                    </span>
                    <div className="space-y-2">
                      {wishlistStats.topWishlistedSeries.map((s) => (
                        <Link
                          key={s.id}
                          href={`/library/series/${s.id}`}
                          className="group block"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="group-hover:text-primary min-w-0 flex-1 truncate font-medium transition-colors">
                              {s.title}
                            </span>
                            <span className="text-muted-foreground ml-2 shrink-0">
                              {s.count} vol{s.count === 1 ? "" : "s"}
                              {s.cost > 0 && (
                                <span className="text-muted-foreground/60">
                                  {" "}
                                  · {priceFormatter.format(s.cost)}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="bg-gold/10 mt-1 h-1.5 overflow-hidden rounded-full">
                            <div
                              className="progress-animate from-gold to-copper h-full rounded-full bg-linear-to-r"
                              style={
                                {
                                  "--target-width": `${wishlistStats.maxWishlistSeriesCount > 0 ? Math.round((s.count / wishlistStats.maxWishlistSeriesCount) * 100) : 0}%`
                                } as React.CSSProperties
                              }
                            />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <Link
                  href="/dashboard/wishlist"
                  className="text-primary hover:text-primary/80 block pt-1 text-center text-xs font-medium transition-colors"
                >
                  {stats.wishlistCount} of {stats.totalVolumes} volumes
                  wishlisted
                </Link>
              </div>
            )}
          </div>

          {/* Price Alerts */}
          <div className="animate-fade-in-up stagger-9">
            <div className="mb-4">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Price Alerts
              </h2>
              <p className="text-muted-foreground text-xs">
                Track price drops on your volumes
              </p>
            </div>

            <PriceAlertsDashboardCard />
          </div>
        </div>
      </section>
    </div>
  )
}
