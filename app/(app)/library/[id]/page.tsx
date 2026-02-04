"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { VolumeDialog } from "@/components/library/volume-dialog"
import { BookSearchDialog } from "@/components/library/book-search-dialog"
import { VolumeCard } from "@/components/library/volume-card"
import { EmptyState } from "@/components/empty-state"
import { CoverImage } from "@/components/library/cover-image"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryStore } from "@/lib/store/library-store"
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
import type { Volume, VolumeInsert, OwnershipStatus } from "@/lib/types/database"
import { normalizeBookKey, type BookSearchResult } from "@/lib/books/search"
import { normalizeIsbn } from "@/lib/books/isbn"

export default function SeriesDetailPage() {
  const params = useParams()
  const router = useRouter()
  const seriesId = params.id as string

  const {
    series,
    fetchSeries,
    createVolume,
    editVolume,
    removeVolume,
    addVolumeFromSearchResult,
    addVolumesFromSearchResults,
    isLoading
  } = useLibrary()
  const { selectedSeries, setSelectedSeries } = useLibraryStore()

  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false)
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingVolume, setDeletingVolume] = useState<Volume | null>(null)

  const currentSeries =
    selectedSeries?.id === seriesId
      ? selectedSeries
      : series.find((s) => s.id === seriesId)

  const existingIsbns = useMemo(() => {
    if (!currentSeries) return []
    const normalized = currentSeries.volumes
      .map((volume) => volume.isbn)
      .filter((isbn): isbn is string => Boolean(isbn))
      .map((isbn) => normalizeIsbn(isbn))
      .filter((isbn) => isbn.length > 0)
    return Array.from(new Set(normalized))
  }, [currentSeries])

  const existingBookKeys = useMemo(() => {
    if (!currentSeries) return []
    const author = currentSeries.author ?? null
    const keys = currentSeries.volumes
      .map((volume) => normalizeBookKey(volume.title, author))
      .filter((key): key is string => Boolean(key))
    return Array.from(new Set(keys))
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

  const handleAddVolume = async (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => {
    try {
      await createVolume(seriesId, data)
      toast.success("Volume added successfully")
    } catch {
      toast.error("Failed to add volume")
    }
  }

  const handleEditVolume = async (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => {
    if (!editingVolume) return
    try {
      await editVolume(seriesId, editingVolume.id, data)
      toast.success("Volume updated successfully")
      setEditingVolume(null)
    } catch {
      toast.error("Failed to update volume")
    }
  }

  const handleDeleteVolume = async () => {
    if (!deletingVolume) return
    try {
      await removeVolume(seriesId, deletingVolume.id)
      toast.success("Volume deleted successfully")
      setDeletingVolume(null)
      setDeleteDialogOpen(false)
    } catch {
      toast.error("Failed to delete volume")
    }
  }

  const openEditDialog = useCallback((volume: Volume) => {
    setEditingVolume(volume)
    setVolumeDialogOpen(true)
  }, [])

  const openDeleteDialog = useCallback((volume: Volume) => {
    setDeletingVolume(volume)
    setDeleteDialogOpen(true)
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
      try {
        await addVolumeFromSearchResult(seriesId, result, options)
        toast.success("Volume added successfully")
      } catch {
        toast.error("Failed to add volume")
      }
    },
    [addVolumeFromSearchResult, seriesId]
  )

  const handleSearchSelectMany = useCallback(
    async (
      results: BookSearchResult[],
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
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

  if (isLoading && !currentSeries) {
    return (
      <div className="container mx-auto px-4 py-6">
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

  if (!currentSeries) {
    return (
      <div className="container mx-auto px-4 py-6">
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

  const ownedVolumes = currentSeries.volumes.filter(
    (v) => v.ownership_status === "owned"
  ).length
  const totalVolumes =
    currentSeries.total_volumes || currentSeries.volumes.length
  const readVolumes = currentSeries.volumes.filter(
    (v) => v.reading_status === "completed"
  ).length

  const typeColors = {
    light_novel: "bg-blue-500/10 text-blue-500",
    manga: "bg-purple-500/10 text-purple-500",
    other: "bg-gray-500/10 text-gray-500"
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
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm">
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
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Cover Image */}
        <div className="lg:col-span-1">
          <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-lg">
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

        {/* Series Info */}
        <div className="space-y-4 lg:col-span-3">
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
            <h1 className="text-3xl font-bold">{currentSeries.title}</h1>
            {currentSeries.original_title && (
              <p className="text-muted-foreground mt-1 text-lg">
                {currentSeries.original_title}
              </p>
            )}
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

          {currentSeries.description && (
            <p className="text-muted-foreground">{currentSeries.description}</p>
          )}

          {currentSeries.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentSeries.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">
                  {ownedVolumes}/{totalVolumes}
                </div>
                <div className="text-muted-foreground text-sm">Owned</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{readVolumes}</div>
                <div className="text-muted-foreground text-sm">Read</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">
                  {totalVolumes > 0
                    ? Math.round((ownedVolumes / totalVolumes) * 100)
                    : 0}
                  %
                </div>
                <div className="text-muted-foreground text-sm">Complete</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Volumes Section */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Volumes</h2>
          <Button onClick={openAddDialog}>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {currentSeries.volumes
              .toSorted((a, b) => a.volume_number - b.volume_number)
              .map((volume) => (
                <VolumeCard
                  key={volume.id}
                  volume={volume}
                  onEdit={() => openEditDialog(volume)}
                  onDelete={() => openDeleteDialog(volume)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Add/Edit Volume Dialog */}
      <BookSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectResult={handleSearchSelect}
        onSelectResults={handleSearchSelectMany}
        onAddManual={openManualDialog}
        context="volume"
        existingIsbns={existingIsbns}
        existingBookKeys={existingBookKeys}
      />

      {/* Add/Edit Volume Dialog */}
      <VolumeDialog
        open={volumeDialogOpen}
        onOpenChange={(open) => {
          setVolumeDialogOpen(open)
          if (!open) setEditingVolume(null)
        }}
        volume={editingVolume}
        nextVolumeNumber={currentSeries.volumes.length + 1}
        onSubmit={editingVolume ? handleEditVolume : handleAddVolume}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
