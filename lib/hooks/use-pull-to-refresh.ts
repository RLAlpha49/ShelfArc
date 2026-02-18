"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Configuration for the {@link usePullToRefresh} hook. */
export interface UsePullToRefreshOptions {
  /** Async function to call when the user releases after pulling. */
  onRefresh: () => Promise<void>
  /** Minimum pull distance (px) to trigger a refresh. @default 80 */
  threshold?: number
  /** Whether the hook is enabled. @default true */
  enabled?: boolean
}

/**
 * Detects a pull-down gesture at the top of the page to trigger a refresh.
 *
 * Returns state and a ref to attach to the scrollable container.
 * Only activates on touch devices when the page is scrolled to the top.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  enabled = true
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || isRefreshing || e.touches.length !== 1) return

      // Only activate when at top of page
      const scrollTop =
        containerRef.current?.scrollTop ??
        globalThis.document?.documentElement?.scrollTop ??
        0

      if (scrollTop > 5) return

      startY.current = e.touches[0].clientY
      pulling.current = true
    },
    [enabled, isRefreshing]
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling.current || e.touches.length !== 1) return

      const deltaY = e.touches[0].clientY - startY.current

      // Only trigger for downward pulls
      if (deltaY < 0) {
        pulling.current = false
        setPullDistance(0)
        return
      }

      // Apply resistance to make the pull feel natural
      const distance = Math.min(deltaY * 0.4, threshold * 1.5)
      setPullDistance(distance)
    },
    [threshold]
  )

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return
    pulling.current = false

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(0)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh])

  useEffect(() => {
    if (!enabled) return

    const target = containerRef.current ?? globalThis.document
    if (!target) return

    const touchStartOpts = { passive: true } as const
    const touchMoveOpts = { passive: true } as const

    target.addEventListener(
      "touchstart",
      handleTouchStart as EventListener,
      touchStartOpts
    )
    target.addEventListener(
      "touchmove",
      handleTouchMove as EventListener,
      touchMoveOpts
    )
    target.addEventListener("touchend", handleTouchEnd as EventListener)

    return () => {
      target.removeEventListener(
        "touchstart",
        handleTouchStart as EventListener
      )
      target.removeEventListener("touchmove", handleTouchMove as EventListener)
      target.removeEventListener("touchend", handleTouchEnd as EventListener)
    }
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    isPulling: pullDistance > 0
  }
}
