"use client"

import { Notification02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { NotificationCenter } from "@/components/notification-center"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { useNotificationStore } from "@/lib/store/notification-store"

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const unreadCount = useNotificationStore((s) => s.unreadCount())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="focus-visible:ring-ring focus-visible:ring-offset-background text-muted-foreground hover:text-foreground hover:bg-accent relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label={
              unreadCount > 0
                ? `Open notifications, ${unreadCount} unread`
                : "Open notifications"
            }
          />
        }
      >
        <HugeiconsIcon icon={Notification02Icon} size={16} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0" sideOffset={8}>
        <NotificationCenter />
      </PopoverContent>
    </Popover>
  )
}
