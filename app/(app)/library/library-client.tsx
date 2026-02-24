"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import { ErrorBoundary } from "@/components/error-boundary"
import { CollectionsPanel } from "@/components/library/collections-panel"
import { LibraryContent } from "@/components/library/library-content"
import { LibraryDialogs } from "@/components/library/library-dialogs"
import { LibraryStatsBar } from "@/components/library/library-stats-bar"
import { LibraryToolbar } from "@/components/library/library-toolbar"
import { VolumeSelectionBar } from "@/components/library/volume-selection-bar"
import { announce } from "@/components/live-announcer"
import { SyncIndicator } from "@/components/ui/sync-indicator"
import { AMAZON_BINDING_LABELS } from "@/lib/books/amazon-query"
import { normalizeIsbn } from "@/lib/books/isbn"
import type { BookSearchResult } from "@/lib/books/search"
import { batchedAllSettled } from "@/lib/concurrency/limiter"
import { LibraryActionsProvider } from "@/lib/context/library-actions-context"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryBulkOperations } from "@/lib/hooks/use-library-bulk-operations"
import { useLibraryDialogs } from "@/lib/hooks/use-library-dialogs"
import { useLibrarySelection } from "@/lib/hooks/use-library-selection"
import { useLibraryUrlSync } from "@/lib/hooks/use-library-url-sync"
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh"
import { useVolumeActions } from "@/lib/hooks/use-volume-actions"
import { useBreakpoint } from "@/lib/hooks/use-window-width"
import { getGridColumnCount, getGridGapPx } from "@/lib/library/grid-utils"
import { useCollectionsStore } from "@/lib/store/collections-store"
import { CollectionView, useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type {
  OwnershipStatus,
  SeriesWithVolumes,
  Volume
} from "@/lib/types/database"

/** Build scrape targets from current selection. Pure helper, extracted to reduce component complexity. */
function buildScrapeTargets(
  collectionView: CollectionView,
  filteredSeries: SeriesWithVolumes[],
  selectedSeriesIds: Set<string>,
  series: SeriesWithVolumes[],
  selectedVolumeIds: Set<string>
): SeriesWithVolumes[] {
  if (collectionView === "series") {
    return filteredSeries.filter((s) => selectedSeriesIds.has(s.id))
  }
  const seriesMap = new Map<string, SeriesWithVolumes>()
  for (const s of series) {
    const selectedVols = s.volumes.filter((v) => selectedVolumeIds.has(v.id))
    if (selectedVols.length > 0) {
      seriesMap.set(s.id, { ...s, volumes: selectedVols })
    }
  }
  return Array.from(seriesMap.values())
}

/** Toast results of a batch volume-attach operation. */
function toastVolumeAttachResults(successCount: number, failureCount: number) {
  if (successCount > 0) {
    toast.success(
      `Added ${successCount} volume${successCount === 1 ? "" : "s"} to the series`
    )
  }
  if (failureCount > 0) {
    toast.error(
      `${failureCount} volume${failureCount === 1 ? "" : "s"} failed to attach`
    )
  }
}

/** Toast results of an assign-to-series batch operation. */
function toastAssignResults(successCount: number, failureCount: number) {
  if (successCount > 0) {
    toast.success(
      `Assigned ${successCount} book${successCount === 1 ? "" : "s"} to series`
    )
  }
  if (failureCount > 0) {
    toast.error(
      `${failureCount} assignment${failureCount === 1 ? "" : "s"} failed`
    )
  }
}

/** Toast success and/or failure counts for a generic batch operation. */
function toastBatchOp(
  successCount: number,
  failureCount: number,
  successMsg: string,
  failMsg: string
) {
  if (successCount > 0) toast.success(successMsg)
  if (failureCount > 0) toast.error(failMsg)
}

/**
 * Builds a flat lookup map from volume ID to Volume across all series and unassigned volumes.
 * @param series - All series with their volumes.
 * @param unassignedVolumes - Volumes not assigned to any series.
 * @returns Map of volume ID → Volume.
 */
function buildVolumeLookup(
  series: SeriesWithVolumes[],
  unassignedVolumes: Volume[]
): Map<string, Volume> {
  const map = new Map<string, Volume>()
  for (const seriesItem of series) {
    for (const volume of seriesItem.volumes) {
      map.set(volume.id, volume)
    }
  }
  for (const volume of unassignedVolumes) {
    map.set(volume.id, volume)
  }
  return map
}

/**
 * Returns the next sequential volume number for a series.
 * Falls back to 1 when the series cannot be found.
 * @param seriesId - The target series ID, or null for unassigned.
 * @param series - Full series list.
 * @returns Suggested next volume number.
 */
function computeNextVolumeNumber(
  seriesId: string | null,
  series: SeriesWithVolumes[]
): number {
  if (!seriesId) return 1
  const targetSeries = series.find((item) => item.id === seriesId)
  if (!targetSeries) return 1
  const maxVolume = targetSeries.volumes.reduce(
    (max, volume) => Math.max(max, volume.volume_number),
    0
  )
  return maxVolume + 1
}

/** Animated pull-to-refresh indicator shown at the top of the page. */
function PullToRefreshIndicator({
  isPulling,
  isRefreshing,
  pullDistance
}: {
  readonly isPulling: boolean
  readonly isRefreshing: boolean
  readonly pullDistance: number
}) {
  if (!isPulling && !isRefreshing) return null
  return (
    <div
      className="pointer-events-none fixed top-0 right-0 left-0 z-50 flex justify-center"
      style={{
        transform: isRefreshing
          ? "translateY(0)"
          : `translateY(${Math.min(pullDistance - 40, 20)}px)`,
        opacity: isRefreshing ? 1 : Math.min(pullDistance / 80, 1),
        transition: isRefreshing ? "transform 0.2s ease" : "none"
      }}
    >
      <div className="bg-background/90 mt-2 rounded-full border p-2 shadow-lg backdrop-blur-sm">
        <svg
          className={`text-copper h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    </div>
  )
}

/**
 * Main library page for browsing, filtering, and managing the user's series and volume collection.
 * @source
 */
export default function LibraryClient({
  initialData
}: {
  readonly initialData: {
    series: SeriesWithVolumes[]
    unassignedVolumes: Volume[]
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useLibraryUrlSync()
  const consumedAddParamRef = useRef<string | null>(null)

  const hydrateCollections = useCollectionsStore((s) => s.hydrate)
  useEffect(() => {
    void hydrateCollections()
  }, [hydrateCollections])
  const {
    series,
    unassignedVolumes,
    filteredSeries,
    filteredVolumes,
    filteredUnassignedVolumes,
    isLoading,
    seriesProgress,
    fetchSeries,
    createSeries,
    editSeries,
    removeSeries,
    createVolume,
    editVolume,
    removeVolume,
    addBookFromSearchResult,
    addBooksFromSearchResults
  } = useLibrary()

  const {
    viewMode,
    setSelectedSeries,
    collectionView,
    deleteSeriesVolumes,
    amazonDomain,
    amazonPreferKindle
  } = useLibraryStore()
  const cardSize = useSettingsStore((s) => s.cardSize)
  const bp = useBreakpoint()
  const gridColumnCount = useMemo(
    () => getGridColumnCount(cardSize, bp),
    [cardSize, bp]
  )
  const gridGapPx = useMemo(() => getGridGapPx(cardSize), [cardSize])
  const confirmBeforeDelete = useSettingsStore((s) => s.confirmBeforeDelete)
  const amazonBindingLabel = AMAZON_BINDING_LABELS[Number(amazonPreferKindle)]

  const libraryHeadingRef = useRef<HTMLHeadingElement>(null)

  const {
    searchDialogOpen,
    setSearchDialogOpen,
    seriesDialogOpen,
    setSeriesDialogOpen,
    editingSeries,
    setEditingSeries,
    volumeDialogOpen,
    setVolumeDialogOpen,
    editingVolume,
    setEditingVolume,
    selectedSeriesId,
    setSelectedSeriesId,
    pendingSeriesSelection,
    setPendingSeriesSelection,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletingSeries,
    setDeletingSeries,
    deleteVolumeDialogOpen,
    setDeleteVolumeDialogOpen,
    deletingVolume,
    setDeletingVolume,
    bulkDeleteDialogOpen,
    setBulkDeleteDialogOpen,
    assignToSeriesDialogOpen,
    setAssignToSeriesDialogOpen,
    duplicateDialogOpen,
    setDuplicateDialogOpen,
    scrapeTarget,
    setScrapeTarget,
    bulkEditDialogOpen,
    setBulkEditDialogOpen,
    addToCollectionDialogOpen,
    setAddToCollectionDialogOpen
  } = useLibraryDialogs()

  const initialDataRef = useRef(initialData)
  const initialized = useRef(false)
  // Seed the store with SSR data exactly once on mount. We capture initialData
  // in a ref so the layout effect has no reactive deps but still reads the
  // correct snapshot without triggering a Zustand update during render.
  useLayoutEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const state = useLibraryStore.getState()
    if (state.seriesIds.length === 0) {
      state.setSeries(initialDataRef.current.series)
      state.setUnassignedVolumes(initialDataRef.current.unassignedVolumes)
      state.setLastFetchedAt(Date.now())
    }
  }, [])

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  const handlePullRefresh = useCallback(async () => {
    await fetchSeries()
  }, [fetchSeries])

  const { pullDistance, isRefreshing, isPulling } = usePullToRefresh({
    onRefresh: handlePullRefresh
  })

  const existingEntries = useMemo(() => {
    const assigned = series.flatMap((seriesItem) =>
      seriesItem.volumes.map((volume) => ({
        title: volume.title ?? null,
        isbn: volume.isbn ?? null,
        author: seriesItem.author ?? null
      }))
    )
    const unassigned = unassignedVolumes.map((volume) => ({
      title: volume.title ?? null,
      isbn: volume.isbn ?? null,
      author: null
    }))
    return [...assigned, ...unassigned]
  }, [series, unassignedVolumes])

  const existingIsbns = useMemo(() => {
    const normalized = existingEntries
      .map((item) => item.isbn)
      .filter((isbn): isbn is string => Boolean(isbn))
      .map((isbn) => normalizeIsbn(isbn))
      .filter((isbn) => isbn.length > 0)
    return Array.from(new Set(normalized))
  }, [existingEntries])

  const volumeLookup = useMemo(
    () => buildVolumeLookup(series, unassignedVolumes),
    [series, unassignedVolumes]
  )

  const handleSeriesNavigate = useCallback(
    (seriesItem: SeriesWithVolumes) => {
      setSelectedSeries(seriesItem)
      router.push(`/library/series/${seriesItem.id}`)
    },
    [setSelectedSeries, router]
  )

  const handleVolumeNavigate = useCallback(
    (volumeId: string) => {
      router.push(`/library/volume/${volumeId}`)
    },
    [router]
  )

  const {
    selectedSeriesIds,
    selectedVolumeIds,
    selectedCount,
    totalSelectableCount,
    isAllSelected,
    selectedUnassignedVolumeIds,
    selectedUnassignedCount,
    selectedVolumeIdsArray,
    clearSelection,
    handleClearSelection,
    toggleSeriesSelection,
    toggleVolumeSelection,
    handleSelectAll,
    handleSeriesItemClick,
    handleVolumeItemClick
  } = useLibrarySelection({
    collectionView,
    filteredSeries,
    filteredVolumes,
    filteredUnassignedVolumes,
    volumeLookup,
    onSeriesNavigate: handleSeriesNavigate,
    onVolumeNavigate: handleVolumeNavigate
  })

  const getNextVolumeNumber = useCallback(
    (seriesId: string | null) => computeNextVolumeNumber(seriesId, series),
    [series]
  )

  const {
    applySeriesType,
    applySeriesVolumesOwnership,
    applySeriesVolumesReadingStatus,
    applyVolumeOwnershipStatus,
    applyVolumeReadingStatus,
    performBulkDelete,
    handleBulkDelete,
    handleBulkEditApply
  } = useLibraryBulkOperations({
    selectedSeriesIds,
    selectedVolumeIds,
    series,
    volumeLookup,
    editSeries,
    editVolume,
    removeSeries,
    removeVolume,
    clearSelection,
    libraryHeadingRef,
    setBulkDeleteDialogOpen
  })

  const handleBulkScrapeSelected = useCallback(() => {
    const targets = buildScrapeTargets(
      collectionView,
      filteredSeries,
      selectedSeriesIds,
      series,
      selectedVolumeIds
    )
    if (targets.length === 0) return
    if (targets.length === 1) {
      setScrapeTarget(targets[0])
      return
    }
    const allVolumes = targets.flatMap((s) =>
      s.volumes.map((v) => ({ ...v, _seriesTitle: s.title }))
    )
    setScrapeTarget({
      ...targets[0],
      title: `${targets.length} series`,
      volumes: allVolumes
    })
  }, [
    collectionView,
    filteredSeries,
    selectedSeriesIds,
    series,
    selectedVolumeIds,
    setScrapeTarget
  ])

  const assignSelectedUnassignedVolumes = useCallback(
    async (targetSeriesId: string) => {
      if (selectedUnassignedVolumeIds.length === 0) return false

      const results = await batchedAllSettled(
        selectedUnassignedVolumeIds.map(
          (volumeId) => () =>
            editVolume(null, volumeId, { series_id: targetSeriesId })
        )
      )

      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount
      toastAssignResults(successCount, failureCount)

      if (successCount > 0) {
        clearSelection()
      }

      return successCount > 0
    },
    [selectedUnassignedVolumeIds, editVolume, clearSelection]
  )

  const handleAddSeries = async (
    data: Parameters<typeof createSeries>[0],
    options?: { volumeIds?: string[] }
  ) => {
    try {
      const createdSeries = await createSeries(data)
      toast.success("Series added successfully")

      const volumeIds = Array.from(
        new Set(options?.volumeIds?.filter(Boolean) ?? [])
      )

      if (volumeIds.length > 0) {
        const results = await batchedAllSettled(
          volumeIds.map(
            (volumeId) => () =>
              editVolume(null, volumeId, { series_id: createdSeries.id })
          )
        )
        const successCount = results.filter(
          (result) => result.status === "fulfilled"
        ).length
        const failureCount = results.length - successCount
        toastVolumeAttachResults(successCount, failureCount)
      }

      if (pendingSeriesSelection) {
        setSelectedSeriesId(createdSeries.id)
        setPendingSeriesSelection(false)
      }
    } catch {
      toast.error("Failed to add series")
    }
  }

  const handleEditSeries = async (data: Parameters<typeof createSeries>[0]) => {
    if (!editingSeries) return
    try {
      await editSeries(editingSeries.id, data)
      toast.success("Series updated successfully")
      setEditingSeries(null)
    } catch {
      toast.error("Failed to update series")
    }
  }

  const handleDeleteSeries = async () => {
    if (!deletingSeries) return
    try {
      await removeSeries(deletingSeries.id)
      toast.success("Series deleted successfully")
      announce("Series deleted", "assertive")
      setDeletingSeries(null)
      setDeleteDialogOpen(false)
      libraryHeadingRef.current?.focus()
    } catch {
      toast.error("Failed to delete series")
    }
  }

  const handleAddVolume = async (data: Parameters<typeof createVolume>[1]) => {
    try {
      await createVolume(selectedSeriesId ?? null, data)
      toast.success("Book added successfully")
    } catch {
      toast.error("Failed to add book")
    }
  }

  const handleEditVolume = async (data: Parameters<typeof createVolume>[1]) => {
    if (!editingVolume) return
    const currentSeriesId = editingVolume.series_id ?? null
    const nextSeriesId = selectedSeriesId ?? null

    try {
      await editVolume(currentSeriesId, editingVolume.id, {
        ...data,
        series_id: nextSeriesId
      })
      toast.success("Book updated successfully")
      setEditingVolume(null)
    } catch {
      toast.error("Failed to update book")
    }
  }

  const handleDeleteVolume = async () => {
    if (!deletingVolume) return
    try {
      await removeVolume(deletingVolume.series_id ?? null, deletingVolume.id)
      toast.success("Book deleted successfully")
      announce("Book deleted", "assertive")
      setDeletingVolume(null)
      setDeleteVolumeDialogOpen(false)
      libraryHeadingRef.current?.focus()
    } catch {
      toast.error("Failed to delete book")
    }
  }

  const openEditDialog = useCallback(
    (series: SeriesWithVolumes) => {
      setEditingSeries(series)
      setSeriesDialogOpen(true)
    },
    [setEditingSeries, setSeriesDialogOpen]
  )

  const openDeleteDialog = useCallback(
    async (series: SeriesWithVolumes) => {
      if (!confirmBeforeDelete) {
        try {
          await removeSeries(series.id)
          toast.success("Series deleted successfully")
        } catch {
          toast.error("Failed to delete series")
        }
        return
      }
      setDeletingSeries(series)
      setDeleteDialogOpen(true)
    },
    [confirmBeforeDelete, removeSeries, setDeletingSeries, setDeleteDialogOpen]
  )

  const openEditVolumeDialog = useCallback(
    (volume: Volume) => {
      setEditingVolume(volume)
      setSelectedSeriesId(volume.series_id ?? null)
      setVolumeDialogOpen(true)
    },
    [setEditingVolume, setSelectedSeriesId, setVolumeDialogOpen]
  )

  const handleEditSelected = useCallback(() => {
    if (selectedCount !== 1) return
    if (collectionView === "series") {
      const selectedId = Array.from(selectedSeriesIds)[0]
      const selectedSeries = series.find((item) => item.id === selectedId)
      if (selectedSeries) openEditDialog(selectedSeries)
      return
    }
    const selectedId = Array.from(selectedVolumeIds)[0]
    const selectedVolume = volumeLookup.get(selectedId)
    if (selectedVolume) openEditVolumeDialog(selectedVolume)
  }, [
    selectedCount,
    collectionView,
    selectedSeriesIds,
    selectedVolumeIds,
    series,
    volumeLookup,
    openEditDialog,
    openEditVolumeDialog
  ])

  const handleBulkEdit = useCallback(() => {
    if (selectedCount < 2) return
    setBulkEditDialogOpen(true)
  }, [selectedCount, setBulkEditDialogOpen])

  const openDeleteVolumeDialog = useCallback(
    async (volume: Volume) => {
      if (!confirmBeforeDelete) {
        try {
          await removeVolume(volume.series_id ?? null, volume.id)
          toast.success("Book deleted successfully")
        } catch {
          toast.error("Failed to delete book")
        }
        return
      }
      setDeletingVolume(volume)
      setDeleteVolumeDialogOpen(true)
    },
    [
      confirmBeforeDelete,
      removeVolume,
      setDeletingVolume,
      setDeleteVolumeDialogOpen
    ]
  )

  const { handleToggleRead, handleToggleWishlist, handleSetRating } =
    useVolumeActions({ editVolume })

  const openSeriesScrapeDialog = useCallback(
    (seriesItem: SeriesWithVolumes) => {
      setScrapeTarget(seriesItem)
    },
    [setScrapeTarget]
  )

  const openVolumeScrapeDialog = useCallback(
    (volume: Volume, seriesItem?: SeriesWithVolumes) => {
      if (seriesItem) {
        setScrapeTarget({
          ...seriesItem,
          volumes: [volume]
        })
        return
      }

      const standaloneTitle =
        volume.title?.trim() || `Volume ${volume.volume_number}`
      const standaloneSeries: SeriesWithVolumes = {
        id: `unassigned-${volume.id}`,
        user_id: volume.user_id,
        title: standaloneTitle,
        original_title: null,
        description: null,
        notes: null,
        author: null,
        artist: null,
        publisher: null,
        cover_image_url: volume.cover_image_url,
        type: "other",
        total_volumes: 1,
        owned_volume_count: 0,
        status: null,
        tags: [],
        is_public: false,
        created_at: volume.created_at,
        updated_at: volume.updated_at,
        volumes: [volume]
      }
      setScrapeTarget(standaloneSeries)
    },
    [setScrapeTarget]
  )

  const openAddDialog = useCallback(() => {
    setEditingSeries(null)
    setSearchDialogOpen(true)
  }, [setEditingSeries, setSearchDialogOpen])

  const libraryActions = useMemo(
    () => ({
      onSeriesItemClick: handleSeriesItemClick,
      onEditSeries: openEditDialog,
      onDeleteSeries: openDeleteDialog,
      onSeriesScrape: openSeriesScrapeDialog,
      onToggleSeriesSelection: toggleSeriesSelection,
      onVolumeItemClick: handleVolumeItemClick,
      onEditVolume: openEditVolumeDialog,
      onDeleteVolume: openDeleteVolumeDialog,
      onVolumeScrape: openVolumeScrapeDialog,
      onToggleVolumeSelection: toggleVolumeSelection,
      onToggleRead: handleToggleRead,
      onToggleWishlist: handleToggleWishlist,
      onSetRating: handleSetRating,
      onAddBook: openAddDialog
    }),
    [
      handleSeriesItemClick,
      openEditDialog,
      openDeleteDialog,
      openSeriesScrapeDialog,
      toggleSeriesSelection,
      handleVolumeItemClick,
      openEditVolumeDialog,
      openDeleteVolumeDialog,
      openVolumeScrapeDialog,
      toggleVolumeSelection,
      handleToggleRead,
      handleToggleWishlist,
      handleSetRating,
      openAddDialog
    ]
  )

  const openAddSeriesDialog = useCallback(() => {
    setEditingSeries(null)
    setPendingSeriesSelection(false)
    setSeriesDialogOpen(true)
  }, [setEditingSeries, setPendingSeriesSelection, setSeriesDialogOpen])

  useEffect(() => {
    const addParam = searchParams.get("add")
    if (!addParam) {
      consumedAddParamRef.current = null
      return
    }

    if (consumedAddParamRef.current === addParam) return
    consumedAddParamRef.current = addParam

    if (addParam === "book") {
      globalThis.queueMicrotask(() => openAddDialog())
    } else if (addParam === "series") {
      globalThis.queueMicrotask(() => openAddSeriesDialog())
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("add")
    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [openAddDialog, openAddSeriesDialog, pathname, router, searchParams])

  const openManualDialog = useCallback(() => {
    setSearchDialogOpen(false)
    setEditingVolume(null)
    setSelectedSeriesId(null)
    setPendingSeriesSelection(false)
    setVolumeDialogOpen(true)
  }, [
    setSearchDialogOpen,
    setEditingVolume,
    setSelectedSeriesId,
    setPendingSeriesSelection,
    setVolumeDialogOpen
  ])

  const openSeriesDialogFromVolume = useCallback(() => {
    setEditingSeries(null)
    setPendingSeriesSelection(true)
    setSeriesDialogOpen(true)
  }, [setEditingSeries, setPendingSeriesSelection, setSeriesDialogOpen])

  const handleSearchSelect = useCallback(
    async (
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      try {
        await addBookFromSearchResult(result, options)
        toast.success("Book added successfully")
      } catch {
        toast.error("Failed to add book")
      }
    },
    [addBookFromSearchResult]
  )

  const handleSearchSelectMany = useCallback(
    async (
      results: BookSearchResult[],
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      const { successCount, failureCount } = await addBooksFromSearchResults(
        results,
        options
      )
      toastBatchOp(
        successCount,
        failureCount,
        `${successCount} book${successCount === 1 ? "" : "s"} added`,
        `${failureCount} book${failureCount === 1 ? "" : "s"} failed to add`
      )
    },
    [addBooksFromSearchResults]
  )

  const handleVolumeDialogChange = useCallback(
    (open: boolean) => {
      setVolumeDialogOpen(open)
      if (!open) {
        setEditingVolume(null)
        setSelectedSeriesId(null)
        setPendingSeriesSelection(false)
      }
    },
    [
      setVolumeDialogOpen,
      setEditingVolume,
      setSelectedSeriesId,
      setPendingSeriesSelection
    ]
  )

  const handleSeriesDialogChange = useCallback(
    (open: boolean) => {
      setSeriesDialogOpen(open)
      if (!open) {
        setEditingSeries(null)
        setPendingSeriesSelection(false)
      }
    },
    [setSeriesDialogOpen, setEditingSeries, setPendingSeriesSelection]
  )

  const handleScrapeTargetChange = useCallback(
    (open: boolean) => {
      if (!open) setScrapeTarget(null)
    },
    [setScrapeTarget]
  )

  return (
    <div
      className={`relative px-6 py-8 lg:px-10 ${selectedCount > 0 ? "pb-20" : ""}`}
    >
      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator
        isPulling={isPulling}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
      />

      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,var(--warm-glow-strong),transparent_70%)]" />

      <div className="mb-6">
        <div className="animate-fade-in-up">
          <span className="text-muted-foreground mb-3 block text-xs tracking-widest uppercase">
            Collection
          </span>
          <h1
            ref={libraryHeadingRef}
            tabIndex={-1}
            className="font-display text-3xl font-bold tracking-tight outline-none md:text-4xl"
          >
            My{" "}
            <span className="text-gradient from-copper to-gold bg-linear-to-r">
              Library
            </span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg leading-relaxed">
            Manage your light novel and manga collection
          </p>
        </div>
      </div>

      {!isLoading && <LibraryStatsBar series={series} />}

      {seriesProgress && (
        <SyncIndicator
          active
          label={`Loading ${seriesProgress.loaded} of ${seriesProgress.total} series…`}
          className="mb-2"
        />
      )}

      <CollectionsPanel />

      <LibraryToolbar
        onAddBook={openAddDialog}
        onAddSeries={openAddSeriesDialog}
        onFindDuplicates={() => setDuplicateDialogOpen(true)}
      />

      <VolumeSelectionBar
        selectedCount={selectedCount}
        totalSelectableCount={totalSelectableCount}
        isAllSelected={isAllSelected}
        onSelectAll={handleSelectAll}
        onClear={handleClearSelection}
        onEdit={handleEditSelected}
        onDelete={handleBulkDelete}
        onCancel={clearSelection}
        onBulkScrape={handleBulkScrapeSelected}
        onApplySeriesType={
          collectionView === "series" ? applySeriesType : undefined
        }
        onApplyAllVolumesOwnership={
          collectionView === "series" ? applySeriesVolumesOwnership : undefined
        }
        onApplyAllVolumesReading={
          collectionView === "series"
            ? applySeriesVolumesReadingStatus
            : undefined
        }
        onApplyOwnership={
          collectionView === "volumes" ? applyVolumeOwnershipStatus : undefined
        }
        onApplyReading={
          collectionView === "volumes" ? applyVolumeReadingStatus : undefined
        }
        onAssignToSeries={
          collectionView === "volumes" && selectedUnassignedCount > 0
            ? () => setAssignToSeriesDialogOpen(true)
            : undefined
        }
        assignToSeriesCount={selectedUnassignedCount}
        onBulkEdit={handleBulkEdit}
        onAddToCollection={() => setAddToCollectionDialogOpen(true)}
      />

      <div className="my-8 border-t" />
      <ErrorBoundary>
        <LibraryActionsProvider value={libraryActions}>
          <LibraryContent
            filteredSeries={filteredSeries}
            filteredVolumes={filteredVolumes}
            filteredUnassignedVolumes={filteredUnassignedVolumes}
            isLoading={isLoading}
            viewMode={viewMode}
            collectionView={collectionView}
            cardSize={cardSize}
            gridColumnCount={gridColumnCount}
            gridGapPx={gridGapPx}
            amazonDomain={amazonDomain}
            amazonBindingLabel={amazonBindingLabel}
            selectedSeriesIds={selectedSeriesIds}
            selectedVolumeIds={selectedVolumeIds}
          />
        </LibraryActionsProvider>
      </ErrorBoundary>

      <LibraryDialogs
        searchDialogOpen={searchDialogOpen}
        onSearchDialogChange={setSearchDialogOpen}
        onSearchSelect={handleSearchSelect}
        onSearchSelectMany={handleSearchSelectMany}
        onAddManual={openManualDialog}
        existingIsbns={existingIsbns}
        volumeDialogOpen={volumeDialogOpen}
        onVolumeDialogChange={handleVolumeDialogChange}
        editingVolume={editingVolume}
        nextVolumeNumber={getNextVolumeNumber(selectedSeriesId)}
        onVolumeSubmit={editingVolume ? handleEditVolume : handleAddVolume}
        series={series}
        selectedSeriesId={selectedSeriesId}
        onSeriesChange={setSelectedSeriesId}
        onCreateSeries={openSeriesDialogFromVolume}
        seriesDialogOpen={seriesDialogOpen}
        onSeriesDialogChange={handleSeriesDialogChange}
        editingSeries={editingSeries}
        unassignedVolumes={unassignedVolumes}
        onSeriesSubmit={editingSeries ? handleEditSeries : handleAddSeries}
        assignToSeriesDialogOpen={assignToSeriesDialogOpen}
        onAssignToSeriesDialogChange={setAssignToSeriesDialogOpen}
        selectedUnassignedCount={selectedUnassignedCount}
        onAssign={assignSelectedUnassignedVolumes}
        deleteVolumeDialogOpen={deleteVolumeDialogOpen}
        onDeleteVolumeDialogChange={setDeleteVolumeDialogOpen}
        onDeleteVolumeConfirm={handleDeleteVolume}
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogChange={setDeleteDialogOpen}
        deletingSeries={deletingSeries}
        deleteSeriesVolumes={deleteSeriesVolumes}
        onDeleteSeriesConfirm={handleDeleteSeries}
        scrapeTarget={scrapeTarget}
        onScrapeTargetChange={handleScrapeTargetChange}
        editVolume={editVolume}
        bulkDeleteDialogOpen={bulkDeleteDialogOpen}
        onBulkDeleteDialogChange={setBulkDeleteDialogOpen}
        collectionView={collectionView}
        selectedCount={selectedCount}
        onBulkDeleteConfirm={performBulkDelete}
        bulkEditDialogOpen={bulkEditDialogOpen}
        onBulkEditDialogChange={setBulkEditDialogOpen}
        onBulkEditApply={handleBulkEditApply}
        addToCollectionDialogOpen={addToCollectionDialogOpen}
        onAddToCollectionDialogChange={setAddToCollectionDialogOpen}
        selectedVolumeIdsArray={selectedVolumeIdsArray}
        duplicateDialogOpen={duplicateDialogOpen}
        onDuplicateDialogChange={setDuplicateDialogOpen}
      />
    </div>
  )
}
