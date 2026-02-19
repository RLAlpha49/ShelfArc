"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { EmptyState } from "@/components/empty-state"
import { ErrorBoundary } from "@/components/error-boundary"
import { CoverImage } from "@/components/library/cover-image"
import { ExternalLinks } from "@/components/library/external-links"
import { PriceHistoryCard } from "@/components/library/price-history-card"
import { VolumeDialog } from "@/components/library/volume-dialog"
import { announce } from "@/components/live-announcer"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/format-date"
import { useLibrary } from "@/lib/hooks/use-library"
import { ownershipColors, readingColors } from "@/lib/library/status-colors"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
import { sanitizeHtml } from "@/lib/sanitize-html"
import {
  DEFAULT_CURRENCY_CODE,
  useLibraryStore
} from "@/lib/store/library-store"
import { useRecentlyVisitedStore } from "@/lib/store/recently-visited-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type {
  OwnershipStatus,
  ReadingStatus,
  Volume,
  VolumeInsert
} from "@/lib/types/database"

/**
 * Converts a snake_case reading status to a capitalized label.
 * @param status - The raw reading status string.
 * @returns A human-readable label.
 * @source
 */
const formatReadingStatus = (status: string) => {
  const normalized = status.replaceAll("_", " ")
  if (!normalized) return normalized
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

/** Props for the volume stats strip component. @source */
type VolumeStatsStripProps = {
  readonly volume: Volume
  readonly readingProgress: { current: number; total: number; percent: number }
  readonly priceFormatter: Intl.NumberFormat
  readonly publishedLabel: string
  readonly purchaseDateLabel: string
}

/** Grid of volume metrics displayed below the header. @source */
const VolumeStatsStrip = ({
  volume,
  readingProgress,
  priceFormatter,
  publishedLabel,
  purchaseDateLabel
}: VolumeStatsStripProps) => (
  <div className="animate-fade-in-up grid-stagger mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-4">
    <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Progress
      </span>
      <div className="font-display text-xl font-bold">
        {readingProgress.total > 0 ? (
          <>
            {readingProgress.current}
            <span className="text-muted-foreground text-sm font-normal">
              /{readingProgress.total}
            </span>
          </>
        ) : (
          "—"
        )}
      </div>
      {readingProgress.total > 0 && (
        <>
          <div className="text-muted-foreground text-[10px]">
            {readingProgress.percent}% read
          </div>
          <div className="bg-primary/10 mx-auto mt-1 h-1.5 w-full max-w-16 overflow-hidden rounded-full">
            <div
              className="progress-animate from-copper to-gold h-full rounded-full bg-linear-to-r"
              style={
                {
                  "--target-width": `${readingProgress.percent}%`
                } as React.CSSProperties
              }
            />
          </div>
        </>
      )}
      {readingProgress.total === 0 && (
        <div className="text-muted-foreground text-[10px]">pages</div>
      )}
    </div>
    <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Rating
      </span>
      <div className="font-display text-xl font-bold">
        {volume.rating !== null && volume.rating !== undefined ? (
          <>
            {volume.rating}
            <span className="text-muted-foreground text-sm font-normal">
              /10
            </span>
          </>
        ) : (
          "—"
        )}
      </div>
      <div className="text-muted-foreground text-[10px]">
        {volume.rating !== null && volume.rating !== undefined
          ? "rating"
          : "not rated"}
      </div>
    </div>
    <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Format
      </span>
      <div className="font-display text-xl font-bold">
        {volume.format ?? "—"}
      </div>
      <div className="text-muted-foreground text-[10px]">type</div>
    </div>
    <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Edition
      </span>
      <div className="font-display text-xl font-bold">
        {volume.edition ?? "—"}
      </div>
      <div className="text-muted-foreground text-[10px]">release</div>
    </div>
    <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Price
      </span>
      <div className="font-display text-xl font-bold">
        {volume.purchase_price !== null && volume.purchase_price !== undefined
          ? priceFormatter.format(volume.purchase_price)
          : "—"}
      </div>
      <div className="text-muted-foreground text-[10px]">purchase</div>
    </div>
    <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Purchased
      </span>
      <div className="font-display text-lg font-bold">
        {purchaseDateLabel || "—"}
      </div>
      <div className="text-muted-foreground text-[10px]">date</div>
    </div>
    <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Published
      </span>
      <div className="font-display text-lg font-bold">
        {publishedLabel || "—"}
      </div>
      <div className="text-muted-foreground text-[10px]">date</div>
    </div>
    <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        ISBN
      </span>
      <div className="font-display text-sm font-bold break-all">
        {volume.isbn ?? "—"}
      </div>
      <div className="text-muted-foreground text-[10px]">identifier</div>
    </div>
  </div>
)

/**
 * Volume detail page displaying cover, metadata, description, and editing controls.
 * @source
 */
export default function VolumeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const volumeId = params.id as string

  const {
    series,
    unassignedVolumes,
    fetchSeries,
    editVolume,
    removeVolume,
    isLoading
  } = useLibrary()

  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false)
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [ctaLoading, setCtaLoading] = useState<"read" | "wishlist" | null>(null)
  const [progressInput, setProgressInput] = useState<string>("")
  const [isSavingProgress, setIsSavingProgress] = useState(false)
  const priceDisplayCurrency = useLibraryStore(
    (state) => state.priceDisplayCurrency
  )
  const dateFormat = useSettingsStore((state) => state.dateFormat)

  useEffect(() => {
    if (series.length === 0 && unassignedVolumes.length === 0) {
      fetchSeries()
    }
  }, [series.length, unassignedVolumes.length, fetchSeries])

  const volumeEntry = useMemo(() => {
    for (const seriesItem of series) {
      const volume = seriesItem.volumes.find((item) => item.id === volumeId)
      if (volume) return { volume, series: seriesItem }
    }
    const unassigned = unassignedVolumes.find((item) => item.id === volumeId)
    if (unassigned) return { volume: unassigned, series: null }
    return null
  }, [series, unassignedVolumes, volumeId])

  const currentVolume = volumeEntry?.volume ?? null
  const currentSeries = volumeEntry?.series ?? null

  const siblingVolumes = useMemo(() => {
    if (!currentSeries) return []
    return currentSeries.volumes.toSorted(
      (a, b) => a.volume_number - b.volume_number
    )
  }, [currentSeries])

  const siblingIndex = useMemo(
    () => siblingVolumes.findIndex((v) => v.id === volumeId),
    [siblingVolumes, volumeId]
  )

  const prevVolume = siblingIndex > 0 ? siblingVolumes[siblingIndex - 1] : null
  const nextVolume =
    siblingIndex >= 0 && siblingIndex < siblingVolumes.length - 1
      ? siblingVolumes[siblingIndex + 1]
      : null

  const recordVisit = useRecentlyVisitedStore((s) => s.recordVisit)
  useEffect(() => {
    if (currentVolume) {
      recordVisit({
        id: currentVolume.id,
        title:
          currentVolume.title?.trim() || `Vol. ${currentVolume.volume_number}`,
        type: "volume"
      })
    }
    // Only record when the volume id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVolume?.id, recordVisit])

  useEffect(() => {
    setProgressInput(
      currentVolume?.current_page == null
        ? ""
        : String(currentVolume.current_page)
    )
  }, [currentVolume?.current_page])

  const handleEditVolume = async (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => {
    if (!currentVolume) return
    const currentSeriesId = currentVolume.series_id ?? null
    const nextSeriesId = selectedSeriesId ?? null

    try {
      await editVolume(currentSeriesId, currentVolume.id, {
        ...data,
        series_id: nextSeriesId
      })
      toast.success("Volume updated successfully")
      setEditingVolume(null)
    } catch (error) {
      console.error(error)
      toast.error("Failed to update volume")
    }
  }

  const handleDeleteVolume = async () => {
    if (!currentVolume || isDeleting) return
    setIsDeleting(true)
    try {
      await removeVolume(currentVolume.series_id ?? null, currentVolume.id)
      toast.success("Volume deleted successfully")
      announce("Volume deleted", "assertive")
      setDeleteDialogOpen(false)
      router.push("/library")
    } catch (error) {
      console.error(error)
      toast.error("Failed to delete volume")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleReadStatus = useCallback(async () => {
    if (!currentVolume || ctaLoading) return
    const nextStatus: ReadingStatus =
      currentVolume.reading_status === "completed" ? "unread" : "completed"
    setCtaLoading("read")
    try {
      await editVolume(currentVolume.series_id ?? null, currentVolume.id, {
        reading_status: nextStatus
      })
    } finally {
      setCtaLoading(null)
    }
  }, [currentVolume, ctaLoading, editVolume])

  const handleToggleWishlist = useCallback(async () => {
    if (!currentVolume || ctaLoading) return
    const nextOwnership: OwnershipStatus =
      currentVolume.ownership_status === "wishlist" ? "owned" : "wishlist"
    setCtaLoading("wishlist")
    try {
      await editVolume(currentVolume.series_id ?? null, currentVolume.id, {
        ownership_status: nextOwnership
      })
    } finally {
      setCtaLoading(null)
    }
  }, [currentVolume, ctaLoading, editVolume])

  const openEditDialog = useCallback(() => {
    if (!currentVolume) return
    setEditingVolume(currentVolume)
    setVolumeDialogOpen(true)
    setSelectedSeriesId(currentVolume.series_id ?? null)
  }, [currentVolume])

  const handleSaveProgress = useCallback(async () => {
    if (!currentVolume) return
    const parsed = Number.parseInt(progressInput, 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Enter a valid page number")
      return
    }
    if (currentVolume.page_count != null && parsed > currentVolume.page_count) {
      toast.error(
        `Page number cannot exceed total pages (${currentVolume.page_count})`
      )
      return
    }
    setIsSavingProgress(true)
    try {
      await editVolume(currentVolume.series_id ?? null, currentVolume.id, {
        current_page: parsed
      })
      toast.success("Progress updated")
    } catch {
      toast.error("Failed to update progress")
    } finally {
      setIsSavingProgress(false)
    }
  }, [currentVolume, progressInput, editVolume])

  const priceFormatter = useMemo(() => {
    const currency = priceDisplayCurrency ?? DEFAULT_CURRENCY_CODE
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency
      })
    } catch {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: DEFAULT_CURRENCY_CODE
      })
    }
  }, [priceDisplayCurrency])

  const descriptionHtml = useMemo(
    () => sanitizeHtml(currentVolume?.description ?? "").trim(),
    [currentVolume?.description]
  )

  const readingProgress = useMemo(() => {
    if (!currentVolume) return { current: 0, total: 0, percent: 0 }
    const current = currentVolume.current_page ?? 0
    const total = currentVolume.page_count ?? 0
    if (total === 0) return { current, total, percent: 0 }
    const percent = Math.round((current / total) * 100)
    return { current, total, percent }
  }, [currentVolume])

  if (isLoading && !currentVolume) {
    return (
      <div className="relative px-6 py-8 lg:px-10">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Skeleton className="aspect-2/3 w-full rounded-lg" />
          </div>
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!currentVolume) {
    return (
      <div className="relative px-6 py-8 lg:px-10">
        <EmptyState
          title="Volume not found"
          description="The volume you're looking for doesn't exist or has been deleted."
          actions={[
            {
              label: "Back to Library",
              onClick: () => router.push("/library")
            }
          ]}
        />
      </div>
    )
  }

  const normalizedTitle = currentVolume.title
    ? normalizeVolumeTitle(currentVolume.title)
    : null
  const heading = normalizedTitle
    ? `Vol. ${currentVolume.volume_number} — ${normalizedTitle}`
    : `Volume ${currentVolume.volume_number}`
  const breadcrumbLabel = currentSeries
    ? `Volume ${currentVolume.volume_number}`
    : `${normalizedTitle} (Vol. ${currentVolume.volume_number})`

  const publishedLabel = formatDate(currentVolume.publish_date, dateFormat)
  const purchaseDateLabel = formatDate(currentVolume.purchase_date, dateFormat)
  const startedLabel = formatDate(currentVolume.started_at, dateFormat)
  const finishedLabel = formatDate(currentVolume.finished_at, dateFormat)
  const addedLabel = formatDate(currentVolume.created_at, dateFormat)
  const updatedLabel = formatDate(currentVolume.updated_at, dateFormat)

  const detailItems = [
    {
      label: "Series",
      value: currentSeries ? (
        <Link
          href={`/library/series/${currentSeries.id}`}
          className="text-foreground hover:text-primary"
        >
          {currentSeries.title}
        </Link>
      ) : (
        "Unassigned"
      ),
      show: true
    },
    {
      label: "Pages",
      value: currentVolume.page_count?.toLocaleString() ?? "—",
      show: true
    },
    {
      label: "Started",
      value: startedLabel || "—",
      show: Boolean(startedLabel)
    },
    {
      label: "Finished",
      value: finishedLabel || "—",
      show: Boolean(finishedLabel)
    },
    {
      label: "Amazon",
      value: currentVolume.amazon_url ? (
        <a
          href={currentVolume.amazon_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:text-primary"
        >
          View ↗
        </a>
      ) : null,
      show: Boolean(currentVolume.amazon_url)
    },
    { label: "Added", value: addedLabel || "—", show: true },
    { label: "Updated", value: updatedLabel || "—", show: true }
  ]

  return (
    <div className="relative px-6 py-8 lg:px-10">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_30%_20%,var(--warm-glow-strong),transparent_70%)]" />

      <Breadcrumbs
        items={[
          { label: "Library", href: "/library" },
          ...(currentSeries
            ? [
                {
                  label: currentSeries.title,
                  href: `/library/series/${currentSeries.id}`
                }
              ]
            : []),
          { label: breadcrumbLabel }
        ]}
      />

      {currentSeries && siblingVolumes.length > 1 && (
        <nav
          aria-label="Volume navigation"
          className="mb-4 flex items-center gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={!prevVolume}
            onClick={() =>
              prevVolume && router.push(`/library/volume/${prevVolume.id}`)
            }
            aria-label={
              prevVolume
                ? `Go to Volume ${prevVolume.volume_number}`
                : "Already at first volume"
            }
            className="rounded-xl"
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
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            {prevVolume ? `Vol. ${prevVolume.volume_number}` : "First Volume"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextVolume}
            onClick={() =>
              nextVolume && router.push(`/library/volume/${nextVolume.id}`)
            }
            aria-label={
              nextVolume
                ? `Go to Volume ${nextVolume.volume_number}`
                : "Already at last volume"
            }
            className="rounded-xl"
          >
            {nextVolume ? `Vol. ${nextVolume.volume_number}` : "Last Volume"}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-1.5 h-4 w-4"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Button>
        </nav>
      )}

      {/* Series-style header + content */}
      <div className="relative mb-10">
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_30%_50%,var(--warm-glow-strong),transparent_70%)]" />
        <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Cover */}
          <div className="lg:col-span-4">
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,var(--warm-glow-strong),transparent_70%)]" />
              <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-2xl shadow-lg">
                <CoverImage
                  isbn={currentVolume.isbn}
                  coverImageUrl={currentVolume.cover_image_url}
                  alt={heading}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <span className="text-muted-foreground/40 text-4xl font-semibold">
                        {currentVolume.volume_number}
                      </span>
                    </div>
                  }
                />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4 lg:col-span-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`text-xs ${ownershipColors[currentVolume.ownership_status]}`}
                  >
                    {currentVolume.ownership_status}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${readingColors[currentVolume.reading_status]}`}
                  >
                    {formatReadingStatus(currentVolume.reading_status)}
                  </Badge>
                  {currentVolume.format && (
                    <Badge variant="outline">{currentVolume.format}</Badge>
                  )}
                </div>
                <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  {heading}
                </h1>
                {currentSeries && (
                  <p className="text-muted-foreground mt-1 text-lg">
                    from{" "}
                    <Link
                      href={`/library/series/${currentSeries.id}`}
                      className="text-foreground hover:text-primary font-medium"
                    >
                      {currentSeries.title}
                    </Link>
                  </p>
                )}
              </div>
              <div className="animate-fade-in stagger-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={openEditDialog}
                  className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  Edit Volume
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="rounded-xl shadow-sm"
                >
                  Delete Volume
                </Button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="animate-fade-in-up stagger-2">
              <VolumeStatsStrip
                volume={currentVolume}
                readingProgress={readingProgress}
                priceFormatter={priceFormatter}
                publishedLabel={publishedLabel}
                purchaseDateLabel={purchaseDateLabel}
              />
            </div>

            {/* Inline CTAs */}
            <div className="animate-fade-in-up stagger-2 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleToggleReadStatus}
                disabled={ctaLoading === "read"}
                className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                {currentVolume.reading_status === "completed"
                  ? "Mark as Unread"
                  : "Mark as Read"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleWishlist}
                disabled={ctaLoading === "wishlist"}
                className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                {currentVolume.ownership_status === "wishlist"
                  ? "Remove from Wishlist"
                  : "Add to Wishlist"}
              </Button>
            </div>

            {/* Inline Reading Progress */}
            <div className="animate-fade-in-up stagger-3 glass-card rounded-2xl p-5">
              <span className="text-muted-foreground text-xs tracking-widest uppercase">
                Reading Progress
              </span>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label
                  htmlFor="volume-current-page"
                  className="text-sm font-medium"
                >
                  Page
                </label>
                <Input
                  id="volume-current-page"
                  type="number"
                  min={0}
                  max={currentVolume.page_count ?? undefined}
                  value={progressInput}
                  onChange={(e) => setProgressInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSaveProgress()
                  }}
                  className="w-24 rounded-xl"
                  aria-label="Current page number"
                />
                <span className="text-muted-foreground text-sm">
                  / {currentVolume.page_count ?? "?"}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleSaveProgress()}
                  disabled={
                    isSavingProgress ||
                    progressInput === String(currentVolume.current_page ?? "")
                  }
                  className="rounded-xl"
                >
                  {isSavingProgress ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>

            {/* Details panel */}
            <div className="animate-fade-in-up stagger-3 glass-card rounded-2xl p-5">
              <span className="text-muted-foreground text-xs tracking-widest uppercase">
                Details
              </span>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                {detailItems
                  .filter((item) => item.show)
                  .map((item) => (
                    <div key={item.label}>
                      <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                        {item.label}
                      </dt>
                      <dd className="font-medium">{item.value}</dd>
                    </div>
                  ))}
              </dl>
            </div>

            {/* External Links */}
            <div className="animate-fade-in-up stagger-3">
              <ExternalLinks
                title={currentSeries?.title ?? currentVolume.title ?? ""}
                amazonUrl={currentVolume.amazon_url}
              />
            </div>

            {/* Description */}
            {descriptionHtml && (
              <div className="animate-fade-in-up stagger-4 border-border/60 bg-card/60 rounded-2xl border p-5">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  About
                </span>
                <h2 className="font-display mt-2 text-lg font-semibold tracking-tight">
                  Description
                </h2>
                <div
                  className="text-muted-foreground mt-2"
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              </div>
            )}

            {/* Price History */}
            <ErrorBoundary>
              <div className="animate-fade-in-up stagger-5">
                <PriceHistoryCard
                  volumeId={currentVolume.id}
                  currency={priceDisplayCurrency}
                />
              </div>
            </ErrorBoundary>

            {/* Notes */}
            {currentVolume.notes && (
              <div className="animate-fade-in-up stagger-5 border-border/60 bg-card/60 rounded-2xl border p-5">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Personal
                </span>
                <h2 className="font-display mt-2 text-lg font-semibold tracking-tight">
                  Notes
                </h2>
                <div
                  className="prose-notes text-muted-foreground mt-2"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(currentVolume.notes)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <VolumeDialog
        open={volumeDialogOpen}
        onOpenChange={(open) => {
          setVolumeDialogOpen(open)
          if (!open) setEditingVolume(null)
        }}
        volume={editingVolume}
        nextVolumeNumber={1}
        onSubmit={handleEditVolume}
        seriesOptions={series}
        selectedSeriesId={selectedSeriesId}
        onSeriesChange={setSelectedSeriesId}
        allowNoSeries
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Volume</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Volume{" "}
              {currentVolume.volume_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVolume}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
