"use client"

import Link from "next/link"

import type { ActivityEvent, ActivityEventType } from "@/lib/types/database"

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: diffDay > 365 ? "numeric" : undefined
  })
}

type EventConfig = {
  icon: React.ReactNode
  label: string
  getDetail: (metadata: Record<string, unknown>) => string
  entityHref?: (
    entityType: string | null,
    entityId: string | null
  ) => string | null
}

const eventConfigs: Record<ActivityEventType, EventConfig> = {
  volume_added: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    label: "Added a volume",
    getDetail: (m) => (m.title as string) || "",
    entityHref: (type, id) =>
      type === "volume" && id ? `/library/volume/${id}` : null
  },
  volume_updated: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    ),
    label: "Updated a volume",
    getDetail: (m) => (m.title as string) || "",
    entityHref: (type, id) =>
      type === "volume" && id ? `/library/volume/${id}` : null
  },
  volume_deleted: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
    ),
    label: "Removed a volume",
    getDetail: (m) => (m.title as string) || "",
    entityHref: () => null
  },
  series_created: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        <line x1="12" y1="10" x2="12" y2="16" />
        <line x1="9" y1="13" x2="15" y2="13" />
      </svg>
    ),
    label: "Created a series",
    getDetail: (m) => (m.title as string) || "",
    entityHref: (type, id) =>
      type === "series" && id ? `/library/series/${id}` : null
  },
  series_updated: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    ),
    label: "Updated a series",
    getDetail: (m) => (m.title as string) || "",
    entityHref: (type, id) =>
      type === "series" && id ? `/library/series/${id}` : null
  },
  series_deleted: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
    ),
    label: "Removed a series",
    getDetail: (m) => (m.title as string) || "",
    entityHref: () => null
  },
  price_alert_triggered: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
    label: "Price alert triggered",
    getDetail: (m) => {
      const parts: string[] = []
      if (m.title) parts.push(m.title as string)
      if (m.price) parts.push(`$${m.price}`)
      return parts.join(" — ")
    },
    entityHref: (type, id) =>
      type === "volume" && id ? `/library/volume/${id}` : null
  },
  import_completed: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    label: "Import completed",
    getDetail: (m) => {
      if (!m.count) return ""
      const n = m.count as number
      return `${n} item${n === 1 ? "" : "s"}`
    },
    entityHref: () => null
  },
  scrape_completed: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
    ),
    label: "Scrape completed",
    getDetail: (m) => {
      if (!m.count) return ""
      const n = m.count as number
      return `${n} volume${n === 1 ? "" : "s"} updated`
    },
    entityHref: () => null
  },
  reading_status_changed: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        <path d="m9 9 2 2 4-4" />
      </svg>
    ),
    label: "Reading status changed",
    getDetail: (m) => {
      const from = m.from as string | undefined
      const to = m.to as string | undefined
      const title = m.volumeTitle as string | undefined
      const parts: string[] = []
      if (title) parts.push(title)
      if (from && to) parts.push(`${from} → ${to}`)
      return parts.join(" — ")
    },
    entityHref: (type, id) =>
      type === "volume" && id ? `/library/volume/${id}` : null
  },
  bulk_scrape_completed: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        <polyline points="9 11 12 14 22 4" />
      </svg>
    ),
    label: "Bulk scrape completed",
    getDetail: (m) => {
      if (!m.count) return ""
      const n = m.count as number
      return `${n} volume${n === 1 ? "" : "s"} updated`
    },
    entityHref: () => null
  },
  settings_updated: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    label: "Settings updated",
    getDetail: (m) => (m.section as string) || "",
    entityHref: () => null
  },
  session_revoked: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        <line x1="8" y1="15" x2="16" y2="15" />
      </svg>
    ),
    label: "Session revoked",
    getDetail: (m) => (m.device as string) || "",
    entityHref: () => null
  },
  tag_added: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <path d="M7 7h.01" />
        <line x1="12" y1="8" x2="12" y2="14" />
        <line x1="9" y1="11" x2="15" y2="11" />
      </svg>
    ),
    label: "Tag added",
    getDetail: (m) => {
      const tag = m.tag as string | undefined
      const title = m.title as string | undefined
      const parts: string[] = []
      if (tag) parts.push(tag)
      if (title) parts.push(title)
      return parts.join(" — ")
    },
    entityHref: (type, id) =>
      type === "volume" && id ? `/library/volume/${id}` : null
  },
  tag_removed: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <path d="M7 7h.01" />
        <line x1="9" y1="11" x2="15" y2="11" />
      </svg>
    ),
    label: "Tag removed",
    getDetail: (m) => {
      const tag = m.tag as string | undefined
      const title = m.title as string | undefined
      const parts: string[] = []
      if (tag) parts.push(tag)
      if (title) parts.push(title)
      return parts.join(" — ")
    },
    entityHref: (type, id) =>
      type === "volume" && id ? `/library/volume/${id}` : null
  },
  volume_merged: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <circle cx="18" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M6 21V9a9 9 0 0 0 9 9" />
      </svg>
    ),
    label: "Volumes merged",
    getDetail: (m) => (m.title as string) || "",
    entityHref: (type, id) =>
      type === "volume" && id ? `/library/volume/${id}` : null
  }
}

interface ActivityEventItemProps {
  readonly event: ActivityEvent
  readonly compact?: boolean
}

export function ActivityEventItem({
  event,
  compact = false
}: ActivityEventItemProps) {
  const config = eventConfigs[event.event_type]
  const metadata = (event.metadata ?? {}) as Record<string, unknown>
  const detail = config.getDetail(metadata)
  const href = config.entityHref?.(event.entity_type, event.entity_id) ?? null

  const content = (
    <div
      className={`group flex items-start gap-3 ${compact ? "py-2" : "py-3"}`}
    >
      {/* Icon */}
      <div className="text-primary bg-primary/8 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
        {config.icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span
              className={`text-sm font-medium ${href ? "group-hover:text-primary transition-colors" : ""}`}
            >
              {config.label}
            </span>
            {detail && (
              <span className="text-muted-foreground ml-1.5 text-sm">
                {detail}
              </span>
            )}
          </div>
          <time className="text-muted-foreground/60 shrink-0 text-xs">
            {formatRelativeTime(event.created_at)}
          </time>
        </div>
      </div>

      {/* Chevron for linked items */}
      {href && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground/40 group-hover:text-primary mt-1 h-3.5 w-3.5 shrink-0 transition-all group-hover:translate-x-0.5"
        >
          <polyline points="9,18 15,12 9,6" />
        </svg>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }

  return content
}
