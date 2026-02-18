"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import { batchedAllSettled } from "@/lib/concurrency/limiter"
import type {
  OwnershipStatus,
  ReadingStatus,
  SeriesWithVolumes,
  Volume
} from "@/lib/types/database"

type EditVolumeFn = (
  seriesId: string | null,
  volumeId: string,
  data: Partial<Volume>
) => Promise<void>

interface UseVolumeActionsOptions {
  editVolume: EditVolumeFn
  currentSeries?: SeriesWithVolumes | null
  selectedVolumeIds?: Set<string>
}

/**
 * Shared volume action handlers for toggle-read, toggle-wishlist, set-rating,
 * and bulk ownership/reading-status operations.
 *
 * Pass `currentSeries` and `selectedVolumeIds` to enable the bulk handlers
 * (`applyVolumeOwnershipStatus`, `applyVolumeReadingStatus`,
 * `applyAllVolumesOwnership`, `applyAllVolumesReadingStatus`).
 * @source
 */
export function useVolumeActions({
  editVolume,
  currentSeries,
  selectedVolumeIds
}: UseVolumeActionsOptions) {
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
        await editVolume(volume.series_id ?? null, volume.id, { rating })
        toast.success(rating == null ? "Rating cleared" : `Rated ${rating}/10`)
      } catch {
        toast.error("Failed to update rating")
      }
    },
    [editVolume]
  )

  const applyVolumeOwnershipStatus = useCallback(
    async (status: OwnershipStatus) => {
      if (!currentSeries) return
      if (!selectedVolumeIds || selectedVolumeIds.size === 0) return

      const targets = Array.from(selectedVolumeIds)
        .map((id) => currentSeries.volumes.find((volume) => volume.id === id))
        .filter((volume): volume is Volume => Boolean(volume))

      const results = await batchedAllSettled(
        targets.map(
          (volume) => () =>
            editVolume(currentSeries.id, volume.id, {
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
    [currentSeries, selectedVolumeIds, editVolume]
  )

  const applyVolumeReadingStatus = useCallback(
    async (status: ReadingStatus) => {
      if (!currentSeries) return
      if (!selectedVolumeIds || selectedVolumeIds.size === 0) return

      const targets = Array.from(selectedVolumeIds)
        .map((id) => currentSeries.volumes.find((volume) => volume.id === id))
        .filter((volume): volume is Volume => Boolean(volume))

      const results = await batchedAllSettled(
        targets.map(
          (volume) => () =>
            editVolume(currentSeries.id, volume.id, {
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
    [currentSeries, selectedVolumeIds, editVolume]
  )

  const applyAllVolumesOwnership = useCallback(
    async (status: OwnershipStatus) => {
      if (!currentSeries) return
      const targets = currentSeries.volumes
      if (targets.length === 0) return

      const results = await batchedAllSettled(
        targets.map(
          (volume) => () =>
            editVolume(currentSeries.id, volume.id, {
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
    [currentSeries, editVolume]
  )

  const applyAllVolumesReadingStatus = useCallback(
    async (status: ReadingStatus) => {
      if (!currentSeries) return
      const targets = currentSeries.volumes
      if (targets.length === 0) return

      const results = await batchedAllSettled(
        targets.map(
          (volume) => () =>
            editVolume(currentSeries.id, volume.id, {
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
    [currentSeries, editVolume]
  )

  return {
    handleToggleRead,
    handleToggleWishlist,
    handleSetRating,
    applyVolumeOwnershipStatus,
    applyVolumeReadingStatus,
    applyAllVolumesOwnership,
    applyAllVolumesReadingStatus
  }
}
