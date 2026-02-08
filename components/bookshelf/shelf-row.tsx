"use client"

import { useMemo } from "react"
import { useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import {
  ShelfBook,
  BOOK_GRID_SIZE,
  BOOK_STACK_OFFSET,
  BOOK_LENGTH,
  BOOK_SPINE_WIDTH
} from "./shelf-book"
import type {
  ShelfItemWithVolume,
  BookOrientation,
  SeriesGroup
} from "@/lib/types/database"

interface ShelfRowProps {
  readonly rowIndex: number
  readonly items: ShelfItemWithVolume[]
  readonly height: number
  readonly width: number
  readonly seriesGroups: SeriesGroup[]
  readonly viewMode?: "volumes" | "series"
  readonly onItemOrientationChange?: (
    itemId: string,
    orientation: BookOrientation
  ) => void
  readonly onItemRemove?: (itemId: string) => void
  readonly disabled?: boolean
}

export function ShelfRow({
  rowIndex,
  items,
  height,
  width,
  seriesGroups,
  viewMode = "volumes",
  onItemOrientationChange,
  onItemRemove,
  disabled = false
}: ShelfRowProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `shelf-row-${rowIndex}`,
    data: {
      rowIndex,
      type: "shelf-row"
    }
  })

  const itemGroupInfo = useMemo(
    () => buildItemGroupInfo(seriesGroups, rowIndex),
    [rowIndex, seriesGroups]
  )
  const stackOffsets = useMemo(
    () => getStackOffsets(items, BOOK_GRID_SIZE),
    [items]
  )
  const seriesBlocks = useMemo(
    () => getSeriesBlocks(seriesGroups, rowIndex),
    [rowIndex, seriesGroups]
  )
  const groupedItemIds = useMemo(
    () => getGroupedItemIds(seriesGroups, rowIndex),
    [rowIndex, seriesGroups]
  )
  const visibleItems =
    viewMode === "series"
      ? items.filter((item) => !groupedItemIds.has(item.id))
      : items

  return (
    <div className="relative">
      {/* Shelf background with wood grain effect */}
      <div
        ref={setNodeRef}
        className={cn(
          "shelf-wood relative overflow-visible",
          isOver && "ring-1 ring-white/30 ring-inset"
        )}
        style={{
          height: `${height}px`,
          width: `${width}px`
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(1 0 0 / 6%) 1px, transparent 1px), linear-gradient(to top, oklch(1 0 0 / 4%) 1px, transparent 1px)",
            backgroundSize: `${BOOK_GRID_SIZE}px ${BOOK_GRID_SIZE}px`
          }}
        />
        {/* Shelf items */}
        <ul className="relative z-10 h-full w-full">
          {viewMode === "series" &&
            seriesBlocks.map((block) => (
              <SeriesGroupBlock key={block.key} block={block} />
            ))}
          {visibleItems.map((item) => {
            const groupInfo = itemGroupInfo.get(item.id) ?? DEFAULT_GROUP_INFO
            const stackInfo = stackOffsets.get(item.id)
            return (
              <ShelfBook
                key={item.id}
                item={item}
                isInGroup={groupInfo.isInGroup}
                stackIndex={stackInfo?.order ?? 0}
                stackOffset={stackInfo?.offset ?? 0}
                onOrientationChange={onItemOrientationChange}
                onRemove={onItemRemove}
                disabled={disabled}
              />
            )
          })}
        </ul>

        {/* Drop indicator when dragging */}
        {isOver && (
          <div className="pointer-events-none absolute inset-0 bg-white/5" />
        )}
      </div>

      {/* Shelf edge/lip */}
      <div className="shelf-edge h-3 w-full" />
    </div>
  )
}

type GroupInfo = {
  isInGroup: boolean
  groupPosition: "start" | "middle" | "end" | "single"
}

const DEFAULT_GROUP_INFO: GroupInfo = {
  isInGroup: false,
  groupPosition: "single"
}

type SeriesBlock = {
  key: string
  title: string
  volumeLabel: string
  startX: number
  width: number
  height: number
  stackOffset: number
  zIndex: number
  color: string
  showLabel: boolean
}

function buildItemGroupInfo(
  seriesGroups: SeriesGroup[],
  rowIndex: number
): Map<string, GroupInfo> {
  const info = new Map<string, GroupInfo>()
  for (const group of seriesGroups) {
    if (group.rowIndex !== rowIndex || group.items.length <= 1) continue
    group.items.forEach((item, index) => {
      let position: GroupInfo["groupPosition"] = "middle"
      if (index === 0) position = "start"
      else if (index === group.items.length - 1) position = "end"
      info.set(item.id, { isInGroup: true, groupPosition: position })
    })
  }
  return info
}

function getSeriesBlocks(
  seriesGroups: SeriesGroup[],
  rowIndex: number
): SeriesBlock[] {
  const blocks: SeriesBlock[] = []
  const adjacencyThreshold = Math.max(1, BOOK_GRID_SIZE / 2)

  seriesGroups
    .filter((group) => group.rowIndex === rowIndex && group.items.length > 1)
    .forEach((group) => {
      blocks.push(...buildSeriesBlocksForGroup(group, adjacencyThreshold))
    })

  return blocks
}

function buildSeriesBlocksForGroup(
  group: SeriesGroup,
  adjacencyThreshold: number
): SeriesBlock[] {
  const volumeNumbers = group.items
    .map((item) => normalizeVolumeNumber(item.volume.volume_number))
    .filter((value): value is number => value !== null)
  const volumeLabel = getVolumeLabel(volumeNumbers)
  const title = getSeriesTitle(group)
  const orientation = group.items[0]?.orientation ?? "vertical"
  const height = orientation === "horizontal" ? BOOK_GRID_SIZE : BOOK_LENGTH
  const color = getSeriesColor(group.seriesId ?? title)

  const groupBlocks: SeriesBlock[] = []
  const itemsByStack = groupItemsByStack(group.items)
  itemsByStack.forEach((stackItems, stackLevel) => {
    const segments = buildStackSegments(stackItems, adjacencyThreshold)
    segments.forEach((segment) => {
      groupBlocks.push({
        key: `${group.seriesId ?? "unknown"}-${segment.startX}-${segment.endX}-${orientation}-${stackLevel}`,
        title,
        volumeLabel,
        startX: segment.startX,
        width: Math.max(BOOK_GRID_SIZE, segment.endX - segment.startX),
        height,
        stackOffset: stackLevel * BOOK_STACK_OFFSET,
        zIndex: stackLevel,
        color,
        showLabel: false
      })
    })
  })

  const mergedBlocks =
    orientation === "horizontal"
      ? mergeHorizontalBlocks(groupBlocks)
      : groupBlocks

  return assignLabelTarget(mergedBlocks)
}

function groupItemsByStack(
  items: ShelfItemWithVolume[]
): Map<number, ShelfItemWithVolume[]> {
  const itemsByStack = new Map<number, ShelfItemWithVolume[]>()
  items.forEach((item) => {
    const stackLevel = item.z_index ?? 0
    const stackItems = itemsByStack.get(stackLevel) ?? []
    stackItems.push(item)
    itemsByStack.set(stackLevel, stackItems)
  })
  return itemsByStack
}

type StackSegment = { startX: number; endX: number }

function buildStackSegments(
  stackItems: ShelfItemWithVolume[],
  adjacencyThreshold: number
): StackSegment[] {
  const sorted = [...stackItems].sort((a, b) => a.position_x - b.position_x)
  if (sorted.length === 0) return []

  const segments: StackSegment[] = []
  let segmentStartX = sorted[0].position_x
  let segmentEndX = sorted[0].position_x + getItemWidth(sorted[0])

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const currentStart = current.position_x
    const currentEnd = current.position_x + getItemWidth(current)
    const gap = currentStart - segmentEndX

    if (gap <= adjacencyThreshold) {
      segmentEndX = Math.max(segmentEndX, currentEnd)
    } else {
      segments.push({ startX: segmentStartX, endX: segmentEndX })
      segmentStartX = currentStart
      segmentEndX = currentEnd
    }
  }

  segments.push({ startX: segmentStartX, endX: segmentEndX })
  return segments
}

function assignLabelTarget(blocks: SeriesBlock[]): SeriesBlock[] {
  if (blocks.length === 0) return blocks
  const labelTarget = [...blocks].sort((a, b) => {
    if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
    return b.width - a.width
  })[0]
  return blocks.map((block) => ({
    ...block,
    showLabel: block.key === labelTarget.key
  }))
}

function getGroupedItemIds(
  seriesGroups: SeriesGroup[],
  rowIndex: number
): Set<string> {
  const ids = new Set<string>()
  for (const group of seriesGroups) {
    if (group.rowIndex !== rowIndex || group.items.length <= 1) continue
    group.items.forEach((item) => ids.add(item.id))
  }
  return ids
}

function getSeriesTitle(group: SeriesGroup): string {
  const seriesTitle = group.items[0]?.volume.series?.title
  return seriesTitle ?? "Unknown Series"
}

function normalizeVolumeNumber(
  value: number | null | undefined
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.round(value)
}

function getVolumeLabel(numbers: number[]): string {
  if (numbers.length === 0) return "Volumes"
  const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b)

  const ranges: Array<{ start: number; end: number }> = []
  let rangeStart = sorted[0]
  let rangeEnd = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const value = sorted[i]
    if (value === rangeEnd + 1) {
      rangeEnd = value
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd })
      rangeStart = value
      rangeEnd = value
    }
  }

  ranges.push({ start: rangeStart, end: rangeEnd })

  const labels = ranges.map((range) =>
    range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`
  )

  return `Vol. ${labels.join(", ")}`
}

function getSeriesColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.codePointAt(i) ?? 0
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const hue = Math.abs(hash % 360)
  return `oklch(0.45 0.1 ${hue})`
}

function SeriesGroupBlock({ block }: { readonly block: SeriesBlock }) {
  return (
    <li
      className="pointer-events-none absolute overflow-hidden rounded-sm shadow-none"
      style={{
        left: `${block.startX}px`,
        bottom: `${block.stackOffset}px`,
        width: `${block.width}px`,
        height: `${block.height}px`,
        backgroundColor: block.color,
        zIndex: block.zIndex
      }}
      aria-label={`${block.title} ${block.volumeLabel}`}
    >
      {block.showLabel && (
        <div className="flex h-full w-full flex-col justify-center gap-0.5 px-1 text-[10px] font-medium text-white mix-blend-difference">
          <span className="truncate">{block.title}</span>
          <span className="truncate">{block.volumeLabel}</span>
        </div>
      )}
    </li>
  )
}

function mergeHorizontalBlocks(blocks: SeriesBlock[]): SeriesBlock[] {
  if (blocks.length <= 1) return blocks
  const bySpan = new Map<string, SeriesBlock[]>()

  blocks.forEach((block) => {
    const spanKey = `${normalizeGrid(block.startX)}:${normalizeGrid(block.width)}`
    const list = bySpan.get(spanKey) ?? []
    list.push(block)
    bySpan.set(spanKey, list)
  })

  const merged: SeriesBlock[] = []

  bySpan.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.zIndex - b.zIndex)
    let currentMin = sorted[0]
    let currentMax = sorted[0]

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]
      if (next.zIndex === currentMax.zIndex + 1) {
        currentMax = next
      } else {
        merged.push(buildMergedBlock(currentMin, currentMax))
        currentMin = next
        currentMax = next
      }
    }

    merged.push(buildMergedBlock(currentMin, currentMax))
  })

  return merged
}

function buildMergedBlock(
  minBlock: SeriesBlock,
  maxBlock: SeriesBlock
): SeriesBlock {
  const minZ = minBlock.zIndex
  const maxZ = maxBlock.zIndex
  const height = (maxZ - minZ + 1) * BOOK_STACK_OFFSET

  return {
    ...minBlock,
    key: `${minBlock.key}-merged-${minZ}-${maxZ}`,
    height,
    stackOffset: minZ * BOOK_STACK_OFFSET,
    zIndex: maxZ
  }
}

function normalizeGrid(value: number): number {
  return Math.round(value / BOOK_GRID_SIZE) * BOOK_GRID_SIZE
}

function getItemWidth(item: ShelfItemWithVolume): number {
  return item.orientation === "vertical" ? BOOK_SPINE_WIDTH : BOOK_LENGTH
}

const MAX_STACK_OFFSET_LEVEL = 6

function getStackOffsets(
  items: ShelfItemWithVolume[],
  gridSize: number
): Map<string, { order: number; offset: number }> {
  const stacks = new Map<number, ShelfItemWithVolume[]>()

  for (const item of items) {
    if (item.orientation !== "horizontal") continue
    const key = Math.round(item.position_x / gridSize)
    const group = stacks.get(key) ?? []
    group.push(item)
    stacks.set(key, group)
  }

  const offsets = new Map<string, { order: number; offset: number }>()
  stacks.forEach((group) => {
    const sorted = [...group].sort((a, b) => {
      if (a.z_index !== b.z_index) return a.z_index - b.z_index
      if (a.position_x !== b.position_x) return a.position_x - b.position_x
      return a.id.localeCompare(b.id)
    })

    sorted.forEach((item, order) => {
      const stackLevel = Math.max(0, item.z_index ?? 0)
      const offset =
        Math.min(stackLevel, MAX_STACK_OFFSET_LEVEL) * BOOK_STACK_OFFSET
      offsets.set(item.id, { order, offset })
    })
  })

  return offsets
}
