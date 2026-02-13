"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"
import { useLibraryStore } from "@/lib/store/library-store"
import {
  persistPriceEntry,
  checkPriceAlert
} from "@/lib/hooks/use-price-history"
import { fetchPrice } from "@/lib/api/endpoints"
import { buildFetchPriceParams } from "@/lib/books/amazon-query"
import type { FetchPriceParams } from "@/lib/api/types"
import { ApiClientError } from "@/lib/api/client"
import { useNotificationStore } from "@/lib/store/notification-store"

/** Scraping mode: price only, image only, or both. @source */
export type BulkScrapeMode = "price" | "image" | "both"

/** Status of a single volume scraping job. @source */
export type VolumeJobStatus =
  | "pending"
  | "scraping"
  | "done"
  | "failed"
  | "skipped"
  | "cancelled"

/** Tracks state and results for a single volume's scrape job. @source */
export interface VolumeJob {
  volumeId: string
  volumeNumber: number
  title: string
  seriesTitle?: string
  status: VolumeJobStatus
  errorMessage?: string
  priceResult?: number | null
  imageResult?: string | null
}

/** Aggregate counts for a bulk scrape run. @source */
export interface BulkScrapeSummary {
  total: number
  done: number
  failed: number
  skipped: number
  cancelled: number
}

/** Internal state for the bulk scrape hook. @source */
interface BulkScrapeState {
  jobs: VolumeJob[]
  isRunning: boolean
  currentIndex: number
  summary: BulkScrapeSummary
  cooldownMessage: string | null
}

/** Minimum inter-request delay in milliseconds. @source */
const MIN_DELAY_MS = 1000
/** Maximum inter-request delay in milliseconds. @source */
const MAX_DELAY_MS = 3000

/** Returns a random delay between `MIN_DELAY_MS` and `MAX_DELAY_MS`. @source */
const randomDelay = () =>
  Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)) + MIN_DELAY_MS

/**
 * Returns a promise that resolves after `ms` or rejects on abort.
 * @param ms - Delay in milliseconds.
 * @param signal - AbortSignal for cancellation.
 * @source
 */
const abortableDelay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }
    const id = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(id)
      reject(new DOMException("Aborted", "AbortError"))
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })

/**
 * Builds an aggregate summary from the current jobs array.
 * @param jobs - The array of volume jobs.
 * @returns A `BulkScrapeSummary` with counts by status.
 * @source
 */
const buildSummary = (jobs: VolumeJob[]): BulkScrapeSummary => {
  const summary: BulkScrapeSummary = {
    total: jobs.length,
    done: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0
  }
  for (const job of jobs) {
    if (job.status === "done") summary.done += 1
    else if (job.status === "failed") summary.failed += 1
    else if (job.status === "skipped") summary.skipped += 1
    else if (job.status === "cancelled") summary.cancelled += 1
  }
  return summary
}

/**
 * Determines whether a volume should be skipped based on existing data.
 * @param volume - The volume to check.
 * @param mode - The scrape mode.
 * @param skipExisting - Whether to skip volumes with existing data.
 * @source
 */
const shouldSkipVolume = (
  volume: Volume,
  mode: BulkScrapeMode,
  skipExisting: boolean
): boolean => {
  if (!skipExisting) return false
  const hasPrice =
    typeof volume.purchase_price === "number" && volume.purchase_price > 0
  const hasImage = Boolean(volume.cover_image_url?.trim())
  if (mode === "price") return hasPrice
  if (mode === "image") return hasImage
  return hasPrice && hasImage
}

/** Shape of the price API JSON response. @source */
interface AmazonResponseData {
  result?: {
    priceText?: string | null
    priceValue?: number | null
    priceError?: string | null
    priceBinding?: string | null
    imageUrl?: string | null
    url?: string | null
  }
  error?: string
  cooldownMs?: number
}

/** React state setter alias. @source */
type StateSetter = React.Dispatch<React.SetStateAction<BulkScrapeState>>

/** Initial empty summary. @source */
const EMPTY_SUMMARY: BulkScrapeSummary = {
  total: 0,
  done: 0,
  failed: 0,
  skipped: 0,
  cancelled: 0
}

/**
 * Patches a single job in state and recalculates the summary.
 * @param index - Job index to update.
 * @param patch - Partial job fields to merge.
 * @param setter - React state setter.
 * @source
 */
function updateJob(
  index: number,
  patch: Partial<VolumeJob>,
  setter: StateSetter
) {
  setter((prev) => {
    const nextJobs = [...prev.jobs]
    nextJobs[index] = { ...nextJobs[index], ...patch }
    return { ...prev, jobs: nextJobs, summary: buildSummary(nextJobs) }
  })
}

/**
 * Marks all pending jobs from `startIdx` onward as cancelled.
 * @param startIdx - First index to cancel.
 * @param setter - React state setter.
 * @source
 */
function cancelRemaining(startIdx: number, setter: StateSetter) {
  setter((prev) => {
    const nextJobs = prev.jobs.map((job, idx) => {
      if (idx >= startIdx && job.status === "pending") {
        return { ...job, status: "cancelled" as const }
      }
      return job
    })
    return {
      ...prev,
      jobs: nextJobs,
      isRunning: false,
      summary: buildSummary(nextJobs)
    }
  })
}

/**
 * Marks any remaining pending/scraping jobs as cancelled and stops the run.
 * @param setter - React state setter.
 * @source
 */
function finalize(setter: StateSetter): BulkScrapeSummary {
  let finalSummary = EMPTY_SUMMARY
  setter((prev) => {
    const nextJobs = prev.jobs.map((job) => {
      if (job.status === "pending" || job.status === "scraping") {
        return { ...job, status: "cancelled" as const }
      }
      return job
    })
    finalSummary = buildSummary(nextJobs)
    return {
      ...prev,
      jobs: nextJobs,
      isRunning: false,
      summary: finalSummary
    }
  })
  return finalSummary
}

/**
 * Builds a user-facing cooldown message from a rate-limited response.
 * @param data - The API response data.
 * @returns A human-readable cooldown message.
 * @source
 */
function buildCooldownMessage(data: AmazonResponseData): string {
  if (data.cooldownMs) {
    const minutes = Math.ceil(data.cooldownMs / 60_000)
    return `Amazon anti-bot detection triggered. Try again in ~${minutes} minute${minutes === 1 ? "" : "s"}.`
  }
  return data.error ?? "Amazon blocked the request. Try again later."
}

/**
 * Handles a 429 response by failing the job and cancelling remaining jobs.
 * @param i - Job index that was rate-limited.
 * @param data - The API response data.
 * @param setter - React state setter.
 * @source
 */
function handleRateLimit(
  i: number,
  data: AmazonResponseData,
  setter: StateSetter
) {
  updateJob(
    i,
    { status: "failed", errorMessage: data.error ?? "Rate limited" },
    setter
  )
  cancelRemaining(i + 1, setter)
  setter((prev) => ({
    ...prev,
    cooldownMessage: buildCooldownMessage(data)
  }))
}

/**
 * Extracts volume update fields from a successful price API response.
 * @param data - The API response data.
 * @param includePrice - Whether to extract price.
 * @param includeImage - Whether to extract image.
 * @returns Parsed updates, price/image results, and any price error.
 * @source
 */
function extractUpdates(
  data: AmazonResponseData,
  includePrice: boolean,
  includeImage: boolean
): {
  updates: Partial<Volume>
  priceResult: number | null
  imageResult: string | null
  priceError: string | null
} {
  const updates: Partial<Volume> = {}
  let priceResult: number | null = null
  let imageResult: string | null = null
  let priceError: string | null = null

  if (includePrice && data.result?.priceValue != null) {
    updates.purchase_price = data.result.priceValue
    priceResult = data.result.priceValue
  } else if (includePrice && data.result?.priceError) {
    priceError = data.result.priceError
  }
  if (includeImage && data.result?.imageUrl) {
    updates.cover_image_url = data.result.imageUrl
    imageResult = data.result.imageUrl
  }
  if (data.result?.url) {
    updates.amazon_url = data.result.url
  }
  return { updates, priceResult, imageResult, priceError }
}

/**
 * Waits between requests, swallowing abort errors.
 * @param signal - AbortSignal for cancellation.
 * @param isLast - Whether this is the last job (skip delay).
 * @returns `true` if the delay completed or was skipped.
 * @source
 */
async function interRequestDelay(
  signal: AbortSignal,
  isLast: boolean
): Promise<boolean> {
  if (isLast || signal.aborted) return true
  try {
    await abortableDelay(randomDelay(), signal)
    return true
  } catch {
    return false
  }
}

/** Shared context passed to each job processor. @source */
interface JobContext {
  jobs: VolumeJob[]
  series: SeriesWithVolumes
  amazonDomain: string
  preferKindle: boolean
  fallbackToKindle: boolean
  includePrice: boolean
  includeImage: boolean
  controller: AbortController
  editVolume: (
    seriesId: string | null,
    volumeId: string,
    data: Partial<Volume>
  ) => Promise<void>
  setter: StateSetter
}

/**
 * React hook for bulk-scraping price and/or cover image data for a series.
 * @param series - The series whose volumes will be scraped.
 * @param editVolume - Callback to persist volume updates.
 * @returns State, start/cancel/reset actions for the bulk scrape.
 * @source
 */
export function useBulkScrape(
  series: SeriesWithVolumes,
  editVolume: (
    seriesId: string | null,
    volumeId: string,
    data: Partial<Volume>
  ) => Promise<void>
) {
  const priceSource = useLibraryStore((s) => s.priceSource)
  const amazonDomain = useLibraryStore((s) => s.amazonDomain)
  const amazonPreferKindle = useLibraryStore((s) => s.amazonPreferKindle)
  const amazonFallbackToKindle = useLibraryStore(
    (s) => s.amazonFallbackToKindle
  )
  const abortRef = useRef<AbortController | null>(null)

  const [state, setState] = useState<BulkScrapeState>({
    jobs: [],
    isRunning: false,
    currentIndex: -1,
    summary: EMPTY_SUMMARY,
    cooldownMessage: null
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const start = useCallback(
    async (mode: BulkScrapeMode, skipExisting: boolean) => {
      if (priceSource !== "amazon") return

      const sortedVolumes = [...series.volumes].sort(
        (a, b) => a.volume_number - b.volume_number
      )

      const jobs: VolumeJob[] = sortedVolumes.map((vol) => ({
        volumeId: vol.id,
        volumeNumber: vol.volume_number,
        title: vol.title ?? "",
        seriesTitle:
          (vol as Volume & { _seriesTitle?: string })._seriesTitle ??
          series.title,
        status: shouldSkipVolume(vol, mode, skipExisting)
          ? "skipped"
          : "pending"
      }))

      const controller = new AbortController()
      abortRef.current = controller

      setState({
        jobs,
        isRunning: true,
        currentIndex: -1,
        summary: buildSummary(jobs),
        cooldownMessage: null
      })

      const includePrice = mode === "price" || mode === "both"
      const includeImage = mode === "image" || mode === "both"
      const fallbackToKindle = !amazonPreferKindle && amazonFallbackToKindle

      for (let i = 0; i < jobs.length; i++) {
        if (controller.signal.aborted) break
        if (jobs[i].status === "skipped") continue

        setState((prev) => ({ ...prev, currentIndex: i }))
        updateJob(i, { status: "scraping" }, setState)

        const ctx: JobContext = {
          jobs,
          series,
          amazonDomain,
          preferKindle: amazonPreferKindle,
          fallbackToKindle,
          includePrice,
          includeImage,
          controller,
          editVolume,
          setter: setState
        }

        const outcome = await processJob(i, ctx)

        if (outcome === "halt") return
        if (outcome === "abort") break
      }

      const summary = finalize(setState)

      useNotificationStore.getState().addNotification({
        type: "scrape_complete",
        title: "Bulk Scrape Complete",
        message: `Processed ${summary.total} volumes: ${summary.done} updated, ${summary.failed} failed.`
      })
    },
    [
      series,
      priceSource,
      amazonDomain,
      amazonPreferKindle,
      amazonFallbackToKindle,
      editVolume
    ]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    if (state.isRunning) return
    setState({
      jobs: [],
      isRunning: false,
      currentIndex: -1,
      summary: EMPTY_SUMMARY,
      cooldownMessage: null
    })
  }, [state.isRunning])

  return { ...state, start, cancel, reset }
}

/**
 * Builds `FetchPriceParams` for a single bulk-scrape job.
 * @returns The params, or `null` after marking the job as failed.
 * @source
 */
function buildJobParams(
  i: number,
  ctx: JobContext
): FetchPriceParams | null {
  const { jobs, series, amazonDomain, preferKindle, fallbackToKindle, includePrice, includeImage, setter } = ctx
  const result = buildFetchPriceParams({
    seriesTitle: jobs[i].seriesTitle ?? series.title,
    volumeTitle: jobs[i].title || undefined,
    volumeNumber: jobs[i].volumeNumber,
    seriesType: series.type,
    preferKindle,
    domain: amazonDomain,
    fallbackToKindle,
    includePrice: includePrice || undefined,
    includeImage: includeImage || undefined
  })
  if ("error" in result) {
    updateJob(i, { status: "failed", errorMessage: result.error }, setter)
    return null
  }
  return result.params
}

/**
 * Processes a single volume job: fetches data, saves updates, and handles errors.
 * @param i - Job index.
 * @param ctx - Shared job context.
 * @returns `"ok"` to continue, `"halt"` on rate-limit, or `"abort"` on cancellation.
 * @source
 */
async function processJob(
  i: number,
  ctx: JobContext
): Promise<"ok" | "halt" | "abort"> {
  const { jobs, controller, setter } = ctx
  const isLast = i >= jobs.length - 1

  const params = buildJobParams(i, ctx)
  if (!params) return "ok"

  try {
    const data = await fetchPrice(params, controller.signal)

    return await handleSuccess(i, data, isLast, ctx)
  } catch (error) {
    if (error instanceof ApiClientError) {
      const details = (error.details ?? {}) as AmazonResponseData

      // 429 → halt
      if (error.status === 429) {
        handleRateLimit(i, details, setter)
        return "halt"
      }

      // Other HTTP errors — non-fatal
      updateJob(
        i,
        {
          status: "failed",
          errorMessage: details.error ?? `HTTP ${error.status}`
        },
        setter
      )
      await interRequestDelay(controller.signal, isLast)
      return "ok"
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      updateJob(i, { status: "cancelled", errorMessage: "Cancelled" }, setter)
      return "abort"
    }

    updateJob(
      i,
      {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      },
      setter
    )
    const continued = await interRequestDelay(controller.signal, isLast)
    return continued ? "ok" : "abort"
  }
}

/**
 * Handles a successful API response by extracting updates and persisting them.
 * @param i - Job index.
 * @param data - The API response data.
 * @param isLast - Whether this is the last job.
 * @param ctx - Shared job context.
 * @returns `"ok"` to continue or `"abort"` on cancellation.
 * @source
 */
async function handleSuccess(
  i: number,
  data: AmazonResponseData,
  isLast: boolean,
  ctx: JobContext
): Promise<"ok" | "abort"> {
  const {
    jobs,
    series,
    includePrice,
    includeImage,
    controller,
    editVolume,
    setter
  } = ctx
  const { updates, priceResult, imageResult, priceError } = extractUpdates(
    data,
    includePrice,
    includeImage
  )

  if (Object.keys(updates).length > 0) {
    try {
      await editVolume(series.id, jobs[i].volumeId, updates)
    } catch {
      updateJob(i, { status: "failed", errorMessage: "Failed to save" }, setter)
      const continued = await interRequestDelay(controller.signal, isLast)
      return continued ? "ok" : "abort"
    }
  }

  if (priceResult != null) {
    try {
      await persistPriceEntry(jobs[i].volumeId, priceResult, "USD", "amazon")
      const triggered = await checkPriceAlert(jobs[i].volumeId, priceResult)
      if (triggered) {
        toast.info(
          `Price alert triggered! Vol. ${jobs[i].volumeNumber} dropped to $${priceResult.toFixed(2)}`
        )
      }
    } catch {
      // Price history / alert check is non-critical during bulk scrape
    }
  }

  updateJob(
    i,
    {
      status: "done",
      priceResult,
      imageResult,
      errorMessage: priceError ?? undefined
    },
    setter
  )
  const continued = await interRequestDelay(controller.signal, isLast)
  return continued ? "ok" : "abort"
}
