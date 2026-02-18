"use client"

import { useCallback, useRef } from "react"

/** Direction(s) the swipe hook should listen for. */
export type SwipeDirection = "left" | "right" | "both"

/** Configuration for the {@link useSwipe} hook. */
export interface UseSwipeOptions {
  /** Minimum horizontal distance (px) to qualify as a swipe. @default 50 */
  threshold?: number
  /** Which direction(s) to detect. @default "both" */
  direction?: SwipeDirection
  /** Fired when a left swipe is completed. */
  onSwipeLeft?: () => void
  /** Fired when a right swipe is completed. */
  onSwipeRight?: () => void
  /** Called during the swipe with the current horizontal offset. */
  onSwiping?: (deltaX: number) => void
  /** Called when the swipe is cancelled or completed to reset UI. */
  onSwipeEnd?: () => void
}

/**
 * Detects horizontal swipe gestures on touch devices.
 *
 * Returns touch event handlers to spread onto the target element.
 * Only activates for single-touch interactions and avoids interfering
 * with vertical scrolling.
 */
export function useSwipe({
  threshold = 50,
  direction = "both",
  onSwipeLeft,
  onSwipeRight,
  onSwiping,
  onSwipeEnd
}: UseSwipeOptions = {}) {
  const startX = useRef(0)
  const startY = useRef(0)
  const tracking = useRef(false)
  const swiping = useRef(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Ignore multi-touch
      if (e.touches.length !== 1) return
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      tracking.current = true
      swiping.current = false
    },
    []
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!tracking.current || e.touches.length !== 1) return

      const deltaX = e.touches[0].clientX - startX.current
      const deltaY = e.touches[0].clientY - startY.current

      // If the gesture is more vertical than horizontal, cancel tracking
      // to avoid interfering with scrolling
      if (!swiping.current && Math.abs(deltaY) > Math.abs(deltaX)) {
        tracking.current = false
        onSwipeEnd?.()
        return
      }

      // Once horizontal intent is established, lock in
      if (Math.abs(deltaX) > 10) {
        swiping.current = true
      }

      if (swiping.current) {
        // Only report swiping in the configured direction
        const allowed =
          direction === "both" ||
          (direction === "left" && deltaX < 0) ||
          (direction === "right" && deltaX > 0)

        if (allowed) {
          onSwiping?.(deltaX)
        }
      }
    },
    [direction, onSwiping, onSwipeEnd]
  )

  const handleSwipeComplete = useCallback(
    (deltaX: number) => {
      if (Math.abs(deltaX) < threshold) return

      if (deltaX < -threshold && (direction === "both" || direction === "left")) {
        onSwipeLeft?.()
      } else if (deltaX > threshold && (direction === "both" || direction === "right")) {
        onSwipeRight?.()
      }
    },
    [threshold, direction, onSwipeLeft, onSwipeRight]
  )

  const onTouchEndWithAction = useCallback(
    (e: React.TouchEvent) => {
      if (!tracking.current) return

      const deltaX = e.changedTouches[0].clientX - startX.current
      tracking.current = false

      if (!swiping.current) {
        onSwipeEnd?.()
        return
      }

      swiping.current = false
      handleSwipeComplete(deltaX)
      onSwipeEnd?.()
    },
    [handleSwipeComplete, onSwipeEnd]
  )

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: onTouchEndWithAction
  }
}
