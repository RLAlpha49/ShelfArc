"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import { announce } from "@/components/live-announcer"
import { batchedAllSettled } from "@/lib/concurrency/limiter"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type {
  OwnershipStatus,
  ReadingStatus,
  SeriesWithVolumes,
  TitleType,
  Volume
} from "@/lib/types/database"

interface BulkOperationsDeps {
  readonly selectedSeriesIds: Set<string>
  readonly selectedVolumeIds: Set<string>
  readonly series: readonly SeriesWithVolumes[]
  readonly volumeLookup: Map<string, Volume>
  readonly editSeries: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<unknown>
  readonly editVolume: (
    seriesId: string | null,
    volumeId: string,
    data: Record<string, unknown>
  ) => Promise<unknown>
  readonly removeSeries: (id: string) => Promise<unknown>
  readonly removeVolume: (
    seriesId: string | null,
    volumeId: string
  ) => Promise<unknown>
  readonly clearSelection: () => void
  readonly libraryHeadingRef: React.RefObject<HTMLHeadingElement | null>
  readonly setBulkDeleteDialogOpen: (open: boolean) => void
}

function countResults(results: PromiseSettledResult<unknown>[]) {
  const successCount = results.filter((r) => r.status === "fulfilled").length
  return { successCount, failureCount: results.length - successCount }
}

export function useLibraryBulkOperations({
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
}: BulkOperationsDeps) {
  const collectionView = useLibraryStore((s) => s.collectionView)
  const confirmBeforeDelete = useSettingsStore((s) => s.confirmBeforeDelete)

  const applySeriesType = useCallback(
    async (nextType: TitleType) => {
      if (selectedSeriesIds.size === 0) return
      const targets = Array.from(selectedSeriesIds)
      const results = await batchedAllSettled(
        targets.map((id) => () => editSeries(id, { type: nextType }))
      )
      const { successCount, failureCount } = countResults(results)
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
      const results = await batchedAllSettled(
        targetVolumes.map(
          (volume) => () =>
            editVolume(volume.series_id ?? null, volume.id, {
              ownership_status: status
            })
        )
      )
      const { successCount, failureCount } = countResults(results)
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
      const results = await batchedAllSettled(
        targetVolumes.map(
          (volume) => () =>
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
      const { successCount, failureCount } = countResults(results)
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

  const applyVolumeOwnershipStatus = useCallback(
    async (status: OwnershipStatus) => {
      if (selectedVolumeIds.size === 0) return
      const targets = Array.from(selectedVolumeIds)
        .map((id) => volumeLookup.get(id))
        .filter((volume): volume is Volume => Boolean(volume))
      const results = await batchedAllSettled(
        targets.map(
          (volume) => () =>
            editVolume(volume.series_id ?? null, volume.id, {
              ownership_status: status
            })
        )
      )
      const { successCount, failureCount } = countResults(results)
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
      const results = await batchedAllSettled(
        targets.map(
          (volume) => () =>
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
      const { successCount, failureCount } = countResults(results)
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

  const deleteSelectedSeries = useCallback(async () => {
    const targets = Array.from(selectedSeriesIds)
    if (targets.length === 0) return
    const results = await batchedAllSettled(
      targets.map((id) => () => removeSeries(id))
    )
    const { successCount, failureCount } = countResults(results)
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
    const results = await batchedAllSettled(
      targets.map(
        (volume) => () => removeVolume(volume.series_id ?? null, volume.id)
      )
    )
    const { successCount, failureCount } = countResults(results)
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
    const count =
      collectionView === "series"
        ? selectedSeriesIds.size
        : selectedVolumeIds.size
    const suffix = count === 1 ? "" : "s"
    const label = collectionView === "series" ? "series" : `book${suffix}`

    if (collectionView === "series") {
      await deleteSelectedSeries()
    } else {
      await deleteSelectedVolumes()
    }

    clearSelection()
    setBulkDeleteDialogOpen(false)
    announce(`${count} ${label} deleted`, "assertive")
    libraryHeadingRef.current?.focus()
  }, [
    collectionView,
    deleteSelectedSeries,
    deleteSelectedVolumes,
    clearSelection,
    selectedSeriesIds.size,
    selectedVolumeIds.size,
    setBulkDeleteDialogOpen,
    libraryHeadingRef
  ])

  const handleBulkDelete = useCallback(() => {
    const selectedCount =
      collectionView === "series"
        ? selectedSeriesIds.size
        : selectedVolumeIds.size
    if (selectedCount === 0) return
    if (!confirmBeforeDelete) {
      void performBulkDelete()
      return
    }
    setBulkDeleteDialogOpen(true)
  }, [
    collectionView,
    selectedSeriesIds.size,
    selectedVolumeIds.size,
    confirmBeforeDelete,
    performBulkDelete,
    setBulkDeleteDialogOpen
  ])

  return {
    applySeriesType,
    applySeriesVolumesOwnership,
    applySeriesVolumesReadingStatus,
    applyVolumeOwnershipStatus,
    applyVolumeReadingStatus,
    deleteSelectedSeries,
    deleteSelectedVolumes,
    performBulkDelete,
    handleBulkDelete
  }
}
