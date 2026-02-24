"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { CollectionView } from "@/lib/store/library-store"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

import type { VolumeWithSeries } from "./library-filter-utils"

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Extend a selection set by range between two IDs in an ordered list. */
function addRangeToSet(
  ids: string[],
  anchorId: string,
  currentId: string,
  prev: Set<string>
): Set<string> {
  const anchorIdx = ids.indexOf(anchorId)
  const currentIdx = ids.indexOf(currentId)
  if (anchorIdx === -1 || currentIdx === -1) return prev
  const next = new Set(prev)
  const lo = Math.min(anchorIdx, currentIdx)
  const hi = Math.max(anchorIdx, currentIdx)
  for (let i = lo; i <= hi; i++) next.add(ids[i])
  return next
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseLibrarySelectionParams {
  readonly collectionView: CollectionView
  readonly filteredSeries: SeriesWithVolumes[]
  readonly filteredVolumes: VolumeWithSeries[]
  readonly filteredUnassignedVolumes: Volume[]
  readonly volumeLookup: Map<string, Volume>
  readonly onSeriesNavigate: (series: SeriesWithVolumes) => void
  readonly onVolumeNavigate: (volumeId: string) => void
}

export interface UseLibrarySelectionReturn {
  selectedSeriesIds: Set<string>
  selectedVolumeIds: Set<string>
  selectedCount: number
  totalSelectableCount: number
  isAllSelected: boolean
  selectedUnassignedVolumeIds: string[]
  selectedUnassignedCount: number
  selectedVolumeIdsArray: string[]
  clearSelection: () => void
  handleClearSelection: () => void
  toggleSeriesSelection: (id: string) => void
  toggleVolumeSelection: (id: string) => void
  handleSelectAll: () => void
  handleSeriesItemClick: (series: SeriesWithVolumes) => void
  handleVolumeItemClick: (volumeId: string) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages multi-select state and keyboard range-selection for the library.
 * Tracks shift/ctrl modifier keys via document-level listeners so they don't
 * need to be threaded through the card component tree.
 */
export function useLibrarySelection({
  collectionView,
  filteredSeries,
  filteredVolumes,
  filteredUnassignedVolumes,
  volumeLookup,
  onSeriesNavigate,
  onVolumeNavigate
}: UseLibrarySelectionParams): UseLibrarySelectionReturn {
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<string>>(
    () => new Set()
  )
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<Set<string>>(
    () => new Set()
  )

  // Modifier key tracking - updated via document listeners to avoid prop drilling
  const isShiftHeldRef = useRef(false)
  const isCtrlHeldRef = useRef(false)
  const lastSelectedSeriesIdRef = useRef<string | null>(null)
  const lastSelectedVolumeIdRef = useRef<string | null>(null)

  useEffect(() => {
    const onKeyChange = (e: KeyboardEvent) => {
      isShiftHeldRef.current = e.shiftKey
      isCtrlHeldRef.current = e.ctrlKey || e.metaKey
    }
    document.addEventListener("keydown", onKeyChange)
    document.addEventListener("keyup", onKeyChange)
    return () => {
      document.removeEventListener("keydown", onKeyChange)
      document.removeEventListener("keyup", onKeyChange)
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedSeriesIds(new Set())
    setSelectedVolumeIds(new Set())
    lastSelectedSeriesIdRef.current = null
    lastSelectedVolumeIdRef.current = null
  }, [])

  const handleClearSelection = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  const toggleSeriesSelection = useCallback((seriesId: string) => {
    setSelectedSeriesIds((prev) => {
      const next = new Set(prev)
      if (next.has(seriesId)) {
        next.delete(seriesId)
      } else {
        next.add(seriesId)
      }
      return next
    })
  }, [])

  const toggleVolumeSelection = useCallback((volumeId: string) => {
    setSelectedVolumeIds((prev) => {
      const next = new Set(prev)
      if (next.has(volumeId)) {
        next.delete(volumeId)
      } else {
        next.add(volumeId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (collectionView === "series") {
      setSelectedSeriesIds(new Set(filteredSeries.map((item) => item.id)))
      return
    }
    const nextIds = new Set(filteredVolumes.map((item) => item.volume.id))
    for (const volume of filteredUnassignedVolumes) {
      nextIds.add(volume.id)
    }
    setSelectedVolumeIds(nextIds)
  }, [
    collectionView,
    filteredSeries,
    filteredVolumes,
    filteredUnassignedVolumes
  ])

  const handleSeriesItemClick = useCallback(
    (seriesItem: SeriesWithVolumes) => {
      const anchor = lastSelectedSeriesIdRef.current
      if (isShiftHeldRef.current && anchor) {
        const ids = filteredSeries.map((s) => s.id)
        setSelectedSeriesIds((prev) =>
          addRangeToSet(ids, anchor, seriesItem.id, prev)
        )
        return
      }
      if (isCtrlHeldRef.current || selectedSeriesIds.size > 0) {
        toggleSeriesSelection(seriesItem.id)
        lastSelectedSeriesIdRef.current = seriesItem.id
        return
      }
      lastSelectedSeriesIdRef.current = seriesItem.id
      onSeriesNavigate(seriesItem)
    },
    [
      selectedSeriesIds.size,
      toggleSeriesSelection,
      onSeriesNavigate,
      filteredSeries
    ]
  )

  const handleVolumeItemClick = useCallback(
    (volumeId: string) => {
      const anchor = lastSelectedVolumeIdRef.current
      if (isShiftHeldRef.current && anchor) {
        const ids = [
          ...filteredVolumes.map((item) => item.volume.id),
          ...filteredUnassignedVolumes.map((v) => v.id)
        ]
        setSelectedVolumeIds((prev) =>
          addRangeToSet(ids, anchor, volumeId, prev)
        )
        return
      }
      if (isCtrlHeldRef.current || selectedVolumeIds.size > 0) {
        toggleVolumeSelection(volumeId)
        lastSelectedVolumeIdRef.current = volumeId
        return
      }
      lastSelectedVolumeIdRef.current = volumeId
      onVolumeNavigate(volumeId)
    },
    [
      selectedVolumeIds.size,
      toggleVolumeSelection,
      onVolumeNavigate,
      filteredVolumes,
      filteredUnassignedVolumes
    ]
  )

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const selectedIds =
    collectionView === "series" ? selectedSeriesIds : selectedVolumeIds
  const selectedCount = selectedIds.size
  const totalSelectableCount =
    collectionView === "series"
      ? filteredSeries.length
      : filteredVolumes.length + filteredUnassignedVolumes.length
  const isAllSelected =
    totalSelectableCount > 0 && selectedCount === totalSelectableCount

  const selectedUnassignedVolumeIds = useMemo(() => {
    if (collectionView !== "volumes") return []
    if (selectedVolumeIds.size === 0) return []
    return Array.from(selectedVolumeIds).filter((id) => {
      const volume = volumeLookup.get(id)
      return volume != null && !volume.series_id
    })
  }, [collectionView, selectedVolumeIds, volumeLookup])

  const selectedUnassignedCount = selectedUnassignedVolumeIds.length

  const selectedVolumeIdsArray = useMemo(
    () => Array.from(selectedVolumeIds),
    [selectedVolumeIds]
  )

  return {
    selectedSeriesIds,
    selectedVolumeIds,
    selectedCount,
    totalSelectableCount,
    isAllSelected,
    selectedUnassignedVolumeIds,
    selectedUnassignedCount,
    selectedVolumeIdsArray,
    clearSelection,
    handleClearSelection,
    toggleSeriesSelection,
    toggleVolumeSelection,
    handleSelectAll,
    handleSeriesItemClick,
    handleVolumeItemClick
  }
}
