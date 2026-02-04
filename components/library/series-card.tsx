"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
  light_novel: "bg-blue-500/10 text-blue-500",
  manga: "bg-purple-500/10 text-purple-500",
  other: "bg-gray-500/10 text-gray-500"
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
    <Card
      className="group relative cursor-pointer overflow-hidden transition-all hover:shadow-lg"
      onClick={onClick}
    >
      <div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="bg-background/80 hover:bg-background flex h-8 w-8 items-center justify-center rounded-md backdrop-blur-sm"
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
          <DropdownMenuContent align="end">
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
            <div className="flex h-full items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground/50 h-12 w-12"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
          }
        />
        <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm leading-tight font-semibold">
            {series.title}
          </h3>
        </div>

        {series.author && (
          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
            {series.author}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-1">
          <Badge
            variant="secondary"
            className={TYPE_COLORS[series.type] ?? TYPE_COLORS.other}
          >
            {series.type === "light_novel" && "LN"}
            {series.type === "manga" && "Manga"}
            {series.type === "other" && "Other"}
          </Badge>

          {series.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
          <span>
            {ownedVolumes}/{totalVolumes} owned
          </span>
          <span>{readVolumes} read</span>
        </div>

        {totalVolumes > 0 && (
          <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${(ownedVolumes / totalVolumes) * 100}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
