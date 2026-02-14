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
import type {
  OwnershipStatus,
  ReadingStatus,
  TitleType
} from "@/lib/types/database"

/**
 * Sticky bottom bar for bulk-acting on selected items.
 * Used both on the main library page and the series detail page.
 * @source
 */
export function VolumeSelectionBar({
  selectedCount,
  totalSelectableCount,
  isAllSelected,
  onSelectAll,
  onClear,
  onEdit,
  onDelete,
  onCancel,
  // Volume-mode actions
  onApplyOwnership,
  onApplyReading,
  onBulkScrape,
  // Series-mode actions (library page, series collection view)
  onApplySeriesType,
  onApplyAllVolumesOwnership,
  onApplyAllVolumesReading,
  // Assign to series (library page, unassigned volumes)
  onAssignToSeries,
  assignToSeriesCount
}: {
  readonly selectedCount: number
  readonly totalSelectableCount: number
  readonly isAllSelected: boolean
  readonly onSelectAll: () => void
  readonly onClear: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onCancel: () => void
  readonly onApplyOwnership?: (status: OwnershipStatus) => void | Promise<void>
  readonly onApplyReading?: (status: ReadingStatus) => void | Promise<void>
  readonly onBulkScrape?: () => void
  readonly onApplySeriesType?: (type: TitleType) => void | Promise<void>
  readonly onApplyAllVolumesOwnership?: (
    status: OwnershipStatus
  ) => void | Promise<void>
  readonly onApplyAllVolumesReading?: (
    status: ReadingStatus
  ) => void | Promise<void>
  readonly onAssignToSeries?: () => void
  readonly assignToSeriesCount?: number
}) {
  if (selectedCount <= 0) return null

  const isSeriesMode = Boolean(onApplySeriesType)

  return (
    <div className="animate-fade-in bg-background/90 sticky top-16 z-40 mx-auto my-3 max-w-4xl rounded-2xl border shadow-lg backdrop-blur-md">
      <div className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
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

          {onAssignToSeries &&
            assignToSeriesCount != null &&
            assignToSeriesCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAssignToSeries}
                className="rounded-xl"
              >
                Assign to series ({assignToSeriesCount})
              </Button>
            )}

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
              {isSeriesMode ? (
                <>
                  {onApplySeriesType && (
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Series type</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => onApplySeriesType("light_novel")}
                      >
                        Set to Light Novel
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onApplySeriesType("manga")}
                      >
                        Set to Manga
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onApplySeriesType("other")}
                      >
                        Set to Other
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  )}
                  {(onApplyAllVolumesOwnership || onApplyAllVolumesReading) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Set all volumes</DropdownMenuLabel>
                        {onApplyAllVolumesOwnership && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                onApplyAllVolumesOwnership("owned")
                              }
                            >
                              Mark all owned
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                onApplyAllVolumesOwnership("wishlist")
                              }
                            >
                              Mark all wishlisted
                            </DropdownMenuItem>
                          </>
                        )}
                        {onApplyAllVolumesReading && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                onApplyAllVolumesReading("completed")
                              }
                            >
                              Mark all completed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onApplyAllVolumesReading("unread")}
                            >
                              Mark all unread
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuGroup>
                    </>
                  )}
                  {onBulkScrape && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onBulkScrape}>
                        Bulk scrape prices
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              ) : (
                <>
                  {onApplyOwnership && (
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Ownership</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => onApplyOwnership("owned")}
                      >
                        Mark owned
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onApplyOwnership("wishlist")}
                      >
                        Mark wishlist
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  )}
                  {onApplyReading && (
                    <>
                      {onApplyOwnership && <DropdownMenuSeparator />}
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Reading status</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => onApplyReading("unread")}
                        >
                          Mark unread
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onApplyReading("reading")}
                        >
                          Mark reading
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onApplyReading("completed")}
                        >
                          Mark completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onApplyReading("on_hold")}
                        >
                          Mark on hold
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onApplyReading("dropped")}
                        >
                          Mark dropped
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  )}
                  {onBulkScrape && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onBulkScrape}>
                        Bulk scrape prices
                      </DropdownMenuItem>
                    </>
                  )}
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
