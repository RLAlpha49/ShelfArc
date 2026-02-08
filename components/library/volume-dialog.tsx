"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
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
import { CoverImage } from "@/components/library/cover-image"
import { uploadImage } from "@/lib/uploads/upload-image"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"
import { useLibraryStore } from "@/lib/store/library-store"
import { cn } from "@/lib/utils"
import type {
  SeriesWithVolumes,
  TitleType,
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

const SERIES_TYPE_COLORS: Record<TitleType, string> = {
  light_novel: "bg-gold/10 text-gold",
  manga: "bg-copper/10 text-copper",
  other: "bg-muted text-muted-foreground"
}

const SERIES_TYPE_LABELS: Record<TitleType, string> = {
  light_novel: "Light Novel",
  manga: "Manga",
  other: "Other"
}

interface SeriesPickerProps {
  readonly seriesOptions: SeriesWithVolumes[]
  readonly selectedSeriesOption: SeriesWithVolumes | null
  readonly selectedSeriesId?: string | null
  readonly onSeriesChange?: (seriesId: string | null) => void
  readonly onCreateSeries?: () => void
  readonly allowNoSeries?: boolean
}

function SeriesPicker({
  seriesOptions,
  selectedSeriesOption,
  selectedSeriesId,
  onSeriesChange,
  onCreateSeries,
  allowNoSeries = false
}: SeriesPickerProps) {
  const [seriesQuery, setSeriesQuery] = useState("")
  const [isSeriesPickerOpen, setIsSeriesPickerOpen] = useState(false)
  const seriesSelectionDisabled = !onSeriesChange
  const showUnknownSeries = Boolean(selectedSeriesId && !selectedSeriesOption)
  const normalizedSeriesQuery = seriesQuery.trim().toLowerCase()

  const filteredSeriesOptions = useMemo(() => {
    if (!normalizedSeriesQuery) return seriesOptions
    return seriesOptions.filter((series) => {
      const tags = series.tags?.join(" ") ?? ""
      const haystack = `${series.title} ${series.author ?? ""} ${tags}`
        .trim()
        .toLowerCase()
      return haystack.includes(normalizedSeriesQuery)
    })
  }, [seriesOptions, normalizedSeriesQuery])

  const handleSeriesSelection = (seriesId: string | null) => {
    if (!onSeriesChange) return
    onSeriesChange(seriesId)
    setIsSeriesPickerOpen(false)
  }

  const summary = (() => {
    if (selectedSeriesOption) {
      return {
        title: selectedSeriesOption.title,
        subtitle: selectedSeriesOption.author ?? "",
        badge: (
          <Badge
            variant="secondary"
            className={`rounded-lg text-[10px] ${SERIES_TYPE_COLORS[selectedSeriesOption.type] ?? SERIES_TYPE_COLORS.other}`}
          >
            {SERIES_TYPE_LABELS[selectedSeriesOption.type] ?? "Other"}
          </Badge>
        ),
        meta: `${(
          selectedSeriesOption.total_volumes ||
          selectedSeriesOption.volumes.length ||
          0
        ).toString()} vols`
      }
    }
    if (showUnknownSeries && selectedSeriesId) {
      return {
        title: "Unknown series",
        subtitle: `ID: ${selectedSeriesId}`,
        badge: null,
        meta: ""
      }
    }
    if (allowNoSeries && selectedSeriesId === null) {
      return {
        title: "No series",
        subtitle: "This volume is unassigned.",
        badge: null,
        meta: ""
      }
    }
    return {
      title: "Select a series",
      subtitle: "Choose where this volume belongs.",
      badge: null,
      meta: ""
    }
  })()

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="series_picker">Series</Label>
          <p className="text-muted-foreground text-xs">
            Choose the series this volume belongs to.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {seriesOptions.length} series
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => setIsSeriesPickerOpen(true)}
            disabled={seriesSelectionDisabled}
          >
            {selectedSeriesOption || selectedSeriesId === null
              ? "Change"
              : "Select"}
          </Button>
        </div>
      </div>

      <div className="bg-card/60 border-border/60 mt-3 flex items-center gap-3 rounded-xl border p-3">
        <div className="bg-muted relative aspect-2/3 w-10 overflow-hidden rounded-lg">
          {selectedSeriesOption ? (
            <CoverImage
              isbn={
                selectedSeriesOption.volumes.find((volume) => volume.isbn)?.isbn
              }
              coverImageUrl={selectedSeriesOption.cover_image_url}
              alt={selectedSeriesOption.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              fallback={
                <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
                  <span className="text-muted-foreground text-[9px] tracking-[0.3em] uppercase">
                    Series
                  </span>
                </div>
              }
            />
          ) : (
            <div className="from-muted/60 to-muted flex h-full items-center justify-center bg-linear-to-br">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground h-4 w-4"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                <path d="M8 7h8" />
                <path d="M8 11h6" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display line-clamp-1 text-xs font-semibold">
              {summary.title}
            </p>
            {summary.badge}
          </div>
          {summary.subtitle && (
            <p className="text-muted-foreground line-clamp-1 text-[11px]">
              {summary.subtitle}
            </p>
          )}
          {summary.meta && (
            <p className="text-muted-foreground mt-1 text-[10px]">
              {summary.meta}
            </p>
          )}
        </div>
      </div>

      <Dialog
        open={isSeriesPickerOpen}
        onOpenChange={(nextOpen) => {
          setIsSeriesPickerOpen(nextOpen)
          if (!nextOpen) setSeriesQuery("")
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="bg-warm/30 rounded-t-2xl border-b px-5 pt-5 pb-3">
            <DialogTitle className="font-display">Select series</DialogTitle>
            <DialogDescription>
              Search and pick a series for this volume.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 pt-4 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Input
                id="series_picker"
                type="search"
                placeholder="Search by title, author, or tag"
                value={seriesQuery}
                onChange={(event) => setSeriesQuery(event.target.value)}
                className="sm:max-w-sm"
              />
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span>{filteredSeriesOptions.length} shown</span>
                {seriesQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    onClick={() => setSeriesQuery("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-muted/20 border-border/60 rounded-xl border p-2">
              <div className="no-scrollbar max-h-80 space-y-2 overflow-y-auto">
                {allowNoSeries && (
                  <button
                    type="button"
                    onClick={() => handleSeriesSelection(null)}
                    disabled={seriesSelectionDisabled}
                    className={cn(
                      "group bg-card/70 hover:bg-accent/40 border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                      selectedSeriesId === null && "ring-primary/40 ring-2",
                      seriesSelectionDisabled && "cursor-not-allowed opacity-60"
                    )}
                    aria-pressed={selectedSeriesId === null}
                  >
                    <div className="from-muted/60 to-muted flex h-10 w-8 items-center justify-center rounded-lg bg-linear-to-br">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground h-4 w-4"
                      >
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        <path d="M8 7h8" />
                        <path d="M8 11h6" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xs font-semibold">
                        No series
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Keep this volume unassigned
                      </p>
                    </div>
                  </button>
                )}

                {filteredSeriesOptions.map((series) => {
                  const selected = series.id === selectedSeriesId
                  const totalVolumes =
                    series.total_volumes || series.volumes.length || 0
                  const primaryIsbn = series.volumes.find(
                    (volume) => volume.isbn
                  )?.isbn
                  return (
                    <button
                      key={series.id}
                      type="button"
                      onClick={() => handleSeriesSelection(series.id)}
                      disabled={seriesSelectionDisabled}
                      className={cn(
                        "group bg-card/70 hover:bg-accent/40 border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                        selected && "ring-primary/40 ring-2",
                        seriesSelectionDisabled &&
                          "cursor-not-allowed opacity-60"
                      )}
                      aria-pressed={selected}
                    >
                      <div className="bg-muted relative aspect-2/3 w-8 overflow-hidden rounded-lg">
                        <CoverImage
                          isbn={primaryIsbn}
                          coverImageUrl={series.cover_image_url}
                          alt={series.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          fallback={
                            <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
                              <span className="text-muted-foreground text-[8px] tracking-[0.3em] uppercase">
                                Series
                              </span>
                            </div>
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-display line-clamp-1 text-xs font-semibold">
                            {series.title}
                          </p>
                          {selected && (
                            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase">
                              Selected
                            </span>
                          )}
                        </div>
                        {series.author && (
                          <p className="text-muted-foreground line-clamp-1 text-[11px]">
                            {series.author}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge
                            variant="secondary"
                            className={`rounded-lg text-[10px] ${SERIES_TYPE_COLORS[series.type] ?? SERIES_TYPE_COLORS.other}`}
                          >
                            {SERIES_TYPE_LABELS[series.type] ?? "Other"}
                          </Badge>
                          <span className="text-muted-foreground text-[10px]">
                            {totalVolumes} vols
                          </span>
                          {(series.tags ?? []).slice(0, 1).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="border-primary/15 rounded-lg text-[10px]"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>
                  )
                })}

                {filteredSeriesOptions.length === 0 && !allowNoSeries && (
                  <div className="text-muted-foreground px-3 py-4 text-center text-xs">
                    No series match your search.
                  </div>
                )}
              </div>
            </div>

            {showUnknownSeries && selectedSeriesId && (
              <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs">
                <span className="font-medium">Unknown series</span>
                <span className="text-muted-foreground">
                  ID: {selectedSeriesId}
                </span>
              </div>
            )}

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
        </DialogContent>
      </Dialog>
    </div>
  )
}

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
  const selectedSeriesOption =
    seriesOptions?.find((series) => series.id === selectedSeriesId) ?? null

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
          {showSeriesSelect && seriesOptions && (
            <SeriesPicker
              seriesOptions={seriesOptions}
              selectedSeriesOption={selectedSeriesOption}
              selectedSeriesId={selectedSeriesId}
              onSeriesChange={onSeriesChange}
              onCreateSeries={onCreateSeries}
              allowNoSeries={allowNoSeries}
            />
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
