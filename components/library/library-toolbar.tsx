"use client"

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { FilterPresetsControl } from "@/components/library/filter-presets-control"
import { useLibraryStore } from "@/lib/store/library-store"
import type { SortField, SortOrder } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type {
  TitleType,
  OwnershipStatus,
  ReadingStatus
} from "@/lib/types/database"

const SORT_LABELS: Record<string, string> = {
  "title-asc": "Title \u2191",
  "title-desc": "Title \u2193",
  "author-asc": "Author \u2191",
  "author-desc": "Author \u2193",
  "created_at-asc": "Added \u2191",
  "created_at-desc": "Added \u2193",
  "updated_at-asc": "Updated \u2191",
  "updated_at-desc": "Updated \u2193"
}

function isSortActive(
  field: SortField,
  order: SortOrder,
  currentField: SortField,
  currentOrder: SortOrder
) {
  return field === currentField && order === currentOrder
}

/** Props for the {@link LibraryToolbar} component. @source */
interface LibraryToolbarProps {
  readonly onAddBook: () => void
  readonly onAddSeries: () => void
  readonly onOpenDuplicates?: () => void
}

/**
 * Toolbar with search, filters, sort controls, view toggles, and add-book/series buttons.
 * @param props - {@link LibraryToolbarProps}
 * @source
 */
export function LibraryToolbar({
  onAddBook,
  onAddSeries,
  onOpenDuplicates
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
    resetFilters,
    series
  } = useLibraryStore()
  const { cardSize, setCardSize } = useSettingsStore()

  const sortLabel = SORT_LABELS[`${sortField}-${sortOrder}`] ?? "Sort"

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const s of series) {
      for (const tag of s.tags ?? []) tagSet.add(tag)
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b))
  }, [series])

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
                placeholder={searchPlaceholder}
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
                className="rounded-xl pl-9 shadow-sm"
              />
            </div>

            <Button
              onClick={onAddBook}
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
          </div>

          {/* Row 2: Filters + View controls */}
          <div className="flex flex-wrap items-end gap-2">
            <FilterPresetsControl />

            {onOpenDuplicates && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-[11px] font-medium">
                  Tools
                </span>
                <Button
                  variant="outline"
                  onClick={onOpenDuplicates}
                  className="h-9 rounded-xl text-xs shadow-sm"
                >
                  Duplicates
                </Button>
              </div>
            )}

            {/* Type Filter */}
            <div className="space-y-1">
              <span className="text-muted-foreground text-[11px] font-medium">
                Type
              </span>
              <Select
                value={filters.type}
                onValueChange={(value) => {
                  if (value) setFilters({ type: value as TitleType | "all" })
                }}
              >
                <SelectTrigger className="w-30 rounded-xl text-xs shadow-sm">
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
              <span className="text-muted-foreground text-[11px] font-medium">
                Ownership
              </span>
              <Select
                value={filters.ownershipStatus}
                onValueChange={(value) => {
                  if (value)
                    setFilters({
                      ownershipStatus: value as OwnershipStatus | "all"
                    })
                }}
              >
                <SelectTrigger className="w-30 rounded-xl text-xs shadow-sm">
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
              <span className="text-muted-foreground text-[11px] font-medium">
                Reading
              </span>
              <Select
                value={filters.readingStatus}
                onValueChange={(value) => {
                  if (value)
                    setFilters({
                      readingStatus: value as ReadingStatus | "all"
                    })
                }}
              >
                <SelectTrigger className="w-30 rounded-xl text-xs shadow-sm">
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
              <div className="space-y-1">
                <span className="text-muted-foreground text-[11px] font-medium">
                  Tags
                </span>
                <Select
                  value={filters.tags.length > 0 ? filters.tags[0] : "all"}
                  onValueChange={(value) => {
                    if (value)
                      setFilters({ tags: value === "all" ? [] : [value] })
                  }}
                >
                  <SelectTrigger className="w-30 rounded-xl text-xs shadow-sm">
                    <SelectValue placeholder="Tags" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All</SelectItem>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger className="focus-visible:ring-ring bg-background border-input hover:bg-accent inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-medium shadow-sm transition-all hover:shadow-md focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
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
                  <path d="m3 16 4 4 4-4" />
                  <path d="M7 20V4" />
                  <path d="m21 8-4-4-4 4" />
                  <path d="M17 4v16" />
                </svg>
                Sort: {sortLabel}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setSortField("title")
                      setSortOrder("asc")
                    }}
                    className={
                      isSortActive("title", "asc", sortField, sortOrder)
                        ? "bg-accent font-medium"
                        : ""
                    }
                  >
                    {isSortActive("title", "asc", sortField, sortOrder) && (
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
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    Title (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSortField("title")
                      setSortOrder("desc")
                    }}
                    className={
                      isSortActive("title", "desc", sortField, sortOrder)
                        ? "bg-accent font-medium"
                        : ""
                    }
                  >
                    {isSortActive("title", "desc", sortField, sortOrder) && (
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
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    Title (Z-A)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSortField("author")
                      setSortOrder("asc")
                    }}
                    className={
                      isSortActive("author", "asc", sortField, sortOrder)
                        ? "bg-accent font-medium"
                        : ""
                    }
                  >
                    {isSortActive("author", "asc", sortField, sortOrder) && (
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
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    Author (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSortField("created_at")
                      setSortOrder("desc")
                    }}
                    className={
                      isSortActive("created_at", "desc", sortField, sortOrder)
                        ? "bg-accent font-medium"
                        : ""
                    }
                  >
                    {isSortActive(
                      "created_at",
                      "desc",
                      sortField,
                      sortOrder
                    ) && (
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
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    Recently Added
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSortField("updated_at")
                      setSortOrder("desc")
                    }}
                    className={
                      isSortActive("updated_at", "desc", sortField, sortOrder)
                        ? "bg-accent font-medium"
                        : ""
                    }
                  >
                    {isSortActive(
                      "updated_at",
                      "desc",
                      sortField,
                      sortOrder
                    ) && (
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
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    Recently Updated
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear filters */}
            {(filters.search ||
              filters.type !== "all" ||
              filters.ownershipStatus !== "all" ||
              filters.readingStatus !== "all" ||
              filters.tags.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-muted-foreground hover:text-foreground rounded-xl text-xs"
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
        </div>
      </div>
    </div>
  )
}
