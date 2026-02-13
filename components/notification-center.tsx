"use client"

import { useCallback } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  FileValidationIcon,
  SearchIcon,
  DollarCircleIcon,
  InformationCircleIcon,
  CheckmarkBadge02Icon,
  Delete02Icon
} from "@hugeicons/core-free-icons"
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
  info: { icon: InformationCircleIcon, className: "text-muted-foreground" }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
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
  onRead
}: {
  readonly notification: Notification
  readonly onRead: (id: string) => void
}) {
  const config = typeConfig[notification.type]

  return (
    <button
      type="button"
      className="hover:bg-accent flex w-full gap-3 px-4 py-3 text-left transition-colors"
      onClick={() => onRead(notification.id)}
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
          {formatRelativeTime(notification.timestamp)}
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
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const clearAll = useNotificationStore((s) => s.clearAll)
  const unreadCount = useNotificationStore((s) => s.unreadCount())

  const handleRead = useCallback(
    (id: string) => {
      markRead(id)
    },
    [markRead]
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
              onClick={markAllRead}
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
              onClick={clearAll}
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
          <p className="text-muted-foreground text-sm">
            No notifications yet
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-96">
          <div className="divide-border divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={handleRead}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
