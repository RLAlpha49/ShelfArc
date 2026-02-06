"use client"

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
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import type { BookshelfWithItems } from "@/lib/types/database"

interface BookshelfToolbarProps {
  readonly bookshelves: BookshelfWithItems[]
  readonly selectedBookshelfId: string | null
  readonly onBookshelfSelect: (id: string) => void
  readonly onCreateBookshelf: () => void
  readonly onEditBookshelf: () => void
  readonly onDeleteBookshelf: () => void
  readonly onAddBooks: () => void
  readonly viewMode: "volumes" | "series"
  readonly onViewModeChange: (mode: "volumes" | "series") => void
  readonly disabled?: boolean
}

export function BookshelfToolbar({
  bookshelves,
  selectedBookshelfId,
  onBookshelfSelect,
  onCreateBookshelf,
  onEditBookshelf,
  onDeleteBookshelf,
  onAddBooks,
  viewMode,
  onViewModeChange,
  disabled = false
}: BookshelfToolbarProps) {
  const selectedBookshelf = bookshelves.find(
    (b) => b.id === selectedBookshelfId
  )

  const handleViewModeChange = (mode: "volumes" | "series") => {
    if (disabled || viewMode === mode) return
    onViewModeChange(mode)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Bookshelf selector */}
      <div className="flex items-center gap-2">
        <Select
          value={selectedBookshelfId ?? ""}
          onValueChange={(value) => value && onBookshelfSelect(value)}
          disabled={disabled || bookshelves.length === 0}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Select a bookshelf" />
          </SelectTrigger>
          <SelectContent>
            {bookshelves.map((shelf) => (
              <SelectItem key={shelf.id} value={shelf.id}>
                {shelf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={onCreateBookshelf}
          disabled={disabled}
        >
          New Shelf
        </Button>
      </div>

      {/* Actions for selected bookshelf */}
      {selectedBookshelf && (
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border">
            <button
              type="button"
              className={`px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                viewMode === "volumes" ? "bg-accent" : "hover:bg-accent/50"
              }`}
              onClick={() => handleViewModeChange("volumes")}
              disabled={disabled}
              aria-label="Volumes view"
              aria-pressed={viewMode === "volumes"}
            >
              Volumes
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                viewMode === "series" ? "bg-accent" : "hover:bg-accent/50"
              }`}
              onClick={() => handleViewModeChange("series")}
              disabled={disabled}
              aria-label="Series view"
              aria-pressed={viewMode === "series"}
            >
              Series
            </button>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={onAddBooks}
            disabled={disabled}
          >
            Add Books
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={disabled}
              className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50"
            >
              ⋮
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditBookshelf}>
                Edit Shelf Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDeleteBookshelf}
                className="text-destructive"
              >
                Delete Shelf
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Info display */}
      {selectedBookshelf && (
        <div className="text-muted-foreground ml-auto text-sm">
          {selectedBookshelf.items.length}{" "}
          {getCountLabel(selectedBookshelf.items.length, "book", "books")} •{" "}
          {selectedBookshelf.row_count}{" "}
          {getCountLabel(selectedBookshelf.row_count, "row", "rows")}
        </div>
      )}
    </div>
  )
}

function getCountLabel(
  count: number,
  singular: string,
  plural: string
): string {
  return count === 1 ? singular : plural
}
