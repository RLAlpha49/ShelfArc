"use client"

import {
  ArrowLeft01Icon,
  BookOpen01Icon,
  CheckmarkCircle01Icon,
  Sorting01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { CoverImage } from "@/components/library/cover-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useEnsureLibraryLoaded } from "@/lib/hooks/use-ensure-library-loaded"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
import { useLibraryStore } from "@/lib/store/library-store"
import type { Volume } from "@/lib/types/database"

interface ReadingVolume extends Volume {
  seriesTitle: string
  seriesId: string
}

type SortKey = "series_title" | "progress_asc" | "progress_desc" | "started_at"

function getProgress(v: Volume): number | null {
  if (v.page_count != null && v.page_count > 0 && v.current_page != null) {
    return Math.round((v.current_page / v.page_count) * 100)
  }
  return null
}

function ProgressBar({ progress }: { readonly progress: number }) {
  return (
    <div className="bg-primary/8 mt-3 h-1.5 overflow-hidden rounded-full">
      <div
        className="progress-animate from-primary to-gold h-full rounded-full bg-linear-to-r"
        style={{ "--target-width": `${progress}%` } as React.CSSProperties}
      />
    </div>
  )
}

function ReadingRow({
  volume,
  onMarkFinished,
  onUpdatePage
}: {
  readonly volume: ReadingVolume
  readonly onMarkFinished: (v: ReadingVolume) => void
  readonly onUpdatePage: (v: ReadingVolume, page: number) => void
}) {
  const progress = getProgress(volume)
  const displayTitle = volume.title ? normalizeVolumeTitle(volume.title) : null
  const [pageInput, setPageInput] = useState(
    volume.current_page == null ? "" : String(volume.current_page)
  )
  // Track if saving to prevent double-submit
  const savingRef = useRef(false)

  const handlePageBlur = () => {
    const parsed = Number.parseInt(pageInput, 10)
    if (
      Number.isNaN(parsed) ||
      parsed < 0 ||
      (volume.page_count != null && parsed > volume.page_count)
    ) {
      setPageInput(
        volume.current_page == null ? "" : String(volume.current_page)
      )
      return
    }
    if (parsed === volume.current_page) return
    if (savingRef.current) return
    savingRef.current = true
    onUpdatePage(volume, parsed)
    savingRef.current = false
  }

  return (
    <div className="bg-card hover:bg-accent/40 flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-start">
      {/* Cover thumbnail */}
      <Link
        href={`/library/volume/${volume.id}`}
        className="shrink-0 self-start"
      >
        <div className="h-20 w-14 overflow-hidden rounded shadow-sm">
          <CoverImage
            isbn={volume.isbn}
            coverImageUrl={volume.cover_image_url}
            alt={`${volume.seriesTitle} Vol. ${volume.volume_number}`}
            className="h-20 w-14 rounded object-cover"
          />
        </div>
      </Link>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <Link href={`/library/volume/${volume.id}`} className="block">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="hover:text-primary text-sm font-semibold transition-colors">
              {volume.seriesTitle}
            </span>
            <span className="text-muted-foreground text-xs">
              Vol. {volume.volume_number}
            </span>
          </div>
          {displayTitle && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {displayTitle}
            </p>
          )}
        </Link>

        {/* Progress bar */}
        {progress !== null && <ProgressBar progress={progress} />}

        {/* Page progress row */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Page</span>
          <Input
            type="number"
            min={0}
            max={volume.page_count ?? undefined}
            value={pageInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPageInput(e.target.value)
            }
            onBlur={handlePageBlur}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.currentTarget.blur()
              }
            }}
            className="h-7 w-20 text-center text-xs"
            aria-label={`Current page for ${volume.seriesTitle} Vol. ${volume.volume_number}`}
          />
          {volume.page_count != null && (
            <span className="text-muted-foreground text-xs">
              of {volume.page_count}
            </span>
          )}
          {progress !== null && (
            <span className="text-muted-foreground ml-auto text-xs font-medium">
              {progress}%
            </span>
          )}
        </div>
      </div>

      {/* Mark Finished button */}
      <div className="shrink-0 self-center sm:self-start">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => onMarkFinished(volume)}
        >
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            size={14}
            strokeWidth={1.5}
          />
          Finished
        </Button>
      </div>
    </div>
  )
}

export default function ReadingPage() {
  const { series, isLoading } = useEnsureLibraryLoaded()
  const [sortKey, setSortKey] = useState<SortKey>("series_title")
  const [finishedIds, setFinishedIds] = useState<Set<string>>(new Set())

  const readingVolumes = useMemo<ReadingVolume[]>(() => {
    const result: ReadingVolume[] = []
    for (const s of series) {
      for (const v of s.volumes) {
        if (v.reading_status !== "reading") continue
        if (finishedIds.has(v.id)) continue
        result.push({ ...v, seriesTitle: s.title, seriesId: s.id })
      }
    }

    const sorted = [...result]
    if (sortKey === "series_title") {
      sorted.sort((a, b) => a.seriesTitle.localeCompare(b.seriesTitle))
    } else if (sortKey === "progress_asc") {
      sorted.sort((a, b) => (getProgress(a) ?? -1) - (getProgress(b) ?? -1))
    } else if (sortKey === "progress_desc") {
      sorted.sort((a, b) => (getProgress(b) ?? -1) - (getProgress(a) ?? -1))
    } else {
      // started_at
      sorted.sort(
        (a, b) =>
          new Date(b.started_at ?? 0).getTime() -
          new Date(a.started_at ?? 0).getTime()
      )
    }
    return sorted
  }, [series, finishedIds, sortKey])

  const handleMarkFinished = async (volume: ReadingVolume) => {
    setFinishedIds((prev) => new Set(prev).add(volume.id))
    try {
      const res = await fetch(`/api/library/volumes/${volume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reading_status: "completed",
          finished_at: new Date().toISOString()
        })
      })
      if (!res.ok) throw new Error("Failed to update")
      useLibraryStore.getState().updateVolume(volume.seriesId, volume.id, {
        reading_status: "completed",
        finished_at: new Date().toISOString()
      })
      toast.success(
        `Marked "${volume.seriesTitle} Vol. ${volume.volume_number}" as finished!`
      )
    } catch {
      setFinishedIds((prev) => {
        const next = new Set(prev)
        next.delete(volume.id)
        return next
      })
      toast.error("Failed to mark as finished. Please try again.")
    }
  }

  const handleUpdatePage = async (volume: ReadingVolume, page: number) => {
    try {
      const res = await fetch(`/api/library/volumes/${volume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_page: page })
      })
      if (!res.ok) throw new Error("Failed to update")
      useLibraryStore.getState().updateVolume(volume.seriesId, volume.id, {
        current_page: page
      })
    } catch {
      toast.error("Failed to save progress. Please try again.")
    }
  }

  let volumeCountLabel = "No volumes in progress"
  if (readingVolumes.length === 1) {
    volumeCountLabel = "1 volume in progress"
  } else if (readingVolumes.length > 1) {
    volumeCountLabel = `${readingVolumes.length} volumes in progress`
  }

  if (isLoading && series.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
        <Skeleton className="mb-1 h-4 w-24" />
        <Skeleton className="mb-2 h-10 w-72" />
        <Skeleton className="mb-8 h-4 w-48" />
        <div className="grid gap-px overflow-hidden rounded-xl border">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-none" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
      {/* Header */}
      <section className="animate-fade-in-down mb-8">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-primary mb-3 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} />
          Back to Dashboard
        </Link>
        <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
          Library
        </span>
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight md:text-4xl">
          <span className="text-gradient from-copper to-gold bg-linear-to-r">
            Currently Reading
          </span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">{volumeCountLabel}</p>
      </section>

      {/* Sort controls */}
      {readingVolumes.length > 0 && (
        <div className="animate-fade-in-up stagger-1 mb-6 flex items-center gap-3">
          <HugeiconsIcon
            icon={Sorting01Icon}
            size={16}
            strokeWidth={1.5}
            className="text-muted-foreground shrink-0"
          />
          <Select
            value={sortKey}
            onValueChange={(v: string | null) => {
              if (v) setSortKey(v as SortKey)
            }}
          >
            <SelectTrigger className="h-8 w-52 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="series_title">Series Title (A–Z)</SelectItem>
              <SelectItem value="progress_desc">
                Progress (highest first)
              </SelectItem>
              <SelectItem value="progress_asc">
                Progress (lowest first)
              </SelectItem>
              <SelectItem value="started_at">Recently Started</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      {readingVolumes.length === 0 ? (
        <div className="glass-card animate-fade-in-up stagger-2 flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
          <HugeiconsIcon
            icon={BookOpen01Icon}
            size={40}
            strokeWidth={1.2}
            className="text-muted-foreground/40 mb-4"
          />
          <h2 className="text-base font-semibold">Nothing in progress yet</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Mark a volume as &ldquo;Reading&rdquo; in your library to track your
            progress here.
          </p>
          <Link href="/library">
            <Button variant="outline" className="mt-6 text-sm">
              Browse Library
            </Button>
          </Link>
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-2 grid gap-px overflow-hidden rounded-xl border">
          {readingVolumes.map((volume) => (
            <ReadingRow
              key={volume.id}
              volume={volume}
              onMarkFinished={handleMarkFinished}
              onUpdatePage={handleUpdatePage}
            />
          ))}
        </div>
      )}
    </div>
  )
}
