import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Notification } from "@/lib/types/notification"

const MAX_NOTIFICATIONS = 50

interface NotificationStore {
  _hydrated: boolean
  notifications: Notification[]
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
  unreadCount: () => number
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      _hydrated: false,
      notifications: [],

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

      unreadCount: () => get().notifications.filter((n) => !n.read).length
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
