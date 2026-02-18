"use client"

import { useEffect, useState } from "react"
import { useActivityFeed } from "@/lib/hooks/use-activity-feed"
import { ActivityEventItem } from "@/components/activity/activity-event-item"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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

export function ActivityFeed() {
  const { events, pagination, isLoading, error, fetchEvents } =
    useActivityFeed()
  const [selectedType, setSelectedType] = useState<
    ActivityEventType | undefined
  >(undefined)

  useEffect(() => {
    fetchEvents(1, 20, selectedType ? { eventType: selectedType } : undefined)
  }, [fetchEvents, selectedType])

  const handleLoadMore = () => {
    fetchEvents(
      pagination.page + 1,
      20,
      selectedType ? { eventType: selectedType } : undefined
    )
  }

  return (
    <div>
      {/* Filter */}
      <div className="mb-6 flex items-center gap-2">
        <select
          value={selectedType ?? ""}
          onChange={(e) =>
            setSelectedType((e.target.value as ActivityEventType) || undefined)
          }
          className="bg-card border-border text-foreground rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="">All events</option>
          {eventTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
      {events.length > 0 && (
        <div className="divide-border divide-y">
          {events.map((event) => (
            <ActivityEventItem key={event.id} event={event} />
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
