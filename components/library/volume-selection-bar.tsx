import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import type { OwnershipStatus, ReadingStatus } from "@/lib/types/database"

/**
 * Selection bar for bulk actions on volumes.
 * Extracted to keep {@link SeriesDetailPage} complexity low.
 * @source
 */
export function VolumeSelectionBar({
  selectedCount,
  totalSelectableCount,
  isAllSelected,
  onSelectAll,
  onClear,
  onApplyOwnership,
  onApplyReading,
  onEdit,
  onDelete,
  onBulkScrape,
  onCancel
}: {
  readonly selectedCount: number
  readonly totalSelectableCount: number
  readonly isAllSelected: boolean
  readonly onSelectAll: () => void
  readonly onClear: () => void
  readonly onApplyOwnership: (status: OwnershipStatus) => void
  readonly onApplyReading: (status: ReadingStatus) => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onBulkScrape?: () => void
  readonly onCancel: () => void
}) {
  if (selectedCount <= 0) return null

  return (
    <div className="animate-slide-up-fade bg-background/90 fixed inset-x-0 bottom-0 z-50 border-t shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.1)] backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-semibold">
              {selectedCount} selected
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onSelectAll}
            disabled={totalSelectableCount === 0 || isAllSelected}
            className="rounded-xl"
          >
            Select all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={selectedCount === 0}
            className="rounded-xl"
          >
            Clear
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "rounded-xl"
              })}
              disabled={selectedCount === 0}
            >
              Bulk actions
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Ownership</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onApplyOwnership("owned")}>
                  Mark owned
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onApplyOwnership("wishlist")}>
                  Mark wishlist
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Reading status</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onApplyReading("unread")}>
                  Mark unread
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onApplyReading("reading")}>
                  Mark reading
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onApplyReading("completed")}>
                  Mark completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onApplyReading("on_hold")}>
                  Mark on hold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onApplyReading("dropped")}>
                  Mark dropped
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {onBulkScrape && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onBulkScrape}>
                    Bulk scrape prices
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={selectedCount !== 1}
            className="rounded-xl"
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={selectedCount === 0}
            className="rounded-xl"
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="rounded-xl"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
