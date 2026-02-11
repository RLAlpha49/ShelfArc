"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type { DateFormat } from "@/lib/store/settings-store"
import { formatDate } from "@/lib/format-date"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
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

interface RecentVolumeItem extends Volume {
  seriesTitle: string
  seriesId: string
  seriesType: string
}

type FormatFilter = "all" | "light_novel" | "manga" | "other"
type PeriodFilter = "all" | "7" | "30" | "90"

function typeLabel(type: string) {
  if (type === "light_novel") return "Light Novel"
  if (type === "manga") return "Manga"
  return "Other"
}

function filterByPeriod(dateStr: string, period: PeriodFilter): boolean {
  if (period === "all") return true
  const days = Number(period)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(dateStr).getTime() >= cutoff
}

function SeriesList({
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
          className="bg-card group hover:bg-accent/40 flex items-center justify-between p-4 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                {s.title}
              </span>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {typeLabel(s.type)}
              </Badge>
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {s.volumes.length} vol{s.volumes.length === 1 ? "" : "s"}
              {s.author && (
                <span className="text-muted-foreground/60">
                  {" "}
                  · {s.author}
                </span>
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

function VolumesList({
  items,
  priceFormatter,
  dateFormat
}: {
  readonly items: readonly RecentVolumeItem[]
  readonly priceFormatter: Intl.NumberFormat
  readonly dateFormat: DateFormat
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border">
      {items.map((v) => {
        const displayTitle = v.title ? normalizeVolumeTitle(v.title) : null
        return (
          <Link
            key={v.id}
            href={`/library/volume/${v.id}`}
            className="bg-card group hover:bg-accent/40 flex items-center justify-between p-4 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                  {v.seriesTitle}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  Vol. {v.volume_number}
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {typeLabel(v.seriesType)}
                </Badge>
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
                <span className="text-muted-foreground/60">
                  {formatDate(v.created_at, dateFormat)}
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
        )
      })}
    </div>
  )
}

function RecentContent({
  tab,
  recentSeries,
  recentVolumes,
  priceFormatter,
  dateFormat
}: {
  readonly tab: "series" | "volumes"
  readonly recentSeries: readonly SeriesWithVolumes[]
  readonly recentVolumes: readonly RecentVolumeItem[]
  readonly priceFormatter: Intl.NumberFormat
  readonly dateFormat: DateFormat
}) {
  if (tab === "series") {
    return <SeriesList items={recentSeries} dateFormat={dateFormat} />
  }
  return (
    <VolumesList
      items={recentVolumes}
      priceFormatter={priceFormatter}
      dateFormat={dateFormat}
    />
  )
}

export default function RecentPage() {
  const { series, fetchSeries, isLoading } = useLibrary()
  const priceDisplayCurrency = useLibraryStore((s) => s.priceDisplayCurrency)
  const dateFormat = useSettingsStore((s) => s.dateFormat)

  const [tab, setTab] = useState<"series" | "volumes">("series")
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all")
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all")

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

  const recentSeries = useMemo(() => {
    return [...series]
      .filter((s) => {
        if (formatFilter !== "all" && s.type !== formatFilter) return false
        if (!filterByPeriod(s.created_at, periodFilter)) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
  }, [series, formatFilter, periodFilter])

  const recentVolumes: RecentVolumeItem[] = useMemo(() => {
    return series
      .flatMap((s) =>
        s.volumes.map((v) => ({
          ...v,
          seriesTitle: s.title,
          seriesId: s.id,
          seriesType: s.type
        }))
      )
      .filter((v) => {
        if (formatFilter !== "all" && v.seriesType !== formatFilter)
          return false
        if (!filterByPeriod(v.created_at, periodFilter)) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
  }, [series, formatFilter, periodFilter])

  const count = tab === "series" ? recentSeries.length : recentVolumes.length

  if (isLoading && series.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
        <Skeleton className="mb-1 h-4 w-32" />
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="mb-6 flex gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="mb-6 h-9 w-48" />
        <div className="space-y-px overflow-hidden rounded-xl border">
          {Array.from({ length: 8 }, (_, i) => (
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
          Recently Added
        </span>
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight md:text-4xl">
          <span className="text-gradient from-copper to-gold bg-linear-to-r">
            Recent
          </span>{" "}
          Additions
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {count} {tab === "series" ? "series" : "volumes"} found
        </p>
      </section>

      {/* Filters */}
      <div className="animate-fade-in-up stagger-1 mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Format
          </span>
          <Select value={formatFilter} onValueChange={(v) => setFormatFilter(v as FormatFilter)}>
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
            Period
          </span>
          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="animate-fade-in-up stagger-2 mb-6">
        <div className="bg-muted inline-flex rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setTab("series")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "series"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Series ({recentSeries.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("volumes")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "volumes"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Volumes ({recentVolumes.length})
          </button>
        </div>
      </div>

      {/* List */}
      <div className="animate-fade-in-up stagger-3">
        {count === 0 ? (
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
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">
              No {tab === "series" ? "series" : "volumes"} match your filters
            </p>
            <p className="text-muted-foreground/60 mt-1 text-xs">
              Try adjusting the filters above
            </p>
          </div>
        ) : (
          <RecentContent
            tab={tab}
            recentSeries={recentSeries}
            recentVolumes={recentVolumes}
            priceFormatter={priceFormatter}
            dateFormat={dateFormat}
          />
        )}
      </div>
    </div>
  )
}
