"use client"

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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { useLibraryStore } from "@/lib/store/library-store"
import type {
  TitleType,
  OwnershipStatus,
  ReadingStatus
} from "@/lib/types/database"

interface LibraryToolbarProps {
  readonly onAddBook: () => void
  readonly onAddSeries: () => void
}

export function LibraryToolbar({
  onAddBook,
  onAddSeries
}: LibraryToolbarProps) {
  const {
    collectionView,
    setCollectionView,
    viewMode,
    setViewMode,
    setSortField,
    setSortOrder,
    filters,
    setFilters,
    resetFilters
  } = useLibraryStore()

  const searchPlaceholder = "Search by title, author, or ISBN..."

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {/* Search */}
      <div className="relative max-w-md flex-1">
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
          className="border-primary/15 focus-visible:ring-primary/30 rounded-xl pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Type Filter */}
        <Select
          value={filters.type}
          onValueChange={(value) => {
            if (value) setFilters({ type: value as TitleType | "all" })
          }}
        >
          <SelectTrigger className="border-primary/15 w-32.5 rounded-xl">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="manga">Manga</SelectItem>
            <SelectItem value="light_novel">Light Novel</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        {/* Ownership Filter */}
        <Select
          value={filters.ownershipStatus}
          onValueChange={(value) => {
            if (value)
              setFilters({ ownershipStatus: value as OwnershipStatus | "all" })
          }}
        >
          <SelectTrigger className="border-primary/15 w-32.5 rounded-xl">
            <SelectValue placeholder="Ownership" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="owned">Owned</SelectItem>
            <SelectItem value="wishlist">Wishlist</SelectItem>
          </SelectContent>
        </Select>

        {/* Reading Status Filter */}
        <Select
          value={filters.readingStatus}
          onValueChange={(value) => {
            if (value)
              setFilters({ readingStatus: value as ReadingStatus | "all" })
          }}
        >
          <SelectTrigger className="border-primary/15 w-32.5 rounded-xl">
            <SelectValue placeholder="Reading" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Reading</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="reading">Reading</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="dropped">Dropped</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger className="focus-visible:ring-ring bg-background hover:bg-primary/5 border-primary/15 inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
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
              <path d="m3 16 4 4 4-4" />
              <path d="M7 20V4" />
              <path d="m21 8-4-4-4 4" />
              <path d="M17 4v16" />
            </svg>
            Sort
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setSortField("title")
                setSortOrder("asc")
              }}
            >
              Title (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortField("title")
                setSortOrder("desc")
              }}
            >
              Title (Z-A)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortField("author")
                setSortOrder("asc")
              }}
            >
              Author (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortField("created_at")
                setSortOrder("desc")
              }}
            >
              Recently Added
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortField("updated_at")
                setSortOrder("desc")
              }}
            >
              Recently Updated
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Collection View */}
        <div className="border-primary/15 flex items-center overflow-hidden rounded-xl border">
          <button
            className={`px-3 py-2 text-sm transition-colors ${
              collectionView === "series"
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-primary/5"
            }`}
            onClick={() => setCollectionView("series")}
            aria-label="Series view"
            type="button"
          >
            Series
          </button>
          <button
            className={`px-3 py-2 text-sm transition-colors ${
              collectionView === "volumes"
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-primary/5"
            }`}
            onClick={() => setCollectionView("volumes")}
            aria-label="Volumes view"
            type="button"
          >
            Volumes
          </button>
        </div>

        {/* View Toggle */}
        <div className="border-primary/15 flex items-center overflow-hidden rounded-xl border">
          <button
            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary/10 text-primary" : "hover:bg-primary/5"}`}
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
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
              className="h-4 w-4"
            >
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
          </button>
          <button
            className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "hover:bg-primary/5"}`}
            onClick={() => setViewMode("list")}
            aria-label="List view"
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
              className="h-4 w-4"
            >
              <line x1="8" x2="21" y1="6" y2="6" />
              <line x1="8" x2="21" y1="12" y2="12" />
              <line x1="8" x2="21" y1="18" y2="18" />
              <line x1="3" x2="3.01" y1="6" y2="6" />
              <line x1="3" x2="3.01" y1="12" y2="12" />
              <line x1="3" x2="3.01" y1="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Reset Filters */}
        {(filters.search ||
          filters.type !== "all" ||
          filters.ownershipStatus !== "all" ||
          filters.readingStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground hover:text-foreground rounded-xl"
          >
            Clear filters
          </Button>
        )}

        {/* Add Book Button */}
        <Button onClick={onAddBook} className="rounded-xl">
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
          Add Book
        </Button>

        {/* Add Series Button */}
        <Button
          variant="outline"
          onClick={onAddSeries}
          className="border-primary/20 hover:bg-primary/5 rounded-xl"
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
          Add Series
        </Button>
      </div>
    </div>
  )
}
