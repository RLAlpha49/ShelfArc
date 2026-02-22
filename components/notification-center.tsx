"use client"

import {
  CheckmarkBadge02Icon,
  Delete02Icon,
  DollarCircleIcon,
  FileValidationIcon,
  InformationCircleIcon,
  SearchIcon,
  UserAdd01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useNotificationStore } from "@/lib/store/notification-store"
import type { Notification, NotificationType } from "@/lib/types/notification"

const typeConfig: Record<
  NotificationType,
  { icon: IconSvgElement; className: string }
> = {
  import_complete: { icon: FileValidationIcon, className: "text-green-500" },
  scrape_complete: { icon: SearchIcon, className: "text-blue-500" },
  price_alert: { icon: DollarCircleIcon, className: "text-amber-500" },
  release_reminder: {
    icon: InformationCircleIcon,
    className: "text-violet-500"
  },
  new_follow: { icon: UserAdd01Icon, className: "text-sky-500" },
  info: { icon: InformationCircleIcon, className: "text-muted-foreground" }
}

const typeGroupLabel: Record<NotificationType, string> = {
  import_complete: "import complete",
  scrape_complete: "scrape complete",
  price_alert: "price alerts",
  release_reminder: "release reminders",
  new_follow: "new followers",
  info: "notifications"
}

/** A synthetic grouping of multiple notifications of the same type. @source */
interface NotificationGroup {
  readonly kind: "group"
  readonly type: NotificationType
  readonly items: Notification[]
  /** Timestamp of the earliest item in the group (used as a stable key). */
  readonly anchorTimestamp: number
  readonly hasUnread: boolean
}

/** Discriminated union for the flattened + grouped notification list. @source */
type GroupedItem =
  | { readonly kind: "single"; readonly notification: Notification }
  | NotificationGroup

const FIVE_MINUTES_MS = 5 * 60 * 1000

/**
 * Groups consecutive same-type notifications whose timestamps are within a
 * 5-minute window of the first item in the candidate group.
 * Handles both newest-first and oldest-first orderings.
 */
function groupNotifications(notifications: Notification[]): GroupedItem[] {
  const result: GroupedItem[] = []

  for (const notification of notifications) {
    const last = result.at(-1)

    if (
      last?.kind === "group" &&
      last.type === notification.type &&
      Math.abs(notification.timestamp - last.anchorTimestamp) <= FIVE_MINUTES_MS
    ) {
      // Extend existing group (mutate: result is local, not reactive state)
      last.items.push(notification)
      if (!notification.read) {
        // Cast away readonly for in-place accumulation
        ;(last as { hasUnread: boolean }).hasUnread = true
      }
    } else if (
      last?.kind === "single" &&
      last.notification.type === notification.type &&
      Math.abs(notification.timestamp - last.notification.timestamp) <=
        FIVE_MINUTES_MS
    ) {
      // Promote single → group
      result.pop()
      const prev = last.notification
      result.push({
        kind: "group",
        type: notification.type,
        items: [prev, notification],
        anchorTimestamp: prev.timestamp,
        hasUnread: !prev.read || !notification.read
      })
    } else {
      result.push({ kind: "single", notification })
    }
  }

  return result
}

function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function NotificationItem({
  notification,
  onRead,
  onDismiss,
  now
}: {
  readonly notification: Notification
  readonly onRead: (id: string) => void
  readonly onDismiss: (id: string) => void
  readonly now: number
}) {
  const router = useRouter()
  const config = typeConfig[notification.type]

  const meta = notification.metadata
  let href: string | null = null
  if (notification.type === "price_alert") {
    if (typeof meta?.volume_id === "string") {
      href = `/library/volume/${meta.volume_id}`
    } else if (typeof meta?.series_id === "string") {
      href = `/library/series/${meta.series_id}`
    }
  } else if (notification.type === "release_reminder") {
    if (typeof meta?.series_id === "string") {
      href = `/library/series/${meta.series_id}`
    }
  }

  return (
    <div className="group relative">
      <button
        type="button"
        className="hover:bg-accent flex w-full gap-3 px-4 py-3 pr-8 text-left transition-colors"
        onClick={() => {
          onRead(notification.id)
          if (href) router.push(href)
        }}
      >
        <div className={`mt-0.5 shrink-0 ${config.className}`}>
          <HugeiconsIcon icon={config.icon} size={16} strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm leading-tight ${notification.read ? "text-muted-foreground" : "font-medium"}`}
          >
            {notification.title}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
            {notification.message}
          </p>
          <p className="text-muted-foreground/60 mt-1 text-[11px]">
            {formatRelativeTime(notification.timestamp, now)}
          </p>
        </div>
        {!notification.read && (
          <div className="mt-1.5 shrink-0">
            <div className="bg-primary h-2 w-2 rounded-full" />
          </div>
        )}
      </button>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => onDismiss(notification.id)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function NotificationGroupRow({
  group,
  expandedKeys,
  onToggle,
  onGroupRead,
  onGroupDismiss,
  onRead,
  onDismiss,
  now
}: {
  readonly group: NotificationGroup
  readonly expandedKeys: Set<string>
  readonly onToggle: (key: string) => void
  readonly onGroupRead: (group: NotificationGroup) => void
  readonly onGroupDismiss: (group: NotificationGroup) => void
  readonly onRead: (id: string) => void
  readonly onDismiss: (id: string) => void
  readonly now: number
}) {
  const config = typeConfig[group.type]
  const key = `${group.type}:${group.anchorTimestamp}`
  const expanded = expandedKeys.has(key)

  return (
    <div>
      <div className="group relative">
        <button
          type="button"
          className="hover:bg-accent flex w-full gap-3 px-4 py-3 pr-16 text-left transition-colors"
          onClick={() => onToggle(key)}
          aria-expanded={expanded}
        >
          <div className={`mt-0.5 shrink-0 ${config.className}`}>
            <HugeiconsIcon icon={config.icon} size={16} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm leading-tight ${group.hasUnread ? "font-medium" : "text-muted-foreground"}`}
            >
              {group.items.length} {typeGroupLabel[group.type]}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {expanded ? "Click to collapse" : "Click to expand"}
            </p>
          </div>
          {group.hasUnread && (
            <div className="mt-1.5 shrink-0">
              <div className="bg-primary h-2 w-2 rounded-full" />
            </div>
          )}
        </button>
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {group.hasUnread && (
            <button
              type="button"
              aria-label="Mark group as read"
              className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-5 w-5 items-center justify-center rounded-full"
              onClick={() => onGroupRead(group)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss group"
            className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-5 w-5 items-center justify-center rounded-full"
            onClick={() => onGroupDismiss(group)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-border/40 ml-4 border-l">
          {group.items.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={onRead}
              onDismiss={onDismiss}
              now={now}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function NotificationCenter() {
  const notifications = useNotificationStore((s) => s.notifications)
  const markReadOnServer = useNotificationStore((s) => s.markReadOnServer)
  const markAllReadOnServer = useNotificationStore((s) => s.markAllReadOnServer)
  const clearAllOnServer = useNotificationStore((s) => s.clearAllOnServer)
  const dismissOnServer = useNotificationStore((s) => s.dismissOnServer)
  const unreadCount = useNotificationStore((s) => s.unreadCount())
  const [now, setNow] = useState(() => Date.now())
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const handleRead = useCallback(
    (id: string) => {
      markReadOnServer(id)
    },
    [markReadOnServer]
  )

  const handleToggleGroup = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const handleGroupRead = useCallback(
    (group: NotificationGroup) => {
      for (const n of group.items) {
        if (!n.read) markReadOnServer(n.id)
      }
    },
    [markReadOnServer]
  )

  const handleGroupDismiss = useCallback(
    (group: NotificationGroup) => {
      for (const n of group.items) {
        dismissOnServer(n.id)
      }
    },
    [dismissOnServer]
  )

  const grouped = groupNotifications(notifications)

  return (
    <div className="flex w-80 flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <div className="flex gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={markAllReadOnServer}
            >
              <HugeiconsIcon
                icon={CheckmarkBadge02Icon}
                size={12}
                strokeWidth={1.5}
                className="mr-1"
              />
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 px-2 text-xs"
              onClick={clearAllOnServer}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                size={12}
                strokeWidth={1.5}
                className="mr-1"
              />
              Clear
            </Button>
          )}
        </div>
      </div>
      <Separator />
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <HugeiconsIcon
            icon={InformationCircleIcon}
            size={32}
            strokeWidth={1.5}
            className="text-muted-foreground/40 mb-2"
          />
          <p className="text-muted-foreground text-sm">No notifications yet</p>
        </div>
      ) : (
        <ScrollArea className="max-h-96">
          <div className="divide-border divide-y">
            {grouped.map((item) =>
              item.kind === "single" ? (
                <NotificationItem
                  key={item.notification.id}
                  notification={item.notification}
                  onRead={handleRead}
                  onDismiss={dismissOnServer}
                  now={now}
                />
              ) : (
                <NotificationGroupRow
                  key={`${item.type}:${item.anchorTimestamp}`}
                  group={item}
                  expandedKeys={expandedKeys}
                  onToggle={handleToggleGroup}
                  onGroupRead={handleGroupRead}
                  onGroupDismiss={handleGroupDismiss}
                  onRead={handleRead}
                  onDismiss={dismissOnServer}
                  now={now}
                />
              )
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
