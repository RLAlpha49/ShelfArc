"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { CoverImage } from "@/components/library/cover-image"
import type { Volume } from "@/lib/types/database"

interface VolumeCardProps {
  readonly volume: Volume
  readonly onClick: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
}

const OWNERSHIP_COLORS: Record<string, string> = {
  owned: "bg-green-500/10 text-green-600 dark:text-green-400",
  wishlist: "bg-gold/10 text-gold"
}

const READING_COLORS: Record<string, string> = {
  unread: "bg-muted text-muted-foreground",
  reading: "bg-primary/10 text-primary",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400",
  on_hold: "bg-gold/10 text-gold",
  dropped: "bg-destructive/10 text-destructive"
}

export function VolumeCard({
  volume,
  onClick,
  onEdit,
  onDelete
}: VolumeCardProps) {
  const progressPercent =
    volume.page_count && volume.current_page
      ? Math.round((volume.current_page / volume.page_count) * 100)
      : null

  return (
    <Card
      className="group border-primary/10 hover:shadow-primary/5 relative cursor-pointer overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl"
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Cover Image */}
        <div className="bg-muted relative aspect-3/4">
          <CoverImage
            isbn={volume.isbn}
            coverImageUrl={volume.cover_image_url}
            alt={`Volume ${volume.volume_number}`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            fallback={
              <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
                <span className="font-display text-primary/20 text-4xl font-bold">
                  {volume.volume_number}
                </span>
              </div>
            }
          />

          {/* Hover Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />

          {/* Menu Button */}
          <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="bg-background/80 hover:bg-background inline-flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-sm"
                onClick={(event) => event.stopPropagation()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit()
                  }}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete()
                  }}
                  className="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Volume Info */}
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold">
              Vol. {volume.volume_number}
            </span>
            {volume.rating && (
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-gold h-3.5 w-3.5"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {volume.rating}
              </span>
            )}
          </div>

          {volume.title && (
            <p className="text-muted-foreground line-clamp-1 text-sm">
              {volume.title}
            </p>
          )}

          <div className="flex flex-wrap gap-1">
            <Badge
              variant="secondary"
              className={`rounded-lg text-xs ${OWNERSHIP_COLORS[volume.ownership_status] ?? "bg-muted text-muted-foreground"}`}
            >
              {volume.ownership_status}
            </Badge>
            <Badge
              variant="secondary"
              className={`rounded-lg text-xs ${READING_COLORS[volume.reading_status]}`}
            >
              {volume.reading_status.replace("_", " ")}
            </Badge>
          </div>

          {/* Reading Progress */}
          {progressPercent !== null && volume.reading_status === "reading" && (
            <div className="space-y-1">
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>Progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="bg-primary/10 h-2 overflow-hidden rounded-full">
                <div
                  className="from-copper to-gold h-full rounded-full bg-linear-to-r transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
