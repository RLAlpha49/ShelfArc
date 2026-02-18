"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useSwipe } from "@/lib/hooks/use-swipe"

/** Props for the {@link SwipeableCard} wrapper. @source */
interface SwipeableCardProps {
  readonly children: React.ReactNode
  /** Fired on right swipe (toggle ownership). */
  readonly onSwipeRight?: () => void
  /** Fired on left swipe (cycle reading status). */
  readonly onSwipeLeft?: () => void
  /** Additional class names for the outer container. */
  readonly className?: string
}

/** Whether the device supports touch. */
const isTouchDevice = () =>
  typeof globalThis !== "undefined" &&
  ("ontouchstart" in globalThis ||
    globalThis.matchMedia?.("(pointer: coarse)")?.matches)

/**
 * Wraps a card/list-item with swipe-to-action gesture support.
 *
 * - Right swipe → green indicator (toggle ownership)
 * - Left swipe → blue indicator (cycle reading status)
 *
 * Only activates on touch devices as a progressive enhancement.
 */
export function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  className
}: SwipeableCardProps) {
  const [deltaX, setDeltaX] = useState(0)
  const [showIndicator, setShowIndicator] = useState(false)
  const touchEnabled = useRef(false)
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    touchEnabled.current = isTouchDevice()
  }, [])

  const handleSwiping = useCallback((dx: number) => {
    setDeltaX(dx)
    setShowIndicator(true)
  }, [])

  const handleSwipeEnd = useCallback(() => {
    setDeltaX(0)
    // Keep indicator briefly visible for visual feedback
    if (resetTimeout.current) clearTimeout(resetTimeout.current)
    resetTimeout.current = setTimeout(() => setShowIndicator(false), 200)
  }, [])

  useEffect(() => {
    return () => {
      if (resetTimeout.current) clearTimeout(resetTimeout.current)
    }
  }, [])

  const swipeHandlers = useSwipe({
    threshold: 50,
    direction: "both",
    onSwipeLeft,
    onSwipeRight,
    onSwiping: handleSwiping,
    onSwipeEnd: handleSwipeEnd
  })

  // On non-touch devices, just render children without overhead
  if (typeof globalThis !== "undefined" && !isTouchDevice()) {
    return <div className={className}>{children}</div>
  }

  const isRight = deltaX > 0
  const isLeft = deltaX < 0
  const absDelta = Math.abs(deltaX)
  const indicatorOpacity = Math.min(absDelta / 80, 0.6)

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className ?? ""}`}
      {...swipeHandlers}
    >
      {/* Background indicator */}
      {showIndicator && absDelta > 10 && (
        <div
          className="absolute inset-0 z-0 flex items-center transition-opacity"
          style={{
            opacity: indicatorOpacity,
            backgroundColor: isRight
              ? "oklch(0.65 0.16 145)" // green for ownership
              : "oklch(0.55 0.15 250)", // blue for reading status
            justifyContent: isRight ? "flex-start" : "flex-end",
            paddingLeft: isRight ? "1rem" : undefined,
            paddingRight: isLeft ? "1rem" : undefined
          }}
        >
          <span className="text-xs font-semibold text-white">
            {isRight ? "Toggle Owned" : "Cycle Status"}
          </span>
        </div>
      )}

      {/* Card content that translates */}
      <div
        className="relative z-10"
        style={{
          transform: absDelta > 5 ? `translateX(${deltaX * 0.3}px)` : undefined,
          transition: absDelta === 0 ? "transform 0.2s ease-out" : "none"
        }}
      >
        {children}
      </div>
    </div>
  )
}
