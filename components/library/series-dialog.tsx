"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
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
import { uploadImage } from "@/lib/uploads/upload-image"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"
import type { Series, SeriesInsert, TitleType } from "@/lib/types/database"

interface SeriesDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly series?: Series | null
  readonly onSubmit: (data: Omit<SeriesInsert, "user_id">) => Promise<void>
}

const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024

const defaultFormData = {
  title: "",
  original_title: "",
  description: "",
  author: "",
  artist: "",
  publisher: "",
  cover_image_url: "",
  type: "manga" as TitleType,
  total_volumes: "",
  status: "",
  tags: ""
}

const buildSeriesFormData = (series?: Series | null) => ({
  ...defaultFormData,
  title: series?.title ?? "",
  original_title: series?.original_title ?? "",
  description: series?.description ?? "",
  author: series?.author ?? "",
  artist: series?.artist ?? "",
  publisher: series?.publisher ?? "",
  cover_image_url: series?.cover_image_url ?? "",
  type: series?.type ?? "manga",
  total_volumes: series?.total_volumes ? String(series.total_volumes) : "",
  status: series?.status ?? "",
  tags: series?.tags?.join(", ") ?? ""
})

type SeriesFormData = ReturnType<typeof buildSeriesFormData>

const areSeriesFormDataEqual = (left: SeriesFormData, right: SeriesFormData) =>
  left.title === right.title &&
  left.original_title === right.original_title &&
  left.description === right.description &&
  left.author === right.author &&
  left.artist === right.artist &&
  left.publisher === right.publisher &&
  left.cover_image_url === right.cover_image_url &&
  left.type === right.type &&
  left.total_volumes === right.total_volumes &&
  left.status === right.status &&
  left.tags === right.tags

export function SeriesDialog({
  open,
  onOpenChange,
  series,
  onSubmit
}: SeriesDialogProps) {
  const [loading, setLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("")
  const [coverPreviewError, setCoverPreviewError] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const [formData, setFormData] = useState(() => buildSeriesFormData(series))
  const seriesRef = useRef(series)
  const seriesIdRef = useRef<string | null>(series?.id ?? null)
  const seriesSnapshotRef = useRef(buildSeriesFormData(series))
  const wasOpenRef = useRef(false)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    seriesRef.current = series
  }, [series])

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }

    const nextSeries = seriesRef.current
    const nextSeriesId = nextSeries?.id ?? null
    const isOpening = !wasOpenRef.current
    const seriesChanged = seriesIdRef.current !== nextSeriesId

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setCoverPreviewUrl("")
    setCoverPreviewError(false)

    if (isOpening || seriesChanged) {
      const nextFormData = buildSeriesFormData(nextSeries)
      setFormData(nextFormData)
      seriesSnapshotRef.current = nextFormData
    }

    seriesIdRef.current = nextSeriesId
    wasOpenRef.current = true
  }, [open, series?.id])

  useEffect(() => {
    if (!open || !series) return

    const nextFormData = buildSeriesFormData(series)
    const previousSnapshot = seriesSnapshotRef.current
    const hasMeaningfulChanges = !areSeriesFormDataEqual(
      nextFormData,
      previousSnapshot
    )
    const userHasEdits = !areSeriesFormDataEqual(formData, previousSnapshot)

    if (hasMeaningfulChanges && !userHasEdits) {
      setFormData(nextFormData)
      seriesSnapshotRef.current = nextFormData
    }
  }, [open, series, formData])

  const setPreviewUrl = (url: string | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = url
    setCoverPreviewUrl(url ?? "")
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
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

  const handleCoverFileChange = async (file: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.")
      return
    }
    if (file.size > MAX_COVER_SIZE_BYTES) {
      toast.error("Cover images must be 5MB or smaller.")
      return
    }
    setIsUploading(true)
    setCoverPreviewError(false)
    const previewUrl = URL.createObjectURL(file)
    setPreviewUrl(previewUrl)

    try {
      const replacePath = extractStoragePath(formData.cover_image_url)
      const url = await uploadImage(file, "series-cover", {
        replacePath: replacePath ?? undefined
      })
      setFormData((prev) => ({ ...prev, cover_image_url: url }))
      toast.success("Cover image uploaded")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed"
      toast.error(message)
    } finally {
      setIsUploading(false)
      setPreviewUrl(null)
    }
  }

  const coverUrl = coverPreviewUrl || resolveImageUrl(formData.cover_image_url)
  const coverSearchTitle = formData.title.trim()
  const coverSearchUrl = coverSearchTitle
    ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(coverSearchTitle)}`
    : ""

  const handleOpenCoverSearch = () => {
    if (!coverSearchUrl) return
    window.open(coverSearchUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl p-0 sm:max-w-4xl">
        <DialogHeader className="bg-warm/30 rounded-t-2xl border-b px-6 pt-6 pb-4">
          <DialogTitle className="font-display">
            {series ? "Edit Series" : "Add New Series"}
          </DialogTitle>
          <DialogDescription>
            {series
              ? "Update the series information below."
              : "Fill in the details to add a new series to your collection."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pt-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <div className="space-y-4">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Basic Info
                </span>
                <div className="grid gap-4 md:grid-cols-2">
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
                        setFormData({
                          ...formData,
                          original_title: e.target.value
                        })
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
                    rows={4}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Credits
                </span>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                      placeholder="Artist name"
                    />
                  </div>

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
                </div>
              </div>

              <div className="space-y-4">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Publication
                </span>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => {
                        if (value)
                          setFormData({
                            ...formData,
                            type: value as TitleType
                          })
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
                        setFormData({
                          ...formData,
                          total_volumes: e.target.value
                        })
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
                        setFormData({ ...formData, status: value || "" })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="ongoing">Ongoing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="hiatus">Hiatus</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

            <aside className="glass-card rounded-2xl p-4">
              <div className="space-y-4">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Cover Art
                </span>
                <div className="space-y-2">
                  <Label htmlFor="cover_image_url">Cover Image URL</Label>
                  <Input
                    id="cover_image_url"
                    value={formData.cover_image_url}
                    onChange={(e) => {
                      setCoverPreviewError(false)
                      setFormData({
                        ...formData,
                        cover_image_url: e.target.value
                      })
                    }}
                    placeholder="https://..."
                    type="url"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={handleOpenCoverSearch}
                    disabled={!coverSearchUrl}
                    title={
                      coverSearchUrl
                        ? "Search Google Images for cover art"
                        : "Add a title to enable image search"
                    }
                  >
                    Search Google Images
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    Opens a new tab using the series title.
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cover_image_upload">Upload Cover Image</Label>
                  <Input
                    id="cover_image_upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        void handleCoverFileChange(file)
                      }
                      e.currentTarget.value = ""
                    }}
                  />
                  <div className="flex items-center gap-2">
                    {formData.cover_image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            cover_image_url: ""
                          }))
                          setCoverPreviewError(false)
                          setPreviewUrl(null)
                        }}
                      >
                        Clear
                      </Button>
                    )}
                    {isUploading && (
                      <span className="text-muted-foreground text-xs">
                        Uploading...
                      </span>
                    )}
                  </div>
                </div>

                {coverUrl && !coverPreviewError && (
                  <div className="flex justify-center">
                    <div className="bg-muted relative aspect-2/3 w-40 overflow-hidden rounded-xl">
                      <img
                        src={coverUrl}
                        alt="Cover preview"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={() => {
                          if (!coverPreviewError) {
                            const attemptedUrl = coverUrl
                            toast.error(
                              attemptedUrl
                                ? `Failed to load cover image (${attemptedUrl}).`
                                : "Failed to load cover image."
                            )
                          }
                          setCoverPreviewError(true)
                          setPreviewUrl(null)
                        }}
                      />
                    </div>
                  </div>
                )}
                {coverPreviewError && (
                  <div className="flex justify-center">
                    <div className="bg-muted text-muted-foreground flex aspect-2/3 w-40 items-center justify-center rounded-xl text-xs">
                      Preview unavailable
                    </div>
                  </div>
                )}
                <p className="text-muted-foreground text-xs">
                  Images are resized and compressed to WebP on upload.
                </p>
              </div>
            </aside>
          </div>

          <DialogFooter className="px-6 pb-6">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
              disabled={loading || isUploading}
            >
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
