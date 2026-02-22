import type { StateCreator } from "zustand"

import type { Series, SeriesWithVolumes, Volume } from "@/lib/types/database"

import type { LibraryState } from "../library-store"

/** Normalized entity state and CRUD actions for series and volumes. @source */
export interface EntitySlice {
  seriesById: Record<string, Series>
  volumesById: Record<string, Volume>
  seriesIds: string[]
  volumeIdsBySeriesId: Record<string, string[]>
  unassignedVolumeIds: string[]
  selectedSeries: SeriesWithVolumes | null

  setSeries: (series: SeriesWithVolumes[]) => void
  setUnassignedVolumes: (volumes: Volume[]) => void
  addSeries: (series: SeriesWithVolumes) => void
  updateSeries: (id: string, updates: Partial<Series>) => void
  deleteSeries: (id: string) => void
  addVolume: (seriesId: string, volume: Volume) => void
  updateVolume: (
    seriesId: string,
    volumeId: string,
    updates: Partial<Volume>
  ) => void
  deleteVolume: (seriesId: string, volumeId: string) => void
  addUnassignedVolume: (volume: Volume) => void
  updateUnassignedVolume: (volumeId: string, updates: Partial<Volume>) => void
  deleteUnassignedVolume: (volumeId: string) => void
  setSelectedSeries: (series: SeriesWithVolumes | null) => void
}

function omitKey<T extends Record<string, unknown>>(obj: T, key: string): T {
  const result = { ...obj }
  delete result[key]
  return result
}

export const createEntitySlice: StateCreator<
  LibraryState,
  [],
  [],
  EntitySlice
> = (set) => ({
  seriesById: {},
  volumesById: {},
  seriesIds: [],
  volumeIdsBySeriesId: {},
  unassignedVolumeIds: [],
  selectedSeries: null,

  setSeries: (seriesArr) => {
    const nextSeriesById: Record<string, Series> = {}
    const nextVolumesById: Record<string, Volume> = {}
    const nextSeriesIds: string[] = []
    const nextVolumeIdsBySeriesId: Record<string, string[]> = {}

    for (const s of seriesArr) {
      const { volumes, ...seriesData } = s
      nextSeriesById[s.id] = seriesData as Series
      nextSeriesIds.push(s.id)
      const vIds: string[] = []
      for (const v of volumes) {
        nextVolumesById[v.id] = v
        vIds.push(v.id)
      }
      nextVolumeIdsBySeriesId[s.id] = vIds
    }

    set((state) => {
      // Re-add unassigned volumes to the volume map
      const mergedVolumesById = { ...nextVolumesById }
      for (const uid of state.unassignedVolumeIds) {
        const uv = state.volumesById[uid]
        if (uv) mergedVolumesById[uid] = uv
      }

      return {
        seriesById: nextSeriesById,
        volumesById: mergedVolumesById,
        seriesIds: nextSeriesIds,
        volumeIdsBySeriesId: nextVolumeIdsBySeriesId
      }
    })
  },

  setUnassignedVolumes: (volumes) =>
    set((state) => {
      const nextVolumesById = { ...state.volumesById }
      // Remove old unassigned entries
      for (const oldId of state.unassignedVolumeIds) {
        if (!state.volumeIdsBySeriesId[oldId]) {
          delete nextVolumesById[oldId]
        }
      }
      // Add new unassigned entries
      const nextUnassignedIds: string[] = []
      for (const v of volumes) {
        nextVolumesById[v.id] = v
        nextUnassignedIds.push(v.id)
      }
      return {
        volumesById: nextVolumesById,
        unassignedVolumeIds: nextUnassignedIds
      }
    }),

  addSeries: (newSeries) =>
    set((state) => {
      const { volumes, ...seriesData } = newSeries
      const nextVolumesById = { ...state.volumesById }
      const vIds: string[] = []
      for (const v of volumes) {
        nextVolumesById[v.id] = v
        vIds.push(v.id)
      }
      return {
        seriesById: {
          ...state.seriesById,
          [newSeries.id]: seriesData as Series
        },
        volumesById: nextVolumesById,
        seriesIds: [...state.seriesIds, newSeries.id],
        volumeIdsBySeriesId: {
          ...state.volumeIdsBySeriesId,
          [newSeries.id]: vIds
        }
      }
    }),

  updateSeries: (id, updates) =>
    set((state) => {
      const existing = state.seriesById[id]
      if (!existing) return state
      const updated = { ...existing, ...updates }
      return {
        seriesById: { ...state.seriesById, [id]: updated },
        selectedSeries:
          state.selectedSeries?.id === id
            ? { ...state.selectedSeries, ...updates }
            : state.selectedSeries
      }
    }),

  deleteSeries: (id) =>
    set((state) => {
      const restSeriesById = omitKey(state.seriesById, id)
      const removedVolumeIds = state.volumeIdsBySeriesId[id]
      const restVolumeIdsBySeriesId = omitKey(state.volumeIdsBySeriesId, id)
      const nextVolumesById = { ...state.volumesById }
      for (const vid of removedVolumeIds ?? []) {
        delete nextVolumesById[vid]
      }
      return {
        seriesById: restSeriesById,
        volumesById: nextVolumesById,
        seriesIds: state.seriesIds.filter((sid) => sid !== id),
        volumeIdsBySeriesId: restVolumeIdsBySeriesId,
        selectedSeries:
          state.selectedSeries?.id === id ? null : state.selectedSeries
      }
    }),

  addVolume: (seriesId, volume) =>
    set((state) => ({
      volumesById: { ...state.volumesById, [volume.id]: volume },
      volumeIdsBySeriesId: {
        ...state.volumeIdsBySeriesId,
        [seriesId]: [...(state.volumeIdsBySeriesId[seriesId] ?? []), volume.id]
      },
      selectedSeries:
        state.selectedSeries?.id === seriesId
          ? {
              ...state.selectedSeries,
              volumes: [...state.selectedSeries.volumes, volume]
            }
          : state.selectedSeries
    })),

  updateVolume: (seriesId, volumeId, updates) =>
    set((state) => {
      const existing = state.volumesById[volumeId]
      if (!existing) return state
      const updated = { ...existing, ...updates }
      return {
        volumesById: { ...state.volumesById, [volumeId]: updated },
        selectedSeries:
          state.selectedSeries?.id === seriesId
            ? {
                ...state.selectedSeries,
                volumes: state.selectedSeries.volumes.map((v) =>
                  v.id === volumeId ? updated : v
                )
              }
            : state.selectedSeries
      }
    }),

  deleteVolume: (seriesId, volumeId) =>
    set((state) => {
      const restVolumesById = omitKey(state.volumesById, volumeId)
      return {
        volumesById: restVolumesById,
        volumeIdsBySeriesId: {
          ...state.volumeIdsBySeriesId,
          [seriesId]: (state.volumeIdsBySeriesId[seriesId] ?? []).filter(
            (vid) => vid !== volumeId
          )
        },
        selectedSeries:
          state.selectedSeries?.id === seriesId
            ? {
                ...state.selectedSeries,
                volumes: state.selectedSeries.volumes.filter(
                  (v) => v.id !== volumeId
                )
              }
            : state.selectedSeries
      }
    }),

  addUnassignedVolume: (volume) =>
    set((state) => ({
      volumesById: { ...state.volumesById, [volume.id]: volume },
      unassignedVolumeIds: [...state.unassignedVolumeIds, volume.id]
    })),

  updateUnassignedVolume: (volumeId, updates) =>
    set((state) => {
      const existing = state.volumesById[volumeId]
      if (!existing) return state
      const updated = { ...existing, ...updates }
      return {
        volumesById: { ...state.volumesById, [volumeId]: updated }
      }
    }),

  deleteUnassignedVolume: (volumeId) =>
    set((state) => {
      const restVolumesById = omitKey(state.volumesById, volumeId)
      return {
        volumesById: restVolumesById,
        unassignedVolumeIds: state.unassignedVolumeIds.filter(
          (id) => id !== volumeId
        )
      }
    }),

  setSelectedSeries: (series) => set({ selectedSeries: series })
})
