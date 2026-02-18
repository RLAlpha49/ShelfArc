"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { useRecentlyVisitedStore } from "@/lib/store/recently-visited-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CoverImage } from "@/components/library/cover-image"
import { VolumeDialog } from "@/components/library/volume-dialog"
import { EmptyState } from "@/components/empty-state"
import { useLibrary } from "@/lib/hooks/use-library"
import {
  DEFAULT_CURRENCY_CODE,
  useLibraryStore
} from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
import { formatDate } from "@/lib/format-date"
import { sanitizeHtml } from "@/lib/sanitize-html"
import { announce } from "@/components/live-announcer"
import { ErrorBoundary } from "@/components/error-boundary"
import { toast } from "sonner"
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
import { Skeleton } from "@/components/ui/skeleton"
import { PriceHistoryCard } from "@/components/library/price-history-card"
import { ExternalLinks } from "@/components/library/external-links"
import type { Volume, VolumeInsert } from "@/lib/types/database"

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

/** Tailwind badge color classes keyed by ownership status. @source */
export const ownershipColors: Record<string, string> = {
  owned: "bg-copper/10 text-copper",
  wishlist: "bg-gold/10 text-gold",
  reading: "bg-primary/10 text-primary",
  completed: "bg-copper/10 text-copper",
  dropped: "bg-destructive/10 text-destructive"
}

/** Tailwind badge color classes keyed by reading status. @source */
export const readingColors: Record<string, string> = {
  unread: "bg-muted text-muted-foreground",
  reading: "bg-primary/10 text-primary",
  completed: "bg-copper/10 text-copper",
  on_hold: "bg-gold/10 text-gold",
  dropped: "bg-destructive/10 text-destructive"
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
          ? `${"★".repeat(Math.round(volume.rating / 2))}${"☆".repeat(5 - Math.round(volume.rating / 2))}`
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

  const openEditDialog = useCallback(() => {
    if (!currentVolume) return
    setEditingVolume(currentVolume)
    setVolumeDialogOpen(true)
    setSelectedSeriesId(currentVolume.series_id ?? null)
  }, [currentVolume])

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
