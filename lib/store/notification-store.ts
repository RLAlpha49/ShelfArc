import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { Notification } from "@/lib/types/notification"

const MAX_NOTIFICATIONS = 50

interface NotificationStore {
  _hydrated: boolean
  notifications: Notification[]
  lastSyncedAt: number | null
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
  unreadCount: () => number
  loadFromServer: () => Promise<void>
  syncToServer: (
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => Promise<void>
  markReadOnServer: (id: string) => void
  markAllReadOnServer: () => void
  clearAllOnServer: () => void
  dismissOnServer: (id: string) => void
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      _hydrated: false,
      notifications: [],
      lastSyncedAt: null,

      addNotification: (notification) => {
        const cryptoObj = globalThis.crypto
        const id =
          cryptoObj &&
          "randomUUID" in cryptoObj &&
          typeof cryptoObj.randomUUID === "function"
            ? cryptoObj.randomUUID()
            : `notif_${Date.now()}_${Math.random().toString(16).slice(2)}`

        const newNotification: Notification = {
          ...notification,
          id,
          timestamp: Date.now(),
          read: false
        }

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(
            0,
            MAX_NOTIFICATIONS
          )
        }))

        get()
          .syncToServer(notification)
          .catch(() => {})
      },

      markRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          )
        })),

      markAllRead: () =>
        set((state) => {
          return {
            notifications: state.notifications.map((n) => ({
              ...n,
              read: true
            }))
          }
        }),

      clearAll: () => set({ notifications: [] }),

      unreadCount: () => get().notifications.filter((n) => !n.read).length,

      loadFromServer: async () => {
        try {
          const res = await fetch("/api/notifications?limit=50")
          if (!res.ok) return
          const json = await res.json()
          const rows = json?.data
          if (!Array.isArray(rows)) return

          const mapped: Notification[] = rows.map(
            (row: {
              id: string
              type: Notification["type"]
              title: string
              message: string
              read: boolean
              metadata?: Record<string, unknown>
              created_at: string
            }) => ({
              id: row.id,
              type: row.type,
              title: row.title,
              message: row.message,
              read: row.read,
              metadata: row.metadata ?? {},
              timestamp: new Date(row.created_at).getTime()
            })
          )

          set({ notifications: mapped, lastSyncedAt: Date.now() })
        } catch {
          // Silently fail — localStorage cache remains
        }
      },

      syncToServer: async (notification) => {
        try {
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: notification.type,
              title: notification.title,
              message: notification.message,
              metadata: notification.metadata ?? {}
            })
          })
        } catch {
          // Fire-and-forget
        }
      },

      markReadOnServer: (id) => {
        get().markRead(id)
        fetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true })
        }).catch(() => {})
      },

      markAllReadOnServer: () => {
        get().markAllRead()
        fetch("/api/notifications/mark-all-read", {
          method: "POST"
        }).catch(() => {})
      },

      clearAllOnServer: () => {
        get().clearAll()
        fetch("/api/notifications", {
          method: "DELETE"
        }).catch(() => {})
      },

      dismissOnServer: (id) => {
        const notification = get().notifications.find((n) => n.id === id)
        if (!notification) return
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        }))
        fetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: "DELETE"
        }).catch(() => {
          // Rollback: restore the dismissed notification in sorted order
          set((state) => ({
            notifications: [notification, ...state.notifications].sort(
              (a, b) => b.timestamp - a.timestamp
            )
          }))
        })
      }
    }),
    {
      name: "shelfarc-notifications",
      onRehydrateStorage: () => () => {
        useNotificationStore.setState({ _hydrated: true })
      },
      partialize: (state) => ({
        notifications: state.notifications
      })
    }
  )
)
