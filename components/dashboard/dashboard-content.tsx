"use client"

import Link from "next/link"
import { lazy, Suspense, useState } from "react"

import { CollectionHealthCard } from "@/components/dashboard/collection-health-card"
import { DashboardLayoutCustomizer } from "@/components/dashboard/dashboard-layout-customizer"
import { WidgetSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card"
import { RecentlyAddedContent } from "@/components/dashboard/recently-added"
import { ErrorBoundary } from "@/components/error-boundary"
import { RecommendationsCard } from "@/components/library/recommendations-card"
import { formatDate } from "@/lib/format-date"
import { usePriceFormatter } from "@/lib/hooks/use-price-formatter"
import type {
  AugmentedVolume,
  CollectionStats,
  PriceBreakdown,
  ReleaseItem,
  SpendingDataPoint,
  SuggestedBuy,
  SuggestionCounts,
  TagBreakdown,
  WishlistStats
} from "@/lib/library/analytics"
import type { HealthScore } from "@/lib/library/health-score"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import {
  DASHBOARD_WIDGETS,
  type DashboardWidgetId,
  type DateFormat
} from "@/lib/store/settings-store"
import type { SeriesWithVolumes } from "@/lib/types/database"

const LazyPriceTracking = lazy(
  () => import("@/components/dashboard/dashboard-price-tracking")
)
const LazyWishlist = lazy(
  () => import("@/components/dashboard/dashboard-wishlist")
)
const LazyPriceAlerts = lazy(() =>
  import("@/components/library/price-alerts-dashboard-card").then((m) => ({
    default: m.PriceAlertsDashboardCard
  }))
)
const LazySpendingChart = lazy(
  () => import("@/components/dashboard/dashboard-spending-chart")
)
const LazyTagAnalytics = lazy(
  () => import("@/components/dashboard/dashboard-tag-analytics")
)

// ── Widget prop interfaces ────────────────────────────────────────────────

type PriceFormatter = ReturnType<typeof usePriceFormatter>

interface StatsWidgetProps {
  readonly stats: CollectionStats
  readonly priceFormatter: PriceFormatter
}

interface CurrentlyReadingWidgetProps {
  readonly currentlyReading: readonly AugmentedVolume[]
}

interface RecentlyAddedWidgetProps {
  readonly recentSeries: readonly SeriesWithVolumes[]
  readonly recentVolumes: readonly AugmentedVolume[]
  readonly priceFormatter: PriceFormatter
  readonly dateFormat: DateFormat
}

interface RecommendationsWidgetProps {
  readonly suggestedNextBuys: readonly SuggestedBuy[]
  readonly suggestionCounts: SuggestionCounts
  readonly priceFormatter: PriceFormatter
}

interface BreakdownWidgetProps {
  readonly stats: CollectionStats
}

interface HealthWidgetProps {
  readonly healthScore: HealthScore | null
  readonly series: readonly SeriesWithVolumes[]
}

interface ProgressWidgetProps {
  readonly stats: CollectionStats
}

interface PriceTrackingWidgetProps {
  readonly priceBreakdown: PriceBreakdown
  readonly ownedVolumes: number
  readonly priceFormatter: PriceFormatter
}

interface WishlistWidgetProps {
  readonly wishlistStats: WishlistStats
  readonly wishlistCount: number
  readonly totalVolumes: number
  readonly priceFormatter: PriceFormatter
}

interface ReleasesWidgetProps {
  readonly upcomingReleases: readonly ReleaseItem[]
  readonly dateFormat: DateFormat
}

interface SpendingChartWidgetProps {
  readonly spendingTimeSeries: readonly SpendingDataPoint[]
  readonly priceFormatter: PriceFormatter
}

interface ReadingVelocityChartWidgetProps {
  readonly velocityTimeSeries: readonly SpendingDataPoint[]
  readonly priceFormatter: PriceFormatter
}

interface TagAnalyticsWidgetProps {
  readonly tagBreakdown: readonly TagBreakdown[]
  readonly priceFormatter: PriceFormatter
}

// ── Standalone widget components ─────────────────────────────────────────

function StatsWidget({ stats, priceFormatter }: StatsWidgetProps) {
  const readPercentage =
    stats.totalVolumes > 0
      ? Math.round((stats.readVolumes / stats.totalVolumes) * 100)
      : 0
  const ownedPercentage =
    stats.totalVolumes > 0
      ? Math.round((stats.ownedVolumes / stats.totalVolumes) * 100)
      : 0

  return (
    <section className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border md:grid-cols-4">
      {[
        {
          id: "series",
          label: "Series",
          value: stats.totalSeries,
          detail: `${stats.lightNovelSeries} LN · ${stats.mangaSeries} Manga`,
          delta: stats.recentDelta.series,
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
          delta: stats.recentDelta.volumes,
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
          delta: stats.recentDelta.readVolumes,
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
          delta: stats.recentDelta.spent,
          deltaLabel: priceFormatter.format(stats.recentDelta.spent),
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
          id: "total-pages",
          label: "Total Pages",
          value: stats.totalPages.toLocaleString(),
          detail:
            stats.totalPages > 0
              ? `across ${stats.totalVolumes} volumes`
              : "No page counts tracked",
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          )
        },
        {
          id: "pages-read",
          label: "Pages Read",
          value: stats.readPages.toLocaleString(),
          detail:
            stats.totalPages > 0
              ? `${Math.round((stats.readPages / stats.totalPages) * 100)}% of tracked pages`
              : "No page counts tracked",
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
              <path d="m9 9 2 2 4-4" />
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
          <div className="flex items-baseline gap-2">
            <div className="font-display text-2xl font-bold tracking-tight">
              {stat.value}
            </div>
            {"delta" in stat && (stat.delta ?? 0) > 0 && (
              <span
                className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                title="In the last 30 days"
              >
                +{"deltaLabel" in stat ? stat.deltaLabel : stat.delta}
              </span>
            )}
          </div>
          <div className="text-muted-foreground text-xs">{stat.detail}</div>
        </div>
      ))}
    </section>
  )
}

function CurrentlyReadingWidget({
  currentlyReading
}: CurrentlyReadingWidgetProps) {
  return (
    <div>
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
  )
}

function RecentlyAddedWidget({
  recentSeries,
  recentVolumes,
  priceFormatter,
  dateFormat
}: RecentlyAddedWidgetProps) {
  const [recentTab, setRecentTab] = useState<"series" | "volumes">("series")

  return (
    <div>
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
  )
}

function RecommendationsWidget({
  suggestedNextBuys,
  suggestionCounts,
  priceFormatter
}: RecommendationsWidgetProps) {
  return (
    <div>
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
            href="/dashboard/recommendations"
            className="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
          >
            View all recommendations
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
          <p className="text-muted-foreground text-sm">No suggestions yet</p>
          <p className="text-muted-foreground/60 mt-1 text-xs">
            Start collecting volumes to get personalized picks
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {suggestionCounts.gap_fill > 0 && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                {suggestionCounts.gap_fill} gaps
              </span>
            )}
            {suggestionCounts.continue_reading > 0 && (
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                {suggestionCounts.continue_reading} reading
              </span>
            )}
            {suggestionCounts.complete_series > 0 && (
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                {suggestionCounts.complete_series} completable
              </span>
            )}
            {suggestionCounts.continue > 0 && (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                {suggestionCounts.continue} next
              </span>
            )}
          </div>

          {suggestedNextBuys.map((buy) => (
            <RecommendationsCard
              key={`${buy.seriesId}-${buy.volumeNumber}`}
              suggestion={buy}
              currencyFormatter={priceFormatter}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BreakdownWidget({ stats }: BreakdownWidgetProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Breakdown
        </h2>
        <p className="text-muted-foreground text-xs">Collection composition</p>
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
  )
}

function HealthWidget({ healthScore, series }: HealthWidgetProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Collection Health
        </h2>
        <p className="text-muted-foreground text-xs">
          Overall collection quality score
        </p>
      </div>
      <CollectionHealthCard healthScore={healthScore} series={series} />
    </div>
  )
}

function ProgressWidget({ stats }: ProgressWidgetProps) {
  const readPercentage =
    stats.totalVolumes > 0
      ? Math.round((stats.readVolumes / stats.totalVolumes) * 100)
      : 0

  return (
    <div>
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
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
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
                <span className="font-medium">{stats.readingVolumes}</span>
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
  )
}

function PriceTrackingWidget({
  priceBreakdown,
  ownedVolumes,
  priceFormatter
}: PriceTrackingWidgetProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Price Tracking
        </h2>
        <p className="text-muted-foreground text-xs">Investment breakdown</p>
      </div>
      <Suspense fallback={<WidgetSkeleton />}>
        <LazyPriceTracking
          priceBreakdown={priceBreakdown}
          ownedVolumes={ownedVolumes}
          priceFormatter={priceFormatter}
        />
      </Suspense>
    </div>
  )
}

function WishlistWidget({
  wishlistStats,
  wishlistCount,
  totalVolumes,
  priceFormatter
}: WishlistWidgetProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Wishlist
        </h2>
        <p className="text-muted-foreground text-xs">Your want list</p>
      </div>
      <Suspense fallback={<WidgetSkeleton />}>
        <LazyWishlist
          wishlistStats={wishlistStats}
          wishlistCount={wishlistCount}
          totalVolumes={totalVolumes}
          priceFormatter={priceFormatter}
        />
      </Suspense>
    </div>
  )
}

function ReleasesWidget({ upcomingReleases, dateFormat }: ReleasesWidgetProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Upcoming Releases
          </h2>
          <p className="text-muted-foreground text-xs">
            Next volumes by publish date
          </p>
        </div>
        {upcomingReleases.length > 0 && (
          <Link
            href="/dashboard/releases"
            className="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
          >
            View all
          </Link>
        )}
      </div>

      {upcomingReleases.length === 0 ? (
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
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">No upcoming releases</p>
          <p className="text-muted-foreground/60 mt-1 text-xs">
            Add publish dates to volumes to track releases
          </p>
        </div>
      ) : (
        <div className="grid gap-px overflow-hidden rounded-xl border">
          {upcomingReleases.map((r) => (
            <Link
              key={r.volumeId}
              href={`/library/volume/${r.volumeId}`}
              className="bg-card group hover:bg-accent/60 flex items-center justify-between p-3 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                  {r.seriesTitle}
                  {r.volumeNumber != null && (
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      Vol. {r.volumeNumber}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {formatDate(r.publishDate, dateFormat)}
                  <span className="text-muted-foreground/40"> · </span>
                  {r.seriesType === "light_novel" ? "Light Novel" : "Manga"}
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
  )
}

function PriceAlertsWidget() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Price Alerts
        </h2>
        <p className="text-muted-foreground text-xs">
          Track price drops on your volumes
        </p>
      </div>
      <Suspense fallback={<WidgetSkeleton />}>
        <LazyPriceAlerts />
      </Suspense>
    </div>
  )
}

function SpendingChartWidget({
  spendingTimeSeries,
  priceFormatter
}: SpendingChartWidgetProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Spending Over Time
        </h2>
        <p className="text-muted-foreground text-xs">Monthly purchase spend</p>
      </div>
      <Suspense fallback={<WidgetSkeleton />}>
        <LazySpendingChart
          data={spendingTimeSeries as SpendingDataPoint[]}
          priceFormatter={priceFormatter}
        />
      </Suspense>
    </div>
  )
}

function ReadingVelocityChartWidget({
  velocityTimeSeries,
  priceFormatter
}: ReadingVelocityChartWidgetProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Reading Velocity
        </h2>
        <p className="text-muted-foreground text-xs">
          Volumes completed per month
        </p>
      </div>
      <Suspense fallback={<WidgetSkeleton />}>
        <LazySpendingChart
          data={velocityTimeSeries as SpendingDataPoint[]}
          priceFormatter={priceFormatter}
          mode="velocity"
        />
      </Suspense>
    </div>
  )
}

function TagAnalyticsWidget({
  tagBreakdown,
  priceFormatter
}: TagAnalyticsWidgetProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Tag Breakdown
        </h2>
        <p className="text-muted-foreground text-xs">
          Collection analytics by tag
        </p>
      </div>
      <Suspense fallback={<WidgetSkeleton />}>
        <LazyTagAnalytics
          breakdown={tagBreakdown as TagBreakdown[]}
          priceFormatter={priceFormatter}
        />
      </Suspense>
    </div>
  )
}

function ActivityWidget() {
  return <RecentActivityCard />
}

interface BacklogWidgetProps {
  readonly stats: CollectionStats
}

function BacklogWidget({ stats }: BacklogWidgetProps) {
  const backlog = stats.ownedVolumes - stats.readVolumes - stats.readingVolumes
  const completedLast30 = stats.recentDelta.readVolumes
  const acquiredLast30 = stats.recentDelta.volumes
  const netGrowth = acquiredLast30 - completedLast30

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Reading Backlog
        </h2>
        <p className="text-muted-foreground text-xs">
          Owned but unread volumes
        </p>
      </div>

      <div className="glass-card rounded-xl p-6">
        {backlog === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No backlog! All owned volumes read.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-4xl font-bold">{backlog}</span>
              <span className="text-muted-foreground text-sm">
                volumes to read
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/8 rounded-lg p-3">
                <div className="text-muted-foreground mb-1 text-[11px] font-medium uppercase">
                  Completed (30d)
                </div>
                <div className="font-display text-primary text-xl font-bold">
                  {completedLast30}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-muted-foreground mb-1 text-[11px] font-medium uppercase">
                  Acquired (30d)
                </div>
                <div className="font-display text-xl font-bold">
                  {acquiredLast30}
                </div>
              </div>
            </div>
            <div
              className={`rounded-lg px-3 py-2 text-center text-xs font-medium ${
                netGrowth > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-green-500/10 text-green-600 dark:text-green-400"
              }`}
            >
              {netGrowth > 0
                ? `Backlog growing by ~${netGrowth}/mo`
                : "On track 🎯"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface ReadingGoalWidgetProps {
  readonly velocityTimeSeries: readonly SpendingDataPoint[]
}

function ReadingGoalWidget({ velocityTimeSeries }: ReadingGoalWidgetProps) {
  const readingGoal = useSettingsStore((s) => s.readingGoal)
  const setReadingGoal = useSettingsStore((s) => s.setReadingGoal)
  const [goalInput, setGoalInput] = useState("")

  const currentYear = new Date().getFullYear().toString()
  const completedThisYear = velocityTimeSeries
    .filter((d) => d.yearMonth.startsWith(currentYear))
    .reduce((sum, d) => sum + d.total, 0)

  const goalPercent =
    readingGoal == null
      ? 0
      : Math.min(Math.round((completedThisYear / readingGoal) * 100), 100)

  const handleSetGoal = () => {
    const n = Number.parseInt(goalInput, 10)
    if (n > 0) {
      setReadingGoal(n)
      setGoalInput("")
    }
  }

  let goalContent: React.ReactNode
  if (readingGoal == null) {
    goalContent = (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <p className="text-muted-foreground text-sm">
          Set a reading goal for {currentYear}
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="e.g. 52"
            className="bg-background focus:ring-primary/50 w-24 rounded-lg border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSetGoal()
            }}
          />
          <button
            type="button"
            onClick={handleSetGoal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          >
            Set goal
          </button>
        </div>
      </div>
    )
  } else if (completedThisYear >= readingGoal) {
    goalContent = (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <div className="text-4xl">🎉</div>
        <p className="font-display text-lg font-semibold">Goal reached!</p>
        <p className="text-muted-foreground text-xs">
          {completedThisYear} of {readingGoal} volumes read in {currentYear}
        </p>
        <button
          type="button"
          onClick={() => setReadingGoal(undefined)}
          className="text-muted-foreground hover:text-foreground mt-2 text-xs underline transition-colors"
        >
          Clear goal
        </button>
      </div>
    )
  } else {
    goalContent = (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
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
                strokeDasharray={`${goalPercent * 2.64} ${264 - goalPercent * 2.64}`}
                style={{ transition: "stroke-dasharray 1s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-xl font-bold">
                {goalPercent}%
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="font-display text-2xl font-bold">
              {completedThisYear}
            </div>
            <div className="text-muted-foreground text-xs">
              of {readingGoal} volumes read
            </div>
            <div className="text-muted-foreground text-xs">
              {readingGoal - completedThisYear} remaining in {currentYear}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReadingGoal(undefined)}
          className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
        >
          Clear goal
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Reading Goal
        </h2>
        <p className="text-muted-foreground text-xs">
          {currentYear} reading target
        </p>
      </div>

      <div className="glass-card rounded-xl p-6">{goalContent}</div>
    </div>
  )
}

// ── Main dashboard component ──────────────────────────────────────────────

function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="bg-primary/8 text-primary mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-10 w-10"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight">
        Your collection is empty
      </h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-base">
        Start building your manga and light novel library. Track what you own,
        what you&apos;re reading, and what you want next.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/library"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.97]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
          Add your first series
        </Link>
      </div>
    </div>
  )
}

export interface DashboardContentProps {
  readonly stats: CollectionStats
  readonly priceBreakdown: PriceBreakdown
  readonly wishlistStats: WishlistStats
  readonly healthScore: HealthScore | null
  readonly currentlyReading: readonly AugmentedVolume[]
  readonly recentSeries: readonly SeriesWithVolumes[]
  readonly recentVolumes: readonly AugmentedVolume[]
  readonly suggestedNextBuys: readonly SuggestedBuy[]
  readonly suggestionCounts: SuggestionCounts
  readonly upcomingReleases: readonly ReleaseItem[]
  readonly series: readonly SeriesWithVolumes[]
  readonly spendingTimeSeries: readonly SpendingDataPoint[]
  readonly velocityTimeSeries: readonly SpendingDataPoint[]
  readonly tagBreakdown: readonly TagBreakdown[]
  readonly isEmpty?: boolean
}

/**
 * Client island for the dashboard page.
 * Renders widgets dynamically based on layout preferences from the settings store.
 * Heavier sections (price tracking, wishlist, price alerts) are lazy-loaded.
 * @source
 */
export function DashboardContent({
  stats,
  priceBreakdown,
  wishlistStats,
  healthScore,
  currentlyReading,
  recentSeries,
  recentVolumes,
  suggestedNextBuys,
  suggestionCounts,
  upcomingReleases,
  series,
  spendingTimeSeries,
  velocityTimeSeries,
  tagBreakdown,
  isEmpty = false
}: DashboardContentProps) {
  const priceDisplayCurrency = useLibraryStore(
    (state) => state.priceDisplayCurrency
  )
  const priceFormatter = usePriceFormatter(priceDisplayCurrency)
  const dateFormat = useSettingsStore((s) => s.dateFormat)
  const layout = useSettingsStore((s) => s.dashboardLayout)

  if (isEmpty) return <DashboardEmptyState />

  const isVisible = (id: DashboardWidgetId) => !layout.hidden.includes(id)
  const widgetColumn = (id: DashboardWidgetId) =>
    DASHBOARD_WIDGETS.find((w) => w.id === id)?.column

  const fullWidgets = layout.order.filter(
    (id) => widgetColumn(id) === "full" && isVisible(id)
  )
  const leftWidgets = layout.order.filter(
    (id) => widgetColumn(id) === "left" && isVisible(id)
  )
  const rightWidgets = layout.order.filter(
    (id) => widgetColumn(id) === "right" && isVisible(id)
  )

  const widgetRenderers: Record<DashboardWidgetId, React.ReactNode> = {
    stats: <StatsWidget stats={stats} priceFormatter={priceFormatter} />,
    "currently-reading": (
      <CurrentlyReadingWidget currentlyReading={currentlyReading} />
    ),
    "recently-added": (
      <RecentlyAddedWidget
        recentSeries={recentSeries}
        recentVolumes={recentVolumes}
        priceFormatter={priceFormatter}
        dateFormat={dateFormat}
      />
    ),
    recommendations: (
      <RecommendationsWidget
        suggestedNextBuys={suggestedNextBuys}
        suggestionCounts={suggestionCounts}
        priceFormatter={priceFormatter}
      />
    ),
    breakdown: <BreakdownWidget stats={stats} />,
    health: <HealthWidget healthScore={healthScore} series={series} />,
    activity: <ActivityWidget />,
    progress: <ProgressWidget stats={stats} />,
    "price-tracking": (
      <PriceTrackingWidget
        priceBreakdown={priceBreakdown}
        ownedVolumes={stats.ownedVolumes}
        priceFormatter={priceFormatter}
      />
    ),
    wishlist: (
      <WishlistWidget
        wishlistStats={wishlistStats}
        wishlistCount={stats.wishlistCount}
        totalVolumes={stats.totalVolumes}
        priceFormatter={priceFormatter}
      />
    ),
    releases: (
      <ReleasesWidget
        upcomingReleases={upcomingReleases}
        dateFormat={dateFormat}
      />
    ),
    "price-alerts": <PriceAlertsWidget />,
    "spending-chart": (
      <SpendingChartWidget
        spendingTimeSeries={spendingTimeSeries}
        priceFormatter={priceFormatter}
      />
    ),
    "reading-velocity": (
      <ReadingVelocityChartWidget
        velocityTimeSeries={velocityTimeSeries}
        priceFormatter={priceFormatter}
      />
    ),
    "tag-analytics": (
      <TagAnalyticsWidget
        tagBreakdown={tagBreakdown}
        priceFormatter={priceFormatter}
      />
    ),
    backlog: <BacklogWidget stats={stats} />,
    "reading-goal": (
      <ReadingGoalWidget velocityTimeSeries={velocityTimeSeries} />
    )
  }

  return (
    <>
      {/* Customize bar */}
      <div className="mb-6 flex items-center justify-end">
        <DashboardLayoutCustomizer />
      </div>

      {/* Full-width widgets */}
      {fullWidgets.map((id, i) => (
        <div
          key={id}
          className="animate-fade-in-up"
          style={{ animationDelay: `${(i + 1) * 75}ms` }}
        >
          <ErrorBoundary>{widgetRenderers[id] ?? null}</ErrorBoundary>
        </div>
      ))}

      {/* Two-column layout */}
      {(leftWidgets.length > 0 || rightWidgets.length > 0) && (
        <section className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {leftWidgets.length > 0 && (
            <div className="space-y-8 lg:col-span-7">
              {leftWidgets.map((id, i) => (
                <div
                  key={id}
                  className="animate-fade-in-up"
                  style={{
                    animationDelay: `${(i + fullWidgets.length + 2) * 75}ms`
                  }}
                >
                  <ErrorBoundary>{widgetRenderers[id] ?? null}</ErrorBoundary>
                </div>
              ))}
            </div>
          )}
          {rightWidgets.length > 0 && (
            <div className="space-y-8 lg:col-span-5">
              {rightWidgets.map((id, i) => (
                <div
                  key={id}
                  className="animate-fade-in-up"
                  style={{
                    animationDelay: `${(i + fullWidgets.length + leftWidgets.length + 2) * 75}ms`
                  }}
                >
                  <ErrorBoundary>{widgetRenderers[id] ?? null}</ErrorBoundary>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}
