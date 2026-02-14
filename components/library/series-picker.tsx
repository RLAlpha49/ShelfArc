"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { CoverImage } from "@/components/library/cover-image"
import { cn } from "@/lib/utils"
import { TypeBadge } from "@/components/ui/status-badge"
import type { SeriesWithVolumes } from "@/lib/types/database"

/** Props for the {@link SeriesPicker} sub-dialog. @source */
export interface SeriesPickerProps {
  readonly seriesOptions: SeriesWithVolumes[]
  readonly selectedSeriesOption: SeriesWithVolumes | null
  readonly selectedSeriesId?: string | null
  readonly onSeriesChange?: (seriesId: string | null) => void
  readonly onCreateSeries?: () => void
  readonly allowNoSeries?: boolean
}

/**
 * Inline series selector with a nested search dialog for reassigning a volume's series.
 * @param props - {@link SeriesPickerProps}
 * @source
 */
export function SeriesPicker({
  seriesOptions,
  selectedSeriesOption,
  selectedSeriesId,
  onSeriesChange,
  onCreateSeries,
  allowNoSeries = false
}: SeriesPickerProps) {
  const [seriesQuery, setSeriesQuery] = useState("")
  const [isSeriesPickerOpen, setIsSeriesPickerOpen] = useState(false)
  const seriesSelectionDisabled = !onSeriesChange
  const showUnknownSeries = Boolean(selectedSeriesId && !selectedSeriesOption)
  const normalizedSeriesQuery = seriesQuery.trim().toLowerCase()

  const filteredSeriesOptions = useMemo(() => {
    if (!normalizedSeriesQuery) return seriesOptions
    return seriesOptions.filter((series) => {
      const tags = series.tags?.join(" ") ?? ""
      const haystack = `${series.title} ${series.author ?? ""} ${tags}`
        .trim()
        .toLowerCase()
      return haystack.includes(normalizedSeriesQuery)
    })
  }, [seriesOptions, normalizedSeriesQuery])

  const handleSeriesSelection = (seriesId: string | null) => {
    if (!onSeriesChange) return
    onSeriesChange(seriesId)
    setIsSeriesPickerOpen(false)
  }

  const summary = (() => {
    if (selectedSeriesOption) {
      return {
        title: selectedSeriesOption.title,
        subtitle: selectedSeriesOption.author ?? "",
        badge: (
          <TypeBadge type={selectedSeriesOption.type} className="text-[10px]" />
        ),
        meta: `${(
          selectedSeriesOption.total_volumes ||
          selectedSeriesOption.volumes.length ||
          0
        ).toString()} vols`
      }
    }
    if (showUnknownSeries && selectedSeriesId) {
      return {
        title: "Unknown series",
        subtitle: `ID: ${selectedSeriesId}`,
        badge: null,
        meta: ""
      }
    }
    if (allowNoSeries && selectedSeriesId === null) {
      return {
        title: "No series",
        subtitle: "This volume is unassigned.",
        badge: null,
        meta: ""
      }
    }
    return {
      title: "Select a series",
      subtitle: "Choose where this volume belongs.",
      badge: null,
      meta: ""
    }
  })()

  return (
    <fieldset className="glass-card rounded-2xl p-4">
      <legend className="text-muted-foreground px-1 text-xs tracking-widest uppercase">
        Series
      </legend>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">
            Choose the series this volume belongs to.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {seriesOptions.length} series
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => setIsSeriesPickerOpen(true)}
            disabled={seriesSelectionDisabled}
          >
            {selectedSeriesOption || selectedSeriesId === null
              ? "Change"
              : "Select"}
          </Button>
        </div>
      </div>

      <div className="bg-card/60 border-border/60 mt-3 flex items-center gap-3 rounded-xl border p-3">
        <div className="bg-muted relative aspect-2/3 w-10 overflow-hidden rounded-lg">
          {selectedSeriesOption ? (
            <CoverImage
              isbn={
                selectedSeriesOption.volumes.find((volume) => volume.isbn)?.isbn
              }
              coverImageUrl={selectedSeriesOption.cover_image_url}
              alt={selectedSeriesOption.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              fallback={
                <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
                  <span className="text-muted-foreground text-[9px] tracking-[0.3em] uppercase">
                    Series
                  </span>
                </div>
              }
            />
          ) : (
            <div className="from-muted/60 to-muted flex h-full items-center justify-center bg-linear-to-br">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground h-4 w-4"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                <path d="M8 7h8" />
                <path d="M8 11h6" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display line-clamp-1 text-xs font-semibold">
              {summary.title}
            </p>
            {summary.badge}
          </div>
          {summary.subtitle && (
            <p className="text-muted-foreground line-clamp-1 text-[11px]">
              {summary.subtitle}
            </p>
          )}
          {summary.meta && (
            <p className="text-muted-foreground mt-1 text-[10px]">
              {summary.meta}
            </p>
          )}
        </div>
      </div>

      <Dialog
        open={isSeriesPickerOpen}
        onOpenChange={(nextOpen) => {
          setIsSeriesPickerOpen(nextOpen)
          if (!nextOpen) setSeriesQuery("")
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="bg-warm/30 rounded-t-2xl border-b px-5 pt-5 pb-3">
            <DialogTitle className="font-display">Select series</DialogTitle>
            <DialogDescription>
              Search and pick a series for this volume.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 pt-4 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Input
                id="series_picker"
                type="search"
                placeholder="Search by title, author, or tag"
                value={seriesQuery}
                onChange={(event) => setSeriesQuery(event.target.value)}
                className="sm:max-w-sm"
              />
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span>{filteredSeriesOptions.length} shown</span>
                {seriesQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    onClick={() => setSeriesQuery("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-muted/20 border-border/60 rounded-xl border p-2">
              <div className="max-h-100 space-y-2 overflow-y-auto p-2">
                {allowNoSeries && (
                  <button
                    type="button"
                    onClick={() => handleSeriesSelection(null)}
                    disabled={seriesSelectionDisabled}
                    className={cn(
                      "group bg-card/70 hover:bg-accent/60 border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                      selectedSeriesId === null && "ring-primary/40 ring-2",
                      seriesSelectionDisabled && "cursor-not-allowed opacity-60"
                    )}
                    aria-pressed={selectedSeriesId === null}
                  >
                    <div className="from-muted/60 to-muted flex h-10 w-8 items-center justify-center rounded-lg bg-linear-to-br">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground h-4 w-4"
                      >
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        <path d="M8 7h8" />
                        <path d="M8 11h6" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xs font-semibold">
                        No series
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Keep this volume unassigned
                      </p>
                    </div>
                  </button>
                )}

                {filteredSeriesOptions.map((series) => {
                  const selected = series.id === selectedSeriesId
                  const totalVolumes =
                    series.total_volumes || series.volumes.length || 0
                  const primaryIsbn = series.volumes.find(
                    (volume) => volume.isbn
                  )?.isbn
                  return (
                    <button
                      key={series.id}
                      type="button"
                      onClick={() => handleSeriesSelection(series.id)}
                      disabled={seriesSelectionDisabled}
                      className={cn(
                        "group bg-card/70 hover:bg-accent/60 border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                        selected && "ring-primary/40 ring-2",
                        seriesSelectionDisabled &&
                          "cursor-not-allowed opacity-60"
                      )}
                      aria-pressed={selected}
                    >
                      <div className="bg-muted relative aspect-2/3 w-8 overflow-hidden rounded-lg">
                        <CoverImage
                          isbn={primaryIsbn}
                          coverImageUrl={series.cover_image_url}
                          alt={series.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          fallback={
                            <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
                              <span className="text-muted-foreground text-[8px] tracking-[0.3em] uppercase">
                                Series
                              </span>
                            </div>
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-display line-clamp-1 text-xs font-semibold">
                            {series.title}
                          </p>
                          {selected && (
                            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase">
                              Selected
                            </span>
                          )}
                        </div>
                        {series.author && (
                          <p className="text-muted-foreground line-clamp-1 text-[11px]">
                            {series.author}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <TypeBadge
                            type={series.type}
                            className="text-[10px]"
                          />
                          <span className="text-muted-foreground text-[10px]">
                            {totalVolumes} vols
                          </span>
                          {(series.tags ?? []).slice(0, 1).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="border-primary/15 rounded-lg text-[10px]"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>
                  )
                })}

                {filteredSeriesOptions.length === 0 && !allowNoSeries && (
                  <div className="text-muted-foreground px-3 py-4 text-center text-xs">
                    No series match your search.
                  </div>
                )}
              </div>
            </div>

            {showUnknownSeries && selectedSeriesId && (
              <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs">
                <span className="font-medium">Unknown series</span>
                <span className="text-muted-foreground">
                  ID: {selectedSeriesId}
                </span>
              </div>
            )}

            {onCreateSeries && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={onCreateSeries}
              >
                Create new series
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </fieldset>
  )
}
