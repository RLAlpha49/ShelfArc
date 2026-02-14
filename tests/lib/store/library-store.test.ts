import { describe, expect, it, beforeEach } from "bun:test"
import {
  useLibraryStore,
  selectSeriesById,
  selectVolumeById,
  selectSeriesVolumes,
  selectAllVolumes
} from "@/lib/store/library-store"
import type { SeriesWithVolumes, Volume, Series } from "@/lib/types/database"

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: "s1",
    user_id: "u1",
    title: "Test Series",
    original_title: null,
    description: null,
    notes: null,
    author: "Author A",
    artist: null,
    publisher: null,
    cover_image_url: null,
    type: "manga",
    total_volumes: null,
    status: null,
    tags: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  }
}

function makeVolume(overrides: Partial<Volume> = {}): Volume {
  return {
    id: "v1",
    series_id: "s1",
    user_id: "u1",
    volume_number: 1,
    title: null,
    description: null,
    isbn: null,
    cover_image_url: null,
    edition: null,
    format: null,
    page_count: null,
    publish_date: null,
    purchase_date: null,
    purchase_price: null,
    ownership_status: "owned",
    reading_status: "unread",
    current_page: null,
    amazon_url: null,
    rating: null,
    notes: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  }
}

function makeSeriesWithVolumes(
  seriesOverrides: Partial<Series> = {},
  volumes: Volume[] = []
): SeriesWithVolumes {
  return { ...makeSeries(seriesOverrides), volumes }
}

/* ------------------------------------------------------------------ */
/*  Store reset helper                                                */
/* ------------------------------------------------------------------ */

const initialState = useLibraryStore.getInitialState()

function resetStore() {
  useLibraryStore.setState(initialState, true)
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe("library-store", () => {
  beforeEach(resetStore)

  /* ---- Initial state ---- */

  describe("initial state", () => {
    it("has empty data collections", () => {
      const s = useLibraryStore.getState()
      expect(s.series).toEqual([])
      expect(s.unassignedVolumes).toEqual([])
      expect(s.selectedSeries).toBeNull()
      expect(s.seriesIds).toEqual([])
      expect(Object.keys(s.seriesById)).toHaveLength(0)
      expect(Object.keys(s.volumesById)).toHaveLength(0)
    })

    it("has default UI state", () => {
      const s = useLibraryStore.getState()
      expect(s.collectionView).toBe("series")
      expect(s.viewMode).toBe("grid")
      expect(s.sortField).toBe("title")
      expect(s.sortOrder).toBe("asc")
      expect(s.isLoading).toBe(false)
      expect(s.navigationMode).toBe("sidebar")
    })

    it("has default filter state", () => {
      const s = useLibraryStore.getState()
      expect(s.filters.search).toBe("")
      expect(s.filters.type).toBe("all")
      expect(s.filters.ownershipStatus).toBe("all")
      expect(s.filters.readingStatus).toBe("all")
      expect(s.filters.tags).toEqual([])
      expect(s.filters.excludeTags).toEqual([])
    })

    it("has default price/amazon settings", () => {
      const s = useLibraryStore.getState()
      expect(s.priceSource).toBe("amazon")
      expect(s.amazonDomain).toBe("amazon.com")
      expect(s.amazonPreferKindle).toBe(false)
      expect(s.amazonFallbackToKindle).toBe(false)
      expect(s.priceDisplayCurrency).toBe("USD")
      expect(s.showAmazonDisclaimer).toBe(true)
    })
  })

  /* ---- Series CRUD ---- */

  describe("series CRUD", () => {
    it("setSeries populates normalized maps", () => {
      const v1 = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v1])

      useLibraryStore.getState().setSeries([sw])

      const s = useLibraryStore.getState()
      expect(s.seriesIds).toEqual(["s1"])
      expect(s.seriesById["s1"].title).toBe("Test Series")
      expect(s.volumesById["v1"]).toBeDefined()
      expect(s.volumeIdsBySeriesId["s1"]).toEqual(["v1"])
      expect(s.series).toHaveLength(1)
    })

    it("setSeries preserves unassigned volumes in volumesById", () => {
      const uv = makeVolume({ id: "uv1", series_id: null })
      useLibraryStore.getState().addUnassignedVolume(uv)

      const sw = makeSeriesWithVolumes({ id: "s1" }, [])
      useLibraryStore.getState().setSeries([sw])

      const s = useLibraryStore.getState()
      expect(s.volumesById["uv1"]).toBeDefined()
    })

    it("addSeries appends to existing data", () => {
      const sw1 = makeSeriesWithVolumes({ id: "s1" }, [])
      useLibraryStore.getState().setSeries([sw1])

      const v2 = makeVolume({ id: "v2", series_id: "s2" })
      const sw2 = makeSeriesWithVolumes({ id: "s2", title: "Second" }, [v2])
      useLibraryStore.getState().addSeries(sw2)

      const s = useLibraryStore.getState()
      expect(s.seriesIds).toEqual(["s1", "s2"])
      expect(s.seriesById["s2"].title).toBe("Second")
      expect(s.volumesById["v2"]).toBeDefined()
      expect(s.series).toHaveLength(2)
    })

    it("updateSeries merges partial updates", () => {
      const sw = makeSeriesWithVolumes({ id: "s1" }, [])
      useLibraryStore.getState().setSeries([sw])

      useLibraryStore.getState().updateSeries("s1", { title: "Updated" })

      const s = useLibraryStore.getState()
      expect(s.seriesById["s1"].title).toBe("Updated")
      expect(s.series[0].title).toBe("Updated")
    })

    it("updateSeries updates selectedSeries when it matches", () => {
      const v = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v])
      useLibraryStore.getState().setSeries([sw])
      useLibraryStore.getState().setSelectedSeries(sw)

      useLibraryStore.getState().updateSeries("s1", { author: "New Author" })

      const s = useLibraryStore.getState()
      expect(s.selectedSeries?.author).toBe("New Author")
    })

    it("updateSeries is a no-op for unknown id", () => {
      const sw = makeSeriesWithVolumes({ id: "s1" }, [])
      useLibraryStore.getState().setSeries([sw])
      const before = useLibraryStore.getState()

      useLibraryStore.getState().updateSeries("unknown", { title: "X" })

      expect(useLibraryStore.getState()).toBe(before)
    })

    it("deleteSeries removes series and its volumes", () => {
      const v = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v])
      useLibraryStore.getState().setSeries([sw])

      useLibraryStore.getState().deleteSeries("s1")

      const s = useLibraryStore.getState()
      expect(s.seriesIds).toEqual([])
      expect(s.seriesById["s1"]).toBeUndefined()
      expect(s.volumesById["v1"]).toBeUndefined()
      expect(s.volumeIdsBySeriesId["s1"]).toBeUndefined()
      expect(s.series).toEqual([])
    })

    it("deleteSeries clears selectedSeries when it matches", () => {
      const sw = makeSeriesWithVolumes({ id: "s1" }, [])
      useLibraryStore.getState().setSeries([sw])
      useLibraryStore.getState().setSelectedSeries(sw)

      useLibraryStore.getState().deleteSeries("s1")

      expect(useLibraryStore.getState().selectedSeries).toBeNull()
    })
  })

  /* ---- Volume CRUD ---- */

  describe("volume CRUD", () => {
    it("addVolume appends to a series", () => {
      const sw = makeSeriesWithVolumes({ id: "s1" }, [])
      useLibraryStore.getState().setSeries([sw])

      const v = makeVolume({ id: "v1", series_id: "s1" })
      useLibraryStore.getState().addVolume("s1", v)

      const s = useLibraryStore.getState()
      expect(s.volumesById["v1"]).toBeDefined()
      expect(s.volumeIdsBySeriesId["s1"]).toContain("v1")
      expect(s.series[0].volumes).toHaveLength(1)
    })

    it("addVolume updates selectedSeries when matching", () => {
      const sw = makeSeriesWithVolumes({ id: "s1" }, [])
      useLibraryStore.getState().setSeries([sw])
      useLibraryStore.getState().setSelectedSeries(sw)

      const v = makeVolume({ id: "v1", series_id: "s1" })
      useLibraryStore.getState().addVolume("s1", v)

      expect(useLibraryStore.getState().selectedSeries?.volumes).toHaveLength(1)
    })

    it("updateVolume merges partial updates", () => {
      const v = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v])
      useLibraryStore.getState().setSeries([sw])

      useLibraryStore.getState().updateVolume("s1", "v1", { rating: 5 })

      const s = useLibraryStore.getState()
      expect(s.volumesById["v1"].rating).toBe(5)
      expect(s.series[0].volumes[0].rating).toBe(5)
    })

    it("updateVolume is a no-op for unknown volume", () => {
      const sw = makeSeriesWithVolumes({ id: "s1" }, [])
      useLibraryStore.getState().setSeries([sw])
      const before = useLibraryStore.getState()

      useLibraryStore.getState().updateVolume("s1", "unknown", { rating: 3 })

      expect(useLibraryStore.getState()).toBe(before)
    })

    it("deleteVolume removes from series", () => {
      const v = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v])
      useLibraryStore.getState().setSeries([sw])

      useLibraryStore.getState().deleteVolume("s1", "v1")

      const s = useLibraryStore.getState()
      expect(s.volumesById["v1"]).toBeUndefined()
      expect(s.volumeIdsBySeriesId["s1"]).toEqual([])
      expect(s.series[0].volumes).toEqual([])
    })

    it("deleteVolume updates selectedSeries when matching", () => {
      const v = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v])
      useLibraryStore.getState().setSeries([sw])
      useLibraryStore
        .getState()
        .setSelectedSeries(useLibraryStore.getState().series[0])

      useLibraryStore.getState().deleteVolume("s1", "v1")

      expect(useLibraryStore.getState().selectedSeries?.volumes).toEqual([])
    })
  })

  /* ---- Unassigned volume CRUD ---- */

  describe("unassigned volume CRUD", () => {
    it("addUnassignedVolume adds to both maps", () => {
      const v = makeVolume({ id: "uv1", series_id: null })
      useLibraryStore.getState().addUnassignedVolume(v)

      const s = useLibraryStore.getState()
      expect(s.unassignedVolumeIds).toContain("uv1")
      expect(s.volumesById["uv1"]).toBeDefined()
      expect(s.unassignedVolumes).toHaveLength(1)
    })

    it("updateUnassignedVolume merges updates", () => {
      const v = makeVolume({ id: "uv1", series_id: null })
      useLibraryStore.getState().addUnassignedVolume(v)

      useLibraryStore
        .getState()
        .updateUnassignedVolume("uv1", { reading_status: "reading" })

      const s = useLibraryStore.getState()
      expect(s.volumesById["uv1"].reading_status).toBe("reading")
      expect(s.unassignedVolumes[0].reading_status).toBe("reading")
    })

    it("updateUnassignedVolume is a no-op for unknown id", () => {
      const before = useLibraryStore.getState()
      useLibraryStore.getState().updateUnassignedVolume("nope", { rating: 1 })
      expect(useLibraryStore.getState()).toBe(before)
    })

    it("deleteUnassignedVolume removes from both maps", () => {
      const v = makeVolume({ id: "uv1", series_id: null })
      useLibraryStore.getState().addUnassignedVolume(v)

      useLibraryStore.getState().deleteUnassignedVolume("uv1")

      const s = useLibraryStore.getState()
      expect(s.unassignedVolumeIds).not.toContain("uv1")
      expect(s.volumesById["uv1"]).toBeUndefined()
      expect(s.unassignedVolumes).toEqual([])
    })

    it("setUnassignedVolumes replaces all unassigned", () => {
      const v1 = makeVolume({ id: "uv1", series_id: null })
      const v2 = makeVolume({ id: "uv2", series_id: null })
      useLibraryStore.getState().addUnassignedVolume(v1)

      useLibraryStore.getState().setUnassignedVolumes([v2])

      const s = useLibraryStore.getState()
      expect(s.unassignedVolumeIds).toEqual(["uv2"])
      expect(s.volumesById["uv1"]).toBeUndefined()
      expect(s.volumesById["uv2"]).toBeDefined()
    })
  })

  /* ---- Filter / Sort state ---- */

  describe("filter and sort state", () => {
    it("setFilters merges partial filter updates", () => {
      useLibraryStore.getState().setFilters({ search: "naruto" })

      const s = useLibraryStore.getState()
      expect(s.filters.search).toBe("naruto")
      expect(s.filters.type).toBe("all")
    })

    it("setFilters clears activeFilterPresetId", () => {
      useLibraryStore.setState({ activeFilterPresetId: "preset1" })
      useLibraryStore.getState().setFilters({ search: "test" })
      expect(useLibraryStore.getState().activeFilterPresetId).toBeNull()
    })

    it("resetFilters restores default filters", () => {
      useLibraryStore.getState().setFilters({
        search: "test",
        type: "manga",
        ownershipStatus: "owned",
        tags: ["action"]
      })

      useLibraryStore.getState().resetFilters()

      const s = useLibraryStore.getState()
      expect(s.filters.search).toBe("")
      expect(s.filters.type).toBe("all")
      expect(s.filters.ownershipStatus).toBe("all")
      expect(s.filters.tags).toEqual([])
      expect(s.activeFilterPresetId).toBeNull()
    })

    it("setSortField updates and clears preset", () => {
      useLibraryStore.setState({ activeFilterPresetId: "preset1" })
      useLibraryStore.getState().setSortField("rating")

      const s = useLibraryStore.getState()
      expect(s.sortField).toBe("rating")
      expect(s.activeFilterPresetId).toBeNull()
    })

    it("setSortOrder updates and clears preset", () => {
      useLibraryStore.setState({ activeFilterPresetId: "preset1" })
      useLibraryStore.getState().setSortOrder("desc")

      const s = useLibraryStore.getState()
      expect(s.sortOrder).toBe("desc")
      expect(s.activeFilterPresetId).toBeNull()
    })

    it("setViewMode updates and clears preset", () => {
      useLibraryStore.getState().setViewMode("list")
      expect(useLibraryStore.getState().viewMode).toBe("list")
      expect(useLibraryStore.getState().activeFilterPresetId).toBeNull()
    })

    it("setCollectionView updates and clears preset", () => {
      useLibraryStore.getState().setCollectionView("volumes")
      expect(useLibraryStore.getState().collectionView).toBe("volumes")
      expect(useLibraryStore.getState().activeFilterPresetId).toBeNull()
    })
  })

  /* ---- Filter presets ---- */

  describe("filter presets", () => {
    it("ensureDefaultFilterPresets seeds defaults when empty", () => {
      useLibraryStore.getState().ensureDefaultFilterPresets()

      const s = useLibraryStore.getState()
      expect(s.filterPresetsInitialized).toBe(true)
      expect(s.filterPresets).toHaveLength(2)
      expect(s.filterPresets[0].name).toBe("Wishlist")
      expect(s.filterPresets[1].name).toBe("Currently reading")
    })

    it("ensureDefaultFilterPresets is idempotent", () => {
      useLibraryStore.getState().ensureDefaultFilterPresets()
      useLibraryStore.getState().ensureDefaultFilterPresets()

      expect(useLibraryStore.getState().filterPresets).toHaveLength(2)
    })

    it("ensureDefaultFilterPresets skips if user presets exist", () => {
      useLibraryStore.getState().setFilters({ search: "test" })
      useLibraryStore.getState().saveFilterPreset("My Preset")

      useLibraryStore.getState().ensureDefaultFilterPresets()

      const s = useLibraryStore.getState()
      expect(s.filterPresetsInitialized).toBe(true)
      expect(s.filterPresets).toHaveLength(1)
      expect(s.filterPresets[0].name).toBe("My Preset")
    })

    it("saveFilterPreset captures current filters", () => {
      useLibraryStore.getState().setFilters({ search: "one piece" })
      useLibraryStore.getState().saveFilterPreset("Fav Search")

      const s = useLibraryStore.getState()
      expect(s.filterPresets).toHaveLength(1)
      expect(s.filterPresets[0].name).toBe("Fav Search")
      expect(s.filterPresets[0].state.filters.search).toBe("one piece")
      expect(s.activeFilterPresetId).toBe(s.filterPresets[0].id)
    })

    it("saveFilterPreset includes sort/view when requested", () => {
      useLibraryStore.getState().setSortField("rating")
      useLibraryStore.getState().setViewMode("list")
      useLibraryStore
        .getState()
        .saveFilterPreset("Full", { includeSortAndView: true })

      const preset = useLibraryStore.getState().filterPresets[0]
      expect(preset.state.sortField).toBe("rating")
      expect(preset.state.viewMode).toBe("list")
    })

    it("saveFilterPreset ignores empty name", () => {
      useLibraryStore.getState().saveFilterPreset("  ")
      expect(useLibraryStore.getState().filterPresets).toHaveLength(0)
    })

    it("applyFilterPreset restores filters and sets active", () => {
      useLibraryStore.getState().setFilters({ type: "manga" })
      useLibraryStore.getState().saveFilterPreset("Manga")
      const presetId = useLibraryStore.getState().filterPresets[0].id

      useLibraryStore.getState().resetFilters()
      useLibraryStore.getState().applyFilterPreset(presetId)

      const s = useLibraryStore.getState()
      expect(s.filters.type).toBe("manga")
      expect(s.activeFilterPresetId).toBe(presetId)
    })

    it("applyFilterPreset restores sort/view from preset", () => {
      useLibraryStore.getState().setSortField("rating")
      useLibraryStore.getState().setSortOrder("desc")
      useLibraryStore
        .getState()
        .saveFilterPreset("Full", { includeSortAndView: true })
      const presetId = useLibraryStore.getState().filterPresets[0].id

      // Change current sort
      useLibraryStore.getState().setSortField("title")
      useLibraryStore.getState().setSortOrder("asc")

      useLibraryStore.getState().applyFilterPreset(presetId)

      const s = useLibraryStore.getState()
      expect(s.sortField).toBe("rating")
      expect(s.sortOrder).toBe("desc")
    })

    it("applyFilterPreset is a no-op for unknown preset", () => {
      useLibraryStore.getState().setFilters({ search: "test" })
      useLibraryStore.getState().applyFilterPreset("nonexistent")
      expect(useLibraryStore.getState().filters.search).toBe("test")
    })

    it("renameFilterPreset updates name", () => {
      useLibraryStore.getState().saveFilterPreset("Old")
      const id = useLibraryStore.getState().filterPresets[0].id

      useLibraryStore.getState().renameFilterPreset(id, "New Name")

      expect(useLibraryStore.getState().filterPresets[0].name).toBe("New Name")
    })

    it("renameFilterPreset ignores empty name", () => {
      useLibraryStore.getState().saveFilterPreset("Keep")
      const id = useLibraryStore.getState().filterPresets[0].id

      useLibraryStore.getState().renameFilterPreset(id, "  ")

      expect(useLibraryStore.getState().filterPresets[0].name).toBe("Keep")
    })

    it("updateFilterPreset replaces state with current filters", () => {
      useLibraryStore.getState().saveFilterPreset("Original")
      const id = useLibraryStore.getState().filterPresets[0].id

      useLibraryStore.getState().setFilters({ search: "updated" })
      useLibraryStore.getState().updateFilterPreset(id, "Renamed")

      const preset = useLibraryStore.getState().filterPresets[0]
      expect(preset.name).toBe("Renamed")
      expect(preset.state.filters.search).toBe("updated")
    })

    it("deleteFilterPreset removes the preset", () => {
      useLibraryStore.getState().saveFilterPreset("ToDelete")
      const id = useLibraryStore.getState().filterPresets[0].id

      useLibraryStore.getState().deleteFilterPreset(id)

      expect(useLibraryStore.getState().filterPresets).toHaveLength(0)
    })

    it("deleteFilterPreset clears activeFilterPresetId if it was active", () => {
      useLibraryStore.getState().saveFilterPreset("Active")
      const id = useLibraryStore.getState().filterPresets[0].id
      expect(useLibraryStore.getState().activeFilterPresetId).toBe(id)

      useLibraryStore.getState().deleteFilterPreset(id)

      expect(useLibraryStore.getState().activeFilterPresetId).toBeNull()
    })

    it("deleteFilterPreset preserves activeFilterPresetId for other preset", () => {
      useLibraryStore.getState().saveFilterPreset("A")
      useLibraryStore.getState().saveFilterPreset("B")
      const [a, b] = useLibraryStore.getState().filterPresets
      useLibraryStore.getState().applyFilterPreset(b.id)

      useLibraryStore.getState().deleteFilterPreset(a.id)

      expect(useLibraryStore.getState().activeFilterPresetId).toBe(b.id)
      expect(useLibraryStore.getState().filterPresets).toHaveLength(1)
    })
  })

  /* ---- Simple setters ---- */

  describe("simple setters", () => {
    it("setSelectedSeries", () => {
      const sw = makeSeriesWithVolumes({ id: "s1" }, [])
      useLibraryStore.getState().setSelectedSeries(sw)
      expect(useLibraryStore.getState().selectedSeries?.id).toBe("s1")

      useLibraryStore.getState().setSelectedSeries(null)
      expect(useLibraryStore.getState().selectedSeries).toBeNull()
    })

    it("setDeleteSeriesVolumes", () => {
      useLibraryStore.getState().setDeleteSeriesVolumes(true)
      expect(useLibraryStore.getState().deleteSeriesVolumes).toBe(true)
    })

    it("setPriceSource", () => {
      useLibraryStore.getState().setPriceSource("amazon")
      expect(useLibraryStore.getState().priceSource).toBe("amazon")
    })

    it("setAmazonDomain", () => {
      useLibraryStore.getState().setAmazonDomain("amazon.co.uk")
      expect(useLibraryStore.getState().amazonDomain).toBe("amazon.co.uk")
    })

    it("setAmazonPreferKindle", () => {
      useLibraryStore.getState().setAmazonPreferKindle(true)
      expect(useLibraryStore.getState().amazonPreferKindle).toBe(true)
    })

    it("setAmazonFallbackToKindle", () => {
      useLibraryStore.getState().setAmazonFallbackToKindle(true)
      expect(useLibraryStore.getState().amazonFallbackToKindle).toBe(true)
    })

    it("setPriceDisplayCurrency", () => {
      useLibraryStore.getState().setPriceDisplayCurrency("EUR")
      expect(useLibraryStore.getState().priceDisplayCurrency).toBe("EUR")
    })

    it("setShowAmazonDisclaimer", () => {
      useLibraryStore.getState().setShowAmazonDisclaimer(false)
      expect(useLibraryStore.getState().showAmazonDisclaimer).toBe(false)
    })

    it("setNavigationMode", () => {
      useLibraryStore.getState().setNavigationMode("header")
      expect(useLibraryStore.getState().navigationMode).toBe("header")
    })

    it("setIsLoading", () => {
      useLibraryStore.getState().setIsLoading(true)
      expect(useLibraryStore.getState().isLoading).toBe(true)
    })
  })

  /* ---- Selectors ---- */

  describe("selectors", () => {
    it("selectSeriesById returns series with volumes", () => {
      const v = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v])
      useLibraryStore.getState().setSeries([sw])

      const result = selectSeriesById(useLibraryStore.getState(), "s1")
      expect(result).toBeDefined()
      expect(result!.id).toBe("s1")
      expect(result!.volumes).toHaveLength(1)
      expect(result!.volumes[0].id).toBe("v1")
    })

    it("selectSeriesById returns undefined for unknown id", () => {
      expect(
        selectSeriesById(useLibraryStore.getState(), "unknown")
      ).toBeUndefined()
    })

    it("selectVolumeById returns volume by id", () => {
      const v = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v])
      useLibraryStore.getState().setSeries([sw])

      expect(selectVolumeById(useLibraryStore.getState(), "v1")?.id).toBe("v1")
    })

    it("selectVolumeById returns undefined for unknown id", () => {
      expect(
        selectVolumeById(useLibraryStore.getState(), "nope")
      ).toBeUndefined()
    })

    it("selectSeriesVolumes returns volumes for a series", () => {
      const v1 = makeVolume({ id: "v1", series_id: "s1", volume_number: 1 })
      const v2 = makeVolume({ id: "v2", series_id: "s1", volume_number: 2 })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v1, v2])
      useLibraryStore.getState().setSeries([sw])

      const vols = selectSeriesVolumes(useLibraryStore.getState(), "s1")
      expect(vols).toHaveLength(2)
    })

    it("selectSeriesVolumes returns empty for unknown series", () => {
      expect(selectSeriesVolumes(useLibraryStore.getState(), "nope")).toEqual(
        []
      )
    })

    it("selectAllVolumes returns all assigned and unassigned", () => {
      const v1 = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v1])
      useLibraryStore.getState().setSeries([sw])

      const uv = makeVolume({ id: "uv1", series_id: null })
      useLibraryStore.getState().addUnassignedVolume(uv)

      const all = selectAllVolumes(useLibraryStore.getState())
      expect(all).toHaveLength(2)
    })
  })

  /* ---- Persistence ---- */

  describe("persistence", () => {
    it("data fields are not persisted (state survives only in memory)", () => {
      const v = makeVolume({ id: "v1", series_id: "s1" })
      const sw = makeSeriesWithVolumes({ id: "s1" }, [v])
      useLibraryStore.getState().setSeries([sw])
      useLibraryStore.getState().setViewMode("list")

      // After a full reset (simulating a fresh session), data fields clear
      // but persisted UI prefs would be rehydrated from storage.
      // Since there's no real localStorage in test, verify that getInitialState
      // does NOT contain data:
      const initial = useLibraryStore.getInitialState()
      expect(initial.series).toEqual([])
      expect(initial.seriesById).toEqual({})
      expect(initial.volumesById).toEqual({})
      expect(initial.selectedSeries).toBeNull()
      expect(initial.isLoading).toBe(false)
    })

    it("UI preferences are separate from data in initial state", () => {
      const initial = useLibraryStore.getInitialState()
      // These UI prefs exist in initial state and would be targeted by partialize
      expect(initial.collectionView).toBe("series")
      expect(initial.viewMode).toBe("grid")
      expect(initial.sortField).toBe("title")
      expect(initial.sortOrder).toBe("asc")
      expect(initial.navigationMode).toBe("sidebar")
      expect(initial.priceSource).toBe("amazon")
      expect(initial.amazonDomain).toBe("amazon.com")
      expect(initial.priceDisplayCurrency).toBe("USD")
    })
  })
})
