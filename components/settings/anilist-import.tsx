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
import { useLibrary } from "@/lib/hooks/use-library"
import { sanitizePlainText } from "@/lib/sanitize-html"
import { toast } from "sonner"
import type { ReadingStatus } from "@/lib/types/database"

/* ─── Types ─────────────────────────────────────────────── */

interface AniListEntry {
  title: string
  status: ReadingStatus
  progress: number
  score: number | null
  totalVolumes: number | null
}

type AniListImportPhase = "idle" | "parsed" | "importing" | "complete"

/* ─── AniList Status Mapping ────────────────────────────── */

const ANILIST_STATUS_MAP: Record<string, ReadingStatus> = {
  CURRENT: "reading",
  COMPLETED: "completed",
  PAUSED: "on_hold",
  DROPPED: "dropped",
  PLANNING: "unread",
  REPEATING: "completed"
}

function mapAniListStatus(raw: string): ReadingStatus {
  return ANILIST_STATUS_MAP[raw.toUpperCase()] ?? "unread"
}

/* ─── JSON Parsing ──────────────────────────────────────── */

function extractLists(
  parsed: unknown
): Array<Record<string, unknown>> | null {
  if (!parsed || typeof parsed !== "object") return null

  // Format: { data: { MediaListCollection: { lists: [...] } } }
  const asObj = parsed as Record<string, unknown>
  if (asObj.data && typeof asObj.data === "object") {
    const data = asObj.data as Record<string, unknown>
    const collection =
      (data.MediaListCollection ?? data.mediaListCollection) as
        | Record<string, unknown>
        | undefined
    if (collection && Array.isArray(collection.lists)) {
      return collection.lists as Array<Record<string, unknown>>
    }
  }

  // Format: { lists: [...] }
  if (Array.isArray(asObj.lists)) {
    return asObj.lists as Array<Record<string, unknown>>
  }

  // Format: direct array of lists
  if (Array.isArray(parsed)) {
    return parsed as Array<Record<string, unknown>>
  }

  return null
}

function parseListEntry(
  entry: unknown,
  listStatus: string
): AniListEntry | null {
  const e = entry as Record<string, unknown>
  const media = (e.media ?? {}) as Record<string, unknown>
  const titleObj = (media.title ?? {}) as Record<string, unknown>

  const title =
    (titleObj.english as string) ??
    (titleObj.romaji as string) ??
    (titleObj.native as string) ??
    ""
  if (!title) return null

  const rawStatus = (e.status as string) ?? listStatus
  const progress = typeof e.progress === "number" ? e.progress : 0
  const scoreRaw = typeof e.score === "number" ? e.score : 0
  const totalRaw = typeof media.volumes === "number" ? media.volumes : null

  return {
    title: sanitizePlainText(title, 500),
    status: mapAniListStatus(rawStatus),
    progress,
    score: scoreRaw > 0 ? scoreRaw : null,
    totalVolumes: totalRaw && totalRaw > 0 ? totalRaw : null
  }
}

function parseAniListJson(content: string): AniListEntry[] {
  const parsed: unknown = JSON.parse(content)

  const lists = extractLists(parsed)
  if (!lists) {
    throw new Error(
      "Unrecognized AniList export format. Expected manga list data."
    )
  }

  const entries: AniListEntry[] = []

  for (const list of lists) {
    const listEntries = Array.isArray(list.entries) ? list.entries : []
    const listStatus = typeof list.status === "string" ? list.status : ""
    for (const entry of listEntries) {
      const parsed = parseListEntry(entry, listStatus)
      if (parsed) entries.push(parsed)
    }
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
  unread: "Plan to Read"
}

/* ─── Component ─────────────────────────────────────────── */

export function AniListImport() {
  const { createSeries, createVolume, fetchSeries } = useLibrary()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<AniListImportPhase>("idle")
  const [entries, setEntries] = useState<AniListEntry[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [importStats, setImportStats] = useState({ added: 0, errors: 0 })
  const [ownershipStatus, setOwnershipStatus] = useState<"owned" | "wishlist">(
    "owned"
  )

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.name.toLowerCase().endsWith(".json")) {
        toast.error("Please select a JSON file exported from AniList.")
        return
      }

      try {
        const text = await file.text()
        const parsed = parseAniListJson(text)
        if (parsed.length === 0) {
          toast.error("No manga entries found in this export.")
          return
        }
        setEntries(parsed)
        setFileName(file.name)
        setPhase("parsed")
        toast.success(
          `Parsed ${parsed.length} manga entries from AniList export.`
        )
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to parse the JSON file."
        )
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    []
  )

  const resolveVolumeCount = useCallback(
    (entry: AniListEntry): number => {
      if (entry.progress > 0) return entry.progress
      if (entry.totalVolumes && entry.status === "completed") {
        return entry.totalVolumes
      }
      return 1
    },
    []
  )

  const importEntry = useCallback(
    async (entry: AniListEntry) => {
      const series = await createSeries({
        title: entry.title,
        type: "manga",
        total_volumes: entry.totalVolumes,
        tags: []
      })

      const volumeCount = resolveVolumeCount(entry)

      for (let v = 1; v <= volumeCount; v++) {
        const isRead = v <= entry.progress
        await createVolume(series.id, {
          volume_number: v,
          ownership_status: ownershipStatus,
          reading_status: isRead ? entry.status : "unread",
          rating: v === 1 && entry.score ? entry.score : null
        })
      }
    },
    [createSeries, createVolume, ownershipStatus, resolveVolumeCount]
  )

  const handleImport = useCallback(async () => {
    if (entries.length === 0) return

    setPhase("importing")
    setProgress({ current: 0, total: entries.length })
    let added = 0
    let errors = 0

    for (let i = 0; i < entries.length; i++) {
      try {
        await importEntry(entries[i])
        added++
      } catch {
        errors++
      }
      setProgress({ current: i + 1, total: entries.length })
      setImportStats({ added, errors })
    }

    setPhase("complete")
    await fetchSeries()
    const failSuffix = errors > 0 ? `, ${errors} failed` : ""
    toast.success(`Import complete: ${added} series added${failSuffix}`)
  }, [entries, importEntry, fetchSeries])

  const reset = useCallback(() => {
    setPhase("idle")
    setEntries([])
    setFileName(null)
    setProgress({ current: 0, total: 0 })
    setImportStats({ added: 0, errors: 0 })
  }, [])

  if (phase === "idle") {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Import your manga list from AniList. Use a third-party tool to export
          your AniList data as JSON, then upload it here.
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
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="from-copper/20 to-gold/20 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br">
              <span className="text-2xl">📊</span>
            </div>
            <p className="font-display text-base font-semibold">
              Drop your AniList JSON export here
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              or click to browse. Accepts .json files with AniList manga list
              data.
            </p>
          </button>
        </div>
      </div>
    )
  }

  if (phase === "parsed") {
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
            manga entries
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
                      {entry.progress} vol. read
                      {entry.totalVolumes
                        ? ` / ${entry.totalVolumes} total`
                        : ""}
                      {entry.score ? ` · Score: ${entry.score}` : ""}
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

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">
              Add as
            </span>
            <Select
              value={ownershipStatus}
              onValueChange={(v) =>
                setOwnershipStatus(v as "owned" | "wishlist")
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

          <div className="flex gap-3">
            <Button variant="outline" className="rounded-xl" onClick={reset}>
              Cancel
            </Button>
            <Button className="rounded-xl px-6" onClick={handleImport}>
              Import {entries.length} Series
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
          {importStats.errors > 0 && (
            <span className="text-red-600 dark:text-red-400">
              {importStats.errors} error{importStats.errors === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="bg-muted relative h-2.5 flex-1 overflow-hidden rounded-full">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background:
                  "linear-gradient(90deg, var(--copper), var(--gold))"
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
                ? `${importStats.added} series imported!`
                : "No series were imported"}
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
