"use client"

import type { ReactNode } from "react"
import { createContext, useContext } from "react"

import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

export interface LibraryActionsContextValue {
  onSeriesItemClick: (series: SeriesWithVolumes) => void
  onEditSeries: (series: SeriesWithVolumes) => void
  onDeleteSeries: (series: SeriesWithVolumes) => void
  onSeriesScrape: (series: SeriesWithVolumes) => void
  onToggleSeriesSelection: (seriesId: string) => void
  onVolumeItemClick: (volumeId: string) => void
  onEditVolume: (volume: Volume) => void
  onDeleteVolume: (volume: Volume) => void
  onVolumeScrape: (volume: Volume, series?: SeriesWithVolumes) => void
  onToggleVolumeSelection: (volumeId: string) => void
  onToggleRead: (volume: Volume) => void
  onToggleWishlist: (volume: Volume) => void
  onSetRating: (volume: Volume, rating: number | null) => void
  onAddBook: () => void
}

const LibraryActionsContext = createContext<LibraryActionsContextValue | null>(
  null
)

export function LibraryActionsProvider({
  value,
  children
}: {
  readonly value: LibraryActionsContextValue
  readonly children: ReactNode
}) {
  return (
    <LibraryActionsContext.Provider value={value}>
      {children}
    </LibraryActionsContext.Provider>
  )
}

export function useLibraryActions(): LibraryActionsContextValue {
  const ctx = useContext(LibraryActionsContext)
  if (!ctx)
    throw new Error(
      "useLibraryActions must be used within LibraryActionsProvider"
    )
  return ctx
}
