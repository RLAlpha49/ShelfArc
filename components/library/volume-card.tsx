"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  readonly onEdit: () => void
  readonly onDelete: () => void
}

export function VolumeCard({ volume, onEdit, onDelete }: VolumeCardProps) {
  const ownershipColors: Record<string, string> = {
    owned: "bg-green-500/10 text-green-500",
    wishlist: "bg-yellow-500/10 text-yellow-500",
    reading: "bg-blue-500/10 text-blue-500",
    completed: "bg-purple-500/10 text-purple-500",
    dropped: "bg-red-500/10 text-red-500"
  }

  const readingColors: Record<string, string> = {
    unread: "bg-gray-500/10 text-gray-500",
    reading: "bg-blue-500/10 text-blue-500",
    completed: "bg-green-500/10 text-green-500",
    on_hold: "bg-yellow-500/10 text-yellow-500",
    dropped: "bg-red-500/10 text-red-500"
  }

  const progressPercent =
    volume.page_count && volume.current_page
      ? Math.round((volume.current_page / volume.page_count) * 100)
      : null

  return (
    <Card className="group relative overflow-hidden">
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
              <div className="flex h-full items-center justify-center">
                <span className="text-muted-foreground/30 text-3xl font-bold">
                  {volume.volume_number}
                </span>
              </div>
            }
          />

          {/* Hover Overlay */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          </div>

          {/* Menu Button */}
          <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-8 w-8 items-center justify-center rounded-md">
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
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
            <span className="font-semibold">Vol. {volume.volume_number}</span>
            {volume.rating && (
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-3.5 w-3.5 text-yellow-500"
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
              className={`text-xs ${ownershipColors[volume.ownership_status]}`}
            >
              {volume.ownership_status}
            </Badge>
            <Badge
              variant="secondary"
              className={`text-xs ${readingColors[volume.reading_status]}`}
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
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all"
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
