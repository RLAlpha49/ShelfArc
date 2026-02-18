import { create } from "zustand"
import { persist } from "zustand/middleware"

/** Maximum number of user-created collections. */
const MAX_COLLECTIONS = 20

/** Default colors for collection badges. */
const COLLECTION_COLORS = [
  "#c2855a",
  "#b8860b",
  "#6b8e23",
  "#4682b4",
  "#8b5cf6",
  "#e11d48",
  "#0891b2",
  "#65a30d"
] as const

/** A user-defined collection/shelf. @source */
export interface Collection {
  id: string
  name: string
  color: string
  volumeIds: string[]
  createdAt: string
  isSystem: boolean
}

/** System collection IDs that cannot be deleted. */
const SYSTEM_CURRENTLY_READING = "system_currently_reading"
const SYSTEM_FAVORITES = "system_favorites"

/** Predefined system collections. */
const SYSTEM_COLLECTIONS: Collection[] = [
  {
    id: SYSTEM_CURRENTLY_READING,
    name: "Currently Reading",
    color: "#4682b4",
    volumeIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    isSystem: true
  },
  {
    id: SYSTEM_FAVORITES,
    name: "Favorites",
    color: "#e11d48",
    volumeIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    isSystem: true
  }
]

function createCollectionId(): string {
  const cryptoObj = globalThis.crypto
  if (
    cryptoObj &&
    "randomUUID" in cryptoObj &&
    typeof cryptoObj.randomUUID === "function"
  ) {
    return cryptoObj.randomUUID()
  }
  return `col_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/** State and actions for the collections store. @source */
interface CollectionsState {
  collections: Collection[]
  activeCollectionId: string | null
  initialized: boolean

  // Actions
  ensureDefaults: () => void
  addCollection: (name: string, color?: string) => string | null
  renameCollection: (id: string, name: string) => void
  deleteCollection: (id: string) => void
  setCollectionColor: (id: string, color: string) => void
  addVolumesToCollection: (collectionId: string, volumeIds: string[]) => void
  removeVolumesFromCollection: (
    collectionId: string,
    volumeIds: string[]
  ) => void
  setActiveCollection: (id: string | null) => void
  getCollectionsForVolume: (volumeId: string) => Collection[]
}

/** Zustand store for custom collections/shelves with localStorage persistence. @source */
export const useCollectionsStore = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: [],
      activeCollectionId: null,
      initialized: false,

      ensureDefaults: () => {
        const state = get()
        if (state.initialized) return

        const existing = state.collections
        const hasSystem = (id: string) => existing.some((c) => c.id === id)

        const merged = [...existing]
        for (const sys of SYSTEM_COLLECTIONS) {
          if (!hasSystem(sys.id)) merged.push(sys)
        }

        set({ collections: merged, initialized: true })
      },

      addCollection: (rawName, color) => {
        const name = rawName.trim()
        if (!name) return null

        const state = get()
        const userCollections = state.collections.filter((c) => !c.isSystem)
        if (userCollections.length >= MAX_COLLECTIONS) return null

        const id = createCollectionId()
        const newCollection: Collection = {
          id,
          name,
          color:
            color ??
            COLLECTION_COLORS[
              state.collections.length % COLLECTION_COLORS.length
            ],
          volumeIds: [],
          createdAt: new Date().toISOString(),
          isSystem: false
        }

        set((prev) => ({
          collections: [...prev.collections, newCollection]
        }))
        return id
      },

      renameCollection: (id, rawName) => {
        const name = rawName.trim()
        if (!name) return

        set((prev) => ({
          collections: prev.collections.map((c) =>
            c.id === id ? { ...c, name } : c
          )
        }))
      },

      deleteCollection: (id) => {
        const state = get()
        const target = state.collections.find((c) => c.id === id)
        if (!target || target.isSystem) return

        set((prev) => ({
          collections: prev.collections.filter((c) => c.id !== id),
          activeCollectionId:
            prev.activeCollectionId === id ? null : prev.activeCollectionId
        }))
      },

      setCollectionColor: (id, color) => {
        set((prev) => ({
          collections: prev.collections.map((c) =>
            c.id === id ? { ...c, color } : c
          )
        }))
      },

      addVolumesToCollection: (collectionId, volumeIds) => {
        set((prev) => ({
          collections: prev.collections.map((c) => {
            if (c.id !== collectionId) return c
            const idSet = new Set(c.volumeIds)
            for (const vid of volumeIds) idSet.add(vid)
            return { ...c, volumeIds: Array.from(idSet) }
          })
        }))
      },

      removeVolumesFromCollection: (collectionId, volumeIds) => {
        const toRemove = new Set(volumeIds)
        set((prev) => ({
          collections: prev.collections.map((c) => {
            if (c.id !== collectionId) return c
            return {
              ...c,
              volumeIds: c.volumeIds.filter((vid) => !toRemove.has(vid))
            }
          })
        }))
      },

      setActiveCollection: (id) => set({ activeCollectionId: id }),

      getCollectionsForVolume: (volumeId) => {
        return get().collections.filter((c) => c.volumeIds.includes(volumeId))
      }
    }),
    {
      name: "shelfarc-collections",
      onRehydrateStorage: () => (state) => {
        state?.ensureDefaults()
      },
      partialize: (state) => ({
        collections: state.collections,
        initialized: state.initialized
      })
    }
  )
)

export { COLLECTION_COLORS, MAX_COLLECTIONS }
