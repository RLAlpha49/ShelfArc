"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from "@/components/ui/input-group"
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
import { CoverPreviewImage } from "@/components/library/cover-preview-image"
import { uploadImage } from "@/lib/uploads/upload-image"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"
import {
  DEFAULT_CURRENCY_CODE,
  useLibraryStore
} from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import { usePriceHistory } from "@/lib/hooks/use-price-history"
import { cn } from "@/lib/utils"
import type {
  SeriesWithVolumes,
  TitleType,
  Volume,
  VolumeInsert,
  OwnershipStatus,
  ReadingStatus
} from "@/lib/types/database"

/** Props for the {@link VolumeDialog} component. @source */
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

/** Default values for the volume form fields. @source */
const defaultFormData = {
  volume_number: 1,
  title: "",
  description: "",
  isbn: "",
  cover_image_url: "",
  ownership_status: "owned" as OwnershipStatus,
  reading_status: "unread" as ReadingStatus,
  page_count: "",
  rating: "",
  notes: "",
  publish_date: "",
  purchase_date: "",
  purchase_price: "",
  edition: "",
  format: "",
  amazon_url: ""
}

/**
 * Type guard for valid ownership status values.
 * @param status - Value to check.
 * @returns `true` if the status is a recognised {@link OwnershipStatus}.
 * @source
 */
const isValidOwnershipStatus = (
  status: string | null | undefined
): status is OwnershipStatus => status === "owned" || status === "wishlist"

/**
 * Type guard for valid reading status values.
 * @param status - Value to check.
 * @returns `true` if the status is a recognised {@link ReadingStatus}.
 * @source
 */
const isValidReadingStatus = (
  status: string | null | undefined
): status is ReadingStatus =>
  status === "unread" ||
  status === "reading" ||
  status === "completed" ||
  status === "on_hold" ||
  status === "dropped"

/** Maximum upload size for cover images (5 MB). @source */
const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024

/** Badge color mapping per series title type. @source */
const SERIES_TYPE_COLORS: Record<TitleType, string> = {
  light_novel: "bg-gold/10 text-gold",
  manga: "bg-copper/10 text-copper",
  other: "bg-muted text-muted-foreground"
}

/** Human-readable label per series title type. @source */
const SERIES_TYPE_LABELS: Record<TitleType, string> = {
  light_novel: "Light Novel",
  manga: "Manga",
  other: "Other"
}

/** Props for the internal {@link SeriesPicker} sub-dialog. @source */
interface SeriesPickerProps {
  readonly seriesOptions: SeriesWithVolumes[]
  readonly selectedSeriesOption: SeriesWithVolumes | null
  readonly selectedSeriesId?: string | null
  readonly onSeriesChange?: (seriesId: string | null) => void
  readonly onCreateSeries?: () => void
  readonly allowNoSeries?: boolean
}

/**
 * Inline series selector with a nested search dialog for reassigning a volume's series.
 * @param props - {@link SeriesPickerProps}
 * @source
 */
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
    <fieldset className="glass-card rounded-2xl p-4">
      <legend className="text-muted-foreground px-1 text-xs tracking-widest uppercase">
        Series
      </legend>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
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
              <div className="max-h-100 space-y-2 overflow-y-auto p-2">
                {allowNoSeries && (
                  <button
                    type="button"
                    onClick={() => handleSeriesSelection(null)}
                    disabled={seriesSelectionDisabled}
                    className={cn(
                      "group bg-card/70 hover:bg-accent/60 border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
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
                        "group bg-card/70 hover:bg-accent/60 border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
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
    </fieldset>
  )
}

/**
 * Dialog for creating or editing a volume with metadata fields, cover art management,
 * Amazon price/image fetching, and optional series picker.
 * @param props - {@link VolumeDialogProps}
 * @source
 */
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
  const [isFetchingImage, setIsFetchingImage] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [coverPreviewError, setCoverPreviewError] = useState(false)
  const [showAmazonWarning, setShowAmazonWarning] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const priceAbortRef = useRef<AbortController | null>(null)
  const [formData, setFormData] = useState(defaultFormData)
  const { persistPrice, fetchAlert: fetchPriceAlert } = usePriceHistory(
    volume?.id ?? ""
  )
  const priceSource = useLibraryStore((state) => state.priceSource)
  const amazonDomain = useLibraryStore((state) => state.amazonDomain)
  const amazonPreferKindle = useLibraryStore(
    (state) => state.amazonPreferKindle
  )
  const amazonFallbackToKindle = useLibraryStore(
    (state) => state.amazonFallbackToKindle
  )
  const priceDisplayCurrency = useLibraryStore(
    (state) => state.priceDisplayCurrency
  )
  const showAmazonDisclaimer = useLibraryStore(
    (state) => state.showAmazonDisclaimer
  )
  const setShowAmazonDisclaimer = useLibraryStore(
    (state) => state.setShowAmazonDisclaimer
  )
  const autoPurchaseDate = useSettingsStore((state) => state.autoPurchaseDate)

  const priceCurrencySymbol = useMemo(() => {
    const currency = priceDisplayCurrency ?? DEFAULT_CURRENCY_CODE
    try {
      const parts = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol"
      }).formatToParts(0)
      return parts.find((part) => part.type === "currency")?.value ?? currency
    } catch {
      return currency
    }
  }, [priceDisplayCurrency])

  const showSeriesSelect = !!seriesOptions
  const selectedSeriesOption =
    seriesOptions?.find((series) => series.id === selectedSeriesId) ?? null

  const isBusy =
    isSubmitting || isUploadingCover || isFetchingPrice || isFetchingImage
  const isSubmitDisabled = isSubmitting || isUploadingCover

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key !== "Enter" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isSubmitDisabled
      ) {
        return
      }

      const activeElement = globalThis.document
        ?.activeElement as HTMLElement | null
      const target = activeElement ?? (event.target as HTMLElement | null)
      const form = formRef.current

      if (!form) return
      if (!target) {
        event.preventDefault()
        form.requestSubmit()
        return
      }
      if (target instanceof HTMLTextAreaElement) return
      if (target instanceof HTMLInputElement && target.type === "file") return
      if (target.isContentEditable) return
      if (target.closest("[role='combobox']")) return
      if (target.closest("[aria-haspopup='listbox']")) return
      if (target.dataset.preventEnterSubmit === "true") return
      if (target.closest("[data-prevent-enter-submit='true']")) return

      event.preventDefault()
      form.requestSubmit()
    }

    globalThis.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown, {
        capture: true
      })
    }
  }, [open, isSubmitDisabled])

  useEffect(() => {
    if (!open) {
      if (uploadAbortRef.current) {
        uploadAbortRef.current.abort()
        uploadAbortRef.current = null
      }
      if (priceAbortRef.current) {
        priceAbortRef.current.abort()
        priceAbortRef.current = null
      }
      setIsSubmitting(false)
      setIsUploadingCover(false)
      setIsFetchingPrice(false)
      setIsFetchingImage(false)
      setShowAmazonWarning(false)
      return
    }
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
        page_count: volume.page_count?.toString() || "",
        rating: volume.rating?.toString() || "",
        notes: volume.notes || "",
        publish_date: volume.publish_date || "",
        purchase_date: volume.purchase_date || "",
        purchase_price: volume.purchase_price?.toString() || "",
        edition: volume.edition || "",
        format: volume.format || "",
        amazon_url: volume.amazon_url || ""
      })
    } else {
      setFormData({
        ...defaultFormData,
        volume_number: nextVolumeNumber,
        format: (() => {
          if (selectedSeriesOption?.type === "light_novel") return "Light Novel"
          if (selectedSeriesOption?.type === "manga") return "Manga"
          return ""
        })()
      })
    }
  }, [open, volume, nextVolumeNumber, selectedSeriesOption?.type])

  useEffect(() => {
    isMountedRef.current = true
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

  useEffect(() => {
    if (open && volume?.id) {
      fetchPriceAlert()
    }
  }, [open, volume?.id, fetchPriceAlert])

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
    const pageCount = formData.page_count
      ? Number.parseInt(formData.page_count)
      : null
    try {
      await onSubmit({
        volume_number: formData.volume_number,
        title: formData.title || null,
        description: formData.description || null,
        isbn: formData.isbn || null,
        cover_image_url: formData.cover_image_url || null,
        ownership_status: formData.ownership_status,
        reading_status: formData.reading_status,
        page_count: pageCount,
        ...(formData.reading_status === "completed" &&
        pageCount &&
        pageCount > 0
          ? { current_page: pageCount }
          : {}),
        rating: formData.rating ? Number.parseInt(formData.rating) : null,
        notes: formData.notes || null,
        publish_date: formData.publish_date || null,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price
          ? Number.parseFloat(formData.purchase_price)
          : null,
        edition: formData.edition || null,
        format: formData.format || null,
        amazon_url: formData.amazon_url || null
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
        error: "Add a series title or volume title before fetching from Amazon."
      }
    }

    const params = new URLSearchParams()
    params.set("title", queryTitle)
    params.set("volume", String(formData.volume_number))
    const formatHint = getFormatHint()
    if (formatHint) params.set("format", formatHint)
    const bindingLabel = amazonPreferKindle ? "Kindle" : "Paperback"
    params.set("binding", bindingLabel)
    if (seriesTitle && volumeTitle) {
      params.set("volumeTitle", volumeTitle)
    }
    return { params }
  }

  const getAmazonSearchUrl = () => {
    const buildResult = buildPriceParams()
    if ("error" in buildResult) return ""
    const title = buildResult.params.get("title") || ""
    const volume = buildResult.params.get("volume")
    const format = buildResult.params.get("format")
    const binding = buildResult.params.get("binding")
    const searchTokens = [
      title,
      volume ? `Volume ${volume}` : null,
      format,
      binding
    ].filter(Boolean)
    const searchQuery = searchTokens.join(" ")
    if (!searchQuery) return ""
    return `https://www.${amazonDomain}/s?k=${encodeURIComponent(searchQuery)}`
  }

  const handleOpenAmazonPage = () => {
    const url = formData.amazon_url || getAmazonSearchUrl()
    if (!url) return
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const parsePriceFromResult = (result?: {
    priceText?: string
    priceValue?: number
    priceError?: string | null
  }) => {
    if (result?.priceError) return ""
    const priceValue = result?.priceValue
    if (typeof priceValue === "number" && Number.isFinite(priceValue)) {
      return priceValue.toString()
    }
    const priceText = result?.priceText ?? ""
    const match = /\d+(?:\.\d+)?/.exec(priceText)
    return match ? match[0] : ""
  }

  /** Apply price result from Amazon response. */
  const applyPriceResult = (result?: {
    priceText?: string
    priceValue?: number
    priceError?: string | null
    priceBinding?: string | null
  }) => {
    if (result?.priceError) {
      toast.warning(result.priceError)
      return
    }
    const parsedPrice = parsePriceFromResult(result)
    if (parsedPrice) {
      updateField("purchase_price", parsedPrice)
      const bindingNote = result?.priceBinding
        ? ` (${result.priceBinding})`
        : ""
      toast.success(
        `Price found${bindingNote}: ${result?.priceText || parsedPrice}`
      )
    } else {
      toast.warning("Price not found in the Amazon result.")
    }
  }

  /** Apply image result from Amazon response. */
  const applyImageResult = (imageUrl?: string | null) => {
    if (imageUrl) {
      updateField("cover_image_url", imageUrl)
      setCoverPreviewError(false)
      toast.success("Cover image fetched from Amazon")
    } else {
      toast.warning("Image not found in the Amazon result.")
    }
  }

  /** Build the full URL and validate pre-conditions. Returns null on failure. */
  const prepareAmazonFetch = (options: {
    includePrice: boolean
    includeImage: boolean
  }) => {
    if (priceSource !== "amazon") {
      toast.error("This price source is not supported yet.")
      return null
    }

    const buildResult = buildPriceParams()
    if ("error" in buildResult) {
      toast.error(buildResult.error)
      return null
    }

    buildResult.params.set("domain", amazonDomain)
    if (options.includeImage) buildResult.params.set("includeImage", "true")
    if (!options.includePrice) buildResult.params.set("includePrice", "false")
    if (options.includePrice && !amazonPreferKindle && amazonFallbackToKindle) {
      buildResult.params.set("fallbackToKindle", "true")
    }

    return `/api/books/price?${buildResult.params}`
  }

  const handleAmazonError = (error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") return
    const message =
      error instanceof Error ? error.message : "Amazon lookup failed"
    toast.error(message)
  }

  const cleanupAmazonFetch = (controller: AbortController) => {
    if (!isMountedRef.current) return
    if (priceAbortRef.current === controller) priceAbortRef.current = null
    setIsFetchingPrice(false)
    setIsFetchingImage(false)
  }

  /** Core Amazon fetch — returns both price and image when requested. */
  const fetchFromAmazon = useCallback(
    async (options: { includePrice: boolean; includeImage: boolean }) => {
      const url = prepareAmazonFetch(options)
      if (!url) return

      if (priceAbortRef.current) priceAbortRef.current.abort()
      const controller = new AbortController()
      priceAbortRef.current = controller

      if (options.includePrice) setIsFetchingPrice(true)
      if (options.includeImage) setIsFetchingImage(true)

      try {
        const response = await fetch(url, { signal: controller.signal })
        const data = (await response.json()) as {
          result?: {
            priceText?: string
            priceValue?: number
            priceError?: string | null
            priceBinding?: string | null
            imageUrl?: string | null
            url?: string | null
          }
          error?: string
        }

        if (!response.ok) throw new Error(data.error ?? "Amazon lookup failed")

        if (options.includePrice) applyPriceResult(data.result)
        if (options.includeImage) applyImageResult(data.result?.imageUrl)
        if (data.result?.url) updateField("amazon_url", data.result.url)

        if (
          options.includePrice &&
          volume?.id &&
          data.result?.priceValue != null
        ) {
          try {
            const currency = priceDisplayCurrency ?? DEFAULT_CURRENCY_CODE
            const { alertTriggered } = await persistPrice(
              data.result.priceValue,
              currency,
              "amazon"
            )
            if (alertTriggered) {
              toast.info(
                `Price alert triggered! Price dropped to $${data.result.priceValue.toFixed(2)}`
              )
            }
          } catch {
            // Price history save is non-critical
          }
        }
      } catch (error) {
        handleAmazonError(error)
      } finally {
        cleanupAmazonFetch(controller)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      priceSource,
      amazonDomain,
      amazonPreferKindle,
      amazonFallbackToKindle,
      selectedSeriesOption,
      formData.title,
      formData.volume_number
    ]
  )

  const handleFetchAmazonPrice = () => {
    setShowAmazonWarning(true)
    void fetchFromAmazon({ includePrice: true, includeImage: false })
  }

  const handleFetchAmazonImageOnly = () => {
    setShowAmazonWarning(true)
    void fetchFromAmazon({ includePrice: false, includeImage: true })
  }

  const handleFetchAmazonImage = () => {
    setShowAmazonWarning(true)
    // Fetching image also fetches the price to avoid a duplicate request
    void fetchFromAmazon({ includePrice: true, includeImage: true })
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
        <DialogHeader className="relative overflow-hidden rounded-t-2xl border-b px-6 pt-7 pb-5">
          <div className="bg-warm/40 pointer-events-none absolute inset-0" />
          <div className="from-warm-glow/60 via-warm-glow/20 pointer-events-none absolute inset-0 bg-linear-to-br to-transparent" />
          <div className="relative">
            <DialogTitle className="font-display text-lg tracking-tight">
              {isEditing ? "Edit Volume" : "Add Volume"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80 mt-1 text-[13px]">
              {isEditing
                ? "Update volume details"
                : "Add a new volume to this series"}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="divide-border/60 divide-y"
        >
          {showSeriesSelect && seriesOptions && (
            <div className="px-6 py-5">
              <SeriesPicker
                seriesOptions={seriesOptions}
                selectedSeriesOption={selectedSeriesOption}
                selectedSeriesId={selectedSeriesId}
                onSeriesChange={onSeriesChange}
                onCreateSeries={onCreateSeries}
                allowNoSeries={allowNoSeries}
              />
            </div>
          )}

          {/* ── Cover + Volume Details ── */}
          <div className="grid gap-x-6 gap-y-5 px-6 py-6 sm:grid-cols-[200px_minmax(0,1fr)]">
            {/* Cover Art */}
            <div className="flex flex-col items-center gap-3 sm:items-start">
              {coverUrl && !coverPreviewError && (
                <CoverPreviewImage
                  key={coverUrl}
                  src={coverUrl}
                  alt="Cover preview"
                  wrapperClassName="w-full max-w-[200px]"
                  onError={() => {
                    setCoverPreviewError(true)
                    setPreviewUrl(null)
                  }}
                />
              )}
              {coverPreviewError && (
                <div className="bg-muted text-muted-foreground flex aspect-2/3 w-full max-w-50 items-center justify-center rounded-xl text-xs">
                  Preview unavailable
                </div>
              )}
              {!coverUrl && !coverPreviewError && (
                <div className="bg-muted/60 border-border/40 flex aspect-2/3 w-full max-w-50 flex-col items-center justify-center gap-2 rounded-xl border border-dashed">
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
              )}

              {/* Cover controls */}
              <div className="w-full max-w-50 space-y-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="cover_image_url" className="text-[11px]">
                    Cover URL
                  </Label>
                  <Input
                    id="cover_image_url"
                    type="url"
                    placeholder="https://..."
                    value={formData.cover_image_url}
                    onChange={(e) => {
                      setCoverPreviewError(false)
                      updateField("cover_image_url", e.target.value)
                    }}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cover_image_upload" className="text-[11px]">
                    Upload Cover
                  </Label>
                  <Input
                    id="cover_image_upload"
                    type="file"
                    accept="image/*"
                    className="h-8 text-xs"
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
                </div>

                <div className="flex items-center gap-2">
                  {formData.cover_image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
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

                <div>
                  <p className="text-muted-foreground mb-2.5 text-[11px] font-medium tracking-widest uppercase">
                    Cover tools
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-lg"
                        onClick={handleFetchAmazonImage}
                        disabled={isBusy}
                      >
                        {isFetchingImage && isFetchingPrice ? (
                          <>
                            <svg
                              className="mr-1.5 h-3.5 w-3.5 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                              />
                            </svg>
                            Fetching...
                          </>
                        ) : (
                          "Fetch Amazon Image & Price"
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-lg"
                        onClick={handleFetchAmazonImageOnly}
                        disabled={isBusy}
                      >
                        {isFetchingImage && !isFetchingPrice ? (
                          <>
                            <svg
                              className="mr-1.5 h-3.5 w-3.5 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                              />
                            </svg>
                            Fetching...
                          </>
                        ) : (
                          "Fetch Amazon Image Only"
                        )}
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full rounded-lg"
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
                  </div>
                </div>
              </div>
            </div>

            {/* Volume Details */}
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="volume_number">Volume Number *</Label>
                  <Input
                    id="volume_number"
                    type="number"
                    min={0}
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
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Volume Title</Label>
                  <Input
                    id="title"
                    placeholder="Optional subtitle"
                    value={formData.title}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
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

              <div>
                <p className="text-muted-foreground mb-2.5 text-[11px] font-medium tracking-widest uppercase">
                  Status
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ownership_status">Ownership Status</Label>
                    <Select
                      value={formData.ownership_status}
                      onValueChange={(value) => {
                        if (value) {
                          const updates: Partial<typeof formData> = {
                            ownership_status: value as OwnershipStatus
                          }
                          if (
                            autoPurchaseDate &&
                            value === "owned" &&
                            formData.ownership_status !== "owned" &&
                            !formData.purchase_date
                          ) {
                            updates.purchase_date = new Date()
                              .toISOString()
                              .split("T")[0]
                          }
                          setFormData((prev) => ({ ...prev, ...updates }))
                        }
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

              <div>
                <p className="text-muted-foreground mb-2.5 text-[11px] font-medium tracking-widest uppercase">
                  Publication
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="publish_date">Publish Date</Label>
                    <Input
                      id="publish_date"
                      type="date"
                      value={formData.publish_date}
                      onChange={(e) =>
                        updateField("publish_date", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edition">Edition</Label>
                    <Input
                      id="edition"
                      placeholder="e.g. 1st, Deluxe"
                      value={formData.edition}
                      onChange={(e) => updateField("edition", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="format">Format</Label>
                    <Input
                      id="format"
                      placeholder="e.g. Paperback, Hardcover"
                      value={formData.format}
                      onChange={(e) => updateField("format", e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
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

              <div>
                <div className="mb-2.5 flex items-end justify-between gap-3">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                    Purchase
                  </p>
                  <span className="text-muted-foreground text-xs">
                    {priceDisplayCurrency} · {priceCurrencySymbol}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <InputGroupText>{priceCurrencySymbol}</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
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
                    </InputGroup>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={handleFetchAmazonPrice}
                    disabled={isBusy}
                  >
                    {isFetchingPrice && !isFetchingImage ? (
                      <>
                        <svg
                          className="mr-1.5 h-3.5 w-3.5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Checking...
                      </>
                    ) : (
                      "Fetch Amazon Price"
                    )}
                  </Button>
                  <span className="text-muted-foreground text-[11px]">
                    Price only
                  </span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 rounded-xl"
                  onClick={handleOpenAmazonPage}
                  disabled={!formData.amazon_url && !getAmazonSearchUrl()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1.5 h-3.5 w-3.5"
                  >
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  </svg>
                  {formData.amazon_url ? "Open on Amazon" : "Search on Amazon"}
                </Button>
              </div>
            </div>
          </div>

          {/* Amazon warning callout — shown after any Amazon fetch */}
          {showAmazonWarning && showAmazonDisclaimer && (
            <div className="px-6 py-5">
              <div className="border-gold/30 bg-gold/5 rounded-xl border px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gold mt-0.5 h-4 w-4 shrink-0"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                  <div className="space-y-1.5">
                    <p className="text-foreground text-xs font-semibold">
                      Amazon Data Disclaimer
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      The cover image from Amazon is usually{" "}
                      <strong>much higher quality</strong> than other sources,
                      however it could be incorrect if the top search result
                      doesn&apos;t match. The price is generally reliable — if
                      the wrong product is matched, the lookup usually fails
                      outright rather than returning incorrect data.
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Amazon may use anti-scraping measures that temporarily
                      prevent fetching. If requests fail repeatedly, the feature
                      will automatically pause and retry later. You can wait and
                      try again.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                          setShowAmazonDisclaimer(false)
                          setShowAmazonWarning(false)
                        }}
                      >
                        Don&apos;t show again
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Description & Notes ── */}
          <div className="space-y-5 px-6 py-5">
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
          </div>

          {/* ── Footer ── */}
          <DialogFooter className="bg-muted/30 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              data-prevent-enter-submit="true"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
              disabled={isSubmitDisabled}
            >
              {getButtonLabel()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
