"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { ActivityEventItem } from "@/components/activity/activity-event-item"
import { Skeleton } from "@/components/ui/skeleton"
import { useActivityFeed } from "@/lib/hooks/use-activity-feed"

type EventLimit = 5 | 10 | 15

const LIMIT_OPTIONS: EventLimit[] = [5, 10, 15]

export function RecentActivityCard() {
  const { events, isLoading, fetchEvents } = useActivityFeed()
  const [limit, setLimit] = useState<EventLimit>(5)

  useEffect(() => {
    fetchEvents(1, limit)
  }, [fetchEvents, limit])

  return (
    <div className="glass-card rounded-xl p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-primary bg-primary/8 flex h-6 w-6 items-center justify-center rounded-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Recent Activity
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) as EventLimit)}
            aria-label="Number of events to show"
            className="text-muted-foreground bg-transparent text-xs focus:outline-none"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} events
              </option>
            ))}
          </select>
          {events.length > 0 && (
            <Link
              href="/activity"
              className="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
            >
              View all
            </Link>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && events.length === 0 && (
        <div className="space-y-1">
          {["skel-1", "skel-2", "skel-3"].map((id) => (
            <div key={id} className="flex items-start gap-3 py-2">
              <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && events.length === 0 && (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No recent activity
        </p>
      )}

      {/* Events */}
      {events.length > 0 && (
        <div className="divide-border divide-y">
          {events.map((event) => (
            <ActivityEventItem key={event.id} event={event} compact />
          ))}
        </div>
      )}
    </div>
  )
}
