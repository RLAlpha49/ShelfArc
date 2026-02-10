"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
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
import { formatDate } from "@/lib/format-date"
import { sanitizeHtml } from "@/lib/sanitize-html"
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
import type { Volume, VolumeInsert } from "@/lib/types/database"

const VOLUME_TOKEN_PATTERN =
  /\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*\d+(?:\.\d+)?\b/gi

const normalizeVolumeTitle = (title: string) => {
  const withoutToken = title.replaceAll(VOLUME_TOKEN_PATTERN, " ")
  const cleaned = withoutToken
    .replaceAll(/\s*[-–—:]\s*$/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
  return cleaned || title.trim()
}

const formatReadingStatus = (status: string) => {
  const normalized = status.replaceAll("_", " ")
  if (!normalized) return normalized
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export const ownershipColors: Record<string, string> = {
  owned: "bg-copper/10 text-copper",
  wishlist: "bg-gold/10 text-gold",
  reading: "bg-primary/10 text-primary",
  completed: "bg-copper/10 text-copper",
  dropped: "bg-destructive/10 text-destructive"
}

export const readingColors: Record<string, string> = {
  unread: "bg-muted text-muted-foreground",
  reading: "bg-primary/10 text-primary",
  completed: "bg-copper/10 text-copper",
  on_hold: "bg-gold/10 text-gold",
  dropped: "bg-destructive/10 text-destructive"
}

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

  const progressPercent =
    currentVolume?.page_count && currentVolume.current_page
      ? Math.round(
          (currentVolume.current_page / currentVolume.page_count) * 100
        )
      : null

  const descriptionHtml = useMemo(
    () => sanitizeHtml(currentVolume?.description ?? "").trim(),
    [currentVolume?.description]
  )

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
          action={{
            label: "Back to Library",
            onClick: () => router.push("/library")
          }}
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
      label: "ISBN",
      value: currentVolume.isbn,
      show: Boolean(currentVolume.isbn)
    },
    {
      label: "Edition",
      value: currentVolume.edition,
      show: Boolean(currentVolume.edition)
    },
    {
      label: "Format",
      value: currentVolume.format,
      show: Boolean(currentVolume.format)
    },
    {
      label: "Published",
      value: publishedLabel,
      show: Boolean(publishedLabel)
    },
    {
      label: "Purchased",
      value: purchaseDateLabel,
      show: Boolean(purchaseDateLabel)
    },
    {
      label: "Price",
      value:
        currentVolume.purchase_price !== null &&
        currentVolume.purchase_price !== undefined
          ? priceFormatter.format(currentVolume.purchase_price)
          : null,
      show:
        currentVolume.purchase_price !== null &&
        currentVolume.purchase_price !== undefined
    },
    { label: "Started", value: startedLabel, show: Boolean(startedLabel) },
    { label: "Finished", value: finishedLabel, show: Boolean(finishedLabel) },
    { label: "Added", value: addedLabel || "—", show: true },
    { label: "Updated", value: updatedLabel || "—", show: true }
  ]

  return (
    <div className="relative px-6 py-8 lg:px-10">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_30%_20%,var(--warm-glow-strong),transparent_70%)]" />

      <nav className="animate-fade-in-down mb-8 flex flex-wrap items-center gap-2 text-xs tracking-wider">
        <Link
          href="/library"
          className="text-muted-foreground hover:text-foreground"
        >
          Library
        </Link>
        {currentSeries && (
          <>
            <span className="text-muted-foreground">/</span>
            <Link
              href={`/library/series/${currentSeries.id}`}
              className="text-muted-foreground hover:text-foreground"
            >
              {currentSeries.title}
            </Link>
          </>
        )}
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{breadcrumbLabel}</span>
      </nav>

      <div className="mb-8 grid items-start gap-6 lg:grid-cols-12">
        <div className="animate-fade-in-up lg:col-span-8">
          <span className="text-muted-foreground mb-2 block text-xs tracking-widest uppercase">
            {currentVolume.isbn
              ? `ISBN ${currentVolume.isbn}`
              : "Volume Details"}
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {heading}
          </h1>
        </div>
        <div className="animate-fade-in-up stagger-2 flex items-start justify-end gap-2 lg:col-span-4">
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
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

        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap gap-2">
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
            {currentVolume.rating && (
              <Badge variant="outline">Rating {currentVolume.rating}/10</Badge>
            )}
          </div>

          <div className="glass-card flex items-center divide-x rounded-2xl">
            <div className="flex-1 px-5 py-4 text-center">
              <div className="font-display text-primary text-2xl font-bold">
                {currentVolume.page_count ?? "—"}
              </div>
              <div className="text-muted-foreground text-xs tracking-widest uppercase">
                Pages
              </div>
            </div>
            <div className="flex-1 px-5 py-4 text-center">
              <div className="font-display text-primary text-2xl font-bold">
                {currentVolume.current_page ?? "—"}
              </div>
              <div className="text-muted-foreground text-xs tracking-widest uppercase">
                Current Page
              </div>
            </div>
            {currentVolume.rating && (
              <div className="flex-1 px-5 py-4 text-center">
                <div className="font-display text-primary text-2xl font-bold">
                  {currentVolume.rating}/10
                </div>
                <div className="text-muted-foreground text-xs tracking-widest uppercase">
                  Rating
                </div>
              </div>
            )}
          </div>

          {progressPercent !== null &&
            currentVolume.reading_status === "reading" && (
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center justify-between text-sm">
                  <span>Reading progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="bg-primary/10 h-2 overflow-hidden rounded-full">
                  <div
                    className="from-copper to-gold h-full rounded-full bg-linear-to-r transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

          <div className="glass-card rounded-2xl p-5">
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
        </div>
      </div>

      <div className="my-10 border-t" />

      {descriptionHtml && (
        <div className="space-y-2">
          <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
            About
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Description
          </h2>
          <div
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        </div>
      )}

      {currentVolume.notes && (
        <div className="mt-8 space-y-2 border-t pt-8">
          <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
            Personal
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Notes
          </h2>
          <p className="text-muted-foreground whitespace-pre-line">
            {currentVolume.notes}
          </p>
        </div>
      )}

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
