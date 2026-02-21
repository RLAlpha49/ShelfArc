"use client"

import { format } from "date-fns"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { CoverImage } from "@/components/library/cover-image"
import { IsbnScannerButton } from "@/components/library/isbn-scanner"
import { SeriesPicker } from "@/components/library/series-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { ResponsiveDialogRaw } from "@/components/ui/responsive-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { fetchPrice as fetchPriceEndpoint } from "@/lib/api/endpoints"
import {
  buildAmazonSearchUrl,
  buildFetchPriceParams,
  buildPriceQuery,
  getFormatHint
} from "@/lib/books/amazon-query"
import { usePriceHistory } from "@/lib/hooks/use-price-history"
import {
  DEFAULT_CURRENCY_CODE,
  useLibraryStore
} from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type {
  OwnershipStatus,
  ReadingStatus,
  SeriesWithVolumes,
  Volume,
  VolumeEdition,
  VolumeFormat,
  VolumeInsert
} from "@/lib/types/database"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"
import { uploadImage } from "@/lib/uploads/upload-image"
import { cn } from "@/lib/utils"

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

/** Valid Amazon domains for URL validation. @source */
const AMAZON_DOMAINS =
  /^https?:\/\/(www\.)?(amazon\.(com|co\.uk|co\.jp|de|fr|it|es|ca|com\.au|com\.br|com\.mx|in|nl|sg|ae|com\.be|com\.tr)|amzn\.to)\//i

/**
 * Returns true if the URL is a valid Amazon product URL or empty.
 * @param url - URL string to validate.
 * @source
 */
function isValidAmazonUrl(url: string): boolean {
  if (!url.trim()) return true
  try {
    return AMAZON_DOMAINS.test(url.trim())
  } catch {
    return false
  }
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
  amazon_url: "",
  started_at: "",
  finished_at: "",
  current_page: ""
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

/** Converts an ISO timestamp or date string to an HTML date input value (YYYY-MM-DD). @source */
function isoToDateInput(value: string | null | undefined): string {
  return value ? value.split("T")[0] : ""
}

/** Parses a YYYY-MM-DD string to a local-time Date, avoiding UTC offset issues. @source */
function parseDateString(value: string): Date | undefined {
  if (!value) return undefined
  const parts = value.split("-").map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined
  const [year, month, day] = parts
  return new Date(year, month - 1, day)
}

/**
 * Calendar-based date picker backed by a YYYY-MM-DD string value.
 * @source
 */
function DatePickerField({
  id,
  value,
  onChange,
  placeholder = "Pick a date"
}: {
  readonly id: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseDateString(value), [value])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        data-prevent-enter-submit="true"
        className={cn(
          "border-input bg-background hover:bg-accent hover:text-accent-foreground flex h-9 w-full items-center justify-start gap-2 rounded-md border px-3 py-2 text-left text-sm font-normal transition-colors",
          !value && "text-muted-foreground"
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
        {selected ? format(selected, "yyyy-MM-dd") : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "")
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/** Tracks the active Amazon async operation in {@link VolumeDialog}. @source */
type FetchState = "idle" | "price" | "image" | "all"

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
  const [fetchState, setFetchState] = useState<FetchState>("idle")
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [coverPreviewError, setCoverPreviewError] = useState(false)
  const [showAmazonWarning, setShowAmazonWarning] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const priceAbortRef = useRef<AbortController | null>(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [amazonUrlError, setAmazonUrlError] = useState("")
  const [activeTab, setActiveTab] = useState("general")
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

  const isBusy = isSubmitting || isUploadingCover || fetchState !== "idle"
  const isSubmitDisabled = isSubmitting || isUploadingCover || !!amazonUrlError

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
      setFetchState("idle")
      setShowAmazonWarning(false)
      return
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setCoverPreviewUrl(null)
    setCoverPreviewError(false)
    setAmazonUrlError("")
    setActiveTab("general")
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
        amazon_url: volume.amazon_url || "",
        started_at: isoToDateInput(volume.started_at),
        finished_at: isoToDateInput(volume.finished_at),
        current_page: volume.current_page?.toString() ?? ""
      })
    } else {
      setFormData({
        ...defaultFormData,
        volume_number: nextVolumeNumber,
        format: getFormatHint(selectedSeriesOption?.type ?? "")
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
    let currentPageValue: number | null = null
    if (formData.current_page) {
      currentPageValue = Number.parseInt(formData.current_page)
    } else if (
      formData.reading_status === "completed" &&
      pageCount &&
      pageCount > 0
    ) {
      currentPageValue = pageCount
    }
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
        current_page: currentPageValue,
        rating:
          formData.rating === "" ? null : Number.parseInt(formData.rating),
        notes: formData.notes || null,
        publish_date: formData.publish_date || null,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price
          ? Number.parseFloat(formData.purchase_price)
          : null,
        edition: (formData.edition || null) as VolumeEdition | null,
        format: (formData.format || null) as VolumeFormat | null,
        amazon_url: formData.amazon_url || null,
        started_at: formData.started_at || null,
        finished_at: formData.finished_at || null
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

  const getAmazonSearchUrl = () => {
    const queryResult = buildPriceQuery({
      seriesTitle: selectedSeriesOption?.title,
      volumeTitle: formData.title,
      volumeNumber: formData.volume_number,
      seriesType: selectedSeriesOption?.type,
      preferKindle: amazonPreferKindle
    })
    if ("error" in queryResult) return ""
    const { title, volume, format, binding } = queryResult.params
    return buildAmazonSearchUrl({
      domain: amazonDomain,
      seriesTitle: title,
      volumeNumber: Number(volume),
      format,
      bindingLabel: binding
    })
  }

  const handleOpenAmazonPage = () => {
    const url = formData.amazon_url || getAmazonSearchUrl()
    if (!url) return
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const parsePriceFromResult = (result?: {
    priceText?: string | null
    priceValue?: number | null
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
    priceText?: string | null
    priceValue?: number | null
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

  /** Validate pre-conditions and build typed params. Returns null on failure. */
  const prepareAmazonFetch = (options: {
    includePrice: boolean
    includeImage: boolean
    source?: string
  }) => {
    const source = options.source || priceSource
    if (source !== "amazon" && source !== "bookwalker") {
      toast.error("This price source is not supported yet.")
      return null
    }

    const result = buildFetchPriceParams({
      seriesTitle: selectedSeriesOption?.title,
      volumeTitle: formData.title,
      volumeNumber: formData.volume_number,
      seriesType: selectedSeriesOption?.type,
      preferKindle: amazonPreferKindle,
      domain: amazonDomain,
      includeImage: options.includeImage || undefined,
      includePrice: options.includePrice ? undefined : false,
      fallbackToKindle:
        options.includePrice && !amazonPreferKindle && amazonFallbackToKindle
          ? true
          : undefined,
      source
    })

    if ("error" in result) {
      toast.error(result.error)
      return null
    }

    return result.params
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
    setFetchState("idle")
  }

  /** Core Amazon fetch — returns both price and image when requested. */
  const fetchFromAmazon = useCallback(
    async (options: {
      includePrice: boolean
      includeImage: boolean
      source?: string
    }) => {
      const params = prepareAmazonFetch(options)
      if (!params) return

      if (priceAbortRef.current) priceAbortRef.current.abort()
      const controller = new AbortController()
      priceAbortRef.current = controller

      let nextFetchState: FetchState = "image"
      if (options.includePrice && options.includeImage) nextFetchState = "all"
      else if (options.includePrice) nextFetchState = "price"
      setFetchState(nextFetchState)

      try {
        const data = await fetchPriceEndpoint(params, controller.signal)

        if (options.includePrice) applyPriceResult(data.data?.result)
        if (options.includeImage) applyImageResult(data.data?.result?.imageUrl)
        if (data.data?.result?.url)
          updateField("amazon_url", data.data.result.url)

        if (
          options.includePrice &&
          volume?.id &&
          data.data?.result?.priceValue != null
        ) {
          try {
            const currency = priceDisplayCurrency ?? DEFAULT_CURRENCY_CODE
            const source = options.source || priceSource
            const { alertTriggered } = await persistPrice(
              data.data.result.priceValue,
              currency,
              source
            )
            if (alertTriggered) {
              toast.info(
                `Price alert triggered! Price dropped to $${data.data.result.priceValue.toFixed(2)}`
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
    <ResponsiveDialogRaw
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl p-0 sm:max-w-3xl"
    >
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

        {/* ── Tabbed Fields ── */}
        <div className="px-6 py-5">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as string)}
          >
            <TabsList className="w-full overflow-x-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="purchase">Purchase</TabsTrigger>
              <TabsTrigger value="notes-cover">Notes & Cover</TabsTrigger>
            </TabsList>

            {/* ── General ── */}
            <TabsContent value="general" keepMounted>
              <div className="space-y-5 pt-3">
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edition">Edition</Label>
                    <Select
                      value={formData.edition}
                      onValueChange={(value) =>
                        updateField("edition", value ?? "")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select edition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="first_edition">
                          First Edition
                        </SelectItem>
                        <SelectItem value="collectors">
                          Collector&apos;s
                        </SelectItem>
                        <SelectItem value="omnibus">Omnibus</SelectItem>
                        <SelectItem value="box_set">Box Set</SelectItem>
                        <SelectItem value="limited">Limited</SelectItem>
                        <SelectItem value="deluxe">Deluxe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="format">Format</Label>
                    <Select
                      value={formData.format}
                      onValueChange={(value) =>
                        updateField("format", value ?? "")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="paperback">Paperback</SelectItem>
                        <SelectItem value="hardcover">Hardcover</SelectItem>
                        <SelectItem value="digital">Digital</SelectItem>
                        <SelectItem value="audiobook">Audiobook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Details ── */}
            <TabsContent value="details" keepMounted>
              <div className="space-y-5 pt-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="isbn">ISBN</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="isbn"
                        placeholder="978-..."
                        value={formData.isbn}
                        onChange={(e) => updateField("isbn", e.target.value)}
                        className="flex-1"
                      />
                      <IsbnScannerButton
                        onScan={(isbn) => updateField("isbn", isbn)}
                        disabled={isBusy}
                      />
                    </div>
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

                <div className="space-y-2">
                  <Label htmlFor="publish_date">Publish Date</Label>
                  <DatePickerField
                    id="publish_date"
                    value={formData.publish_date}
                    onChange={(val) => updateField("publish_date", val)}
                    placeholder="Select publish date"
                  />
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
              </div>
            </TabsContent>

            {/* ── Status ── */}
            <TabsContent value="status" keepMounted>
              <div className="space-y-5 pt-3">
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
                        if (!value) return
                        const today = new Date().toISOString().split("T")[0]
                        const updates: Partial<typeof formData> = {
                          reading_status: value as ReadingStatus
                        }
                        if (value === "reading" && !formData.started_at) {
                          updates.started_at = today
                        }
                        if (value === "completed") {
                          if (!formData.finished_at) updates.finished_at = today
                          if (!formData.started_at) updates.started_at = today
                        }
                        setFormData((prev) => ({ ...prev, ...updates }))
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating (0–10)</Label>
                    <Input
                      id="rating"
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      value={formData.rating}
                      onChange={(e) => updateField("rating", e.target.value)}
                    />
                  </div>

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
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="started_at">Started Reading</Label>
                    <Input
                      id="started_at"
                      type="date"
                      value={formData.started_at}
                      onChange={(e) =>
                        updateField("started_at", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="finished_at">Finished Reading</Label>
                    <Input
                      id="finished_at"
                      type="date"
                      value={formData.finished_at}
                      onChange={(e) =>
                        updateField("finished_at", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Purchase ── */}
            <TabsContent value="purchase" keepMounted>
              <div className="space-y-5 pt-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                    Purchase Info
                  </p>
                  <span className="text-muted-foreground text-xs">
                    {priceDisplayCurrency} · {priceCurrencySymbol}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="purchase_date">Purchase Date</Label>
                    <DatePickerField
                      id="purchase_date"
                      value={formData.purchase_date}
                      onChange={(val) => updateField("purchase_date", val)}
                      placeholder="Select purchase date"
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

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={handleFetchAmazonPrice}
                    disabled={isBusy}
                  >
                    {fetchState === "price" ? (
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      setShowAmazonWarning(true)
                      void fetchFromAmazon({
                        includePrice: true,
                        includeImage: false,
                        source: "bookwalker"
                      })
                    }}
                    disabled={isBusy}
                  >
                    Fetch from BookWalker
                  </Button>
                  <span className="text-muted-foreground text-[11px]">
                    Price only
                  </span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
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

                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="amazon_url" className="text-[11px]">
                    Amazon URL
                  </Label>
                  <Input
                    id="amazon_url"
                    type="url"
                    placeholder="https://www.amazon.com/..."
                    value={formData.amazon_url}
                    onChange={(e) => {
                      const val = e.target.value
                      updateField("amazon_url", val)
                      setAmazonUrlError(
                        val && !isValidAmazonUrl(val)
                          ? "URL must be from an Amazon domain (e.g. amazon.com)"
                          : ""
                      )
                    }}
                    className="h-8 text-xs"
                    aria-describedby={
                      amazonUrlError ? "amazon-url-error" : undefined
                    }
                  />
                  {amazonUrlError && (
                    <p
                      id="amazon-url-error"
                      className="text-destructive text-[11px]"
                    >
                      {amazonUrlError}
                    </p>
                  )}
                  {formData.amazon_url && !amazonUrlError && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => {
                        updateField("amazon_url", "")
                        setAmazonUrlError("")
                      }}
                    >
                      Clear URL
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── Notes & Cover ── */}
            <TabsContent value="notes-cover" keepMounted>
              <div className="space-y-5 pt-3">
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

                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <div className="flex w-40 shrink-0 flex-col items-center gap-3 sm:w-50">
                    {coverUrl && !coverPreviewError && (
                      <CoverImage
                        preview
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
                      <div className="bg-muted text-muted-foreground flex aspect-2/3 w-full items-center justify-center rounded-xl text-xs">
                        Preview unavailable
                      </div>
                    )}
                    {!coverUrl && !coverPreviewError && (
                      <div className="bg-muted/60 border-border/40 flex aspect-2/3 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed">
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
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="3"
                            rx="2"
                            ry="2"
                          />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        <span className="text-muted-foreground/60 text-[10px]">
                          No cover
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-64 space-y-2.5">
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
                      <Label
                        htmlFor="cover_image_upload"
                        className="text-[11px]"
                      >
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
                              toast.error(
                                "Cover images must be 5MB or smaller."
                              )
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
                            {fetchState === "all" ? (
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
                            {fetchState === "image" ? (
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
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Amazon disclaimer — shown after any Amazon fetch */}
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
                    doesn&apos;t match. The price is generally reliable — if the
                    wrong product is matched, the lookup usually fails outright
                    rather than returning incorrect data.
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
    </ResponsiveDialogRaw>
  )
}
