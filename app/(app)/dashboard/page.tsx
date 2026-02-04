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

  if (isLoading && series.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/library">
          <Button variant="outline">View Library</Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground text-sm">Total Series</div>
            <div className="text-3xl font-bold">{totalSeries}</div>
            <div className="text-muted-foreground mt-1 text-xs">
              {lightNovels.length} LN · {manga.length} Manga
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground text-sm">Total Volumes</div>
            <div className="text-3xl font-bold">{totalVolumes}</div>
            <div className="text-muted-foreground mt-1 text-xs">
              {ownedVolumes} owned
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground text-sm">Read</div>
            <div className="text-3xl font-bold">{readVolumes}</div>
            <div className="text-muted-foreground mt-1 text-xs">
              {readingVolumes} in progress
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground text-sm">Total Spent</div>
            <div className="text-3xl font-bold">
              {priceFormatter.format(totalSpent)}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {priceFormatter.format(
                ownedVolumes > 0 ? totalSpent / ownedVolumes : 0
              )}
              /vol avg
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Recently Added */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Added</CardTitle>
            <CardDescription>
              Latest additions to your collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentSeries.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No series added yet
              </p>
            ) : (
              <ul className="space-y-3">
                {recentSeries.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/library/series/${s.id}`}
                      className="hover:bg-muted/50 -m-2 flex items-center justify-between rounded-lg p-2 transition-colors"
                    >
                      <div>
                        <div className="font-medium">{s.title}</div>
                        <div className="text-muted-foreground text-sm">
                          {s.type === "light_novel" ? "Light Novel" : "Manga"} ·{" "}
                          {s.volumes.length} volumes
                        </div>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted-foreground h-4 w-4"
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
        <Card>
          <CardHeader>
            <CardTitle>Currently Reading</CardTitle>
            <CardDescription>Continue where you left off</CardDescription>
          </CardHeader>
          <CardContent>
            {currentlyReading.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing in progress
              </p>
            ) : (
              <ul className="space-y-3">
                {currentlyReading.map((v) => {
                  const progress =
                    v.page_count && v.current_page
                      ? Math.round((v.current_page / v.page_count) * 100)
                      : null
                  return (
                    <li key={v.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{v.seriesTitle}</div>
                          <div className="text-muted-foreground text-sm">
                            Volume {v.volume_number}
                            {progress !== null && ` · ${progress}%`}
                          </div>
                        </div>
                      </div>
                      {progress !== null && (
                        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
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
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Collection Breakdown</CardTitle>
            <CardDescription>Your collection at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {lightNovels.length}
                </div>
                <div className="text-muted-foreground text-sm">
                  Light Novels
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">
                  {manga.length}
                </div>
                <div className="text-muted-foreground text-sm">Manga</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-500">
                  {
                    series.filter(
                      (s) =>
                        s.volumes.filter((v) => v.ownership_status === "owned")
                          .length === (s.total_volumes || s.volumes.length) &&
                        s.volumes.length > 0
                    ).length
                  }
                </div>
                <div className="text-muted-foreground text-sm">
                  Complete Sets
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {series.reduce(
                    (acc, s) =>
                      acc +
                      s.volumes.filter((v) => v.ownership_status === "wishlist")
                        .length,
                    0
                  )}
                </div>
                <div className="text-muted-foreground text-sm">On Wishlist</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
