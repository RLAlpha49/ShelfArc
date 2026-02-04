"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CoverImage } from "@/components/library/cover-image"
import { VolumeDialog } from "@/components/library/volume-dialog"
import { EmptyState } from "@/components/empty-state"
import { useLibrary } from "@/lib/hooks/use-library"
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

const DEFAULT_CURRENCY_CODE = "USD"

export const ownershipColors: Record<string, string> = {
  owned: "bg-green-500/10 text-green-500",
  wishlist: "bg-yellow-500/10 text-yellow-500",
  reading: "bg-blue-500/10 text-blue-500",
  completed: "bg-purple-500/10 text-purple-500",
  dropped: "bg-red-500/10 text-red-500"
}

export const readingColors: Record<string, string> = {
  unread: "bg-gray-500/10 text-gray-500",
  reading: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  on_hold: "bg-yellow-500/10 text-yellow-500",
  dropped: "bg-red-500/10 text-red-500"
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

  const currencyCode =
    currentVolume && "currency" in currentVolume
      ? (currentVolume as Volume & { currency?: string }).currency ??
        DEFAULT_CURRENCY_CODE
      : DEFAULT_CURRENCY_CODE

  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode
      }),
    [currencyCode]
  )

  const progressPercent =
    currentVolume?.page_count && currentVolume.current_page
      ? Math.round((currentVolume.current_page / currentVolume.page_count) * 100)
      : null

  if (isLoading && !currentVolume) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Skeleton className="aspect-3/4 w-full rounded-lg" />
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
      <div className="container mx-auto px-4 py-6">
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

  return (
    <div className="container mx-auto px-4 py-6">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm">
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{heading}</h1>
          {currentVolume.isbn && (
            <p className="text-muted-foreground text-sm">ISBN {currentVolume.isbn}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openEditDialog}>
            Edit Volume
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Volume
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="bg-muted relative aspect-3/4 overflow-hidden rounded-lg">
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

        <div className="space-y-4 lg:col-span-2">
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

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {currentVolume.page_count ?? "—"}
                </div>
                <div className="text-muted-foreground text-sm">Pages</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {currentVolume.current_page ?? "—"}
                </div>
                <div className="text-muted-foreground text-sm">Current Page</div>
              </CardContent>
            </Card>
          </div>

          {progressPercent !== null && currentVolume.reading_status === "reading" && (
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center justify-between text-sm">
                <span>Reading progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {(currentVolume.purchase_date || currentVolume.purchase_price) && (
            <div className="text-muted-foreground text-sm">
              {currentVolume.purchase_date && (
                <p>Purchased on {currentVolume.purchase_date}</p>
              )}
              {currentVolume.purchase_price && (
                <p>Price {priceFormatter.format(currentVolume.purchase_price)}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Separator className="my-8" />

      {currentVolume.description && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Description</h2>
          <p className="text-muted-foreground">{currentVolume.description}</p>
        </div>
      )}

      {currentVolume.notes && (
        <div className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold">Notes</h2>
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
              Are you sure you want to delete Volume {currentVolume.volume_number}?{" "}
              This action cannot be undone.
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
