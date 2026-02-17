"use client"

import { useCallback } from "react"
import { apiFetch } from "@/lib/api/client"
import {
  DEFAULT_CURRENCY_CODE,
  useLibraryStore
} from "@/lib/store/library-store"
import { isNonNegativeFinite } from "@/lib/validation"
import type {
  Series,
  SeriesWithVolumes,
  SeriesInsert,
  TitleType,
  Volume,
  VolumeInsert
} from "@/lib/types/database"
import type { BookSearchResult } from "@/lib/books/search"

/**
 * React hook providing library mutations via API routes instead of direct Supabase client calls.
 * Auth, CSRF, rate limiting, sanitization, and activity recording are handled server-side.
 * @returns Library mutation functions matching the same interface as useLibraryMutations.
 * @source
 */
export function useLibraryApiMutations() {
  const {
    series,
    unassignedVolumes,
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

      const seriesSnapshot = useLibraryStore.getState().series
      const targetSeries = seriesSnapshot.find((item) => item.id === seriesId)
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
      const targetSeries = series.find((item) => item.id === id)
      const volumesToUpdate = targetSeries?.volumes ?? []

      await apiFetch(
        `/api/library/series/${encodeURIComponent(id)}?deleteVolumes=${String(!!deleteSeriesVolumes)}`,
        { method: "DELETE" }
      )

      if (!deleteSeriesVolumes && volumesToUpdate.length > 0) {
        const detachedVolumes = volumesToUpdate.map((volume) => ({
          ...volume,
          series_id: null
        }))
        const existingIds = new Set(
          unassignedVolumes.map((volume) => volume.id)
        )
        const nextUnassigned = [
          ...unassignedVolumes,
          ...detachedVolumes.filter((volume) => !existingIds.has(volume.id))
        ]
        setUnassignedVolumes(nextUnassigned)
      }

      deleteSeries(id)
    },
    [
      series,
      unassignedVolumes,
      deleteSeriesVolumes,
      setUnassignedVolumes,
      deleteSeries
    ]
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

  const editVolume = useCallback(
    async (
      seriesId: string | null,
      volumeId: string,
      data: Partial<Volume>
    ) => {
      const hasSeriesId = Object.hasOwn(data, "series_id")
      const nextSeriesId = hasSeriesId ? (data.series_id ?? null) : seriesId

      const updatedVolume = await apiFetch<Volume>(
        `/api/library/volumes/${encodeURIComponent(volumeId)}`,
        { method: "PATCH", body: data }
      )

      if (nextSeriesId === seriesId) {
        if (seriesId) {
          updateVolume(seriesId, volumeId, updatedVolume)
        } else {
          updateUnassignedVolume(volumeId, updatedVolume)
        }
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
      updateVolume,
      updateUnassignedVolume,
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

      const currentSeries = useLibraryStore.getState().series
      const idSet = new Set(volumeIds)

      for (const s of currentSeries) {
        for (const v of s.volumes) {
          if (idSet.has(v.id)) {
            updateVolume(s.id, v.id, updates as Partial<Volume>)
          }
        }
      }

      const currentUnassigned = useLibraryStore.getState().unassignedVolumes
      for (const v of currentUnassigned) {
        if (idSet.has(v.id)) {
          updateUnassignedVolume(v.id, updates as Partial<Volume>)
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
