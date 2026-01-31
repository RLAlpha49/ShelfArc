"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import type { Series, SeriesInsert, TitleType } from "@/lib/types/database"

interface SeriesDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly series?: Series | null
  readonly onSubmit: (data: Omit<SeriesInsert, "user_id">) => Promise<void>
}

export function SeriesDialog({
  open,
  onOpenChange,
  series,
  onSubmit
}: SeriesDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: series?.title || "",
    original_title: series?.original_title || "",
    description: series?.description || "",
    author: series?.author || "",
    artist: series?.artist || "",
    publisher: series?.publisher || "",
    cover_image_url: series?.cover_image_url || "",
    type: series?.type || "manga",
    total_volumes: series?.total_volumes?.toString() || "",
    status: series?.status || "",
    tags: series?.tags?.join(", ") || ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const tagsArray = formData.tags
        ? formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : []

      await onSubmit({
        title: formData.title,
        original_title: formData.original_title || null,
        description: formData.description || null,
        author: formData.author || null,
        artist: formData.artist || null,
        publisher: formData.publisher || null,
        cover_image_url: formData.cover_image_url || null,
        type: formData.type,
        total_volumes: formData.total_volumes
          ? Number.parseInt(formData.total_volumes, 10)
          : null,
        status: formData.status || null,
        tags: tagsArray
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving series:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{series ? "Edit Series" : "Add New Series"}</DialogTitle>
          <DialogDescription>
            {series
              ? "Update the series information below."
              : "Fill in the details to add a new series to your collection."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Series title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="original_title">Original Title</Label>
                <Input
                  id="original_title"
                  value={formData.original_title}
                  onChange={(e) =>
                    setFormData({ ...formData, original_title: e.target.value })
                  }
                  placeholder="Japanese/original title"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the series"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) =>
                    setFormData({ ...formData, author: e.target.value })
                  }
                  placeholder="Author name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="artist">Artist</Label>
                <Input
                  id="artist"
                  value={formData.artist}
                  onChange={(e) =>
                    setFormData({ ...formData, artist: e.target.value })
                  }
                  placeholder="Artist name (if different)"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="publisher">Publisher</Label>
                <Input
                  id="publisher"
                  value={formData.publisher}
                  onChange={(e) =>
                    setFormData({ ...formData, publisher: e.target.value })
                  }
                  placeholder="Publisher name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cover_image_url">Cover Image URL</Label>
                <Input
                  id="cover_image_url"
                  value={formData.cover_image_url}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cover_image_url: e.target.value
                    })
                  }
                  placeholder="https://..."
                  type="url"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => {
                    if (value)
                      setFormData({ ...formData, type: value as TitleType })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manga">Manga</SelectItem>
                    <SelectItem value="light_novel">Light Novel</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_volumes">Total Volumes</Label>
                <Input
                  id="total_volumes"
                  value={formData.total_volumes}
                  onChange={(e) =>
                    setFormData({ ...formData, total_volumes: e.target.value })
                  }
                  placeholder="Leave blank if ongoing"
                  type="number"
                  min="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => {
                    if (value) setFormData({ ...formData, status: value })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="hiatus">Hiatus</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                placeholder="Enter tags separated by commas"
              />
              <p className="text-muted-foreground text-xs">
                Separate multiple tags with commas (e.g., fantasy, isekai,
                romance)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && "Saving..."}
              {!loading && series && "Save Changes"}
              {!loading && !series && "Add Series"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
