import {
  ArrowRight01Icon,
  BookOpen01Icon,
  Calendar01Icon,
  Dollar01Icon,
  FavouriteIcon,
  ShoppingBag01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { unstable_cache } from "next/cache"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { DashboardCustomizeButton } from "@/components/dashboard/dashboard-customize-button"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import {
  computeCollectionStats,
  computeMonthlyBars,
  computePriceBreakdown,
  computeRatingDistribution,
  computeReadingVelocity,
  computeReleases,
  computeSpendingTimeSeries,
  computeSuggestedBuys,
  computeSuggestionCounts,
  computeTagBreakdown,
  computeWishlistStats,
  getCurrentlyReading,
  getRecentSeries,
  getRecentVolumes
} from "@/lib/library/analytics"
import { computeHealthScore } from "@/lib/library/health-score"
// eslint-disable-next-line no-restricted-imports -- Admin client required: unstable_cache cannot read cookies
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

/**
 * Dashboard page — async Server Component.
 * The welcome header and navigation render immediately.
 * The data-heavy analytics section streams in via Suspense.
 * @source
 */
export default async function DashboardPage() {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="dashboard-container mx-auto max-w-7xl px-6 py-10 lg:px-10">
      {/* ── Welcome header (server-rendered, instant) ── */}
      <section className="animate-fade-in-down mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
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
              Track, organize, and grow your manga and light novel library.
            </p>
          </div>
          <DashboardCustomizeButton />
        </div>
      </section>

      {/* ── Quick navigation (server-rendered, instant) ── */}
      <nav className="animate-fade-in-up stagger-2 mb-10 flex flex-wrap gap-2">
        {[
          {
            href: "/dashboard/recent",
            label: "Recently Added",
            icon: (
              <HugeiconsIcon
                icon={BookOpen01Icon}
                size={16}
                strokeWidth={1.5}
              />
            )
          },
          {
            href: "/dashboard/recommendations",
            label: "Recommendations",
            icon: (
              <HugeiconsIcon
                icon={ShoppingBag01Icon}
                size={16}
                strokeWidth={1.5}
              />
            )
          },
          {
            href: "/dashboard/tracked",
            label: "Price Tracking",
            icon: (
              <HugeiconsIcon icon={Dollar01Icon} size={16} strokeWidth={1.5} />
            )
          },
          {
            href: "/dashboard/wishlist",
            label: "Wishlist",
            icon: (
              <HugeiconsIcon icon={FavouriteIcon} size={16} strokeWidth={1.5} />
            )
          },
          {
            href: "/dashboard/releases",
            label: "Releases",
            icon: (
              <HugeiconsIcon
                icon={Calendar01Icon}
                size={16}
                strokeWidth={1.5}
              />
            )
          }
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="glass-card hover:bg-accent/70 border-border/50 group flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow-md active:scale-[0.97]"
          >
            <span className="text-primary">{item.icon}</span>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              {item.label}
            </span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={14}
              strokeWidth={2}
              className="text-muted-foreground/50 group-hover:text-primary transition-all group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </nav>

      {/* ── Dashboard content — streams in via Suspense ── */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardDataSection userId={user.id} />
      </Suspense>
    </div>
  )
}

const fetchDashboardData = (userId: string) =>
  unstable_cache(
    async () => {
      const supabase = createAdminClient({ reason: "Dashboard cache" })
      const [seriesResult, volumesResult] = await Promise.all([
        supabase
          .from("series")
          .select("id, type, status, tags, total_volumes, created_at")
          .eq("user_id", userId),
        supabase
          .from("volumes")
          .select(
            "id, series_id, ownership_status, reading_status, purchase_price, purchase_currency, purchase_date, rating, started_at, finished_at, publish_date, cover_image_url, created_at"
          )
          .eq("user_id", userId)
          .order("volume_number", { ascending: true })
      ])
      return { seriesResult, volumesResult }
    },
    ["dashboard-data", userId],
    { tags: ["library", userId], revalidate: 60 }
  )()

/**
 * Async server component that fetches collection data and computes analytics.
 * Wrapped in Suspense so the page shell streams immediately while data loads.
 */
async function DashboardDataSection({ userId }: { readonly userId: string }) {
  const { seriesResult, volumesResult } = await fetchDashboardData(userId)

  const seriesRows = seriesResult.data ?? []
  const volumeRows = (volumesResult.data ?? []) as Volume[]

  // Group volumes by series_id
  const volumesBySeries = new Map<string, Volume[]>()
  for (const v of volumeRows) {
    if (!v.series_id) continue
    const existing = volumesBySeries.get(v.series_id)
    if (existing) existing.push(v)
    else volumesBySeries.set(v.series_id, [v])
  }

  const series: SeriesWithVolumes[] = seriesRows.map((s) => ({
    ...s,
    volumes: volumesBySeries.get(s.id) ?? []
  })) as SeriesWithVolumes[]

  // Compute all analytics on the server
  const stats = computeCollectionStats(series)
  const priceBreakdown = computePriceBreakdown(series)
  const wishlistStats = computeWishlistStats(series)
  const healthScore = series.length > 0 ? computeHealthScore(series) : null
  const recentSeries = getRecentSeries(series)
  const currentlyReading = getCurrentlyReading(series)
  const recentVolumes = getRecentVolumes(series)
  const allSuggestions = computeSuggestedBuys(series)
  const suggestedNextBuys = allSuggestions.slice(0, 8)
  const suggestionCounts = computeSuggestionCounts(allSuggestions)
  const { upcoming } = computeReleases(series)
  const upcomingReleases = upcoming.flatMap((g) => g.items).slice(0, 5)
  const spendingTimeSeries = computeSpendingTimeSeries(series)
  const spendingInitialBars = computeMonthlyBars(
    spendingTimeSeries.slice(-12),
    600
  )
  const velocityTimeSeries = computeReadingVelocity(series)
  const velocityInitialBars = computeMonthlyBars(
    velocityTimeSeries.slice(-12),
    600
  )
  const tagBreakdown = computeTagBreakdown(series)
  const { distribution: ratingDistribution, unratedCount: ratingUnratedCount } =
    computeRatingDistribution(series)

  return (
    <DashboardContent
      stats={stats}
      priceBreakdown={priceBreakdown}
      wishlistStats={wishlistStats}
      healthScore={healthScore}
      currentlyReading={currentlyReading}
      recentSeries={recentSeries}
      recentVolumes={recentVolumes}
      suggestedNextBuys={suggestedNextBuys}
      suggestionCounts={suggestionCounts}
      upcomingReleases={upcomingReleases}
      series={series}
      spendingTimeSeries={spendingTimeSeries}
      spendingInitialBars={spendingInitialBars}
      velocityTimeSeries={velocityTimeSeries}
      velocityInitialBars={velocityInitialBars}
      tagBreakdown={tagBreakdown}
      ratingDistribution={ratingDistribution}
      ratingUnratedCount={ratingUnratedCount}
      isEmpty={series.length === 0}
    />
  )
}
