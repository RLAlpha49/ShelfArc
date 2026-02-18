"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import type {
  TitleType,
  SeriesStatus,
  OwnershipStatus,
  ReadingStatus,
  VolumeEdition,
  VolumeFormat
} from "@/lib/types/database"

const UNCHANGED = "__unchanged__"

interface BulkSeriesFields {
  type: TitleType | typeof UNCHANGED
  status: SeriesStatus | "none" | typeof UNCHANGED
  author: string
  publisher: string
}

interface BulkVolumeFields {
  ownership_status: OwnershipStatus | typeof UNCHANGED
  reading_status: ReadingStatus | typeof UNCHANGED
  edition: VolumeEdition | "none" | typeof UNCHANGED
  format: VolumeFormat | "none" | typeof UNCHANGED
  rating: string
}

function getSeriesChanges(
  fields: BulkSeriesFields
): Record<string, unknown> | null {
  const changes: Record<string, unknown> = {}
  if (fields.type !== UNCHANGED) changes.type = fields.type
  if (fields.status !== UNCHANGED)
    changes.status = fields.status === "none" ? null : fields.status
  if (fields.author.trim()) changes.author = fields.author.trim()
  if (fields.publisher.trim()) changes.publisher = fields.publisher.trim()
  return Object.keys(changes).length > 0 ? changes : null
}

function getVolumeChanges(
  fields: BulkVolumeFields
): Record<string, unknown> | null {
  const changes: Record<string, unknown> = {}
  if (fields.ownership_status !== UNCHANGED)
    changes.ownership_status = fields.ownership_status
  if (fields.reading_status !== UNCHANGED)
    changes.reading_status = fields.reading_status
  if (fields.edition !== UNCHANGED)
    changes.edition = fields.edition === "none" ? null : fields.edition
  if (fields.format !== UNCHANGED)
    changes.format = fields.format === "none" ? null : fields.format
  if (fields.rating.trim()) {
    const val = Number(fields.rating)
    if (Number.isFinite(val) && val >= 0 && val <= 10) changes.rating = val
  }
  return Object.keys(changes).length > 0 ? changes : null
}

/** Props for the {@link BulkEditDialog} component. @source */
interface BulkEditDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly mode: "series" | "volumes"
  readonly selectedCount: number
  readonly onApply: (changes: Record<string, unknown>) => void | Promise<void>
}

/**
 * Dialog for bulk-editing multiple series or volumes.
 * Only filled fields are applied to the selected items.
 * @source
 */
export function BulkEditDialog({
  open,
  onOpenChange,
  mode,
  selectedCount,
  onApply
}: BulkEditDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [seriesFields, setSeriesFields] = useState<BulkSeriesFields>({
    type: UNCHANGED,
    status: UNCHANGED,
    author: "",
    publisher: ""
  })

  const [volumeFields, setVolumeFields] = useState<BulkVolumeFields>({
    ownership_status: UNCHANGED,
    reading_status: UNCHANGED,
    edition: UNCHANGED,
    format: UNCHANGED,
    rating: ""
  })

  const resetFields = useCallback(() => {
    setSeriesFields({
      type: UNCHANGED,
      status: UNCHANGED,
      author: "",
      publisher: ""
    })
    setVolumeFields({
      ownership_status: UNCHANGED,
      reading_status: UNCHANGED,
      edition: UNCHANGED,
      format: UNCHANGED,
      rating: ""
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    const changes =
      mode === "series"
        ? getSeriesChanges(seriesFields)
        : getVolumeChanges(volumeFields)
    if (!changes) return

    setIsSubmitting(true)
    try {
      await onApply(changes)
      resetFields()
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }, [mode, seriesFields, volumeFields, onApply, resetFields, onOpenChange])

  const hasChanges =
    mode === "series"
      ? getSeriesChanges(seriesFields) !== null
      : getVolumeChanges(volumeFields) !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetFields()
        onOpenChange(next)
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Bulk Edit {selectedCount} {mode === "series" ? "Series" : "Volume"}
            {selectedCount !== 1 && mode !== "series" ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Only fields you change will be applied. Leave fields unchanged to
            keep existing values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode === "series" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="bulk-type">Type</Label>
                <Select
                  value={seriesFields.type}
                  onValueChange={(v) =>
                    setSeriesFields((prev) => ({
                      ...prev,
                      type: v as BulkSeriesFields["type"]
                    }))
                  }
                >
                  <SelectTrigger id="bulk-type" className="rounded-xl">
                    <SelectValue placeholder="Unchanged" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={UNCHANGED}>Unchanged</SelectItem>
                    <SelectItem value="manga">Manga</SelectItem>
                    <SelectItem value="light_novel">Light Novel</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-status">Status</Label>
                <Select
                  value={seriesFields.status}
                  onValueChange={(v) =>
                    setSeriesFields((prev) => ({
                      ...prev,
                      status: v as BulkSeriesFields["status"]
                    }))
                  }
                >
                  <SelectTrigger id="bulk-status" className="rounded-xl">
                    <SelectValue placeholder="Unchanged" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={UNCHANGED}>Unchanged</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="hiatus">Hiatus</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="announced">Announced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-author">Author</Label>
                <Input
                  id="bulk-author"
                  value={seriesFields.author}
                  onChange={(e) =>
                    setSeriesFields((prev) => ({
                      ...prev,
                      author: e.target.value
                    }))
                  }
                  placeholder="Leave empty to keep unchanged"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-publisher">Publisher</Label>
                <Input
                  id="bulk-publisher"
                  value={seriesFields.publisher}
                  onChange={(e) =>
                    setSeriesFields((prev) => ({
                      ...prev,
                      publisher: e.target.value
                    }))
                  }
                  placeholder="Leave empty to keep unchanged"
                  className="rounded-xl"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="bulk-ownership">Ownership</Label>
                <Select
                  value={volumeFields.ownership_status}
                  onValueChange={(v) =>
                    setVolumeFields((prev) => ({
                      ...prev,
                      ownership_status:
                        v as BulkVolumeFields["ownership_status"]
                    }))
                  }
                >
                  <SelectTrigger id="bulk-ownership" className="rounded-xl">
                    <SelectValue placeholder="Unchanged" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={UNCHANGED}>Unchanged</SelectItem>
                    <SelectItem value="owned">Owned</SelectItem>
                    <SelectItem value="wishlist">Wishlist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-reading">Reading Status</Label>
                <Select
                  value={volumeFields.reading_status}
                  onValueChange={(v) =>
                    setVolumeFields((prev) => ({
                      ...prev,
                      reading_status: v as BulkVolumeFields["reading_status"]
                    }))
                  }
                >
                  <SelectTrigger id="bulk-reading" className="rounded-xl">
                    <SelectValue placeholder="Unchanged" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={UNCHANGED}>Unchanged</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-edition">Edition</Label>
                <Select
                  value={volumeFields.edition}
                  onValueChange={(v) =>
                    setVolumeFields((prev) => ({
                      ...prev,
                      edition: v as BulkVolumeFields["edition"]
                    }))
                  }
                >
                  <SelectTrigger id="bulk-edition" className="rounded-xl">
                    <SelectValue placeholder="Unchanged" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={UNCHANGED}>Unchanged</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="first_edition">First Edition</SelectItem>
                    <SelectItem value="collectors">Collector&apos;s</SelectItem>
                    <SelectItem value="omnibus">Omnibus</SelectItem>
                    <SelectItem value="box_set">Box Set</SelectItem>
                    <SelectItem value="limited">Limited</SelectItem>
                    <SelectItem value="deluxe">Deluxe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-format">Format</Label>
                <Select
                  value={volumeFields.format}
                  onValueChange={(v) =>
                    setVolumeFields((prev) => ({
                      ...prev,
                      format: v as BulkVolumeFields["format"]
                    }))
                  }
                >
                  <SelectTrigger id="bulk-format" className="rounded-xl">
                    <SelectValue placeholder="Unchanged" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={UNCHANGED}>Unchanged</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="paperback">Paperback</SelectItem>
                    <SelectItem value="hardcover">Hardcover</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="audiobook">Audiobook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-rating">Rating (0-10)</Label>
                <Input
                  id="bulk-rating"
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={volumeFields.rating}
                  onChange={(e) =>
                    setVolumeFields((prev) => ({
                      ...prev,
                      rating: e.target.value
                    }))
                  }
                  placeholder="Leave empty to keep unchanged"
                  className="rounded-xl"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetFields()
              onOpenChange(false)
            }}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || isSubmitting}
            className="rounded-xl"
          >
            {isSubmitting ? "Applying..." : `Apply to ${selectedCount} items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
