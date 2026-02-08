"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
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
import { uploadImage } from "@/lib/uploads/upload-image"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"
import { useLibraryStore } from "@/lib/store/library-store"
import type {
  SeriesWithVolumes,
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
  readonly seriesOptions?: SeriesWithVolumes[]
  readonly selectedSeriesId?: string | null
  readonly onSeriesChange?: (seriesId: string | null) => void
  readonly onCreateSeries?: () => void
  readonly allowNoSeries?: boolean
  readonly onSubmit: (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => Promise<void>
}

const defaultFormData = {
  volume_number: 1,
  title: "",
  description: "",
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

const isValidOwnershipStatus = (
  status: string | null | undefined
): status is OwnershipStatus => status === "owned" || status === "wishlist"

const isValidReadingStatus = (
  status: string | null | undefined
): status is ReadingStatus =>
  status === "unread" ||
  status === "reading" ||
  status === "completed" ||
  status === "on_hold" ||
  status === "dropped"

const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024

export function VolumeDialog({
  open,
  onOpenChange,
  volume,
  nextVolumeNumber,
  seriesOptions,
  selectedSeriesId,
  onSeriesChange,
  onCreateSeries,
  allowNoSeries = false,
  onSubmit
}: VolumeDialogProps) {
  const isEditing = !!volume
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isFetchingPrice, setIsFetchingPrice] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [coverPreviewError, setCoverPreviewError] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const priceAbortRef = useRef<AbortController | null>(null)
  const [formData, setFormData] = useState(defaultFormData)
  const priceSource = useLibraryStore((state) => state.priceSource)
  const amazonDomain = useLibraryStore((state) => state.amazonDomain)

  const showSeriesSelect = !!seriesOptions
  const seriesValue = selectedSeriesId ?? (allowNoSeries ? "unassigned" : "")
  const buildSeriesLabel = (series: SeriesWithVolumes) =>
    series.author ? `${series.title} • ${series.author}` : series.title
  const selectedSeriesOption =
    seriesOptions?.find((series) => series.id === selectedSeriesId) ?? null
  const selectedSeriesLabel = selectedSeriesOption
    ? buildSeriesLabel(selectedSeriesOption)
    : null
  const showUnknownSeries = Boolean(selectedSeriesId && !selectedSeriesOption)

  useEffect(() => {
    if (!open) return
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setCoverPreviewUrl(null)
    setCoverPreviewError(false)
    if (volume) {
      const ownershipStatus = isValidOwnershipStatus(volume.ownership_status)
        ? volume.ownership_status
        : "owned"
      const readingStatus = isValidReadingStatus(volume.reading_status)
        ? volume.reading_status
        : "unread"
      setFormData({
        volume_number: volume.volume_number,
        title: volume.title || "",
        description: volume.description || "",
        isbn: volume.isbn || "",
        cover_image_url: volume.cover_image_url || "",
        ownership_status: ownershipStatus,
        reading_status: readingStatus,
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
  }, [open, volume, nextVolumeNumber])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (uploadAbortRef.current) {
        uploadAbortRef.current.abort()
        uploadAbortRef.current = null
      }
      if (priceAbortRef.current) {
        priceAbortRef.current.abort()
        priceAbortRef.current = null
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

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
      await onSubmit({
        volume_number: formData.volume_number,
        title: formData.title || null,
        description: formData.description || null,
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

  const handleCoverFileChange = async (file: File) => {
    if (!file) return
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort()
    }
    const controller = new AbortController()
    uploadAbortRef.current = controller
    if (isMountedRef.current) {
      setIsUploadingCover(true)
      setCoverPreviewError(false)
    }
    const previewUrl = URL.createObjectURL(file)
    if (isMountedRef.current) {
      setPreviewUrl(previewUrl)
    }

    try {
      const replacePath = extractStoragePath(formData.cover_image_url)
      const url = await uploadImage(file, "volume-cover", {
        replacePath: replacePath ?? undefined,
        signal: controller.signal
      })
      if (isMountedRef.current) {
        setFormData((prev) => ({ ...prev, cover_image_url: url }))
        toast.success("Cover image uploaded")
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : "Upload failed"
      if (isMountedRef.current) {
        toast.error(message)
      }
    } finally {
      if (uploadAbortRef.current === controller) {
        if (isMountedRef.current) {
          setIsUploadingCover(false)
          setPreviewUrl(null)
        }
        uploadAbortRef.current = null
      }
    }
  }

  const getFormatHint = () => {
    if (selectedSeriesOption?.type === "light_novel") return "Light Novel"
    if (selectedSeriesOption?.type === "manga") return "Manga"
    return ""
  }

  const buildPriceParams = () => {
    const seriesTitle = selectedSeriesOption?.title?.trim() ?? ""
    const volumeTitle = formData.title.trim()
    const queryTitle = seriesTitle || volumeTitle
    if (!queryTitle) {
      return {
        error: "Add a series title or volume title before fetching price."
      }
    }

    const params = new URLSearchParams()
    params.set("title", queryTitle)
    params.set("volume", String(formData.volume_number))
    const formatHint = getFormatHint()
    if (formatHint) params.set("format", formatHint)
    params.set("binding", "Paperback")
    return { params }
  }

  const parsePriceFromResult = (result?: {
    priceText?: string
    priceValue?: number
  }) => {
    const priceValue = result?.priceValue
    if (typeof priceValue === "number" && Number.isFinite(priceValue)) {
      return priceValue.toString()
    }
    const priceText = result?.priceText ?? ""
    const match = /\d+(?:\.\d+)?/.exec(priceText)
    return match ? match[0] : ""
  }

  const handleFetchAmazonPrice = async () => {
    if (priceSource !== "amazon") {
      toast.error("This price source is not supported yet.")
      return
    }
    const buildResult = buildPriceParams()
    if ("error" in buildResult) {
      toast.error(buildResult.error)
      return
    }

    if (priceAbortRef.current) {
      priceAbortRef.current.abort()
    }

    const controller = new AbortController()
    priceAbortRef.current = controller
    setIsFetchingPrice(true)

    try {
      buildResult.params.set("domain", amazonDomain)
      const response = await fetch(`/api/books/price?${buildResult.params}`, {
        signal: controller.signal
      })
      const data = (await response.json()) as {
        result?: { priceText?: string; priceValue?: number }
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Price lookup failed")
      }

      const parsedPrice = parsePriceFromResult(data.result)

      if (!parsedPrice) {
        throw new Error("Price not found")
      }

      updateField("purchase_price", parsedPrice)
      toast.success(`Price found: ${data.result?.priceText || parsedPrice}`)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      const message =
        error instanceof Error ? error.message : "Price lookup failed"
      toast.error(message)
    } finally {
      if (isMountedRef.current) {
        if (priceAbortRef.current === controller) {
          priceAbortRef.current = null
        }
        setIsFetchingPrice(false)
      }
    }
  }

  const getButtonLabel = () => {
    if (isSubmitting) return "Saving..."
    if (isEditing) return "Update"
    return "Add"
  }

  const coverUrl = coverPreviewError
    ? ""
    : coverPreviewUrl || resolveImageUrl(formData.cover_image_url)
  const volumeTitle = formData.title.trim()
  const seriesTitle = selectedSeriesOption?.title?.trim() ?? ""
  const coverSearchBase = volumeTitle || seriesTitle
  const coverSearchQuery =
    coverSearchBase && !volumeTitle && formData.volume_number
      ? `${coverSearchBase} volume ${formData.volume_number}`
      : coverSearchBase
  const coverSearchUrl = coverSearchQuery
    ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(coverSearchQuery)}`
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
            {isEditing ? "Edit Volume" : "Add Volume"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update volume details"
              : "Add a new volume to this series"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pt-6">
          {showSeriesSelect && (
            <div className="glass-card rounded-2xl p-4">
              <div className="space-y-3">
                <Label htmlFor="series_id">Series</Label>
                <Select
                  value={seriesValue}
                  onValueChange={(value) => {
                    if (!onSeriesChange) return
                    if (value === "unassigned") {
                      onSeriesChange(null)
                      return
                    }
                    onSeriesChange(value)
                  }}
                >
                  <SelectTrigger id="series_id">
                    <SelectValue placeholder="Select a series" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowNoSeries && (
                      <SelectItem value="unassigned">
                        No series (unassigned)
                      </SelectItem>
                    )}
                    {showUnknownSeries && selectedSeriesId && (
                      <SelectItem value={selectedSeriesId}>
                        {selectedSeriesLabel ?? "Unknown series"}
                      </SelectItem>
                    )}
                    {seriesOptions?.map((series) => (
                      <SelectItem key={series.id} value={series.id}>
                        {buildSeriesLabel(series)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onCreateSeries && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0"
                    onClick={onCreateSeries}
                  >
                    Create new series
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-6">
              <div className="space-y-4">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Volume Info
                </span>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="title">Volume Title</Label>
                    <Input
                      id="title"
                      placeholder="Optional subtitle"
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                    />
                  </div>
                </div>

                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Identification
                </span>
                <div className="grid gap-4 md:grid-cols-2">
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
              </div>

              <div className="space-y-4">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Status
                </span>
                <div className="grid gap-4 md:grid-cols-2">
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
              </div>

              <div className="space-y-4">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Progress
                </span>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="current_page">Current Page</Label>
                    <Input
                      id="current_page"
                      type="number"
                      min={0}
                      value={formData.current_page}
                      onChange={(e) =>
                        updateField("current_page", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="page_count">Total Pages</Label>
                    <Input
                      id="page_count"
                      type="number"
                      min={0}
                      value={formData.page_count}
                      onChange={(e) =>
                        updateField("page_count", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                  Purchase
                </span>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="purchase_date">Purchase Date</Label>
                    <Input
                      id="purchase_date"
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) =>
                        updateField("purchase_date", e.target.value)
                      }
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
                      onChange={(e) =>
                        updateField("purchase_price", e.target.value)
                      }
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={handleFetchAmazonPrice}
                        disabled={
                          isFetchingPrice || isSubmitting || isUploadingCover
                        }
                      >
                        {isFetchingPrice
                          ? "Checking Amazon..."
                          : "Fetch Amazon price"}
                      </Button>
                      <span className="text-muted-foreground text-xs">
                        Uses the top Amazon search result (beta)
                      </span>
                    </div>
                  </div>
                </div>
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
                    type="url"
                    placeholder="https://..."
                    value={formData.cover_image_url}
                    onChange={(e) => {
                      setCoverPreviewError(false)
                      updateField("cover_image_url", e.target.value)
                    }}
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
                    Opens a new tab using the volume or series title.
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
                          updateField("cover_image_url", "")
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

                {coverUrl && !coverPreviewError && (
                  <div className="flex justify-center">
                    <div className="bg-muted relative aspect-2/3 w-40 overflow-hidden rounded-xl">
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
                <p className="text-muted-foreground text-xs">
                  Images are resized and compressed to WebP on upload.
                </p>
              </div>
            </aside>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Short summary or synopsis..."
              rows={4}
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
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
              disabled={isSubmitting || isUploadingCover}
            >
              {getButtonLabel()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
