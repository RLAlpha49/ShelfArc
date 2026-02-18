"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api/client"
import type { BookSearchResult } from "@/lib/books/search"
import {
  DEFAULT_CURRENCY_CODE,
  selectAllUnassignedVolumes,
  selectSeriesById,
  useLibraryStore
} from "@/lib/store/library-store"
import type {
  Series,
  SeriesInsert,
  SeriesWithVolumes,
  TitleType,
  Volume,
  VolumeInsert
} from "@/lib/types/database"
import { isNonNegativeFinite } from "@/lib/validation"

/** Fields safe for optimistic updates (no server-side logic dependencies). */
const OPTIMISTIC_SERIES_FIELDS = new Set(["type", "status"])
const OPTIMISTIC_VOLUME_FIELDS = new Set([
  "ownership_status",
  "reading_status",
  "rating"
])

/** Returns true when every key in `data` is safe for optimistic application. */
function isOptimisticCandidate(
  data: Record<string, unknown>,
  allowedFields: Set<string>
): boolean {
  const keys = Object.keys(data)
  return keys.length > 0 && keys.every((k) => allowedFields.has(k))
}

/**
 * React hook providing library mutations via API routes instead of direct Supabase client calls.
 * Auth, CSRF, rate limiting, sanitization, and activity recording are handled server-side.
 * @returns Library mutation functions matching the same interface as useLibraryMutations.
 * @source
 */
export function useLibraryApiMutations() {
  const {
    setUnassignedVolumes,
    addSeries,
    updateSeries,
    deleteSeries,
    addVolume,
    updateVolume,
    deleteVolume,
    addUnassignedVolume,
    updateUnassignedVolume,
    deleteUnassignedVolume,
    deleteSeriesVolumes
  } = useLibraryStore()

  const appendPriceHistory = useCallback(
    async (params: {
      userId: string
      volumeId: string
      price: number | null | undefined
      currency?: string | null
      productUrl?: string | null
      source?: string
    }) => {
      if (
        params.price == null ||
        !isNonNegativeFinite(params.price) ||
        params.price <= 0
      ) {
        return
      }

      const currencyCode =
        params.currency ||
        useLibraryStore.getState().priceDisplayCurrency ||
        DEFAULT_CURRENCY_CODE

      try {
        await apiFetch("/api/books/price/history", {
          method: "POST",
          body: {
            volumeId: params.volumeId,
            price: params.price,
            currency: currencyCode,
            source: params.source ?? "manual",
            productUrl: params.productUrl ?? null
          }
        })
      } catch (error) {
        console.warn("Failed to append price history entry", error)
      }
    },
    []
  )

  const appendPriceHistoryIfChanged = useCallback(
    async (params: {
      userId: string
      volumeId: string
      previousPrice: number | null | undefined
      nextPrice: number | null | undefined
      productUrl?: string | null
      source?: string
    }) => {
      const shouldAppend =
        params.nextPrice != null &&
        params.nextPrice > 0 &&
        (!isNonNegativeFinite(params.previousPrice) ||
          params.previousPrice !== params.nextPrice)

      if (!shouldAppend) return

      await appendPriceHistory({
        userId: params.userId,
        volumeId: params.volumeId,
        price: params.nextPrice,
        productUrl: params.productUrl,
        source: params.source
      })
    },
    [appendPriceHistory]
  )

  const createSeries = useCallback(
    async (data: Omit<SeriesInsert, "user_id">) => {
      const result = await apiFetch<SeriesWithVolumes>("/api/library/series", {
        method: "POST",
        body: data
      })
      addSeries(result)
      return result
    },
    [addSeries]
  )

  const editSeries = useCallback(
    async (id: string, data: Partial<Series>) => {
      // Optimistic update for lightweight field changes (type, status)
      if (isOptimisticCandidate(data, OPTIMISTIC_SERIES_FIELDS)) {
        const prev = useLibraryStore.getState().seriesById[id]
        if (prev) {
          updateSeries(id, data as Partial<SeriesWithVolumes>)
          try {
            const updated = await apiFetch<Series>(
              `/api/library/series/${encodeURIComponent(id)}`,
              { method: "PATCH", body: data }
            )
            updateSeries(id, updated)
          } catch (error) {
            updateSeries(id, prev)
            toast.error("Failed to update series")
            throw error
          }
          return
        }
      }

      const updated = await apiFetch<Series>(
        `/api/library/series/${encodeURIComponent(id)}`,
        { method: "PATCH", body: data }
      )
      updateSeries(id, updated)
    },
    [updateSeries]
  )

  const updateSeriesCoverFromVolume = useCallback(
    async (seriesId: string, volume: Volume) => {
      const nextCoverUrl = volume.cover_image_url?.trim() ?? ""
      if (!nextCoverUrl) return

      const state = useLibraryStore.getState()
      const targetSeries = selectSeriesById(state, seriesId)
      if (!targetSeries) return

      const lowestExistingVolume =
        targetSeries.volumes.length > 0
          ? targetSeries.volumes.reduce(
              (lowest, item) => Math.min(lowest, item.volume_number),
              Number.POSITIVE_INFINITY
            )
          : null

      const shouldUpdateCover =
        lowestExistingVolume === null ||
        volume.volume_number < lowestExistingVolume

      if (!shouldUpdateCover) return
      if (targetSeries.cover_image_url?.trim() === nextCoverUrl) return

      await editSeries(seriesId, { cover_image_url: nextCoverUrl })
    },
    [editSeries]
  )

  const autoFillSeriesFromVolume = useCallback(
    async (
      targetSeries: SeriesWithVolumes,
      volumeNumber: number,
      resolvedResult: BookSearchResult
    ) => {
      if (volumeNumber !== 1) return

      const updates: Partial<Series> = {}
      const nextDescription = resolvedResult.description?.trim() ?? ""

      if (!targetSeries.description?.trim() && nextDescription) {
        updates.description = resolvedResult.description
      }

      if (Object.keys(updates).length > 0) {
        await editSeries(targetSeries.id, updates)
      }
    },
    [editSeries]
  )

  const updateSeriesAuthorIfMissing = useCallback(
    async (targetSeries: SeriesWithVolumes, author?: string | null) => {
      const nextAuthor = author?.trim()
      if (!nextAuthor) return targetSeries
      if (targetSeries.author?.trim()) return targetSeries

      try {
        await editSeries(targetSeries.id, { author: nextAuthor })
        return { ...targetSeries, author: nextAuthor }
      } catch (error) {
        console.warn("Error updating series author:", error)
        return targetSeries
      }
    },
    [editSeries]
  )

  const updateSeriesTypeIfMissing = useCallback(
    async (targetSeries: SeriesWithVolumes, typeHint?: TitleType | null) => {
      if (!typeHint) return targetSeries
      if (targetSeries.type !== "other") return targetSeries

      try {
        await editSeries(targetSeries.id, { type: typeHint })
        return { ...targetSeries, type: typeHint }
      } catch (error) {
        console.warn("Error updating series type:", error)
        return targetSeries
      }
    },
    [editSeries]
  )

  const removeSeries = useCallback(
    async (id: string) => {
      const currentState = useLibraryStore.getState()
      const targetSeries = selectSeriesById(currentState, id)
      const volumesToUpdate = targetSeries?.volumes ?? []

      await apiFetch(
        `/api/library/series/${encodeURIComponent(id)}?deleteVolumes=${String(!!deleteSeriesVolumes)}`,
        { method: "DELETE" }
      )

      if (!deleteSeriesVolumes && volumesToUpdate.length > 0) {
        const currentUnassigned = selectAllUnassignedVolumes(
          useLibraryStore.getState()
        )
        const detachedVolumes = volumesToUpdate.map((volume) => ({
          ...volume,
          series_id: null
        }))
        const existingIds = new Set(
          currentUnassigned.map((volume) => volume.id)
        )
        const nextUnassigned = [
          ...currentUnassigned,
          ...detachedVolumes.filter((volume) => !existingIds.has(volume.id))
        ]
        setUnassignedVolumes(nextUnassigned)
      }

      deleteSeries(id)
    },
    [deleteSeriesVolumes, setUnassignedVolumes, deleteSeries]
  )

  const createVolume = useCallback(
    async (
      seriesId: string | null,
      data: Omit<VolumeInsert, "user_id" | "series_id">
    ) => {
      const newVolume = await apiFetch<Volume>("/api/library/volumes", {
        method: "POST",
        body: { ...data, series_id: seriesId }
      })

      if (seriesId) {
        await updateSeriesCoverFromVolume(seriesId, newVolume)
        addVolume(seriesId, newVolume)
      } else {
        addUnassignedVolume(newVolume)
      }

      return newVolume
    },
    [addVolume, addUnassignedVolume, updateSeriesCoverFromVolume]
  )

  const applyVolumeUpdate = useCallback(
    (seriesId: string | null, volumeId: string, data: Partial<Volume>) => {
      if (seriesId) {
        updateVolume(seriesId, volumeId, data)
      } else {
        updateUnassignedVolume(volumeId, data)
      }
    },
    [updateVolume, updateUnassignedVolume]
  )

  const editVolume = useCallback(
    async (
      seriesId: string | null,
      volumeId: string,
      data: Partial<Volume>
    ) => {
      const hasSeriesId = Object.hasOwn(data, "series_id")
      const nextSeriesId = hasSeriesId ? (data.series_id ?? null) : seriesId

      // Optimistic path: simple field edits within the same bucket
      if (
        nextSeriesId === seriesId &&
        isOptimisticCandidate(data, OPTIMISTIC_VOLUME_FIELDS)
      ) {
        const prev = useLibraryStore.getState().volumesById[volumeId]
        if (prev) {
          applyVolumeUpdate(seriesId, volumeId, data)
          try {
            const updated = await apiFetch<Volume>(
              `/api/library/volumes/${encodeURIComponent(volumeId)}`,
              { method: "PATCH", body: data }
            )
            applyVolumeUpdate(seriesId, volumeId, updated)
          } catch (error) {
            applyVolumeUpdate(seriesId, volumeId, prev)
            toast.error("Failed to update volume")
            throw error
          }
          return
        }
      }

      const updatedVolume = await apiFetch<Volume>(
        `/api/library/volumes/${encodeURIComponent(volumeId)}`,
        { method: "PATCH", body: data }
      )

      if (nextSeriesId === seriesId) {
        applyVolumeUpdate(seriesId, volumeId, updatedVolume)
        return
      }

      // Volume moved between series/unassigned
      if (seriesId) {
        deleteVolume(seriesId, volumeId)
      } else {
        deleteUnassignedVolume(volumeId)
      }

      if (nextSeriesId) {
        await updateSeriesCoverFromVolume(nextSeriesId, updatedVolume)
        addVolume(nextSeriesId, updatedVolume)
      } else {
        addUnassignedVolume(updatedVolume)
      }
    },
    [
      applyVolumeUpdate,
      deleteVolume,
      deleteUnassignedVolume,
      addVolume,
      addUnassignedVolume,
      updateSeriesCoverFromVolume
    ]
  )

  const removeVolume = useCallback(
    async (seriesId: string | null, volumeId: string) => {
      await apiFetch(`/api/library/volumes/${encodeURIComponent(volumeId)}`, {
        method: "DELETE"
      })

      if (seriesId) {
        deleteVolume(seriesId, volumeId)
      } else {
        deleteUnassignedVolume(volumeId)
      }
    },
    [deleteVolume, deleteUnassignedVolume]
  )

  const batchUpdateVolumes = useCallback(
    async (
      volumeIds: string[],
      updates: {
        ownership_status?: string
        reading_status?: string
        rating?: number | null
        purchase_price?: number | null
      }
    ) => {
      const result = await apiFetch<{ updated: number; requested: number }>(
        "/api/library/volumes/batch",
        { method: "PATCH", body: { volumeIds, updates } }
      )

      const batchState = useLibraryStore.getState()

      for (const vid of volumeIds) {
        const volume = batchState.volumesById[vid]
        if (!volume) continue
        if (volume.series_id) {
          updateVolume(volume.series_id, vid, updates as Partial<Volume>)
        } else if (batchState.unassignedVolumeIds.includes(vid)) {
          updateUnassignedVolume(vid, updates as Partial<Volume>)
        }
      }

      return result
    },
    [updateVolume, updateUnassignedVolume]
  )

  return {
    createSeries,
    editSeries,
    removeSeries,
    createVolume,
    editVolume,
    removeVolume,
    batchUpdateVolumes,
    appendPriceHistory,
    appendPriceHistoryIfChanged,
    autoFillSeriesFromVolume,
    updateSeriesCoverFromVolume,
    updateSeriesAuthorIfMissing,
    updateSeriesTypeIfMissing
  }
}
