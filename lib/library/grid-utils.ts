import type { CardSize } from "@/lib/store/settings-store"

/**
 * Returns Tailwind grid classes for the given card size.
 * @param cardSize - The user's chosen card size.
 * @returns A CSS class string for the grid layout.
 */
export function getGridClasses(cardSize: CardSize): string {
  switch (cardSize) {
    case "compact":
      return "grid items-stretch grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
    case "large":
      return "grid items-stretch grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    default:
      return "grid items-stretch grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
  }
}

/** Item count above which /library switches to window virtualization. */
export const VIRTUALIZE_THRESHOLD = 20

/** Returns the number of grid columns for the given card size + viewport width. */
export const GRID_COLUMNS_BY_CARD_SIZE: Record<CardSize, readonly number[]> = {
  compact: [3, 4, 5, 6, 8],
  default: [2, 3, 4, 5, 6],
  large: [1, 2, 3, 4, 5]
}

export function getBreakpointTier(width: number) {
  if (width >= 1280) return 4
  if (width >= 1024) return 3
  if (width >= 768) return 2
  if (width >= 640) return 1
  return 0
}

export function getGridColumnCount(cardSize: CardSize, width: number) {
  const tier = getBreakpointTier(width)
  return GRID_COLUMNS_BY_CARD_SIZE[cardSize][tier] ?? 2
}

/** Returns the (Tailwind-matching) grid gap in pixels for the given card size. */
export function getGridGapPx(cardSize: CardSize) {
  if (cardSize === "compact") return 12
  if (cardSize === "large") return 20
  return 16
}

/** Rough row-height estimate for card grids (actual height is measured). */
export function estimateGridRowSize(cardSize: CardSize) {
  if (cardSize === "compact") return 320
  if (cardSize === "large") return 460
  return 380
}
