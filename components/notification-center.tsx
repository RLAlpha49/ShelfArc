"use client"

import {
  CheckmarkBadge02Icon,
  Delete02Icon,
  DollarCircleIcon,
  FileValidationIcon,
  InformationCircleIcon,
  SearchIcon
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
  info: { icon: InformationCircleIcon, className: "text-muted-foreground" }
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
  now
}: {
  readonly notification: Notification
  readonly onRead: (id: string) => void
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
    <button
      type="button"
      className="hover:bg-accent flex w-full gap-3 px-4 py-3 text-left transition-colors"
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
  )
}

export function NotificationCenter() {
  const notifications = useNotificationStore((s) => s.notifications)
  const markReadOnServer = useNotificationStore((s) => s.markReadOnServer)
  const markAllReadOnServer = useNotificationStore((s) => s.markAllReadOnServer)
  const clearAllOnServer = useNotificationStore((s) => s.clearAllOnServer)
  const unreadCount = useNotificationStore((s) => s.unreadCount())
  const [now, setNow] = useState(() => Date.now())

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
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={handleRead}
                now={now}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
