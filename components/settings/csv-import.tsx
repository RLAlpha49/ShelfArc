"use client"

import { FileDownloadIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { CoverImage } from "@/components/library/cover-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { logImportEvent } from "@/lib/api/import-events"
import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"
import type { BookSearchSource } from "@/lib/books/search"
import type {
  ShelfArcConflictStrategy,
  ShelfArcCsvRow,
  ShelfArcImportStats
} from "@/lib/csv/parse-shelfarc-csv"
import { parseShelfArcCsv } from "@/lib/csv/parse-shelfarc-csv"
import type {
  CsvImportPhase,
  CsvImportStats,
  CsvParseMeta,
  IsbnImportItem,
  IsbnImportStatus
} from "@/lib/csv/types"
import { useCsvImport } from "@/lib/csv/use-csv-import"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLiveAnnouncer } from "@/lib/hooks/use-live-announcer"
import { useSettingsStore } from "@/lib/store/settings-store"
import type {
  OwnershipStatus,
  SeriesWithVolumes,
  Volume
} from "@/lib/types/database"

/* ─── Constants ─────────────────────────────────────────── */

/** Session storage key for persisting import progress. @source */
const IMPORT_STORAGE_KEY = "shelfarc-csv-import-progress"

/** Accepted file extensions for the file-picker input. @source */
const ACCEPTED_EXTENSIONS = ".csv,.tsv,.txt"

/** Import statuses that indicate actively processing. @source */
const ACTIVE_STATUSES = new Set<IsbnImportStatus>([
  "searching",
  "fallback",
  "adding"
])

/** Statuses for which a matched search result should be rendered. @source */
const SHOW_RESULT_STATUSES = new Set<IsbnImportStatus>([
  "added",
  "adding",
  "found"
])

/** Label, Tailwind color, and emoji icon per import status. @source */
const STATUS_CONFIG: Record<
  IsbnImportStatus,
  { label: string; color: string; icon: string }
> = {
  pending: {
    label: "Waiting",
    color: "bg-muted text-muted-foreground",
    icon: "⏳"
  },
  searching: {
    label: "Searching…",
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icon: "🔍"
  },
  fallback: {
    label: "Trying fallback…",
    color: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    icon: "🔄"
  },
  found: {
    label: "Found",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    icon: "📖"
  },
  adding: {
    label: "Importing…",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    icon: "📥"
  },
  added: {
    label: "Imported",
    color: "bg-green-500/10 text-green-700 dark:text-green-400",
    icon: "✓"
  },
  "not-found": {
    label: "Not found",
    color: "bg-muted text-muted-foreground",
    icon: "✗"
  },
  error: {
    label: "Error",
    color: "bg-red-500/10 text-red-700 dark:text-red-400",
    icon: "⚠"
  }
}

/* ─── Helpers ───────────────────────────────────────────── */

/**
 * Escapes a CSV field value, wrapping in quotes if it contains commas, quotes, or newlines.
 * @source
 */
function escapeCsvField(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

/**
 * Generates a CSV reconciliation report showing which ISBNs will be imported vs skipped.
 * @source
 */
function generateReconciliationReport(
  willImport: string[],
  existingIsbns: string[],
  invalidIsbns: string[],
  duplicateIsbns: string[]
): string {
  const lines: string[] = []
  lines.push("Category,ISBN")
  for (const isbn of willImport)
    lines.push(`Will Import,${escapeCsvField(isbn)}`)
  for (const isbn of existingIsbns)
    lines.push(`Skipped - Already in Library,${escapeCsvField(isbn)}`)
  for (const isbn of invalidIsbns)
    lines.push(`Skipped - Invalid Format,${escapeCsvField(isbn)}`)
  for (const isbn of duplicateIsbns)
    lines.push(`Skipped - Duplicate in File,${escapeCsvField(isbn)}`)
  return lines.join("\n")
}

/**
 * Triggers a browser download of text content as a file.
 * @source
 */
function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Returns a human-readable headline for the completion summary.
 * @param addedCount - Number of books successfully imported.
 * @returns Headline string.
 * @source
 */
function completionHeadline(addedCount: number): string {
  if (addedCount === 0) return "No books were imported"
  const plural = addedCount === 1 ? "" : "s"
  return `${addedCount} book${plural} imported!`
}

/* ─── Shared sub-components ─────────────────────────────── */

/**
 * Live elapsed-time counter displayed during an active import.
 * @source
 */
function ElapsedTime({ startTime }: Readonly<{ startTime: number | null }>) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  if (!startTime) return null

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const display = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  return (
    <span className="text-muted-foreground text-xs tabular-nums">
      {display}
    </span>
  )
}

/**
 * Gradient progress bar showing import completion percentage.
 * @source
 */
function ProgressBar({
  processed,
  total
}: Readonly<{ processed: number; total: number }>) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <div className="bg-muted relative h-2.5 flex-1 overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--copper), var(--gold))"
          }}
        />
      </div>
      <span className="text-foreground w-10 text-right text-xs font-semibold tabular-nums">
        {pct}%
      </span>
    </div>
  )
}

/**
 * Single row displaying an ISBN's import status, matched result, and error message.
 * @source
 */
function ImportItemRow({
  item,
  isActive
}: Readonly<{ item: IsbnImportItem; isActive: boolean }>) {
  const config = STATUS_CONFIG[item.status]
  const isProcessing = ACTIVE_STATUSES.has(item.status)
  const showResult = item.result && SHOW_RESULT_STATUSES.has(item.status)

  return (
    <div
      className={`glass-card flex items-center gap-3 rounded-xl p-3 transition-all duration-300 ${
        isActive
          ? "ring-copper/20 shadow-[0_0_20px_var(--warm-glow)] ring-1"
          : ""
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        {isProcessing ? (
          <div className="border-copper h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        ) : (
          <span className="text-sm">{config.icon}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <code
            className={`text-sm font-medium tabular-nums ${
              isProcessing ? "animate-pulse" : ""
            }`}
          >
            {item.isbn}
          </code>
          <span
            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${config.color}`}
          >
            {config.label}
          </span>
        </div>

        {showResult && item.result && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="bg-muted relative h-8 w-6 shrink-0 overflow-hidden rounded">
              <CoverImage
                isbn={item.result.isbn}
                coverImageUrl={item.result.coverUrl}
                alt={item.result.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                fallback={<div className="bg-muted h-full w-full" />}
              />
            </div>
            <div className="min-w-0">
              <p className="text-foreground line-clamp-1 text-xs font-medium">
                {item.result.title}
              </p>
              {item.result.authors.length > 0 && (
                <p className="text-muted-foreground line-clamp-1 text-[11px]">
                  {item.result.authors.join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        {item.status === "error" && item.error && (
          <p className="text-destructive mt-0.5 text-[11px]">{item.error}</p>
        )}
      </div>
    </div>
  )
}

/* ─── ShelfArc import helpers ───────────────────────────── */

/**
 * Builds a map of ISBN → { volumeId, seriesId } from existing library data.
 * @source
 */
function buildVolumeInfoMap(
  seriesList: SeriesWithVolumes[],
  unassigned: Volume[]
): Map<string, { volumeId: string; seriesId: string | null }> {
  const map = new Map<string, { volumeId: string; seriesId: string | null }>()
  for (const s of seriesList) {
    for (const v of s.volumes) {
      if (v.isbn) map.set(v.isbn, { volumeId: v.id, seriesId: s.id })
    }
  }
  for (const v of unassigned) {
    if (v.isbn) map.set(v.isbn, { volumeId: v.id, seriesId: null })
  }
  return map
}

/**
 * Builds an initial series-key → series-id map from existing library data.
 * @source
 */
function buildSeriesKeyMap(
  seriesList: SeriesWithVolumes[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const s of seriesList) {
    map.set(`${s.title.toLowerCase()}|${s.type}`, s.id)
  }
  return map
}

/* ─── ShelfArc phases ───────────────────────────────────── */

/**
 * Parsed-phase UI for ShelfArc full-metadata CSV exports.
 * Shows detected series/volume counts and conflict resolution options.
 * @source
 */
function ShelfArcParsedPhase({
  rows,
  fileName,
  conflictCount,
  seriesConflictCount,
  conflictStrategy,
  onConflictStrategyChange,
  onReset,
  onStartImport
}: Readonly<{
  rows: ShelfArcCsvRow[]
  fileName: string | null
  conflictCount: number
  seriesConflictCount: number
  conflictStrategy: ShelfArcConflictStrategy
  onConflictStrategyChange: (s: ShelfArcConflictStrategy) => void
  onReset: () => void
  onStartImport: () => void
}>) {
  const uniqueSeriesCount = useMemo(() => {
    const seen = new Set<string>()
    for (const row of rows) {
      seen.add(`${row.seriesTitle.toLowerCase()}|${row.seriesType}`)
    }
    return seen.size
  }, [rows])

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* File summary card */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <span className="text-sm font-medium">{fileName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground text-xs"
          >
            Change file
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
            style={{ background: "var(--copper)", color: "white" }}
          >
            ShelfArc Export Detected
          </span>
        </div>

        <p className="mt-3 text-sm">
          Found{" "}
          <span className="text-foreground font-semibold">{rows.length}</span>{" "}
          volume{rows.length === 1 ? "" : "s"} across{" "}
          <span className="text-foreground font-semibold">
            {uniqueSeriesCount}
          </span>{" "}
          unique series
        </p>
      </div>

      {/* Series-level conflict warning */}
      {seriesConflictCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            ⚠ {seriesConflictCount} series with the same title already exist in
            your library and will be merged.
          </p>
        </div>
      )}

      {/* Volume-level conflict resolution */}
      {conflictCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-3 text-sm font-medium text-amber-700 dark:text-amber-400">
            ⚠ {conflictCount} volume{conflictCount === 1 ? "" : "s"} already
            exist in your library
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onConflictStrategyChange("skip")}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                conflictStrategy === "skip"
                  ? "border-copper bg-copper/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-copper/40"
              }`}
            >
              Skip Existing
            </button>
            <button
              type="button"
              onClick={() => onConflictStrategyChange("overwrite")}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                conflictStrategy === "overwrite"
                  ? "border-copper bg-copper/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-copper/40"
              }`}
            >
              Overwrite Existing
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="rounded-xl" onClick={onReset}>
          Cancel
        </Button>
        <Button className="rounded-xl px-6" onClick={onStartImport}>
          Import {rows.length} Volume{rows.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  )
}

/**
 * Importing/complete-phase UI for ShelfArc full-metadata imports.
 * Shows progress, per-category stats, and a completion card.
 * @source
 */
function ShelfArcActivePhase({
  progress,
  stats,
  isComplete,
  onReset
}: Readonly<{
  progress: { current: number; total: number }
  stats: ShelfArcImportStats
  isComplete: boolean
  onReset: () => void
}>) {
  return (
    <div className="animate-fade-in space-y-5">
      {/* Sticky header */}
      <div
        className="glass-card sticky top-0 z-10 space-y-3 rounded-2xl p-5"
        aria-live="polite"
        aria-atomic="true"
      >
        <div>
          <h3 className="font-display text-base font-semibold">
            {isComplete ? "Import Complete" : "Importing…"}
          </h3>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="tabular-nums">
              {progress.current}/{progress.total} processed
            </span>
            {stats.created > 0 && (
              <span className="text-green-600 dark:text-green-400">
                {stats.created} created
              </span>
            )}
            {stats.updated > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                {stats.updated} updated
              </span>
            )}
            {stats.skipped > 0 && (
              <span className="text-muted-foreground">
                {stats.skipped} skipped
              </span>
            )}
            {stats.failed > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {stats.failed} failed
              </span>
            )}
          </div>
        </div>

        <ProgressBar processed={progress.current} total={progress.total} />
      </div>

      {/* Completion card */}
      {isComplete && (
        <div className="animate-fade-in-up flex flex-col items-center gap-4 pt-4 text-center">
          <div className="glass-card w-full max-w-md rounded-2xl p-6">
            <div className="from-copper/20 to-gold/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br shadow-[0_0_30px_var(--warm-glow)]">
              <span className="text-3xl">
                {stats.created > 0 || stats.updated > 0 ? "🎉" : "📋"}
              </span>
            </div>

            <p className="font-display text-lg font-semibold">
              {(() => {
                const total = stats.created + stats.updated
                if (total === 0) return "No volumes were imported"
                const suffix = total === 1 ? "" : "s"
                return `${total} volume${suffix} imported!`
              })()}
            </p>

            <div className="text-muted-foreground mt-2 flex flex-wrap justify-center gap-4 text-sm">
              {stats.created > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  ✓ {stats.created} created
                </span>
              )}
              {stats.updated > 0 && (
                <span className="text-blue-600 dark:text-blue-400">
                  ↺ {stats.updated} updated
                </span>
              )}
              {stats.skipped > 0 && <span>↷ {stats.skipped} skipped</span>}
              {stats.failed > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  ⚠ {stats.failed} failed
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="rounded-xl" onClick={onReset}>
              Import More
            </Button>
            <Link href="/library">
              <Button className="rounded-xl px-6">Go to Library</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Phase: Idle ───────────────────────────────────────── */

/**
 * Idle-phase UI: drag-and-drop zone and file picker for CSV/TSV/TXT upload.
 * @source
 */
function IdlePhase({
  isDragging,
  setIsDragging,
  fileInputRef,
  onDrop,
  onFileChange
}: Readonly<{
  isDragging: boolean
  setIsDragging: (v: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onDrop: (e: React.DragEvent) => void
  onFileChange: (file: File | undefined) => void
}>) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Upload a CSV to import books. ShelfArc export files are fully supported
        and restore all metadata. ISBN-only CSVs are also accepted.
      </p>
      <button
        type="button"
        className={`relative w-full cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          isDragging
            ? "border-copper/60 bg-warm/30 shadow-[0_0_30px_var(--warm-glow)]"
            : "border-border hover:border-copper/30 hover:bg-warm/10"
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => {
            onFileChange(e.target.files?.[0])
            e.currentTarget.value = ""
          }}
        />

        <div className="from-copper/20 to-gold/20 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-copper h-7 w-7"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <p className="font-display text-base font-semibold">
          Drop your CSV file here
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          or click to browse. Supports CSV, TSV, and TXT files with ISBN
          columns.
        </p>
        <p className="text-muted-foreground mt-3 text-xs">
          Columns named <code className="text-foreground">ISBN</code>,{" "}
          <code className="text-foreground">ISBN-10</code>, or{" "}
          <code className="text-foreground">ISBN-13</code> are auto-detected.
          ShelfArc export files are identified automatically.
        </p>
      </button>
    </div>
  )
}

/* ─── Phase: Parsed ─────────────────────────────────────── */

/**
 * Parsed-phase UI: file summary, ISBN preview grid, import options, and start button.
 * @source
 */
function ParsedPhase({
  fileName,
  stats,
  parseMeta,
  items,
  source,
  ownershipStatus,
  onSourceChange,
  onOwnershipChange,
  onReset,
  onStartImport
}: Readonly<{
  fileName: string | null
  stats: CsvImportStats
  parseMeta: CsvParseMeta | null
  items: readonly IsbnImportItem[]
  source: BookSearchSource
  ownershipStatus: OwnershipStatus
  onSourceChange: (v: BookSearchSource) => void
  onOwnershipChange: (v: OwnershipStatus) => void
  onReset: () => void
  onStartImport: () => void
}>) {
  return (
    <div className="animate-fade-in-up space-y-6">
      <ParsedFileSummary
        fileName={fileName}
        stats={stats}
        parseMeta={parseMeta}
        items={items}
        onReset={onReset}
      />

      {stats.total > 0 && <IsbnPreviewGrid items={items} />}

      <ImportOptions
        source={source}
        ownershipStatus={ownershipStatus}
        total={stats.total}
        onSourceChange={onSourceChange}
        onOwnershipChange={onOwnershipChange}
        onReset={onReset}
        onStartImport={onStartImport}
      />

      {stats.total === 0 && (
        <EmptyIsbnNotice existingCount={parseMeta?.existingCount ?? 0} />
      )}
    </div>
  )
}

/**
 * Summary card showing detected columns, valid ISBN count, and skip notices.
 * @source
 */
function ParsedFileSummary({
  fileName,
  stats,
  parseMeta,
  items,
  onReset
}: Readonly<{
  fileName: string | null
  stats: CsvImportStats
  parseMeta: CsvParseMeta | null
  items: readonly IsbnImportItem[]
  onReset: () => void
}>) {
  const invalidLabel = (() => {
    if (!parseMeta || parseMeta.invalidCount === 0) return null
    const suffix = parseMeta.invalidCount === 1 ? "" : "s"
    return `Skipped ${parseMeta.invalidCount} invalid ISBN${suffix}`
  })()

  const duplicateLabel = (() => {
    if (!parseMeta || parseMeta.duplicateCount === 0) return null
    const suffix = parseMeta.duplicateCount === 1 ? "" : "s"
    return `${parseMeta.duplicateCount} duplicate${suffix}`
  })()

  const existingLabel = (() => {
    if (!parseMeta || parseMeta.existingCount === 0) return null
    return `${parseMeta.existingCount} already in your library`
  })()

  const notices = [invalidLabel, duplicateLabel, existingLabel].filter(
    (value): value is string => Boolean(value)
  )

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📄</span>
          <span className="text-sm font-medium">{fileName}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-muted-foreground text-xs"
        >
          Change file
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm">
          Found{" "}
          <span className="text-foreground font-semibold">{stats.total}</span>{" "}
          valid ISBN{stats.total === 1 ? "" : "s"} from column
          {parseMeta && parseMeta.detectedColumns.length > 1 ? "s" : ""}{" "}
          {parseMeta?.detectedColumns.map((col) => (
            <Badge key={col} variant="secondary" className="mx-0.5 text-xs">
              {col}
            </Badge>
          ))}
        </p>

        {notices.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {notices.map((text, index) => (
              <span key={`${text}-${index}`}>
                {index > 0 && ", "}
                {text}
              </span>
            ))}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-2 gap-1.5 rounded-xl text-xs"
          onClick={() => {
            const willImport = items.map((item) => item.isbn)
            const report = generateReconciliationReport(
              willImport,
              parseMeta?.existingIsbns ?? [],
              parseMeta?.invalidIsbns ?? [],
              parseMeta?.duplicateIsbns ?? []
            )
            downloadCsv(report, "reconciliation-report.csv")
          }}
        >
          <HugeiconsIcon
            icon={FileDownloadIcon}
            className="h-3.5 w-3.5"
            strokeWidth={2}
          />
          Download reconciliation report
        </Button>
      </div>
    </div>
  )
}

/**
 * Scrollable grid previewing the ISBNs about to be imported.
 * @source
 */
function IsbnPreviewGrid({
  items
}: Readonly<{ items: readonly IsbnImportItem[] }>) {
  return (
    <div className="bg-muted/30 rounded-xl border p-4">
      <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
        ISBNs to import
      </p>
      <ScrollArea className="max-h-48">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <code
              key={item.isbn}
              className="text-muted-foreground bg-background/60 rounded px-2 py-1 text-xs tabular-nums"
            >
              {item.isbn}
            </code>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * Search-source and ownership-status selectors with start/cancel actions.
 * @source
 */
function ImportOptions({
  source,
  ownershipStatus,
  total,
  onSourceChange,
  onOwnershipChange,
  onReset,
  onStartImport
}: Readonly<{
  source: BookSearchSource
  ownershipStatus: OwnershipStatus
  total: number
  onSourceChange: (v: BookSearchSource) => void
  onOwnershipChange: (v: OwnershipStatus) => void
  onReset: () => void
  onStartImport: () => void
}>) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">
            Search source
          </Label>
          <Tabs
            value={source}
            onValueChange={(v) => onSourceChange(v as BookSearchSource)}
          >
            <TabsList className="h-9 rounded-xl">
              <TabsTrigger value="google_books">Google Books</TabsTrigger>
              <TabsTrigger value="open_library">Open Library</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">
            Add as
          </Label>
          <Select
            value={ownershipStatus}
            onValueChange={(v) => onOwnershipChange(v as OwnershipStatus)}
          >
            <SelectTrigger className="h-9 w-32 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owned">Owned</SelectItem>
              <SelectItem value="wishlist">Wishlist</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="rounded-xl" onClick={onReset}>
          Cancel
        </Button>
        <Button
          className="rounded-xl px-6"
          onClick={onStartImport}
          disabled={total === 0}
        >
          Start Import ({total} ISBN{total === 1 ? "" : "s"})
        </Button>
      </div>
    </div>
  )
}

/**
 * Empty-state notice shown when no importable ISBNs are found in the file.
 * @source
 */
function EmptyIsbnNotice({
  existingCount
}: Readonly<{ existingCount: number }>) {
  const hasExisting = existingCount > 0
  let subtitle =
    "Make sure your CSV has a column named ISBN, ISBN-10, or ISBN-13."

  if (hasExisting) {
    const suffix = existingCount === 1 ? "" : "s"
    subtitle = `Skipped ${existingCount} ISBN${suffix} that already exist in your library.`
  }

  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="from-copper/20 to-gold/20 mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br">
        <span className="text-xl">🔍</span>
      </div>
      <p className="font-display font-semibold">
        {hasExisting
          ? "All ISBNs are already in your library"
          : "No valid ISBNs found"}
      </p>
      <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
    </div>
  )
}

/* ─── Phase: Importing / Complete ───────────────────────── */

/**
 * Importing/complete-phase UI: live progress bar, scrolling item list, and completion summary.
 * @source
 */
function ActivePhase({
  phase,
  items,
  stats,
  startTime,
  activeIndex,
  scrollViewportRef,
  onCancel,
  onReset
}: Readonly<{
  phase: CsvImportPhase
  items: readonly IsbnImportItem[]
  stats: CsvImportStats
  startTime: number | null
  activeIndex: number
  scrollViewportRef: React.RefObject<HTMLDivElement | null>
  onCancel: () => void
  onReset: () => void
}>) {
  return (
    <div className="animate-fade-in space-y-5">
      <ActivePhaseHeader
        phase={phase}
        stats={stats}
        startTime={startTime}
        onCancel={onCancel}
      />

      <ScrollArea className="max-h-[50vh]" viewportRef={scrollViewportRef}>
        <div className="space-y-2 pb-2">
          {items.map((item, index) => (
            <div
              key={item.isbn}
              data-import-row
              className="animate-fade-in"
              style={{
                animationDelay: `${Math.min(index * 30, 300)}ms`
              }}
            >
              <ImportItemRow item={item} isActive={index === activeIndex} />
            </div>
          ))}
        </div>
      </ScrollArea>

      {phase === "complete" && (
        <CompletionSummary stats={stats} onReset={onReset} />
      )}
    </div>
  )
}

/**
 * Sticky header with progress bar and cancel button shown during the active import phase.
 * @source
 */
function ActivePhaseHeader({
  phase,
  stats,
  startTime,
  onCancel
}: Readonly<{
  phase: CsvImportPhase
  stats: CsvImportStats
  startTime: number | null
  onCancel: () => void
}>) {
  return (
    <div
      className="glass-card sticky top-0 z-10 space-y-3 rounded-2xl p-5"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">
            {phase === "complete" ? "Import Complete" : "Importing…"}
          </h3>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="tabular-nums">
              {stats.processed}/{stats.total} processed
            </span>
            {stats.added > 0 && (
              <span className="text-green-600 dark:text-green-400">
                {stats.added} imported
              </span>
            )}
            {stats.notFound > 0 && <span>{stats.notFound} not found</span>}
            {stats.errors > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {stats.errors} error{stats.errors === 1 ? "" : "s"}
              </span>
            )}
            <ElapsedTime startTime={startTime} />
          </div>
        </div>

        {phase === "importing" && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>

      <ProgressBar processed={stats.processed} total={stats.total} />
    </div>
  )
}

/**
 * Summary card with confetti icon and final counts, plus navigation buttons.
 * @source
 */
function CompletionSummary({
  stats,
  onReset
}: Readonly<{ stats: CsvImportStats; onReset: () => void }>) {
  return (
    <div className="animate-fade-in-up flex flex-col items-center gap-4 pt-4 text-center">
      <div className="glass-card w-full max-w-md rounded-2xl p-6">
        <div className="from-copper/20 to-gold/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br shadow-[0_0_30px_var(--warm-glow)]">
          <span className="text-3xl">{stats.added > 0 ? "🎉" : "📋"}</span>
        </div>

        <p className="font-display text-lg font-semibold">
          {completionHeadline(stats.added)}
        </p>

        <div className="text-muted-foreground mt-2 flex justify-center gap-4 text-sm">
          {stats.added > 0 && (
            <span className="text-green-600 dark:text-green-400">
              ✓ {stats.added} imported
            </span>
          )}
          {stats.notFound > 0 && <span>✗ {stats.notFound} not found</span>}
          {stats.errors > 0 && (
            <span className="text-red-600 dark:text-red-400">
              ⚠ {stats.errors} error{stats.errors === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="rounded-xl" onClick={onReset}>
          Import More
        </Button>
        <Link href="/library">
          <Button className="rounded-xl px-6">Go to Library</Button>
        </Link>
      </div>
    </div>
  )
}

/* ─── Main component ────────────────────────────────────── */

/**
 * Multi-phase CSV import wizard: file upload, ISBN preview, live import progress, and completion summary.
 * @source
 */
export function CsvImport() {
  const defaultSearchSource = useSettingsStore((s) => s.defaultSearchSource)
  const defaultOwnershipStatus = useSettingsStore(
    (s) => s.defaultOwnershipStatus
  )
  const {
    addBooksFromSearchResults,
    createSeries,
    createVolume,
    editVolume,
    fetchSeries,
    series,
    unassignedVolumes,
    isLoading
  } = useLibrary()

  const existingIsbns = useMemo(() => {
    const next = new Set<string>()

    const addIsbn = (value?: string | null) => {
      if (!value) return
      const normalized = normalizeIsbn(value)
      if (!normalized || !isValidIsbn(normalized)) return
      next.add(normalized)
    }

    for (const seriesItem of series) {
      for (const volume of seriesItem.volumes) {
        addIsbn(volume.isbn)
      }
    }

    for (const volume of unassignedVolumes) {
      addIsbn(volume.isbn)
    }

    return next
  }, [series, unassignedVolumes])

  const {
    phase,
    items,
    stats,
    parseMeta,
    fileName,
    startTime,
    parseFile,
    startImport,
    cancelImport,
    reset,
    restoreState
  } = useCsvImport({ existingIsbns })

  const [source, setSource] = useState<BookSearchSource>(defaultSearchSource)
  const [ownershipStatus, setOwnershipStatus] = useState<OwnershipStatus>(
    defaultOwnershipStatus
  )
  const [isDragging, setIsDragging] = useState(false)
  const [shelfArcRows, setShelfArcRows] = useState<ShelfArcCsvRow[] | null>(
    null
  )
  const [shelfArcFileName, setShelfArcFileName] = useState<string | null>(null)
  const [shelfArcPhase, setShelfArcPhase] = useState<
    "parsed" | "importing" | "complete" | null
  >(null)
  const [shelfArcConflictStrategy, setShelfArcConflictStrategy] =
    useState<ShelfArcConflictStrategy>("skip")
  const [shelfArcProgress, setShelfArcProgress] = useState({
    current: 0,
    total: 0
  })
  const [shelfArcStats, setShelfArcStats] = useState<ShelfArcImportStats>({
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  })
  const [savedProgress, setSavedProgress] = useState<{
    items: IsbnImportItem[]
    fileName: string | null
    source: BookSearchSource
    ownershipStatus: OwnershipStatus
    processed: number
    total: number
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem(IMPORT_STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as {
        items: IsbnImportItem[]
        fileName: string | null
        source: BookSearchSource
        ownershipStatus: OwnershipStatus
      }
      if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null
      const processed = parsed.items.filter(
        (i) =>
          i.status === "added" ||
          i.status === "not-found" ||
          i.status === "error"
      ).length
      return { ...parsed, processed, total: parsed.items.length }
    } catch {
      sessionStorage.removeItem(IMPORT_STORAGE_KEY)
      return null
    }
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const lastAnnouncedImport = useRef(0)
  const csvImportLogged = useRef(false)

  const { announce } = useLiveAnnouncer()

  const activeIndex = items.findIndex((item) =>
    ACTIVE_STATUSES.has(item.status)
  )

  const shelfArcConflictCount = useMemo(() => {
    if (!shelfArcRows) return 0
    let count = 0
    for (const row of shelfArcRows) {
      if (row.isbn && existingIsbns.has(row.isbn)) count++
    }
    return count
  }, [shelfArcRows, existingIsbns])

  const shelfArcSeriesConflictCount = useMemo(() => {
    if (!shelfArcRows) return 0
    const existingKeys = new Set(
      series.map((s) => `${s.title.toLowerCase()}|${s.type}`)
    )
    const seen = new Set<string>()
    let count = 0
    for (const row of shelfArcRows) {
      const key = `${row.seriesTitle.toLowerCase()}|${row.seriesType}`
      if (!seen.has(key) && existingKeys.has(key)) {
        seen.add(key)
        count++
      }
    }
    return count
  }, [shelfArcRows, series])

  // ── SessionStorage: persist during import ──
  useEffect(() => {
    if (phase !== "importing") return
    try {
      sessionStorage.setItem(
        IMPORT_STORAGE_KEY,
        JSON.stringify({
          items: items.map(({ isbn, status, error }) => ({
            isbn,
            status,
            error
          })),
          fileName,
          source,
          ownershipStatus
        })
      )
    } catch {
      // sessionStorage full or unavailable — ignore
    }
  }, [phase, items, fileName, source, ownershipStatus])

  // ── SessionStorage: clear on complete or reset ──
  useEffect(() => {
    if (phase === "complete") {
      sessionStorage.removeItem(IMPORT_STORAGE_KEY)
    }
  }, [phase])

  const handleResumeImport = useCallback(() => {
    if (!savedProgress) return
    setSource(savedProgress.source)
    setOwnershipStatus(savedProgress.ownershipStatus)
    restoreState({
      items: savedProgress.items,
      fileName: savedProgress.fileName
    })
    setSavedProgress(null)
  }, [savedProgress, restoreState])

  const handleDismissResume = useCallback(() => {
    sessionStorage.removeItem(IMPORT_STORAGE_KEY)
    setSavedProgress(null)
  }, [])

  useEffect(() => {
    if (phase === "parsed" && parseMeta) {
      const validCount = stats.total
      announce(`CSV parsed. ${validCount} valid ISBNs found.`)
    }
  }, [phase, parseMeta, stats.total, announce])

  useEffect(() => {
    if (phase !== "importing" && phase !== "complete") return

    if (phase === "complete") {
      announce(
        `Import complete. ${stats.added} books added, ${stats.notFound} not found, ${stats.errors} errors.`
      )
      lastAnnouncedImport.current = 0
      return
    }

    // Announce every 5 items during import
    if (
      stats.processed > 0 &&
      stats.processed - lastAnnouncedImport.current >= 5
    ) {
      announce(`${stats.processed} of ${stats.total} ISBNs processed.`)
      lastAnnouncedImport.current = stats.processed
    }
  }, [phase, stats, announce])

  useEffect(() => {
    if (phase === "complete" && !csvImportLogged.current) {
      csvImportLogged.current = true
      void logImportEvent("csv-isbn", {
        seriesAdded: 0,
        volumesAdded: stats.added,
        errors: stats.errors
      })
    }
    if (phase === "idle") {
      csvImportLogged.current = false
    }
  }, [phase, stats.added, stats.errors])

  useEffect(() => {
    if (isLoading) return
    if (series.length === 0 && unassignedVolumes.length === 0) {
      void fetchSeries()
    }
  }, [series.length, unassignedVolumes.length, isLoading, fetchSeries])

  useEffect(() => {
    if (activeIndex < 0 || !scrollViewportRef.current) return
    const container = scrollViewportRef.current
    const rows = container.querySelectorAll("[data-import-row]")
    const activeRow = rows[activeIndex] as HTMLElement | undefined
    activeRow?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [activeIndex])

  useEffect(() => {
    if (phase === "complete" && stats.added > 0) {
      void fetchSeries()
    }
  }, [phase, stats.added, fetchSeries])

  const handleFileChange = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      const ext = file.name.toLowerCase()
      const isValid =
        ext.endsWith(".csv") || ext.endsWith(".tsv") || ext.endsWith(".txt")
      if (!isValid) {
        const fileExt = file.name.split(".").pop() ?? "unknown"
        toast.error(`Expected a .csv, .tsv, or .txt file, got .${fileExt}`)
        return
      }

      // Try ShelfArc full-metadata format first
      const text = await file.text()
      const shelfArcResult = parseShelfArcCsv(text)
      if (shelfArcResult.length > 0) {
        setShelfArcRows(shelfArcResult)
        setShelfArcFileName(file.name)
        setShelfArcPhase("parsed")
        return
      }

      // Fall back to ISBN-based import
      void parseFile(file)
    },
    [parseFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      void handleFileChange(e.dataTransfer.files[0])
    },
    [handleFileChange]
  )

  const handleStartImport = useCallback(() => {
    void startImport({
      source,
      ownershipStatus,
      addBooks: addBooksFromSearchResults
    })
  }, [source, ownershipStatus, addBooksFromSearchResults, startImport])

  const handleShelfArcReset = useCallback(() => {
    setShelfArcRows(null)
    setShelfArcFileName(null)
    setShelfArcPhase(null)
    setShelfArcStats({ created: 0, updated: 0, skipped: 0, failed: 0 })
    setShelfArcProgress({ current: 0, total: 0 })
    setShelfArcConflictStrategy("skip")
  }, [])

  /**
   * Processes a single ShelfArc CSV row: finds/creates the parent series,
   * then creates or overwrites the volume. Mutates seriesKeyToId in place.
   */
  const processShelfArcRow = useCallback(
    async (
      row: ShelfArcCsvRow,
      existingIsbnToVolumeInfo: Map<
        string,
        { volumeId: string; seriesId: string | null }
      >,
      seriesKeyToId: Map<string, string>,
      conflictStrategy: ShelfArcConflictStrategy
    ): Promise<"created" | "updated" | "skipped"> => {
      const existingVolumeInfo = row.isbn
        ? existingIsbnToVolumeInfo.get(row.isbn)
        : undefined
      const isConflict = Boolean(existingVolumeInfo)

      if (isConflict && conflictStrategy === "skip") return "skipped"

      // Find or create the parent series
      const seriesKey = `${row.seriesTitle.toLowerCase()}|${row.seriesType}`
      let targetSeriesId = seriesKeyToId.get(seriesKey)
      if (!targetSeriesId) {
        const newSeries = await createSeries({
          title: row.seriesTitle,
          author: row.author || null,
          publisher: row.publisher || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: row.seriesType as any,
          tags: []
        })
        targetSeriesId = newSeries.id
        seriesKeyToId.set(seriesKey, targetSeriesId)
      }

      const volumeData = {
        volume_number: row.volumeNumber,
        title: row.volumeTitle ?? null,
        description: row.volumeDescription ?? null,
        isbn: row.isbn,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edition: row.edition as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        format: row.format as any,
        ownership_status: row.ownershipStatus,
        reading_status: row.readingStatus,
        page_count: row.pageCount,
        rating: row.rating,
        publish_date: row.publishDate,
        purchase_date: row.purchaseDate,
        purchase_price: row.purchasePrice,
        notes: row.notes
      }

      if (
        isConflict &&
        existingVolumeInfo &&
        conflictStrategy === "overwrite"
      ) {
        await editVolume(
          existingVolumeInfo.seriesId,
          existingVolumeInfo.volumeId,
          volumeData
        )
        return "updated"
      }

      await createVolume(targetSeriesId, volumeData)
      return "created"
    },
    [createSeries, createVolume, editVolume]
  )

  const handleShelfArcImport = useCallback(async () => {
    if (!shelfArcRows?.length) return

    setShelfArcPhase("importing")
    setShelfArcProgress({ current: 0, total: shelfArcRows.length })

    const runningStats: ShelfArcImportStats = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    }

    const existingIsbnToVolumeInfo = buildVolumeInfoMap(
      series,
      unassignedVolumes
    )
    const seriesKeyToId = buildSeriesKeyMap(series)

    for (let i = 0; i < shelfArcRows.length; i++) {
      const row = shelfArcRows[i]
      try {
        const outcome = await processShelfArcRow(
          row,
          existingIsbnToVolumeInfo,
          seriesKeyToId,
          shelfArcConflictStrategy
        )
        runningStats[outcome]++
      } catch (err) {
        console.error("ShelfArc import row failed", row, err)
        runningStats.failed++
      }
      setShelfArcProgress({ current: i + 1, total: shelfArcRows.length })
      setShelfArcStats({ ...runningStats })
    }

    setShelfArcPhase("complete")
    await fetchSeries()

    void logImportEvent("csv-shelfarc", {
      seriesAdded: 0,
      volumesAdded: runningStats.created + runningStats.updated,
      errors: runningStats.failed
    })

    const statEntries: Array<[number, string]> = [
      [runningStats.created, "created"],
      [runningStats.updated, "updated"],
      [runningStats.skipped, "skipped"],
      [runningStats.failed, "failed"]
    ]
    const parts = statEntries
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}`)
    toast.success(`Import complete: ${parts.join(", ")}`)
  }, [
    shelfArcRows,
    shelfArcConflictStrategy,
    processShelfArcRow,
    fetchSeries,
    series,
    unassignedVolumes
  ])

  const handleReset = useCallback(() => {
    sessionStorage.removeItem(IMPORT_STORAGE_KEY)
    reset()
  }, [reset])

  // ShelfArc full-metadata import phases
  if (shelfArcPhase === "parsed" && shelfArcRows) {
    return (
      <ShelfArcParsedPhase
        rows={shelfArcRows}
        fileName={shelfArcFileName}
        conflictCount={shelfArcConflictCount}
        seriesConflictCount={shelfArcSeriesConflictCount}
        conflictStrategy={shelfArcConflictStrategy}
        onConflictStrategyChange={setShelfArcConflictStrategy}
        onReset={handleShelfArcReset}
        onStartImport={() => {
          void handleShelfArcImport()
        }}
      />
    )
  }
  if (shelfArcPhase === "importing" || shelfArcPhase === "complete") {
    return (
      <ShelfArcActivePhase
        progress={shelfArcProgress}
        stats={shelfArcStats}
        isComplete={shelfArcPhase === "complete"}
        onReset={handleShelfArcReset}
      />
    )
  }

  if (savedProgress && phase === "idle") {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="from-copper/20 to-gold/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br">
              <span className="text-lg">📋</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold">
                Resume previous import?
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {savedProgress.processed} of {savedProgress.total} ISBNs were
                processed
                {savedProgress.fileName
                  ? ` from ${savedProgress.fileName}`
                  : ""}
                . You can resume where you left off.
              </p>
              <div className="mt-3 flex gap-3">
                <Button
                  className="rounded-xl px-5"
                  onClick={handleResumeImport}
                >
                  Resume Import
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={handleDismissResume}
                >
                  Discard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "idle") {
    return (
      <IdlePhase
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        fileInputRef={fileInputRef}
        onDrop={handleDrop}
        onFileChange={handleFileChange}
      />
    )
  }

  if (phase === "parsed") {
    return (
      <ParsedPhase
        fileName={fileName}
        stats={stats}
        parseMeta={parseMeta}
        items={items}
        source={source}
        ownershipStatus={ownershipStatus}
        onSourceChange={setSource}
        onOwnershipChange={setOwnershipStatus}
        onReset={handleReset}
        onStartImport={handleStartImport}
      />
    )
  }

  return (
    <ActivePhase
      phase={phase}
      items={items}
      stats={stats}
      startTime={startTime}
      activeIndex={activeIndex}
      scrollViewportRef={scrollViewportRef}
      onCancel={cancelImport}
      onReset={handleReset}
    />
  )
}
