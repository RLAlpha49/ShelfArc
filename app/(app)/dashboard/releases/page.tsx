"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useLibrary } from "@/lib/hooks/use-library"
import { useSettingsStore } from "@/lib/store/settings-store"
import { formatDate } from "@/lib/format-date"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  computeReleases,
  type MonthGroup,
  type ReleaseItem
} from "@/lib/library/analytics"

type FormatFilter = "all" | "light_novel" | "manga"

function ReleaseRow({ item }: { readonly item: ReleaseItem }) {
  const dateFormat = useSettingsStore((s) => s.dateFormat)

  return (
    <Link
      href={`/library/volume/${item.volumeId}`}
      className="bg-card group hover:bg-accent/60 flex items-center gap-3 p-3 transition-colors"
    >
      {item.coverUrl ? (
        <img
          src={item.coverUrl}
          alt={item.volumeTitle}
          className="h-12 w-8 shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="bg-muted flex h-12 w-8 shrink-0 items-center justify-center rounded">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-muted-foreground/40 h-4 w-4"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="group-hover:text-primary flex items-center gap-2 truncate text-sm font-semibold transition-colors">
          {item.seriesTitle}
          {item.volumeNumber != null && (
            <span className="text-muted-foreground text-xs font-normal">
              Vol. {item.volumeNumber}
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          <span>{formatDate(item.publishDate, dateFormat)}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>
            {item.seriesType === "light_novel" ? "Light Novel" : "Manga"}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {item.isOwned && (
          <Badge
            variant="secondary"
            className="bg-green-500/10 text-green-600 dark:text-green-400"
          >
            Owned
          </Badge>
        )}
        {item.isWishlisted && (
          <Badge
            variant="secondary"
            className="bg-gold/10 text-gold"
          >
            Wishlist
          </Badge>
        )}
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground/40 group-hover:text-primary ml-1 h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5"
      >
        <polyline points="9,18 15,12 9,6" />
      </svg>
    </Link>
  )
}

function MonthSection({
  group,
  defaultOpen = true
}: {
  readonly group: MonthGroup
  readonly defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bg-card hover:bg-accent/40 flex w-full items-center justify-between p-4 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-semibold">{group.label}</h3>
          <span className="text-muted-foreground text-xs">
            {group.items.length} release{group.items.length === 1 ? "" : "s"}
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-muted-foreground h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>
      {open && (
        <div className="grid gap-px border-t">
          {group.items.map((item) => (
            <ReleaseRow key={item.volumeId} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function getFormatLabel(filter: FormatFilter): string {
  if (filter === "light_novel") return " for light novels"
  if (filter === "manga") return " for manga"
  return ""
}

function EmptyMessage({
  hasAnyReleases,
  activeTab,
  formatFilter
}: {
  readonly hasAnyReleases: boolean
  readonly activeTab: string
  readonly formatFilter: FormatFilter
}) {
  if (!hasAnyReleases) return <>No volumes have publish dates yet</>
  return <>No {activeTab} releases{getFormatLabel(formatFilter)}</>
}

function EmptyHint({
  hasAnyReleases,
  activeTab
}: {
  readonly hasAnyReleases: boolean
  readonly activeTab: string
}) {
  if (!hasAnyReleases) return <>Add publish dates to volumes to see them here</>
  const altTab = activeTab === "upcoming" ? "past" : "upcoming"
  return <>Try the {altTab} tab</>
}

export default function ReleasesPage() {
  const { series, fetchSeries, isLoading } = useLibrary()
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all")
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming")

  useEffect(() => {
    if (series.length === 0) {
      fetchSeries()
    }
  }, [series.length, fetchSeries])

  const filteredSeries = useMemo(() => {
    if (formatFilter === "all") return series
    return series.filter((s) => s.type === formatFilter)
  }, [series, formatFilter])

  const { upcoming, past } = useMemo(
    () => computeReleases(filteredSeries),
    [filteredSeries]
  )

  const upcomingCount = upcoming.reduce((n, g) => n + g.items.length, 0)
  const pastCount = past.reduce((n, g) => n + g.items.length, 0)
  const activeGroups = activeTab === "upcoming" ? upcoming : past
  const hasAnyReleases = upcomingCount + pastCount > 0

  if (isLoading && series.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <Skeleton className="mb-1 h-5 w-20" />
        <Skeleton className="mb-8 h-9 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      {/* Header */}
      <section className="animate-fade-in-down mb-8">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-xs transition-colors"
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
          Dashboard
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Release Calendar
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {hasAnyReleases
            ? `${upcomingCount} upcoming · ${pastCount} past releases`
            : "Track publish dates across your collection"}
        </p>
      </section>

      {/* Controls */}
      <div className="animate-fade-in-up stagger-1 mb-6 flex flex-wrap items-center gap-3">
        {/* Tab toggle */}
        <div className="bg-muted flex rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "upcoming"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upcoming
            {upcomingCount > 0 && (
              <span className="text-primary ml-1.5">({upcomingCount})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("past")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "past"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Past
            {pastCount > 0 && (
              <span className="text-muted-foreground/60 ml-1.5">
                ({pastCount})
              </span>
            )}
          </button>
        </div>

        {/* Format filter */}
        <div className="bg-muted flex rounded-lg p-0.5">
          {(
            [
              { value: "all", label: "All" },
              { value: "light_novel", label: "Light Novel" },
              { value: "manga", label: "Manga" }
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFormatFilter(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                formatFilter === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <section className="animate-fade-in-up stagger-2 space-y-4">
        {activeGroups.length === 0 ? (
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
            <p className="text-muted-foreground text-sm">
              <EmptyMessage
                hasAnyReleases={hasAnyReleases}
                activeTab={activeTab}
                formatFilter={formatFilter}
              />
            </p>
            <p className="text-muted-foreground/60 mt-1 text-xs">
              <EmptyHint
                hasAnyReleases={hasAnyReleases}
                activeTab={activeTab}
              />
            </p>
          </div>
        ) : (
          activeGroups.map((group, i) => (
            <MonthSection
              key={group.yearMonth}
              group={group}
              defaultOpen={activeTab === "upcoming" || i < 2}
            />
          ))
        )}
      </section>
    </div>
  )
}
