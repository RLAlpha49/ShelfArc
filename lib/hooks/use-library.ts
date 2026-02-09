"use client"

import { useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLibraryStore } from "@/lib/store/library-store"
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

type VolumeDateFields = {
  publish_date?: string | null
  purchase_date?: string | null
}

const VOLUME_TOKEN_PATTERN =
  /\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*(\d+(?:\.\d+)?)\b/i
const VOLUME_TOKEN_GLOBAL =
  /\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*\d+(?:\.\d+)?\b/gi
const VOLUME_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty"
]
const VOLUME_WORD_VALUE: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20
}
const VOLUME_WORD_PATTERN = new RegExp(
  String.raw`\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*(${VOLUME_WORDS.join(
    "|"
  )})\b`,
  "i"
)
const VOLUME_WORD_GLOBAL = new RegExp(
  String.raw`\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*(?:${VOLUME_WORDS.join(
    "|"
  )})\b`,
  "gi"
)
const TRAILING_VOLUME_PATTERN = /(?:\s+|[-–—:]\s*)(\d+(?:\.\d+)?)\s*$/i
const INLINE_VOLUME_PATTERN =
  /^(.*)(?:\s+|[-–—:,]\s*)(\d+(?:\.\d+)?)\s*(?=[(:])/i
const TRAILING_BRACKET_PATTERN = /\s*[[(]([^)\]]*?)[)\]]\s*$/
const EXTRA_DESCRIPTOR_PATTERN =
  /\b(omnibus|collector'?s|special|edition|deluxe|complete|box\s*set|boxset)\b/gi
const TRAILING_PUNCTUATION_PATTERN = /\s*[-–—:,;]\s*$/g
const FORMAT_SUFFIXES = [
  "light novel",
  "light novels",
  "graphic novel",
  "graphic novels",
  "comic book",
  "comic books",
  "comics",
  "comic",
  "manga",
  "manhwa",
  "manhua",
  "webtoon",
  "web comic",
  "webcomic",
  "novels",
  "novel"
]
const SERIES_DESCRIPTOR_SET = new Set([
  "comic",
  "comic book",
  "graphic novel",
  "manga",
  "manhwa",
  "manhua",
  "light novel",
  "novel",
  "webtoon",
  "web comic",
  "webcomic",
  "gn"
])

type VolumeSuffixInfo = {
  number: number
  prefix: string
  wordCount: number
}

const MAX_VOLUME_NUMBER = 200

const isLikelyYear = (value: number) => value >= 1900 && value <= 2100

const parseVolumeWord = (value: string) => {
  return VOLUME_WORD_VALUE[value.toLowerCase()] ?? null
}

const getTrailingVolumeInfo = (title: string): VolumeSuffixInfo | null => {
  const match = new RegExp(TRAILING_VOLUME_PATTERN).exec(title)
  if (!match) return null
  const number = Number.parseFloat(match[1])
  if (!Number.isFinite(number)) return null
  const prefix = title.slice(0, title.length - match[0].length).trim()
  if (!prefix) return null
  if (!/[A-Za-z]/.test(prefix)) return null
  const wordCount = prefix.split(/\s+/).filter(Boolean).length
  return { number, prefix, wordCount }
}

const getInlineVolumeInfo = (title: string): VolumeSuffixInfo | null => {
  const match = INLINE_VOLUME_PATTERN.exec(title)
  if (!match) return null
  const number = Number.parseFloat(match[2])
  if (!Number.isFinite(number)) return null
  const prefix = match[1].trim()
  if (!prefix) return null
  if (!/[A-Za-z]/.test(prefix)) return null
  const wordCount = prefix.split(/\s+/).filter(Boolean).length
  return { number, prefix, wordCount }
}

const shouldStripTrailingForTitle = (info: VolumeSuffixInfo) => {
  if (isLikelyYear(info.number)) return false
  if (info.number <= 3) return info.wordCount >= 2
  return info.number <= MAX_VOLUME_NUMBER && info.wordCount >= 2
}

const shouldStripTrailingForKey = (info: VolumeSuffixInfo) => {
  if (isLikelyYear(info.number)) return false
  return info.number <= MAX_VOLUME_NUMBER && info.wordCount >= 2
}

const stripInlineVolumeSuffixForTitle = (title: string) => {
  const info = getInlineVolumeInfo(title)
  if (info && shouldStripTrailingForTitle(info)) return info.prefix
  return title
}

const stripInlineVolumeSuffixForKey = (title: string) => {
  const info = getInlineVolumeInfo(title)
  if (info && shouldStripTrailingForKey(info)) return info.prefix
  return title
}

const stripTrailingVolumeSuffixForTitle = (title: string) => {
  const info = getTrailingVolumeInfo(title)
  if (info && shouldStripTrailingForTitle(info)) return info.prefix
  return title
}

const stripTrailingVolumeSuffixForKey = (title: string) => {
  const info = getTrailingVolumeInfo(title)
  if (info && shouldStripTrailingForKey(info)) return info.prefix
  return title
}

const stripTrailingFormatSuffix = (title: string) => {
  let next = title
  while (true) {
    const trimmed = next.trim().replaceAll(TRAILING_PUNCTUATION_PATTERN, "")
    const normalized = normalizeDescriptor(trimmed)
    let updated = trimmed

    for (const suffix of FORMAT_SUFFIXES) {
      if (!normalized.endsWith(suffix)) continue
      const suffixPattern = suffix.replaceAll(/\s+/g, String.raw`\s+`)
      const pattern = new RegExp(String.raw`\s*${suffixPattern}\s*$`, "gi")
      updated = trimmed.replaceAll(pattern, "").trim()
      break
    }

    if (updated === trimmed) return trimmed
    next = updated
  }
}

const normalizeDescriptor = (value: string) => {
  return value.trim().toLowerCase().replaceAll(/\s+/g, " ")
}

const shouldStripBracketDescriptor = (descriptor: string) => {
  const normalized = normalizeDescriptor(descriptor)
  if (!normalized) return false
  if (SERIES_DESCRIPTOR_SET.has(normalized)) return true
  if (FORMAT_SUFFIXES.some((suffix) => normalized.includes(suffix))) return true
  if (VOLUME_TOKEN_PATTERN.test(normalized)) return true
  if (VOLUME_WORD_PATTERN.test(normalized)) return true
  if (/\b#\s*\d+(?:\s*-\s*\d+)?\b/.test(normalized)) return true
  if (/^\d+(?:\s*-\s*\d+)?$/.test(normalized)) return true
  return false
}

const stripTrailingSeriesDescriptor = (title: string) => {
  let next = title
  while (true) {
    const trimmed = next.trim()
    const match = TRAILING_BRACKET_PATTERN.exec(trimmed)
    if (!match) return trimmed
    if (!shouldStripBracketDescriptor(match[1])) return trimmed
    next = trimmed.slice(0, trimmed.length - match[0].length)
  }
}

const hasVolumeIndicator = (value: string) => {
  if (VOLUME_TOKEN_PATTERN.test(value)) return true
  if (VOLUME_WORD_PATTERN.test(value)) return true
  if (/\b#\s*\d+\b/.test(value)) return true
  const inlineInfo = getInlineVolumeInfo(value)
  if (inlineInfo && shouldStripTrailingForKey(inlineInfo)) return true
  const trailingInfo = getTrailingVolumeInfo(value)
  if (trailingInfo && shouldStripTrailingForKey(trailingInfo)) return true
  return false
}

const stripSubtitleAfterVolumeIndicator = (title: string) => {
  const delimiterMatch = /[:–—-]\s/.exec(title)
  if (!delimiterMatch) return title
  const head = title.slice(0, delimiterMatch.index).trim()
  if (!head || !hasVolumeIndicator(head)) return title
  return head
}

const extractTrailingVolumeNumber = (title: string) => {
  const info = getTrailingVolumeInfo(title)
  if (info && shouldStripTrailingForTitle(info)) return info.number
  return null
}

const normalizeDateInput = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`
  return trimmed
}

const normalizeVolumeDates = <T extends VolumeDateFields>(data: T) => {
  const next = { ...data }
  if (data.publish_date === undefined) {
    // no-op
  } else {
    next.publish_date = normalizeDateInput(data.publish_date)
  }
  if (data.purchase_date === undefined) {
    // no-op
  } else {
    next.purchase_date = normalizeDateInput(data.purchase_date)
  }
  return next
}

export interface VolumeWithSeries {
  volume: Volume
  series: SeriesWithVolumes
}

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
    return (value ?? "")
      .normalize("NFKD")
      .replaceAll(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replaceAll(/\s+/g, " ")
  }, [])

  const normalizeAuthorKey = useCallback(
    (value?: string | null) => {
      const base = normalizeText(value ?? "")
      return base.replaceAll(/[^\p{L}\p{N}]+/gu, "")
    },
    [normalizeText]
  )

  const normalizeSeriesTitle = useCallback(
    (value: string) => {
      const withoutSubtitle = stripSubtitleAfterVolumeIndicator(value)
      const withoutVolumeTokens = withoutSubtitle
        .replaceAll(VOLUME_TOKEN_GLOBAL, " ")
        .replaceAll(VOLUME_WORD_GLOBAL, " ")
      const withoutInline = stripInlineVolumeSuffixForKey(withoutVolumeTokens)
      const withoutTrailing = stripTrailingVolumeSuffixForKey(withoutInline)
      const base = normalizeText(stripTrailingFormatSuffix(withoutTrailing))
      return base
        .replaceAll(/\(.*?\)/g, " ")
        .replaceAll(VOLUME_TOKEN_GLOBAL, " ")
        .replaceAll(VOLUME_WORD_GLOBAL, " ")
        .replaceAll(EXTRA_DESCRIPTOR_PATTERN, " ")
        .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
        .replaceAll(/\s+/g, " ")
        .trim()
    },
    [normalizeText]
  )

  const extractVolumeNumber = useCallback((title?: string | null) => {
    if (!title) return null
    const match = new RegExp(VOLUME_TOKEN_PATTERN).exec(title)
    if (match) {
      const parsed = Number.parseFloat(match[1])
      return Number.isFinite(parsed) ? parsed : null
    }
    const wordMatch = new RegExp(VOLUME_WORD_PATTERN).exec(title)
    if (wordMatch) {
      const parsed = parseVolumeWord(wordMatch[1])
      if (parsed !== null) return parsed
    }
    const inlineInfo = getInlineVolumeInfo(title)
    if (inlineInfo && shouldStripTrailingForTitle(inlineInfo)) {
      return inlineInfo.number
    }
    return extractTrailingVolumeNumber(title)
  }, [])

  const stripVolumeFromTitle = useCallback((title: string) => {
    const withoutSubtitle = stripSubtitleAfterVolumeIndicator(title)
    const withoutVolumeTokens = withoutSubtitle
      .replaceAll(VOLUME_TOKEN_GLOBAL, " ")
      .replaceAll(VOLUME_WORD_GLOBAL, " ")
    const withoutInline = stripInlineVolumeSuffixForTitle(withoutVolumeTokens)
    const withoutTrailing = stripTrailingVolumeSuffixForTitle(withoutInline)
    const withoutDescriptor = stripTrailingSeriesDescriptor(withoutTrailing)
    const withoutExtras = withoutDescriptor.replaceAll(
      EXTRA_DESCRIPTOR_PATTERN,
      " "
    )
    const withoutPunctuation = withoutExtras.replaceAll(
      TRAILING_PUNCTUATION_PATTERN,
      ""
    )
    const withoutFormatSuffix = stripTrailingFormatSuffix(withoutPunctuation)
    const trimmed = withoutFormatSuffix.replaceAll(/\s+/g, " ").trim()
    return trimmed || title.trim()
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
        .select("*")
        .eq("user_id", user.id)
        .order(sortField, { ascending: sortOrder === "asc" })

      if (seriesError) throw seriesError

      // Fetch volumes for all series
      const { data: volumesData, error: volumesError } = await supabase
        .from("volumes")
        .select("*")
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newSeries, error } = await (supabase as any)
          .from("series")
          .insert({ ...data, user_id: user.id })
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("series")
          .update(data)
          .eq("id", id)
          .eq("user_id", user.id)

        if (error) throw error

        updateSeries(id, data)
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

        const payload = {
          ...normalizeVolumeDates(data),
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
    [supabase, addVolume, addUnassignedVolume, updateSeriesCoverFromVolume]
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
        const updatePayload = {
          ...normalizeVolumeDates(data),
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
