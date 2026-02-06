import type { ShelfItemWithVolume, SeriesGroup } from "@/lib/types/database"
import {
  BOOK_SPINE_WIDTH,
  BOOK_LENGTH,
  BOOK_GRID_SIZE
} from "@/components/bookshelf/shelf-book"

/**
 * Threshold in pixels for considering books as adjacent for series grouping.
 * Books within this distance are considered part of the same visual group.
 */
const ADJACENCY_THRESHOLD = Math.max(1, BOOK_GRID_SIZE / 2)

/**
 * Detects groups of adjacent volumes from the same series on a bookshelf.
 * This is used to render visual indicators showing books that belong together.
 *
 * @param items - All shelf items with their volume data
 * @returns Array of SeriesGroup objects representing adjacent same-series volumes
 */
export function detectAdjacentSeriesGroups(
  items: ShelfItemWithVolume[]
): SeriesGroup[] {
  if (items.length === 0) return []

  // Group items by row, series, and orientation
  const itemsByRow = groupItemsByRowSeries(items)
  const groups: SeriesGroup[] = []

  itemsByRow.forEach((rowItems, key) => {
    const rowIndex = Number.parseInt(key.split(":")[0] ?? "0", 10)
    const components = findConnectedComponents(rowItems)
    components.forEach((component) => {
      if (component.length > 1) {
        groups.push(createSeriesGroup(component, rowIndex))
      }
    })
  })

  return groups
}

function groupItemsByRowSeries(
  items: ShelfItemWithVolume[]
): Map<string, ShelfItemWithVolume[]> {
  const itemsByRow = new Map<string, ShelfItemWithVolume[]>()
  for (const item of items) {
    const seriesId = item.volume.series_id
    if (!seriesId) continue
    const key = `${item.row_index}:${seriesId}:${item.orientation}`
    const rowItems = itemsByRow.get(key) ?? []
    rowItems.push(item)
    itemsByRow.set(key, rowItems)
  }
  return itemsByRow
}

function findConnectedComponents(
  items: ShelfItemWithVolume[]
): ShelfItemWithVolume[][] {
  const result: ShelfItemWithVolume[][] = []
  const visited = new Set<string>()

  for (const item of items) {
    if (visited.has(item.id)) continue
    result.push(collectComponent(item, items, visited))
  }

  return result
}

function collectComponent(
  start: ShelfItemWithVolume,
  items: ShelfItemWithVolume[],
  visited: Set<string>
): ShelfItemWithVolume[] {
  const stack: ShelfItemWithVolume[] = [start]
  const component: ShelfItemWithVolume[] = []
  visited.add(start.id)

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    component.push(current)

    for (const candidate of items) {
      if (visited.has(candidate.id)) continue
      if (isAdjacent(current, candidate)) {
        visited.add(candidate.id)
        stack.push(candidate)
      }
    }
  }

  return component
}

function isAdjacent(a: ShelfItemWithVolume, b: ShelfItemWithVolume): boolean {
  if (a.volume.series_id !== b.volume.series_id) return false

  const rectA = getItemRect(a)
  const rectB = getItemRect(b)

  const overlapX = rectA.left < rectB.right && rectB.left < rectA.right
  const overlapZ = rectA.bottom < rectB.top && rectB.bottom < rectA.top

  const xGap = Math.min(
    Math.abs(rectA.right - rectB.left),
    Math.abs(rectB.right - rectA.left)
  )
  const zGap = Math.min(
    Math.abs(rectA.top - rectB.bottom),
    Math.abs(rectB.top - rectA.bottom)
  )

  if (overlapX && overlapZ) return true
  if (overlapZ && xGap <= ADJACENCY_THRESHOLD) return true
  if (overlapX && zGap <= ADJACENCY_THRESHOLD) return true
  return false
}

function getItemRect(item: ShelfItemWithVolume): {
  left: number
  right: number
  bottom: number
  top: number
} {
  const left = item.position_x
  const right = item.position_x + getItemWidth(item)
  const bottom = (item.z_index ?? 0) * BOOK_GRID_SIZE
  const top = bottom + getItemHeight(item)
  return { left, right, bottom, top }
}

function createSeriesGroup(
  items: ShelfItemWithVolume[],
  rowIndex: number
): SeriesGroup {
  const startX = Math.min(...items.map((i) => i.position_x))
  const endX = Math.max(...items.map((i) => i.position_x + getItemWidth(i)))
  const minZ = Math.min(...items.map((i) => i.z_index ?? 0))
  const maxZ = Math.max(...items.map((i) => i.z_index ?? 0))

  return {
    seriesId: items[0]?.volume.series_id ?? null,
    startX,
    endX,
    rowIndex,
    minZ,
    maxZ,
    items: [...items]
  }
}

function getItemWidth(item: ShelfItemWithVolume): number {
  // Vertical books are narrower (spine), horizontal books are wider (cover)
  return item.orientation === "vertical" ? BOOK_SPINE_WIDTH : BOOK_LENGTH
}

function getItemHeight(item: ShelfItemWithVolume): number {
  return item.orientation === "vertical" ? BOOK_LENGTH : BOOK_GRID_SIZE
}
