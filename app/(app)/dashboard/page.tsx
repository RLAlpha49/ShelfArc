"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryStore } from "@/lib/store/library-store"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const { series, fetchSeries, isLoading } = useLibrary()
  const priceDisplayCurrency = useLibraryStore(
    (state) => state.priceDisplayCurrency
  )

  useEffect(() => {
    if (series.length === 0) {
      fetchSeries()
    }
  }, [series.length, fetchSeries])

  // Calculate statistics
  const totalSeries = series.length
  const totalVolumes = series.reduce((acc, s) => acc + s.volumes.length, 0)
  const ownedVolumes = series.reduce(
    (acc, s) =>
      acc + s.volumes.filter((v) => v.ownership_status === "owned").length,
    0
  )
  const readVolumes = series.reduce(
    (acc, s) =>
      acc + s.volumes.filter((v) => v.reading_status === "completed").length,
    0
  )
  const readingVolumes = series.reduce(
    (acc, s) =>
      acc + s.volumes.filter((v) => v.reading_status === "reading").length,
    0
  )

  const lightNovels = series.filter((s) => s.type === "light_novel")
  const manga = series.filter((s) => s.type === "manga")

  const totalSpent = series.reduce(
    (acc, s) =>
      acc + s.volumes.reduce((vAcc, v) => vAcc + (v.purchase_price || 0), 0),
    0
  )

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

  // Get recently added series
  const recentSeries = [...series]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5)

  // Get currently reading volumes
  const currentlyReading = series
    .flatMap((s) => s.volumes.map((v) => ({ ...v, seriesTitle: s.title })))
    .filter((v) => v.reading_status === "reading")
    .slice(0, 5)

  // Collection stats
  const completeSets = series.filter(
    (s) =>
      s.volumes.filter((v) => v.ownership_status === "owned").length ===
        (s.total_volumes || s.volumes.length) && s.volumes.length > 0
  ).length
  const wishlistCount = series.reduce(
    (acc, s) =>
      acc + s.volumes.filter((v) => v.ownership_status === "wishlist").length,
    0
  )

  if (isLoading && series.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="mb-2 h-10 w-56" />
        <Skeleton className="mb-8 h-5 w-72" />
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  const statsCards = [
    {
      id: "series",
      label: "Total Series",
      value: totalSeries,
      detail: `${lightNovels.length} LN · ${manga.length} Manga`,
      icon: (
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
      )
    },
    {
      id: "volumes",
      label: "Total Volumes",
      value: totalVolumes,
      detail: `${ownedVolumes} owned`,
      icon: (
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
      )
    },
    {
      id: "read",
      label: "Volumes Read",
      value: readVolumes,
      detail: `${readingVolumes} in progress`,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-5 w-5"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    },
    {
      id: "spent",
      label: "Total Spent",
      value: priceFormatter.format(totalSpent),
      detail: `${priceFormatter.format(ownedVolumes > 0 ? totalSpent / ownedVolumes : 0)}/vol avg`,
      icon: (
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
      )
    }
  ]

  const breakdownCards = [
    {
      id: "ln",
      label: "Light Novels",
      value: lightNovels.length,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      id: "manga",
      label: "Manga",
      value: manga.length,
      color: "text-copper",
      bgColor: "bg-copper/10"
    },
    {
      id: "complete",
      label: "Complete Sets",
      value: completeSets,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/10"
    },
    {
      id: "wishlist",
      label: "On Wishlist",
      value: wishlistCount,
      color: "text-gold",
      bgColor: "bg-gold/10"
    }
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Your collection at a glance
          </p>
        </div>
        <Link href="/library">
          <Button
            variant="outline"
            className="border-primary/20 hover:bg-primary/5 rounded-xl"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mr-2 h-4 w-4"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            View Library
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsCards.map((stat, i) => (
          <Card
            key={stat.id}
            className={`stagger-${i + 1} animate-fade-in-up border-primary/10 hover:shadow-primary/5 overflow-hidden rounded-2xl transition-shadow hover:shadow-lg`}
          >
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                  {stat.icon}
                </div>
                <span className="text-muted-foreground text-sm font-medium">
                  {stat.label}
                </span>
              </div>
              <div className="font-display text-3xl font-bold tracking-tight">
                {stat.value}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                {stat.detail}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Sections */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recently Added */}
        <Card className="stagger-5 animate-fade-in-up border-primary/10 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg font-semibold">
              Recently Added
            </CardTitle>
            <CardDescription>
              Latest additions to your collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentSeries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-xl">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-muted-foreground h-6 w-6"
                  >
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm">
                  No series added yet
                </p>
                <Link href="/library" className="mt-2">
                  <Button variant="link" className="text-primary h-auto p-0">
                    Add your first series
                  </Button>
                </Link>
              </div>
            ) : (
              <ul className="space-y-1">
                {recentSeries.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/library/series/${s.id}`}
                      className="group hover:bg-primary/5 -mx-2 flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="group-hover:text-primary truncate font-medium transition-colors">
                          {s.title}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {s.type === "light_novel" ? "Light Novel" : "Manga"} ·{" "}
                          {s.volumes.length} vol
                        </div>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted-foreground ml-2 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      >
                        <polyline points="9,18 15,12 9,6" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Currently Reading */}
        <Card className="stagger-6 animate-fade-in-up border-primary/10 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg font-semibold">
              Currently Reading
            </CardTitle>
            <CardDescription>Continue where you left off</CardDescription>
          </CardHeader>
          <CardContent>
            {currentlyReading.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-xl">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-muted-foreground h-6 w-6"
                  >
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm">
                  Nothing in progress
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {currentlyReading.map((v) => {
                  const progress =
                    v.page_count && v.current_page
                      ? Math.round((v.current_page / v.page_count) * 100)
                      : null
                  return (
                    <li
                      key={v.id}
                      className="hover:bg-primary/5 -mx-2 space-y-2 rounded-xl px-3 py-2.5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {v.seriesTitle}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            Volume {v.volume_number}
                            {progress !== null && ` · ${progress}%`}
                          </div>
                        </div>
                      </div>
                      {progress !== null && (
                        <div className="bg-primary/10 h-2 overflow-hidden rounded-full">
                          <div
                            className="from-copper to-gold h-full rounded-full bg-linear-to-r transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Collection Breakdown */}
      <Card className="stagger-7 animate-fade-in-up border-primary/10 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg font-semibold">
            Collection Breakdown
          </CardTitle>
          <CardDescription>Your collection at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {breakdownCards.map((card) => (
              <div
                key={card.id}
                className={`${card.bgColor} flex flex-col items-center rounded-xl p-5 text-center transition-transform hover:scale-[1.02]`}
              >
                <div
                  className={`font-display text-3xl font-bold ${card.color}`}
                >
                  {card.value}
                </div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
