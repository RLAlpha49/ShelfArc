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

/**
 * Inserts a single series and its volumes into the database.
 * @param s - Series record with nested volumes.
 * @param userId - Authenticated user's ID.
 * @param seriesTable - Supabase `series` table handle.
 * @param volumesTable - Supabase `volumes` table handle.
 * @source
 */
async function importSeriesWithVolumes(
  s: SeriesWithVolumes,
  userId: string,
  seriesTable: {
    insert: (data: SeriesInsert) => {
      select: () => {
        single: () => Promise<{
          data: { id: string } | null
          error: Error | null
        }>
      }
    }
  },
  volumesTable: {
    insert: (data: VolumeInsert[]) => Promise<{ error: Error | null }>
  }
): Promise<void> {
  const seriesInsert = sanitizeSeriesImport(s, userId)
  if (!seriesInsert) return

  const { data: newSeries, error: seriesError } = await seriesTable
    .insert(seriesInsert)
    .select()
    .single()

  if (seriesError || !newSeries) return

  if (s.volumes && s.volumes.length > 0) {
    const volumeInserts: VolumeInsert[] = s.volumes
      .map((v) => sanitizeVolumeImport(v, newSeries.id, userId))
      .filter((v): v is VolumeInsert => v !== null)

    if (volumeInserts.length > 0) {
      await volumesTable.insert(volumeInserts)
    }
  }
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
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

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const seriesTable = supabase.from("series") as unknown as {
        delete: () => {
          eq: (field: string, value: string) => Promise<{ error: Error | null }>
        }
        insert: (data: SeriesInsert) => {
          select: () => {
            single: () => Promise<{
              data: { id: string } | null
              error: Error | null
            }>
          }
        }
      }

      const volumesTable = supabase.from("volumes") as unknown as {
        delete: () => {
          eq: (field: string, value: string) => Promise<{ error: Error | null }>
        }
        insert: (data: VolumeInsert[]) => Promise<{ error: Error | null }>
      }

      if (mode === "replace") {
        await volumesTable.delete().eq("user_id", user.id)
        await seriesTable.delete().eq("user_id", user.id)
      }

      for (const s of preview.data) {
        await importSeriesWithVolumes(s, user.id, seriesTable, volumesTable)
      }

      toast.success(
        `Imported ${preview.seriesCount} series with ${preview.volumeCount} volumes`
      )

      setPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import data")
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
                  Import as new entries. Existing data will not be affected.
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

      <div className="flex gap-4">
        <Button
          onClick={handleImport}
          disabled={!preview || isImporting}
          className="rounded-xl px-6"
        >
          {isImporting ? "Importing..." : "Import"}
        </Button>
      </div>
    </div>
  )
}
