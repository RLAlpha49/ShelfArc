import { create } from "zustand"
import { persist } from "zustand/middleware"

import { createClient } from "@/lib/supabase/client"
import type { Notification } from "@/lib/types/notification"

const MAX_NOTIFICATIONS = 50

let _supabaseClient: ReturnType<typeof createClient> | null = null
let _realtimeChannel: ReturnType<
  ReturnType<typeof createClient>["channel"]
> | null = null

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
  subscribeToRealtime: (userId: string) => void
  unsubscribeFromRealtime: () => void
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

      subscribeToRealtime: (userId) => {
        if (_realtimeChannel) return
        _supabaseClient = createClient()
        _realtimeChannel = _supabaseClient
          .channel("notifications")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`
            },
            (payload) => {
              const raw = payload.new as Record<string, unknown>
              const notification: Notification = {
                id: raw.id as string,
                type: raw.type as Notification["type"],
                title: raw.title as string,
                message: raw.message as string,
                read: raw.read as boolean,
                metadata: (raw.metadata as Record<string, unknown>) ?? {},
                timestamp: new Date(raw.created_at as string).getTime()
              }
              set((state) => ({
                notifications: [notification, ...state.notifications].slice(
                  0,
                  MAX_NOTIFICATIONS
                )
              }))
            }
          )
          .subscribe()
      },

      unsubscribeFromRealtime: () => {
        if (!_realtimeChannel || !_supabaseClient) return
        _supabaseClient.removeChannel(_realtimeChannel)
        _realtimeChannel = null
        _supabaseClient = null
      },

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
