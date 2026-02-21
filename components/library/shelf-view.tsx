"use client"

import Link from "next/link"
import { useMemo } from "react"

import type { CardSize } from "@/lib/store/settings-store"
import type { SeriesWithVolumes } from "@/lib/types/database"
import { resolveImageUrl } from "@/lib/uploads/resolve-image-url"

const SPINE_SIZES: Record<CardSize, { width: number; height: number }> = {
  compact: { width: 36, height: 144 },
  default: { width: 48, height: 192 },
  large: { width: 60, height: 240 }
}

const SPINE_COLORS = [
  "#c2855a",
  "#b8860b",
  "#6b8e23",
  "#4682b4",
  "#8b5cf6",
  "#e11d48",
  "#0891b2",
  "#65a30d",
  "#c084fc",
  "#fb923c",
  "#34d399",
  "#60a5fa"
]

function getSpineColor(index: number): string {
  return SPINE_COLORS[index % SPINE_COLORS.length]
}

interface ShelfViewProps {
  readonly filteredSeries: SeriesWithVolumes[]
  readonly cardSize: CardSize
  readonly selectedSeriesIds: Set<string>
}

interface ShelfRowProps {
  readonly series: SeriesWithVolumes
  readonly spineWidth: number
  readonly spineHeight: number
  readonly isSelected: boolean
}

function ShelfRow({
  series,
  spineWidth,
  spineHeight,
  isSelected
}: ShelfRowProps) {
  const volumes = useMemo(
    () => [...series.volumes].sort((a, b) => a.volume_number - b.volume_number),
    [series.volumes]
  )

  let typeLabel = "Series"
  if (series.type === "manga") typeLabel = "Manga"
  else if (series.type === "light_novel") typeLabel = "Light Novel"

  return (
    <div
      className={`group rounded-2xl border p-4 transition-all ${
        isSelected
          ? "border-primary bg-primary/5"
          : "hover:border-border border-transparent"
      }`}
    >
      {/* Series label */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {typeLabel}
        </span>
        <Link
          href={`/library/series/${series.id}`}
          className="hover:text-primary font-display truncate text-sm font-semibold transition-colors"
        >
          {series.title}
        </Link>
        <span className="text-muted-foreground text-xs">
          ({volumes.length} vol{volumes.length === 1 ? "" : "s"})
        </span>
      </div>

      {/* Spine row */}
      <div className="relative">
        {/* Shelf surface */}
        <div
          className="bg-border/60 absolute right-0 bottom-0 left-0 h-2 rounded-sm"
          aria-hidden
        />
        <ul
          className="flex list-none gap-0.5 overflow-x-auto pb-2"
          aria-label={`${series.title} volumes`}
        >
          {volumes.map((volume, index) => {
            const coverUrl = volume.cover_image_url
              ? resolveImageUrl(volume.cover_image_url)
              : null
            const spineColor = getSpineColor(index)
            const volumeLabel = volume.title
              ? `Volume ${volume.volume_number}: ${volume.title}`
              : `Volume ${volume.volume_number}`
            return (
              <li key={volume.id}>
                <Link
                  href={`/library/volume/${volume.id}`}
                  aria-label={volumeLabel}
                  className="group/spine focus-visible:ring-primary relative block shrink-0 overflow-hidden rounded-sm shadow-sm transition-all hover:z-10 hover:-translate-y-1 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
                  style={{ width: spineWidth, height: spineHeight }}
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt=""
                      aria-hidden
                      width={spineWidth}
                      height={spineHeight}
                      className="h-full w-full object-cover object-[15%_top]"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-end justify-center pb-2"
                      style={{ backgroundColor: spineColor }}
                    >
                      <span
                        className="text-[10px] font-bold text-white/90"
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)"
                        }}
                      >
                        {volume.volume_number}
                      </span>
                    </div>
                  )}
                  {/* Volume number badge */}
                  <div className="bg-background/70 absolute bottom-1 left-1/2 -translate-x-1/2 rounded px-1 py-0.5 text-center opacity-0 backdrop-blur-sm transition-opacity group-hover/spine:opacity-100">
                    <span className="text-foreground block text-[10px] leading-none font-bold">
                      {volume.volume_number}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export function ShelfView({
  filteredSeries,
  cardSize,
  selectedSeriesIds
}: ShelfViewProps) {
  const { width: spineWidth, height: spineHeight } = SPINE_SIZES[cardSize]

  if (filteredSeries.length === 0) return null

  return (
    <div className="animate-fade-in-up space-y-8">
      {filteredSeries.map((series) => (
        <ShelfRow
          key={series.id}
          series={series}
          spineWidth={spineWidth}
          spineHeight={spineHeight}
          isSelected={selectedSeriesIds.has(series.id)}
        />
      ))}
    </div>
  )
}
