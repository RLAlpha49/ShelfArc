"use client"

import { useCallback } from "react"

import { recordActivityEvent } from "@/lib/activity/record-event"
import type { BookSearchResult } from "@/lib/books/search"
import {
  buildSanitizedVolumeInsert,
  normalizeVolumeDates,
  sanitizeSeriesUpdate,
  sanitizeVolumeUpdate
} from "@/lib/library/sanitize-library"
import {
  sanitizeOptionalHtml,
  sanitizeOptionalPlainText,
  sanitizePlainText
} from "@/lib/sanitize-html"
import {
  DEFAULT_CURRENCY_CODE,
  selectAllUnassignedVolumes,
  selectSeriesById,
  useLibraryStore
} from "@/lib/store/library-store"
import { createClient } from "@/lib/supabase/client"
import type {
  Series,
  SeriesInsert,
  SeriesWithVolumes,
  TitleType,
  Volume,
  VolumeFormat,
  VolumeInsert
} from "@/lib/types/database"
import {
  isNonNegativeFinite,
  isPositiveInteger,
  isValidSeriesStatus,
  isValidTitleType
} from "@/lib/validation"

export function useLibraryMutations() {
  const supabase = createClient()
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

  /**
   * Persists an append-only price history entry (best effort).
   * @param params - Price history payload.
   * @source
   */
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("price_history").insert({
          volume_id: params.volumeId,
          user_id: params.userId,
          price: params.price,
          currency: currencyCode,
          source: params.source ?? "manual",
          product_url: params.productUrl ?? null
        })

        if (error) {
          console.warn("Failed to append price history entry", error)
        }
      } catch (error) {
        console.warn("Failed to append price history entry", error)
      }
    },
    [supabase]
  )

  /**
   * Appends price history only when purchase price changed to a positive value.
   * @param params - Previous and next pricing data.
   * @source
   */
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

  // Create new series
  const createSeries = useCallback(
    async (data: Omit<SeriesInsert, "user_id">) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const sanitizedTitle = sanitizePlainText(data.title, 500)
        if (!sanitizedTitle) throw new Error("Series title is required")

        const sanitizedData: Omit<SeriesInsert, "user_id"> = {
          ...data,
          title: sanitizedTitle,
          original_title: sanitizeOptionalPlainText(data.original_title, 500),
          description: sanitizeOptionalHtml(data.description),
          author: sanitizeOptionalPlainText(data.author, 1000),
          artist: sanitizeOptionalPlainText(data.artist, 1000),
          publisher: sanitizeOptionalPlainText(data.publisher, 1000),
          notes: sanitizeOptionalPlainText(data.notes, 5000),
          type: isValidTitleType(data.type) ? data.type : "other",
          tags: Array.isArray(data.tags)
            ? data.tags
                .map((tag) => sanitizePlainText(String(tag), 100))
                .filter(Boolean)
            : [],
          total_volumes:
            data.total_volumes != null && isPositiveInteger(data.total_volumes)
              ? data.total_volumes
              : null,
          cover_image_url: sanitizeOptionalPlainText(
            data.cover_image_url,
            2000
          ),
          status: isValidSeriesStatus(data.status) ? data.status : null
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newSeries, error } = await (supabase as any)
          .from("series")
          .insert({ ...sanitizedData, user_id: user.id })
          .select()
          .single()

        if (error) throw error

        const seriesWithVolumes: SeriesWithVolumes = {
          ...(newSeries as Series),
          volumes: []
        }
        addSeries(seriesWithVolumes)

        void recordActivityEvent(supabase, {
          userId: user.id,
          eventType: "series_created",
          entityType: "series",
          entityId: seriesWithVolumes.id,
          metadata: { title: sanitizedTitle }
        })

        return seriesWithVolumes
      } catch (error) {
        console.error("Error creating series:", error)
        throw error
      }
    },
    [supabase, addSeries]
  )

  // Update existing series
  const editSeries = useCallback(
    async (id: string, data: Partial<Series>) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const sanitizedData = sanitizeSeriesUpdate(data)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("series")
          .update(sanitizedData)
          .eq("id", id)
          .eq("user_id", user.id)

        if (error) throw error

        updateSeries(id, sanitizedData)

        void recordActivityEvent(supabase, {
          userId: user.id,
          eventType: "series_updated",
          entityType: "series",
          entityId: id,
          metadata: { title: sanitizedData.title || "Series" }
        })
      } catch (error) {
        console.error("Error updating series:", error)
        throw error
      }
    },
    [supabase, updateSeries]
  )

  const updateSeriesCoverFromVolume = useCallback(
    async (seriesId: string, volume: Volume) => {
      const nextCoverUrl = volume.cover_image_url?.trim() ?? ""
      if (!nextCoverUrl) return

      const seriesSnapshot = useLibraryStore.getState()
      const targetSeries = selectSeriesById(seriesSnapshot, seriesId)
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

  // Delete series
  const removeSeries = useCallback(
    async (id: string) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const currentState = useLibraryStore.getState()
        const targetSeries = selectSeriesById(currentState, id)
        const volumesToUpdate = targetSeries?.volumes ?? []

        if (deleteSeriesVolumes) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: volumeError } = await (supabase as any)
            .from("volumes")
            .delete()
            .eq("series_id", id)
            .eq("user_id", user.id)

          if (volumeError) throw volumeError
        } else if (volumesToUpdate.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: volumeError } = await (supabase as any)
            .from("volumes")
            .update({ series_id: null })
            .eq("series_id", id)
            .eq("user_id", user.id)

          if (volumeError) throw volumeError
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: seriesError } = await (supabase as any)
          .from("series")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id)

        if (seriesError) throw seriesError

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

        void recordActivityEvent(supabase, {
          userId: user.id,
          eventType: "series_deleted",
          entityType: "series",
          entityId: id,
          metadata: {
            title: targetSeries?.title ?? "Unknown",
            volumeCount: volumesToUpdate.length
          }
        })
      } catch (error) {
        console.error("Error deleting series:", error)
        throw error
      }
    },
    [supabase, deleteSeriesVolumes, setUnassignedVolumes, deleteSeries]
  )

  // Create new volume
  const createVolume = useCallback(
    async (
      seriesId: string | null,
      data: Omit<VolumeInsert, "user_id" | "series_id">
    ) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const sanitizedData = buildSanitizedVolumeInsert(data)

        if (!sanitizedData.format && seriesId) {
          const parentSeries = useLibraryStore.getState().seriesById[seriesId]
          if (parentSeries) {
            const formatFromType: Partial<Record<string, VolumeFormat>> = {
              light_novel: "paperback",
              manga: "paperback"
            }
            sanitizedData.format = formatFromType[parentSeries.type] ?? null
          }
        }

        const payload = {
          ...normalizeVolumeDates(sanitizedData),
          series_id: seriesId,
          user_id: user.id
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newVolume, error } = await (supabase as any)
          .from("volumes")
          .insert(payload)
          .select()
          .single()

        if (error) throw error

        await appendPriceHistory({
          userId: user.id,
          volumeId: (newVolume as Volume).id,
          price: (newVolume as Volume).purchase_price,
          productUrl: (newVolume as Volume).amazon_url,
          source: "manual"
        })

        if (seriesId) {
          await updateSeriesCoverFromVolume(seriesId, newVolume as Volume)
          addVolume(seriesId, newVolume as Volume)
        } else {
          addUnassignedVolume(newVolume as Volume)
        }

        void recordActivityEvent(supabase, {
          userId: user.id,
          eventType: "volume_added",
          entityType: "volume",
          entityId: (newVolume as Volume).id,
          metadata: {
            title: (newVolume as Volume).title,
            volumeNumber: (newVolume as Volume).volume_number
          }
        })

        return newVolume as Volume
      } catch (error) {
        console.error("Error creating volume:", error)
        throw error
      }
    },
    [
      supabase,
      addVolume,
      addUnassignedVolume,
      appendPriceHistory,
      updateSeriesCoverFromVolume
    ]
  )

  // Update volume
  const editVolume = useCallback(
    async (
      seriesId: string | null,
      volumeId: string,
      data: Partial<Volume>
    ) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const hasSeriesId = Object.hasOwn(data, "series_id")
        const nextSeriesId = hasSeriesId ? (data.series_id ?? null) : seriesId
        const editState = useLibraryStore.getState()
        if (nextSeriesId && !editState.seriesById[nextSeriesId]) {
          throw new Error("Series not found")
        }
        const sanitizedData = sanitizeVolumeUpdate(data)
        const updatePayload = {
          ...normalizeVolumeDates(sanitizedData),
          series_id: nextSeriesId
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("volumes")
          .update(updatePayload)
          .eq("id", volumeId)
          .eq("user_id", user.id)

        if (error) throw error

        const currentVolume = editState.volumesById[volumeId]

        if (!currentVolume) {
          return
        }

        const updatedVolume: Volume = {
          ...currentVolume,
          ...updatePayload
        }

        await appendPriceHistoryIfChanged({
          userId: user.id,
          volumeId,
          previousPrice: currentVolume.purchase_price,
          nextPrice: updatedVolume.purchase_price,
          productUrl: updatedVolume.amazon_url,
          source: "manual"
        })

        if (nextSeriesId === seriesId) {
          if (seriesId) {
            updateVolume(seriesId, volumeId, updatePayload)
          } else {
            updateUnassignedVolume(volumeId, updatePayload)
          }

          void recordActivityEvent(supabase, {
            userId: user.id,
            eventType: "volume_updated",
            entityType: "volume",
            entityId: volumeId,
            metadata: {
              title: updatedVolume.title,
              volumeNumber: updatedVolume.volume_number
            }
          })
          return
        }

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

        void recordActivityEvent(supabase, {
          userId: user.id,
          eventType: "volume_updated",
          entityType: "volume",
          entityId: volumeId,
          metadata: {
            title: updatedVolume.title,
            volumeNumber: updatedVolume.volume_number
          }
        })
      } catch (error) {
        console.error("Error updating volume:", error)
        throw error
      }
    },
    [
      supabase,
      updateVolume,
      updateUnassignedVolume,
      deleteVolume,
      deleteUnassignedVolume,
      addVolume,
      addUnassignedVolume,
      appendPriceHistoryIfChanged,
      updateSeriesCoverFromVolume
    ]
  )

  // Delete volume
  const removeVolume = useCallback(
    async (seriesId: string | null, volumeId: string) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("volumes")
          .delete()
          .eq("id", volumeId)
          .eq("user_id", user.id)

        if (error) throw error

        if (seriesId) {
          deleteVolume(seriesId, volumeId)
        } else {
          deleteUnassignedVolume(volumeId)
        }

        void recordActivityEvent(supabase, {
          userId: user.id,
          eventType: "volume_deleted",
          entityType: "volume",
          entityId: volumeId
        })
      } catch (error) {
        console.error("Error deleting volume:", error)
        throw error
      }
    },
    [supabase, deleteVolume, deleteUnassignedVolume]
  )

  return {
    createSeries,
    editSeries,
    removeSeries,
    createVolume,
    editVolume,
    removeVolume,
    appendPriceHistory,
    appendPriceHistoryIfChanged,
    autoFillSeriesFromVolume,
    updateSeriesCoverFromVolume,
    updateSeriesAuthorIfMissing,
    updateSeriesTypeIfMissing
  }
}
