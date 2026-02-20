"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import type { ImportEvent } from "@/lib/api/import-events"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function StorageUsageCard() {
  const [totalBytes, setTotalBytes] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/storage/usage")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && typeof json?.data?.totalBytes === "number") {
          setTotalBytes(json.data.totalBytes)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="bg-muted/30 rounded-2xl border p-5 sm:col-span-2">
      <div className="bg-primary/8 text-primary mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-5 w-5"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14a9 3 0 0 0 18 0V5" />
          <path d="M3 12a9 3 0 0 0 18 0" />
        </svg>
      </div>
      <h3 className="font-display mb-1 text-base font-semibold">
        Storage Usage
      </h3>
      {loading ? (
        <Skeleton className="mt-1 h-5 w-24" />
      ) : (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {totalBytes === null ? (
            "Could not load storage info"
          ) : (
            <>
              <span className="text-foreground font-medium">
                {formatBytes(totalBytes)}
              </span>{" "}
              used (covers &amp; avatars)
            </>
          )}
        </p>
      )}
    </div>
  )
}

const FORMAT_LABELS: Record<string, string> = {
  json: "JSON",
  "csv-isbn": "CSV (ISBN)",
  "csv-shelfarc": "CSV (ShelfArc)",
  mal: "MyAnimeList",
  anilist: "AniList",
  goodreads: "Goodreads",
  barcode: "Barcode"
}

function RecentImportsCard() {
  const [events, setEvents] = useState<ImportEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings/import-events")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && Array.isArray(json?.events)) {
          setEvents(json.events as ImportEvent[])
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="bg-muted/30 rounded-2xl border p-5 sm:col-span-2">
      <div className="bg-primary/8 text-primary mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
        </svg>
      </div>
      <h3 className="font-display mb-3 text-base font-semibold">
        Recent Imports
      </h3>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      )}

      {!loading && events.length === 0 && (
        <p className="text-muted-foreground text-sm">No imports yet.</p>
      )}

      {!loading && events.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="pr-4 pb-2 font-medium">Date</th>
                <th className="pr-4 pb-2 font-medium">Format</th>
                <th className="pr-4 pb-2 font-medium">Series</th>
                <th className="pr-4 pb-2 font-medium">Volumes</th>
                <th className="pb-2 font-medium">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((ev) => (
                <tr key={ev.id} className="text-xs">
                  <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                    {new Date(ev.importedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </td>
                  <td className="py-2 pr-4 font-medium">
                    {FORMAT_LABELS[ev.format] ?? ev.format}
                  </td>
                  <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                    {ev.seriesAdded}
                  </td>
                  <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                    {ev.volumesAdded}
                  </td>
                  <td
                    className={`py-2 tabular-nums ${ev.errors > 0 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {ev.errors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function DataSection() {
  return (
    <section
      id="data"
      className="animate-fade-in-up scroll-mt-24 py-8"
      style={{ animationDelay: "325ms", animationFillMode: "both" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="bg-primary/8 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14a9 3 0 0 0 18 0V5" />
            <path d="M3 12a9 3 0 0 0 18 0" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Data Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Export or import your library data
          </p>
        </div>
      </div>

      <div className="grid-stagger grid gap-4 sm:grid-cols-2">
        <Link href="/settings/export" className="group">
          <div className="bg-muted/30 hover:bg-accent/60 hover-lift rounded-2xl border p-5 transition-colors">
            <div className="text-primary bg-primary/8 group-hover:bg-primary/12 mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <h3 className="font-display mb-1 text-base font-semibold">
              Export Data
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Export your collection as JSON or CSV for backup or migration.
            </p>
          </div>
        </Link>
        <Link href="/settings/import" className="group">
          <div className="bg-muted/30 hover:bg-accent/60 hover-lift rounded-2xl border p-5 transition-colors">
            <div className="text-primary bg-primary/8 group-hover:bg-primary/12 mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="font-display mb-1 text-base font-semibold">
              Import Data
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Import books from CSV (ISBN list) or restore from a ShelfArc JSON
              backup.
            </p>
          </div>
        </Link>
        <StorageUsageCard />
        <RecentImportsCard />
      </div>
    </section>
  )
}
