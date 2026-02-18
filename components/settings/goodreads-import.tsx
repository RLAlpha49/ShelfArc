"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useLibrary } from "@/lib/hooks/use-library"
import { sanitizePlainText } from "@/lib/sanitize-html"
import { searchBooks } from "@/lib/api/endpoints"
import { toast } from "sonner"
import type { ReadingStatus, OwnershipStatus } from "@/lib/types/database"

/* ─── Types ─────────────────────────────────────────────── */

interface GoodreadsEntry {
  title: string
  author: string
  isbn: string | null
  isbn13: string | null
  rating: number | null
  status: ReadingStatus
  dateRead: string | null
  dateAdded: string | null
  shelf: string
}

type GoodreadsImportPhase = "idle" | "parsed" | "importing" | "complete"

/* ─── Goodreads Status Mapping ──────────────────────────── */

const GOODREADS_SHELF_MAP: Record<string, ReadingStatus> = {
  read: "completed",
  "currently-reading": "reading",
  "to-read": "unread"
}

function mapGoodreadsShelf(shelf: string): ReadingStatus {
  const normalized = shelf.trim().toLowerCase()
  return GOODREADS_SHELF_MAP[normalized] ?? "unread"
}

/* ─── CSV Parsing ───────────────────────────────────────── */

function cleanIsbn(raw: string): string | null {
  // Goodreads wraps ISBNs in ="..." format
  const cleaned = raw.replace(/^="/, "").replace(/"$/, "").trim()
  return cleaned.length > 0 ? cleaned : null
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      fields.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function parseGoodreadsCsvRow(
  headers: string[],
  values: string[]
): GoodreadsEntry | null {
  const get = (name: string): string => {
    const idx = headers.findIndex(
      (h) => h.toLowerCase().trim() === name.toLowerCase()
    )
    return idx >= 0 ? (values[idx]?.trim() ?? "") : ""
  }

  const title = get("Title")
  if (!title) return null

  const author = get("Author") || get("Author l-f")
  const isbn = cleanIsbn(get("ISBN"))
  const isbn13 = cleanIsbn(get("ISBN13"))
  const ratingRaw = Number.parseInt(get("My Rating"), 10)
  // Goodreads uses 1-5 scale, ShelfArc uses 1-10
  const rating = ratingRaw > 0 ? ratingRaw * 2 : null
  const shelf = get("Exclusive Shelf") || get("Bookshelves") || "to-read"
  const dateRead = get("Date Read") || null
  const dateAdded = get("Date Added") || null

  return {
    title: sanitizePlainText(title, 500),
    author: sanitizePlainText(author, 500),
    isbn,
    isbn13,
    rating,
    status: mapGoodreadsShelf(shelf),
    dateRead,
    dateAdded,
    shelf
  }
}

function parseGoodreadsCsv(content: string): GoodreadsEntry[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new Error("CSV file appears empty. Expected Goodreads export format.")
  }

  const headers = parseCsvLine(lines[0])
  const titleIdx = headers.findIndex((h) => h.toLowerCase().trim() === "title")
  if (titleIdx < 0) {
    throw new Error("Missing 'Title' column. Is this a Goodreads CSV export?")
  }

  const entries: GoodreadsEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const entry = parseGoodreadsCsvRow(headers, values)
    if (entry) entries.push(entry)
  }

  return entries
}

/* ─── Status badge helper ───────────────────────────────── */

const STATUS_COLORS: Record<ReadingStatus, string> = {
  reading: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  completed: "bg-green-500/10 text-green-700 dark:text-green-400",
  on_hold: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  dropped: "bg-red-500/10 text-red-700 dark:text-red-400",
  unread: "bg-muted text-muted-foreground"
}

const STATUS_LABELS: Record<ReadingStatus, string> = {
  reading: "Reading",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
  unread: "To Read"
}

/* ─── Component ─────────────────────────────────────────── */

export function GoodreadsImport() {
  const { createSeries, createVolume, addBookFromSearchResult, fetchSeries } =
    useLibrary()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<GoodreadsImportPhase>("idle")
  const [entries, setEntries] = useState<GoodreadsEntry[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [importStats, setImportStats] = useState({
    added: 0,
    notFound: 0,
    errors: 0
  })
  const [ownershipStatus, setOwnershipStatus] =
    useState<OwnershipStatus>("owned")
  const [searchCovers, setSearchCovers] = useState(true)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please select a CSV file exported from Goodreads.")
        return
      }

      try {
        const text = await file.text()
        const parsed = parseGoodreadsCsv(text)
        if (parsed.length === 0) {
          toast.error("No book entries found in this CSV.")
          return
        }
        setEntries(parsed)
        setFileName(file.name)
        setPhase("parsed")
        toast.success(`Parsed ${parsed.length} books from Goodreads export.`)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to parse the CSV file."
        )
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    []
  )

  const createDirectEntry = useCallback(
    async (entry: GoodreadsEntry) => {
      const series = await createSeries({
        title: entry.title,
        author: entry.author || null,
        type: "other",
        tags: []
      })

      await createVolume(series.id, {
        volume_number: 1,
        title: entry.title,
        isbn: entry.isbn13 ?? entry.isbn ?? null,
        ownership_status: ownershipStatus,
        reading_status: entry.status,
        rating: entry.rating
      })
    },
    [createSeries, createVolume, ownershipStatus]
  )

  const importEntryWithSearch = useCallback(
    async (entry: GoodreadsEntry): Promise<void> => {
      const isbn = entry.isbn13 ?? entry.isbn
      if (!isbn || !searchCovers) {
        await createDirectEntry(entry)
        return
      }

      // Search Google Books for cover + metadata
      try {
        const results = await searchBooks({
          q: isbn,
          source: "google_books",
          limit: 3
        })
        const books = results.data ?? []
        if (books.length > 0) {
          await addBookFromSearchResult(books[0], { ownershipStatus })
          return
        }
      } catch {
        // Fallback to direct creation
      }

      await createDirectEntry(entry)
    },
    [searchCovers, ownershipStatus, addBookFromSearchResult, createDirectEntry]
  )

  const handleImport = useCallback(async () => {
    if (entries.length === 0) return

    setPhase("importing")
    setProgress({ current: 0, total: entries.length })
    let added = 0
    let errors = 0

    for (let i = 0; i < entries.length; i++) {
      try {
        await importEntryWithSearch(entries[i])
        added++
      } catch {
        errors++
      }

      setProgress({ current: i + 1, total: entries.length })
      setImportStats({ added, notFound: 0, errors })
    }

    setPhase("complete")
    await fetchSeries()
    const failSuffix = errors > 0 ? `, ${errors} failed` : ""
    toast.success(`Import complete: ${added} books added${failSuffix}`)
  }, [entries, importEntryWithSearch, fetchSeries])

  const reset = useCallback(() => {
    setPhase("idle")
    setEntries([])
    setFileName(null)
    setProgress({ current: 0, total: 0 })
    setImportStats({ added: 0, notFound: 0, errors: 0 })
  }, [])

  if (phase === "idle") {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Import your library from Goodreads. Go to &quot;My Books&quot; on
          Goodreads, click &quot;Import and export&quot; in the left sidebar,
          then click &quot;Export Library&quot; to get a CSV file.
        </p>

        <div className="space-y-3">
          <button
            type="button"
            className="border-border hover:border-copper/30 hover:bg-warm/10 relative w-full cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="from-copper/20 to-gold/20 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br">
              <span className="text-2xl">📚</span>
            </div>
            <p className="font-display text-base font-semibold">
              Drop your Goodreads CSV export here
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              or click to browse. Accepts .csv files from Goodreads library
              export.
            </p>
          </button>
        </div>
      </div>
    )
  }

  if (phase === "parsed") {
    const withIsbn = entries.filter((e) => e.isbn || e.isbn13).length
    const withoutIsbn = entries.length - withIsbn

    return (
      <div className="animate-fade-in-up space-y-6">
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📄</span>
              <span className="text-sm font-medium">{fileName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="text-muted-foreground text-xs"
            >
              Change file
            </Button>
          </div>
          <p className="text-sm">
            Found{" "}
            <span className="text-foreground font-semibold">
              {entries.length}
            </span>{" "}
            books ({withIsbn} with ISBN, {withoutIsbn} without)
          </p>
        </div>

        <div className="bg-muted/30 rounded-xl border p-4">
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            Preview
          </p>
          <ScrollArea className="max-h-60">
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <div
                  key={`${entry.title}-${String(i)}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.title}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {entry.author || "Unknown author"}
                      {(entry.isbn13 ?? entry.isbn)
                        ? ` · ${entry.isbn13 ?? entry.isbn}`
                        : ""}
                      {entry.rating ? ` · ★ ${entry.rating}/10` : ""}
                    </p>
                  </div>
                  <Badge
                    className={`ml-2 shrink-0 text-[10px] ${STATUS_COLORS[entry.status]}`}
                  >
                    {STATUS_LABELS[entry.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs font-medium">
                  Add as
                </span>
                <Select
                  value={ownershipStatus}
                  onValueChange={(v) =>
                    setOwnershipStatus(v as OwnershipStatus)
                  }
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
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="search-covers"
              checked={searchCovers}
              onCheckedChange={(v) => setSearchCovers(Boolean(v))}
            />
            <Label
              htmlFor="search-covers"
              className="cursor-pointer text-sm font-medium"
            >
              Search Google Books for cover images
            </Label>
            <span className="text-muted-foreground text-xs">(slower)</span>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="rounded-xl" onClick={reset}>
              Cancel
            </Button>
            <Button className="rounded-xl px-6" onClick={handleImport}>
              Import {entries.length} Books
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Importing / Complete
  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <div className="animate-fade-in space-y-5">
      <div className="glass-card rounded-2xl p-5" aria-live="polite">
        <h3 className="font-display text-base font-semibold">
          {phase === "complete" ? "Import Complete" : "Importing…"}
        </h3>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="tabular-nums">
            {progress.current}/{progress.total} processed
          </span>
          {importStats.added > 0 && (
            <span className="text-green-600 dark:text-green-400">
              {importStats.added} imported
            </span>
          )}
          {importStats.notFound > 0 && (
            <span>{importStats.notFound} not found</span>
          )}
          {importStats.errors > 0 && (
            <span className="text-red-600 dark:text-red-400">
              {importStats.errors} error
              {importStats.errors === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
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
      </div>

      {phase === "complete" && (
        <div className="animate-fade-in-up flex flex-col items-center gap-4 pt-4 text-center">
          <div className="glass-card w-full max-w-md rounded-2xl p-6">
            <div className="from-copper/20 to-gold/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br shadow-[0_0_30px_var(--warm-glow)]">
              <span className="text-3xl">
                {importStats.added > 0 ? "🎉" : "📋"}
              </span>
            </div>
            <p className="font-display text-lg font-semibold">
              {importStats.added > 0
                ? `${importStats.added} books imported!`
                : "No books were imported"}
            </p>
            <div className="text-muted-foreground mt-2 flex justify-center gap-4 text-sm">
              {importStats.added > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  ✓ {importStats.added} imported
                </span>
              )}
              {importStats.errors > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  ⚠ {importStats.errors} error
                  {importStats.errors === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="rounded-xl" onClick={reset}>
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
