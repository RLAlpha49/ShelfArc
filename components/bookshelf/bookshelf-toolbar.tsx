"use client"

import { cn } from "@/lib/utils"
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
    <div className="glass-card rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Bookshelf selector */}
        <div className="flex items-center gap-2">
          <Select
            value={selectedBookshelfId ?? ""}
            onValueChange={(value) => value && onBookshelfSelect(value)}
            disabled={disabled || bookshelves.length === 0}
          >
            <SelectTrigger className="w-56 rounded-xl">
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
            className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1.5 h-4 w-4"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New Shelf
          </Button>
        </div>

        {/* Actions for selected bookshelf */}
        {selectedBookshelf && (
          <div className="flex items-center gap-2">
            <div className="bg-muted flex rounded-lg p-0.5">
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  viewMode === "volumes"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => handleViewModeChange("volumes")}
                disabled={disabled}
                aria-label="Volumes view"
                aria-pressed={viewMode === "volumes"}
              >
                Volumes
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  viewMode === "series"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
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
              className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1.5 h-4 w-4"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              Add Books
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={disabled}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
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
          <div className="text-muted-foreground ml-auto flex items-center gap-3 text-sm">
            <span>
              <span className="font-display text-foreground font-semibold">
                {selectedBookshelf.items.length}
              </span>{" "}
              {getCountLabel(selectedBookshelf.items.length, "book", "books")}
            </span>
            <div className="bg-border h-4 w-px" />
            <span>
              <span className="font-display text-foreground font-semibold">
                {selectedBookshelf.row_count}
              </span>{" "}
              {getCountLabel(selectedBookshelf.row_count, "row", "rows")}
            </span>
          </div>
        )}
      </div>
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
