"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CoverImage } from "@/components/library/cover-image"
import { useLibraryStore } from "@/lib/store/library-store"
import type { Volume } from "@/lib/types/database"

interface AddToShelfDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly existingVolumeIds: Set<string>
  readonly onAdd: (volumeIds: string[]) => Promise<void>
}

export function AddToShelfDialog({
  open,
  onOpenChange,
  existingVolumeIds,
  onAdd
}: AddToShelfDialogProps) {
  const { series, unassignedVolumes } = useLibraryStore()
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get all volumes not already on the shelf
  const availableVolumes = useMemo(() => {
    const volumes: Array<Volume & { seriesTitle?: string }> = []

    // Volumes from series
    for (const s of series) {
      for (const v of s.volumes) {
        if (!existingVolumeIds.has(v.id)) {
          volumes.push({ ...v, seriesTitle: s.title })
        }
      }
    }

    // Unassigned volumes
    for (const v of unassignedVolumes) {
      if (!existingVolumeIds.has(v.id)) {
        volumes.push(v)
      }
    }

    return volumes
  }, [series, unassignedVolumes, existingVolumeIds])

  // Filter by search
  const filteredVolumes = useMemo(() => {
    if (!search.trim()) return availableVolumes

    const searchLower = search.toLowerCase()
    return availableVolumes.filter((v) => {
      const title = v.title?.toLowerCase() ?? ""
      const seriesTitle = v.seriesTitle?.toLowerCase() ?? ""
      const isbn = v.isbn?.toLowerCase() ?? ""
      return (
        title.includes(searchLower) ||
        seriesTitle.includes(searchLower) ||
        isbn.includes(searchLower)
      )
    })
  }, [availableVolumes, search])

  const toggleVolume = (volumeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(volumeId)) {
        next.delete(volumeId)
      } else {
        next.add(volumeId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(filteredVolumes.map((v) => v.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return

    setIsSubmitting(true)
    try {
      await onAdd(Array.from(selectedIds))
      setSelectedIds(new Set())
      setSearch("")
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedIds(new Set())
      setSearch("")
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Books to Shelf</DialogTitle>
          <DialogDescription>
            Select books from your library to add to this bookshelf.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and bulk actions */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by title or ISBN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={filteredVolumes.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={selectedIds.size === 0}
            >
              Clear
            </Button>
          </div>

          {/* Volume list */}
          <ScrollArea className="h-80 rounded-md border">
            {filteredVolumes.length === 0 ? (
              <div className="text-muted-foreground flex h-full items-center justify-center p-4">
                {availableVolumes.length === 0
                  ? "All volumes are already on this shelf"
                  : "No volumes match your search"}
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredVolumes.map((volume) => (
                  <label
                    key={volume.id}
                    className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md p-2"
                  >
                    <Checkbox
                      checked={selectedIds.has(volume.id)}
                      onCheckedChange={() => toggleVolume(volume.id)}
                    />
                    <div className="h-12 w-8 shrink-0 overflow-hidden rounded">
                      <CoverImage
                        isbn={volume.isbn}
                        coverImageUrl={volume.cover_image_url}
                        alt={volume.title ?? "Volume cover"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {getVolumeDisplayTitle(volume)}
                      </div>
                      {volume.seriesTitle && (
                        <div className="text-muted-foreground truncate text-sm">
                          {volume.seriesTitle}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selection count */}
          <div className="text-muted-foreground text-sm">
            {selectedIds.size} of {availableVolumes.length} volumes selected
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedIds.size === 0}
          >
            {isSubmitting ? "Adding..." : getAddButtonText(selectedIds.size)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getAddButtonText(count: number): string {
  if (count === 1) return "Add 1 Book"
  return "Add " + count + " Books"
}

function normalizeVolumeNumber(
  value: number | null | undefined
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.round(value)
}

function getVolumeDisplayTitle(
  volume: Volume & { seriesTitle?: string }
): string {
  const title = volume.title?.trim()
  if (title) return title

  const volumeNumber = normalizeVolumeNumber(volume.volume_number)
  if (volume.seriesTitle) {
    if (volumeNumber === null) return volume.seriesTitle
    return `${volume.seriesTitle} Vol. ${volumeNumber}`
  }
  if (volumeNumber === null) return "Untitled Volume"
  return `Volume ${volumeNumber}`
}
