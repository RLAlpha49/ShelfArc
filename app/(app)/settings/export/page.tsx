"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLibrary } from "@/lib/hooks/use-library"
import {
  selectAllSeries,
  selectAllUnassignedVolumes,
  useLibraryStore
} from "@/lib/store/library-store"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

/** Supported export file formats. @source */
type ExportFormat = "json" | "csv"
/** Export scope for the settings export page. @source */
type ExportScope = "all" | "selected"
/** Selection mode when exporting a subset of the library. @source */
type SelectionMode = "series" | "volumes"

type ExportPayload = {
  series: SeriesWithVolumes[]
  volumes: Volume[]
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

/** Export page allowing users to download their library as JSON or CSV. @source */
export default function ExportPage() {
  const { series, isLoading, fetchSeries } = useLibrary()
  const storeSeries = useLibraryStore(selectAllSeries)
  const storeUnassignedVolumes = useLibraryStore(selectAllUnassignedVolumes)

  useEffect(() => {
    if (series.length === 0) fetchSeries()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalVolumes = useMemo(
    () =>
      storeSeries.reduce((sum, s) => sum + s.volumes.length, 0) +
      storeUnassignedVolumes.length,
    [storeSeries, storeUnassignedVolumes]
  )

  const [format, setFormat] = useState<ExportFormat>("json")
  const [scope, setScope] = useState<ExportScope>("all")
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("series")
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<string>>(
    () => new Set()
  )
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<Set<string>>(
    () => new Set()
  )
  const [volumeSearch, setVolumeSearch] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [includePriceAlerts, setIncludePriceAlerts] = useState(false)
  const [includeActivity, setIncludeActivity] = useState(false)

  const flatVolumes = useMemo(() => {
    const rows: Array<{ id: string; label: string; subtitle: string }> = []
    for (const s of storeSeries) {
      for (const v of s.volumes) {
        const title = v.title?.trim() || `Vol. ${v.volume_number}`
        const isbn = v.isbn ? ` · ISBN ${v.isbn}` : ""
        rows.push({
          id: v.id,
          label: `${s.title} · Vol. ${v.volume_number}`,
          subtitle: `${title}${isbn}`
        })
      }
    }
    for (const v of storeUnassignedVolumes) {
      const title = v.title?.trim() || `Vol. ${v.volume_number}`
      const isbn = v.isbn ? ` · ISBN ${v.isbn}` : ""
      rows.push({
        id: v.id,
        label: `Unassigned · Vol. ${v.volume_number}`,
        subtitle: `${title}${isbn}`
      })
    }
    return rows
  }, [storeSeries, storeUnassignedVolumes])

  const filteredFlatVolumes = useMemo(() => {
    const q = volumeSearch.trim().toLowerCase()
    if (!q) return flatVolumes
    return flatVolumes.filter((row) => {
      return (
        row.label.toLowerCase().includes(q) ||
        row.subtitle.toLowerCase().includes(q)
      )
    })
  }, [flatVolumes, volumeSearch])

  const resolveExportPayload = useCallback((): ExportPayload => {
    const state = useLibraryStore.getState()
    const currentSeries = selectAllSeries(state)
    const currentUnassigned = selectAllUnassignedVolumes(state)

    if (scope === "all") {
      return {
        series: currentSeries,
        volumes: [
          ...currentSeries.flatMap((s) => s.volumes),
          ...currentUnassigned
        ]
      }
    }

    if (selectionMode === "series") {
      const selected = currentSeries.filter((s) => selectedSeriesIds.has(s.id))
      return {
        series: selected,
        volumes: selected.flatMap((s) => s.volumes)
      }
    }

    const volumes = [
      ...currentSeries.flatMap((s) => s.volumes),
      ...currentUnassigned
    ].filter((v) => selectedVolumeIds.has(v.id))

    const seriesById = new Map(currentSeries.map((s) => [s.id, s]))
    const referencedSeriesIds = new Set(
      volumes.map((v) => v.series_id).filter(Boolean) as string[]
    )
    const selectedSeries = Array.from(referencedSeriesIds)
      .map((id) => seriesById.get(id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))

    return { series: selectedSeries, volumes }
  }, [scope, selectionMode, selectedSeriesIds, selectedVolumeIds])

  const canExportSelected = useMemo(() => {
    if (scope !== "selected") return true
    if (selectionMode === "series") return selectedSeriesIds.size > 0
    return selectedVolumeIds.size > 0
  }, [scope, selectionMode, selectedSeriesIds.size, selectedVolumeIds.size])

  const handleExport = async () => {
    if (!canExportSelected) {
      toast.error("Select at least one item to export")
      return
    }

    setIsExporting(true)
    try {
      // Ensure data is loaded (normally pre-fetched on mount)
      if (series.length === 0) await fetchSeries()

      const payload = resolveExportPayload()
      const today = new Date().toISOString().split("T")[0]

      if (format === "json") {
        const seriesData = payload.series.map((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { volumes, ...rest } = s
          return rest
        })
        const volumesData = payload.volumes

        const exportObj: Record<string, unknown> = {
          series: seriesData,
          volumes: volumesData
        }

        if (includePriceAlerts) {
          const alertsRes = await fetch("/api/books/price/alerts")
          if (!alertsRes.ok) throw new Error("Failed to fetch price alerts")
          const alertsJson = (await alertsRes.json()) as { data: unknown }
          exportObj.priceAlerts = alertsJson.data
        }

        if (includeActivity) {
          const activityRes = await fetch("/api/activity?limit=1000")
          if (!activityRes.ok) throw new Error("Failed to fetch activity")
          const activityJson = (await activityRes.json()) as { data: unknown }
          exportObj.activity = activityJson.data
        }

        downloadTextFile(
          JSON.stringify(exportObj, null, 2),
          `shelfarc-export-${today}.json`,
          "application/json"
        )
      } else {
        const seriesById = new Map<string, SeriesWithVolumes>()
        for (const s of payload.series) seriesById.set(s.id, s)

        const volumeRows: string[] = []
        const seriesRows: string[] = []

        volumeRows.push(
          [
            "Series Title",
            "Series Type",
            "Author",
            "Publisher",
            "Volume Number",
            "Volume Title",
            "Volume Description",
            "ISBN",
            "Edition",
            "Format",
            "Ownership Status",
            "Reading Status",
            "Page Count",
            "Rating",
            "Publish Date",
            "Purchase Date",
            "Purchase Price",
            "Notes"
          ]
            .map((h) => csvEscape(h))
            .join(",")
        )

        seriesRows.push(
          [
            "id",
            "title",
            "original_title",
            "description",
            "notes",
            "author",
            "artist",
            "publisher",
            "cover_image_url",
            "amazon_url",
            "type",
            "total_volumes",
            "status",
            "tags",
            "is_public",
            "created_at",
            "updated_at"
          ]
            .map((h) => csvEscape(h))
            .join(",")
        )

        for (const s of payload.series) {
          const sr = s as Record<string, unknown>
          seriesRows.push(
            [
              sr.id ?? "",
              s.title,
              s.original_title || "",
              s.description || "",
              s.notes || "",
              s.author || "",
              s.artist || "",
              s.publisher || "",
              s.cover_image_url || "",
              sr.amazon_url ?? "",
              s.type,
              s.total_volumes?.toString() || "",
              s.status || "",
              (s.tags ?? []).join("; "),
              sr.is_public == null ? "" : String(sr.is_public),
              s.created_at || "",
              s.updated_at || ""
            ]
              .map(csvEscape)
              .join(",")
          )
        }

        for (const v of payload.volumes) {
          const parent = v.series_id ? seriesById.get(v.series_id) : undefined
          volumeRows.push(
            [
              parent?.title ?? "",
              parent?.type ?? "",
              parent?.author ?? "",
              parent?.publisher ?? "",
              v.volume_number,
              v.title || "",
              v.description || "",
              v.isbn || "",
              v.edition || "",
              v.format || "",
              v.ownership_status,
              v.reading_status,
              v.page_count || "",
              v.rating || "",
              v.publish_date || "",
              v.purchase_date || "",
              v.purchase_price || "",
              v.notes || ""
            ]
              .map(csvEscape)
              .join(",")
          )
        }

        downloadTextFile(
          volumeRows.join("\n"),
          `shelfarc-volumes-${today}.csv`,
          "text/csv"
        )
        downloadTextFile(
          seriesRows.join("\n"),
          `shelfarc-series-${today}.csv`,
          "text/csv"
        )
      }

      toast.success(
        `Exported ${payload.series.length} series and ${payload.volumes.length} volume${payload.volumes.length === 1 ? "" : "s"}`
      )
    } catch {
      toast.error("Failed to export data. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
      <div className="animate-fade-in mb-8">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Settings
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Export Data
        </h1>
      </div>

      <div className="animate-fade-in-up">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Export Your Library</CardTitle>
            <CardDescription>
              Export your entire collection or just a subset for sharing or
              migration. Use JSON for backup and re-import, or CSV for
              spreadsheets and manual editing.
            </CardDescription>

            {isLoading ? (
              <div className="mt-3 flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-36" />
              </div>
            ) : (
              storeSeries.length > 0 && (
                <p className="text-muted-foreground mt-3 text-sm">
                  {storeSeries.length} series &middot; {totalVolumes} volumes
                  ready to export
                </p>
              )
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-24 rounded-lg" />
                  </div>
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-24 rounded-lg" />
                  </div>
                </div>
                <Skeleton className="h-10 w-36 rounded-xl" />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <Label>Export Format</Label>
                  <RadioGroup
                    value={format}
                    onValueChange={(value: ExportFormat) => setFormat(value)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div className="flex items-start space-x-3 rounded-lg border p-4">
                      <RadioGroupItem value="json" id="json" className="mt-1" />
                      <div className="space-y-1">
                        <Label
                          htmlFor="json"
                          className="cursor-pointer font-medium"
                        >
                          JSON
                        </Label>
                        <p className="text-muted-foreground text-sm">
                          Full data. Best for backup and re-import.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 rounded-lg border p-4">
                      <RadioGroupItem value="csv" id="csv" className="mt-1" />
                      <div className="space-y-1">
                        <Label
                          htmlFor="csv"
                          className="cursor-pointer font-medium"
                        >
                          CSV
                        </Label>
                        <p className="text-muted-foreground text-sm">
                          Spreadsheet-friendly. Great for Excel or sharing.
                          Downloads two files (series &amp; volumes).
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label>Export Scope</Label>
                  <RadioGroup
                    value={scope}
                    onValueChange={(value: ExportScope) => setScope(value)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div className="flex items-start space-x-3 rounded-lg border p-4">
                      <RadioGroupItem
                        value="all"
                        id="scope-all"
                        className="mt-1"
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="scope-all"
                          className="cursor-pointer font-medium"
                        >
                          All data
                        </Label>
                        <p className="text-muted-foreground text-sm">
                          Export your entire library.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 rounded-lg border p-4">
                      <RadioGroupItem
                        value="selected"
                        id="scope-selected"
                        className="mt-1"
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="scope-selected"
                          className="cursor-pointer font-medium"
                        >
                          Selected
                        </Label>
                        <p className="text-muted-foreground text-sm">
                          Choose series or volumes to export.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {scope === "selected" && (
                  <div className="space-y-3">
                    <Label>Pick what to export</Label>
                    <Tabs
                      value={selectionMode}
                      onValueChange={(value) =>
                        setSelectionMode(value as SelectionMode)
                      }
                    >
                      <TabsList className="rounded-xl">
                        <TabsTrigger value="series">Series</TabsTrigger>
                        <TabsTrigger value="volumes">Volumes</TabsTrigger>
                      </TabsList>

                      <TabsContent value="series" className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() =>
                              setSelectedSeriesIds(
                                new Set(storeSeries.map((s) => s.id))
                              )
                            }
                          >
                            Select all
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => setSelectedSeriesIds(new Set())}
                          >
                            Clear
                          </Button>
                          <div className="flex-1" />
                          <span className="text-muted-foreground text-xs">
                            {selectedSeriesIds.size} selected
                          </span>
                        </div>

                        <ScrollArea className="h-56 rounded-xl border">
                          <div className="space-y-1 p-2">
                            {storeSeries.map((s) => {
                              const checked = selectedSeriesIds.has(s.id)
                              return (
                                <label
                                  key={s.id}
                                  className="hover:bg-muted/20 flex cursor-pointer items-start gap-3 rounded-lg p-2"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(next) => {
                                      const isChecked = Boolean(next)
                                      setSelectedSeriesIds((prev) => {
                                        const copy = new Set(prev)
                                        if (isChecked) copy.add(s.id)
                                        else copy.delete(s.id)
                                        return copy
                                      })
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">
                                      {s.title}
                                    </div>
                                    <div className="text-muted-foreground truncate text-xs">
                                      {s.volumes.length} volumes
                                      {s.author ? ` · ${s.author}` : ""}
                                    </div>
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="volumes" className="space-y-2">
                        <Input
                          value={volumeSearch}
                          onChange={(e) => setVolumeSearch(e.target.value)}
                          placeholder="Search volumes by title, series, ISBN, or number…"
                          className="rounded-xl"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() =>
                              setSelectedVolumeIds(
                                new Set(
                                  filteredFlatVolumes.map((row) => row.id)
                                )
                              )
                            }
                          >
                            Select filtered
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => setSelectedVolumeIds(new Set())}
                          >
                            Clear
                          </Button>
                          <div className="flex-1" />
                          <span className="text-muted-foreground text-xs">
                            {selectedVolumeIds.size} selected
                          </span>
                        </div>

                        <ScrollArea className="h-56 rounded-xl border">
                          <div className="space-y-1 p-2">
                            {filteredFlatVolumes.map((row) => {
                              const checked = selectedVolumeIds.has(row.id)
                              return (
                                <label
                                  key={row.id}
                                  className="hover:bg-muted/20 flex cursor-pointer items-start gap-3 rounded-lg p-2"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(next) => {
                                      const isChecked = Boolean(next)
                                      setSelectedVolumeIds((prev) => {
                                        const copy = new Set(prev)
                                        if (isChecked) copy.add(row.id)
                                        else copy.delete(row.id)
                                        return copy
                                      })
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">
                                      {row.label}
                                    </div>
                                    <div className="text-muted-foreground truncate text-xs">
                                      {row.subtitle}
                                    </div>
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>

                    {!canExportSelected && (
                      <p className="text-muted-foreground text-xs">
                        Select at least one item to export.
                      </p>
                    )}
                  </div>
                )}

                {format === "json" && (
                  <div className="space-y-3">
                    <Label>Additional Data</Label>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="include-price-alerts"
                          checked={includePriceAlerts}
                          onCheckedChange={(checked) =>
                            setIncludePriceAlerts(Boolean(checked))
                          }
                        />
                        <div>
                          <Label
                            htmlFor="include-price-alerts"
                            className="cursor-pointer font-medium"
                          >
                            Price alerts
                          </Label>
                          <p className="text-muted-foreground text-sm">
                            Include your price alert configurations.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="include-activity"
                          checked={includeActivity}
                          onCheckedChange={(checked) =>
                            setIncludeActivity(Boolean(checked))
                          }
                        />
                        <div>
                          <Label
                            htmlFor="include-activity"
                            className="cursor-pointer font-medium"
                          >
                            Activity log
                          </Label>
                          <p className="text-muted-foreground text-sm">
                            Include recent library activity (up to 100 events).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={handleExport}
                    disabled={isLoading || isExporting || !canExportSelected}
                    className="rounded-xl px-6"
                  >
                    {isExporting ? "Exporting..." : "Export"}
                  </Button>
                  <Link
                    href="/settings"
                    className="text-muted-foreground hover:text-foreground inline-flex h-10 items-center justify-center px-4 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
