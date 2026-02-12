"use client"

import { useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  DEFAULT_CURRENCY_CODE,
  useLibraryStore
} from "@/lib/store/library-store"
import {
  sanitizeOptionalHtml,
  sanitizeOptionalPlainText,
  sanitizePlainText
} from "@/lib/sanitize-html"
import {
  isNonNegativeFinite,
  isPositiveInteger,
  isValidTitleType
} from "@/lib/validation"
import type { BookSearchResult } from "@/lib/books/search"
import type {
  Series,
  SeriesWithVolumes,
  SeriesInsert,
  TitleType,
  Volume,
  VolumeInsert,
  OwnershipStatus
} from "@/lib/types/database"

import {
  extractVolumeNumberFromTitle,
  normalizeAuthorKey as normalizeAuthorKeyValue,
  normalizeLibraryText,
  normalizeSeriesTitle as normalizeSeriesTitleValue,
  stripVolumeFromTitle as stripVolumeFromTitleValue
} from "@/lib/library/volume-normalization"
import {
  buildSanitizedVolumeInsert,
  normalizeVolumeDates,
  sanitizeSeriesUpdate,
  sanitizeVolumeUpdate
} from "@/lib/library/sanitize-library"

/** Explicit column list for hot `series` reads (avoid select("*") growth). @source */
const SERIES_SELECT_FIELDS =
  "id,user_id,title,original_title,description,notes,author,artist,publisher,cover_image_url,type,total_volumes,status,tags,created_at,updated_at"

/** Explicit column list for hot `volumes` reads (avoid select("*") growth). @source */
const VOLUME_SELECT_FIELDS =
  "id,series_id,user_id,volume_number,title,description,isbn,cover_image_url,edition,format,page_count,publish_date,purchase_date,purchase_price,ownership_status,reading_status,current_page,amazon_url,rating,notes,started_at,finished_at,created_at,updated_at"

/** A volume paired with its parent series, used for flat volume views. @source */
export interface VolumeWithSeries {
  volume: Volume
  series: SeriesWithVolumes
}

/**
 * React hook providing CRUD operations, filtering, sorting, and book-import logic for the library.
 * @returns Library state, filtered views, and mutation functions.
 * @source
 */
export function useLibrary() {
  const supabase = createClient()
  const {
    series,
    setSeries,
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
    setIsLoading,
    isLoading,
    filters,
    sortField,
    sortOrder,
    deleteSeriesVolumes
  } = useLibraryStore()

  const fetchGoogleVolumeDetails = useCallback(async (volumeId: string) => {
    const response = await fetch(
      `/api/books/volume/${encodeURIComponent(volumeId)}`
    )
    const data = (await response.json()) as {
      result?: BookSearchResult
      error?: string
    }

    if (!response.ok) {
      throw new Error(data.error ?? "Google Books volume lookup failed")
    }

    if (!data.result) {
      throw new Error("Google Books volume lookup failed")
    }

    return data.result
  }, [])

  const resolveSearchResultDetails = useCallback(
    async (result: BookSearchResult) => {
      if (result.source !== "google_books") return result
      const volumeId = result.id?.trim() ?? ""
      if (!volumeId || volumeId.startsWith("google-")) {
        return result
      }

      try {
        return await fetchGoogleVolumeDetails(volumeId)
      } catch (error) {
        console.warn("Google Books volume lookup failed", error)
        return result
      }
    },
    [fetchGoogleVolumeDetails]
  )

  const normalizeText = useCallback((value?: string | null) => {
    return normalizeLibraryText(value)
  }, [])

  const normalizeAuthorKey = useCallback((value?: string | null) => {
    return normalizeAuthorKeyValue(value)
  }, [])

  const normalizeSeriesTitle = useCallback((value: string) => {
    return normalizeSeriesTitleValue(value)
  }, [])

  const extractVolumeNumber = useCallback((title?: string | null) => {
    return extractVolumeNumberFromTitle(title)
  }, [])

  const stripVolumeFromTitle = useCallback((title: string) => {
    return stripVolumeFromTitleValue(title)
  }, [])

  const deriveSeriesTitle = useCallback(
    (result: BookSearchResult) => {
      const base = (result.seriesTitle ?? result.title ?? "").trim()
      if (!base) return result.title
      return stripVolumeFromTitle(base)
    },
    [stripVolumeFromTitle]
  )

  const buildSeriesKey = useCallback(
    (title: string, author?: string | null) => {
      const normalizedTitle = normalizeSeriesTitle(title)
      const normalizedAuthor = normalizeAuthorKey(author)
      return `${normalizedTitle}|${normalizedAuthor}`
    },
    [normalizeAuthorKey, normalizeSeriesTitle]
  )

  const pickSeriesByVolumeCount = useCallback(
    (candidates: SeriesWithVolumes[]) => {
      return candidates.reduce((best, current) => {
        if (current.volumes.length > best.volumes.length) return current
        return best
      }, candidates[0])
    },
    []
  )

  const collectSeriesMatches = useCallback(
    (title: string, author?: string | null) => {
      const normalizedTitle = normalizeSeriesTitle(title)
      const normalizedAuthor = normalizeAuthorKey(author)
      const hasAuthor = normalizedAuthor.length > 0
      const matches: SeriesWithVolumes[] = []

      const seriesSnapshot = useLibraryStore.getState().series

      for (const item of seriesSnapshot) {
        if (normalizeSeriesTitle(item.title) !== normalizedTitle) continue
        const itemAuthor = normalizeAuthorKey(item.author)
        if (hasAuthor && itemAuthor && itemAuthor !== normalizedAuthor) continue
        matches.push(item)
      }

      return matches
    },
    [normalizeAuthorKey, normalizeSeriesTitle]
  )

  const pickSeriesByType = useCallback(
    (matches: SeriesWithVolumes[], typeHint?: TitleType | null) => {
      if (matches.length === 0) return undefined
      if (!typeHint) return pickSeriesByVolumeCount(matches)

      const typeMatches = matches.filter((item) => item.type === typeHint)
      if (typeMatches.length > 0) return pickSeriesByVolumeCount(typeMatches)

      const otherMatches = matches.filter((item) => item.type === "other")
      if (otherMatches.length > 0) return pickSeriesByVolumeCount(otherMatches)

      return pickSeriesByVolumeCount(matches)
    },
    [pickSeriesByVolumeCount]
  )

  const findMatchingSeries = useCallback(
    (title: string, author?: string | null, typeHint?: TitleType | null) => {
      const matches = collectSeriesMatches(title, author)
      if (matches.length === 0) return undefined
      if (typeHint) {
        const typeMatches = matches.filter((item) => item.type === typeHint)
        if (typeMatches.length === 0) return undefined
        return pickSeriesByVolumeCount(typeMatches)
      }
      if (matches.length === 1) return matches[0]
      return pickSeriesByType(matches, typeHint)
    },
    [collectSeriesMatches, pickSeriesByType, pickSeriesByVolumeCount]
  )

  const normalizeSeriesTypeHint = useCallback(
    (value?: string | null) => {
      return normalizeText(value ?? "")
        .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
        .replaceAll(/\s+/g, " ")
        .trim()
    },
    [normalizeText]
  )

  const detectSeriesTypeFromText = useCallback(
    (value?: string | null): TitleType | null => {
      const normalized = normalizeSeriesTypeHint(value)
      if (!normalized) return null

      const hasMangaHint =
        normalized.includes("manga") ||
        normalized.includes("manhwa") ||
        normalized.includes("manhua") ||
        normalized.includes("webtoon") ||
        normalized.includes("web comic") ||
        normalized.includes("webcomic") ||
        normalized.includes("graphic novel") ||
        normalized.includes("comic book") ||
        normalized.includes("comic")

      if (hasMangaHint) return "manga"
      if (normalized.includes("light novel") || normalized.includes("novel")) {
        return "light_novel"
      }

      return null
    },
    [normalizeSeriesTypeHint]
  )

  const deriveSeriesType = useCallback(
    (result: BookSearchResult): TitleType | null => {
      const fromTitle = detectSeriesTypeFromText(result.title)
      const fromSeries = detectSeriesTypeFromText(result.seriesTitle)
      if (fromTitle && fromSeries && fromTitle !== fromSeries) {
        return fromTitle
      }
      return fromTitle ?? fromSeries
    },
    [detectSeriesTypeFromText]
  )

  const getNextVolumeNumber = useCallback(
    (targetSeries?: SeriesWithVolumes) => {
      if (!targetSeries) return 1
      const maxVolume = targetSeries.volumes.reduce(
        (max, volume) => Math.max(max, volume.volume_number),
        0
      )
      return maxVolume + 1
    },
    []
  )

  const bumpNextVolumeNumberForSeries = useCallback(
    (
      nextVolumeBySeries: Map<string, number>,
      seriesId: string,
      usedNumber: number
    ) => {
      const current = nextVolumeBySeries.get(seriesId)
      const next = Math.max(current ?? usedNumber + 1, usedNumber + 1)
      nextVolumeBySeries.set(seriesId, next)
    },
    []
  )

  // Fetch all series with volumes
  const fetchSeries = useCallback(async () => {
    setIsLoading(true)
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: seriesData, error: seriesError } = await supabase
        .from("series")
        .select(SERIES_SELECT_FIELDS)
        .eq("user_id", user.id)
        .order(sortField, { ascending: sortOrder === "asc" })

      if (seriesError) throw seriesError

      // Fetch volumes for all series
      const { data: volumesData, error: volumesError } = await supabase
        .from("volumes")
        .select(VOLUME_SELECT_FIELDS)
        .eq("user_id", user.id)
        .order("volume_number", { ascending: true })

      if (volumesError) throw volumesError

      const allVolumes = (volumesData || []) as Volume[]
      const assignedVolumes = allVolumes.filter((v) => v.series_id)
      const unassigned = allVolumes.filter((v) => !v.series_id)

      // Combine series with their volumes
      const seriesWithVolumes: SeriesWithVolumes[] = (
        (seriesData || []) as Series[]
      ).map((s) => ({
        ...s,
        volumes: assignedVolumes.filter((v) => v.series_id === s.id)
      }))

      setSeries(seriesWithVolumes)
      setUnassignedVolumes(unassigned)
    } catch (error) {
      console.error("Error fetching series:", error)
    } finally {
      setIsLoading(false)
    }
  }, [
    supabase,
    setSeries,
    setUnassignedVolumes,
    setIsLoading,
    sortField,
    sortOrder
  ])

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
          status: sanitizeOptionalPlainText(data.status, 100)
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
      } catch (error) {
        console.error("Error updating series:", error)
        throw error
      }
    },
    [supabase, updateSeries]
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

        const targetSeries = series.find((item) => item.id === id)
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
      } catch (error) {
        console.error("Error deleting series:", error)
        throw error
      }
    },
    [
      supabase,
      series,
      unassignedVolumes,
      deleteSeriesVolumes,
      setUnassignedVolumes,
      deleteSeries
    ]
  )

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
          const parentSeries = useLibraryStore
            .getState()
            .series.find((s) => s.id === seriesId)
          if (parentSeries) {
            const formatFromType: Record<string, string> = {
              light_novel: "Light Novel",
              manga: "Manga"
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
        const seriesSnapshot = useLibraryStore.getState().series
        if (
          nextSeriesId &&
          !seriesSnapshot.some((item) => item.id === nextSeriesId)
        ) {
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

        const currentVolume =
          seriesSnapshot
            .flatMap((item) => item.volumes)
            .find((volume) => volume.id === volumeId) ??
          unassignedVolumes.find((volume) => volume.id === volumeId)

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
      } catch (error) {
        console.error("Error updating volume:", error)
        throw error
      }
    },
    [
      supabase,
      unassignedVolumes,
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
      } catch (error) {
        console.error("Error deleting volume:", error)
        throw error
      }
    },
    [supabase, deleteVolume, deleteUnassignedVolume]
  )

  // Filter series based on current filters
  const filteredSeries = series.filter((s) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesTitle = s.title.toLowerCase().includes(searchLower)
      const matchesAuthor = s.author?.toLowerCase().includes(searchLower)
      const matchesDescription = s.description
        ?.toLowerCase()
        .includes(searchLower)
      if (!matchesTitle && !matchesAuthor && !matchesDescription) return false
    }

    // Type filter
    if (filters.type !== "all" && s.type !== filters.type) return false

    // Tags filter
    if (filters.tags.length > 0) {
      const hasTags = filters.tags.every((tag) => s.tags.includes(tag))
      if (!hasTags) return false
    }

    // Ownership status filter (check volumes)
    if (filters.ownershipStatus !== "all") {
      const hasMatchingVolume = s.volumes.some(
        (v) => v.ownership_status === filters.ownershipStatus
      )
      if (!hasMatchingVolume) return false
    }

    // Reading status filter (check volumes)
    if (filters.readingStatus !== "all") {
      const hasMatchingVolume = s.volumes.some(
        (v) => v.reading_status === filters.readingStatus
      )
      if (!hasMatchingVolume) return false
    }

    return true
  })

  const allVolumes = useMemo<VolumeWithSeries[]>(() => {
    return series.flatMap((item) =>
      item.volumes.map((volume) => ({ volume, series: item }))
    )
  }, [series])

  const filteredVolumes = useMemo(() => {
    return allVolumes.filter(({ volume, series: seriesItem }) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesVolumeTitle = volume.title
          ?.toLowerCase()
          .includes(searchLower)
        const matchesSeriesTitle = seriesItem.title
          .toLowerCase()
          .includes(searchLower)
        const matchesAuthor = seriesItem.author
          ?.toLowerCase()
          .includes(searchLower)
        const matchesIsbn = volume.isbn?.toLowerCase().includes(searchLower)

        if (
          !matchesVolumeTitle &&
          !matchesSeriesTitle &&
          !matchesAuthor &&
          !matchesIsbn
        ) {
          return false
        }
      }

      if (filters.type !== "all" && seriesItem.type !== filters.type)
        return false

      if (filters.tags.length > 0) {
        const hasTags = filters.tags.every((tag) =>
          seriesItem.tags.includes(tag)
        )
        if (!hasTags) return false
      }

      if (
        filters.ownershipStatus !== "all" &&
        volume.ownership_status !== filters.ownershipStatus
      ) {
        return false
      }

      if (
        filters.readingStatus !== "all" &&
        volume.reading_status !== filters.readingStatus
      ) {
        return false
      }

      return true
    })
  }, [allVolumes, filters])

  const filteredUnassignedVolumes = useMemo(() => {
    return unassignedVolumes.filter((volume) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesTitle = volume.title?.toLowerCase().includes(searchLower)
        const matchesIsbn = volume.isbn?.toLowerCase().includes(searchLower)

        if (!matchesTitle && !matchesIsbn) {
          return false
        }
      }

      if (filters.type !== "all") return false
      if (filters.tags.length > 0) return false

      if (
        filters.ownershipStatus !== "all" &&
        volume.ownership_status !== filters.ownershipStatus
      ) {
        return false
      }

      if (
        filters.readingStatus !== "all" &&
        volume.reading_status !== filters.readingStatus
      ) {
        return false
      }

      return true
    })
  }, [filters, unassignedVolumes])

  const sortedVolumes = useMemo(() => {
    const multiplier = sortOrder === "asc" ? 1 : -1
    const compareStrings = (a?: string | null, b?: string | null) => {
      return (a ?? "").localeCompare(b ?? "", undefined, {
        sensitivity: "base"
      })
    }

    return [...filteredVolumes].sort((a, b) => {
      switch (sortField) {
        case "author":
          return (
            compareStrings(a.series.author, b.series.author) * multiplier ||
            (a.volume.volume_number - b.volume.volume_number) * multiplier
          )
        case "created_at":
          return (
            (new Date(a.volume.created_at).getTime() -
              new Date(b.volume.created_at).getTime()) *
            multiplier
          )
        case "updated_at":
          return (
            (new Date(a.volume.updated_at).getTime() -
              new Date(b.volume.updated_at).getTime()) *
            multiplier
          )
        case "title":
        default:
          return (
            compareStrings(a.series.title, b.series.title) * multiplier ||
            (a.volume.volume_number - b.volume.volume_number) * multiplier
          )
      }
    })
  }, [filteredVolumes, sortField, sortOrder])

  const resolveSeriesForResult = useCallback(
    async (
      resolvedResult: BookSearchResult,
      seriesCache: Map<string, SeriesWithVolumes>
    ) => {
      const seriesTitle = deriveSeriesTitle(resolvedResult)
      const author = resolvedResult.authors[0] ?? null
      const seriesTypeHint = deriveSeriesType(resolvedResult)
      const seriesKey = buildSeriesKey(seriesTitle, author)
      const typedSeriesKey = seriesTypeHint
        ? `${seriesKey}|${seriesTypeHint}`
        : seriesKey
      const parsedVolumeNumber = extractVolumeNumber(resolvedResult.title)
      const initialVolumeNumber = parsedVolumeNumber ?? 1

      let targetSeries = seriesTypeHint
        ? seriesCache.get(typedSeriesKey)
        : seriesCache.get(seriesKey)

      targetSeries ??= findMatchingSeries(seriesTitle, author, seriesTypeHint)

      targetSeries ??= await createSeries({
        title: seriesTitle,
        author: author || null,
        description:
          initialVolumeNumber === 1 ? resolvedResult.description || null : null,
        publisher: resolvedResult.publisher || null,
        cover_image_url:
          initialVolumeNumber === 1 ? resolvedResult.coverUrl || null : null,
        type: seriesTypeHint ?? "other",
        tags: []
      })

      targetSeries = await updateSeriesAuthorIfMissing(targetSeries, author)
      targetSeries = await updateSeriesTypeIfMissing(
        targetSeries,
        seriesTypeHint
      )

      if (seriesTypeHint) {
        seriesCache.set(typedSeriesKey, targetSeries)
      } else {
        seriesCache.set(seriesKey, targetSeries)
      }

      return { targetSeries, parsedVolumeNumber }
    },
    [
      buildSeriesKey,
      createSeries,
      deriveSeriesTitle,
      deriveSeriesType,
      extractVolumeNumber,
      findMatchingSeries,
      updateSeriesAuthorIfMissing,
      updateSeriesTypeIfMissing
    ]
  )

  const addBooksFromSearchResults = useCallback(
    async (
      results: BookSearchResult[],
      options?: { throwOnError?: boolean; ownershipStatus?: OwnershipStatus }
    ) => {
      const seriesCache = new Map<string, SeriesWithVolumes>()
      const nextVolumeBySeries = new Map<string, number>()
      let successCount = 0
      let failureCount = 0
      let lastSeries: SeriesWithVolumes | null = null

      const getNextVolumeNumberForSeries = (
        targetSeries: SeriesWithVolumes
      ) => {
        const cached = nextVolumeBySeries.get(targetSeries.id)
        if (cached !== undefined) return cached
        const next = getNextVolumeNumber(targetSeries)
        nextVolumeBySeries.set(targetSeries.id, next)
        return next
      }

      for (const result of results) {
        try {
          const resolvedResult = await resolveSearchResultDetails(result)
          const { targetSeries, parsedVolumeNumber } =
            await resolveSeriesForResult(resolvedResult, seriesCache)

          const volumeNumber =
            parsedVolumeNumber ?? getNextVolumeNumberForSeries(targetSeries)

          await createVolume(targetSeries.id, {
            volume_number: volumeNumber,
            title: resolvedResult.title || null,
            isbn: resolvedResult.isbn || null,
            cover_image_url: resolvedResult.coverUrl || null,
            publish_date: resolvedResult.publishedDate || null,
            page_count: resolvedResult.pageCount ?? null,
            description: resolvedResult.description || null,
            ownership_status: options?.ownershipStatus ?? "owned",
            reading_status: "unread"
          })

          await autoFillSeriesFromVolume(
            targetSeries,
            volumeNumber,
            resolvedResult
          )

          bumpNextVolumeNumberForSeries(
            nextVolumeBySeries,
            targetSeries.id,
            volumeNumber
          )
          lastSeries = targetSeries
          successCount += 1
        } catch (error) {
          console.error("Error adding book from search:", error)
          failureCount += 1
          if (options?.throwOnError) {
            throw error
          }
        }
      }

      return { successCount, failureCount, lastSeries }
    },
    [
      autoFillSeriesFromVolume,
      bumpNextVolumeNumberForSeries,
      createVolume,
      getNextVolumeNumber,
      resolveSearchResultDetails,
      resolveSeriesForResult
    ]
  )

  const addBookFromSearchResult = useCallback(
    async (
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      const { failureCount, lastSeries } = await addBooksFromSearchResults(
        [result],
        { ...options, throwOnError: true }
      )
      if (failureCount > 0 || !lastSeries) {
        throw new Error("Failed to add book")
      }
      return lastSeries
    },
    [addBooksFromSearchResults]
  )

  const addVolumesFromSearchResults = useCallback(
    async (
      seriesId: string,
      results: BookSearchResult[],
      options?: { throwOnError?: boolean; ownershipStatus?: OwnershipStatus }
    ) => {
      const targetSeries = series.find((item) => item.id === seriesId)
      if (!targetSeries) throw new Error("Series not found")

      const nextVolumeBySeries = new Map<string, number>()
      let successCount = 0
      let failureCount = 0

      const getNextVolumeNumberForSeries = () => {
        const cached = nextVolumeBySeries.get(seriesId)
        if (cached !== undefined) return cached
        const next = getNextVolumeNumber(targetSeries)
        nextVolumeBySeries.set(seriesId, next)
        return next
      }

      for (const result of results) {
        try {
          const resolvedResult = await resolveSearchResultDetails(result)
          const parsedVolumeNumber = extractVolumeNumber(resolvedResult.title)
          const volumeNumber =
            parsedVolumeNumber ?? getNextVolumeNumberForSeries()

          await createVolume(seriesId, {
            volume_number: volumeNumber,
            title: resolvedResult.title || null,
            isbn: resolvedResult.isbn || null,
            cover_image_url: resolvedResult.coverUrl || null,
            publish_date: resolvedResult.publishedDate || null,
            page_count: resolvedResult.pageCount ?? null,
            description: resolvedResult.description || null,
            ownership_status: options?.ownershipStatus ?? "owned",
            reading_status: "unread"
          })

          await autoFillSeriesFromVolume(
            targetSeries,
            volumeNumber,
            resolvedResult
          )

          bumpNextVolumeNumberForSeries(
            nextVolumeBySeries,
            seriesId,
            volumeNumber
          )
          successCount += 1
        } catch (error) {
          console.error("Error adding volume from search:", error)
          failureCount += 1
          if (options?.throwOnError) {
            throw error
          }
        }
      }

      return { successCount, failureCount }
    },
    [
      autoFillSeriesFromVolume,
      bumpNextVolumeNumberForSeries,
      createVolume,
      extractVolumeNumber,
      getNextVolumeNumber,
      resolveSearchResultDetails,
      series
    ]
  )

  const addVolumeFromSearchResult = useCallback(
    async (
      seriesId: string,
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      const { failureCount } = await addVolumesFromSearchResults(
        seriesId,
        [result],
        { ...options, throwOnError: true }
      )
      if (failureCount > 0) {
        throw new Error("Failed to add volume")
      }
    },
    [addVolumesFromSearchResults]
  )

  return {
    series,
    unassignedVolumes,
    filteredSeries,
    filteredVolumes: sortedVolumes,
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
    addBooksFromSearchResults,
    addVolumeFromSearchResult,
    addVolumesFromSearchResults
  }
}
