"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createClient } from "@/lib/supabase/client"
import {
  sanitizeOptionalHtml,
  sanitizeOptionalPlainText,
  sanitizePlainText
} from "@/lib/sanitize-html"
import {
  isValidTitleType,
  isValidOwnershipStatus,
  isValidReadingStatus,
  isPositiveInteger,
  isNonNegativeInteger,
  isNonNegativeFinite
} from "@/lib/validation"
import { toast } from "sonner"
import type {
  SeriesWithVolumes,
  SeriesInsert,
  Volume,
  VolumeInsert
} from "@/lib/types/database"

/** Whether imported data is merged or replaces the existing collection. @source */
type ImportMode = "merge" | "replace"

/** How to handle volumes that already exist during merge-mode import. @source */
type MergeStrategy = "overwrite" | "skip"

/** Preview summary shown after parsing a JSON export file. @source */
interface ImportPreview {
  seriesCount: number
  volumeCount: number
  data: SeriesWithVolumes[]
}

/**
 * Validates that each volume entry in the import payload has a finite `volume_number`.
 * @param volumes - Raw volume array from the parsed JSON.
 * @param seriesIndex - Index of the parent series (used in error messages).
 * @throws {TypeError} If any volume is invalid.
 * @source
 */
function validateImportVolumes(volumes: unknown[], seriesIndex: number): void {
  for (let j = 0; j < volumes.length; j++) {
    const v = volumes[j] as Record<string, unknown>
    if (!v || typeof v !== "object") {
      throw new TypeError(
        `Invalid volume at series ${seriesIndex}, volume ${j}`
      )
    }
    if (
      typeof v.volume_number !== "number" ||
      !Number.isFinite(v.volume_number)
    ) {
      throw new TypeError(
        `Invalid volume_number at series ${seriesIndex}, volume ${j}`
      )
    }
  }
}

/**
 * Validates the top-level structure of the import payload (title required, volumes array optional).
 * @param data - Parsed JSON array.
 * @throws {TypeError} If any item is malformed.
 * @source
 */
function validateImportStructure(data: unknown[]): void {
  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown>
    if (!item || typeof item !== "object") {
      throw new TypeError(`Invalid item at index ${i}: expected an object`)
    }
    if (!item.title || typeof item.title !== "string") {
      throw new TypeError(`Invalid item at index ${i}: title is required`)
    }
    if (item.volumes !== undefined && !Array.isArray(item.volumes)) {
      throw new TypeError(
        `Invalid item at index ${i}: volumes must be an array`
      )
    }
    if (Array.isArray(item.volumes)) {
      validateImportVolumes(item.volumes, i)
    }
  }
}

/**
 * Sanitises and maps a raw series record to a safe {@link SeriesInsert}.
 * @param s - Raw series data from the import file.
 * @param userId - Authenticated user's ID.
 * @returns Sanitised insert payload, or `null` if the title is empty.
 * @source
 */
function sanitizeSeriesImport(
  s: SeriesWithVolumes,
  userId: string
): SeriesInsert | null {
  const sanitizedTitle = sanitizePlainText(s.title || "", 500)
  if (!sanitizedTitle) return null

  return {
    user_id: userId,
    title: sanitizedTitle,
    type: isValidTitleType(s.type) ? s.type : "other",
    original_title: sanitizeOptionalPlainText(s.original_title, 500),
    description: sanitizeOptionalHtml(s.description),
    author: sanitizeOptionalPlainText(s.author, 1000),
    artist: sanitizeOptionalPlainText(s.artist, 1000),
    publisher: sanitizeOptionalPlainText(s.publisher, 1000),
    cover_image_url: sanitizeOptionalPlainText(s.cover_image_url, 2000),
    total_volumes:
      s.total_volumes != null && isPositiveInteger(s.total_volumes)
        ? s.total_volumes
        : null,
    status: sanitizeOptionalPlainText(s.status, 200),
    tags: Array.isArray(s.tags)
      ? s.tags
          .map((tag: unknown) => sanitizePlainText(String(tag ?? ""), 100))
          .filter(Boolean)
      : []
  }
}

/**
 * Sanitises and maps a raw volume record to a safe {@link VolumeInsert}.
 * @param v - Raw volume data from the import file.
 * @param seriesId - Parent series UUID.
 * @param userId - Authenticated user's ID.
 * @returns Sanitised insert payload, or `null` if the volume number is invalid.
 * @source
 */
function sanitizeVolumeImport(
  v: Volume,
  seriesId: string,
  userId: string
): VolumeInsert | null {
  if (
    typeof v.volume_number !== "number" ||
    !Number.isFinite(v.volume_number) ||
    v.volume_number < 0
  ) {
    return null
  }
  return {
    series_id: seriesId,
    user_id: userId,
    volume_number: v.volume_number,
    title: sanitizeOptionalPlainText(v.title, 500),
    description: sanitizeOptionalHtml(v.description),
    isbn: sanitizeOptionalPlainText(v.isbn, 20),
    cover_image_url: sanitizeOptionalPlainText(v.cover_image_url, 2000),
    ownership_status: isValidOwnershipStatus(v.ownership_status)
      ? v.ownership_status
      : "owned",
    reading_status: isValidReadingStatus(v.reading_status)
      ? v.reading_status
      : "unread",
    current_page:
      v.current_page != null && isNonNegativeInteger(v.current_page)
        ? v.current_page
        : null,
    page_count:
      v.page_count != null && isPositiveInteger(v.page_count)
        ? v.page_count
        : null,
    rating:
      v.rating != null &&
      typeof v.rating === "number" &&
      v.rating >= 0 &&
      v.rating <= 10
        ? v.rating
        : null,
    notes: sanitizeOptionalPlainText(v.notes, 5000),
    publish_date: sanitizeOptionalPlainText(v.publish_date, 20),
    purchase_date: sanitizeOptionalPlainText(v.purchase_date, 20),
    purchase_price:
      v.purchase_price != null && isNonNegativeFinite(v.purchase_price)
        ? v.purchase_price
        : null,
    edition: sanitizeOptionalPlainText(v.edition, 200),
    format: sanitizeOptionalPlainText(v.format, 200),
    amazon_url: sanitizeOptionalPlainText(v.amazon_url, 2000)
  }
}

/** Typed handle for the `series` Supabase table used during import. @source */
type SeriesTableHandle = {
  delete: () => {
    eq: (field: string, value: string) => Promise<{ error: Error | null }>
  }
  insert: (data: SeriesInsert[]) => {
    select: () => Promise<{
      data: { id: string }[] | null
      error: Error | null
    }>
  }
  select: (columns: string) => {
    eq: (
      field: string,
      value: string
    ) => Promise<{
      data: { id: string; title: string; type: string }[] | null
      error: Error | null
    }>
  }
}

/** Typed handle for the `volumes` Supabase table used during import. @source */
type VolumesTableHandle = {
  delete: () => {
    eq: (field: string, value: string) => Promise<{ error: Error | null }>
  }
  insert: (data: VolumeInsert[]) => Promise<{ error: Error | null }>
  upsert: (
    data: VolumeInsert[],
    options: { onConflict: string; ignoreDuplicates?: boolean }
  ) => Promise<{ error: Error | null }>
}

/** A sanitised series insert paired with its original import data. @source */
type SeriesPair = { insert: SeriesInsert; original: SeriesWithVolumes }

/**
 * Collects sanitised volume inserts for a list of series,
 * mapping each volume to the given series ID.
 * @source
 */
function collectVolumes(
  pairs: { seriesId: string; original: SeriesWithVolumes }[],
  userId: string
): VolumeInsert[] {
  const result: VolumeInsert[] = []
  for (const { seriesId, original } of pairs) {
    if (!original.volumes?.length) continue
    for (const v of original.volumes) {
      const vi = sanitizeVolumeImport(v, seriesId, userId)
      if (vi) result.push(vi)
    }
  }
  return result
}

/**
 * Replace-mode import: deletes all existing data, then batch-inserts
 * all series and volumes in two requests.
 * @source
 */
async function importReplace(
  seriesPairs: SeriesPair[],
  userId: string,
  seriesTable: SeriesTableHandle,
  volumesTable: VolumesTableHandle,
  onPhase: (index: number, label?: string) => void
): Promise<string> {
  onPhase(0)
  await volumesTable.delete().eq("user_id", userId)
  await seriesTable.delete().eq("user_id", userId)

  onPhase(1, `Importing ${seriesPairs.length} series...`)
  const { data: insertedSeries, error: seriesError } = await seriesTable
    .insert(seriesPairs.map((p) => p.insert))
    .select()

  if (seriesError || !insertedSeries) {
    throw new Error("Failed to insert series")
  }

  const allVolumes = collectVolumes(
    insertedSeries.map((s, i) => ({
      seriesId: s.id,
      original: seriesPairs[i].original
    })),
    userId
  )

  onPhase(2, `Importing ${allVolumes.length} volumes...`)
  if (allVolumes.length > 0) {
    const { error: volError } = await volumesTable.insert(allVolumes)
    if (volError) throw new Error("Failed to insert volumes")
  }

  return `Imported ${insertedSeries.length} series with ${allVolumes.length} volumes`
}

/**
 * Merge-mode import: matches existing series by title + type,
 * batch-inserts new series, and upserts all volumes.
 * @source
 */
async function importMerge(
  seriesPairs: SeriesPair[],
  userId: string,
  seriesTable: SeriesTableHandle,
  volumesTable: VolumesTableHandle,
  onPhase: (index: number, label?: string) => void,
  mergeStrategy: MergeStrategy
): Promise<string> {
  onPhase(0)
  const { data: existingSeries, error: fetchError } = await seriesTable
    .select("id, title, type")
    .eq("user_id", userId)

  if (fetchError) throw new Error("Failed to fetch existing series")

  const existingMap = new Map<string, string>()
  for (const s of existingSeries ?? []) {
    existingMap.set(`${s.title.toLowerCase()}::${s.type}`, s.id)
  }

  const newPairs: SeriesPair[] = []
  const matchedPairs: { existingId: string; original: SeriesWithVolumes }[] = []

  for (const pair of seriesPairs) {
    const key = `${pair.insert.title.toLowerCase()}::${pair.insert.type}`
    const existingId = existingMap.get(key)
    if (existingId) {
      matchedPairs.push({ existingId, original: pair.original })
    } else {
      newPairs.push(pair)
    }
  }

  onPhase(
    1,
    `Importing ${newPairs.length} new series, merging ${matchedPairs.length} existing...`
  )
  let newSeriesIds: { id: string }[] = []
  if (newPairs.length > 0) {
    const { data, error } = await seriesTable
      .insert(newPairs.map((p) => p.insert))
      .select()
    if (error || !data) throw new Error("Failed to insert new series")
    newSeriesIds = data
  }

  const volumeSources = [
    ...newSeriesIds.map((s, i) => ({
      seriesId: s.id,
      original: newPairs[i].original
    })),
    ...matchedPairs.map((m) => ({
      seriesId: m.existingId,
      original: m.original
    }))
  ]
  const allVolumes = collectVolumes(volumeSources, userId)

  onPhase(2, `Processing ${allVolumes.length} volumes...`)
  if (allVolumes.length > 0) {
    const { error: volError } = await volumesTable.upsert(allVolumes, {
      onConflict: "series_id,volume_number,edition",
      ignoreDuplicates: mergeStrategy === "skip"
    })
    if (volError) throw new Error("Failed to upsert volumes")
  }

  return `Imported ${newPairs.length} new series, merged ${matchedPairs.length} existing (${allVolumes.length} volumes processed)`
}

/**
 * Parses a JSON export file and returns a normalised array of
 * {@link SeriesWithVolumes}. Supports both the legacy flat-array format
 * and the current `{ series, volumes }` export shape.
 * @param content - Raw file content string.
 * @returns Parsed series array.
 * @throws {TypeError} If the JSON is malformed or not a recognised format.
 * @source
 */
function parseImportJson(content: string): SeriesWithVolumes[] {
  const parsed: unknown = JSON.parse(content)

  if (Array.isArray(parsed)) {
    return parsed as SeriesWithVolumes[]
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "series" in parsed &&
    "volumes" in parsed
  ) {
    const obj = parsed as { series: unknown; volumes: unknown }

    if (!Array.isArray(obj.series)) {
      throw new TypeError("Invalid JSON format: 'series' must be an array")
    }
    if (!Array.isArray(obj.volumes)) {
      throw new TypeError("Invalid JSON format: 'volumes' must be an array")
    }

    const seriesList = obj.series as Record<string, unknown>[]
    const volumesList = obj.volumes as Volume[]

    const volumesBySeries = new Map<string, Volume[]>()
    for (const v of volumesList) {
      const sid = v.series_id
      if (sid) {
        const existing = volumesBySeries.get(sid) ?? []
        existing.push(v)
        volumesBySeries.set(sid, existing)
      }
    }

    return seriesList.map((s) => {
      const id = s.id as string
      return {
        ...s,
        volumes: volumesBySeries.get(id) ?? []
      } as SeriesWithVolumes
    })
  }

  throw new TypeError(
    "Invalid JSON format: expected an array of series or { series, volumes }"
  )
}

/** Single phase in the import progress indicator. @source */
interface ImportPhase {
  label: string
  status: "pending" | "active" | "complete"
}

/** Inline SVG spinner used for active import phases. @source */
function PhaseSpinner({ className = "" }: { readonly className?: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 animate-spin ${className}`}
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
  )
}

/** Inline SVG checkmark used for completed import phases. @source */
function PhaseCheck({ className = "" }: { readonly className?: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/** Resolves the icon element for a given import phase status. @source */
function PhaseIcon({ status }: { readonly status: ImportPhase["status"] }) {
  if (status === "active") {
    return (
      <div className="animate-pulse-glow rounded-full">
        <PhaseSpinner className="text-copper" />
      </div>
    )
  }
  if (status === "complete") {
    return <PhaseCheck className="text-copper" />
  }
  return (
    <div className="border-muted-foreground/30 h-4 w-4 rounded-full border-2" />
  )
}

/** Returns the text style class for a given import phase status. @source */
function phaseTextClass(status: ImportPhase["status"]): string {
  if (status === "active") return "text-foreground font-medium"
  if (status === "complete") return "text-muted-foreground"
  return "text-muted-foreground/50"
}

/**
 * Progress stepper displayed during JSON import operations.
 * Shows a vertical list of phases with spinner/checkmark status icons.
 * @source
 */
function ImportProgress({
  phases,
  resultMessage
}: {
  readonly phases: ImportPhase[]
  readonly resultMessage: string | null
}) {
  const isComplete = phases.every((p) => p.status === "complete")

  return (
    <div
      className="glass-card animate-fade-in-up rounded-2xl p-5"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="from-copper to-gold h-1.5 w-6 rounded-full bg-linear-to-r" />
        <h4 className="text-sm font-semibold tracking-wide uppercase">
          Import Progress
        </h4>
      </div>

      <div className="space-y-1">
        {phases.map((phase, i) => (
          <div
            key={`phase-${String(i)}`}
            className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-all duration-300 ${
              phase.status === "active" ? "bg-copper/5" : ""
            }`}
          >
            <div className="shrink-0">
              <PhaseIcon status={phase.status} />
            </div>

            <span
              className={`text-sm transition-all duration-300 ${phaseTextClass(phase.status)}`}
            >
              {phase.label}
            </span>
          </div>
        ))}
      </div>

      {isComplete && resultMessage && (
        <div className="from-copper/10 to-gold/10 animate-fade-in mt-4 rounded-xl bg-linear-to-r p-3">
          <p className="text-copper text-sm font-medium">{resultMessage}</p>
        </div>
      )}
    </div>
  )
}

/**
 * JSON import form for restoring a ShelfArc backup (merge or replace mode).
 * @source
 */
export function JsonImport() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ImportMode>("merge")
  const [isImporting, setIsImporting] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importPhases, setImportPhases] = useState<ImportPhase[]>([])
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>("overwrite")
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setImportPhases([])
      setResultMessage(null)
      const content = await file.text()

      if (!file.name.endsWith(".json")) {
        throw new TypeError("Please select a JSON file exported from ShelfArc")
      }

      const data = parseImportJson(content)

      validateImportStructure(data)

      const volumeCount = data.reduce(
        (acc, s) => acc + (s.volumes?.length || 0),
        0
      )

      setPreview({ seriesCount: data.length, volumeCount, data })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file")
      setPreview(null)
    }
  }

  const handleImport = async () => {
    if (!preview) return

    setIsImporting(true)
    setResultMessage(null)

    const phaseLabels =
      mode === "replace"
        ? [
            "Clearing existing data...",
            "Importing series...",
            "Importing volumes...",
            "Complete!"
          ]
        : [
            "Checking existing collection...",
            "Importing series...",
            "Processing volumes...",
            "Complete!"
          ]
    setImportPhases(
      phaseLabels.map((label) => ({ label, status: "pending" as const }))
    )

    const onPhase = (index: number, label?: string) => {
      setImportPhases((prev) =>
        prev.map((p, i) => {
          let status: ImportPhase["status"] = "pending"
          if (i < index) status = "complete"
          else if (i === index) status = "active"
          return {
            ...p,
            label: i === index && label ? label : p.label,
            status
          }
        })
      )
    }

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const seriesTable = supabase.from(
        "series"
      ) as unknown as SeriesTableHandle
      const volumesTable = supabase.from(
        "volumes"
      ) as unknown as VolumesTableHandle

      const seriesPairs: SeriesPair[] = []
      for (const s of preview.data) {
        const insert = sanitizeSeriesImport(s, user.id)
        if (insert) seriesPairs.push({ insert, original: s })
      }

      if (seriesPairs.length === 0) {
        toast.success("No valid series to import")
        return
      }

      const message =
        mode === "replace"
          ? await importReplace(
              seriesPairs,
              user.id,
              seriesTable,
              volumesTable,
              onPhase
            )
          : await importMerge(
              seriesPairs,
              user.id,
              seriesTable,
              volumesTable,
              onPhase,
              mergeStrategy
            )

      setImportPhases((prev) =>
        prev.map((p) => ({ ...p, status: "complete" as const }))
      )
      setResultMessage(message)
      toast.success(message)
      setPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import data")
      setImportPhases([])
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="json-file">Select File</Label>
        <input
          ref={fileInputRef}
          type="file"
          id="json-file"
          accept=".json"
          onChange={handleFileSelect}
          className="text-muted-foreground file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 block w-full cursor-pointer text-sm file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
        />
        <p className="text-muted-foreground text-xs">
          Only JSON exports from ShelfArc are supported
        </p>
      </div>

      {preview && (
        <div className="bg-muted/50 rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Preview</h3>
          <p className="text-muted-foreground text-sm">
            Found{" "}
            <span className="text-foreground font-medium">
              {preview.seriesCount}
            </span>{" "}
            series with{" "}
            <span className="text-foreground font-medium">
              {preview.volumeCount}
            </span>{" "}
            volumes
          </p>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <Label>Import Mode</Label>
          <RadioGroup
            value={mode}
            onValueChange={(value: ImportMode) => setMode(value)}
            className="space-y-2"
          >
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <RadioGroupItem value="merge" id="merge" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="merge" className="cursor-pointer font-medium">
                  Add to Collection
                </Label>
                <p className="text-muted-foreground text-sm">
                  Import entries into your existing collection. Choose how to
                  handle conflicts below.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <RadioGroupItem value="replace" id="replace" className="mt-1" />
              <div className="space-y-1">
                <Label
                  htmlFor="replace"
                  className="text-destructive cursor-pointer font-medium"
                >
                  Replace Collection
                </Label>
                <p className="text-muted-foreground text-sm">
                  Delete all existing data and import fresh. This cannot be
                  undone.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      )}

      {preview && mode === "merge" && (
        <div className="space-y-3">
          <Label>When a volume already exists</Label>
          <RadioGroup
            value={mergeStrategy}
            onValueChange={(value: MergeStrategy) => setMergeStrategy(value)}
            className="space-y-2"
          >
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <RadioGroupItem
                value="overwrite"
                id="merge-overwrite"
                className="mt-1"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="merge-overwrite"
                  className="cursor-pointer font-medium"
                >
                  Overwrite
                </Label>
                <p className="text-muted-foreground text-sm">
                  Update existing volumes with values from the import.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <RadioGroupItem value="skip" id="merge-skip" className="mt-1" />
              <div className="space-y-1">
                <Label
                  htmlFor="merge-skip"
                  className="cursor-pointer font-medium"
                >
                  Skip
                </Label>
                <p className="text-muted-foreground text-sm">
                  Keep existing volumes unchanged; only add missing ones.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      )}

      <div className="flex gap-4">
        <Button
          onClick={handleImport}
          disabled={!preview || isImporting}
          className="rounded-xl px-6"
        >
          {isImporting ? "Importing..." : "Import"}
        </Button>
      </div>

      {importPhases.length > 0 && (
        <ImportProgress phases={importPhases} resultMessage={resultMessage} />
      )}
    </div>
  )
}
