"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { SeriesCard } from "@/components/library/series-card"
import { SeriesDialog } from "@/components/library/series-dialog"
import { VolumeDialog } from "@/components/library/volume-dialog"
import { BookSearchDialog } from "@/components/library/book-search-dialog"
import { LibraryToolbar } from "@/components/library/library-toolbar"
import { VolumeCard } from "@/components/library/volume-card"
import { CoverImage } from "@/components/library/cover-image"
import { EmptyState } from "@/components/empty-state"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryStore } from "@/lib/store/library-store"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
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
  Series,
  SeriesWithVolumes,
  Volume,
  OwnershipStatus
} from "@/lib/types/database"
import { normalizeBookKey, type BookSearchResult } from "@/lib/books/search"
import { normalizeIsbn } from "@/lib/books/isbn"

function LoadingSkeleton({ viewMode }: { readonly viewMode: "grid" | "list" }) {
  const items = Array.from({ length: 12 }, (_, i) => `skeleton-${i}`)

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((id) => (
          <div key={id} className="space-y-2">
            <Skeleton className="aspect-2/3 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((id) => (
        <Skeleton key={id} className="h-20 w-full rounded-md" />
      ))}
    </div>
  )
}

function SeriesListItem({
  series,
  onClick
}: {
  readonly series: SeriesWithVolumes
  readonly onClick: () => void
}) {
  const ownedCount = series.volumes.filter(
    (v) => v.ownership_status === "owned"
  ).length
  const totalCount = series.total_volumes || series.volumes.length
  const { primaryIsbn, volumeFallbackUrl } = useMemo(() => {
    const primaryVolume = series.volumes.find((volume) => volume.isbn)
    const fallbackVolume = series.volumes.find(
      (volume) => volume.cover_image_url
    )

    return {
      primaryIsbn: primaryVolume?.isbn ?? null,
      volumeFallbackUrl: fallbackVolume?.cover_image_url ?? null
    }
  }, [series.volumes])

  return (
    <button
      type="button"
      className="group hover:bg-primary/5 border-primary/10 hover:shadow-primary/5 flex w-full cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:shadow-md"
      onClick={onClick}
    >
      <div className="bg-muted relative h-16 w-12 shrink-0 overflow-hidden rounded-lg">
        <CoverImage
          isbn={primaryIsbn}
          coverImageUrl={series.cover_image_url}
          fallbackCoverImageUrl={volumeFallbackUrl}
          alt={series.title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          fallback={
            <div className="from-primary/5 to-copper/5 flex h-full w-full items-center justify-center bg-linear-to-br">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-primary/30 h-6 w-6"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
          }
        />
        <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display truncate font-medium">{series.title}</h3>
        <p className="text-muted-foreground truncate text-sm">
          {series.author || "Unknown Author"}
        </p>
      </div>
      <div className="text-muted-foreground text-sm">
        {ownedCount}/{totalCount} volumes
      </div>
    </button>
  )
}

type VolumeWithSeries = {
  volume: Volume
  series: SeriesWithVolumes
}

function VolumeGridItem({
  item,
  onClick,
  onEdit,
  onDelete
}: {
  readonly item: VolumeWithSeries
  readonly onClick: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
}) {
  const volumeLabel = `Volume ${item.volume.volume_number}`
  const volumeDescriptor = item.volume.title
    ? `${volumeLabel} • ${item.volume.title}`
    : volumeLabel
  const coverAlt = `${item.series.title} — ${volumeDescriptor}`

  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative cursor-pointer text-left transition-shadow hover:shadow-lg"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-md">
        <CoverImage
          isbn={item.volume.isbn}
          coverImageUrl={item.volume.cover_image_url}
          fallbackCoverImageUrl={item.series.cover_image_url}
          alt={coverAlt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          fallback={
            <div className="flex h-full items-center justify-center">
              <span className="text-muted-foreground/30 text-3xl font-bold">
                {item.volume.volume_number}
              </span>
              <span className="sr-only">{coverAlt}</span>
            </div>
          }
        />
        <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-8 w-8 items-center justify-center rounded-md"
              onClick={(event) => event.stopPropagation()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation()
                  onEdit()
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <p className="line-clamp-1 font-medium">{item.series.title}</p>
        <p className="text-muted-foreground line-clamp-2 text-xs">
          Vol. {item.volume.volume_number}
          {item.volume.title ? ` • ${item.volume.title}` : ""}
        </p>
      </div>
    </div>
  )
}

function VolumeListItem({
  item,
  onClick,
  onEdit,
  onDelete
}: {
  readonly item: VolumeWithSeries
  readonly onClick: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
}) {
  const volumeLabel = `Volume ${item.volume.volume_number}`
  const volumeDescriptor = item.volume.title
    ? `${volumeLabel} • ${item.volume.title}`
    : volumeLabel
  const coverAlt = `${item.series.title} — ${volumeDescriptor}`

  return (
    <div
      role="button"
      tabIndex={0}
      className="group hover:bg-primary/5 border-primary/10 hover:shadow-primary/5 relative flex w-full cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:shadow-md"
      onClick={onClick}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement

        if (target !== event.currentTarget) {
          if (
            target.closest(
              'button, a, input, textarea, select, [role="button"]'
            )
          ) {
            return
          }

          return
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <div className="bg-muted relative h-16 w-12 shrink-0 overflow-hidden rounded">
        <CoverImage
          isbn={item.volume.isbn}
          coverImageUrl={item.volume.cover_image_url}
          fallbackCoverImageUrl={item.series.cover_image_url}
          alt={coverAlt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-muted-foreground/50 text-sm font-semibold">
                {item.volume.volume_number}
              </span>
              <span className="sr-only">{coverAlt}</span>
            </div>
          }
        />
        <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium">{item.series.title}</h3>
        <p className="text-muted-foreground truncate text-sm">
          Vol. {item.volume.volume_number}
          {item.volume.title ? ` • ${item.volume.title}` : ""}
        </p>
        {item.series.author && (
          <p className="text-muted-foreground truncate text-xs">
            {item.series.author}
          </p>
        )}
      </div>
      <div className="text-muted-foreground text-xs capitalize">
        {item.volume.ownership_status}
      </div>
      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-8 w-8 items-center justify-center rounded-md"
            onClick={(event) => event.stopPropagation()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const router = useRouter()
  const {
    series,
    unassignedVolumes,
    filteredSeries,
    filteredVolumes,
    filteredUnassignedVolumes,
    isLoading,
    fetchSeries,
    createSeries,
    editSeries,
    removeSeries,
    createVolume,
    editVolume,
    removeVolume,
    addBookFromSearchResult,
    addBooksFromSearchResults
  } = useLibrary()

  const { viewMode, setSelectedSeries, collectionView, deleteSeriesVolumes } =
    useLibraryStore()

  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false)
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [pendingSeriesSelection, setPendingSeriesSelection] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSeries, setDeletingSeries] =
    useState<SeriesWithVolumes | null>(null)
  const [deleteVolumeDialogOpen, setDeleteVolumeDialogOpen] = useState(false)
  const [deletingVolume, setDeletingVolume] = useState<Volume | null>(null)

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  const existingEntries = useMemo(() => {
    const assigned = series.flatMap((seriesItem) =>
      seriesItem.volumes.map((volume) => ({
        title: volume.title ?? null,
        isbn: volume.isbn ?? null,
        author: seriesItem.author ?? null
      }))
    )
    const unassigned = unassignedVolumes.map((volume) => ({
      title: volume.title ?? null,
      isbn: volume.isbn ?? null,
      author: null
    }))
    return [...assigned, ...unassigned]
  }, [series, unassignedVolumes])

  const existingIsbns = useMemo(() => {
    const normalized = existingEntries
      .map((item) => item.isbn)
      .filter((isbn): isbn is string => Boolean(isbn))
      .map((isbn) => normalizeIsbn(isbn))
      .filter((isbn) => isbn.length > 0)
    return Array.from(new Set(normalized))
  }, [existingEntries])

  const existingBookKeys = useMemo(() => {
    const keys = existingEntries
      .map((item) => normalizeBookKey(item.title, item.author))
      .filter((key): key is string => Boolean(key))
    return Array.from(new Set(keys))
  }, [existingEntries])

  const getNextVolumeNumber = useCallback(
    (seriesId: string | null) => {
      if (!seriesId) return 1
      const targetSeries = series.find((item) => item.id === seriesId)
      if (!targetSeries) return 1
      const maxVolume = targetSeries.volumes.reduce(
        (max, volume) => Math.max(max, volume.volume_number),
        0
      )
      return maxVolume + 1
    },
    [series]
  )

  const handleAddSeries = async (data: Parameters<typeof createSeries>[0]) => {
    try {
      const createdSeries = await createSeries(data)
      toast.success("Series added successfully")
      if (pendingSeriesSelection) {
        setSelectedSeriesId(createdSeries.id)
        setPendingSeriesSelection(false)
      }
    } catch {
      toast.error("Failed to add series")
    }
  }

  const handleEditSeries = async (data: Parameters<typeof createSeries>[0]) => {
    if (!editingSeries) return
    try {
      await editSeries(editingSeries.id, data)
      toast.success("Series updated successfully")
      setEditingSeries(null)
    } catch {
      toast.error("Failed to update series")
    }
  }

  const handleDeleteSeries = async () => {
    if (!deletingSeries) return
    try {
      await removeSeries(deletingSeries.id)
      toast.success("Series deleted successfully")
      setDeletingSeries(null)
      setDeleteDialogOpen(false)
    } catch {
      toast.error("Failed to delete series")
    }
  }

  const handleAddVolume = async (data: Parameters<typeof createVolume>[1]) => {
    try {
      await createVolume(selectedSeriesId ?? null, data)
      toast.success("Book added successfully")
    } catch {
      toast.error("Failed to add book")
    }
  }

  const handleEditVolume = async (data: Parameters<typeof createVolume>[1]) => {
    if (!editingVolume) return
    const currentSeriesId = editingVolume.series_id ?? null
    const nextSeriesId = selectedSeriesId ?? null

    try {
      await editVolume(currentSeriesId, editingVolume.id, {
        ...data,
        series_id: nextSeriesId
      })
      toast.success("Book updated successfully")
      setEditingVolume(null)
    } catch {
      toast.error("Failed to update book")
    }
  }

  const handleDeleteVolume = async () => {
    if (!deletingVolume) return
    try {
      await removeVolume(deletingVolume.series_id ?? null, deletingVolume.id)
      toast.success("Book deleted successfully")
      setDeletingVolume(null)
      setDeleteVolumeDialogOpen(false)
    } catch {
      toast.error("Failed to delete book")
    }
  }

  const openEditDialog = useCallback((series: SeriesWithVolumes) => {
    setEditingSeries(series)
    setSeriesDialogOpen(true)
  }, [])

  const openDeleteDialog = useCallback((series: SeriesWithVolumes) => {
    setDeletingSeries(series)
    setDeleteDialogOpen(true)
  }, [])

  const openEditVolumeDialog = useCallback((volume: Volume) => {
    setEditingVolume(volume)
    setSelectedSeriesId(volume.series_id ?? null)
    setVolumeDialogOpen(true)
  }, [])

  const openDeleteVolumeDialog = useCallback((volume: Volume) => {
    setDeletingVolume(volume)
    setDeleteVolumeDialogOpen(true)
  }, [])

  const handleSeriesClick = useCallback(
    (series: SeriesWithVolumes) => {
      setSelectedSeries(series)
      router.push(`/library/series/${series.id}`)
    },
    [setSelectedSeries, router]
  )

  const handleVolumeClick = useCallback(
    (volumeId: string) => {
      router.push(`/library/volume/${volumeId}`)
    },
    [router]
  )

  const openAddDialog = useCallback(() => {
    setEditingSeries(null)
    setSearchDialogOpen(true)
  }, [])

  const openAddSeriesDialog = useCallback(() => {
    setEditingSeries(null)
    setPendingSeriesSelection(false)
    setSeriesDialogOpen(true)
  }, [])

  const openManualDialog = useCallback(() => {
    setSearchDialogOpen(false)
    setEditingVolume(null)
    setSelectedSeriesId(null)
    setPendingSeriesSelection(false)
    setVolumeDialogOpen(true)
  }, [])

  const openSeriesDialogFromVolume = useCallback(() => {
    setEditingSeries(null)
    setPendingSeriesSelection(true)
    setSeriesDialogOpen(true)
  }, [])

  const handleSearchSelect = useCallback(
    async (
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      try {
        await addBookFromSearchResult(result, options)
        toast.success("Book added successfully")
      } catch {
        toast.error("Failed to add book")
      }
    },
    [addBookFromSearchResult]
  )

  const handleSearchSelectMany = useCallback(
    async (
      results: BookSearchResult[],
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      const { successCount, failureCount } = await addBooksFromSearchResults(
        results,
        options
      )

      if (successCount > 0) {
        toast.success(
          `${successCount} book${successCount === 1 ? "" : "s"} added`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} book${failureCount === 1 ? "" : "s"} failed to add`
        )
      }
    },
    [addBooksFromSearchResults]
  )

  const renderUnassignedSection = () => {
    if (filteredUnassignedVolumes.length === 0) return null

    return (
      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Unassigned Books</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredUnassignedVolumes.map((volume) => (
            <VolumeCard
              key={volume.id}
              volume={volume}
              onClick={() => handleVolumeClick(volume.id)}
              onEdit={() => openEditVolumeDialog(volume)}
              onDelete={() => openDeleteVolumeDialog(volume)}
            />
          ))}
        </div>
      </div>
    )
  }

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton viewMode={viewMode} />
    }

    if (collectionView === "volumes") {
      const hasAssignedVolumes = filteredVolumes.length > 0
      const hasUnassignedVolumes = filteredUnassignedVolumes.length > 0

      if (!hasAssignedVolumes && !hasUnassignedVolumes) {
        return (
          <EmptyState
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground h-8 w-8"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            }
            title="No volumes found"
            description="Search for a book to add your first volume"
            action={{
              label: "Add Book",
              onClick: openAddDialog
            }}
          />
        )
      }

      return (
        <div className="space-y-8">
          {hasAssignedVolumes &&
            (viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredVolumes.map((item) => (
                  <VolumeGridItem
                    key={item.volume.id}
                    item={item}
                    onClick={() => handleVolumeClick(item.volume.id)}
                    onEdit={() => openEditVolumeDialog(item.volume)}
                    onDelete={() => openDeleteVolumeDialog(item.volume)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVolumes.map((item) => (
                  <VolumeListItem
                    key={item.volume.id}
                    item={item}
                    onClick={() => handleVolumeClick(item.volume.id)}
                    onEdit={() => openEditVolumeDialog(item.volume)}
                    onDelete={() => openDeleteVolumeDialog(item.volume)}
                  />
                ))}
              </div>
            ))}
          {renderUnassignedSection()}
        </div>
      )
    }

    if (filteredSeries.length === 0 && filteredUnassignedVolumes.length === 0) {
      return (
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground h-8 w-8"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          }
          title="No series found"
          description="Start building your collection by adding your first series"
          action={{
            label: "Add Book",
            onClick: openAddDialog
          }}
        />
      )
    }

    if (viewMode === "grid") {
      return (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredSeries.map((series) => (
              <SeriesCard
                key={series.id}
                series={series}
                onEdit={() => openEditDialog(series)}
                onDelete={() => openDeleteDialog(series)}
                onClick={() => handleSeriesClick(series)}
              />
            ))}
          </div>
          {renderUnassignedSection()}
        </div>
      )
    }

    return (
      <div className="space-y-8">
        <div className="space-y-2">
          {filteredSeries.map((series) => (
            <SeriesListItem
              key={series.id}
              series={series}
              onClick={() => handleSeriesClick(series)}
            />
          ))}
        </div>
        {renderUnassignedSection()}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          My Library
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your light novel and manga collection
        </p>
      </div>

      <LibraryToolbar
        onAddBook={openAddDialog}
        onAddSeries={openAddSeriesDialog}
      />

      <div className="mt-6">{renderContent()}</div>

      <BookSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectResult={handleSearchSelect}
        onSelectResults={handleSearchSelectMany}
        onAddManual={openManualDialog}
        context="series"
        existingIsbns={existingIsbns}
        existingBookKeys={existingBookKeys}
      />

      <VolumeDialog
        open={volumeDialogOpen}
        onOpenChange={(open) => {
          setVolumeDialogOpen(open)
          if (!open) {
            setEditingVolume(null)
            setSelectedSeriesId(null)
            setPendingSeriesSelection(false)
          }
        }}
        volume={editingVolume}
        nextVolumeNumber={getNextVolumeNumber(selectedSeriesId)}
        onSubmit={editingVolume ? handleEditVolume : handleAddVolume}
        seriesOptions={series}
        selectedSeriesId={selectedSeriesId}
        onSeriesChange={setSelectedSeriesId}
        onCreateSeries={openSeriesDialogFromVolume}
        allowNoSeries
      />

      <SeriesDialog
        open={seriesDialogOpen}
        onOpenChange={(open) => {
          setSeriesDialogOpen(open)
          if (!open) {
            setEditingSeries(null)
            setPendingSeriesSelection(false)
          }
        }}
        series={editingSeries}
        onSubmit={editingSeries ? handleEditSeries : handleAddSeries}
      />

      <AlertDialog
        open={deleteVolumeDialogOpen}
        onOpenChange={setDeleteVolumeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this book? This action cannot be
              undone.
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Series</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingSeries?.title}
              &quot;?{" "}
              {deleteSeriesVolumes
                ? "This will also delete all volumes associated with this series."
                : "The volumes will be kept and moved to Unassigned Books."}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSeries}
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
