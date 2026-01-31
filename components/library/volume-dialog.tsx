"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import type {
  Volume,
  VolumeInsert,
  OwnershipStatus,
  ReadingStatus
} from "@/lib/types/database"

interface VolumeDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly volume: Volume | null
  readonly nextVolumeNumber: number
  readonly onSubmit: (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => Promise<void>
}

const defaultFormData = {
  volume_number: 1,
  title: "",
  isbn: "",
  cover_image_url: "",
  ownership_status: "owned" as OwnershipStatus,
  reading_status: "unread" as ReadingStatus,
  current_page: "",
  page_count: "",
  rating: "",
  notes: "",
  purchase_date: "",
  purchase_price: ""
}

export function VolumeDialog({
  open,
  onOpenChange,
  volume,
  nextVolumeNumber,
  onSubmit
}: VolumeDialogProps) {
  const isEditing = !!volume
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState(defaultFormData)

  useEffect(() => {
    if (volume) {
      setFormData({
        volume_number: volume.volume_number,
        title: volume.title || "",
        isbn: volume.isbn || "",
        cover_image_url: volume.cover_image_url || "",
        ownership_status: volume.ownership_status,
        reading_status: volume.reading_status,
        current_page: volume.current_page?.toString() || "",
        page_count: volume.page_count?.toString() || "",
        rating: volume.rating?.toString() || "",
        notes: volume.notes || "",
        purchase_date: volume.purchase_date || "",
        purchase_price: volume.purchase_price?.toString() || ""
      })
    } else {
      setFormData({
        ...defaultFormData,
        volume_number: nextVolumeNumber
      })
    }
  }, [volume, nextVolumeNumber])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit({
        volume_number: formData.volume_number,
        title: formData.title || null,
        isbn: formData.isbn || null,
        cover_image_url: formData.cover_image_url || null,
        ownership_status: formData.ownership_status,
        reading_status: formData.reading_status,
        current_page: formData.current_page
          ? Number.parseInt(formData.current_page)
          : null,
        page_count: formData.page_count
          ? Number.parseInt(formData.page_count)
          : null,
        rating: formData.rating ? Number.parseInt(formData.rating) : null,
        notes: formData.notes || null,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price
          ? Number.parseFloat(formData.purchase_price)
          : null
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (
    field: keyof typeof formData,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const getButtonLabel = () => {
    if (isSubmitting) return "Saving..."
    if (isEditing) return "Update"
    return "Add"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Volume" : "Add Volume"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update volume details"
              : "Add a new volume to this series"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="volume_number">Volume Number *</Label>
              <Input
                id="volume_number"
                type="number"
                min={1}
                value={formData.volume_number}
                onChange={(e) =>
                  updateField(
                    "volume_number",
                    Number.parseInt(e.target.value) || 1
                  )
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Volume Title</Label>
              <Input
                id="title"
                placeholder="Optional subtitle"
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input
                id="isbn"
                placeholder="978-..."
                value={formData.isbn}
                onChange={(e) => updateField("isbn", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cover_image_url">Cover Image URL</Label>
              <Input
                id="cover_image_url"
                type="url"
                placeholder="https://..."
                value={formData.cover_image_url}
                onChange={(e) => updateField("cover_image_url", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ownership_status">Ownership Status</Label>
              <Select
                value={formData.ownership_status}
                onValueChange={(value) => {
                  if (value) updateField("ownership_status", value)
                }}
              >
                <SelectTrigger id="ownership_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owned">Owned</SelectItem>
                  <SelectItem value="wishlist">Wishlist</SelectItem>
                  <SelectItem value="reading">Reading</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reading_status">Reading Status</Label>
              <Select
                value={formData.reading_status}
                onValueChange={(value) => {
                  if (value) updateField("reading_status", value)
                }}
              >
                <SelectTrigger id="reading_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="reading">Reading</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_page">Current Page</Label>
              <Input
                id="current_page"
                type="number"
                min={0}
                value={formData.current_page}
                onChange={(e) => updateField("current_page", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page_count">Total Pages</Label>
              <Input
                id="page_count"
                type="number"
                min={0}
                value={formData.page_count}
                onChange={(e) => updateField("page_count", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rating">Rating (1-10)</Label>
              <Input
                id="rating"
                type="number"
                min={1}
                max={10}
                value={formData.rating}
                onChange={(e) => updateField("rating", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Purchase Date</Label>
              <Input
                id="purchase_date"
                type="date"
                value={formData.purchase_date}
                onChange={(e) => updateField("purchase_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase_price">Price</Label>
              <Input
                id="purchase_price"
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                value={formData.purchase_price}
                onChange={(e) => updateField("purchase_price", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any personal notes about this volume..."
              rows={3}
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {getButtonLabel()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
