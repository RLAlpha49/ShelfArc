"use client"

import { lazy, memo, Suspense } from "react"

import { BulkEditDialog } from "@/components/library/bulk-edit-dialog"
import { AddToCollectionDialog } from "@/components/library/collections-panel"
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
import type { BookSearchResult } from "@/lib/books/search"
import type {
  OwnershipStatus,
  SeriesInsert,
  SeriesWithVolumes,
  Volume,
  VolumeInsert
} from "@/lib/types/database"

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

export interface LibraryDialogsProps {
  // Search dialog
  readonly searchDialogOpen: boolean
  readonly onSearchDialogChange: (open: boolean) => void
  readonly onSearchSelect: (
    result: BookSearchResult,
    options?: { ownershipStatus?: OwnershipStatus }
  ) => void
  readonly onSearchSelectMany: (
    results: BookSearchResult[],
    options?: { ownershipStatus?: OwnershipStatus }
  ) => void
  readonly onAddManual: () => void
  readonly existingIsbns: string[]

  // Volume dialog
  readonly volumeDialogOpen: boolean
  readonly onVolumeDialogChange: (open: boolean) => void
  readonly editingVolume: Volume | null
  readonly nextVolumeNumber: number
  readonly onVolumeSubmit: (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => Promise<void>
  readonly series: SeriesWithVolumes[]
  readonly selectedSeriesId: string | null
  readonly onSeriesChange: (id: string | null) => void
  readonly onCreateSeries: () => void

  // Series dialog
  readonly seriesDialogOpen: boolean
  readonly onSeriesDialogChange: (open: boolean) => void
  readonly editingSeries: SeriesWithVolumes | null
  readonly unassignedVolumes: Volume[]
  readonly onSeriesSubmit: (
    data: Omit<SeriesInsert, "user_id">,
    options?: { volumeIds?: string[] }
  ) => Promise<void>

  // Assign to series dialog
  readonly assignToSeriesDialogOpen: boolean
  readonly onAssignToSeriesDialogChange: (open: boolean) => void
  readonly selectedUnassignedCount: number
  readonly onAssign: (targetSeriesId: string) => Promise<boolean>

  // Delete volume dialog
  readonly deleteVolumeDialogOpen: boolean
  readonly onDeleteVolumeDialogChange: (open: boolean) => void
  readonly onDeleteVolumeConfirm: () => void

  // Delete series dialog
  readonly deleteDialogOpen: boolean
  readonly onDeleteDialogChange: (open: boolean) => void
  readonly deletingSeries: SeriesWithVolumes | null
  readonly deleteSeriesVolumes: boolean
  readonly onDeleteSeriesConfirm: () => void

  // Bulk scrape
  readonly scrapeTarget: SeriesWithVolumes | null
  readonly onScrapeTargetChange: (open: boolean) => void
  readonly editVolume: (
    seriesId: string | null,
    volumeId: string,
    data: Partial<Volume>
  ) => Promise<void>

  // Bulk delete
  readonly bulkDeleteDialogOpen: boolean
  readonly onBulkDeleteDialogChange: (open: boolean) => void
  readonly collectionView: string
  readonly selectedCount: number
  readonly onBulkDeleteConfirm: () => void

  // Bulk edit
  readonly bulkEditDialogOpen: boolean
  readonly onBulkEditDialogChange: (open: boolean) => void
  readonly onBulkEditApply: (changes: Record<string, unknown>) => Promise<void>

  // Add to collection
  readonly addToCollectionDialogOpen: boolean
  readonly onAddToCollectionDialogChange: (open: boolean) => void
  readonly selectedVolumeIdsArray: string[]

  // Duplicate dialog
  readonly duplicateDialogOpen: boolean
  readonly onDuplicateDialogChange: (open: boolean) => void
}

export const LibraryDialogs = memo(function LibraryDialogs(
  props: LibraryDialogsProps
) {
  const {
    searchDialogOpen,
    onSearchDialogChange,
    onSearchSelect,
    onSearchSelectMany,
    onAddManual,
    existingIsbns,
    volumeDialogOpen,
    onVolumeDialogChange,
    editingVolume,
    nextVolumeNumber,
    onVolumeSubmit,
    series,
    selectedSeriesId,
    onSeriesChange,
    onCreateSeries,
    seriesDialogOpen,
    onSeriesDialogChange,
    editingSeries,
    unassignedVolumes,
    onSeriesSubmit,
    assignToSeriesDialogOpen,
    onAssignToSeriesDialogChange,
    selectedUnassignedCount,
    onAssign,
    deleteVolumeDialogOpen,
    onDeleteVolumeDialogChange,
    onDeleteVolumeConfirm,
    deleteDialogOpen,
    onDeleteDialogChange,
    deletingSeries,
    deleteSeriesVolumes,
    onDeleteSeriesConfirm,
    scrapeTarget,
    onScrapeTargetChange,
    editVolume,
    bulkDeleteDialogOpen,
    onBulkDeleteDialogChange,
    collectionView,
    selectedCount,
    onBulkDeleteConfirm,
    bulkEditDialogOpen,
    onBulkEditDialogChange,
    onBulkEditApply,
    addToCollectionDialogOpen,
    onAddToCollectionDialogChange,
    selectedVolumeIdsArray,
    duplicateDialogOpen,
    onDuplicateDialogChange
  } = props

  return (
    <>
      <Suspense fallback={null}>
        <DuplicateMergeDialog
          open={duplicateDialogOpen}
          onOpenChange={onDuplicateDialogChange}
        />
      </Suspense>

      <Suspense fallback={null}>
        <BookSearchDialog
          open={searchDialogOpen}
          onOpenChange={onSearchDialogChange}
          onSelectResult={onSearchSelect}
          onSelectResults={onSearchSelectMany}
          onAddManual={onAddManual}
          context="series"
          existingIsbns={existingIsbns}
        />
      </Suspense>

      <Suspense fallback={null}>
        <VolumeDialog
          open={volumeDialogOpen}
          onOpenChange={onVolumeDialogChange}
          volume={editingVolume}
          nextVolumeNumber={nextVolumeNumber}
          onSubmit={onVolumeSubmit}
          seriesOptions={series}
          selectedSeriesId={selectedSeriesId}
          onSeriesChange={onSeriesChange}
          onCreateSeries={onCreateSeries}
          allowNoSeries
        />
      </Suspense>

      <Suspense fallback={null}>
        <SeriesDialog
          open={seriesDialogOpen}
          onOpenChange={onSeriesDialogChange}
          series={editingSeries}
          unassignedVolumes={unassignedVolumes}
          onSubmit={onSeriesSubmit}
        />
      </Suspense>

      <Suspense fallback={null}>
        <AssignToSeriesDialog
          open={assignToSeriesDialogOpen}
          onOpenChange={onAssignToSeriesDialogChange}
          series={series}
          selectedVolumeCount={selectedUnassignedCount}
          onAssign={onAssign}
        />
      </Suspense>

      <AlertDialog
        open={deleteVolumeDialogOpen}
        onOpenChange={onDeleteVolumeDialogChange}
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
              onClick={onDeleteVolumeConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogChange}>
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
              onClick={onDeleteSeriesConfirm}
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
            onOpenChange={onScrapeTargetChange}
            series={scrapeTarget}
            editVolume={editVolume}
          />
        </Suspense>
      )}

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={onBulkDeleteDialogChange}
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
              onClick={onBulkDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkEditDialog
        open={bulkEditDialogOpen}
        onOpenChange={onBulkEditDialogChange}
        mode={collectionView === "series" ? "series" : "volumes"}
        selectedCount={selectedCount}
        onApply={onBulkEditApply}
      />

      <AddToCollectionDialog
        open={addToCollectionDialogOpen}
        onOpenChange={onAddToCollectionDialogChange}
        volumeIds={selectedVolumeIdsArray}
      />
    </>
  )
})
