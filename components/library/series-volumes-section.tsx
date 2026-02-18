"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { VolumeCard } from "@/components/library/volume-card"
import { VolumeSelectionBar } from "@/components/library/volume-selection-bar"
import { VirtualizedWindowGrid } from "@/components/library/virtualized-window"
import { EmptyState } from "@/components/empty-state"
import { useWindowWidth } from "@/lib/hooks/use-window-width"
import type {
  SeriesWithVolumes,
  Volume,
  OwnershipStatus,
  ReadingStatus
} from "@/lib/types/database"

/** Item count above which series detail volumes switch to virtualization. @source */
const VIRTUALIZE_THRESHOLD = 200

/** Series volumes section with selection, bulk actions, and volume grid. @source */
export function SeriesVolumesSection({
  currentSeries,
  selectedVolumeIds,
  selectedCount,
  totalSelectableCount,
  isAllSelected,
  onOpenBulkScrape,
  onOpenAdd,
  onSelectAll,
  onClearSelection,
  onApplyOwnership,
  onApplyReading,
  onEditSelected,
  onBulkDelete,
  onCancelSelection,
  onVolumeClick,
  onScrapeVolume,
  onEditVolume,
  onDeleteVolume,
  onToggleRead,
  onToggleWishlist,
  onSetRating,
  onSelectVolume
}: {
  readonly currentSeries: SeriesWithVolumes
  readonly selectedVolumeIds: Set<string>
  readonly selectedCount: number
  readonly totalSelectableCount: number
  readonly isAllSelected: boolean
  readonly onOpenBulkScrape: () => void
  readonly onOpenAdd: () => void
  readonly onSelectAll: () => void
  readonly onClearSelection: () => void
  readonly onApplyOwnership: (status: OwnershipStatus) => void
  readonly onApplyReading: (status: ReadingStatus) => void
  readonly onEditSelected: () => void
  readonly onBulkDelete: () => void
  readonly onCancelSelection: () => void
  readonly onVolumeClick: (volumeId: string) => void
  readonly onScrapeVolume: (volume: Volume) => void
  readonly onEditVolume: (volume: Volume) => void
  readonly onDeleteVolume: (volume: Volume) => void
  readonly onToggleRead: (volume: Volume) => void
  readonly onToggleWishlist: (volume: Volume) => void
  readonly onSetRating: (volume: Volume, rating: number | null) => void
  readonly onSelectVolume: (volumeId: string) => void
}) {
  const windowWidth = useWindowWidth()
  const columnCount = useMemo(() => {
    if (windowWidth >= 1024) return 6
    if (windowWidth >= 768) return 4
    if (windowWidth >= 640) return 3
    return 2
  }, [windowWidth])

  const sortedVolumes = useMemo(() => {
    return currentSeries.volumes.toSorted(
      (a, b) => a.volume_number - b.volume_number
    )
  }, [currentSeries.volumes])

  const shouldVirtualize = sortedVolumes.length > VIRTUALIZE_THRESHOLD

  return (
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
              onClick={onOpenBulkScrape}
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
            onClick={onOpenAdd}
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

      <VolumeSelectionBar
        selectedCount={selectedCount}
        totalSelectableCount={totalSelectableCount}
        isAllSelected={isAllSelected}
        onSelectAll={onSelectAll}
        onClear={onClearSelection}
        onEdit={onEditSelected}
        onDelete={onBulkDelete}
        onCancel={onCancelSelection}
        onApplyOwnership={onApplyOwnership}
        onApplyReading={onApplyReading}
        onBulkScrape={onOpenBulkScrape}
      />

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
            onClick: onOpenAdd
          }}
          tip="Search by title or ISBN to find and add volumes"
        />
      ) : (
        <div className="animate-fade-in-up">
          {shouldVirtualize ? (
            <VirtualizedWindowGrid
              items={sortedVolumes}
              columnCount={columnCount}
              gapPx={16}
              estimateRowSize={() => 380}
              getItemKey={(volume) => volume.id}
              renderItem={(volume) => (
                <VolumeCard
                  volume={volume}
                  seriesTitle={currentSeries.title}
                  onClick={() => onVolumeClick(volume.id)}
                  onScrapePrice={() => onScrapeVolume(volume)}
                  onEdit={() => onEditVolume(volume)}
                  onDelete={() => onDeleteVolume(volume)}
                  onToggleRead={() => onToggleRead(volume)}
                  onToggleWishlist={() => onToggleWishlist(volume)}
                  onSetRating={(rating) => onSetRating(volume, rating)}
                  selected={selectedVolumeIds.has(volume.id)}
                  onSelect={() => onSelectVolume(volume.id)}
                />
              )}
            />
          ) : (
            <div className="grid-stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {sortedVolumes.map((volume) => (
                <VolumeCard
                  key={volume.id}
                  volume={volume}
                  seriesTitle={currentSeries.title}
                  onClick={() => onVolumeClick(volume.id)}
                  onScrapePrice={() => onScrapeVolume(volume)}
                  onEdit={() => onEditVolume(volume)}
                  onDelete={() => onDeleteVolume(volume)}
                  onToggleRead={() => onToggleRead(volume)}
                  onToggleWishlist={() => onToggleWishlist(volume)}
                  onSetRating={(rating) => onSetRating(volume, rating)}
                  selected={selectedVolumeIds.has(volume.id)}
                  onSelect={() => onSelectVolume(volume.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
