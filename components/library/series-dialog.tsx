"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { CoverImage } from "@/components/library/cover-image"
import { Button } from "@/components/ui/button"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ResponsiveDialogRaw } from "@/components/ui/responsive-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
import { selectAllSeries, useLibraryStore } from "@/lib/store/library-store"
import type {
  SeriesInsert,
  SeriesStatus,
  SeriesWithVolumes,
  TitleType,
  Volume
} from "@/lib/types/database"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"
import { uploadImage } from "@/lib/uploads/upload-image"

/** Props for the {@link SeriesDialog} component. @source */
interface SeriesDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly series?: SeriesWithVolumes | null
  readonly unassignedVolumes?: Volume[]
  readonly onSubmit: (
    data: Omit<SeriesInsert, "user_id">,
    options?: {
      volumeIds?: string[]
      basisVolumeId?: string | null
    }
  ) => Promise<void>
}

/** Maximum upload size for cover images (5 MB). @source */
const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024

/** Default values for the series form fields. @source */
const defaultFormData = {
  title: "",
  description: "",
  notes: "",
  author: "",
  artist: "",
  publisher: "",
  cover_image_url: "",
  type: "manga" as TitleType,
  total_volumes: "",
  status: "",
  tags: [] as string[],
  is_public: false
}

/**
 * Builds form state from an existing series or falls back to defaults.
 * @param series - Existing series record, or null for a new entry.
 * @returns Initialised form data object.
 * @source
 */
const buildSeriesFormData = (series?: SeriesWithVolumes | null) => ({
  ...defaultFormData,
  title: series?.title ?? "",
  description: series?.description ?? "",
  notes: series?.notes ?? "",
  author: series?.author ?? "",
  artist: series?.artist ?? "",
  publisher: series?.publisher ?? "",
  cover_image_url: series?.cover_image_url ?? "",
  type: series?.type ?? "manga",
  total_volumes: series?.total_volumes ? String(series.total_volumes) : "",
  status: series?.status ?? "",
  tags: series?.tags ?? [],
  is_public: series?.is_public ?? false
})

/** Return type of {@link buildSeriesFormData}. @source */
type SeriesFormData = ReturnType<typeof buildSeriesFormData>

/**
 * Shallow equality check for two series form-data snapshots.
 * @param left - First snapshot.
 * @param right - Second snapshot.
 * @returns `true` if all tracked fields match.
 * @source
 */
const areSeriesFormDataEqual = (left: SeriesFormData, right: SeriesFormData) =>
  left.title === right.title &&
  left.description === right.description &&
  left.notes === right.notes &&
  left.author === right.author &&
  left.artist === right.artist &&
  left.publisher === right.publisher &&
  left.cover_image_url === right.cover_image_url &&
  left.type === right.type &&
  left.total_volumes === right.total_volumes &&
  left.status === right.status &&
  left.tags.join(",") === right.tags.join(",") &&
  left.is_public === right.is_public

/**
 * Dialog for creating or editing a series with cover art, seed-volume picker, and metadata fields.
 * @param props - {@link SeriesDialogProps}
 * @source
 */
export function SeriesDialog({
  open,
  onOpenChange,
  series,
  unassignedVolumes,
  onSubmit
}: SeriesDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [coverPreviewError, setCoverPreviewError] = useState(false)
  const [basisVolumeId, setBasisVolumeId] = useState<string | null>(null)
  const [seedExpanded, setSeedExpanded] = useState(true)
  const formRef = useRef<HTMLFormElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [formData, setFormData] = useState(() => buildSeriesFormData(series))
  const [activeTab, setActiveTab] = useState("general")
  const [tagInput, setTagInput] = useState("")
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const tagInputRef = useRef<HTMLInputElement | null>(null)
  const seriesIdRef = useRef<string | null>(series?.id ?? null)
  const seriesSnapshotRef = useRef(buildSeriesFormData(series))
  const basisSeedRef = useRef<
    Pick<SeriesFormData, "title" | "description" | "cover_image_url">
  >({
    title: "",
    description: "",
    cover_image_url: ""
  })
  const wasOpenRef = useRef(false)
  const isEditing = Boolean(series)

  const allSeries = useLibraryStore(selectAllSeries)
  const allLibraryTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const s of allSeries) {
      for (const t of s.tags ?? []) tagSet.add(t)
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b))
  }, [allSeries])

  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return []
    const lower = tagInput.toLowerCase()
    return allLibraryTags.filter(
      (t) => t.toLowerCase().includes(lower) && !formData.tags.includes(t)
    )
  }, [allLibraryTags, tagInput, formData.tags])

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || formData.tags.includes(trimmed)) return
    setFormData({ ...formData, tags: [...formData.tags, trimmed] })
    setTagInput("")
    setShowTagSuggestions(false)
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) })
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault()
      handleAddTag(tagInput)
    } else if (e.key === "Backspace" && !tagInput && formData.tags.length > 0) {
      handleRemoveTag(formData.tags.at(-1) ?? "")
    } else if (e.key === "Escape") {
      setShowTagSuggestions(false)
    }
  }

  const availableVolumes = useMemo(() => {
    if (!unassignedVolumes || unassignedVolumes.length === 0) return []
    return [...unassignedVolumes]
      .filter((volume) => !volume.series_id)
      .sort((a, b) => {
        const titleA = (a.title ?? "").toLowerCase()
        const titleB = (b.title ?? "").toLowerCase()
        if (titleA && titleB && titleA !== titleB) {
          return titleA.localeCompare(titleB)
        }
        if (titleA || titleB) {
          return titleA.localeCompare(titleB)
        }
        return a.volume_number - b.volume_number
      })
  }, [unassignedVolumes])

  const basisVolume = useMemo(() => {
    if (!basisVolumeId) return null
    return (
      availableVolumes.find((volume) => volume.id === basisVolumeId) ?? null
    )
  }, [availableVolumes, basisVolumeId])

  const basisVolumeLabel = useMemo(() => {
    if (!basisVolume) return ""
    const volumeTitle = basisVolume.title?.trim() ?? ""
    const normalizedTitle = volumeTitle ? normalizeVolumeTitle(volumeTitle) : ""
    const displayTitle =
      normalizedTitle || volumeTitle || `Volume ${basisVolume.volume_number}`
    return `${displayTitle} (Vol. ${basisVolume.volume_number})`
  }, [basisVolume])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const initialFormData = useMemo(() => buildSeriesFormData(series), [series])

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      setBasisVolumeId(null)
      setSeedExpanded(true)
      basisSeedRef.current = {
        title: "",
        description: "",
        cover_image_url: ""
      }
      return
    }

    const nextSeriesId = series?.id ?? null
    const isOpening = !wasOpenRef.current
    const seriesChanged = seriesIdRef.current !== nextSeriesId

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setCoverPreviewUrl(null)
    setCoverPreviewError(false)

    if (isOpening || seriesChanged) {
      setFormData(initialFormData)
      setActiveTab("general")
      seriesSnapshotRef.current = initialFormData
      setBasisVolumeId(null)
      setSeedExpanded(true)
      basisSeedRef.current = {
        title: "",
        description: "",
        cover_image_url: ""
      }
    } else if (series) {
      const hasMeaningfulChanges = !areSeriesFormDataEqual(
        initialFormData,
        seriesSnapshotRef.current
      )
      const userHasEdits = !areSeriesFormDataEqual(
        formData,
        seriesSnapshotRef.current
      )
      if (hasMeaningfulChanges && !userHasEdits) {
        setFormData(initialFormData)
        seriesSnapshotRef.current = initialFormData
      }
    }

    seriesIdRef.current = nextSeriesId
    wasOpenRef.current = true
  }, [open, series?.id, initialFormData, formData, series])

  useEffect(() => {
    if (!basisVolumeId) return
    const stillAvailable = availableVolumes.some(
      (volume) => volume.id === basisVolumeId
    )
    if (!stillAvailable) {
      setBasisVolumeId(null)
    }
  }, [availableVolumes, basisVolumeId])

  useEffect(() => {
    if (!basisVolume || isEditing) return
    const rawTitle = basisVolume.title?.trim() ?? ""
    const derivedTitle = rawTitle ? normalizeVolumeTitle(rawTitle) : ""
    const nextSeed = {
      title: derivedTitle || rawTitle || "",
      description: basisVolume.description ?? "",
      cover_image_url: basisVolume.cover_image_url ?? ""
    }
    const previousSeed = basisSeedRef.current
    let shouldResetCover = false

    setFormData((prev) => {
      const nextForm = { ...prev }

      if (
        nextSeed.title &&
        (!prev.title || prev.title === previousSeed.title)
      ) {
        nextForm.title = nextSeed.title
      }

      if (
        nextSeed.description &&
        (!prev.description || prev.description === previousSeed.description)
      ) {
        nextForm.description = nextSeed.description
      }

      if (
        nextSeed.cover_image_url &&
        (!prev.cover_image_url ||
          prev.cover_image_url === previousSeed.cover_image_url)
      ) {
        nextForm.cover_image_url = nextSeed.cover_image_url
        shouldResetCover = true
      }

      return nextForm
    })

    if (shouldResetCover) {
      setCoverPreviewError(false)
      setPreviewUrl(null)
    }
    basisSeedRef.current = nextSeed
  }, [basisVolume, isEditing])

  const setPreviewUrl = (url: string | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = url
    setCoverPreviewUrl(url)
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setActiveTab("general")
      toast.error("Title is required")
      return
    }
    setIsSubmitting(true)

    try {
      const tagsArray = formData.tags

      const selectedVolumeIds = basisVolumeId ? [basisVolumeId] : []

      await onSubmit(
        {
          title: formData.title,
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
          status: (formData.status || null) as SeriesStatus | null,
          tags: tagsArray,
          is_public: formData.is_public
        },
        selectedVolumeIds.length > 0
          ? {
              volumeIds: selectedVolumeIds,
              basisVolumeId
            }
          : undefined
      )
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

  const isBusy = isSubmitting || isUploadingCover

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
        isBusy
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
  }, [open, isBusy])

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
            {isEditing ? "Edit Series" : "Add Series"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/80 mt-1 text-[13px]">
            {isEditing
              ? "Update series details."
              : "Create a new series for your collection."}
          </DialogDescription>
        </div>
      </DialogHeader>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="divide-border/60 divide-y"
      >
        {/* ── Seed Volume ── */}
        {!isEditing && (
          <div className="px-6 py-5">
            <div className="glass-card space-y-4 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-display text-copper text-[13px] font-semibold tracking-wide">
                    Seed Volume
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Pick an unassigned volume to seed this series and add it
                    automatically on creation.
                  </p>
                  {!seedExpanded && (
                    <p className="text-muted-foreground text-xs">
                      {basisVolume
                        ? `Selected: ${basisVolumeLabel}`
                        : "No seed selected."}
                    </p>
                  )}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>{availableVolumes.length} unassigned</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => setSeedExpanded((prev) => !prev)}
                    aria-expanded={seedExpanded}
                    aria-controls="seed-volume-options"
                    data-prevent-enter-submit="true"
                  >
                    {seedExpanded ? "Collapse" : "Expand"}
                  </Button>
                  {basisVolumeId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => setBasisVolumeId(null)}
                      data-prevent-enter-submit="true"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {seedExpanded && (
                <div id="seed-volume-options">
                  {availableVolumes.length === 0 ? (
                    <div className="text-muted-foreground text-xs">
                      No unassigned volumes available yet.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto p-2">
                      <RadioGroup
                        value={basisVolumeId ?? ""}
                        onValueChange={(value) =>
                          setBasisVolumeId(value || null)
                        }
                        className="space-y-2"
                      >
                        {availableVolumes.map((volume) => {
                          const volumeTitle = volume.title?.trim() ?? ""
                          const normalizedTitle = volumeTitle
                            ? normalizeVolumeTitle(volumeTitle)
                            : ""
                          const displayTitle =
                            normalizedTitle ||
                            volumeTitle ||
                            `Volume ${volume.volume_number}`
                          const subtitleParts = [`Vol. ${volume.volume_number}`]

                          if (
                            volumeTitle &&
                            normalizedTitle &&
                            normalizedTitle !== volumeTitle
                          ) {
                            subtitleParts.push(volumeTitle)
                          }
                          if (!volumeTitle && volume.isbn) {
                            subtitleParts.push(volume.isbn)
                          }

                          return (
                            <div
                              key={volume.id}
                              className={`border-border/60 bg-card/70 hover:bg-accent/60 flex items-start gap-3 rounded-xl border px-3 py-2 transition ${basisVolumeId === volume.id ? "ring-primary/40 ring-2" : ""}`}
                            >
                              <RadioGroupItem
                                value={volume.id}
                                id={`basis-${volume.id}`}
                                className="mt-1"
                              />
                              <Label
                                htmlFor={`basis-${volume.id}`}
                                className="flex flex-1 cursor-pointer items-start gap-3"
                              >
                                <div className="bg-muted relative aspect-2/3 w-10 overflow-hidden rounded-lg">
                                  <CoverImage
                                    isbn={volume.isbn}
                                    coverImageUrl={volume.cover_image_url}
                                    alt={displayTitle}
                                    className="absolute inset-0 h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    fallback={
                                      <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
                                        <span className="text-muted-foreground text-[9px] font-semibold">
                                          {volume.volume_number}
                                        </span>
                                      </div>
                                    }
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-display line-clamp-1 text-xs font-semibold">
                                    {displayTitle}
                                  </p>
                                  <p className="text-muted-foreground line-clamp-1 text-[11px]">
                                    {subtitleParts.join(" • ")}
                                  </p>
                                </div>
                              </Label>
                            </div>
                          )
                        })}
                      </RadioGroup>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tabbed Fields ── */}
        <div className="px-6 py-5">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as string)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
              <TabsTrigger value="notes-tags">Notes & Tags</TabsTrigger>
              <TabsTrigger value="cover">Cover</TabsTrigger>
            </TabsList>

            {/* ── General ── */}
            <TabsContent value="general" keepMounted>
              <div className="space-y-5 pt-3">
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

                <div className="grid gap-4 sm:grid-cols-3">
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
                        <SelectItem value="announced">Announced</SelectItem>
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
                      placeholder="Ongoing"
                      type="number"
                      min="1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value
                      })
                    }
                    placeholder="Brief description of the series"
                    rows={3}
                  />
                </div>

                {/* Visibility */}
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <Label htmlFor="series-is-public">Public</Label>
                    <p className="text-muted-foreground text-xs">
                      Allow anyone to view this series on your public profile
                    </p>
                  </div>
                  <Switch
                    id="series-is-public"
                    checked={formData.is_public}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_public: checked })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── Credits ── */}
            <TabsContent value="credits" keepMounted>
              <div className="space-y-5 pt-3">
                <div className="grid gap-4 sm:grid-cols-3">
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
                        setFormData({
                          ...formData,
                          publisher: e.target.value
                        })
                      }
                      placeholder="Publisher name"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Notes & Tags ── */}
            <TabsContent value="notes-tags" keepMounted>
              <div className="space-y-5 pt-3">
                <div className="space-y-2">
                  <Label htmlFor="tag-input">Tags</Label>
                  <div className="border-input bg-background focus-within:ring-ring flex min-h-10 flex-wrap gap-1.5 rounded-md border px-3 py-2 text-sm focus-within:ring-1">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                      >
                        {tag}
                        <button
                          type="button"
                          aria-label={`Remove ${tag}`}
                          onClick={() => handleRemoveTag(tag)}
                          className="text-secondary-foreground/60 hover:text-secondary-foreground ml-0.5 leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      id="tag-input"
                      ref={tagInputRef}
                      value={tagInput}
                      onChange={(e) => {
                        setTagInput(e.target.value)
                        setShowTagSuggestions(true)
                      }}
                      onKeyDown={handleTagKeyDown}
                      onFocus={() => setShowTagSuggestions(true)}
                      onBlur={() =>
                        setTimeout(() => setShowTagSuggestions(false), 150)
                      }
                      placeholder={
                        formData.tags.length === 0 ? "Add tags..." : ""
                      }
                      className="placeholder:text-muted-foreground min-w-16 flex-1 bg-transparent text-sm outline-none"
                    />
                  </div>
                  {showTagSuggestions && tagSuggestions.length > 0 && (
                    <div className="border-border bg-popover text-popover-foreground z-10 rounded-md border py-1 shadow-md">
                      {tagSuggestions.slice(0, 8).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="hover:bg-accent w-full px-3 py-1.5 text-left text-sm"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleAddTag(tag)
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Press Enter or comma to add. Backspace to remove last tag.
                  </p>
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
              </div>
            </TabsContent>

            {/* ── Cover ── */}
            <TabsContent value="cover" keepMounted>
              <div className="flex flex-col items-center gap-4 pt-3 sm:flex-row sm:items-start">
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

                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-full rounded-lg text-[11px]"
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
                      className="h-7 w-full rounded-lg text-[11px]"
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
                        className="mr-1 h-3.5 w-3.5"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                      Google Images
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {formData.cover_image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
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
                        Uploading…
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
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
            disabled={isBusy}
          >
            {isSubmitting && "Saving..."}
            {!isSubmitting && isEditing && "Save Changes"}
            {!isSubmitting && !isEditing && "Add Series"}
          </Button>
        </DialogFooter>
      </form>
    </ResponsiveDialogRaw>
  )
}
