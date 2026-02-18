"use client"

import { memo } from "react"
import { SeriesCard } from "@/components/library/series-card"
import { SeriesListItem } from "@/components/library/series-list-item"
import { VolumeGridItem } from "@/components/library/volume-grid-item"
import { VolumeListItem } from "@/components/library/volume-list-item"
import { VolumeCard } from "@/components/library/volume-card"
import {
  VirtualizedWindowGrid,
  VirtualizedWindowList
} from "@/components/library/virtualized-window"
import { LoadingSkeleton } from "@/components/library/library-skeleton"
import { EmptyState } from "@/components/empty-state"
import {
  getGridClasses,
  VIRTUALIZE_THRESHOLD,
  estimateGridRowSize
} from "@/lib/library/grid-utils"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"
import type { VolumeWithSeries } from "@/lib/hooks/use-library-filters"
import type { CardSize } from "@/lib/store/settings-store"

interface LibraryContentProps {
  readonly filteredSeries: SeriesWithVolumes[]
  readonly filteredVolumes: VolumeWithSeries[]
  readonly filteredUnassignedVolumes: Volume[]
  readonly isLoading: boolean
  readonly viewMode: "grid" | "list"
  readonly collectionView: "series" | "volumes"
  readonly cardSize: CardSize
  readonly gridColumnCount: number
  readonly gridGapPx: number
  readonly amazonDomain: string
  readonly amazonBindingLabel: string
  readonly selectedSeriesIds: Set<string>
  readonly selectedVolumeIds: Set<string>
  readonly onSeriesItemClick: (series: SeriesWithVolumes) => void
  readonly onEditSeries: (series: SeriesWithVolumes) => void
  readonly onDeleteSeries: (series: SeriesWithVolumes) => void
  readonly onSeriesScrape: (series: SeriesWithVolumes) => void
  readonly onToggleSeriesSelection: (seriesId: string) => void
  readonly onVolumeItemClick: (volumeId: string) => void
  readonly onEditVolume: (volume: Volume) => void
  readonly onDeleteVolume: (volume: Volume) => void
  readonly onVolumeScrape: (volume: Volume, series?: SeriesWithVolumes) => void
  readonly onToggleVolumeSelection: (volumeId: string) => void
  readonly onToggleRead: (volume: Volume) => void
  readonly onToggleWishlist: (volume: Volume) => void
  readonly onSetRating: (volume: Volume, rating: number | null) => void
  readonly onAddBook: () => void
}

const BookIcon = (
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
)

export const LibraryContent = memo(function LibraryContent(
  props: LibraryContentProps
) {
  const {
    filteredSeries,
    filteredVolumes,
    filteredUnassignedVolumes,
    isLoading,
    viewMode,
    collectionView,
    cardSize,
    gridColumnCount,
    gridGapPx,
    amazonDomain,
    amazonBindingLabel,
    selectedSeriesIds,
    selectedVolumeIds,
    onSeriesItemClick,
    onEditSeries,
    onDeleteSeries,
    onSeriesScrape,
    onToggleSeriesSelection,
    onVolumeItemClick,
    onEditVolume,
    onDeleteVolume,
    onVolumeScrape,
    onToggleVolumeSelection,
    onToggleRead,
    onToggleWishlist,
    onSetRating,
    onAddBook
  } = props

  if (isLoading) {
    return <LoadingSkeleton viewMode={viewMode} />
  }

  return collectionView === "volumes" ? (
    <VolumesView
      filteredVolumes={filteredVolumes}
      filteredUnassignedVolumes={filteredUnassignedVolumes}
      viewMode={viewMode}
      cardSize={cardSize}
      gridColumnCount={gridColumnCount}
      gridGapPx={gridGapPx}
      amazonDomain={amazonDomain}
      amazonBindingLabel={amazonBindingLabel}
      selectedVolumeIds={selectedVolumeIds}
      onVolumeItemClick={onVolumeItemClick}
      onEditVolume={onEditVolume}
      onDeleteVolume={onDeleteVolume}
      onVolumeScrape={onVolumeScrape}
      onToggleVolumeSelection={onToggleVolumeSelection}
      onToggleRead={onToggleRead}
      onToggleWishlist={onToggleWishlist}
      onSetRating={onSetRating}
      onAddBook={onAddBook}
    />
  ) : (
    <SeriesView
      filteredSeries={filteredSeries}
      filteredUnassignedVolumes={filteredUnassignedVolumes}
      viewMode={viewMode}
      cardSize={cardSize}
      gridColumnCount={gridColumnCount}
      gridGapPx={gridGapPx}
      selectedSeriesIds={selectedSeriesIds}
      selectedVolumeIds={selectedVolumeIds}
      onSeriesItemClick={onSeriesItemClick}
      onEditSeries={onEditSeries}
      onDeleteSeries={onDeleteSeries}
      onSeriesScrape={onSeriesScrape}
      onToggleSeriesSelection={onToggleSeriesSelection}
      onVolumeItemClick={onVolumeItemClick}
      onEditVolume={onEditVolume}
      onDeleteVolume={onDeleteVolume}
      onVolumeScrape={onVolumeScrape}
      onToggleVolumeSelection={onToggleVolumeSelection}
      onToggleRead={onToggleRead}
      onToggleWishlist={onToggleWishlist}
      onSetRating={onSetRating}
      onAddBook={onAddBook}
    />
  )
})

/* ------------------------------------------------------------------ */
/*  Unassigned section                                                */
/* ------------------------------------------------------------------ */

interface UnassignedSectionProps {
  readonly filteredUnassignedVolumes: Volume[]
  readonly cardSize: CardSize
  readonly gridColumnCount: number
  readonly gridGapPx: number
  readonly selectedVolumeIds: Set<string>
  readonly onVolumeItemClick: (volumeId: string) => void
  readonly onEditVolume: (volume: Volume) => void
  readonly onDeleteVolume: (volume: Volume) => void
  readonly onVolumeScrape: (volume: Volume) => void
  readonly onToggleVolumeSelection: (volumeId: string) => void
  readonly onToggleRead: (volume: Volume) => void
  readonly onToggleWishlist: (volume: Volume) => void
  readonly onSetRating: (volume: Volume, rating: number | null) => void
}

function UnassignedSection({
  filteredUnassignedVolumes,
  cardSize,
  gridColumnCount,
  gridGapPx,
  selectedVolumeIds,
  onVolumeItemClick,
  onEditVolume,
  onDeleteVolume,
  onVolumeScrape,
  onToggleVolumeSelection,
  onToggleRead,
  onToggleWishlist,
  onSetRating
}: UnassignedSectionProps) {
  if (filteredUnassignedVolumes.length === 0) return null

  return (
    <div className="animate-fade-in-up stagger-3 mt-10 space-y-4 border-t pt-10">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
            Uncategorized
          </span>
          <h2 className="font-display text-lg font-semibold">
            Unassigned Books
          </h2>
        </div>
      </div>
      {filteredUnassignedVolumes.length > VIRTUALIZE_THRESHOLD ? (
        <VirtualizedWindowGrid
          items={filteredUnassignedVolumes}
          columnCount={gridColumnCount}
          gapPx={gridGapPx}
          estimateRowSize={() => estimateGridRowSize(cardSize)}
          getItemKey={(volume) => volume.id}
          renderItem={(volume) => (
            <VolumeCard
              volume={volume}
              onClick={() => onVolumeItemClick(volume.id)}
              onEdit={() => onEditVolume(volume)}
              onDelete={() => onDeleteVolume(volume)}
              onScrapePrice={() => onVolumeScrape(volume)}
              onToggleRead={() => onToggleRead(volume)}
              onToggleWishlist={() => onToggleWishlist(volume)}
              onSetRating={(rating) => onSetRating(volume, rating)}
              selected={selectedVolumeIds.has(volume.id)}
              onSelect={() => onToggleVolumeSelection(volume.id)}
            />
          )}
        />
      ) : (
        <div className={`grid-stagger ${getGridClasses(cardSize)}`}>
          {filteredUnassignedVolumes.map((volume) => (
            <VolumeCard
              key={volume.id}
              volume={volume}
              onClick={() => onVolumeItemClick(volume.id)}
              onEdit={() => onEditVolume(volume)}
              onDelete={() => onDeleteVolume(volume)}
              onScrapePrice={() => onVolumeScrape(volume)}
              onToggleRead={() => onToggleRead(volume)}
              onToggleWishlist={() => onToggleWishlist(volume)}
              onSetRating={(rating) => onSetRating(volume, rating)}
              selected={selectedVolumeIds.has(volume.id)}
              onSelect={() => onToggleVolumeSelection(volume.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Volumes view                                                      */
/* ------------------------------------------------------------------ */

interface VolumesViewProps {
  readonly filteredVolumes: VolumeWithSeries[]
  readonly filteredUnassignedVolumes: Volume[]
  readonly viewMode: "grid" | "list"
  readonly cardSize: CardSize
  readonly gridColumnCount: number
  readonly gridGapPx: number
  readonly amazonDomain: string
  readonly amazonBindingLabel: string
  readonly selectedVolumeIds: Set<string>
  readonly onVolumeItemClick: (volumeId: string) => void
  readonly onEditVolume: (volume: Volume) => void
  readonly onDeleteVolume: (volume: Volume) => void
  readonly onVolumeScrape: (volume: Volume, series?: SeriesWithVolumes) => void
  readonly onToggleVolumeSelection: (volumeId: string) => void
  readonly onToggleRead: (volume: Volume) => void
  readonly onToggleWishlist: (volume: Volume) => void
  readonly onSetRating: (volume: Volume, rating: number | null) => void
  readonly onAddBook: () => void
}

function VolumesView({
  filteredVolumes,
  filteredUnassignedVolumes,
  viewMode,
  cardSize,
  gridColumnCount,
  gridGapPx,
  amazonDomain,
  amazonBindingLabel,
  selectedVolumeIds,
  onVolumeItemClick,
  onEditVolume,
  onDeleteVolume,
  onVolumeScrape,
  onToggleVolumeSelection,
  onToggleRead,
  onToggleWishlist,
  onSetRating,
  onAddBook
}: VolumesViewProps) {
  const hasAssignedVolumes = filteredVolumes.length > 0
  const hasUnassignedVolumes = filteredUnassignedVolumes.length > 0

  if (!hasAssignedVolumes && !hasUnassignedVolumes) {
    return (
      <EmptyState
        icon={BookIcon}
        title="No volumes found"
        description="Search for a book to add your first volume"
        actions={[{ label: "Add Book", onClick: onAddBook }]}
        tip="You can also import your collection from a CSV file"
      />
    )
  }

  return (
    <div className="space-y-8">
      {hasAssignedVolumes &&
        (viewMode === "grid" ? (
          <div className="animate-fade-in-up">
            {filteredVolumes.length > VIRTUALIZE_THRESHOLD ? (
              <VirtualizedWindowGrid
                items={filteredVolumes}
                columnCount={gridColumnCount}
                gapPx={gridGapPx}
                estimateRowSize={() => estimateGridRowSize(cardSize)}
                getItemKey={(item) => item.volume.id}
                renderItem={(item) => (
                  <VolumeGridItem
                    item={item}
                    onClick={() => onVolumeItemClick(item.volume.id)}
                    onEdit={() => onEditVolume(item.volume)}
                    onDelete={() => onDeleteVolume(item.volume)}
                    onScrapePrice={() =>
                      onVolumeScrape(item.volume, item.series)
                    }
                    onToggleRead={() => onToggleRead(item.volume)}
                    onToggleWishlist={() => onToggleWishlist(item.volume)}
                    onSetRating={(rating) => onSetRating(item.volume, rating)}
                    amazonDomain={amazonDomain}
                    bindingLabel={amazonBindingLabel}
                    selected={selectedVolumeIds.has(item.volume.id)}
                    onSelect={() => onToggleVolumeSelection(item.volume.id)}
                  />
                )}
              />
            ) : (
              <div className={`grid-stagger ${getGridClasses(cardSize)}`}>
                {filteredVolumes.map((item) => (
                  <VolumeGridItem
                    key={item.volume.id}
                    item={item}
                    onClick={() => onVolumeItemClick(item.volume.id)}
                    onEdit={() => onEditVolume(item.volume)}
                    onDelete={() => onDeleteVolume(item.volume)}
                    onScrapePrice={() =>
                      onVolumeScrape(item.volume, item.series)
                    }
                    onToggleRead={() => onToggleRead(item.volume)}
                    onToggleWishlist={() => onToggleWishlist(item.volume)}
                    onSetRating={(rating) => onSetRating(item.volume, rating)}
                    amazonDomain={amazonDomain}
                    bindingLabel={amazonBindingLabel}
                    selected={selectedVolumeIds.has(item.volume.id)}
                    onSelect={() => onToggleVolumeSelection(item.volume.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-fade-in-up">
            {filteredVolumes.length > VIRTUALIZE_THRESHOLD ? (
              <VirtualizedWindowList
                items={filteredVolumes}
                estimateSize={() => 104}
                getItemKey={(item) => item.volume.id}
                renderItem={(item) => (
                  <div className="pb-2">
                    <VolumeListItem
                      item={item}
                      onClick={() => onVolumeItemClick(item.volume.id)}
                      onEdit={() => onEditVolume(item.volume)}
                      onDelete={() => onDeleteVolume(item.volume)}
                      onScrapePrice={() =>
                        onVolumeScrape(item.volume, item.series)
                      }
                      onToggleRead={() => onToggleRead(item.volume)}
                      onToggleWishlist={() => onToggleWishlist(item.volume)}
                      onSetRating={(rating) => onSetRating(item.volume, rating)}
                      amazonDomain={amazonDomain}
                      bindingLabel={amazonBindingLabel}
                      selected={selectedVolumeIds.has(item.volume.id)}
                      onSelect={() => onToggleVolumeSelection(item.volume.id)}
                    />
                  </div>
                )}
              />
            ) : (
              <div className="list-stagger space-y-2">
                {filteredVolumes.map((item) => (
                  <VolumeListItem
                    key={item.volume.id}
                    item={item}
                    onClick={() => onVolumeItemClick(item.volume.id)}
                    onEdit={() => onEditVolume(item.volume)}
                    onDelete={() => onDeleteVolume(item.volume)}
                    onScrapePrice={() =>
                      onVolumeScrape(item.volume, item.series)
                    }
                    onToggleRead={() => onToggleRead(item.volume)}
                    onToggleWishlist={() => onToggleWishlist(item.volume)}
                    onSetRating={(rating) => onSetRating(item.volume, rating)}
                    amazonDomain={amazonDomain}
                    bindingLabel={amazonBindingLabel}
                    selected={selectedVolumeIds.has(item.volume.id)}
                    onSelect={() => onToggleVolumeSelection(item.volume.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      <UnassignedSection
        filteredUnassignedVolumes={filteredUnassignedVolumes}
        cardSize={cardSize}
        gridColumnCount={gridColumnCount}
        gridGapPx={gridGapPx}
        selectedVolumeIds={selectedVolumeIds}
        onVolumeItemClick={onVolumeItemClick}
        onEditVolume={onEditVolume}
        onDeleteVolume={onDeleteVolume}
        onVolumeScrape={onVolumeScrape}
        onToggleVolumeSelection={onToggleVolumeSelection}
        onToggleRead={onToggleRead}
        onToggleWishlist={onToggleWishlist}
        onSetRating={onSetRating}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Series view                                                       */
/* ------------------------------------------------------------------ */

interface SeriesViewProps {
  readonly filteredSeries: SeriesWithVolumes[]
  readonly filteredUnassignedVolumes: Volume[]
  readonly viewMode: "grid" | "list"
  readonly cardSize: CardSize
  readonly gridColumnCount: number
  readonly gridGapPx: number
  readonly selectedSeriesIds: Set<string>
  readonly selectedVolumeIds: Set<string>
  readonly onSeriesItemClick: (series: SeriesWithVolumes) => void
  readonly onEditSeries: (series: SeriesWithVolumes) => void
  readonly onDeleteSeries: (series: SeriesWithVolumes) => void
  readonly onSeriesScrape: (series: SeriesWithVolumes) => void
  readonly onToggleSeriesSelection: (seriesId: string) => void
  readonly onVolumeItemClick: (volumeId: string) => void
  readonly onEditVolume: (volume: Volume) => void
  readonly onDeleteVolume: (volume: Volume) => void
  readonly onVolumeScrape: (volume: Volume) => void
  readonly onToggleVolumeSelection: (volumeId: string) => void
  readonly onToggleRead: (volume: Volume) => void
  readonly onToggleWishlist: (volume: Volume) => void
  readonly onSetRating: (volume: Volume, rating: number | null) => void
  readonly onAddBook: () => void
}

function SeriesView({
  filteredSeries,
  filteredUnassignedVolumes,
  viewMode,
  cardSize,
  gridColumnCount,
  gridGapPx,
  selectedSeriesIds,
  selectedVolumeIds,
  onSeriesItemClick,
  onEditSeries,
  onDeleteSeries,
  onSeriesScrape,
  onToggleSeriesSelection,
  onVolumeItemClick,
  onEditVolume,
  onDeleteVolume,
  onVolumeScrape,
  onToggleVolumeSelection,
  onToggleRead,
  onToggleWishlist,
  onSetRating,
  onAddBook
}: SeriesViewProps) {
  if (filteredSeries.length === 0 && filteredUnassignedVolumes.length === 0) {
    return (
      <EmptyState
        icon={BookIcon}
        title="No series found"
        description="Start building your collection by adding your first series"
        actions={[{ label: "Add Book", onClick: onAddBook }]}
        tip="Books are automatically grouped into series when added"
      />
    )
  }

  if (viewMode === "grid") {
    return (
      <div className="space-y-8">
        <div className="animate-fade-in-up">
          <div className="rounded-2xl">
            {filteredSeries.length > VIRTUALIZE_THRESHOLD ? (
              <VirtualizedWindowGrid
                items={filteredSeries}
                columnCount={gridColumnCount}
                gapPx={gridGapPx}
                estimateRowSize={() => estimateGridRowSize(cardSize)}
                getItemKey={(series) => series.id}
                renderItem={(series) => (
                  <SeriesCard
                    series={series}
                    onEdit={() => onEditSeries(series)}
                    onDelete={() => onDeleteSeries(series)}
                    onBulkScrape={() => onSeriesScrape(series)}
                    onClick={() => onSeriesItemClick(series)}
                    selected={selectedSeriesIds.has(series.id)}
                    onSelect={() => onToggleSeriesSelection(series.id)}
                  />
                )}
              />
            ) : (
              <div className={`grid-stagger ${getGridClasses(cardSize)}`}>
                {filteredSeries.map((series) => (
                  <SeriesCard
                    key={series.id}
                    series={series}
                    onEdit={() => onEditSeries(series)}
                    onDelete={() => onDeleteSeries(series)}
                    onBulkScrape={() => onSeriesScrape(series)}
                    onClick={() => onSeriesItemClick(series)}
                    selected={selectedSeriesIds.has(series.id)}
                    onSelect={() => onToggleSeriesSelection(series.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <UnassignedSection
          filteredUnassignedVolumes={filteredUnassignedVolumes}
          cardSize={cardSize}
          gridColumnCount={gridColumnCount}
          gridGapPx={gridGapPx}
          selectedVolumeIds={selectedVolumeIds}
          onVolumeItemClick={onVolumeItemClick}
          onEditVolume={onEditVolume}
          onDeleteVolume={onDeleteVolume}
          onVolumeScrape={onVolumeScrape}
          onToggleVolumeSelection={onToggleVolumeSelection}
          onToggleRead={onToggleRead}
          onToggleWishlist={onToggleWishlist}
          onSetRating={onSetRating}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up">
        {filteredSeries.length > VIRTUALIZE_THRESHOLD ? (
          <VirtualizedWindowList
            items={filteredSeries}
            estimateSize={() => 104}
            getItemKey={(series) => series.id}
            renderItem={(series) => (
              <div className="pb-2">
                <SeriesListItem
                  series={series}
                  onClick={() => onSeriesItemClick(series)}
                  onEdit={() => onEditSeries(series)}
                  onDelete={() => onDeleteSeries(series)}
                  selected={selectedSeriesIds.has(series.id)}
                  onSelect={() => onToggleSeriesSelection(series.id)}
                />
              </div>
            )}
          />
        ) : (
          <div className="list-stagger space-y-2">
            {filteredSeries.map((series) => (
              <SeriesListItem
                key={series.id}
                series={series}
                onClick={() => onSeriesItemClick(series)}
                onEdit={() => onEditSeries(series)}
                onDelete={() => onDeleteSeries(series)}
                selected={selectedSeriesIds.has(series.id)}
                onSelect={() => onToggleSeriesSelection(series.id)}
              />
            ))}
          </div>
        )}
      </div>
      <UnassignedSection
        filteredUnassignedVolumes={filteredUnassignedVolumes}
        cardSize={cardSize}
        gridColumnCount={gridColumnCount}
        gridGapPx={gridGapPx}
        selectedVolumeIds={selectedVolumeIds}
        onVolumeItemClick={onVolumeItemClick}
        onEditVolume={onEditVolume}
        onDeleteVolume={onDeleteVolume}
        onVolumeScrape={onVolumeScrape}
        onToggleVolumeSelection={onToggleVolumeSelection}
        onToggleRead={onToggleRead}
        onToggleWishlist={onToggleWishlist}
        onSetRating={onSetRating}
      />
    </div>
  )
}
