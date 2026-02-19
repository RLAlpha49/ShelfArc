"use client"

import { useParams, useRouter } from "next/navigation"
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { useRecentlyVisitedStore } from "@/lib/store/recently-visited-store"

const VolumeDialog = lazy(() =>
  import("@/components/library/volume-dialog").then((m) => ({
    default: m.VolumeDialog
  }))
)
const SeriesDialog = lazy(() =>
  import("@/components/library/series-dialog").then((m) => ({
    default: m.SeriesDialog
  }))
)
const BulkScrapeDialog = lazy(() =>
  import("@/components/library/bulk-scrape-dialog").then((m) => ({
    default: m.BulkScrapeDialog
  }))
)
const BookSearchDialog = lazy(() =>
  import("@/components/library/book-search-dialog").then((m) => ({
    default: m.BookSearchDialog
  }))
)
import { toast } from "sonner"

import { EmptyState } from "@/components/empty-state"
import { ErrorBoundary } from "@/components/error-boundary"
import { SeriesHeaderSection } from "@/components/library/series-header-section"
import { SeriesVolumesSection } from "@/components/library/series-volumes-section"
import { announce } from "@/components/live-announcer"
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
import { Skeleton } from "@/components/ui/skeleton"
import { normalizeIsbn } from "@/lib/books/isbn"
import { type BookSearchResult } from "@/lib/books/search"
import { batchedAllSettled } from "@/lib/concurrency/limiter"
import { useLibrary } from "@/lib/hooks/use-library"
import { useVolumeActions } from "@/lib/hooks/use-volume-actions"
import {
  buildSeriesInsights,
  getErrorMessage
} from "@/lib/library/series-insights"
import {
  buildCurrencyFormatter,
  findPrimaryVolume,
  toggleInSet
} from "@/lib/library/volume-helpers"
import { sanitizeHtml } from "@/lib/sanitize-html"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type {
  OwnershipStatus,
  SeriesInsert,
  SeriesWithVolumes,
  Volume,
  VolumeInsert
} from "@/lib/types/database"

/**
 * Series detail page showing cover, metadata, volume grid, and editing controls.
 * @source
 */
export default function SeriesDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawSeriesId = params?.id
  const seriesId = typeof rawSeriesId === "string" ? rawSeriesId : null

  const {
    series,
    fetchSeries,
    createSeries,
    createVolume,
    editSeries,
    editVolume,
    removeSeries,
    removeVolume,
    addVolumeFromSearchResult,
    addVolumesFromSearchResults,
    batchUpdateVolumes,
    isLoading
  } = useLibrary()
  const { selectedSeries, setSelectedSeries, deleteSeriesVolumes } =
    useLibraryStore()
  const dateFormat = useSettingsStore((state) => state.dateFormat)
  const confirmBeforeDelete = useSettingsStore((s) => s.confirmBeforeDelete)
  const priceDisplayCurrency = useLibraryStore(
    (state) => state.priceDisplayCurrency
  )

  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false)
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)
  const [createSeriesDialogOpen, setCreateSeriesDialogOpen] = useState(false)
  const [deleteVolumeDialogOpen, setDeleteVolumeDialogOpen] = useState(false)
  const [deleteSeriesDialogOpen, setDeleteSeriesDialogOpen] = useState(false)
  const [bulkScrapeDialogOpen, setBulkScrapeDialogOpen] = useState(false)
  const [bulkScrapeTarget, setBulkScrapeTarget] =
    useState<SeriesWithVolumes | null>(null)
  const [gapSearchQuery, setGapSearchQuery] = useState<string>("")
  const [isDeletingSeries, setIsDeletingSeries] = useState(false)
  const [isDeletingVolume, setIsDeletingVolume] = useState(false)
  const [deletingVolume, setDeletingVolume] = useState<Volume | null>(null)
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<Set<string>>(
    () => new Set()
  )
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [markAllAboveTarget, setMarkAllAboveTarget] = useState<Volume | null>(
    null
  )
  const [markAllAboveDialogOpen, setMarkAllAboveDialogOpen] = useState(false)
  const seriesHeadingRef = useRef<HTMLDivElement>(null)
  const isDeletingSeriesRef = useRef(false)

  const currentSeries =
    selectedSeries?.id === seriesId
      ? selectedSeries
      : series.find((s) => s.id === seriesId)

  const insights = useMemo(
    () =>
      currentSeries ? buildSeriesInsights(currentSeries, dateFormat) : null,
    [currentSeries, dateFormat]
  )

  const existingIsbns = useMemo(() => {
    if (!currentSeries) return []
    const normalized = currentSeries.volumes
      .map((volume) => volume.isbn)
      .filter((isbn): isbn is string => Boolean(isbn))
      .map((isbn) => normalizeIsbn(isbn))
      .filter((isbn) => isbn.length > 0)
    return Array.from(new Set(normalized))
  }, [currentSeries])

  const formatPrice = useMemo(
    () => buildCurrencyFormatter(priceDisplayCurrency),
    [priceDisplayCurrency]
  )

  useEffect(() => {
    if (series.length === 0) {
      fetchSeries()
    }
  }, [series.length, fetchSeries])

  useEffect(() => {
    if (currentSeries && currentSeries.id !== selectedSeries?.id) {
      setSelectedSeries(currentSeries)
    }
  }, [currentSeries, selectedSeries?.id, setSelectedSeries])

  const recordVisit = useRecentlyVisitedStore((s) => s.recordVisit)
  useEffect(() => {
    if (currentSeries) {
      recordVisit({
        id: currentSeries.id,
        title: currentSeries.title,
        type: "series"
      })
    }
    // Only record when the series id changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSeries?.id, recordVisit])

  useEffect(() => {
    if (!seriesId) {
      router.replace("/library")
    }
  }, [seriesId, router])

  const toggleVolumeSelection = useCallback((volumeId: string) => {
    setSelectedVolumeIds((prev) => toggleInSet(prev, volumeId))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedVolumeIds(new Set())
  }, [])

  const {
    handleToggleRead,
    handleToggleWishlist,
    handleSetRating,
    applyVolumeOwnershipStatus,
    applyVolumeReadingStatus,
    applyAllVolumesOwnership,
    applyAllVolumesReadingStatus
  } = useVolumeActions({ editVolume, currentSeries, selectedVolumeIds })

  useEffect(() => {
    clearSelection()
  }, [seriesId, clearSelection])

  const handleAddVolume = useCallback(
    async (data: Omit<VolumeInsert, "user_id" | "series_id">) => {
      if (!seriesId) {
        toast.error("Failed to add volume: Invalid series id")
        return
      }
      try {
        await createVolume(seriesId, data)
        toast.success("Volume added successfully")
      } catch (err) {
        toast.error(`Failed to add volume: ${getErrorMessage(err)}`)
      }
    },
    [seriesId, createVolume]
  )

  const handleEditVolume = useCallback(
    async (data: Omit<VolumeInsert, "user_id" | "series_id">) => {
      if (!editingVolume) return
      const currentSeriesId = editingVolume.series_id ?? null
      const nextSeriesId = selectedSeriesId ?? null
      try {
        await editVolume(currentSeriesId, editingVolume.id, {
          ...data,
          series_id: nextSeriesId
        })
        toast.success("Volume updated successfully")
        setEditingVolume(null)
      } catch (err) {
        toast.error(`Failed to update volume: ${getErrorMessage(err)}`)
      }
    },
    [editingVolume, selectedSeriesId, editVolume]
  )

  const handleEditSeries = useCallback(
    async (
      data: Omit<SeriesInsert, "user_id">,
      options?: { volumeIds?: string[] }
    ) => {
      if (!currentSeries) return
      void options
      try {
        await editSeries(currentSeries.id, data)
        toast.success("Series updated successfully")
      } catch (err) {
        toast.error(`Failed to update series: ${getErrorMessage(err)}`)
      }
    },
    [currentSeries, editSeries]
  )

  const handleCreateNewSeries = useCallback(
    async (data: Omit<SeriesInsert, "user_id">) => {
      try {
        const newSeries = await createSeries(data)
        toast.success("Series created successfully")
        if (editingVolume) {
          setSelectedSeriesId(newSeries.id)
          setCreateSeriesDialogOpen(false)
          setVolumeDialogOpen(true)
        }
      } catch (err) {
        toast.error(`Failed to create series: ${getErrorMessage(err)}`)
      }
    },
    [createSeries, editingVolume]
  )

  const handleDeleteVolume = useCallback(async () => {
    if (isDeletingVolume || !deletingVolume?.series_id) return
    setIsDeletingVolume(true)
    try {
      await removeVolume(deletingVolume.series_id, deletingVolume.id)
      toast.success("Volume deleted successfully")
      announce("Volume deleted", "assertive")
    } catch (err) {
      toast.error(`Failed to delete volume: ${getErrorMessage(err)}`)
    } finally {
      setIsDeletingVolume(false)
      setDeletingVolume(null)
      setDeleteVolumeDialogOpen(false)
    }
  }, [isDeletingVolume, deletingVolume, removeVolume])

  const handleDeleteSeries = useCallback(async () => {
    if (!currentSeries) return false
    try {
      await removeSeries(currentSeries.id)
      toast.success("Series deleted successfully")
      announce("Series deleted", "assertive")
      router.push("/library")
      return true
    } catch (err) {
      console.error(err)
      toast.error(`Failed to delete series: ${getErrorMessage(err)}`)
      return false
    }
  }, [currentSeries, removeSeries, router])

  const openEditDialog = useCallback((volume: Volume) => {
    setEditingVolume(volume)
    setSelectedSeriesId(volume.series_id ?? null)
    setVolumeDialogOpen(true)
  }, [])

  const openDeleteDialog = useCallback((volume: Volume) => {
    setDeletingVolume(volume)
    setDeleteVolumeDialogOpen(true)
  }, [])

  const openAddDialog = useCallback(() => {
    setEditingVolume(null)
    setSearchDialogOpen(true)
  }, [])

  const openManualDialog = useCallback(() => {
    setSearchDialogOpen(false)
    setEditingVolume(null)
    setVolumeDialogOpen(true)
  }, [])

  const handleSearchSelect = useCallback(
    async (
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      if (!seriesId) {
        const error = new Error("Invalid series id")
        console.error(error)
        toast.error(`Failed to add volume: ${error.message}`)
        return
      }
      try {
        await addVolumeFromSearchResult(seriesId, result, options)
        toast.success("Volume added successfully")
      } catch (err) {
        console.error(err)
        toast.error(`Failed to add volume: ${getErrorMessage(err)}`)
      }
    },
    [addVolumeFromSearchResult, seriesId]
  )

  const handleSearchSelectMany = useCallback(
    async (
      results: BookSearchResult[],
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      if (!seriesId) {
        const error = new Error("Invalid series id")
        console.error(error)
        toast.error(`Failed to add volume: ${error.message}`)
        return
      }
      const { successCount, failureCount } = await addVolumesFromSearchResults(
        seriesId,
        results,
        options
      )

      if (successCount > 0) {
        toast.success(
          `${successCount} volume${successCount === 1 ? "" : "s"} added`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume${failureCount === 1 ? "" : "s"} failed to add`
        )
      }
    },
    [addVolumesFromSearchResults, seriesId]
  )

  const openBulkScrapeForSeries = useCallback(() => {
    if (!currentSeries) return
    setBulkScrapeTarget(currentSeries)
    setBulkScrapeDialogOpen(true)
  }, [currentSeries])

  const openBulkScrapeForVolume = useCallback(
    (volume: Volume) => {
      if (!currentSeries) return
      setBulkScrapeTarget({
        ...currentSeries,
        volumes: [volume]
      })
      setBulkScrapeDialogOpen(true)
    },
    [currentSeries]
  )
  const handleGapCardClick = useCallback(
    (volumeNumber: number) => {
      if (!currentSeries) return
      const query = `${currentSeries.title} Volume ${volumeNumber}`
      setGapSearchQuery(query)
      setSearchDialogOpen(true)
    },
    [currentSeries]
  )

  const handleVolumeClick = useCallback(
    (volumeId: string) => {
      router.push(`/library/volume/${volumeId}`)
    },
    [router]
  )

  const selectedCount = selectedVolumeIds.size
  const totalSelectableCount = currentSeries?.volumes.length ?? 0
  const isAllSelected =
    totalSelectableCount > 0 && selectedCount === totalSelectableCount

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

  const handleSelectAll = useCallback(() => {
    if (!currentSeries) return
    setSelectedVolumeIds(
      new Set(currentSeries.volumes.map((volume) => volume.id))
    )
  }, [currentSeries])

  const handleClearSelection = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  const deleteSelectedVolumes = useCallback(async () => {
    if (!currentSeries) return
    const targets = Array.from(selectedVolumeIds)
      .map((id) => currentSeries.volumes.find((volume) => volume.id === id))
      .filter((volume): volume is Volume => Boolean(volume))
    if (targets.length === 0) return

    const results = await batchedAllSettled(
      targets.map((volume) => () => removeVolume(currentSeries.id, volume.id))
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
  }, [currentSeries, selectedVolumeIds, removeVolume])

  const performBulkDelete = useCallback(async () => {
    const count = selectedVolumeIds.size
    await deleteSelectedVolumes()
    clearSelection()
    setBulkDeleteDialogOpen(false)
    announce(`${count} volume${count === 1 ? "" : "s"} deleted`, "assertive")
    seriesHeadingRef.current?.focus()
  }, [deleteSelectedVolumes, clearSelection, selectedVolumeIds.size])

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return
    if (!confirmBeforeDelete) {
      void performBulkDelete()
      return
    }
    setBulkDeleteDialogOpen(true)
  }, [selectedCount, confirmBeforeDelete, performBulkDelete])

  const doMarkAllAboveAsRead = useCallback(
    async (targetVolume: Volume) => {
      if (!currentSeries) return
      const sorted = currentSeries.volumes.toSorted(
        (a, b) => a.volume_number - b.volume_number
      )
      const targets = sorted.filter(
        (v) =>
          v.volume_number <= targetVolume.volume_number &&
          v.reading_status !== "completed"
      )
      try {
        await batchUpdateVolumes(
          targets.map((v) => v.id),
          { reading_status: "completed" }
        )
        toast.success(
          `Marked ${targets.length} volume${targets.length === 1 ? "" : "s"} as read`
        )
      } catch {
        toast.error("Failed to mark volumes as read")
      } finally {
        setMarkAllAboveDialogOpen(false)
        setMarkAllAboveTarget(null)
      }
    },
    [currentSeries, batchUpdateVolumes]
  )

  const handleMarkAllAboveAsRead = useCallback(
    (volume: Volume) => {
      if (!currentSeries) return
      const sorted = currentSeries.volumes.toSorted(
        (a, b) => a.volume_number - b.volume_number
      )
      const targets = sorted.filter(
        (v) =>
          v.volume_number <= volume.volume_number &&
          v.reading_status !== "completed"
      )
      if (targets.length === 0) {
        toast.info("All volumes up to this one are already marked as read")
        return
      }
      setMarkAllAboveTarget(volume)
      if (targets.length > 5) {
        setMarkAllAboveDialogOpen(true)
      } else {
        void doMarkAllAboveAsRead(volume)
      }
    },
    [currentSeries, doMarkAllAboveAsRead]
  )

  const handleEditSelected = useCallback(() => {
    if (!currentSeries) return
    if (selectedVolumeIds.size !== 1) return
    const onlyId = Array.from(selectedVolumeIds)[0]
    const volume = currentSeries.volumes.find((v) => v.id === onlyId)
    if (!volume) return
    openEditDialog(volume)
  }, [currentSeries, selectedVolumeIds, openEditDialog])

  const handleDeleteSeriesConfirm = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      if (isDeletingSeriesRef.current) return
      isDeletingSeriesRef.current = true
      setIsDeletingSeries(true)
      try {
        const wasDeleted = await handleDeleteSeries()
        if (wasDeleted) {
          setDeleteSeriesDialogOpen(false)
        }
      } finally {
        isDeletingSeriesRef.current = false
        setIsDeletingSeries(false)
      }
    },
    [handleDeleteSeries]
  )

  const descriptionHtml = useMemo(
    () => sanitizeHtml(currentSeries?.description ?? "").trim(),
    [currentSeries?.description]
  )

  const volumeDialogProps = useMemo(() => {
    if (!editingVolume) {
      return {
        onSubmit: handleAddVolume,
        seriesOptions: undefined,
        selectedSeriesId: undefined,
        onSeriesChange: undefined,
        onCreateSeries: undefined,
        allowNoSeries: false
      } as const
    }
    return {
      onSubmit: handleEditVolume,
      seriesOptions: series,
      selectedSeriesId,
      onSeriesChange: setSelectedSeriesId,
      onCreateSeries: () => {
        setVolumeDialogOpen(false)
        setCreateSeriesDialogOpen(true)
      },
      allowNoSeries: true
    } as const
  }, [
    editingVolume,
    handleAddVolume,
    handleEditVolume,
    series,
    selectedSeriesId
  ])

  if (isLoading && !currentSeries) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Skeleton className="aspect-2/3 w-full rounded-lg" />
          </div>
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!currentSeries || !insights) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <EmptyState
          title="Series not found"
          description="The series you're looking for doesn't exist or has been deleted."
          actions={[
            {
              label: "Back to Library",
              onClick: () => router.push("/library")
            }
          ]}
        />
      </div>
    )
  }

  const primaryVolume = findPrimaryVolume(currentSeries.volumes)
  const primaryIsbn = primaryVolume?.isbn ?? null

  return (
    <div
      className={`relative px-6 py-8 lg:px-10 ${selectedCount > 0 ? "pb-20" : ""}`}
    >
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_30%_20%,var(--warm-glow-strong),transparent_70%)]" />

      <Breadcrumbs
        items={[
          { label: "Library", href: "/library" },
          { label: currentSeries.title }
        ]}
      />

      <div ref={seriesHeadingRef} tabIndex={-1} className="outline-none">
        <ErrorBoundary>
          <SeriesHeaderSection
            currentSeries={currentSeries}
            insights={insights}
            primaryIsbn={primaryIsbn}
            descriptionHtml={descriptionHtml}
            formatPrice={formatPrice}
            onEditSeries={() => setSeriesDialogOpen(true)}
            onDeleteSeries={() => setDeleteSeriesDialogOpen(true)}
            onApplyAllOwnership={applyAllVolumesOwnership}
            onApplyAllReading={applyAllVolumesReadingStatus}
          />
        </ErrorBoundary>
      </div>

      <div className="my-10 border-t" />

      <ErrorBoundary>
        <SeriesVolumesSection
          currentSeries={currentSeries}
          selectedVolumeIds={selectedVolumeIds}
          selectedCount={selectedCount}
          totalSelectableCount={totalSelectableCount}
          isAllSelected={isAllSelected}
          onOpenBulkScrape={openBulkScrapeForSeries}
          onOpenAdd={openAddDialog}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onApplyOwnership={applyVolumeOwnershipStatus}
          onApplyReading={applyVolumeReadingStatus}
          onEditSelected={handleEditSelected}
          onBulkDelete={handleBulkDelete}
          onCancelSelection={clearSelection}
          onVolumeClick={handleVolumeItemClick}
          onScrapeVolume={openBulkScrapeForVolume}
          onEditVolume={openEditDialog}
          onDeleteVolume={openDeleteDialog}
          onToggleRead={handleToggleRead}
          onToggleWishlist={handleToggleWishlist}
          onSetRating={handleSetRating}
          onGapCardClick={handleGapCardClick}
          onSelectVolume={toggleVolumeSelection}
          onMarkAllAboveAsRead={handleMarkAllAboveAsRead}
        />
      </ErrorBoundary>

      {/* Book Search Dialog */}
      <Suspense fallback={null}>
        <BookSearchDialog
          open={searchDialogOpen}
          onOpenChange={(open) => {
            setSearchDialogOpen(open)
            if (!open) setGapSearchQuery("")
          }}
          onSelectResult={handleSearchSelect}
          onSelectResults={handleSearchSelectMany}
          onAddManual={openManualDialog}
          initialQuery={gapSearchQuery}
          context="volume"
          existingIsbns={existingIsbns}
        />
      </Suspense>

      {/* Add/Edit Volume Dialog */}
      <Suspense fallback={null}>
        <VolumeDialog
          open={volumeDialogOpen}
          onOpenChange={(open) => {
            setVolumeDialogOpen(open)
            if (!open) {
              setEditingVolume(null)
              setSelectedSeriesId(null)
            }
          }}
          volume={editingVolume}
          nextVolumeNumber={insights.nextVolumeNumber}
          onSubmit={volumeDialogProps.onSubmit}
          seriesOptions={volumeDialogProps.seriesOptions}
          selectedSeriesId={volumeDialogProps.selectedSeriesId}
          onSeriesChange={volumeDialogProps.onSeriesChange}
          onCreateSeries={volumeDialogProps.onCreateSeries}
          allowNoSeries={volumeDialogProps.allowNoSeries}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SeriesDialog
          open={seriesDialogOpen}
          onOpenChange={setSeriesDialogOpen}
          series={currentSeries}
          onSubmit={handleEditSeries}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SeriesDialog
          open={createSeriesDialogOpen}
          onOpenChange={setCreateSeriesDialogOpen}
          onSubmit={handleCreateNewSeries}
        />
      </Suspense>

      <Suspense fallback={null}>
        <BulkScrapeDialog
          open={bulkScrapeDialogOpen}
          onOpenChange={(open) => {
            setBulkScrapeDialogOpen(open)
            if (!open) {
              setBulkScrapeTarget(null)
            }
          }}
          series={bulkScrapeTarget ?? currentSeries}
          editVolume={editVolume}
        />
      </Suspense>

      <AlertDialog
        open={deleteSeriesDialogOpen}
        onOpenChange={setDeleteSeriesDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Series</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{currentSeries.title}&quot;?{" "}
              {deleteSeriesVolumes
                ? "This will also delete all volumes associated with this series."
                : "The volumes will be kept and moved to Unassigned Books."}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSeriesConfirm}
              disabled={isDeletingSeries}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteVolumeDialogOpen}
        onOpenChange={setDeleteVolumeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Volume</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Volume{" "}
              {deletingVolume?.volume_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVolume}
              disabled={isDeletingVolume}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={markAllAboveDialogOpen}
        onOpenChange={setMarkAllAboveDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Volumes as Read</AlertDialogTitle>
            <AlertDialogDescription>
              {markAllAboveTarget && currentSeries
                ? (() => {
                    const count = currentSeries.volumes.filter(
                      (v) =>
                        v.volume_number <= markAllAboveTarget.volume_number &&
                        v.reading_status !== "completed"
                    ).length
                    return `This will mark ${count} volume${count === 1 ? "" : "s"} (up to Volume ${markAllAboveTarget.volume_number}) as read. This action cannot be undone.`
                  })()
                : "This will mark multiple volumes as read."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (markAllAboveTarget) {
                  void doMarkAllAboveAsRead(markAllAboveTarget)
                }
              }}
            >
              Mark as Read
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Volumes</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete {selectedCount} volume
              {selectedCount === 1 ? "" : "s"}. This action cannot be undone.
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
    </div>
  )
}
