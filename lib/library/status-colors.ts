import type {
  OwnershipStatus,
  ReadingStatus,
  TitleType} from "@/lib/types/database"

/** Badge color mapping per series title type. */
export const SERIES_TYPE_COLORS: Record<TitleType, string> = {
  light_novel: "bg-gold/10 text-gold",
  manga: "bg-copper/10 text-copper",
  other: "bg-muted text-muted-foreground"
}

/** Badge color mapping per reading status. */
export const READING_STATUS_COLORS: Record<ReadingStatus, string> = {
  unread: "bg-muted text-muted-foreground",
  reading: "bg-primary/10 text-primary",
  completed: "bg-copper/10 text-copper",
  on_hold: "bg-gold/10 text-gold",
  dropped: "bg-destructive/10 text-destructive"
}

/** Badge color mapping per ownership status. */
export const OWNERSHIP_STATUS_COLORS: Record<OwnershipStatus, string> = {
  owned: "bg-copper/10 text-copper",
  wishlist: "bg-gold/10 text-gold"
}

/**
 * Tailwind badge color classes keyed by ownership status.
 * Includes reading-status values for mixed-status badge displays.
 */
export const ownershipColors: Record<string, string> = {
  owned: "bg-copper/10 text-copper",
  wishlist: "bg-gold/10 text-gold",
  reading: "bg-primary/10 text-primary",
  completed: "bg-copper/10 text-copper",
  dropped: "bg-destructive/10 text-destructive"
}

/** Tailwind badge color classes keyed by reading status. */
export const readingColors: Record<string, string> = {
  unread: "bg-muted text-muted-foreground",
  reading: "bg-primary/10 text-primary",
  completed: "bg-copper/10 text-copper",
  on_hold: "bg-gold/10 text-gold",
  dropped: "bg-destructive/10 text-destructive"
}
