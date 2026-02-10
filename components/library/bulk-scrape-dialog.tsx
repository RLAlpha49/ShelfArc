"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import {
  useBulkScrape,
  type BulkScrapeMode,
  type VolumeJobStatus
} from "@/lib/hooks/use-bulk-scrape"
import { useLibraryStore } from "@/lib/store/library-store"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

interface BulkScrapeDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly series: SeriesWithVolumes
  readonly editVolume: (
    seriesId: string | null,
    volumeId: string,
    data: Partial<Volume>
  ) => Promise<void>
}

const STATUS_META: Record<
  VolumeJobStatus,
  { label: string; icon: "pending" | "spin" | "check" | "x" | "skip" | "dash" }
> = {
  pending: { label: "Waiting", icon: "pending" },
  scraping: { label: "Fetching…", icon: "spin" },
  done: { label: "Done", icon: "check" },
  failed: { label: "Failed", icon: "x" },
  skipped: { label: "Skipped", icon: "skip" },
  cancelled: { label: "Cancelled", icon: "dash" }
}

function StatusIcon({
  status,
  className = ""
}: {
  readonly status: VolumeJobStatus
  readonly className?: string
}) {
  const meta = STATUS_META[status]
  const base = `h-4 w-4 shrink-0 ${className}`

  switch (meta.icon) {
    case "spin":
      return (
        <svg className={`${base} animate-spin`} viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )
    case "check":
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )
    case "x":
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      )
    case "skip":
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 4 10 8-10 8V4z" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      )
    case "dash":
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )
    default:
      return (
        <span
          className={`${base} inline-block rounded-full border-2 border-current opacity-30`}
        />
      )
  }
}

const statusColor: Record<VolumeJobStatus, string> = {
  pending: "text-muted-foreground",
  scraping: "text-primary",
  done: "text-emerald-500",
  failed: "text-destructive",
  skipped: "text-muted-foreground/60",
  cancelled: "text-muted-foreground/40"
}

const jobRowBg = (status: VolumeJobStatus): string => {
  if (status === "scraping") return "bg-primary/5 border-primary/20"
  if (status === "done") return "bg-emerald-500/5"
  if (status === "failed") return "bg-destructive/5"
  return ""
}

const MODE_OPTIONS: {
  value: BulkScrapeMode
  label: string
  description: string
}[] = [
  {
    value: "both",
    label: "Price & Image",
    description: "Fetch both the cover image and price from Amazon"
  },
  {
    value: "price",
    label: "Price Only",
    description: "Only fetch the purchase price"
  },
  {
    value: "image",
    label: "Image Only",
    description: "Only fetch the cover image"
  }
]

export function BulkScrapeDialog({
  open,
  onOpenChange,
  series,
  editVolume
}: BulkScrapeDialogProps) {
  const [mode, setMode] = useState<BulkScrapeMode>("both")
  const [skipExisting, setSkipExisting] = useState(false)
  const showAmazonDisclaimer = useLibraryStore((s) => s.showAmazonDisclaimer)
  const setShowAmazonDisclaimer = useLibraryStore(
    (s) => s.setShowAmazonDisclaimer
  )

  const { jobs, isRunning, summary, cooldownMessage, start, cancel, reset } =
    useBulkScrape(series, editVolume)

  const hasStarted = jobs.length > 0
  const isFinished = hasStarted && !isRunning

  // Count how many would be skipped
  const skipCount = useMemo(() => {
    if (!skipExisting) return 0
    return series.volumes.filter((vol) => {
      const hasPrice =
        typeof vol.purchase_price === "number" && vol.purchase_price > 0
      const hasImage = Boolean(vol.cover_image_url?.trim())
      if (mode === "price") return hasPrice
      if (mode === "image") return hasImage
      return hasPrice && hasImage
    }).length
  }, [series.volumes, mode, skipExisting])

  const activeCount = series.volumes.length - skipCount

  // Progress percentage
  const progressPercent = useMemo(() => {
    if (summary.total === 0) return 0
    const completed = summary.done + summary.failed + summary.skipped
    return Math.round((completed / summary.total) * 100)
  }, [summary])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      reset()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = () => {
    void start(mode, skipExisting)
  }

  const handleCancel = () => {
    cancel()
  }

  const handleClose = () => {
    if (isRunning) {
      cancel()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl p-0">
        {/* Header */}
        <DialogHeader className="bg-warm/30 rounded-t-2xl border-b px-6 pt-6 pb-4">
          <DialogTitle className="font-display flex items-center gap-2.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary h-5 w-5"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Bulk Amazon Scrape
          </DialogTitle>
          <DialogDescription>
            Fetch Amazon data for all volumes in{" "}
            <span className="text-foreground font-medium">{series.title}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col overflow-hidden">
          {/* Configuration — only before starting */}
          {!hasStarted && (
            <div className="space-y-5 px-6 pt-5 pb-2">
              {/* Mode selector */}
              <fieldset className="glass-card space-y-3 rounded-2xl p-4">
                <legend className="text-muted-foreground px-1 text-xs tracking-widest uppercase">
                  Scrape Mode
                </legend>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as BulkScrapeMode)}
                  className="space-y-2"
                >
                  {MODE_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      className={`border-border/60 bg-card/70 hover:bg-accent/40 flex items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                        mode === opt.value ? "ring-primary/40 ring-2" : ""
                      }`}
                    >
                      <RadioGroupItem
                        value={opt.value}
                        id={`mode-${opt.value}`}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`mode-${opt.value}`}
                        className="flex-1 cursor-pointer"
                      >
                        <span className="font-display text-sm font-semibold">
                          {opt.label}
                        </span>
                        <p className="text-muted-foreground text-xs">
                          {opt.description}
                        </p>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </fieldset>

              {/* Options */}
              <fieldset className="glass-card space-y-3 rounded-2xl p-4">
                <legend className="text-muted-foreground px-1 text-xs tracking-widest uppercase">
                  Options
                </legend>
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="skip-existing"
                      className="cursor-pointer text-sm font-medium"
                    >
                      Skip volumes with existing data
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Don&apos;t overwrite data that&apos;s already set
                    </p>
                  </div>
                  <Switch
                    id="skip-existing"
                    checked={skipExisting}
                    onCheckedChange={setSkipExisting}
                  />
                </div>
              </fieldset>

              {/* Summary before starting */}
              <div className="bg-card/60 border-border/60 flex items-center justify-between rounded-xl border px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {series.volumes.length} volume
                    {series.volumes.length === 1 ? "" : "s"} total
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {activeCount} to scrape
                    {skipCount > 0 && ` · ${skipCount} will be skipped`}
                  </p>
                </div>
                <div className="text-muted-foreground text-xs">
                  ~{Math.ceil((activeCount * 4.5) / 60)} min estimated
                </div>
              </div>
            </div>
          )}

          {/* Progress bar — shown during/after run */}
          {hasStarted && (
            <div className="space-y-2 px-6 pt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {isRunning ? "Scraping..." : "Complete"}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {summary.done + summary.failed + summary.skipped} /{" "}
                  {summary.total}
                </span>
              </div>
              <div className="bg-primary/10 h-2.5 overflow-hidden rounded-full">
                <div
                  className="from-copper to-gold h-full rounded-full bg-linear-to-r transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                {summary.done > 0 && (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <StatusIcon status="done" className="h-3 w-3" />
                    {summary.done} done
                  </span>
                )}
                {summary.failed > 0 && (
                  <span className="text-destructive flex items-center gap-1">
                    <StatusIcon status="failed" className="h-3 w-3" />
                    {summary.failed} failed
                  </span>
                )}
                {summary.skipped > 0 && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <StatusIcon status="skipped" className="h-3 w-3" />
                    {summary.skipped} skipped
                  </span>
                )}
                {summary.cancelled > 0 && (
                  <span className="text-muted-foreground/60 flex items-center gap-1">
                    <StatusIcon status="cancelled" className="h-3 w-3" />
                    {summary.cancelled} cancelled
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Volume list */}
          {hasStarted && (
            <ScrollArea className="mt-3 max-h-[40vh] px-6">
              <div className="space-y-1 pb-4">
                {jobs.map((job) => (
                  <div
                    key={job.volumeId}
                    className={`border-border/40 flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${jobRowBg(job.status)}`}
                  >
                    {/* Status indicator */}
                    <div className={statusColor[job.status]}>
                      <StatusIcon status={job.status} />
                    </div>

                    {/* Volume info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xs font-semibold tabular-nums">
                          Vol. {job.volumeNumber}
                        </span>
                        {job.title && (
                          <span className="text-muted-foreground line-clamp-1 text-[11px]">
                            {job.title}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Result badges */}
                    <div className="flex shrink-0 items-center gap-2">
                      {job.status === "done" && job.priceResult != null && (
                        <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 tabular-nums">
                          ${job.priceResult.toFixed(2)}
                        </span>
                      )}
                      {job.status === "done" && job.imageResult && (
                        <span className="bg-primary/10 text-primary rounded-lg px-2 py-0.5 text-[10px] font-medium">
                          Image
                        </span>
                      )}
                      {job.status === "done" && job.errorMessage && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="bg-gold/15 text-gold cursor-help rounded-lg px-2 py-0.5 text-[10px] font-medium">
                                Price missing
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="text-xs">{job.errorMessage}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {job.status === "failed" && job.errorMessage && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="bg-destructive/10 text-destructive cursor-help rounded-lg px-2 py-0.5 text-[10px] font-medium">
                                Error
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="text-xs">{job.errorMessage}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {job.status === "scraping" && (
                        <span className="text-primary text-[10px] font-medium">
                          Fetching…
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Cooldown warning */}
          {cooldownMessage && (
            <div className="mx-6 mt-3 mb-1">
              <div className="border-destructive/30 bg-destructive/5 rounded-xl border px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-destructive mt-0.5 h-4 w-4 shrink-0"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                  <div className="space-y-1">
                    <p className="text-destructive text-xs font-semibold">
                      Anti-Scraping Detected
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {cooldownMessage}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Amazon disclaimer */}
          {hasStarted && showAmazonDisclaimer && (
            <div className="mx-6 mt-3 mb-1">
              <div className="border-gold/30 bg-gold/5 rounded-xl border px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gold mt-0.5 h-4 w-4 shrink-0"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                  <div className="space-y-1.5">
                    <p className="text-foreground text-xs font-semibold">
                      Amazon Data Disclaimer
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Cover images from Amazon are usually{" "}
                      <strong>much higher quality</strong> than other sources
                      but may be incorrect if the top search result doesn&apos;t
                      match. Prices are generally reliable. Some volumes may
                      fail if Amazon can&apos;t find a good match.
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Requests are automatically staggered with random delays to
                      minimize anti-scraping triggers.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setShowAmazonDisclaimer(false)}
                    >
                      Don&apos;t show again
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t px-6 py-4">
          {!hasStarted && (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
                onClick={handleStart}
                disabled={activeCount === 0}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1.5 h-4 w-4"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start Scraping
              </Button>
            </>
          )}

          {isRunning && (
            <Button
              type="button"
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl"
              onClick={handleCancel}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1.5 h-4 w-4"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              </svg>
              Cancel Scrape
            </Button>
          )}

          {isFinished && (
            <>
              <div className="text-muted-foreground flex-1 text-xs">
                {summary.done > 0 && `${summary.done} updated`}
                {summary.done > 0 && summary.failed > 0 && ", "}
                {summary.failed > 0 && `${summary.failed} failed`}
                {(summary.done > 0 || summary.failed > 0) &&
                  summary.skipped > 0 &&
                  ", "}
                {summary.skipped > 0 && `${summary.skipped} skipped`}
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={handleClose}
              >
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
