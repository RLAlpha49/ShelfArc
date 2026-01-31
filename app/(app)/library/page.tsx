"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { SeriesCard } from "@/components/library/series-card"
import { SeriesDialog } from "@/components/library/series-dialog"
import { LibraryToolbar } from "@/components/library/library-toolbar"
import { EmptyState } from "@/components/empty-state"
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
import type { Series, SeriesWithVolumes } from "@/lib/types/database"

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

  return (
    <button
      type="button"
      className="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-4 rounded-lg border p-4 text-left transition-colors"
      onClick={onClick}
    >
      <div className="bg-muted relative h-16 w-12 shrink-0 overflow-hidden rounded">
        {series.cover_image_url ? (
          <Image
            src={series.cover_image_url}
            alt={series.title}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-muted-foreground/50 h-6 w-6"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium">{series.title}</h3>
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

export default function LibraryPage() {
  const router = useRouter()
  const {
    filteredSeries,
    isLoading,
    fetchSeries,
    createSeries,
    editSeries,
    removeSeries
  } = useLibrary()

  const { viewMode, setSelectedSeries } = useLibraryStore()

  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSeries, setDeletingSeries] =
    useState<SeriesWithVolumes | null>(null)

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  const handleAddSeries = async (data: Parameters<typeof createSeries>[0]) => {
    try {
      await createSeries(data)
      toast.success("Series added successfully")
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

  const openEditDialog = useCallback((series: SeriesWithVolumes) => {
    setEditingSeries(series)
    setSeriesDialogOpen(true)
  }, [])

  const openDeleteDialog = useCallback((series: SeriesWithVolumes) => {
    setDeletingSeries(series)
    setDeleteDialogOpen(true)
  }, [])

  const handleSeriesClick = useCallback(
    (series: SeriesWithVolumes) => {
      setSelectedSeries(series)
      router.push(`/library/${series.id}`)
    },
    [setSelectedSeries, router]
  )

  const openAddDialog = useCallback(() => {
    setEditingSeries(null)
    setSeriesDialogOpen(true)
  }, [])

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton viewMode={viewMode} />
    }

    if (filteredSeries.length === 0) {
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
            label: "Add Series",
            onClick: openAddDialog
          }}
        />
      )
    }

    if (viewMode === "grid") {
      return (
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
      )
    }

    return (
      <div className="space-y-2">
        {filteredSeries.map((series) => (
          <SeriesListItem
            key={series.id}
            series={series}
            onClick={() => handleSeriesClick(series)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">My Library</h1>
        <p className="text-muted-foreground">
          Manage your light novel and manga collection
        </p>
      </div>

      <LibraryToolbar onAddSeries={openAddDialog} />

      <div className="mt-6">{renderContent()}</div>

      <SeriesDialog
        open={seriesDialogOpen}
        onOpenChange={(open) => {
          setSeriesDialogOpen(open)
          if (!open) setEditingSeries(null)
        }}
        series={editingSeries}
        onSubmit={editingSeries ? handleEditSeries : handleAddSeries}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Series</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingSeries?.title}
              &quot;? This will also delete all volumes associated with this
              series. This action cannot be undone.
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
