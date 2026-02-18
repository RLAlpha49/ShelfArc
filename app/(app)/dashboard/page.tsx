import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createUserClient } from "@/lib/supabase/server"
import {
  computeCollectionStats,
  computePriceBreakdown,
  computeWishlistStats,
  computeSuggestedBuys,
  computeSuggestionCounts,
  computeReleases,
  getRecentSeries,
  getRecentVolumes,
  getCurrentlyReading
} from "@/lib/library/analytics"
import { computeHealthScore } from "@/lib/library/health-score"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
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
      </section>

      {/* ── Quick navigation (server-rendered, instant) ── */}
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
            href: "/dashboard/recommendations",
            label: "Recommendations",
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
          },
          {
            href: "/dashboard/releases",
            label: "Releases",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground/50 group-hover:text-primary h-3.5 w-3.5 transition-all group-hover:translate-x-0.5"
            >
              <polyline points="9,18 15,12 9,6" />
            </svg>
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

/**
 * Async server component that fetches collection data and computes analytics.
 * Wrapped in Suspense so the page shell streams immediately while data loads.
 */
async function DashboardDataSection({ userId }: { readonly userId: string }) {
  const supabase = await createUserClient()

  // Fetch all series + volumes in parallel
  const [seriesResult, volumesResult] = await Promise.all([
    supabase.from("series").select("*").eq("user_id", userId),
    supabase
      .from("volumes")
      .select("*")
      .eq("user_id", userId)
      .order("volume_number", { ascending: true })
  ])

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
    />
  )
}
