import type { FetchPriceParams } from "@/lib/api/types"

/** Supported Amazon binding labels for search queries. */
export const AMAZON_BINDING_LABELS = ["Paperback", "Kindle"] as const

/** Options for building an Amazon search URL. */
export interface AmazonSearchOptions {
  domain: string
  isbn?: string | null
  seriesTitle?: string | null
  volumeTitle?: string | null
  volumeNumber: number
  format?: string | null
  bindingLabel?: string | null
}

/**
 * Builds an Amazon search URL for a volume using ISBN or title+number tokens.
 * @param options - Volume metadata used to construct the search query.
 * @returns Fully-qualified Amazon search URL.
 */
export function buildAmazonSearchUrl(options: AmazonSearchOptions): string {
  const domain = options.domain?.trim() || "amazon.com"
  const isbn = options.isbn?.trim()
  if (isbn) {
    return `https://www.${domain}/s?k=${encodeURIComponent(isbn)}`
  }
  const tokens = [options.seriesTitle, options.volumeTitle]
    .map((value) => value?.trim())
    .filter(Boolean) as string[]
  if (Number.isFinite(options.volumeNumber)) {
    tokens.push(`Volume ${options.volumeNumber}`)
  }
  if (options.format?.trim()) tokens.push(options.format.trim())
  if (options.bindingLabel) tokens.push(options.bindingLabel)
  const query = tokens.join(" ").trim()
  return `https://www.${domain}/s?k=${encodeURIComponent(query)}`
}

/**
 * Maps a series type to a human-readable format hint for the price API.
 * @param seriesType - The series type string.
 * @returns A format hint like "Light Novel" or "Manga", or empty string.
 */
export function getFormatHint(seriesType: string): string {
  if (seriesType === "light_novel") return "Light Novel"
  if (seriesType === "manga") return "Manga"
  return ""
}

/** Options for building price query parameters. */
export interface PriceQueryOptions {
  seriesTitle?: string | null
  volumeTitle?: string | null
  volumeNumber: number | string
  seriesType?: string | null
  preferKindle?: boolean
}

/** Intermediate price query fields shared by search URL and fetch param builders. */
export interface PriceQueryResult {
  title: string
  volume: string
  format?: string
  binding: string
  volumeTitle?: string
}

/**
 * Builds the core query fields for the price API from series/volume metadata.
 * @param options - Series and volume metadata.
 * @returns `{ params }` with query fields, or `{ error }` when no title is available.
 */
export function buildPriceQuery(
  options: PriceQueryOptions
): { params: PriceQueryResult } | { error: string } {
  const seriesTitle =
    typeof options.seriesTitle === "string" ? options.seriesTitle.trim() : ""
  const volumeTitle =
    typeof options.volumeTitle === "string" ? options.volumeTitle.trim() : ""
  const queryTitle = seriesTitle || volumeTitle
  if (!queryTitle) {
    return {
      error: "Add a series title or volume title before fetching from Amazon."
    }
  }
  const formatHint = options.seriesType ? getFormatHint(options.seriesType) : ""
  const binding = options.preferKindle ? "Kindle" : "Paperback"

  const params: PriceQueryResult = {
    title: queryTitle,
    volume: String(options.volumeNumber),
    binding
  }
  if (formatHint) params.format = formatHint
  if (seriesTitle && volumeTitle) params.volumeTitle = volumeTitle

  return { params }
}

/** Options for building full {@link FetchPriceParams}. */
export interface FetchPriceParamsOptions extends PriceQueryOptions {
  domain: string
  fallbackToKindle?: boolean
  includePrice?: boolean
  includeImage?: boolean
  source?: string
}

/**
 * Builds full `FetchPriceParams` for the price endpoint.
 * @param options - Series/volume metadata plus domain and feature flags.
 * @returns `{ params }` ready for `fetchPrice`, or `{ error }` when no title is available.
 */
export function buildFetchPriceParams(
  options: FetchPriceParamsOptions
): { params: FetchPriceParams } | { error: string } {
  const queryResult = buildPriceQuery(options)
  if ("error" in queryResult) return queryResult

  const { title, volume, format, binding, volumeTitle } = queryResult.params

  return {
    params: {
      title,
      volume,
      volumeTitle,
      format,
      binding,
      domain: options.domain,
      includeImage: options.includeImage,
      includePrice: options.includePrice,
      fallbackToKindle: options.fallbackToKindle,
      source: options.source
    }
  }
}
