"use client"

import { useMemo, useState, useSyncExternalStore } from "react"

import { FilterPresetsControl } from "@/components/library/filter-presets-control"
import { TagFilterControl } from "@/components/library/tag-filter-control"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { useWindowWidth } from "@/lib/hooks/use-window-width"
import type { SortField } from "@/lib/store/library-store"
import { selectAllSeries, useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type {
  OwnershipStatus,
  ReadingStatus,
  TitleType
} from "@/lib/types/database"

const SORT_LABELS: Record<SortField, string> = {
  title: "Title",
  author: "Author",
  created_at: "Date Added",
  updated_at: "Date Updated",
  rating: "Rating",
  volume_count: "Volume Count",
  price: "Price",
  started_at: "Date Started",
  finished_at: "Date Finished"
}

const SORT_FIELDS: SortField[] = [
  "title",
  "author",
  "created_at",
  "updated_at",
  "started_at",
  "finished_at",
  "rating",
  "volume_count",
  "price"
]

const noopSubscribe = () => () => {}
const getIsMac = () => /mac|iphone|ipad/i.test(navigator.userAgent)
const getIsMacServer = () => false

interface FilterControlsProps {
  readonly layout?: "horizontal" | "vertical"
}

function FilterControls({ layout = "horizontal" }: FilterControlsProps) {
  const series = useLibraryStore(selectAllSeries)
  const { filters, setFilters, resetFilters } = useLibraryStore()

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const s of series ?? []) {
      for (const tag of s.tags ?? []) tagSet.add(tag)
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b))
  }, [series])

  const hasActiveFilters =
    filters.type !== "all" ||
    filters.ownershipStatus !== "all" ||
    filters.readingStatus !== "all" ||
    filters.tags.length > 0 ||
    filters.excludeTags.length > 0

  const isVertical = layout === "vertical"

  return (
    <div
      className={
        isVertical ? "flex flex-col gap-3" : "flex flex-wrap items-end gap-2"
      }
    >
      <FilterPresetsControl />

      {/* Type Filter */}
      <div className="space-y-1">
        <Label
          htmlFor="filter-type"
          className="text-muted-foreground text-[11px] font-medium"
        >
          Type
        </Label>
        <Select
          value={filters.type}
          onValueChange={(value) => {
            if (value) setFilters({ type: value as TitleType | "all" })
          }}
        >
          <SelectTrigger
            id="filter-type"
            className="w-30 rounded-xl text-xs shadow-sm"
          >
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="manga">Manga</SelectItem>
            <SelectItem value="light_novel">Light Novel</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ownership Filter */}
      <div className="space-y-1">
        <Label
          htmlFor="filter-ownership"
          className="text-muted-foreground text-[11px] font-medium"
        >
          Ownership
        </Label>
        <Select
          value={filters.ownershipStatus}
          onValueChange={(value) => {
            if (value)
              setFilters({
                ownershipStatus: value as OwnershipStatus | "all"
              })
          }}
        >
          <SelectTrigger
            id="filter-ownership"
            className="w-30 rounded-xl text-xs shadow-sm"
          >
            <SelectValue placeholder="Ownership" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="owned">Owned</SelectItem>
            <SelectItem value="wishlist">Wishlist</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reading Status Filter */}
      <div className="space-y-1">
        <Label
          htmlFor="filter-reading"
          className="text-muted-foreground text-[11px] font-medium"
        >
          Reading
        </Label>
        <Select
          value={filters.readingStatus}
          onValueChange={(value) => {
            if (value)
              setFilters({
                readingStatus: value as ReadingStatus | "all"
              })
          }}
        >
          <SelectTrigger
            id="filter-reading"
            className="w-30 rounded-xl text-xs shadow-sm"
          >
            <SelectValue placeholder="Reading" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="reading">Reading</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="dropped">Dropped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags Filter */}
      {availableTags.length > 0 && (
        <TagFilterControl
          availableTags={availableTags}
          includeTags={filters.tags}
          excludeTags={filters.excludeTags}
          onIncludeChange={(tags) => setFilters({ tags })}
          onExcludeChange={(tags) => setFilters({ excludeTags: tags })}
        />
      )}

      {/* Clear filters (vertical/mobile only) */}
      {isVertical && hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="text-muted-foreground hover:text-foreground rounded-xl text-xs"
        >
          Clear
        </Button>
      )}
    </div>
  )
}

/** Props for the {@link LibraryToolbar} component. @source */
interface LibraryToolbarProps {
  readonly onAddBook: () => void
  readonly onAddSeries: () => void
  readonly onFindDuplicates?: () => void
}

/**
 * Toolbar with search, filters, sort controls, view toggles, and add-book/series buttons.
 * @param props - {@link LibraryToolbarProps}
 * @source
 */
export function LibraryToolbar({
  onAddBook,
  onAddSeries,
  onFindDuplicates
}: LibraryToolbarProps) {
  const {
    collectionView,
    setCollectionView,
    viewMode,
    setViewMode,
    sortField,
    sortOrder,
    setSortField,
    setSortOrder,
    filters,
    setFilters,
    resetFilters
  } = useLibraryStore()
  const { cardSize, setCardSize } = useSettingsStore()

  const windowWidth = useWindowWidth()
  const isMobile = windowWidth > 0 && windowWidth < 768
  const [filtersOpen, setFiltersOpen] = useState(false)

  const isMac = useSyncExternalStore(noopSubscribe, getIsMac, getIsMacServer)

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.type !== "all") count++
    if (filters.ownershipStatus !== "all") count++
    if (filters.readingStatus !== "all") count++
    if (filters.tags.length > 0) count++
    if (filters.excludeTags.length > 0) count++
    return count
  }, [filters])

  const searchPlaceholder = "Search by title, author, or ISBN..."

  return (
    <div>
      <div className="mb-3">
        <span className="text-muted-foreground text-xs tracking-widest uppercase">
          Filters &amp; Search
        </span>
      </div>
      <div className="glass-card animate-fade-in stagger-1 rounded-2xl p-4">
        <div className="space-y-3">
          {/* Row 1: Search + Actions */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <Input
                aria-label="Search library"
                placeholder={searchPlaceholder}
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
                className="rounded-xl pl-9 shadow-sm sm:pr-16"
              />
              <button
                type="button"
                className="text-muted-foreground/50 hover:text-muted-foreground absolute top-1/2 right-3 hidden -translate-y-1/2 text-[11px] transition-colors sm:inline-flex"
                onClick={() =>
                  globalThis.dispatchEvent(new Event("open-command-palette"))
                }
              >
                or {isMac ? "⌘" : "Ctrl+"}K
              </button>
            </div>

            <Button
              onClick={onAddBook}
              aria-label="Add Book"
              className="shrink-0 rounded-xl shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2 h-4 w-4"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              <span className="hidden sm:inline">Add Book</span>
            </Button>

            <Button
              variant="outline"
              onClick={onAddSeries}
              aria-label="Add Series"
              className="shrink-0 rounded-xl shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2 h-4 w-4"
              >
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <path d="M6 9h12" />
              </svg>
              <span className="hidden sm:inline">Add Series</span>
            </Button>

            {onFindDuplicates && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onFindDuplicates}
                aria-label="Find Duplicates"
                className="text-muted-foreground hover:text-foreground shrink-0 rounded-xl text-xs"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1.5 h-3.5 w-3.5"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                <span className="hidden sm:inline">Find Duplicates</span>
              </Button>
            )}
          </div>

          {/* Row 2: Filters + View controls */}
          <div className="flex flex-wrap items-end gap-2">
            {/* Filter controls: inline on desktop, sheet trigger on mobile */}
            {isMobile ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs shadow-sm"
                onClick={() => setFiltersOpen(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1.5 h-3.5 w-3.5"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            ) : (
              <FilterControls />
            )}

            {/* Sort */}
            <div className="space-y-1">
              <Label
                htmlFor="sort-field"
                className="text-muted-foreground text-[11px] font-medium"
              >
                Sort
              </Label>
              <div className="flex items-center gap-1">
                <Select
                  value={sortField}
                  onValueChange={(value) => {
                    if (value) setSortField(value as SortField)
                  }}
                >
                  <SelectTrigger
                    id="sort-field"
                    className="w-34 rounded-xl text-xs shadow-sm"
                  >
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {SORT_FIELDS.map((field) => (
                      <SelectItem key={field} value={field}>
                        {SORT_LABELS[field]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  className="focus-visible:ring-ring border-input hover:bg-accent inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all focus-visible:ring-1 focus-visible:outline-none"
                  aria-label={
                    sortOrder === "asc" ? "Sort ascending" : "Sort descending"
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
                    className={`h-3.5 w-3.5 transition-transform ${
                      sortOrder === "desc" ? "rotate-180" : ""
                    }`}
                  >
                    <path d="m5 12 7-7 7 7" />
                    <path d="M12 19V5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-muted-foreground hover:text-foreground self-end rounded-xl text-xs"
              >
                Clear
              </Button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Collection View */}
            <fieldset className="border-input flex items-center overflow-hidden rounded-xl border">
              <legend className="sr-only">Collection view</legend>
              <button
                className={`focus-visible:ring-ring focus-visible:ring-offset-background px-2.5 py-1.5 text-xs transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  collectionView === "series"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-accent hover:text-foreground"
                }`}
                onClick={() => setCollectionView("series")}
                aria-label="Series view"
                aria-pressed={collectionView === "series"}
                type="button"
              >
                Series
              </button>
              <button
                className={`focus-visible:ring-ring focus-visible:ring-offset-background px-2.5 py-1.5 text-xs transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  collectionView === "volumes"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-accent hover:text-foreground"
                }`}
                onClick={() => setCollectionView("volumes")}
                aria-label="Volumes view"
                aria-pressed={collectionView === "volumes"}
                type="button"
              >
                Volumes
              </button>
            </fieldset>

            {/* Card Size (grid only) */}
            {viewMode === "grid" && (
              <fieldset className="border-input flex items-center overflow-hidden rounded-xl border">
                <legend className="sr-only">Card size</legend>
                {(["compact", "default", "large"] as const).map((size) => {
                  const sizeLabels = {
                    compact: "S",
                    default: "M",
                    large: "L"
                  } as const
                  const label = sizeLabels[size]
                  return (
                    <button
                      key={size}
                      className={`focus-visible:ring-ring focus-visible:ring-offset-background px-2 py-1.5 text-xs transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                        cardSize === size
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent hover:text-foreground"
                      }`}
                      onClick={() => setCardSize(size)}
                      aria-label={`${size} card size`}
                      aria-pressed={cardSize === size}
                      type="button"
                    >
                      {label}
                    </button>
                  )
                })}
              </fieldset>
            )}

            {/* View Toggle */}
            <fieldset className="border-input flex items-center overflow-hidden rounded-xl border">
              <legend className="sr-only">View mode</legend>
              <button
                className={`focus-visible:ring-ring focus-visible:ring-offset-background p-1.5 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-foreground"}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
              </button>
              <button
                className={`focus-visible:ring-ring focus-visible:ring-offset-background p-1.5 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-foreground"}`}
                onClick={() => setViewMode("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <line x1="8" x2="21" y1="6" y2="6" />
                  <line x1="8" x2="21" y1="12" y2="12" />
                  <line x1="8" x2="21" y1="18" y2="18" />
                  <line x1="3" x2="3.01" y1="6" y2="6" />
                  <line x1="3" x2="3.01" y1="12" y2="12" />
                  <line x1="3" x2="3.01" y1="18" y2="18" />
                </svg>
              </button>
            </fieldset>
          </div>

          {/* Mobile filter drawer */}
          {isMobile && (
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 p-6 pt-2">
                  <FilterControls layout="vertical" />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </div>
  )
}
