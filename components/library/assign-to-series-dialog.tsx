"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from "@/components/ui/combobox"
import type { SeriesWithVolumes } from "@/lib/types/database"

/** Props for the {@link AssignToSeriesDialog} component. @source */
interface AssignToSeriesDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly series: SeriesWithVolumes[]
  readonly selectedVolumeCount: number
  /**
   * Assign selected unassigned volumes to the given series.
   * @returns `true` if at least one volume was assigned.
   */
  readonly onAssign: (seriesId: string) => Promise<boolean>
}

/**
 * Dialog that assigns selected (unassigned) volumes to an existing series.
 * @source
 */
export function AssignToSeriesDialog({
  open,
  onOpenChange,
  series,
  selectedVolumeCount,
  onAssign
}: AssignToSeriesDialogProps) {
  const [selectedSeries, setSelectedSeries] =
    useState<SeriesWithVolumes | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sortedSeries = useMemo(() => {
    return [...series].sort((a, b) => a.title.localeCompare(b.title))
  }, [series])

  useEffect(() => {
    if (!open) {
      setSelectedSeries(null)
      setIsSubmitting(false)
    }
  }, [open])

  const handleAssign = async () => {
    if (!selectedSeries) return
    setIsSubmitting(true)
    try {
      const didAssign = await onAssign(selectedSeries.id)
      if (didAssign) {
        onOpenChange(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const assignLabel =
    selectedVolumeCount === 1
      ? "Assign 1 book"
      : `Assign ${selectedVolumeCount} books`

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSubmitting) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Assign to series</DialogTitle>
          <DialogDescription>
            Choose a series to attach your selected unassigned book
            {selectedVolumeCount === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-muted-foreground text-xs tracking-widest uppercase">
            Target series
          </div>

          <Combobox
            items={sortedSeries}
            value={selectedSeries}
            onValueChange={(value) => {
              setSelectedSeries(value ?? null)
            }}
          >
            <ComboboxInput
              placeholder="Search series…"
              showClear
              disabled={isSubmitting}
            />
            <ComboboxContent aria-label="Select series">
              <ComboboxEmpty>No series found.</ComboboxEmpty>
              <ComboboxList>
                {(item: SeriesWithVolumes) => (
                  <ComboboxItem key={item.id} value={item}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.title}</div>
                      {item.author && (
                        <div className="text-muted-foreground truncate text-[11px]">
                          {item.author}
                        </div>
                      )}
                    </div>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={
              !selectedSeries || selectedVolumeCount === 0 || isSubmitting
            }
            className="rounded-xl"
          >
            {assignLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
