"use client"

import { useCallback, useReducer } from "react"

import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface DialogState {
  searchDialogOpen: boolean
  seriesDialogOpen: boolean
  editingSeries: SeriesWithVolumes | null
  volumeDialogOpen: boolean
  editingVolume: Volume | null
  selectedSeriesId: string | null
  pendingSeriesSelection: boolean
  deleteDialogOpen: boolean
  deletingSeries: SeriesWithVolumes | null
  deleteVolumeDialogOpen: boolean
  deletingVolume: Volume | null
  bulkDeleteDialogOpen: boolean
  assignToSeriesDialogOpen: boolean
  duplicateDialogOpen: boolean
  scrapeTarget: SeriesWithVolumes | null
  bulkEditDialogOpen: boolean
  addToCollectionDialogOpen: boolean
}

const initialDialogState: DialogState = {
  searchDialogOpen: false,
  seriesDialogOpen: false,
  editingSeries: null,
  volumeDialogOpen: false,
  editingVolume: null,
  selectedSeriesId: null,
  pendingSeriesSelection: false,
  deleteDialogOpen: false,
  deletingSeries: null,
  deleteVolumeDialogOpen: false,
  deletingVolume: null,
  bulkDeleteDialogOpen: false,
  assignToSeriesDialogOpen: false,
  duplicateDialogOpen: false,
  scrapeTarget: null,
  bulkEditDialogOpen: false,
  addToCollectionDialogOpen: false
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type DialogAction =
  | { type: "SET_SEARCH_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_SERIES_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_EDITING_SERIES"; payload: SeriesWithVolumes | null }
  | { type: "SET_VOLUME_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_EDITING_VOLUME"; payload: Volume | null }
  | { type: "SET_SELECTED_SERIES_ID"; payload: string | null }
  | { type: "SET_PENDING_SERIES_SELECTION"; payload: boolean }
  | { type: "SET_DELETE_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_DELETING_SERIES"; payload: SeriesWithVolumes | null }
  | { type: "SET_DELETE_VOLUME_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_DELETING_VOLUME"; payload: Volume | null }
  | { type: "SET_BULK_DELETE_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_ASSIGN_TO_SERIES_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_DUPLICATE_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_SCRAPE_TARGET"; payload: SeriesWithVolumes | null }
  | { type: "SET_BULK_EDIT_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_ADD_TO_COLLECTION_DIALOG_OPEN"; payload: boolean }

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "SET_SEARCH_DIALOG_OPEN":
      return { ...state, searchDialogOpen: action.payload }
    case "SET_SERIES_DIALOG_OPEN":
      return { ...state, seriesDialogOpen: action.payload }
    case "SET_EDITING_SERIES":
      return { ...state, editingSeries: action.payload }
    case "SET_VOLUME_DIALOG_OPEN":
      return { ...state, volumeDialogOpen: action.payload }
    case "SET_EDITING_VOLUME":
      return { ...state, editingVolume: action.payload }
    case "SET_SELECTED_SERIES_ID":
      return { ...state, selectedSeriesId: action.payload }
    case "SET_PENDING_SERIES_SELECTION":
      return { ...state, pendingSeriesSelection: action.payload }
    case "SET_DELETE_DIALOG_OPEN":
      return { ...state, deleteDialogOpen: action.payload }
    case "SET_DELETING_SERIES":
      return { ...state, deletingSeries: action.payload }
    case "SET_DELETE_VOLUME_DIALOG_OPEN":
      return { ...state, deleteVolumeDialogOpen: action.payload }
    case "SET_DELETING_VOLUME":
      return { ...state, deletingVolume: action.payload }
    case "SET_BULK_DELETE_DIALOG_OPEN":
      return { ...state, bulkDeleteDialogOpen: action.payload }
    case "SET_ASSIGN_TO_SERIES_DIALOG_OPEN":
      return { ...state, assignToSeriesDialogOpen: action.payload }
    case "SET_DUPLICATE_DIALOG_OPEN":
      return { ...state, duplicateDialogOpen: action.payload }
    case "SET_SCRAPE_TARGET":
      return { ...state, scrapeTarget: action.payload }
    case "SET_BULK_EDIT_DIALOG_OPEN":
      return { ...state, bulkEditDialogOpen: action.payload }
    case "SET_ADD_TO_COLLECTION_DIALOG_OPEN":
      return { ...state, addToCollectionDialogOpen: action.payload }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseLibraryDialogsReturn extends DialogState {
  setSearchDialogOpen: (open: boolean) => void
  setSeriesDialogOpen: (open: boolean) => void
  setEditingSeries: (series: SeriesWithVolumes | null) => void
  setVolumeDialogOpen: (open: boolean) => void
  setEditingVolume: (volume: Volume | null) => void
  setSelectedSeriesId: (id: string | null) => void
  setPendingSeriesSelection: (pending: boolean) => void
  setDeleteDialogOpen: (open: boolean) => void
  setDeletingSeries: (series: SeriesWithVolumes | null) => void
  setDeleteVolumeDialogOpen: (open: boolean) => void
  setDeletingVolume: (volume: Volume | null) => void
  setBulkDeleteDialogOpen: (open: boolean) => void
  setAssignToSeriesDialogOpen: (open: boolean) => void
  setDuplicateDialogOpen: (open: boolean) => void
  setScrapeTarget: (target: SeriesWithVolumes | null) => void
  setBulkEditDialogOpen: (open: boolean) => void
  setAddToCollectionDialogOpen: (open: boolean) => void
}

export function useLibraryDialogs(): UseLibraryDialogsReturn {
  const [state, dispatch] = useReducer(dialogReducer, initialDialogState)

  const setSearchDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_SEARCH_DIALOG_OPEN", payload: open }),
    []
  )
  const setSeriesDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_SERIES_DIALOG_OPEN", payload: open }),
    []
  )
  const setEditingSeries = useCallback(
    (series: SeriesWithVolumes | null) =>
      dispatch({ type: "SET_EDITING_SERIES", payload: series }),
    []
  )
  const setVolumeDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_VOLUME_DIALOG_OPEN", payload: open }),
    []
  )
  const setEditingVolume = useCallback(
    (volume: Volume | null) =>
      dispatch({ type: "SET_EDITING_VOLUME", payload: volume }),
    []
  )
  const setSelectedSeriesId = useCallback(
    (id: string | null) =>
      dispatch({ type: "SET_SELECTED_SERIES_ID", payload: id }),
    []
  )
  const setPendingSeriesSelection = useCallback(
    (pending: boolean) =>
      dispatch({ type: "SET_PENDING_SERIES_SELECTION", payload: pending }),
    []
  )
  const setDeleteDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_DELETE_DIALOG_OPEN", payload: open }),
    []
  )
  const setDeletingSeries = useCallback(
    (series: SeriesWithVolumes | null) =>
      dispatch({ type: "SET_DELETING_SERIES", payload: series }),
    []
  )
  const setDeleteVolumeDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_DELETE_VOLUME_DIALOG_OPEN", payload: open }),
    []
  )
  const setDeletingVolume = useCallback(
    (volume: Volume | null) =>
      dispatch({ type: "SET_DELETING_VOLUME", payload: volume }),
    []
  )
  const setBulkDeleteDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_BULK_DELETE_DIALOG_OPEN", payload: open }),
    []
  )
  const setAssignToSeriesDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_ASSIGN_TO_SERIES_DIALOG_OPEN", payload: open }),
    []
  )
  const setDuplicateDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_DUPLICATE_DIALOG_OPEN", payload: open }),
    []
  )
  const setScrapeTarget = useCallback(
    (target: SeriesWithVolumes | null) =>
      dispatch({ type: "SET_SCRAPE_TARGET", payload: target }),
    []
  )
  const setBulkEditDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_BULK_EDIT_DIALOG_OPEN", payload: open }),
    []
  )
  const setAddToCollectionDialogOpen = useCallback(
    (open: boolean) =>
      dispatch({ type: "SET_ADD_TO_COLLECTION_DIALOG_OPEN", payload: open }),
    []
  )

  return {
    ...state,
    setSearchDialogOpen,
    setSeriesDialogOpen,
    setEditingSeries,
    setVolumeDialogOpen,
    setEditingVolume,
    setSelectedSeriesId,
    setPendingSeriesSelection,
    setDeleteDialogOpen,
    setDeletingSeries,
    setDeleteVolumeDialogOpen,
    setDeletingVolume,
    setBulkDeleteDialogOpen,
    setAssignToSeriesDialogOpen,
    setDuplicateDialogOpen,
    setScrapeTarget,
    setBulkEditDialogOpen,
    setAddToCollectionDialogOpen
  }
}
