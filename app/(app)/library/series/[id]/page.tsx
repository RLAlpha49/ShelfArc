"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { VolumeDialog } from "@/components/library/volume-dialog"
import { SeriesDialog } from "@/components/library/series-dialog"
import { BulkScrapeDialog } from "@/components/library/bulk-scrape-dialog"
import { BookSearchDialog } from "@/components/library/book-search-dialog"
import { VolumeCard } from "@/components/library/volume-card"
import { EmptyState } from "@/components/empty-state"
import { CoverImage } from "@/components/library/cover-image"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryStore } from "@/lib/store/library-store"
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
import type {
  SeriesWithVolumes,
  SeriesInsert,
  Volume,
  VolumeInsert,
  OwnershipStatus
} from "@/lib/types/database"
import type { DateFormat } from "@/lib/store/settings-store"
import { type BookSearchResult } from "@/lib/books/search"
import { normalizeIsbn } from "@/lib/books/isbn"

const typeColors = {
  light_novel: "bg-gold/10 text-gold",
  manga: "bg-copper/10 text-copper",
  other: "bg-muted text-muted-foreground"
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const formatVolumeNumber = (value: number) => value.toString()

const buildVolumeRangeLabel = (numbers: number[]) => {
  const uniqueSorted = Array.from(
    new Set(numbers.filter((value) => Number.isFinite(value)))
  ).sort((a, b) => a - b)

  if (uniqueSorted.length === 0) return "—"

  const ranges: Array<{ start: number; end: number }> = []
  let rangeStart = uniqueSorted[0]
  let rangeEnd = uniqueSorted[0]

  for (let index = 1; index < uniqueSorted.length; index += 1) {
    const value = uniqueSorted[index]
    const isConsecutive = Math.abs(value - (rangeEnd + 1)) < 1e-6
    if (isConsecutive) {
      rangeEnd = value
      continue
    }
    ranges.push({ start: rangeStart, end: rangeEnd })
    rangeStart = value
    rangeEnd = value
  }

  ranges.push({ start: rangeStart, end: rangeEnd })

  const formatted = ranges
    .map(({ start, end }) =>
      start === end
        ? formatVolumeNumber(start)
        : `${formatVolumeNumber(start)}–${formatVolumeNumber(end)}`
    )
    .join(", ")

  return `Vol. ${formatted}`
}

const getNextOwnedVolumeNumber = (numbers: number[]) => {
  const ownedIntegers = new Set(
    numbers.filter(
      (value) => Number.isFinite(value) && Number.isInteger(value) && value > 0
    )
  )
  let next = 1
  while (ownedIntegers.has(next)) {
    next += 1
  }
  return next
}

type SeriesInsightData = {
  ownedVolumes: number
  wishlistVolumes: number
  readingVolumes: number
  readVolumes: number
  totalVolumes: number
  collectionPercent: number
  missingVolumes: number | null
  totalPages: number
  averageRating: number | null
  latestVolume: Volume | null
  volumeRangeLabel: string
  nextVolumeLabel: string
  nextVolumeNumber: number
  catalogedVolumes: number
  officialTotalVolumes: number | null
  createdLabel: string
  updatedLabel: string
}

const buildSeriesInsights = (
  series: SeriesWithVolumes,
  dateFormat: DateFormat
): SeriesInsightData => {
  const ownedVolumeEntries = series.volumes.filter(
    (volume) => volume.ownership_status === "owned"
  )
  const wishlistVolumes = series.volumes.filter(
    (volume) => volume.ownership_status === "wishlist"
  ).length
  const ownedVolumes = ownedVolumeEntries.length
  const readingVolumes = series.volumes.filter(
    (volume) => volume.reading_status === "reading"
  ).length
  const readVolumes = series.volumes.filter(
    (volume) => volume.reading_status === "completed"
  ).length
  const totalVolumes = series.total_volumes ?? series.volumes.length
  const collectionPercent =
    totalVolumes > 0 ? Math.round((ownedVolumes / totalVolumes) * 100) : 0
  const missingVolumes =
    series.total_volumes && series.total_volumes > 0
      ? Math.max(series.total_volumes - ownedVolumes, 0)
      : null
  const totalPages = series.volumes.reduce(
    (acc, volume) => acc + (volume.page_count ?? 0),
    0
  )
  const ratedVolumes = series.volumes.filter(
    (volume) => typeof volume.rating === "number"
  )
  const averageRating =
    ratedVolumes.length > 0
      ? Math.round(
          (ratedVolumes.reduce((acc, volume) => acc + (volume.rating ?? 0), 0) /
            ratedVolumes.length) *
            10
        ) / 10
      : null
  const latestVolume = series.volumes.reduce<Volume | null>((best, volume) => {
    if (!best || volume.volume_number > best.volume_number) return volume
    return best
  }, null)
  const ownedVolumeNumbers = ownedVolumeEntries
    .map((volume) => volume.volume_number)
    .filter((value) => Number.isFinite(value))
  const nextVolumeNumber = getNextOwnedVolumeNumber(ownedVolumeNumbers)
  const volumeRangeLabel = buildVolumeRangeLabel(ownedVolumeNumbers)
  const nextVolumeLabel =
    series.total_volumes && nextVolumeNumber > series.total_volumes
      ? "Complete"
      : `Vol. ${nextVolumeNumber}`

  return {
    ownedVolumes,
    wishlistVolumes,
    readingVolumes,
    readVolumes,
    totalVolumes,
    collectionPercent,
    missingVolumes,
    totalPages,
    averageRating,
    latestVolume,
    volumeRangeLabel,
    nextVolumeLabel,
    nextVolumeNumber,
    catalogedVolumes: series.volumes.length,
    officialTotalVolumes: series.total_volumes,
    createdLabel: formatDate(series.created_at, dateFormat),
    updatedLabel: formatDate(series.updated_at, dateFormat)
  }
}

const SeriesInsightsPanel = ({
  insights
}: {
  readonly insights: SeriesInsightData
}) => (
  <div className="mt-6 grid gap-4 lg:grid-cols-2">
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs tracking-widest uppercase">
          Collection breakdown
        </span>
        <span className="text-muted-foreground text-xs">
          {insights.collectionPercent}% collected
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <div className="text-foreground text-lg font-semibold">
            {insights.ownedVolumes}
          </div>
          <div className="text-muted-foreground text-xs tracking-widest uppercase">
            Owned
          </div>
        </div>
        <div>
          <div className="text-foreground text-lg font-semibold">
            {insights.wishlistVolumes}
          </div>
          <div className="text-muted-foreground text-xs tracking-widest uppercase">
            Wishlist
          </div>
        </div>
        <div>
          <div className="text-foreground text-lg font-semibold">
            {insights.readingVolumes}
          </div>
          <div className="text-muted-foreground text-xs tracking-widest uppercase">
            Reading
          </div>
        </div>
        <div>
          <div className="text-foreground text-lg font-semibold">
            {insights.readVolumes}
          </div>
          <div className="text-muted-foreground text-xs tracking-widest uppercase">
            Completed
          </div>
        </div>
        <div>
          <div className="text-foreground text-lg font-semibold">
            {insights.missingVolumes ?? "—"}
          </div>
          <div className="text-muted-foreground text-xs tracking-widest uppercase">
            Missing
          </div>
        </div>
        <div>
          <div className="text-foreground text-lg font-semibold">
            {insights.averageRating ? insights.averageRating.toFixed(1) : "—"}
          </div>
          <div className="text-muted-foreground text-xs tracking-widest uppercase">
            Avg rating
          </div>
        </div>
      </div>
      {insights.totalVolumes > 0 && (
        <div className="mt-4">
          <div className="bg-primary/10 h-2 overflow-hidden rounded-full">
            <div
              className="from-copper to-gold h-full rounded-full bg-linear-to-r transition-all"
              style={{ width: `${insights.collectionPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>

    <div className="glass-card rounded-2xl p-5">
      <span className="text-muted-foreground text-xs tracking-widest uppercase">
        Series details
      </span>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs tracking-widest uppercase">
            Cataloged
          </dt>
          <dd className="font-medium">{insights.catalogedVolumes}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-widest uppercase">
            Total volumes
          </dt>
          <dd className="font-medium">
            {insights.officialTotalVolumes ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-widest uppercase">
            Owned volumes
          </dt>
          <dd className="font-medium">{insights.volumeRangeLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-widest uppercase">
            Next volume
          </dt>
          <dd className="font-medium">{insights.nextVolumeLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-widest uppercase">
            Latest volume
          </dt>
          <dd className="font-medium">
            {insights.latestVolume ? (
              <Link
                href={`/library/volume/${insights.latestVolume.id}`}
                className="text-foreground hover:text-primary"
              >
                Vol. {insights.latestVolume.volume_number}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-widest uppercase">
            Total pages
          </dt>
          <dd className="font-medium">
            {insights.totalPages > 0
              ? insights.totalPages.toLocaleString()
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-widest uppercase">
            Added
          </dt>
          <dd className="font-medium">{insights.createdLabel || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-widest uppercase">
            Updated
          </dt>
          <dd className="font-medium">{insights.updatedLabel || "—"}</dd>
        </div>
      </dl>
    </div>
  </div>
)

export default function SeriesDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawSeriesId = params?.id
  const seriesId = typeof rawSeriesId === "string" ? rawSeriesId : null

  const {
    series,
    fetchSeries,
    createSeries,
    createVolume,
    editSeries,
    editVolume,
    removeSeries,
    removeVolume,
    addVolumeFromSearchResult,
    addVolumesFromSearchResults,
    isLoading
  } = useLibrary()
  const { selectedSeries, setSelectedSeries, deleteSeriesVolumes } =
    useLibraryStore()
  const dateFormat = useSettingsStore((state) => state.dateFormat)

  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false)
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)
  const [createSeriesDialogOpen, setCreateSeriesDialogOpen] = useState(false)
  const [deleteVolumeDialogOpen, setDeleteVolumeDialogOpen] = useState(false)
  const [deleteSeriesDialogOpen, setDeleteSeriesDialogOpen] = useState(false)
  const [bulkScrapeDialogOpen, setBulkScrapeDialogOpen] = useState(false)
  const [isDeletingSeries, setIsDeletingSeries] = useState(false)
  const [isDeletingVolume, setIsDeletingVolume] = useState(false)
  const [deletingVolume, setDeletingVolume] = useState<Volume | null>(null)
  const isDeletingSeriesRef = useRef(false)

  const currentSeries =
    selectedSeries?.id === seriesId
      ? selectedSeries
      : series.find((s) => s.id === seriesId)

  const insights = useMemo(
    () =>
      currentSeries ? buildSeriesInsights(currentSeries, dateFormat) : null,
    [currentSeries, dateFormat]
  )

  const existingIsbns = useMemo(() => {
    if (!currentSeries) return []
    const normalized = currentSeries.volumes
      .map((volume) => volume.isbn)
      .filter((isbn): isbn is string => Boolean(isbn))
      .map((isbn) => normalizeIsbn(isbn))
      .filter((isbn) => isbn.length > 0)
    return Array.from(new Set(normalized))
  }, [currentSeries])

  useEffect(() => {
    if (series.length === 0) {
      fetchSeries()
    }
  }, [series.length, fetchSeries])

  useEffect(() => {
    if (currentSeries && currentSeries.id !== selectedSeries?.id) {
      setSelectedSeries(currentSeries)
    }
  }, [currentSeries, selectedSeries?.id, setSelectedSeries])

  useEffect(() => {
    if (!seriesId) {
      router.replace("/library")
    }
  }, [seriesId, router])

  const handleAddVolume = async (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => {
    if (!seriesId) {
      const error = new Error("Invalid series id")
      console.error(error)
      toast.error(`Failed to add volume: ${error.message}`)
      return
    }
    try {
      await createVolume(seriesId, data)
      toast.success("Volume added successfully")
    } catch (err) {
      console.error(err)
      toast.error(`Failed to add volume: ${getErrorMessage(err)}`)
    }
  }

  const handleEditVolume = async (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => {
    if (!editingVolume) return
    const currentSeriesId = editingVolume.series_id ?? null
    const nextSeriesId = selectedSeriesId ?? null
    try {
      await editVolume(currentSeriesId, editingVolume.id, {
        ...data,
        series_id: nextSeriesId
      })
      toast.success("Volume updated successfully")
      setEditingVolume(null)
    } catch (err) {
      console.error(err)
      toast.error(`Failed to update volume: ${getErrorMessage(err)}`)
    }
  }

  const handleEditSeries = async (
    data: Omit<SeriesInsert, "user_id">,
    options?: { volumeIds?: string[] }
  ) => {
    if (!currentSeries) return
    void options
    try {
      await editSeries(currentSeries.id, data)
      toast.success("Series updated successfully")
    } catch (err) {
      console.error(err)
      toast.error(`Failed to update series: ${getErrorMessage(err)}`)
    }
  }

  const handleCreateNewSeries = async (data: Omit<SeriesInsert, "user_id">) => {
    try {
      const newSeries = await createSeries(data)
      toast.success("Series created successfully")
      if (editingVolume) {
        setSelectedSeriesId(newSeries.id)
        setCreateSeriesDialogOpen(false)
        setVolumeDialogOpen(true)
      }
    } catch (err) {
      console.error(err)
      toast.error(`Failed to create series: ${getErrorMessage(err)}`)
    }
  }

  const handleDeleteVolume = async () => {
    if (isDeletingVolume) return
    if (!deletingVolume) return
    if (!deletingVolume.series_id) {
      const error = new Error("Missing series id for volume")
      console.error(error)
      toast.error(`Failed to delete volume: ${error.message}`)
      return
    }
    setIsDeletingVolume(true)
    try {
      await removeVolume(deletingVolume.series_id, deletingVolume.id)
      toast.success("Volume deleted successfully")
    } catch (err) {
      console.error(err)
      toast.error(`Failed to delete volume: ${getErrorMessage(err)}`)
    } finally {
      setIsDeletingVolume(false)
      setDeletingVolume(null)
      setDeleteVolumeDialogOpen(false)
    }
  }

  const handleDeleteSeries = useCallback(async () => {
    if (!currentSeries) return false
    try {
      await removeSeries(currentSeries.id)
      toast.success("Series deleted successfully")
      router.push("/library")
      return true
    } catch (err) {
      console.error(err)
      toast.error(`Failed to delete series: ${getErrorMessage(err)}`)
      return false
    }
  }, [currentSeries, removeSeries, router])

  const openEditDialog = useCallback((volume: Volume) => {
    setEditingVolume(volume)
    setSelectedSeriesId(volume.series_id ?? null)
    setVolumeDialogOpen(true)
  }, [])

  const openDeleteDialog = useCallback((volume: Volume) => {
    setDeletingVolume(volume)
    setDeleteVolumeDialogOpen(true)
  }, [])

  const openAddDialog = useCallback(() => {
    setEditingVolume(null)
    setSearchDialogOpen(true)
  }, [])

  const openManualDialog = useCallback(() => {
    setSearchDialogOpen(false)
    setEditingVolume(null)
    setVolumeDialogOpen(true)
  }, [])

  const handleSearchSelect = useCallback(
    async (
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      if (!seriesId) {
        const error = new Error("Invalid series id")
        console.error(error)
        toast.error(`Failed to add volume: ${error.message}`)
        return
      }
      try {
        await addVolumeFromSearchResult(seriesId, result, options)
        toast.success("Volume added successfully")
      } catch (err) {
        console.error(err)
        toast.error(`Failed to add volume: ${getErrorMessage(err)}`)
      }
    },
    [addVolumeFromSearchResult, seriesId]
  )

  const handleSearchSelectMany = useCallback(
    async (
      results: BookSearchResult[],
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      if (!seriesId) {
        const error = new Error("Invalid series id")
        console.error(error)
        toast.error(`Failed to add volume: ${error.message}`)
        return
      }
      const { successCount, failureCount } = await addVolumesFromSearchResults(
        seriesId,
        results,
        options
      )

      if (successCount > 0) {
        toast.success(
          `${successCount} volume${successCount === 1 ? "" : "s"} added`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume${failureCount === 1 ? "" : "s"} failed to add`
        )
      }
    },
    [addVolumesFromSearchResults, seriesId]
  )

  const handleToggleRead = useCallback(
    async (volume: Volume) => {
      if (!volume.series_id) return
      const nextStatus =
        volume.reading_status === "completed" ? "unread" : "completed"
      try {
        await editVolume(volume.series_id, volume.id, {
          reading_status: nextStatus
        })
        toast.success(
          nextStatus === "completed" ? "Marked as read" : "Marked as unread"
        )
      } catch (err) {
        console.error(err)
        toast.error(`Failed to update: ${getErrorMessage(err)}`)
      }
    },
    [editVolume]
  )

  const handleVolumeClick = useCallback(
    (volumeId: string) => {
      router.push(`/library/volume/${volumeId}`)
    },
    [router]
  )

  const handleDeleteSeriesConfirm = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      if (isDeletingSeriesRef.current) return
      isDeletingSeriesRef.current = true
      setIsDeletingSeries(true)
      try {
        const wasDeleted = await handleDeleteSeries()
        if (wasDeleted) {
          setDeleteSeriesDialogOpen(false)
        }
      } finally {
        isDeletingSeriesRef.current = false
        setIsDeletingSeries(false)
      }
    },
    [handleDeleteSeries]
  )

  const descriptionHtml = useMemo(
    () => sanitizeHtml(currentSeries?.description ?? "").trim(),
    [currentSeries?.description]
  )

  if (isLoading && !currentSeries) {
    return (
      <div className="px-6 py-8 lg:px-10">
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

  if (!currentSeries || !insights) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <EmptyState
          title="Series not found"
          description="The series you're looking for doesn't exist or has been deleted."
          action={{
            label: "Back to Library",
            onClick: () => router.push("/library")
          }}
        />
      </div>
    )
  }

  const primaryVolume = currentSeries.volumes.reduce<Volume | null>(
    (best, volume) => {
      if (!volume.isbn) return best
      if (!best || volume.volume_number < best.volume_number) return volume
      return best
    },
    null
  )
  const primaryIsbn = primaryVolume?.isbn ?? null

  return (
    <div className="relative px-6 py-8 lg:px-10">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_30%_20%,var(--warm-glow-strong),transparent_70%)]" />

      {/* Breadcrumb with Go Back */}
      <nav className="animate-fade-in-down mb-8 flex items-center gap-3 text-xs tracking-wider">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back
        </button>
        <span className="text-muted-foreground">/</span>
        <Link
          href="/library"
          className="text-muted-foreground hover:text-foreground"
        >
          Library
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{currentSeries.title}</span>
      </nav>

      {/* Series Header */}
      <div className="relative mb-10">
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_30%_50%,var(--warm-glow-strong),transparent_70%)]" />
        <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Cover Image */}
          <div className="lg:col-span-4">
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,var(--warm-glow-strong),transparent_70%)]" />
              <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-2xl shadow-lg">
                <CoverImage
                  isbn={primaryIsbn}
                  coverImageUrl={currentSeries.cover_image_url}
                  alt={currentSeries.title}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="text-muted-foreground/50 h-16 w-16"
                      >
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                      </svg>
                    </div>
                  }
                />
              </div>
            </div>
          </div>

          {/* Series Info */}
          <div className="space-y-4 lg:col-span-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={typeColors[currentSeries.type]}
                  >
                    {currentSeries.type === "light_novel" && "Light Novel"}
                    {currentSeries.type === "manga" && "Manga"}
                    {currentSeries.type === "other" && "Other"}
                  </Badge>
                  {currentSeries.status && (
                    <Badge variant="outline">{currentSeries.status}</Badge>
                  )}
                </div>
                <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  {currentSeries.title}
                </h1>
                {currentSeries.original_title && (
                  <p className="text-muted-foreground mt-1 text-lg">
                    {currentSeries.original_title}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
                  onClick={() => setSeriesDialogOpen(true)}
                >
                  Edit Series
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-xl shadow-sm"
                  onClick={() => setDeleteSeriesDialogOpen(true)}
                >
                  Delete Series
                </Button>
              </div>
            </div>

            {currentSeries.author && (
              <p className="text-muted-foreground">
                By{" "}
                <span className="text-foreground font-medium">
                  {currentSeries.author}
                </span>
                {currentSeries.artist &&
                  currentSeries.artist !== currentSeries.author && (
                    <>
                      , illustrated by{" "}
                      <span className="text-foreground font-medium">
                        {currentSeries.artist}
                      </span>
                    </>
                  )}
              </p>
            )}

            {currentSeries.publisher && (
              <p className="text-muted-foreground text-sm">
                Published by {currentSeries.publisher}
              </p>
            )}

            {descriptionHtml && (
              <div
                className="text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            )}

            {currentSeries.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentSeries.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="border-primary/15 rounded-lg"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="glass-card mt-6 flex items-center divide-x rounded-2xl">
              <div className="flex-1 px-6 py-4 text-center">
                <div className="font-display text-primary text-2xl font-bold">
                  {insights.ownedVolumes}/{insights.totalVolumes}
                </div>
                <div className="text-muted-foreground text-xs tracking-widest uppercase">
                  Owned
                </div>
              </div>
              <div className="flex-1 px-6 py-4 text-center">
                <div className="font-display text-primary text-2xl font-bold">
                  {insights.readVolumes}
                </div>
                <div className="text-muted-foreground text-xs tracking-widest uppercase">
                  Read
                </div>
              </div>
              <div className="flex-1 px-6 py-4 text-center">
                <div className="font-display text-primary text-2xl font-bold">
                  {insights.collectionPercent}%
                </div>
                <div className="text-muted-foreground text-xs tracking-widest uppercase">
                  Complete
                </div>
              </div>
            </div>
            <SeriesInsightsPanel insights={insights} />
            {currentSeries.notes && (
              <div className="border-border/60 bg-card/60 mt-6 rounded-2xl border p-5">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Personal
                </span>
                <h2 className="font-display mt-2 text-lg font-semibold tracking-tight">
                  Notes
                </h2>
                <p className="text-muted-foreground mt-2 whitespace-pre-line">
                  {currentSeries.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="my-10 border-t" />

      {/* Volumes Section */}
      <div>
        <div className="animate-fade-in-up stagger-2 mb-6 flex items-center justify-between">
          <div>
            <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
              Collection
            </span>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Volumes
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {currentSeries.volumes.length > 0 && (
              <Button
                variant="outline"
                className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
                onClick={() => setBulkScrapeDialogOpen(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1.5 h-4 w-4"
                >
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                Bulk Scrape
              </Button>
            )}
            <Button
              className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
              onClick={openAddDialog}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="mr-2 h-4 w-4"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Add Volume
            </Button>
          </div>
        </div>

        {currentSeries.volumes.length === 0 ? (
          <EmptyState
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted-foreground h-8 w-8"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            }
            title="No volumes yet"
            description="Start tracking your collection by adding volumes"
            action={{
              label: "Add Volume",
              onClick: openAddDialog
            }}
          />
        ) : (
          <div className="animate-fade-in-up">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {currentSeries.volumes
                .toSorted((a, b) => a.volume_number - b.volume_number)
                .map((volume) => (
                  <VolumeCard
                    key={volume.id}
                    volume={volume}
                    onClick={() => handleVolumeClick(volume.id)}
                    onEdit={() => openEditDialog(volume)}
                    onDelete={() => openDeleteDialog(volume)}
                    onToggleRead={() => handleToggleRead(volume)}
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Book Search Dialog */}
      <BookSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectResult={handleSearchSelect}
        onSelectResults={handleSearchSelectMany}
        onAddManual={openManualDialog}
        context="volume"
        existingIsbns={existingIsbns}
      />

      {/* Add/Edit Volume Dialog */}
      <VolumeDialog
        open={volumeDialogOpen}
        onOpenChange={(open) => {
          setVolumeDialogOpen(open)
          if (!open) {
            setEditingVolume(null)
            setSelectedSeriesId(null)
          }
        }}
        volume={editingVolume}
        nextVolumeNumber={insights.nextVolumeNumber}
        onSubmit={editingVolume ? handleEditVolume : handleAddVolume}
        seriesOptions={editingVolume ? series : undefined}
        selectedSeriesId={editingVolume ? selectedSeriesId : undefined}
        onSeriesChange={editingVolume ? setSelectedSeriesId : undefined}
        onCreateSeries={
          editingVolume
            ? () => {
                setVolumeDialogOpen(false)
                setCreateSeriesDialogOpen(true)
              }
            : undefined
        }
        allowNoSeries={Boolean(editingVolume)}
      />

      <SeriesDialog
        open={seriesDialogOpen}
        onOpenChange={setSeriesDialogOpen}
        series={currentSeries}
        onSubmit={handleEditSeries}
      />

      <SeriesDialog
        open={createSeriesDialogOpen}
        onOpenChange={setCreateSeriesDialogOpen}
        onSubmit={handleCreateNewSeries}
      />

      <BulkScrapeDialog
        open={bulkScrapeDialogOpen}
        onOpenChange={setBulkScrapeDialogOpen}
        series={currentSeries}
        editVolume={editVolume}
      />

      <AlertDialog
        open={deleteSeriesDialogOpen}
        onOpenChange={setDeleteSeriesDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Series</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{currentSeries.title}&quot;?{" "}
              {deleteSeriesVolumes
                ? "This will also delete all volumes associated with this series."
                : "The volumes will be kept and moved to Unassigned Books."}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSeriesConfirm}
              disabled={isDeletingSeries}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteVolumeDialogOpen}
        onOpenChange={setDeleteVolumeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Volume</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Volume{" "}
              {deletingVolume?.volume_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVolume}
              disabled={isDeletingVolume}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
