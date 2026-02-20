"use client"

import { useMemo, useState } from "react"

import { EmptyState } from "@/components/empty-state"
import { VirtualizedWindowGrid } from "@/components/library/virtualized-window"
import { VolumeCard } from "@/components/library/volume-card"
import { VolumeSelectionBar } from "@/components/library/volume-selection-bar"
import { Button } from "@/components/ui/button"
import { useWindowWidth } from "@/lib/hooks/use-window-width"
import type {
  OwnershipStatus,
  ReadingStatus,
  SeriesWithVolumes,
  Volume
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
  onSelectVolume,
  onMarkAllAboveAsRead,
  onGapCardClick
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
  readonly onMarkAllAboveAsRead: (volume: Volume) => void
  readonly onGapCardClick: (volumeNumber: number) => void
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

  const [showGapCards, setShowGapCards] = useState(true)

  const gapVolumeNumbers = useMemo(() => {
    if (sortedVolumes.length === 0) return []
    const ownedOrWishlisted = new Set(sortedVolumes.map((v) => v.volume_number))
    const maxNum = sortedVolumes.at(-1)!.volume_number
    const minNum = sortedVolumes[0].volume_number
    const gaps: number[] = []
    for (let n = minNum; n <= maxNum; n++) {
      if (!ownedOrWishlisted.has(n)) {
        gaps.push(n)
      }
    }
    return gaps
  }, [sortedVolumes])

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
          {gapVolumeNumbers.length > 0 && (
            <Button
              variant={showGapCards ? "secondary" : "outline"}
              size="sm"
              className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
              onClick={() => setShowGapCards((prev) => !prev)}
              aria-pressed={showGapCards}
              aria-label={
                showGapCards ? "Hide missing volumes" : "Show missing volumes"
              }
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
                <rect x="2" y="3" width="6" height="18" rx="1" />
                <rect
                  x="9"
                  y="3"
                  width="6"
                  height="18"
                  rx="1"
                  ry="1"
                  strokeDasharray="4 2"
                />
                <rect x="16" y="3" width="6" height="18" rx="1" />
              </svg>
              Gaps
            </Button>
          )}
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
          actions={[
            {
              label: "Add Volume",
              onClick: onOpenAdd
            }
          ]}
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
              renderItem={(volume, index) => (
                <VolumeCard
                  volume={volume}
                  priority={index < 8}
                  seriesTitle={currentSeries.title}
                  onClick={() => onVolumeClick(volume.id)}
                  onScrapePrice={() => onScrapeVolume(volume)}
                  onEdit={() => onEditVolume(volume)}
                  onDelete={() => onDeleteVolume(volume)}
                  onToggleRead={() => onToggleRead(volume)}
                  onToggleWishlist={() => onToggleWishlist(volume)}
                  onSetRating={(rating) => onSetRating(volume, rating)}
                  onMarkAllAboveAsRead={() => onMarkAllAboveAsRead(volume)}
                  selected={selectedVolumeIds.has(volume.id)}
                  onSelect={() => onSelectVolume(volume.id)}
                />
              )}
            />
          ) : (
            <div className="grid-stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {(() => {
                const gapSet = showGapCards
                  ? new Set(gapVolumeNumbers)
                  : new Set<number>()
                const maxNum =
                  sortedVolumes.length > 0
                    ? sortedVolumes.at(-1)!.volume_number
                    : 0
                const minNum =
                  sortedVolumes.length > 0 ? sortedVolumes[0].volume_number : 0
                const items = []
                const volumeMap = new Map(
                  sortedVolumes.map((v) => [v.volume_number, v])
                )
                let volIndex = 0
                for (let n = minNum; n <= maxNum; n++) {
                  const vol = volumeMap.get(n)
                  if (vol) {
                    items.push(
                      <VolumeCard
                        key={vol.id}
                        volume={vol}
                        priority={volIndex < 8}
                        seriesTitle={currentSeries.title}
                        onClick={() => onVolumeClick(vol.id)}
                        onScrapePrice={() => onScrapeVolume(vol)}
                        onEdit={() => onEditVolume(vol)}
                        onDelete={() => onDeleteVolume(vol)}
                        onToggleRead={() => onToggleRead(vol)}
                        onToggleWishlist={() => onToggleWishlist(vol)}
                        onSetRating={(rating) => onSetRating(vol, rating)}
                        onMarkAllAboveAsRead={() => onMarkAllAboveAsRead(vol)}
                        selected={selectedVolumeIds.has(vol.id)}
                        onSelect={() => onSelectVolume(vol.id)}
                      />
                    )
                    volIndex++
                  } else if (gapSet.has(n)) {
                    items.push(
                      <button
                        key={`gap-${n}`}
                        type="button"
                        onClick={() => onGapCardClick(n)}
                        aria-label={`Missing Volume ${n} — click to search`}
                        className="group hover:border-primary/60 hover:bg-primary/5 relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-dashed transition-all hover:shadow-md active:scale-[0.98]"
                      >
                        <div className="bg-muted/30 relative flex aspect-2/3 items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-muted-foreground/40 group-hover:text-primary/60 h-8 w-8 transition-colors"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v8" />
                            <path d="M8 12h8" />
                          </svg>
                        </div>
                        <div className="p-3 text-center">
                          <span className="text-muted-foreground/60 font-display group-hover:text-primary/70 text-sm font-semibold">
                            Vol. {n}
                          </span>
                          <p className="text-muted-foreground/50 group-hover:text-primary/60 mt-0.5 text-xs">
                            Missing
                          </p>
                        </div>
                      </button>
                    )
                  }
                }
                return items
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
