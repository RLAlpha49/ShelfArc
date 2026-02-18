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
import { Badge } from "@/components/ui/badge"
import { useLibrary } from "@/lib/hooks/use-library"
import {
  useLibraryStore,
  selectAllSeries,
  selectAllUnassignedVolumes
} from "@/lib/store/library-store"
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

function buildSeriesNumberDuplicateGroups(
  series: SeriesWithVolumes[]
): DuplicateGroup[] {
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

function mergeNotes(
  primary: string | null,
  incoming: string | null
): string | null {
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

  const takeFirst = <T,>(current: T | null, candidate: T | null): T | null => {
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

function buildMergedPatch(
  keep: Volume,
  others: Volume[],
  allItems: VolumeRef[],
  overrides: Record<string, string> | undefined,
  shouldAutoMerge: boolean
): Partial<Volume> | null {
  const patch: Record<string, unknown> = shouldAutoMerge
    ? (buildAutoMergePatch(keep, others) ?? {})
    : {}

  if (overrides) {
    const allVolumes = allItems.map((r) => r.volume)
    for (const [fieldKey, volumeId] of Object.entries(overrides)) {
      const source = allVolumes.find((v) => v.id === volumeId)
      if (source) patch[fieldKey] = source[fieldKey as keyof Volume]
    }
  }

  const keepRecord = keep as Record<string, unknown>
  for (const key of Object.keys(patch)) {
    if (patch[key] === keepRecord[key]) delete patch[key]
  }

  return Object.keys(patch).length > 0 ? (patch as Partial<Volume>) : null
}

/** Comparison fields to highlight differences between duplicate volumes. */
const COMPARE_FIELDS = [
  { key: "title", label: "Title" },
  { key: "isbn", label: "ISBN" },
  { key: "edition", label: "Edition" },
  { key: "format", label: "Format" },
  { key: "page_count", label: "Pages" },
  { key: "publish_date", label: "Published" },
  { key: "purchase_date", label: "Purchased" },
  { key: "purchase_price", label: "Price" },
  { key: "ownership_status", label: "Ownership" },
  { key: "reading_status", label: "Reading" },
  { key: "rating", label: "Rating" },
  { key: "amazon_url", label: "Amazon" },
  { key: "notes", label: "Notes" }
] as const

function getDifferingFields(items: VolumeRef[]): Set<string> {
  const differing = new Set<string>()
  if (items.length < 2) return differing

  const first = items[0].volume
  for (const { key } of COMPARE_FIELDS) {
    const firstVal = safeTrim(String(first[key] ?? ""))
    for (let i = 1; i < items.length; i++) {
      const otherVal = safeTrim(String(items[i].volume[key] ?? ""))
      if (firstVal !== otherVal) {
        differing.add(key)
        break
      }
    }
  }

  return differing
}

function formatFieldValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—"
  if (key === "purchase_price") return `$${value}`
  if (key === "rating") return `${value}/10`
  if (key === "amazon_url") {
    const s = String(value)
    return s.length > 40 ? s.slice(0, 40) + "…" : s
  }
  if (key === "notes") {
    const s = String(value)
    return s.length > 60 ? s.slice(0, 60) + "…" : s
  }
  return String(value)
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
  const series = useLibraryStore(selectAllSeries)
  const unassignedVolumes = useLibraryStore(selectAllUnassignedVolumes)

  const groups = useMemo(() => {
    return buildDuplicateGroups(series, unassignedVolumes)
  }, [series, unassignedVolumes])

  const [keepByGroupId, setKeepByGroupId] = useState<Record<string, string>>({})
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null)
  const [autoMerge, setAutoMerge] = useState(true)
  const [fieldDiffOpen, setFieldDiffOpen] = useState<Record<string, boolean>>(
    {}
  )
  const [fieldOverrides, setFieldOverrides] = useState<
    Record<string, Record<string, string>>
  >({})

  const totalDuplicateVolumes = useMemo(() => {
    return groups.reduce((sum, g) => sum + g.items.length, 0)
  }, [groups])

  const resolveGroup = useCallback(
    async (group: DuplicateGroup) => {
      const keepId =
        keepByGroupId[group.id] ??
        group.items.toSorted(newestFirst)[0]?.volume.id

      const keepRef = group.items.find((ref) => ref.volume.id === keepId)
      if (!keepRef) return

      const keep = keepRef.volume
      const others = group.items
        .filter((ref) => ref.volume.id !== keep.id)
        .map((ref) => ref.volume)

      if (others.length === 0) return

      setBusyGroupId(group.id)
      try {
        const overrides = fieldOverrides[group.id]
        const patch = buildMergedPatch(
          keep,
          others,
          group.items,
          overrides,
          autoMerge
        )
        if (patch) {
          await editVolume(keep.series_id ?? null, keep.id, patch)
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
    [autoMerge, editVolume, fieldOverrides, keepByGroupId, removeVolume]
  )

  const hasAnyData = series.length > 0 || unassignedVolumes.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Duplicate Detection
          </DialogTitle>
          <DialogDescription>
            Find and resolve possible duplicate volumes by ISBN or repeated
            series/volume entries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary bar */}
          <div className="bg-muted/30 flex flex-wrap items-center gap-3 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                  groups.length > 0
                    ? "bg-copper/15 text-copper"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {groups.length}
              </div>
              <div>
                <div className="text-xs font-medium">
                  {groups.length === 1
                    ? "1 duplicate group"
                    : `${groups.length} duplicate groups`}
                </div>
                {groups.length > 0 && (
                  <div className="text-muted-foreground text-[11px]">
                    {totalDuplicateVolumes} volumes affected
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-merge-duplicates"
                checked={autoMerge}
                onCheckedChange={(next) => setAutoMerge(Boolean(next))}
              />
              <Label htmlFor="auto-merge-duplicates" className="text-xs">
                Auto-merge missing fields
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
            <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-xs">
              Your library hasn&apos;t been loaded yet. Open the Library page
              (or click Refresh) and try again.
            </div>
          )}

          {hasAnyData && groups.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <div className="text-muted-foreground mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <div className="text-sm font-medium">No duplicates found</div>
              <div className="text-muted-foreground mt-1 text-xs">
                Your library looks clean!
              </div>
            </div>
          )}

          {groups.length > 0 && (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {groups.map((group) => {
                const defaultKeep =
                  group.items.toSorted(newestFirst)[0]?.volume.id
                const keepValue = keepByGroupId[group.id] ?? defaultKeep
                const busy = busyGroupId === group.id
                const differingFields = getDifferingFields(group.items)

                return (
                  <div
                    key={group.id}
                    className="bg-card/60 overflow-hidden rounded-2xl border"
                  >
                    {/* Group header */}
                    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                      <Badge
                        variant="outline"
                        className="rounded-lg text-[10px] tracking-wider uppercase"
                      >
                        {group.reason === "isbn" ? "ISBN" : "Series"}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="font-display truncate text-sm font-semibold">
                          {group.title}
                        </div>
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {group.items.length} entries
                      </span>
                      {differingFields.size > 0 && (
                        <Button
                          variant={
                            fieldDiffOpen[group.id] ? "secondary" : "ghost"
                          }
                          size="sm"
                          onClick={() =>
                            setFieldDiffOpen((prev) => ({
                              ...prev,
                              [group.id]: !prev[group.id]
                            }))
                          }
                          className="rounded-xl text-xs"
                          aria-expanded={fieldDiffOpen[group.id] ?? false}
                          aria-controls={`field-diff-${group.id}`}
                        >
                          {fieldDiffOpen[group.id] ? "Hide Diff" : "Compare"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void resolveGroup(group)}
                        disabled={busy || !keepValue}
                        className="rounded-xl"
                      >
                        {busy ? "Resolving\u2026" : "Resolve"}
                      </Button>
                    </div>

                    {/* Differing fields indicator */}
                    {differingFields.size > 0 && (
                      <div className="border-b px-4 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-muted-foreground text-[11px]">
                            Differences:
                          </span>
                          {COMPARE_FIELDS.filter((f) =>
                            differingFields.has(f.key)
                          ).map((f) => (
                            <span
                              key={f.key}
                              className="bg-copper/10 text-copper rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                            >
                              {f.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Side-by-side volume comparison */}
                    <div className="grid gap-0 divide-y">
                      {group.items.map((ref) => {
                        const volume = ref.volume
                        const isKept = volume.id === keepValue
                        const seriesLabel = ref.seriesTitle ?? "Unassigned"
                        const title =
                          safeTrim(volume.title) ||
                          `Vol. ${volume.volume_number}`

                        return (
                          <button
                            key={volume.id}
                            type="button"
                            onClick={() => {
                              setKeepByGroupId((prev) => ({
                                ...prev,
                                [group.id]: volume.id
                              }))
                              setFieldOverrides((prev) => {
                                const next = { ...prev }
                                delete next[group.id]
                                return next
                              })
                            }}
                            className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors ${
                              isKept ? "bg-copper/5" : "hover:bg-muted/30"
                            }`}
                          >
                            {/* Selection indicator */}
                            <div
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                isKept
                                  ? "border-copper bg-copper text-white"
                                  : "border-muted-foreground/30"
                              }`}
                            >
                              {isKept && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="h-3 w-3"
                                >
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              )}
                            </div>

                            {/* Volume details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-xs font-medium">
                                  {seriesLabel}
                                </span>
                                <span className="text-muted-foreground text-[11px]">
                                  Vol. {volume.volume_number}
                                </span>
                                {isKept && (
                                  <span className="text-copper text-[10px] font-semibold tracking-wider uppercase">
                                    Keep
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground mt-0.5 truncate text-xs">
                                {title}
                              </div>

                              {/* Field details grid */}
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                {volume.isbn && (
                                  <div className="text-[11px]">
                                    <span
                                      className={`font-medium ${differingFields.has("isbn") ? "text-copper" : "text-muted-foreground"}`}
                                    >
                                      ISBN
                                    </span>{" "}
                                    <span className="text-foreground tabular-nums">
                                      {volume.isbn}
                                    </span>
                                  </div>
                                )}
                                {volume.edition && (
                                  <div className="text-[11px]">
                                    <span
                                      className={`font-medium ${differingFields.has("edition") ? "text-copper" : "text-muted-foreground"}`}
                                    >
                                      Edition
                                    </span>{" "}
                                    <span className="text-foreground">
                                      {volume.edition}
                                    </span>
                                  </div>
                                )}
                                {volume.format && (
                                  <div className="text-[11px]">
                                    <span
                                      className={`font-medium ${differingFields.has("format") ? "text-copper" : "text-muted-foreground"}`}
                                    >
                                      Format
                                    </span>{" "}
                                    <span className="text-foreground">
                                      {volume.format}
                                    </span>
                                  </div>
                                )}
                                {volume.page_count != null && (
                                  <div className="text-[11px]">
                                    <span
                                      className={`font-medium ${differingFields.has("page_count") ? "text-copper" : "text-muted-foreground"}`}
                                    >
                                      Pages
                                    </span>{" "}
                                    <span className="text-foreground tabular-nums">
                                      {volume.page_count}
                                    </span>
                                  </div>
                                )}
                                {volume.rating != null && (
                                  <div className="text-[11px]">
                                    <span
                                      className={`font-medium ${differingFields.has("rating") ? "text-copper" : "text-muted-foreground"}`}
                                    >
                                      Rating
                                    </span>{" "}
                                    <span className="text-foreground tabular-nums">
                                      {volume.rating}/10
                                    </span>
                                  </div>
                                )}
                                {volume.purchase_price != null && (
                                  <div className="text-[11px]">
                                    <span
                                      className={`font-medium ${differingFields.has("purchase_price") ? "text-copper" : "text-muted-foreground"}`}
                                    >
                                      Price
                                    </span>{" "}
                                    <span className="text-foreground tabular-nums">
                                      ${volume.purchase_price}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Field-diff comparison table */}
                    {fieldDiffOpen[group.id] && differingFields.size > 0 && (
                      <section
                        id={`field-diff-${group.id}`}
                        className="border-t"
                        aria-label="Field comparison"
                      >
                        <div className="bg-muted/20 flex items-stretch border-b">
                          <div className="flex w-24 shrink-0 items-center px-3 py-2 sm:w-28">
                            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                              Field
                            </span>
                          </div>
                          <div className="flex flex-1 items-stretch divide-x">
                            {group.items.map((ref) => (
                              <div
                                key={ref.volume.id}
                                className="flex flex-1 items-center px-3 py-2"
                              >
                                <span
                                  className={`truncate text-[10px] font-medium ${
                                    ref.volume.id === keepValue
                                      ? "text-copper"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  Vol. {ref.volume.volume_number}
                                  {ref.volume.id === keepValue && " · primary"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="divide-y">
                          {COMPARE_FIELDS.filter((field) =>
                            group.items.some((ref) => {
                              const v = ref.volume[field.key as keyof Volume]
                              return v != null && v !== ""
                            })
                          ).map((field) => {
                            const isDiffering = differingFields.has(field.key)
                            const selectedId =
                              fieldOverrides[group.id]?.[field.key] ?? keepValue

                            return (
                              <div
                                key={field.key}
                                className={`flex items-stretch ${
                                  isDiffering ? "" : "opacity-40"
                                }`}
                              >
                                <div className="flex w-24 shrink-0 items-center border-r px-3 py-1.5 sm:w-28">
                                  <span
                                    className={`text-[11px] font-medium ${
                                      isDiffering
                                        ? "text-copper"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {field.label}
                                  </span>
                                </div>
                                <div className="flex flex-1 items-stretch divide-x">
                                  {group.items.map((ref) => {
                                    const value =
                                      ref.volume[field.key as keyof Volume]
                                    const isSelected =
                                      ref.volume.id === selectedId
                                    const display = formatFieldValue(
                                      field.key,
                                      value
                                    )

                                    return isDiffering ? (
                                      <button
                                        key={ref.volume.id}
                                        type="button"
                                        onClick={() =>
                                          setFieldOverrides((prev) => ({
                                            ...prev,
                                            [group.id]: {
                                              ...prev[group.id],
                                              [field.key]: ref.volume.id
                                            }
                                          }))
                                        }
                                        className={`flex flex-1 items-center gap-1.5 px-3 py-1.5 text-left text-[11px] transition-colors ${
                                          isSelected
                                            ? "bg-copper/8 text-foreground"
                                            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                        }`}
                                        aria-pressed={isSelected}
                                        aria-label={`Use ${field.label} value from volume ${ref.volume.volume_number}`}
                                      >
                                        <span
                                          className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border ${
                                            isSelected
                                              ? "border-copper bg-copper"
                                              : "border-muted-foreground/40"
                                          }`}
                                          aria-hidden="true"
                                        >
                                          {isSelected && (
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="3"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              className="h-1.5 w-1.5 text-white"
                                            >
                                              <path d="M20 6 9 17l-5-5" />
                                            </svg>
                                          )}
                                        </span>
                                        <span className="truncate">
                                          {display}
                                        </span>
                                      </button>
                                    ) : (
                                      <div
                                        key={ref.volume.id}
                                        className="text-muted-foreground flex flex-1 items-center px-3 py-1.5 text-[11px]"
                                      >
                                        <span className="truncate">
                                          {display}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    )}
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
