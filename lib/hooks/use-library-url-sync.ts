"use client"

import { useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useLibraryStore } from "@/lib/store/library-store"
import type {
  SortField,
  SortOrder,
  CollectionView,
  ViewMode
} from "@/lib/store/library-store"
import type {
  TitleType,
  OwnershipStatus,
  ReadingStatus
} from "@/lib/types/database"

const VALID_TYPES = new Set(["all", "manga", "light_novel", "other"])
const VALID_OWNERSHIP = new Set(["all", "owned", "wishlist"])
const VALID_READING = new Set([
  "all",
  "unread",
  "reading",
  "completed",
  "on_hold",
  "dropped"
])
const VALID_SORT_FIELDS = new Set([
  "title",
  "created_at",
  "updated_at",
  "author",
  "rating",
  "volume_count",
  "price"
])
const VALID_SORT_ORDERS = new Set(["asc", "desc"])
const VALID_COLLECTION_VIEWS = new Set(["series", "volumes"])
const VALID_VIEW_MODES = new Set(["grid", "list"])

const DEFAULT_SORT_FIELD = "title"
const DEFAULT_SORT_ORDER = "asc"
const DEFAULT_COLLECTION_VIEW = "series"
const DEFAULT_VIEW_MODE = "grid"

function getValidParam<T extends string>(
  params: URLSearchParams,
  key: string,
  validSet: Set<string>
): T | null {
  const value = params.get(key)
  return value && validSet.has(value) ? (value as T) : null
}

function applyUrlToStore(searchParams: URLSearchParams) {
  const PARAM_KEYS = [
    "q",
    "type",
    "ownership",
    "reading",
    "tags",
    "sort",
    "order",
    "view",
    "mode"
  ]
  if (!PARAM_KEYS.some((key) => searchParams.has(key))) return

  const store = useLibraryStore.getState()
  const updates: Record<string, unknown> = {}

  const q = searchParams.get("q")
  if (q != null) updates.search = q

  const type = getValidParam<TitleType | "all">(
    searchParams,
    "type",
    VALID_TYPES
  )
  if (type) updates.type = type

  const ownership = getValidParam<OwnershipStatus | "all">(
    searchParams,
    "ownership",
    VALID_OWNERSHIP
  )
  if (ownership) updates.ownershipStatus = ownership

  const reading = getValidParam<ReadingStatus | "all">(
    searchParams,
    "reading",
    VALID_READING
  )
  if (reading) updates.readingStatus = reading

  const tags = searchParams.get("tags")
  if (tags) updates.tags = tags.split(",").filter(Boolean)

  if (Object.keys(updates).length > 0) {
    store.setFilters(updates as Parameters<typeof store.setFilters>[0])
  }

  const sort = getValidParam<SortField>(searchParams, "sort", VALID_SORT_FIELDS)
  if (sort) store.setSortField(sort)

  const order = getValidParam<SortOrder>(
    searchParams,
    "order",
    VALID_SORT_ORDERS
  )
  if (order) store.setSortOrder(order)

  const view = getValidParam<CollectionView>(
    searchParams,
    "view",
    VALID_COLLECTION_VIEWS
  )
  if (view) store.setCollectionView(view)

  const mode = getValidParam<ViewMode>(searchParams, "mode", VALID_VIEW_MODES)
  if (mode) store.setViewMode(mode)
}

/**
 * Syncs library filter, sort, and view state between the Zustand store and URL search params.
 * Reads from URL on mount; writes to URL when store changes.
 */
export function useLibraryUrlSync() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const initializedRef = useRef(false)

  // Read URL → store on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    applyUrlToStore(searchParams)
  }, [searchParams])

  // Write store → URL on changes
  useEffect(() => {
    const unsubscribe = useLibraryStore.subscribe((state) => {
      if (!initializedRef.current) return

      const params = new URLSearchParams()

      if (state.filters.search) params.set("q", state.filters.search)
      if (state.filters.type !== "all") params.set("type", state.filters.type)
      if (state.filters.ownershipStatus !== "all")
        params.set("ownership", state.filters.ownershipStatus)
      if (state.filters.readingStatus !== "all")
        params.set("reading", state.filters.readingStatus)
      if (state.filters.tags.length > 0)
        params.set("tags", state.filters.tags.join(","))
      if (state.sortField !== DEFAULT_SORT_FIELD)
        params.set("sort", state.sortField)
      if (state.sortOrder !== DEFAULT_SORT_ORDER)
        params.set("order", state.sortOrder)
      if (state.collectionView !== DEFAULT_COLLECTION_VIEW)
        params.set("view", state.collectionView)
      if (state.viewMode !== DEFAULT_VIEW_MODE)
        params.set("mode", state.viewMode)

      const search = params.toString()
      const url = search ? `${pathname}?${search}` : pathname
      router.replace(url, { scroll: false })
    })

    return unsubscribe
  }, [pathname, router])
}
