"use client"

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  lazy,
  Suspense
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SeriesCard } from "@/components/library/series-card"

const SeriesDialog = lazy(() =>
  import("@/components/library/series-dialog").then((m) => ({
    default: m.SeriesDialog
  }))
)
const AssignToSeriesDialog = lazy(() =>
  import("@/components/library/assign-to-series-dialog").then((m) => ({
    default: m.AssignToSeriesDialog
  }))
)
const DuplicateMergeDialog = lazy(() =>
  import("@/components/library/duplicate-merge-dialog").then((m) => ({
    default: m.DuplicateMergeDialog
  }))
)
const BulkScrapeDialog = lazy(() =>
  import("@/components/library/bulk-scrape-dialog").then((m) => ({
    default: m.BulkScrapeDialog
  }))
)
const VolumeDialog = lazy(() =>
  import("@/components/library/volume-dialog").then((m) => ({
    default: m.VolumeDialog
  }))
)
const BookSearchDialog = lazy(() =>
  import("@/components/library/book-search-dialog").then((m) => ({
    default: m.BookSearchDialog
  }))
)
import { LibraryToolbar } from "@/components/library/library-toolbar"
import { LoadingSkeleton } from "@/components/library/library-skeleton"
import { SeriesListItem } from "@/components/library/series-list-item"
import { VolumeGridItem } from "@/components/library/volume-grid-item"
import { VolumeListItem } from "@/components/library/volume-list-item"
import { VolumeCard } from "@/components/library/volume-card"
import { VolumeSelectionBar } from "@/components/library/volume-selection-bar"
import { CollectionsPanel, AddToCollectionDialog } from "@/components/library/collections-panel"
import { BulkEditDialog } from "@/components/library/bulk-edit-dialog"
import {
  VirtualizedWindowGrid,
  VirtualizedWindowList
} from "@/components/library/virtualized-window"
import { EmptyState } from "@/components/empty-state"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryUrlSync } from "@/lib/hooks/use-library-url-sync"
import { useWindowWidth } from "@/lib/hooks/use-window-width"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import type {
  SeriesWithVolumes,
  Volume,
  OwnershipStatus,
  ReadingStatus,
  TitleType
} from "@/lib/types/database"
import { type BookSearchResult } from "@/lib/books/search"
import { normalizeIsbn } from "@/lib/books/isbn"

import { AMAZON_BINDING_LABELS } from "@/lib/books/amazon-query"
import {
  getGridClasses,
  VIRTUALIZE_THRESHOLD,
  getGridColumnCount,
  getGridGapPx,
  estimateGridRowSize
} from "@/lib/library/grid-utils"

/**
 * Main library page for browsing, filtering, and managing the user's series and volume collection.
 * @source
 */
export default function LibraryPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useLibraryUrlSync()
  const consumedAddParamRef = useRef<string | null>(null)
  const {
    series,
    unassignedVolumes,
    filteredSeries,
    filteredVolumes,
    filteredUnassignedVolumes,
    isLoading,
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
  const windowWidth = useWindowWidth()
  const gridColumnCount = useMemo(
    () => getGridColumnCount(cardSize, windowWidth),
    [cardSize, windowWidth]
  )
  const gridGapPx = useMemo(() => getGridGapPx(cardSize), [cardSize])
  const confirmBeforeDelete = useSettingsStore((s) => s.confirmBeforeDelete)
  const amazonBindingLabel = AMAZON_BINDING_LABELS[Number(amazonPreferKindle)]

  const collectionStats = useMemo(() => {
    const allVolumes = series.flatMap((s) => s.volumes)
    const totalVolumes = allVolumes.length
    const owned = allVolumes.filter((v) => v.ownership_status === "owned").length
    const wishlist = allVolumes.filter((v) => v.ownership_status === "wishlist").length
    const read = allVolumes.filter((v) => v.reading_status === "completed").length
    const inProgress = allVolumes.filter((v) => v.reading_status === "reading").length
    const completionRate = totalVolumes > 0 ? Math.round((read / totalVolumes) * 100) : 0
    return { totalVolumes, owned, wishlist, read, inProgress, completionRate }
  }, [series])

  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<SeriesWithVolumes | null>(
    null
  )
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false)
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [pendingSeriesSelection, setPendingSeriesSelection] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSeries, setDeletingSeries] =
    useState<SeriesWithVolumes | null>(null)
  const [deleteVolumeDialogOpen, setDeleteVolumeDialogOpen] = useState(false)
  const [deletingVolume, setDeletingVolume] = useState<Volume | null>(null)
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<string>>(
    () => new Set()
  )
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<Set<string>>(
    () => new Set()
  )
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [assignToSeriesDialogOpen, setAssignToSeriesDialogOpen] =
    useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [scrapeTarget, setScrapeTarget] = useState<SeriesWithVolumes | null>(
    null
  )
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false)
  const [addToCollectionDialogOpen, setAddToCollectionDialogOpen] =
    useState(false)

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  const clearSelection = useCallback(() => {
    setSelectedSeriesIds(new Set())
    setSelectedVolumeIds(new Set())
  }, [])

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

  const volumeLookup = useMemo(() => {
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
  }, [series, unassignedVolumes])

  const selectedIds =
    collectionView === "series" ? selectedSeriesIds : selectedVolumeIds
  const selectedCount = selectedIds.size
  const totalSelectableCount =
    collectionView === "series"
      ? filteredSeries.length
      : filteredVolumes.length + filteredUnassignedVolumes.length
  const isAllSelected =
    totalSelectableCount > 0 && selectedCount === totalSelectableCount

  const selectedUnassignedVolumeIds = useMemo(() => {
    if (collectionView !== "volumes") return []
    if (selectedVolumeIds.size === 0) return []

    return Array.from(selectedVolumeIds).filter((id) => {
      const volume = volumeLookup.get(id)
      return volume != null && !volume.series_id
    })
  }, [collectionView, selectedVolumeIds, volumeLookup])

  const selectedUnassignedCount = selectedUnassignedVolumeIds.length

  const getNextVolumeNumber = useCallback(
    (seriesId: string | null) => {
      if (!seriesId) return 1
      const targetSeries = series.find((item) => item.id === seriesId)
      if (!targetSeries) return 1
      const maxVolume = targetSeries.volumes.reduce(
        (max, volume) => Math.max(max, volume.volume_number),
        0
      )
      return maxVolume + 1
    },
    [series]
  )

  const toggleSeriesSelection = useCallback((seriesId: string) => {
    setSelectedSeriesIds((prev) => {
      const next = new Set(prev)
      if (next.has(seriesId)) {
        next.delete(seriesId)
      } else {
        next.add(seriesId)
      }
      return next
    })
  }, [])

  const toggleVolumeSelection = useCallback((volumeId: string) => {
    setSelectedVolumeIds((prev) => {
      const next = new Set(prev)
      if (next.has(volumeId)) {
        next.delete(volumeId)
      } else {
        next.add(volumeId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (collectionView === "series") {
      setSelectedSeriesIds(new Set(filteredSeries.map((item) => item.id)))
      return
    }

    const nextIds = new Set(filteredVolumes.map((item) => item.volume.id))
    for (const volume of filteredUnassignedVolumes) {
      nextIds.add(volume.id)
    }
    setSelectedVolumeIds(nextIds)
  }, [
    collectionView,
    filteredSeries,
    filteredVolumes,
    filteredUnassignedVolumes
  ])

  const handleClearSelection = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  const applySeriesType = useCallback(
    async (nextType: TitleType) => {
      if (selectedSeriesIds.size === 0) return
      const targets = Array.from(selectedSeriesIds)
      const results = await Promise.allSettled(
        targets.map((id) => editSeries(id, { type: nextType }))
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} series type${successCount === 1 ? "" : "s"}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} series type update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedSeriesIds, editSeries]
  )

  const applySeriesVolumesOwnership = useCallback(
    async (status: OwnershipStatus) => {
      if (selectedSeriesIds.size === 0) return
      const targetVolumes: Volume[] = []
      for (const sid of selectedSeriesIds) {
        const targetSeries = series.find((s) => s.id === sid)
        if (targetSeries) {
          targetVolumes.push(...targetSeries.volumes)
        }
      }
      if (targetVolumes.length === 0) return
      const results = await Promise.allSettled(
        targetVolumes.map((volume) =>
          editVolume(volume.series_id ?? null, volume.id, {
            ownership_status: status
          })
        )
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} volume${successCount === 1 ? "" : "s"} to ${status}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedSeriesIds, series, editVolume]
  )

  const applySeriesVolumesReadingStatus = useCallback(
    async (status: ReadingStatus) => {
      if (selectedSeriesIds.size === 0) return
      const targetVolumes: Volume[] = []
      for (const sid of selectedSeriesIds) {
        const targetSeries = series.find((s) => s.id === sid)
        if (targetSeries) {
          targetVolumes.push(...targetSeries.volumes)
        }
      }
      if (targetVolumes.length === 0) return
      const results = await Promise.allSettled(
        targetVolumes.map((volume) =>
          editVolume(volume.series_id ?? null, volume.id, {
            reading_status: status,
            ...(status === "completed" &&
            volume.page_count &&
            volume.page_count > 0
              ? { current_page: volume.page_count }
              : {})
          })
        )
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} volume${successCount === 1 ? "" : "s"} to ${status.replace("_", " ")}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedSeriesIds, series, editVolume]
  )

  const handleBulkScrapeSelected = useCallback(() => {
    let targets: SeriesWithVolumes[]
    if (collectionView === "series") {
      targets = filteredSeries.filter((s) => selectedSeriesIds.has(s.id))
    } else {
      const seriesMap = new Map<string, SeriesWithVolumes>()
      for (const s of series) {
        const selectedVols = s.volumes.filter((v) =>
          selectedVolumeIds.has(v.id)
        )
        if (selectedVols.length > 0) {
          seriesMap.set(s.id, { ...s, volumes: selectedVols })
        }
      }
      targets = Array.from(seriesMap.values())
    }
    if (targets.length === 0) return

    if (targets.length === 1) {
      setScrapeTarget(targets[0])
      return
    }

    // Combine all volumes into a single synthetic series, tagging each
    // volume with its real series title so the scrape hook uses the
    // correct Amazon search query per volume.
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
    selectedVolumeIds
  ])

  const applyVolumeOwnershipStatus = useCallback(
    async (status: OwnershipStatus) => {
      if (selectedVolumeIds.size === 0) return
      const targets = Array.from(selectedVolumeIds)
        .map((id) => volumeLookup.get(id))
        .filter((volume): volume is Volume => Boolean(volume))
      const results = await Promise.allSettled(
        targets.map((volume) =>
          editVolume(volume.series_id ?? null, volume.id, {
            ownership_status: status
          })
        )
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} volume${successCount === 1 ? "" : "s"} to ${status}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedVolumeIds, volumeLookup, editVolume]
  )

  const applyVolumeReadingStatus = useCallback(
    async (status: ReadingStatus) => {
      if (selectedVolumeIds.size === 0) return
      const targets = Array.from(selectedVolumeIds)
        .map((id) => volumeLookup.get(id))
        .filter((volume): volume is Volume => Boolean(volume))
      const results = await Promise.allSettled(
        targets.map((volume) =>
          editVolume(volume.series_id ?? null, volume.id, {
            reading_status: status,
            ...(status === "completed" &&
            volume.page_count &&
            volume.page_count > 0
              ? { current_page: volume.page_count }
              : {})
          })
        )
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} volume${successCount === 1 ? "" : "s"} to ${status.replace("_", " ")}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedVolumeIds, volumeLookup, editVolume]
  )

  const assignSelectedUnassignedVolumes = useCallback(
    async (targetSeriesId: string) => {
      if (selectedUnassignedVolumeIds.length === 0) return false

      const results = await Promise.allSettled(
        selectedUnassignedVolumeIds.map((volumeId) =>
          editVolume(null, volumeId, { series_id: targetSeriesId })
        )
      )

      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

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

      if (successCount > 0) {
        clearSelection()
      }

      return successCount > 0
    },
    [selectedUnassignedVolumeIds, editVolume, clearSelection]
  )

  const deleteSelectedSeries = useCallback(async () => {
    const targets = Array.from(selectedSeriesIds)
    if (targets.length === 0) return
    const results = await Promise.allSettled(
      targets.map((id) => removeSeries(id))
    )
    const successCount = results.filter(
      (result) => result.status === "fulfilled"
    ).length
    const failureCount = results.length - successCount

    if (successCount > 0) {
      toast.success(
        `Deleted ${successCount} series${successCount === 1 ? "" : "es"}`
      )
    }
    if (failureCount > 0) {
      toast.error(
        `${failureCount} series delete${failureCount === 1 ? "" : "s"} failed`
      )
    }
  }, [selectedSeriesIds, removeSeries])

  const deleteSelectedVolumes = useCallback(async () => {
    const targets = Array.from(selectedVolumeIds)
      .map((id) => volumeLookup.get(id))
      .filter((volume): volume is Volume => Boolean(volume))
    if (targets.length === 0) return
    const results = await Promise.allSettled(
      targets.map((volume) => removeVolume(volume.series_id ?? null, volume.id))
    )
    const successCount = results.filter(
      (result) => result.status === "fulfilled"
    ).length
    const failureCount = results.length - successCount

    if (successCount > 0) {
      toast.success(
        `Deleted ${successCount} volume${successCount === 1 ? "" : "s"}`
      )
    }
    if (failureCount > 0) {
      toast.error(
        `${failureCount} volume delete${failureCount === 1 ? "" : "s"} failed`
      )
    }
  }, [selectedVolumeIds, volumeLookup, removeVolume])

  const performBulkDelete = useCallback(async () => {
    if (collectionView === "series") {
      await deleteSelectedSeries()
    } else {
      await deleteSelectedVolumes()
    }

    clearSelection()
    setBulkDeleteDialogOpen(false)
  }, [
    collectionView,
    deleteSelectedSeries,
    deleteSelectedVolumes,
    clearSelection
  ])

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return
    if (!confirmBeforeDelete) {
      void performBulkDelete()
      return
    }
    setBulkDeleteDialogOpen(true)
  }, [selectedCount, confirmBeforeDelete, performBulkDelete])

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
        const results = await Promise.allSettled(
          volumeIds.map((volumeId) =>
            editVolume(null, volumeId, { series_id: createdSeries.id })
          )
        )
        const successCount = results.filter(
          (result) => result.status === "fulfilled"
        ).length
        const failureCount = results.length - successCount

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

      if (pendingSeriesSelection) {
        setSelectedSeriesId(createdSeries.id)
        setPendingSeriesSelection(false)
      }
    } catch {
      toast.error("Failed to add series")
    }
  }

  const handleEditSeries = async (
    data: Parameters<typeof createSeries>[0],
    options?: { volumeIds?: string[] }
  ) => {
    if (!editingSeries) return
    void options
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
      setDeletingSeries(null)
      setDeleteDialogOpen(false)
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
      setDeletingVolume(null)
      setDeleteVolumeDialogOpen(false)
    } catch {
      toast.error("Failed to delete book")
    }
  }

  const openEditDialog = useCallback((series: SeriesWithVolumes) => {
    setEditingSeries(series)
    setSeriesDialogOpen(true)
  }, [])

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
    [confirmBeforeDelete, removeSeries]
  )

  const openEditVolumeDialog = useCallback((volume: Volume) => {
    setEditingVolume(volume)
    setSelectedSeriesId(volume.series_id ?? null)
    setVolumeDialogOpen(true)
  }, [])

  const handleEditSelected = useCallback(() => {
    if (selectedCount !== 1) return

    if (collectionView === "series") {
      const selectedId = Array.from(selectedSeriesIds)[0]
      const selectedSeries = series.find((item) => item.id === selectedId)
      if (selectedSeries) {
        openEditDialog(selectedSeries)
      }
      return
    }

    const selectedId = Array.from(selectedVolumeIds)[0]
    const selectedVolume = volumeLookup.get(selectedId)
    if (selectedVolume) {
      openEditVolumeDialog(selectedVolume)
    }
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
  }, [selectedCount])

  const handleBulkEditApply = useCallback(
    async (changes: Record<string, unknown>) => {
      if (collectionView === "series") {
        const targets = Array.from(selectedSeriesIds)
        const results = await Promise.allSettled(
          targets.map((id) => editSeries(id, changes))
        )
        const successCount = results.filter((r) => r.status === "fulfilled").length
        const failureCount = results.length - successCount
        if (successCount > 0) toast.success(`Updated ${successCount} series`)
        if (failureCount > 0) toast.error(`${failureCount} updates failed`)
      } else {
        const targets = Array.from(selectedVolumeIds)
          .map((id) => volumeLookup.get(id))
          .filter((v): v is Volume => Boolean(v))
        const results = await Promise.allSettled(
          targets.map((v) => editVolume(v.series_id ?? null, v.id, changes))
        )
        const successCount = results.filter((r) => r.status === "fulfilled").length
        const failureCount = results.length - successCount
        if (successCount > 0) toast.success(`Updated ${successCount} volume${successCount === 1 ? "" : "s"}`)
        if (failureCount > 0) toast.error(`${failureCount} updates failed`)
      }
      clearSelection()
    },
    [collectionView, selectedSeriesIds, selectedVolumeIds, volumeLookup, editSeries, editVolume, clearSelection]
  )

  const selectedVolumeIdsArray = useMemo(
    () => Array.from(selectedVolumeIds),
    [selectedVolumeIds]
  )

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
    [confirmBeforeDelete, removeVolume]
  )

  const handleSeriesClick = useCallback(
    (series: SeriesWithVolumes) => {
      setSelectedSeries(series)
      router.push(`/library/series/${series.id}`)
    },
    [setSelectedSeries, router]
  )

  const handleVolumeClick = useCallback(
    (volumeId: string) => {
      router.push(`/library/volume/${volumeId}`)
    },
    [router]
  )

  const handleSeriesItemClick = useCallback(
    (seriesItem: SeriesWithVolumes) => {
      if (selectedSeriesIds.size > 0) {
        toggleSeriesSelection(seriesItem.id)
        return
      }
      handleSeriesClick(seriesItem)
    },
    [selectedSeriesIds.size, toggleSeriesSelection, handleSeriesClick]
  )

  const handleVolumeItemClick = useCallback(
    (volumeId: string) => {
      if (selectedVolumeIds.size > 0) {
        toggleVolumeSelection(volumeId)
        return
      }
      handleVolumeClick(volumeId)
    },
    [selectedVolumeIds.size, toggleVolumeSelection, handleVolumeClick]
  )

  const handleToggleRead = useCallback(
    async (volume: Volume) => {
      const nextStatus =
        volume.reading_status === "completed" ? "unread" : "completed"
      try {
        await editVolume(volume.series_id ?? null, volume.id, {
          reading_status: nextStatus,
          ...(nextStatus === "completed" &&
          volume.page_count &&
          volume.page_count > 0
            ? { current_page: volume.page_count }
            : {})
        })
        toast.success(
          nextStatus === "completed" ? "Marked as read" : "Marked as unread"
        )
      } catch {
        toast.error("Failed to update reading status")
      }
    },
    [editVolume]
  )

  const handleToggleWishlist = useCallback(
    async (volume: Volume) => {
      const nextStatus =
        volume.ownership_status === "wishlist" ? "owned" : "wishlist"
      try {
        await editVolume(volume.series_id ?? null, volume.id, {
          ownership_status: nextStatus
        })
        toast.success(
          nextStatus === "wishlist" ? "Moved to wishlist" : "Marked as owned"
        )
      } catch {
        toast.error("Failed to update ownership status")
      }
    },
    [editVolume]
  )

  const handleSetRating = useCallback(
    async (volume: Volume, rating: number | null) => {
      if (
        rating != null &&
        (!Number.isFinite(rating) || rating < 0 || rating > 10)
      ) {
        toast.error("Rating must be between 0 and 10")
        return
      }

      try {
        await editVolume(volume.series_id ?? null, volume.id, {
          rating
        })
        toast.success(rating == null ? "Rating cleared" : `Rated ${rating}/10`)
      } catch {
        toast.error("Failed to update rating")
      }
    },
    [editVolume]
  )

  const openSeriesScrapeDialog = useCallback(
    (seriesItem: SeriesWithVolumes) => {
      setScrapeTarget(seriesItem)
    },
    []
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
        status: null,
        tags: [],
        created_at: volume.created_at,
        updated_at: volume.updated_at,
        volumes: [volume]
      }
      setScrapeTarget(standaloneSeries)
    },
    []
  )

  const openAddDialog = useCallback(() => {
    setEditingSeries(null)
    setSearchDialogOpen(true)
  }, [])

  const openAddSeriesDialog = useCallback(() => {
    setEditingSeries(null)
    setPendingSeriesSelection(false)
    setSeriesDialogOpen(true)
  }, [])

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
  }, [])

  const openSeriesDialogFromVolume = useCallback(() => {
    setEditingSeries(null)
    setPendingSeriesSelection(true)
    setSeriesDialogOpen(true)
  }, [])

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

      if (successCount > 0) {
        toast.success(
          `${successCount} book${successCount === 1 ? "" : "s"} added`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} book${failureCount === 1 ? "" : "s"} failed to add`
        )
      }
    },
    [addBooksFromSearchResults]
  )

  const renderUnassignedSection = () => {
    if (filteredUnassignedVolumes.length === 0) return null

    return (
      <div className="animate-fade-in-up stagger-3 mt-10 space-y-4 border-t pt-10">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
              Uncategorized
            </span>
            <h2 className="font-display text-lg font-semibold">
              Unassigned Books
            </h2>
          </div>
        </div>
        {filteredUnassignedVolumes.length > VIRTUALIZE_THRESHOLD ? (
          <VirtualizedWindowGrid
            items={filteredUnassignedVolumes}
            columnCount={gridColumnCount}
            gapPx={gridGapPx}
            estimateRowSize={() => estimateGridRowSize(cardSize)}
            getItemKey={(volume) => volume.id}
            renderItem={(volume) => (
              <VolumeCard
                volume={volume}
                onClick={() => handleVolumeItemClick(volume.id)}
                onEdit={() => openEditVolumeDialog(volume)}
                onDelete={() => openDeleteVolumeDialog(volume)}
                onScrapePrice={() => openVolumeScrapeDialog(volume)}
                onToggleRead={() => handleToggleRead(volume)}
                onToggleWishlist={() => handleToggleWishlist(volume)}
                onSetRating={(rating) => handleSetRating(volume, rating)}
                selected={selectedVolumeIds.has(volume.id)}
                onSelect={() => toggleVolumeSelection(volume.id)}
              />
            )}
          />
        ) : (
          <div className={`grid-stagger ${getGridClasses(cardSize)}`}>
            {filteredUnassignedVolumes.map((volume) => (
              <VolumeCard
                key={volume.id}
                volume={volume}
                onClick={() => handleVolumeItemClick(volume.id)}
                onEdit={() => openEditVolumeDialog(volume)}
                onDelete={() => openDeleteVolumeDialog(volume)}
                onScrapePrice={() => openVolumeScrapeDialog(volume)}
                onToggleRead={() => handleToggleRead(volume)}
                onToggleWishlist={() => handleToggleWishlist(volume)}
                onSetRating={(rating) => handleSetRating(volume, rating)}
                selected={selectedVolumeIds.has(volume.id)}
                onSelect={() => toggleVolumeSelection(volume.id)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderVolumesView = () => {
    const hasAssignedVolumes = filteredVolumes.length > 0
    const hasUnassignedVolumes = filteredUnassignedVolumes.length > 0

    if (!hasAssignedVolumes && !hasUnassignedVolumes) {
      return (
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground h-8 w-8"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          }
          title="No volumes found"
          description="Search for a book to add your first volume"
          action={{
            label: "Add Book",
            onClick: openAddDialog
          }}
        />
      )
    }

    return (
      <div className="space-y-8">
        {hasAssignedVolumes &&
          (viewMode === "grid" ? (
            <div className="animate-fade-in-up">
              {filteredVolumes.length > VIRTUALIZE_THRESHOLD ? (
                <VirtualizedWindowGrid
                  items={filteredVolumes}
                  columnCount={gridColumnCount}
                  gapPx={gridGapPx}
                  estimateRowSize={() => estimateGridRowSize(cardSize)}
                  getItemKey={(item) => item.volume.id}
                  renderItem={(item) => (
                    <VolumeGridItem
                      item={item}
                      onClick={() => handleVolumeItemClick(item.volume.id)}
                      onEdit={() => openEditVolumeDialog(item.volume)}
                      onDelete={() => openDeleteVolumeDialog(item.volume)}
                      onScrapePrice={() =>
                        openVolumeScrapeDialog(item.volume, item.series)
                      }
                      onToggleRead={() => handleToggleRead(item.volume)}
                      onToggleWishlist={() => handleToggleWishlist(item.volume)}
                      onSetRating={(rating) =>
                        handleSetRating(item.volume, rating)
                      }
                      amazonDomain={amazonDomain}
                      bindingLabel={amazonBindingLabel}
                      selected={selectedVolumeIds.has(item.volume.id)}
                      onSelect={() => toggleVolumeSelection(item.volume.id)}
                    />
                  )}
                />
              ) : (
                <div className={`grid-stagger ${getGridClasses(cardSize)}`}>
                  {filteredVolumes.map((item) => (
                    <VolumeGridItem
                      key={item.volume.id}
                      item={item}
                      onClick={() => handleVolumeItemClick(item.volume.id)}
                      onEdit={() => openEditVolumeDialog(item.volume)}
                      onDelete={() => openDeleteVolumeDialog(item.volume)}
                      onScrapePrice={() =>
                        openVolumeScrapeDialog(item.volume, item.series)
                      }
                      onToggleRead={() => handleToggleRead(item.volume)}
                      onToggleWishlist={() => handleToggleWishlist(item.volume)}
                      onSetRating={(rating) =>
                        handleSetRating(item.volume, rating)
                      }
                      amazonDomain={amazonDomain}
                      bindingLabel={amazonBindingLabel}
                      selected={selectedVolumeIds.has(item.volume.id)}
                      onSelect={() => toggleVolumeSelection(item.volume.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in-up">
              {filteredVolumes.length > VIRTUALIZE_THRESHOLD ? (
                <VirtualizedWindowList
                  items={filteredVolumes}
                  estimateSize={() => 104}
                  getItemKey={(item) => item.volume.id}
                  renderItem={(item) => (
                    <div className="pb-2">
                      <VolumeListItem
                        item={item}
                        onClick={() => handleVolumeItemClick(item.volume.id)}
                        onEdit={() => openEditVolumeDialog(item.volume)}
                        onDelete={() => openDeleteVolumeDialog(item.volume)}
                        onScrapePrice={() =>
                          openVolumeScrapeDialog(item.volume, item.series)
                        }
                        onToggleRead={() => handleToggleRead(item.volume)}
                        onToggleWishlist={() =>
                          handleToggleWishlist(item.volume)
                        }
                        onSetRating={(rating) =>
                          handleSetRating(item.volume, rating)
                        }
                        amazonDomain={amazonDomain}
                        bindingLabel={amazonBindingLabel}
                        selected={selectedVolumeIds.has(item.volume.id)}
                        onSelect={() => toggleVolumeSelection(item.volume.id)}
                      />
                    </div>
                  )}
                />
              ) : (
                <div className="list-stagger space-y-2">
                  {filteredVolumes.map((item) => (
                    <VolumeListItem
                      key={item.volume.id}
                      item={item}
                      onClick={() => handleVolumeItemClick(item.volume.id)}
                      onEdit={() => openEditVolumeDialog(item.volume)}
                      onDelete={() => openDeleteVolumeDialog(item.volume)}
                      onScrapePrice={() =>
                        openVolumeScrapeDialog(item.volume, item.series)
                      }
                      onToggleRead={() => handleToggleRead(item.volume)}
                      onToggleWishlist={() => handleToggleWishlist(item.volume)}
                      onSetRating={(rating) =>
                        handleSetRating(item.volume, rating)
                      }
                      amazonDomain={amazonDomain}
                      bindingLabel={amazonBindingLabel}
                      selected={selectedVolumeIds.has(item.volume.id)}
                      onSelect={() => toggleVolumeSelection(item.volume.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        {renderUnassignedSection()}
      </div>
    )
  }

  const renderSeriesView = () => {
    if (filteredSeries.length === 0 && filteredUnassignedVolumes.length === 0) {
      return (
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground h-8 w-8"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          }
          title="No series found"
          description="Start building your collection by adding your first series"
          action={{
            label: "Add Book",
            onClick: openAddDialog
          }}
        />
      )
    }

    if (viewMode === "grid") {
      return (
        <div className="space-y-8">
          <div className="animate-fade-in-up">
            <div className="rounded-2xl">
              {filteredSeries.length > VIRTUALIZE_THRESHOLD ? (
                <VirtualizedWindowGrid
                  items={filteredSeries}
                  columnCount={gridColumnCount}
                  gapPx={gridGapPx}
                  estimateRowSize={() => estimateGridRowSize(cardSize)}
                  getItemKey={(series) => series.id}
                  renderItem={(series) => (
                    <SeriesCard
                      series={series}
                      onEdit={() => openEditDialog(series)}
                      onDelete={() => openDeleteDialog(series)}
                      onBulkScrape={() => openSeriesScrapeDialog(series)}
                      onClick={() => handleSeriesItemClick(series)}
                      selected={selectedSeriesIds.has(series.id)}
                      onSelect={() => toggleSeriesSelection(series.id)}
                    />
                  )}
                />
              ) : (
                <div className={`grid-stagger ${getGridClasses(cardSize)}`}>
                  {filteredSeries.map((series) => (
                    <SeriesCard
                      key={series.id}
                      series={series}
                      onEdit={() => openEditDialog(series)}
                      onDelete={() => openDeleteDialog(series)}
                      onBulkScrape={() => openSeriesScrapeDialog(series)}
                      onClick={() => handleSeriesItemClick(series)}
                      selected={selectedSeriesIds.has(series.id)}
                      onSelect={() => toggleSeriesSelection(series.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          {renderUnassignedSection()}
        </div>
      )
    }

    return (
      <div className="space-y-8">
        <div className="animate-fade-in-up">
          {filteredSeries.length > VIRTUALIZE_THRESHOLD ? (
            <VirtualizedWindowList
              items={filteredSeries}
              estimateSize={() => 104}
              getItemKey={(series) => series.id}
              renderItem={(series) => (
                <div className="pb-2">
                  <SeriesListItem
                    series={series}
                    onClick={() => handleSeriesItemClick(series)}
                    onEdit={() => openEditDialog(series)}
                    onDelete={() => openDeleteDialog(series)}
                    selected={selectedSeriesIds.has(series.id)}
                    onSelect={() => toggleSeriesSelection(series.id)}
                  />
                </div>
              )}
            />
          ) : (
            <div className="list-stagger space-y-2">
              {filteredSeries.map((series) => (
                <SeriesListItem
                  key={series.id}
                  series={series}
                  onClick={() => handleSeriesItemClick(series)}
                  onEdit={() => openEditDialog(series)}
                  onDelete={() => openDeleteDialog(series)}
                  selected={selectedSeriesIds.has(series.id)}
                  onSelect={() => toggleSeriesSelection(series.id)}
                />
              ))}
            </div>
          )}
        </div>
        {renderUnassignedSection()}
      </div>
    )
  }

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton viewMode={viewMode} />
    }

    return collectionView === "volumes"
      ? renderVolumesView()
      : renderSeriesView()
  }

  return (
    <div
      className={`relative px-6 py-8 lg:px-10 ${selectedCount > 0 ? "pb-20" : ""}`}
    >
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,var(--warm-glow-strong),transparent_70%)]" />

      <div className="mb-6">
        <div className="animate-fade-in-up">
          <span className="text-muted-foreground mb-3 block text-xs tracking-widest uppercase">
            Collection
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
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

      {/* Responsive collection stats bar */}
      {!isLoading && series.length > 0 && (
        <div className="animate-fade-in-up stagger-2 mb-8">
          <div className="glass-card grid grid-cols-3 gap-2 rounded-2xl p-3 sm:grid-cols-4 md:grid-cols-7 md:gap-4 md:p-4">
            <div className="text-center">
              <div className="font-display text-primary text-lg font-bold md:text-xl">
                {series.length}
              </div>
              <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
                Series
              </div>
            </div>
            <div className="text-center">
              <div className="font-display text-primary text-lg font-bold md:text-xl">
                {collectionStats.totalVolumes}
              </div>
              <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
                Volumes
              </div>
            </div>
            <div className="text-center">
              <div className="font-display text-primary text-lg font-bold md:text-xl">
                {collectionStats.owned}
              </div>
              <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
                Owned
              </div>
            </div>
            <div className="text-center">
              <div className="font-display text-primary text-lg font-bold md:text-xl">
                {collectionStats.read}
              </div>
              <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
                Read
              </div>
            </div>
            <div className="hidden text-center sm:block">
              <div className="font-display text-primary text-lg font-bold md:text-xl">
                {collectionStats.inProgress}
              </div>
              <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
                In Progress
              </div>
            </div>
            <div className="hidden text-center md:block">
              <div className="font-display text-primary text-lg font-bold md:text-xl">
                {collectionStats.wishlist}
              </div>
              <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
                Wishlist
              </div>
            </div>
            <div className="hidden text-center md:block">
              <div className="font-display text-lg font-bold text-copper md:text-xl">
                {collectionStats.completionRate}%
              </div>
              <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
                Complete
              </div>
            </div>
          </div>
        </div>
      )}

      <CollectionsPanel />

      <LibraryToolbar
        onAddBook={openAddDialog}
        onAddSeries={openAddSeriesDialog}
        onFindDuplicates={() => setDuplicateDialogOpen(true)}
      />

      <Suspense fallback={null}>
        <DuplicateMergeDialog
          open={duplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
        />
      </Suspense>

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
      <div>{renderContent()}</div>

      <Suspense fallback={null}>
        <BookSearchDialog
          open={searchDialogOpen}
          onOpenChange={setSearchDialogOpen}
          onSelectResult={handleSearchSelect}
          onSelectResults={handleSearchSelectMany}
          onAddManual={openManualDialog}
          context="series"
          existingIsbns={existingIsbns}
        />
      </Suspense>

      <Suspense fallback={null}>
        <VolumeDialog
          open={volumeDialogOpen}
          onOpenChange={(open) => {
            setVolumeDialogOpen(open)
            if (!open) {
              setEditingVolume(null)
              setSelectedSeriesId(null)
              setPendingSeriesSelection(false)
            }
          }}
          volume={editingVolume}
          nextVolumeNumber={getNextVolumeNumber(selectedSeriesId)}
          onSubmit={editingVolume ? handleEditVolume : handleAddVolume}
          seriesOptions={series}
          selectedSeriesId={selectedSeriesId}
          onSeriesChange={setSelectedSeriesId}
          onCreateSeries={openSeriesDialogFromVolume}
          allowNoSeries
        />
      </Suspense>

      <Suspense fallback={null}>
        <SeriesDialog
          open={seriesDialogOpen}
          onOpenChange={(open) => {
            setSeriesDialogOpen(open)
            if (!open) {
              setEditingSeries(null)
              setPendingSeriesSelection(false)
            }
          }}
          series={editingSeries}
          unassignedVolumes={unassignedVolumes}
          onSubmit={editingSeries ? handleEditSeries : handleAddSeries}
        />
      </Suspense>

      <Suspense fallback={null}>
        <AssignToSeriesDialog
          open={assignToSeriesDialogOpen}
          onOpenChange={setAssignToSeriesDialogOpen}
          series={series}
          selectedVolumeCount={selectedUnassignedCount}
          onAssign={assignSelectedUnassignedVolumes}
        />
      </Suspense>

      <AlertDialog
        open={deleteVolumeDialogOpen}
        onOpenChange={setDeleteVolumeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this book? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVolume}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Series</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingSeries?.title}
              &quot;?{" "}
              {deleteSeriesVolumes
                ? "This will also delete all volumes associated with this series."
                : "The volumes will be kept and moved to Unassigned Books."}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSeries}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {scrapeTarget && (
        <Suspense fallback={null}>
          <BulkScrapeDialog
            open
            onOpenChange={(open) => {
              if (!open) {
                setScrapeTarget(null)
              }
            }}
            series={scrapeTarget}
            editVolume={editVolume}
          />
        </Suspense>
      )}

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {collectionView === "series"
                ? "Delete Selected Series"
                : "Delete Selected Books"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {collectionView === "series" ? (
                <>
                  You are about to delete {selectedCount} series. {""}
                  {deleteSeriesVolumes
                    ? "This will also delete all volumes associated with these series."
                    : "The volumes will be kept and moved to Unassigned Books."}{" "}
                  This action cannot be undone.
                </>
              ) : (
                <>
                  You are about to delete {selectedCount} book
                  {selectedCount === 1 ? "" : "s"}. This action cannot be
                  undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={performBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkEditDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        mode={collectionView === "series" ? "series" : "volumes"}
        selectedCount={selectedCount}
        onApply={handleBulkEditApply}
      />

      <AddToCollectionDialog
        open={addToCollectionDialogOpen}
        onOpenChange={setAddToCollectionDialogOpen}
        volumeIds={selectedVolumeIdsArray}
      />
    </div>
  )
}
