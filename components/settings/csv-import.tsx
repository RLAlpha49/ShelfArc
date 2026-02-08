"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
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
import { CoverImage } from "@/components/library/cover-image"
import { useCsvImport } from "@/lib/csv/use-csv-import"
import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"
import { useLibrary } from "@/lib/hooks/use-library"
import { useSettingsStore } from "@/lib/store/settings-store"
import type { BookSearchSource } from "@/lib/books/search"
import type {
  CsvImportPhase,
  CsvImportStats,
  CsvParseMeta,
  IsbnImportItem,
  IsbnImportStatus
} from "@/lib/csv/types"
import type { OwnershipStatus } from "@/lib/types/database"

/* ─── Constants ─────────────────────────────────────────── */

const ACCEPTED_EXTENSIONS = ".csv,.tsv,.txt"

const ACTIVE_STATUSES = new Set<IsbnImportStatus>([
  "searching",
  "fallback",
  "adding"
])

const SHOW_RESULT_STATUSES = new Set<IsbnImportStatus>([
  "added",
  "adding",
  "found"
])

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
    label: "Adding…",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    icon: "📥"
  },
  added: {
    label: "Added",
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

function completionHeadline(addedCount: number): string {
  if (addedCount === 0) return "No books were imported"
  const plural = addedCount === 1 ? "" : "s"
  return `${addedCount} book${plural} imported!`
}

/* ─── Shared sub-components ─────────────────────────────── */

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

/* ─── Phase: Idle ───────────────────────────────────────── */

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
        </p>
      </button>
    </div>
  )
}

/* ─── Phase: Parsed ─────────────────────────────────────── */

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

function ParsedFileSummary({
  fileName,
  stats,
  parseMeta,
  onReset
}: Readonly<{
  fileName: string | null
  stats: CsvImportStats
  parseMeta: CsvParseMeta | null
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
      </div>
    </div>
  )
}

function IsbnPreviewGrid({
  items
}: Readonly<{ items: readonly IsbnImportItem[] }>) {
  return (
    <div className="bg-muted/30 rounded-xl border p-4">
      <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
        ISBNs to import
      </p>
      {/* FIXME: Scrolling does not work */}
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
    <div className="glass-card sticky top-0 z-10 space-y-3 rounded-2xl p-5">
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
                {stats.added} added
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
              ✓ {stats.added} added
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

export function CsvImport() {
  const defaultSearchSource = useSettingsStore((s) => s.defaultSearchSource)
  const defaultOwnershipStatus = useSettingsStore(
    (s) => s.defaultOwnershipStatus
  )
  const {
    addBooksFromSearchResults,
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
    reset
  } = useCsvImport({ existingIsbns })

  const [source, setSource] = useState<BookSearchSource>(defaultSearchSource)
  const [ownershipStatus, setOwnershipStatus] = useState<OwnershipStatus>(
    defaultOwnershipStatus
  )
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)

  const activeIndex = items.findIndex((item) =>
    ACTIVE_STATUSES.has(item.status)
  )

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
    (file: File | undefined) => {
      if (!file) return
      const ext = file.name.toLowerCase()
      const isValid =
        ext.endsWith(".csv") || ext.endsWith(".tsv") || ext.endsWith(".txt")
      if (isValid) void parseFile(file)
    },
    [parseFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFileChange(e.dataTransfer.files[0])
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
        onReset={reset}
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
      onReset={reset}
    />
  )
}
