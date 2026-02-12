"use client"

import { useCallback, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryStore } from "@/lib/store/library-store"
import { normalizeIsbn } from "@/lib/books/isbn"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
import { toast } from "sonner"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

type VolumeRef = {
  volume: Volume
  seriesTitle: string | null
}

type DuplicateGroup = {
  id: string
  reason: "isbn" | "series_number"
  title: string
  subtitle: string
  items: VolumeRef[]
}

function safeTrim(value: string | null | undefined): string {
  return (value ?? "").trim()
}

function newestFirst(a: VolumeRef, b: VolumeRef): number {
  const ad = Date.parse(a.volume.updated_at || a.volume.created_at || "")
  const bd = Date.parse(b.volume.updated_at || b.volume.created_at || "")
  if (Number.isFinite(ad) && Number.isFinite(bd)) return bd - ad
  if (Number.isFinite(ad)) return -1
  if (Number.isFinite(bd)) return 1
  return a.volume.id.localeCompare(b.volume.id)
}

function collectAllVolumeRefs(
  series: SeriesWithVolumes[],
  unassignedVolumes: Volume[]
): VolumeRef[] {
  const all: VolumeRef[] = []

  for (const s of series) {
    for (const v of s.volumes) {
      all.push({ volume: v, seriesTitle: s.title })
    }
  }
  for (const v of unassignedVolumes) {
    all.push({ volume: v, seriesTitle: null })
  }

  return all
}

function buildIsbnDuplicateGroups(all: VolumeRef[]): DuplicateGroup[] {
  const byIsbn = new Map<string, VolumeRef[]>()
  for (const ref of all) {
    const raw = safeTrim(ref.volume.isbn)
    if (!raw) continue
    const normalized = normalizeIsbn(raw)
    if (!normalized) continue

    const existing = byIsbn.get(normalized) ?? []
    existing.push(ref)
    byIsbn.set(normalized, existing)
  }

  const groups: DuplicateGroup[] = []
  for (const [isbn, items] of byIsbn.entries()) {
    if (items.length < 2) continue
    const sorted = [...items].sort(newestFirst)
    if (new Set(sorted.map((it) => it.volume.id)).size < 2) continue

    groups.push({
      id: `isbn:${isbn}`,
      reason: "isbn",
      title: `Duplicate ISBN: ${isbn}`,
      subtitle: `${sorted.length} volumes share this ISBN`,
      items: sorted
    })
  }

  return groups
}

function buildSeriesNumberDuplicateGroups(series: SeriesWithVolumes[]): DuplicateGroup[] {
  const byKey = new Map<string, VolumeRef[]>()

  for (const s of series) {
    for (const v of s.volumes) {
      const normalizedTitle = normalizeVolumeTitle(v.title ?? "")
      const editionKey = safeTrim(v.edition).toLowerCase()
      const key = `${s.id}::${v.volume_number}::${editionKey}::${normalizedTitle.toLowerCase()}`
      const existing = byKey.get(key) ?? []
      existing.push({ volume: v, seriesTitle: s.title })
      byKey.set(key, existing)
    }
  }

  const groups: DuplicateGroup[] = []
  for (const [key, items] of byKey.entries()) {
    if (items.length < 2) continue
    const sorted = [...items].sort(newestFirst)
    if (new Set(sorted.map((it) => it.volume.id)).size < 2) continue

    const seriesTitle = sorted[0].seriesTitle
    const volumeNumber = sorted[0].volume.volume_number

    groups.push({
      id: `series_number:${key}`,
      reason: "series_number",
      title: `Possible duplicates: ${seriesTitle ?? "Series"} · Vol. ${volumeNumber}`,
      subtitle: `${sorted.length} entries share volume number/title/edition`,
      items: sorted
    })
  }

  return groups
}

function buildDuplicateGroups(
  series: SeriesWithVolumes[],
  unassignedVolumes: Volume[]
): DuplicateGroup[] {
  const all = collectAllVolumeRefs(series, unassignedVolumes)
  const groups = [
    ...buildIsbnDuplicateGroups(all),
    ...buildSeriesNumberDuplicateGroups(series)
  ]
  return groups.toSorted((a, b) => b.items.length - a.items.length)
}

function mergeNotes(primary: string | null, incoming: string | null): string | null {
  const a = safeTrim(primary)
  const b = safeTrim(incoming)
  if (!a && !b) return null
  if (a && !b) return a
  if (!a && b) return b
  if (a === b) return a
  return `${a}\n\n---\n\n${b}`
}

function buildAutoMergePatch(
  keep: Volume,
  others: Volume[]
): Partial<Volume> | null {
  const patch: Partial<Volume> = {}

  const takeFirst = <T,>(
    current: T | null,
    candidate: T | null
  ): T | null => {
    return current == null || current === ("" as unknown as T)
      ? candidate
      : current
  }

  for (const other of others) {
    patch.title = takeFirst(patch.title ?? keep.title, other.title)
    patch.description = takeFirst(
      patch.description ?? keep.description,
      other.description
    )
    patch.isbn = takeFirst(patch.isbn ?? keep.isbn, other.isbn)
    patch.cover_image_url = takeFirst(
      patch.cover_image_url ?? keep.cover_image_url,
      other.cover_image_url
    )
    patch.edition = takeFirst(patch.edition ?? keep.edition, other.edition)
    patch.format = takeFirst(patch.format ?? keep.format, other.format)
    patch.page_count = takeFirst(
      patch.page_count ?? keep.page_count,
      other.page_count
    )
    patch.publish_date = takeFirst(
      patch.publish_date ?? keep.publish_date,
      other.publish_date
    )
    patch.purchase_date = takeFirst(
      patch.purchase_date ?? keep.purchase_date,
      other.purchase_date
    )
    patch.purchase_price = takeFirst(
      patch.purchase_price ?? keep.purchase_price,
      other.purchase_price
    )
    patch.amazon_url = takeFirst(
      patch.amazon_url ?? keep.amazon_url,
      other.amazon_url
    )
    patch.rating = takeFirst(patch.rating ?? keep.rating, other.rating)
    patch.notes = mergeNotes(patch.notes ?? keep.notes, other.notes)
  }

  const hasAnyChange = Object.entries(patch).some(([key, value]) => {
    // Ignore undefined (we always assign nulls/values above, but keep this safe)
    if (value === undefined) return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (keep as any)[key] !== value
  })

  if (!hasAnyChange) return null
  return patch
}

/** Dialog that finds duplicate volumes and helps resolve them by merging/deleting. @source */
export function DuplicateMergeDialog({
  open,
  onOpenChange
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  const { fetchSeries, editVolume, removeVolume } = useLibrary()
  const series = useLibraryStore((s) => s.series)
  const unassignedVolumes = useLibraryStore((s) => s.unassignedVolumes)

  const groups = useMemo(() => {
    return buildDuplicateGroups(series, unassignedVolumes)
  }, [series, unassignedVolumes])

  const [keepByGroupId, setKeepByGroupId] = useState<Record<string, string>>({})
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null)
  const [autoMerge, setAutoMerge] = useState(true)

  const groupsSummary = useMemo(() => {
    if (groups.length === 0) return "No duplicates detected"
    const label = groups.length === 1 ? "duplicate group" : "duplicate groups"
    return `${groups.length} ${label} found`
  }, [groups.length])

  const resolveGroup = useCallback(
    async (group: DuplicateGroup) => {
      const keepId =
        keepByGroupId[group.id] ?? group.items.toSorted(newestFirst)[0]?.volume.id

      const keepRef = group.items.find((ref) => ref.volume.id === keepId)
      if (!keepRef) return

      const keep = keepRef.volume
      const others = group.items
        .filter((ref) => ref.volume.id !== keep.id)
        .map((ref) => ref.volume)

      if (others.length === 0) return

      setBusyGroupId(group.id)
      try {
        if (autoMerge) {
          const patch = buildAutoMergePatch(keep, others)
          if (patch) {
            await editVolume(keep.series_id ?? null, keep.id, patch)
          }
        }

        for (const other of others) {
          await removeVolume(other.series_id ?? null, other.id)
        }

        toast.success(
          `Resolved ${group.items.length} duplicates (kept 1, removed ${others.length})`
        )
      } catch (error) {
        console.error(error)
        toast.error("Failed to resolve duplicates")
      } finally {
        setBusyGroupId(null)
      }
    },
    [autoMerge, editVolume, keepByGroupId, removeVolume]
  )

  const hasAnyData = series.length > 0 || unassignedVolumes.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Duplicate detection</DialogTitle>
          <DialogDescription>
            Find and resolve possible duplicate volumes (by ISBN or by repeated
            series/volume entries). You control which entry is kept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/20 flex flex-wrap items-center gap-2 rounded-xl border p-3">
            <div className="text-muted-foreground text-xs">
              {groupsSummary}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-merge-duplicates"
                checked={autoMerge}
                onCheckedChange={(next) => setAutoMerge(Boolean(next))}
              />
              <Label htmlFor="auto-merge-duplicates" className="text-xs">
                Auto-merge missing fields into kept volume
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await fetchSeries()
                  toast.success("Library refreshed")
                } catch {
                  toast.error("Failed to refresh library")
                }
              }}
              disabled={busyGroupId != null}
              className="rounded-xl"
            >
              Refresh
            </Button>
          </div>

          {!hasAnyData && (
            <div className="text-muted-foreground rounded-xl border p-4 text-xs">
              Your library hasn&apos;t been loaded yet. Open the Library page (or
              click Refresh) and try again.
            </div>
          )}

          {groups.length > 0 && (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {groups.map((group) => {
                const defaultKeep = group.items.toSorted(newestFirst)[0]?.volume.id
                const keepValue = keepByGroupId[group.id] ?? defaultKeep
                const busy = busyGroupId === group.id

                return (
                  <div
                    key={group.id}
                    className="bg-card/60 rounded-2xl border p-4"
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-display truncate text-sm font-semibold">
                          {group.title}
                        </div>
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          {group.subtitle}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void resolveGroup(group)}
                        disabled={busy || !keepValue}
                        className="rounded-xl"
                      >
                        {busy ? "Resolving…" : "Resolve"}
                      </Button>
                    </div>

                    <div className="mt-3">
                      <div className="text-muted-foreground mb-2 text-[11px] font-medium">
                        Keep
                      </div>
                      <RadioGroup
                        value={keepValue}
                        onValueChange={(next) =>
                          setKeepByGroupId((prev) => ({
                            ...prev,
                            [group.id]: next
                          }))
                        }
                        className="gap-2"
                      >
                        {group.items.map((ref) => {
                          const volume = ref.volume
                          const seriesLabel = ref.seriesTitle ?? "Unassigned"
                          const title =
                            safeTrim(volume.title) || `Vol. ${volume.volume_number}`

                          return (
                            <label
                              key={volume.id}
                              className="hover:bg-muted/20 flex cursor-pointer items-start gap-3 rounded-xl border p-3"
                            >
                              <RadioGroupItem value={volume.id} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="truncate text-xs font-medium">
                                    {seriesLabel}
                                  </div>
                                  <span className="text-muted-foreground text-[11px]">
                                    · Vol. {volume.volume_number}
                                  </span>
                                </div>
                                <div className="text-muted-foreground mt-0.5 truncate text-xs">
                                  {title}
                                </div>
                                <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                                  {volume.isbn && (
                                    <span className="tabular-nums">ISBN {volume.isbn}</span>
                                  )}
                                  {volume.edition && <span>{volume.edition}</span>}
                                  {volume.format && <span>{volume.format}</span>}
                                  {volume.rating != null && (
                                    <span className="tabular-nums">{volume.rating}/10</span>
                                  )}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </RadioGroup>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
