import { create } from "zustand"
import { persist } from "zustand/middleware"

/** A recently visited library item. @source */
export interface RecentVisit {
  readonly id: string
  readonly title: string
  readonly type: "series" | "volume"
  readonly visitedAt: number
}

const MAX_RECENT = 20

interface RecentlyVisitedState {
  /** Ordered list of recently visited items (newest first). */
  entries: RecentVisit[]
  /** Record a visit. Deduplicates and caps at {@link MAX_RECENT}. */
  recordVisit: (item: Omit<RecentVisit, "visitedAt">) => void
}

/** Zustand store tracking recently visited series/volumes with localStorage persistence. @source */
export const useRecentlyVisitedStore = create<RecentlyVisitedState>()(
  persist(
    (set) => ({
      entries: [],
      recordVisit: (item) =>
        set((state) => {
          const filtered = state.entries.filter((e) => e.id !== item.id)
          const entry: RecentVisit = { ...item, visitedAt: Date.now() }
          return { entries: [entry, ...filtered].slice(0, MAX_RECENT) }
        })
    }),
    {
      name: "shelfarc-recently-visited",
      partialize: (state) => ({ entries: state.entries })
    }
  )
)
