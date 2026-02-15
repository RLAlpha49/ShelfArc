"use client"

import { useState, useCallback } from "react"
import type { ActivityEvent, ActivityEventType } from "@/lib/types/database"

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

type Filters = {
  eventType?: ActivityEventType
  entityType?: string
}

export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(
    async (page = 1, limit = 20, filters?: Filters) => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit)
        })
        if (filters?.eventType) params.set("eventType", filters.eventType)
        if (filters?.entityType) params.set("entityType", filters.entityType)

        const res = await fetch(`/api/activity?${params}`)
        if (!res.ok) throw new Error("Failed to fetch activity")

        const json = await res.json()
        if (page === 1) {
          setEvents(json.data)
        } else {
          setEvents((prev) => [...prev, ...json.data])
        }
        setPagination(json.pagination)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch activity"
        )
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return { events, pagination, isLoading, error, fetchEvents }
}
