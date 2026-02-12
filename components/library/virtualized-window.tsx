"use client"

import {
  Fragment,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react"
import { useWindowVirtualizer } from "@tanstack/react-virtual"

const DEFAULT_OVERSCAN = 8

/**
 * Virtualizes a vertical list that scrolls with the window.
 * @source
 */
export function VirtualizedWindowList<TItem>({
  items,
  estimateSize,
  overscan = DEFAULT_OVERSCAN,
  getItemKey,
  renderItem,
  className
}: {
  readonly items: readonly TItem[]
  readonly estimateSize: () => number
  readonly overscan?: number
  readonly getItemKey: (item: TItem) => string
  readonly renderItem: (item: TItem) => ReactNode
  readonly className?: string
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const node = wrapperRef.current
    if (!node) return
    const next = node.offsetTop
    if (next !== scrollMargin) {
      setScrollMargin(next)
    }
  }, [scrollMargin, items.length])

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize,
    overscan,
    scrollMargin
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div ref={wrapperRef} className={className}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative"
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index]
          if (!item) return null

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start - scrollMargin}px)`
              }}
            >
              <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Virtualizes a responsive card grid by virtualizing *rows* while scrolling with the window.
 * The `gridClassName` is used on an invisible probe to detect current column count and gap.
 * @source
 */
export function VirtualizedWindowGrid<TItem>({
  items,
  columnCount,
  gapPx,
  estimateRowSize,
  overscan = DEFAULT_OVERSCAN,
  getItemKey,
  renderItem,
  className
}: {
  readonly items: readonly TItem[]
  readonly columnCount: number
  readonly gapPx: number
  readonly estimateRowSize: () => number
  readonly overscan?: number
  readonly getItemKey: (item: TItem) => string
  readonly renderItem: (item: TItem) => ReactNode
  readonly className?: string
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const node = wrapperRef.current
    if (!node) return
    const next = node.offsetTop
    if (next !== scrollMargin) {
      setScrollMargin(next)
    }
  }, [scrollMargin, items.length, columnCount, gapPx])

  const rows = useMemo(() => {
    const count = Math.max(columnCount, 1)
    const nextRows: TItem[][] = []
    for (let i = 0; i < items.length; i += count) {
      nextRows.push(items.slice(i, i + count))
    }
    return nextRows
  }, [items, columnCount])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: estimateRowSize,
    overscan,
    scrollMargin
  })

  const virtualRows = virtualizer.getVirtualItems()

  return (
    <div ref={wrapperRef} className={className}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative"
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowItems = rows[virtualRow.index] ?? []

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start - scrollMargin}px)`
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  columnGap: gapPx,
                  paddingBottom: gapPx
                }}
              >
                {rowItems.map((item) => (
                  <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
