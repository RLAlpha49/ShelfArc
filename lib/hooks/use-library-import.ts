"use client"

import { useCallback } from "react"
import { useLibraryStore } from "@/lib/store/library-store"
import { useLibraryMutations } from "./use-library-mutations"
import type { BookSearchResult } from "@/lib/books/search"
import { fetchBookVolume } from "@/lib/api/endpoints"
import type {
  SeriesWithVolumes,
  TitleType,
  OwnershipStatus
} from "@/lib/types/database"
import {
  extractVolumeNumberFromTitle,
  normalizeAuthorKey as normalizeAuthorKeyValue,
  normalizeLibraryText,
  normalizeSeriesTitle as normalizeSeriesTitleValue,
  stripVolumeFromTitle as stripVolumeFromTitleValue
} from "@/lib/library/volume-normalization"
import { createClient } from "@/lib/supabase/client"
import { recordActivityEvent } from "@/lib/activity/record-event"

export function useLibraryImport() {
  const {
    createSeries,
    createVolume,
    autoFillSeriesFromVolume,
    updateSeriesAuthorIfMissing,
    updateSeriesTypeIfMissing
  } = useLibraryMutations()

  const series = useLibraryStore((s) => s.series)

  const fetchGoogleVolumeDetails = useCallback(async (volumeId: string) => {
    const { data } = await fetchBookVolume(volumeId)
    return data
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

      const importSupabase = createClient()
      const {
        data: { user }
      } = await importSupabase.auth.getUser()
      if (user) {
        void recordActivityEvent(importSupabase, {
          userId: user.id,
          eventType: "import_completed",
          entityType: "series",
          entityId: lastSeries.id,
          metadata: {
            seriesTitle: lastSeries.title,
            volumesAdded: 1
          }
        })
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

      const importSupabase = createClient()
      const {
        data: { user }
      } = await importSupabase.auth.getUser()
      if (user) {
        void recordActivityEvent(importSupabase, {
          userId: user.id,
          eventType: "import_completed",
          entityType: "series",
          entityId: seriesId,
          metadata: {
            volumesAdded: 1
          }
        })
      }
    },
    [addVolumesFromSearchResults]
  )

  return {
    addBookFromSearchResult,
    addBooksFromSearchResults,
    addVolumeFromSearchResult,
    addVolumesFromSearchResults
  }
}
