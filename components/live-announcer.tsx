"use client"

import { useEffect, useRef } from "react"

let liveRegionRef: HTMLElement | null = null

/**
 * Announce a message to screen readers via the singleton ARIA live region.
 * Uses clear-and-reset to force re-announcement of identical messages.
 * @param message - Text to announce.
 * @param priority - Politeness level ("polite" or "assertive"). Defaults to "polite".
 * @source
 */
export function announce(
  message: string,
  priority: "polite" | "assertive" = "polite"
): void {
  if (!liveRegionRef) return
  liveRegionRef.setAttribute("aria-live", priority)
  liveRegionRef.textContent = ""
  setTimeout(() => {
    if (liveRegionRef) {
      liveRegionRef.textContent = message
    }
  }, 100)
}

/**
 * Singleton ARIA live region for screen reader announcements.
 * Mount once in the app shell — renders a visually-hidden div.
 * @source
 */
export function LiveAnnouncer() {
  const ref = useRef<HTMLOutputElement>(null)

  useEffect(() => {
    liveRegionRef = ref.current
    return () => {
      liveRegionRef = null
    }
  }, [])

  return (
    <output
      ref={ref}
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
    />
  )
}
