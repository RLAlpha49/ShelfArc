"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"
import { useLibraryStore } from "@/lib/store/library-store"

export type BulkScrapeMode = "price" | "image" | "both"

export type VolumeJobStatus =
  | "pending"
  | "scraping"
  | "done"
  | "failed"
  | "skipped"
  | "cancelled"

export interface VolumeJob {
  volumeId: string
  volumeNumber: number
  title: string
  status: VolumeJobStatus
  errorMessage?: string
  priceResult?: number | null
  imageResult?: string | null
}

export interface BulkScrapeSummary {
  total: number
  done: number
  failed: number
  skipped: number
  cancelled: number
}

interface BulkScrapeState {
  jobs: VolumeJob[]
  isRunning: boolean
  currentIndex: number
  summary: BulkScrapeSummary
  cooldownMessage: string | null
}

const MIN_DELAY_MS = 2000
const MAX_DELAY_MS = 5000

const randomDelay = () =>
  Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)) + MIN_DELAY_MS

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

const getFormatHint = (seriesType: string): string => {
  if (seriesType === "light_novel") return "Light Novel"
  if (seriesType === "manga") return "Manga"
  return ""
}

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

interface AmazonResponseData {
  result?: {
    priceText?: string
    priceValue?: number
    imageUrl?: string | null
  }
  error?: string
  cooldownMs?: number
}

type StateSetter = React.Dispatch<React.SetStateAction<BulkScrapeState>>

const EMPTY_SUMMARY: BulkScrapeSummary = {
  total: 0,
  done: 0,
  failed: 0,
  skipped: 0,
  cancelled: 0
}

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

function finalize(setter: StateSetter) {
  setter((prev) => {
    const nextJobs = prev.jobs.map((job) => {
      if (job.status === "pending" || job.status === "scraping") {
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

function buildFetchUrl(
  seriesTitle: string,
  volumeNumber: number,
  formatHint: string,
  domain: string,
  includePrice: boolean,
  includeImage: boolean
): string {
  const params = new URLSearchParams()
  params.set("title", seriesTitle)
  params.set("volume", String(volumeNumber))
  if (formatHint) params.set("format", formatHint)
  params.set("binding", "Paperback")
  params.set("domain", domain)
  if (includeImage) params.set("includeImage", "true")
  if (!includePrice) params.set("includePrice", "false")
  return `/api/books/price?${params}`
}

function buildCooldownMessage(data: AmazonResponseData): string {
  if (data.cooldownMs) {
    const minutes = Math.ceil(data.cooldownMs / 60_000)
    return `Amazon anti-bot detection triggered. Try again in ~${minutes} minute${minutes === 1 ? "" : "s"}.`
  }
  return data.error ?? "Amazon blocked the request. Try again later."
}

/** Handle a 429 response — marks fail + cancels remaining. Returns true. */
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

/** Extract volume updates from a successful response. */
function extractUpdates(
  data: AmazonResponseData,
  includePrice: boolean,
  includeImage: boolean
): {
  updates: Partial<Volume>
  priceResult: number | null
  imageResult: string | null
} {
  const updates: Partial<Volume> = {}
  let priceResult: number | null = null
  let imageResult: string | null = null

  if (includePrice && data.result?.priceValue != null) {
    updates.purchase_price = data.result.priceValue
    priceResult = data.result.priceValue
  }
  if (includeImage && data.result?.imageUrl) {
    updates.cover_image_url = data.result.imageUrl
    imageResult = data.result.imageUrl
  }
  return { updates, priceResult, imageResult }
}

/** Wait between requests, swallowing abort errors. */
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

interface JobContext {
  jobs: VolumeJob[]
  series: SeriesWithVolumes
  formatHint: string
  amazonDomain: string
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

      const formatHint = getFormatHint(series.type)
      const includePrice = mode === "price" || mode === "both"
      const includeImage = mode === "image" || mode === "both"

      for (let i = 0; i < jobs.length; i++) {
        if (controller.signal.aborted) break
        if (jobs[i].status === "skipped") continue

        setState((prev) => ({ ...prev, currentIndex: i }))
        updateJob(i, { status: "scraping" }, setState)

        const ctx: JobContext = {
          jobs,
          series,
          formatHint,
          amazonDomain,
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

      finalize(setState)
    },
    [series, priceSource, amazonDomain, editVolume]
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

async function processJob(
  i: number,
  ctx: JobContext
): Promise<"ok" | "halt" | "abort"> {
  const {
    jobs,
    series,
    formatHint,
    amazonDomain,
    includePrice,
    includeImage,
    controller,
    setter
  } = ctx
  const isLast = i >= jobs.length - 1
  const url = buildFetchUrl(
    series.title,
    jobs[i].volumeNumber,
    formatHint,
    amazonDomain,
    includePrice,
    includeImage
  )

  try {
    const response = await fetch(url, { signal: controller.signal })
    const data = (await response.json()) as AmazonResponseData

    if (response.ok) {
      return await handleSuccess(i, data, isLast, ctx)
    }

    // 429 → halt
    if (response.status === 429) {
      handleRateLimit(i, data, setter)
      return "halt"
    }

    // Other HTTP errors — non-fatal
    updateJob(
      i,
      {
        status: "failed",
        errorMessage: data.error ?? `HTTP ${response.status}`
      },
      setter
    )
    await interRequestDelay(controller.signal, isLast)
    return "ok"
  } catch (error) {
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
  const { updates, priceResult, imageResult } = extractUpdates(
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

  updateJob(i, { status: "done", priceResult, imageResult }, setter)
  const continued = await interRequestDelay(controller.signal, isLast)
  return continued ? "ok" : "abort"
}
