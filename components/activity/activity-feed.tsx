"use client"

import { useEffect, useMemo, useState } from "react"

import { ActivityEventItem } from "@/components/activity/activity-event-item"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useActivityFeed } from "@/lib/hooks/use-activity-feed"
import type { ActivityEventType } from "@/lib/types/database"

const eventTypeOptions: { value: ActivityEventType; label: string }[] = [
  { value: "volume_added", label: "Volume Added" },
  { value: "volume_updated", label: "Volume Updated" },
  { value: "volume_deleted", label: "Volume Deleted" },
  { value: "series_created", label: "Series Created" },
  { value: "series_updated", label: "Series Updated" },
  { value: "series_deleted", label: "Series Deleted" },
  { value: "price_alert_triggered", label: "Price Alert" },
  { value: "import_completed", label: "Import" },
  { value: "scrape_completed", label: "Scrape" }
]

type DateRangeKey = "all" | "7d" | "30d" | "3m" | "1y"

const DATE_RANGE_PRESETS: { key: DateRangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "1y", label: "This year" }
]

function getAfterDate(key: DateRangeKey): string | undefined {
  const now = new Date()
  switch (key) {
    case "7d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString()
    }
    case "30d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return d.toISOString()
    }
    case "3m": {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 3)
      return d.toISOString()
    }
    case "1y":
      return new Date(now.getFullYear(), 0, 1).toISOString()
    default:
      return undefined
  }
}

export function ActivityFeed() {
  const { events, pagination, isLoading, error, fetchEvents } =
    useActivityFeed()
  const [selectedType, setSelectedType] = useState<
    ActivityEventType | undefined
  >(undefined)
  const [dateRange, setDateRange] = useState<DateRangeKey>("all")
  const [isClearing, setIsClearing] = useState(false)
  const [clearCooldown, setClearCooldown] = useState(false)

  useEffect(() => {
    const afterDate = getAfterDate(dateRange)
    fetchEvents(1, 20, {
      ...(selectedType ? { eventType: selectedType } : {}),
      ...(afterDate ? { afterDate } : {})
    })
  }, [fetchEvents, selectedType, dateRange])

  const refetchCurrent = () => {
    const afterDate = getAfterDate(dateRange)
    fetchEvents(1, 20, {
      ...(selectedType ? { eventType: selectedType } : {}),
      ...(afterDate ? { afterDate } : {})
    })
  }

  const handleClearHistory = async () => {
    setIsClearing(true)
    try {
      const res = await fetch("/api/activity", { method: "DELETE" })
      if (res.ok) {
        setClearCooldown(true)
        refetchCurrent()
        setTimeout(() => setClearCooldown(false), 60_000)
      }
    } finally {
      setIsClearing(false)
    }
  }

  const groups = useMemo(() => {
    if (events.length === 0) return []
    const now = new Date()
    const todayKey = now.toDateString()
    const yesterdayDate = new Date(now)
    yesterdayDate.setDate(now.getDate() - 1)
    const yesterdayKey = yesterdayDate.toDateString()

    function getLabel(dateKey: string, createdAt: string): string {
      if (dateKey === todayKey) return "Today"
      if (dateKey === yesterdayKey) return "Yesterday"
      return new Date(createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    }

    const result: {
      dateKey: string
      label: string
      eventIds: typeof events
    }[] = []
    for (const event of events) {
      const dateKey = new Date(event.created_at).toDateString()
      const last = result.at(-1)
      if (last?.dateKey === dateKey) {
        last.eventIds.push(event)
      } else {
        result.push({
          dateKey,
          label: getLabel(dateKey, event.created_at),
          eventIds: [event]
        })
      }
    }
    return result
  }, [events])

  const handleLoadMore = () => {
    const afterDate = getAfterDate(dateRange)
    fetchEvents(pagination.page + 1, 20, {
      ...(selectedType ? { eventType: selectedType } : {}),
      ...(afterDate ? { afterDate } : {})
    })
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={selectedType ?? "all"}
          onValueChange={(value) =>
            setSelectedType(
              value === "all" ? undefined : (value as ActivityEventType)
            )
          }
        >
          <SelectTrigger
            aria-label="Filter by event type"
            className="w-full sm:w-48"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {eventTypeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <fieldset
          className="flex flex-wrap gap-1.5 border-0 p-0"
          aria-label="Filter by date range"
        >
          <legend className="sr-only">Date range</legend>
          {DATE_RANGE_PRESETS.map((preset) => (
            <Button
              key={preset.key}
              variant={dateRange === preset.key ? "default" : "outline"}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setDateRange(preset.key)}
              aria-pressed={dateRange === preset.key}
            >
              {preset.label}
            </Button>
          ))}
        </fieldset>

        {pagination.total > 0 && (
          <AlertDialog>
            <AlertDialogTrigger
              className="text-destructive border-input hover:bg-accent h-8 rounded-md border bg-transparent px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 sm:ml-auto"
              disabled={clearCooldown || isClearing}
            >
              {clearCooldown ? "Cleared" : "Clear History"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear activity history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone. This will permanently delete all{" "}
                  {pagination.total} activity event
                  {pagination.total === 1 ? "" : "s"} from your history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearHistory}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isClearing ? "Clearing…" : "Delete all"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-10 text-center">
          <p className="text-destructive text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => fetchEvents(1, 20)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading skeleton (initial load) */}
      {isLoading && events.length === 0 && (
        <div className="space-y-1">
          {["skel-1", "skel-2", "skel-3", "skel-4"].map((id) => (
            <div key={id} className="flex items-start gap-3 py-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && events.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
          <div className="text-primary bg-primary/8 mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">No activity yet</p>
          <p className="text-muted-foreground/60 mt-1 text-xs">
            Your library changes will appear here
          </p>
        </div>
      )}

      {/* Event list */}
      {groups.length > 0 && (
        <div>
          {groups.map((group) => (
            <div key={group.dateKey}>
              <div className="bg-background/80 sticky top-0 z-10 mx-0 px-2 py-1.5 backdrop-blur-sm">
                <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {group.label}
                </span>
              </div>
              <div className="divide-border divide-y">
                {group.eventIds.map((event) => (
                  <ActivityEventItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {pagination.page < pagination.totalPages && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  )
}
