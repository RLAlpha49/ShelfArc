import { Badge } from "@/components/ui/badge"
import {
  OWNERSHIP_STATUS_COLORS,
  READING_STATUS_COLORS,
  SERIES_TYPE_COLORS
} from "@/lib/library/status-colors"
import { cn } from "@/lib/utils"
import type {
  OwnershipStatus,
  ReadingStatus,
  TitleType
} from "@/lib/types/database"

/** Human-readable labels per reading status. */
const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  unread: "unread",
  reading: "reading",
  completed: "completed",
  on_hold: "on hold",
  dropped: "dropped"
}

/** Human-readable labels per title type (long form). */
const TYPE_LABELS: Record<TitleType, string> = {
  light_novel: "Light Novel",
  manga: "Manga",
  other: "Other"
}

/** Short labels per title type. */
const TYPE_LABELS_SHORT: Record<TitleType, string> = {
  light_novel: "LN",
  manga: "Manga",
  other: "Other"
}

/** Series status color mapping. */
const SERIES_STATUS_COLORS: Record<string, string> = {
  ongoing: "border-primary/30 text-primary",
  completed: "border-copper/30 text-copper",
  hiatus: "border-gold/30 text-gold",
  cancelled: "border-destructive/30 text-destructive"
}

interface OwnershipBadgeProps {
  readonly status: OwnershipStatus
  readonly className?: string
}

function OwnershipBadge({ status, className }: OwnershipBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-lg text-xs",
        OWNERSHIP_STATUS_COLORS[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {status}
    </Badge>
  )
}

interface ReadingStatusBadgeProps {
  readonly status: ReadingStatus
  readonly className?: string
}

function ReadingStatusBadge({ status, className }: ReadingStatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-lg text-xs",
        READING_STATUS_COLORS[status],
        className
      )}
    >
      {READING_STATUS_LABELS[status]}
    </Badge>
  )
}

interface TypeBadgeProps {
  readonly type: TitleType
  readonly short?: boolean
  readonly className?: string
}

function TypeBadge({ type, short = false, className }: TypeBadgeProps) {
  const labels = short ? TYPE_LABELS_SHORT : TYPE_LABELS
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-lg text-xs",
        SERIES_TYPE_COLORS[type] ?? SERIES_TYPE_COLORS.other,
        className
      )}
    >
      {labels[type] ?? "Other"}
    </Badge>
  )
}

interface SeriesStatusBadgeProps {
  readonly status: string
  readonly className?: string
}

function SeriesStatusBadge({ status, className }: SeriesStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(SERIES_STATUS_COLORS[status], className)}
    >
      {status}
    </Badge>
  )
}

export { OwnershipBadge, ReadingStatusBadge, TypeBadge, SeriesStatusBadge }
