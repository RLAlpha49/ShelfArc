"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import type {
  SeriesInsert,
  SeriesWithVolumes,
  TitleType
} from "@/lib/types/database"

interface SeriesDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly series?: SeriesWithVolumes | null
  readonly onSubmit: (data: Omit<SeriesInsert, "user_id">) => Promise<void>
}

const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024

const defaultFormData = {
  title: "",
  original_title: "",
  description: "",
  notes: "",
  author: "",
  artist: "",
  publisher: "",
  cover_image_url: "",
  type: "manga" as TitleType,
  total_volumes: "",
  status: "",
  tags: ""
}

const buildSeriesFormData = (series?: SeriesWithVolumes | null) => ({
  ...defaultFormData,
  title: series?.title ?? "",
  original_title: series?.original_title ?? "",
  description: series?.description ?? "",
  notes: series?.notes ?? "",
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
  left.notes === right.notes &&
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
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
    setCoverPreviewUrl(null)
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
    setCoverPreviewUrl(url)
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const tagsArray = formData.tags
        ? formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : []

      await onSubmit({
        title: formData.title,
        original_title: formData.original_title || null,
        description: formData.description || null,
        notes: formData.notes || null,
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
      setIsSubmitting(false)
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
    setIsUploadingCover(true)
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
      setIsUploadingCover(false)
      setPreviewUrl(null)
    }
  }

  const isEditing = Boolean(series)
  const isBusy = isSubmitting || isUploadingCover

  const firstVolume = useMemo(() => {
    const volumes = series?.volumes ?? []
    if (volumes.length === 0) return null
    return volumes.reduce((lowest, volume) => {
      if (!lowest) return volume
      return volume.volume_number < lowest.volume_number ? volume : lowest
    }, volumes[0])
  }, [series?.volumes])

  const firstVolumeCoverUrl = firstVolume?.cover_image_url?.trim() ?? ""

  const handleUseFirstVolumeCover = () => {
    if (!firstVolume) {
      toast.error("No volumes found for this series yet.")
      return
    }
    if (!firstVolumeCoverUrl) {
      toast.error("The first volume doesn't have a cover image yet.")
      return
    }
    setCoverPreviewError(false)
    setPreviewUrl(null)
    setFormData((prev) => ({ ...prev, cover_image_url: firstVolumeCoverUrl }))
    toast.success(`Updated cover from volume ${firstVolume.volume_number}.`)
  }

  const coverUrl = coverPreviewError
    ? ""
    : coverPreviewUrl || resolveImageUrl(formData.cover_image_url)
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl p-0 sm:max-w-3xl">
        <DialogHeader className="bg-warm/30 rounded-t-2xl border-b px-6 pt-6 pb-4">
          <DialogTitle className="font-display">
            {isEditing ? "Edit Series" : "Add Series"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update series details."
              : "Create a new series for your collection."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pt-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-6">
              <fieldset className="glass-card space-y-4 rounded-2xl p-4">
                <legend className="text-muted-foreground px-1 text-xs tracking-widest uppercase">
                  Basics
                </legend>
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
              </fieldset>

              <fieldset className="glass-card space-y-4 rounded-2xl p-4">
                <legend className="text-muted-foreground px-1 text-xs tracking-widest uppercase">
                  Credits
                </legend>
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
              </fieldset>

              <fieldset className="glass-card space-y-4 rounded-2xl p-4">
                <legend className="text-muted-foreground px-1 text-xs tracking-widest uppercase">
                  Publication
                </legend>
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
              </fieldset>
            </div>

            <fieldset className="glass-card space-y-4 self-start rounded-2xl p-4">
              <legend className="text-muted-foreground px-1 text-xs tracking-widest uppercase">
                Cover Art
              </legend>

              {coverUrl && !coverPreviewError && (
                <div className="flex justify-center">
                  <div className="bg-muted relative aspect-2/3 w-40 overflow-hidden rounded-xl shadow-md">
                    <img
                      src={coverUrl}
                      alt="Cover preview"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => {
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
              {!coverUrl && !coverPreviewError && (
                <div className="flex justify-center">
                  <div className="bg-muted/60 border-border/40 flex aspect-2/3 w-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground/60 h-8 w-8"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    <span className="text-muted-foreground/60 text-[10px]">
                      No cover
                    </span>
                  </div>
                </div>
              )}

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

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl"
                  onClick={handleUseFirstVolumeCover}
                  disabled={!firstVolumeCoverUrl || isBusy}
                  title={
                    firstVolumeCoverUrl
                      ? "Use the earliest cataloged volume cover"
                      : "Add a volume cover to enable this"
                  }
                >
                  {firstVolume
                    ? `Use Vol. ${firstVolume.volume_number} Cover`
                    : "Use First Volume Cover"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl"
                  onClick={handleOpenCoverSearch}
                  disabled={!coverSearchUrl}
                  title={
                    coverSearchUrl
                      ? "Search Google Images for cover art"
                      : "Add a title to enable image search"
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1.5 h-4 w-4"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  Google Images
                </Button>
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
                      if (file.size > MAX_COVER_SIZE_BYTES) {
                        toast.error("Cover images must be 5MB or smaller.")
                      } else {
                        void handleCoverFileChange(file)
                      }
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
                  {isUploadingCover && (
                    <span className="text-muted-foreground text-xs">
                      Uploading...
                    </span>
                  )}
                </div>
              </div>
            </fieldset>
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

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Personal notes or reminders"
              rows={3}
            />
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
              disabled={isBusy}
            >
              {isSubmitting && "Saving..."}
              {!isSubmitting && isEditing && "Save Changes"}
              {!isSubmitting && !isEditing && "Add Series"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
