"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { CoverImage } from "@/components/library/cover-image"
import type { SeriesWithVolumes, TitleType } from "@/lib/types/database"

interface SeriesCardProps {
  readonly series: SeriesWithVolumes
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onClick: () => void
}

const TYPE_COLORS: Record<TitleType, string> = {
  light_novel: "bg-gold/10 text-gold",
  manga: "bg-copper/10 text-copper",
  other: "bg-muted text-muted-foreground"
}

export function SeriesCard({
  series,
  onEdit,
  onDelete,
  onClick
}: SeriesCardProps) {
  const { ownedVolumes, readVolumes, primaryIsbn } = useMemo(
    () =>
      series.volumes.reduce(
        (acc, volume) => {
          if (volume.ownership_status === "owned") {
            acc.ownedVolumes += 1
          }
          if (volume.reading_status === "completed") {
            acc.readVolumes += 1
          }
          if (!acc.primaryIsbn && volume.isbn) {
            acc.primaryIsbn = volume.isbn
          }
          return acc
        },
        { ownedVolumes: 0, readVolumes: 0, primaryIsbn: null as string | null }
      ),
    [series.volumes]
  )

  const totalVolumes = series.total_volumes || series.volumes.length

  return (
    <button
      type="button"
      className="group bg-card hover:bg-accent/40 relative w-full cursor-pointer overflow-hidden rounded-2xl text-left transition-colors"
      onClick={onClick}
    >
      <div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="bg-background/80 hover:bg-background flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
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
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-muted relative aspect-2/3">
        <CoverImage
          isbn={primaryIsbn}
          coverImageUrl={series.cover_image_url}
          alt={series.title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          fallback={
            <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary/30 h-12 w-12"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
          }
        />
        <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="p-3">
        <h3 className="font-display line-clamp-2 text-sm leading-tight font-semibold">
          {series.title}
        </h3>

        {series.author && (
          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
            {series.author}
          </p>
        )}

        {totalVolumes > 0 && (
          <div className="bg-primary/10 mt-2.5 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="from-copper to-gold h-full rounded-full bg-linear-to-r transition-all duration-500"
              style={{ width: `${(ownedVolumes / totalVolumes) * 100}%` }}
            />
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1">
          <Badge
            variant="secondary"
            className={`rounded-lg text-xs ${TYPE_COLORS[series.type] ?? TYPE_COLORS.other}`}
          >
            {series.type === "light_novel" && "LN"}
            {series.type === "manga" && "Manga"}
            {series.type === "other" && "Other"}
          </Badge>

          {series.tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="border-primary/15 rounded-lg text-xs"
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="text-muted-foreground mt-2.5 flex items-center gap-3 text-[11px]">
          <span>
            {ownedVolumes}/{totalVolumes} owned
          </span>
          <span className="bg-border h-3 w-px" />
          <span>{readVolumes} read</span>
        </div>
      </div>
    </button>
  )
}
